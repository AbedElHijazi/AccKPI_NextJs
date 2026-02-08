import sql from 'mssql';
import { getPool } from '@/lib/db';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { taskId, startTime, workFlowHdrId, processID } = req.body;

  if (!taskId || !workFlowHdrId) {
    return res.status(400).json({ error: 'Missing taskId or workFlowHdrId' });
  }

  try {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // Extract just the date part (YYYY-MM-DD) to avoid timezone shifts
      const startDateOnly = startTime.split('T')[0].split(' ')[0];

      // 1. Update task start time in workflow detail
      await transaction.request()
        .input('taskId', sql.Int, taskId)
        .input('workFlowHdrId', sql.Int, workFlowHdrId)
        .input('startTime', sql.VarChar(30), startDateOnly)
        .query(`
          UPDATE tblWorkflowDtl
          SET TimeStarted = CAST(@startTime AS DATETIME2)
          WHERE TaskID = @taskId 
            AND workFlowHdrId = @workFlowHdrId
            AND TimeStarted IS NULL
        `);

      // 2. Check and set workflow start date if null
      const startDateResult = await transaction.request()
        .input('workFlowHdrId', sql.Int, workFlowHdrId)
        .query(`SELECT startDate FROM tblWorkflowHdr WHERE workFlowID = @workFlowHdrId`);

      if (!startDateResult.recordset[0]?.startDate) {
        await transaction.request()
          .input('workFlowHdrId', sql.Int, workFlowHdrId)
          .query(`UPDATE tblWorkflowHdr SET startDate = GETDATE() WHERE workFlowID = @workFlowHdrId`);
      }

      // 3. Get task info and set PlannedDate if not set
      const depResult = await transaction.request()
        .input('taskId', sql.Int, taskId)
        .query(`SELECT DepId, PlannedDate FROM tblTasks WHERE TaskID = @taskId`);

      const currentDepId = depResult.recordset[0]?.DepId;
      const currentPlannedDate = depResult.recordset[0]?.PlannedDate;

      if (!currentPlannedDate) {
        await transaction.request()
          .input('taskId', sql.Int, taskId)
          .query(`
            UPDATE tblTasks
            SET PlannedDate = DATEADD(DAY, DaysRequired, CAST(GETDATE() AS DATE))
            WHERE TaskID = @taskId
          `);
      }

      // 4. Find next task in same department
      const nextTaskResult = await transaction.request()
        .input('depId', sql.Int, currentDepId)
        .query(`
          SELECT TOP 1 TaskID, DepId
          FROM tblTasks
          WHERE DepId = @depId AND IsTaskSelected = 0
          ORDER BY Priority ASC, TaskID ASC
        `);

      await transaction.commit();

      res.status(200).json({
        message: 'Task started successfully',
        nextDepId: nextTaskResult.recordset[0]?.DepId || null
      });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error('Error starting task:', error);
    res.status(500).json({ error: 'Failed to start task' });
  }
}
