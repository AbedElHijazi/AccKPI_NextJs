import { getPool } from '@/lib/db';

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method === 'DELETE') {
    if (!id) {
      return res.status(400).json({ error: 'Process ID is required' });
    }

    try {
      const pool = await getPool();

      // Delete in correct order based on foreign key constraints:
      // 1. Delete workflow task history (references tasks)
      await pool
        .request()
        .input('ProcessID', id)
        .query(`
          DELETE FROM tblWorkflowTaskHistory 
          WHERE TaskID IN (
            SELECT TaskID FROM tblTasks 
            WHERE WorkFlowHdrID IN (
              SELECT workFlowHdrId FROM tblWorkflowHdr WHERE processID = @ProcessID
            )
            OR proccessID = @ProcessID
          )
        `);

      // 2. Delete tasks (both through workflow headers and direct process reference)
      await pool
        .request()
        .input('ProcessID', id)
        .query(`
          DELETE FROM tblTasks 
          WHERE WorkFlowHdrID IN (
            SELECT workFlowHdrId FROM tblWorkflowHdr WHERE processID = @ProcessID
          )
          OR proccessID = @ProcessID
        `);

      // 3. Delete workflow details (references workflow headers)
      await pool
        .request()
        .input('ProcessID', id)
        .query(`
          DELETE FROM tblWorkflowDtl 
          WHERE workFlowHdrId IN (
            SELECT workFlowHdrId FROM tblWorkflowHdr WHERE processID = @ProcessID
          )
        `);

      // 4. Delete workflow headers (references processes)
      await pool
        .request()
        .input('ProcessID', id)
        .query('DELETE FROM tblWorkflowHdr WHERE processID = @ProcessID');

      // 5. Delete process departments (references processes)
      await pool
        .request()
        .input('ProcessID', id)
        .query('DELETE FROM tblProcessDepartment WHERE ProcessID = @ProcessID');

      // 6. Finally delete the process
      const result = await pool
        .request()
        .input('ProcessID', id)
        .query('DELETE FROM tblProcess WHERE NumberOfProccessID = @ProcessID');

      if (result.rowsAffected[0] === 0) {
        return res.status(404).json({ error: 'Process not found' });
      }

      return res.status(200).json({ message: 'Process and associated data deleted successfully' });
    } catch (error) {
      console.error('Error deleting process:', error);
      return res.status(500).json({ error: 'Failed to delete process: ' + error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
