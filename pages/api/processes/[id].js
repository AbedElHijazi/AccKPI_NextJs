import { getPool } from '@/lib/db';

export default async function handler(req, res) {
  const { id } = req.query;

  console.log(`[DELETE API] Request received for ID: ${id}, Method: ${req.method}`);

  if (req.method === 'DELETE') {
    if (!id) {
      console.log(`[DELETE API] No ID provided`);
      return res.status(400).json({ error: 'Process ID is required' });
    }

    let pool;
    try {
      pool = await getPool();
    } catch (err) {
      console.error('[DELETE API] Database connection error:', err.message);
      return res.status(500).json({ error: 'Database connection failed' });
    }

    try {
      const processIdNum = parseInt(id, 10);
      console.log(`[DELETE API] Processing delete for ProcessID: ${processIdNum}`);

      // Verify process exists first
      const processCheck = await pool
        .request()
        .input('ProcessID', processIdNum)
        .query('SELECT NumberOfProccessID FROM tblProcess WHERE NumberOfProccessID = @ProcessID');

      if (processCheck.recordset.length === 0) {
        console.log(`[DELETE API] Process ${processIdNum} not found`);
        return res.status(404).json({ error: 'Process not found' });
      }

      console.log(`[DELETE API] Process found, starting cascade delete`);

      // 1. Delete workflow task history
      console.log(`[DELETE API Step 1] Deleting workflow task history`);
      await pool
        .request()
        .input('ProcessID', processIdNum)
        .query(`
          DELETE FROM tblWorkflowTaskHistory
          WHERE TaskID IN (
            SELECT TaskID FROM tblTasks
            WHERE WorkFlowHdrID IN (
              SELECT workFlowID FROM tblWorkflowHdr WHERE processID = @ProcessID
            )
            OR proccessID = @ProcessID
          )
        `);

      // 2. Delete tasks
      console.log(`[DELETE API Step 2] Deleting tasks`);
      await pool
        .request()
        .input('ProcessID', processIdNum)
        .query(`
          DELETE FROM tblTasks
          WHERE WorkFlowHdrID IN (
            SELECT workFlowID FROM tblWorkflowHdr WHERE processID = @ProcessID
          )
          OR proccessID = @ProcessID
        `);

      // 3. Delete workflow details
      console.log(`[DELETE API Step 3] Deleting workflow details`);
      await pool
        .request()
        .input('ProcessID', processIdNum)
        .query(`
          DELETE FROM tblWorkflowDtl
          WHERE workFlowHdrId IN (
            SELECT workFlowID FROM tblWorkflowHdr WHERE processID = @ProcessID
          )
        `);

      // 4. Delete workflow headers
      console.log(`[DELETE API Step 4] Deleting workflow headers`);
      await pool
        .request()
        .input('ProcessID', processIdNum)
        .query('DELETE FROM tblWorkflowHdr WHERE processID = @ProcessID');

      // 5. Delete process departments
      console.log(`[DELETE API Step 5] Deleting process departments`);
      await pool
        .request()
        .input('ProcessID', processIdNum)
        .query('DELETE FROM tblProcessDepartment WHERE ProcessID = @ProcessID');

      // 6. Delete the process
      console.log(`[DELETE API Step 6] Deleting process`);
      const result = await pool
        .request()
        .input('ProcessID', processIdNum)
        .query('DELETE FROM tblProcess WHERE NumberOfProccessID = @ProcessID');

      console.log(`[DELETE API] Cascade delete completed successfully`);
      return res.status(200).json({ message: 'Process deleted successfully' });
    } catch (error) {
      console.error('[DELETE API] Error:', error.message);
      return res.status(500).json({ error: 'Failed to delete process: ' + error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

