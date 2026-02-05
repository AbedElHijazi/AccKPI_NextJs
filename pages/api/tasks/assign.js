import { getPool } from '@/lib/db';
import sql from 'mssql';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { taskId, userId, workFlowID } = req.body;

  if (!taskId || !userId) {
    return res.status(400).json({ error: 'taskId and userId are required' });
  }

  try {
    const pool = await getPool();

    // Update workflow detail to assign user
    let query = `
      UPDATE tblWorkflowDtl 
      SET assignUser = @userId
      WHERE TaskID = @taskId
    `;

    const request = pool.request()
      .input('taskId', sql.Int, parseInt(taskId))
      .input('userId', sql.NVarChar, userId);

    if (workFlowID) {
      query += ` AND workFlowHdrId = @workFlowID`;
      request.input('workFlowID', sql.Int, parseInt(workFlowID));
    }

    await request.query(query);

    return res.status(200).json({
      success: true,
      message: 'Task assigned successfully'
    });
  } catch (error) {
    console.error('Error assigning task:', error);
    return res.status(500).json({ error: 'Failed to assign task' });
  }
}
