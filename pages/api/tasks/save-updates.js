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
          .query('SELECT IsFixed, WorkFlowHdrID FROM tblTasks WHERE TaskID = @taskId');

        const task = check.recordset[0];
        if (!task?.IsFixed) {
          const days = Number(value);
          if (!Number.isFinite(days) || days < 1) {
            return res.status(400).json({ error: 'Days required must be a number ≥ 1' });
          }

          const blockResult = await pool.request()
            .input('taskId', sql.Int, taskId)
            .query(`
              SELECT CAST(CASE WHEN EXISTS (
                SELECT 1
                FROM tblTasks t2
                INNER JOIN tblWorkflowDtl wd ON wd.TaskID = t2.TaskID
                  AND wd.workFlowHdrId = (SELECT WorkFlowHdrID FROM tblTasks WHERE TaskID = @taskId)
                INNER JOIN tblWorkflowHdr h2 ON h2.WorkFlowID = t2.WorkFlowHdrID
                INNER JOIN tblProcessDepartment pd2 ON pd2.DepartmentID = t2.DepId AND pd2.ProcessID = h2.ProcessID
                CROSS APPLY (
                  SELECT pd.StepOrder AS so, t.Priority AS pri, t.TaskID AS tid
                  FROM tblTasks t
                  INNER JOIN tblWorkflowHdr h ON h.WorkFlowID = t.WorkFlowHdrID
                  INNER JOIN tblProcessDepartment pd ON pd.DepartmentID = t.DepId AND pd.ProcessID = h.ProcessID
                  WHERE t.TaskID = @taskId
                ) cur
                WHERE t2.TaskID <> @taskId
                  AND t2.WorkFlowHdrID = (SELECT WorkFlowHdrID FROM tblTasks WHERE TaskID = @taskId)
                  AND wd.TimeFinished IS NULL
                  AND (
                    pd2.StepOrder < cur.so
                    OR (pd2.StepOrder = cur.so AND t2.Priority < cur.pri)
                    OR (pd2.StepOrder = cur.so AND t2.Priority = cur.pri AND t2.TaskID < cur.tid)
                  )
              ) THEN 1 ELSE 0 END AS bit) AS Blocked
            `);
          if (blockResult.recordset[0]?.Blocked) {
            return res.status(400).json({
              error: 'Finish earlier workflow tasks (by step / priority) before changing days required.'
            });
          }

          // PlannedDate = latest finished calendar day on this workflow (tblWorkflowDtl) + DaysRequired.
          // Excludes this task's own finish. If nothing finished yet, base = today.
          await pool.request()
            .input('taskId', sql.Int, taskId)
            .input('days', sql.Int, days)
            .query(`
              UPDATE t
              SET
                t.DaysRequired = @days,
                t.PlannedDate = DATEADD(
                  DAY,
                  @days,
                  CAST(COALESCE(
                    (SELECT MAX(CAST(wd.TimeFinished AS date))
                     FROM tblWorkflowDtl wd
                     WHERE wd.workFlowHdrId = t.WorkFlowHdrID
                       AND t.WorkFlowHdrID IS NOT NULL
                       AND wd.TimeFinished IS NOT NULL
                       AND wd.TaskID <> @taskId),
                    CAST(GETDATE() AS date)
                  ) AS date)
                )
              FROM tblTasks t
              WHERE t.TaskID = @taskId
            `);
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
