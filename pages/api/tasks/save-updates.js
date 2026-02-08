import sql from 'mssql';
import { getPool } from '@/lib/db';

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { updates } = req.body;

  if (!updates || !Array.isArray(updates)) {
    return res.status(400).json({ error: 'Missing updates array' });
  }

  const updatedTasks = [];

  try {
    const pool = await getPool();

    for (const update of updates) {
      const { taskId, field, value, usrID } = update;

      if (field === 'daysRequired') {
        const check = await pool.request()
          .input('taskId', sql.Int, taskId)
          .query('SELECT IsFixed, PlannedDate FROM tblTasks WHERE TaskID = @taskId');

        const task = check.recordset[0];
        if (!task?.IsFixed) {
          await pool.request()
            .input('taskId', sql.Int, taskId)
            .input('value', sql.Int, value)
            .query('UPDATE tblTasks SET DaysRequired = @value WHERE TaskID = @taskId');

          if (task?.PlannedDate !== null) {
            await pool.request()
              .input('taskId', sql.Int, taskId)
              .input('days', sql.Int, value)
              .query(`
                UPDATE tblTasks 
                SET PlannedDate = DATEADD(DAY, @days + 1, CAST(GETDATE() AS DATE))
                WHERE TaskID = @taskId
              `);
          }
        }
      }

      if (field === 'delayReason') {
        await pool.request()
          .input('taskId', sql.Int, taskId)
          .input('value', sql.NVarChar, value)
          .query(`
            UPDATE tblWorkflowDtl
            SET DelayReason = @value
            WHERE TaskID = @taskId AND WorkflowDtlId = (
              SELECT TOP 1 WorkflowDtlId
              FROM tblWorkflowDtl
              WHERE TaskID = @taskId
              ORDER BY WorkflowDtlId DESC
            )
          `);
      }

      const updatedTask = await pool.request()
        .input('taskId', sql.Int, taskId)
        .query(`SELECT TaskID, TaskName, IsTaskSelected, PlannedDate, DepId, Priority, DaysRequired, IsFixed, WorkFlowHdrID FROM tblTasks WHERE TaskID = @taskId`);

      updatedTasks.push(updatedTask.recordset[0]);
    }

    res.json({ success: true, updatedTasks });
  } catch (err) {
    console.error('Error saving updates:', err);
    res.status(500).json({ error: 'Server error' });
  }
}
