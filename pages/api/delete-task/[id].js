import { getPool } from '@/lib/db';
import sql from 'mssql';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const taskId = parseInt(req.query.id);

  if (!taskId || isNaN(taskId)) {
    return res.status(400).json({ error: 'Valid Task ID is required' });
  }

  try {
    const pool = await getPool();

    // Get the task info before deletion
    const taskInfoResult = await pool.request()
      .input('TaskID', sql.Int, taskId)
      .query(`
        SELECT DepId, proccessID AS ProcessID, Priority
        FROM tblTasks
        WHERE TaskID = @TaskID
      `);

    if (taskInfoResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const { DepId, ProcessID } = taskInfoResult.recordset[0];

    // Update tasks that depend on this task (set PredecessorID to NULL)
    await pool.request()
      .input('TaskID', sql.Int, taskId)
      .query(`
        UPDATE tblTasks
        SET PredecessorID = NULL
        WHERE PredecessorID = @TaskID
      `);

    // Delete workflow details
    await pool.request()
      .input('TaskID', sql.Int, taskId)
      .query(`
        DELETE FROM tblWorkflowDtl
        WHERE TaskID = @TaskID
      `);

    // Delete from workflow task history
    await pool.request()
      .input('TaskID', sql.Int, taskId)
      .query(`
        DELETE FROM tblWorkflowTaskHistory
        WHERE TaskID = @TaskID
      `);

    // Delete the task itself
    const deleteResult = await pool.request()
      .input('TaskID', sql.Int, taskId)
      .query(`
        DELETE FROM tblTasks
        WHERE TaskID = @TaskID
      `);

    if (deleteResult.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Recalculate priorities for remaining tasks
    const remainingTasks = await pool.request()
      .input('DepId', sql.Int, DepId)
      .input('ProcessID', sql.Int, ProcessID)
      .query(`
        SELECT TaskID
        FROM tblTasks
        WHERE DepId = @DepId AND proccessID = @ProcessID
        ORDER BY Priority ASC
      `);

    // Update priorities sequentially
    for (let i = 0; i < remainingTasks.recordset.length; i++) {
      await pool.request()
        .input('NewPriority', sql.Int, i + 1)
        .input('UpdateTaskID', sql.Int, remainingTasks.recordset[i].TaskID)
        .query(`
          UPDATE tblTasks
          SET Priority = @NewPriority
          WHERE TaskID = @UpdateTaskID
        `);
    }

    console.log(`[DELETE-TASK] Deleted task ${taskId}`);
    return res.status(200).json({ 
      success: true,
      message: 'Task deleted successfully',
      taskId: taskId
    });
  } catch (error) {
    console.error('[DELETE-TASK] Error:', error);
    return res.status(500).json({ error: 'Failed to delete task: ' + error.message });
  }
}
