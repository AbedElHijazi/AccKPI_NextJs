import sql from 'mssql';
import { getPool } from '@/lib/db';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { taskId, finishTime, workFlowHdrId, processID } = req.body;

  if (!taskId || !workFlowHdrId) {
    return res.status(400).json({ error: 'Missing taskId or workFlowHdrId' });
  }

  try {
    const pool = await getPool();

    // Parse finishTime as YYYY-MM-DD format
    const finishTimeFormatted = finishTime.includes('T')
      ? finishTime.split('T')[0] + ' 00:00:00'
      : finishTime.includes('-') && !finishTime.includes(':')
        ? finishTime + ' 00:00:00'
        : finishTime;

    // Get task info
    const taskResult = await pool.request()
      .input('taskId', sql.Int, taskId)
      .query(`SELECT t.PlannedDate, t.DepId, t.DaysRequired FROM tblTasks t WHERE t.TaskID = @taskId`);

    if (taskResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const { PlannedDate, DepId, DaysRequired } = taskResult.recordset[0];

    // Calculate delay
    const plannedDateObj = new Date(PlannedDate);
    const finishDateObj = new Date(finishTime + 'T00:00:00Z');
    const delayMs = finishDateObj.getTime() - plannedDateObj.getTime();
    const delay = Math.max(0, Math.round(delayMs / (1000 * 60 * 60 * 24)));

    console.log('Delay calculation:', { PlannedDate, finishTime, delay });

    // Mark workflow detail as finished
    await pool.request()
      .input('taskId', sql.Int, taskId)
      .input('finishTime', sql.DateTime2, finishTimeFormatted)
      .input('delay', sql.Int, delay)
      .input('workFlowHdrId', sql.Int, workFlowHdrId)
      .query(`
        UPDATE tblWorkflowDtl
        SET TimeFinished = @finishTime, Delay = @delay
        WHERE TaskID = @taskId AND workFlowHdrId = @workFlowHdrId
      `);

    // Save to history
    try {
      const taskStepResult = await pool.request()
        .input('workFlowHdrId', sql.Int, workFlowHdrId)
        .query(`SELECT stepNumber FROM tblWorkflowSteps WHERE workFlowID = @workFlowHdrId AND isActive = 1`);

      if (taskStepResult.recordset.length > 0) {
        const taskStepNumber = taskStepResult.recordset[0].stepNumber;

        const taskDetailsResult = await pool.request()
          .input('taskId', sql.Int, taskId)
          .query(`SELECT t.TaskName, t.DepId, t.IsTaskSelected, t.Priority, t.PlannedDate FROM tblTasks t WHERE t.TaskID = @taskId`);

        if (taskDetailsResult.recordset.length > 0) {
          const taskDetails = taskDetailsResult.recordset[0];

          const deptResult = await pool.request()
            .input('depId', sql.Int, taskDetails.DepId)
            .query(`SELECT DeptName FROM tblDepartments WHERE DepartmentID = @depId`);

          const deptName = deptResult.recordset[0]?.DeptName || 'Unknown';

          const timeStartedResult = await pool.request()
            .input('taskId', sql.Int, taskId)
            .input('workFlowHdrId', sql.Int, workFlowHdrId)
            .query(`SELECT TimeStarted FROM tblWorkflowDtl WHERE TaskID = @taskId AND workFlowHdrId = @workFlowHdrId`);

          const timeStarted = timeStartedResult.recordset[0]?.TimeStarted || null;

          await pool.request()
            .input('workFlowHdrId', sql.Int, workFlowHdrId)
            .input('taskId', sql.Int, taskId)
            .input('stepNumber', sql.Int, taskStepNumber)
            .input('taskName', sql.NVarChar, taskDetails.TaskName)
            .input('depId', sql.Int, taskDetails.DepId)
            .input('deptName', sql.NVarChar, deptName)
            .input('isTaskSelected', sql.Bit, taskDetails.IsTaskSelected)
            .input('timeStarted', sql.DateTime2, timeStarted)
            .input('timeFinished', sql.DateTime2, finishTimeFormatted)
            .input('delayValue', sql.Int, delay)
            .input('priority', sql.Int, taskDetails.Priority)
            .input('plannedDate', sql.DateTime2, taskDetails.PlannedDate)
            .query(`
              INSERT INTO tblWorkflowTaskHistory (workFlowID, PaymentStep, TaskID, TaskName, DepId, DeptName, IsTaskSelected, TimeStarted, TimeFinished, Delay, Priority, PlannedDate)
              VALUES (@workFlowHdrId, @stepNumber, @taskId, @taskName, @depId, @deptName, @isTaskSelected, @timeStarted, @timeFinished, @delayValue, @priority, @plannedDate)
            `);
        }
      }
    } catch (historyError) {
      console.error('Error saving task to history:', historyError.message);
    }

    // Unselect completed task
    await pool.request()
      .input('taskId', sql.Int, taskId)
      .query(`UPDATE tblTasks SET IsTaskSelected = 0 WHERE TaskID = @taskId`);

    // Mark Contract tasks (DepId=9) as isDoneOnce
    if (DepId === 9) {
      await pool.request()
        .input('taskId', sql.Int, taskId)
        .query(`UPDATE tblTasks SET isDoneOnce = 1 WHERE TaskID = @taskId`);
    }

    // Activate linked tasks
    const linkedTasksResult = await pool.request()
      .input('finishedTaskId', sql.Int, taskId)
      .input('workFlowHdrId', sql.Int, workFlowHdrId)
      .query(`
        SELECT t.TaskID, t.DepId
        FROM tblTasks t
        JOIN tblWorkflowDtl w ON t.TaskID = w.TaskID
        WHERE t.linkTasks = @finishedTaskId AND w.workFlowHdrId = @workFlowHdrId
      `);

    for (const linkedTask of linkedTasksResult.recordset) {
      await pool.request()
        .input('linkedTaskId', sql.Int, linkedTask.TaskID)
        .query(`UPDATE tblTasks SET IsTaskSelected = 1 WHERE TaskID = @linkedTaskId`);
    }

    // Auto-select next task in same department
    const nextTaskResult = await pool.request()
      .input('depId', sql.Int, DepId)
      .input('workFlowHdrId', sql.Int, workFlowHdrId)
      .query(`
        SELECT TOP 1 t.TaskID, t.DaysRequired, t.Priority
        FROM tblTasks t
        JOIN tblWorkflowDtl w ON t.TaskID = w.TaskID
        WHERE t.DepId = @depId
          AND w.workFlowHdrId = @workFlowHdrId
          AND t.IsTaskSelected = 0
          AND w.TimeFinished IS NULL
        ORDER BY t.Priority ASC, t.TaskID ASC
      `);

    if (nextTaskResult.recordset.length > 0) {
      const nextTaskId = nextTaskResult.recordset[0].TaskID;
      const nextTaskDays = Number(nextTaskResult.recordset[0].DaysRequired) || 1;

      // Count finished tasks for buffer calculation
      const finishedTasksCount = await pool.request()
        .input('workFlowHdrId', sql.Int, workFlowHdrId)
        .query(`SELECT COUNT(*) AS Count FROM tblWorkflowDtl WHERE workFlowHdrId = @workFlowHdrId AND TimeFinished IS NOT NULL`);

      const taskSequenceNumber = finishedTasksCount.recordset[0].Count + 1;
      const buffer = (taskSequenceNumber >= 3 && nextTaskDays < 20) ? 1 : 0;

      const nextPlanned = new Date(finishDateObj);
      nextPlanned.setDate(nextPlanned.getDate() + nextTaskDays + buffer);

      await pool.request()
        .input('plannedDate', sql.VarChar, nextPlanned.toISOString().split('T')[0])
        .input('nextTaskId', sql.Int, nextTaskId)
        .query(`UPDATE tblTasks SET PlannedDate = @plannedDate WHERE TaskID = @nextTaskId`);

      await pool.request()
        .input('nextTaskId', sql.Int, nextTaskId)
        .query(`UPDATE tblTasks SET IsTaskSelected = 1 WHERE TaskID = @nextTaskId`);
    }

    // Check if all tasks in department finished -> move to next department
    const remaining = await pool.request()
      .input('depId', sql.Int, DepId)
      .input('workFlowHdrId', sql.Int, workFlowHdrId)
      .query(`
        SELECT COUNT(*) AS Remaining
        FROM tblTasks t
        JOIN tblWorkflowDtl w ON t.TaskID = w.TaskID
        WHERE t.DepId = @depId AND w.workFlowHdrId = @workFlowHdrId AND w.TimeFinished IS NULL
      `);

    if (remaining.recordset[0].Remaining === 0 && processID) {
      const processInfo = await pool.request()
        .input('depId', sql.Int, DepId)
        .input('processID', sql.Int, processID)
        .query(`SELECT ProcessID, StepOrder FROM tblProcessDepartment WHERE DepartmentID = @depId AND ProcessID = @processID`);

      if (processInfo.recordset.length > 0) {
        const { ProcessID, StepOrder } = processInfo.recordset[0];

        const nextDeptInfoResult = await pool.request()
          .input('processId', sql.Int, ProcessID)
          .input('nextStep', sql.Int, StepOrder + 1)
          .query(`SELECT DepartmentID FROM tblProcessDepartment WHERE ProcessID = @processId AND StepOrder = @nextStep`);

        if (nextDeptInfoResult.recordset.length > 0) {
          const nextDepId = nextDeptInfoResult.recordset[0].DepartmentID;

          await pool.request()
            .input('processId', sql.Int, ProcessID)
            .input('nextStep', sql.Int, StepOrder + 1)
            .query(`UPDATE tblProcessDepartment SET IsActive = 1 WHERE ProcessID = @processId AND StepOrder = @nextStep`);

          // Select first task in next department
          await pool.request()
            .input('nextDepId', sql.Int, nextDepId)
            .input('workFlowHdrId', sql.Int, workFlowHdrId)
            .query(`
              ;WITH NextTask AS (
                SELECT TOP 1 t.TaskID
                FROM tblTasks t
                JOIN tblWorkflowDtl w ON t.TaskID = w.TaskID
                WHERE t.DepId = @nextDepId
                  AND w.workFlowHdrId = @workFlowHdrId
                  AND t.IsTaskSelected = 0
                  AND w.TimeFinished IS NULL
                ORDER BY t.Priority ASC, t.PlannedDate ASC
              )
              UPDATE tblTasks
              SET IsTaskSelected = 1
              FROM tblTasks t
              JOIN NextTask nt ON t.TaskID = nt.TaskID
            `);

          // Set planned date for first task in next department
          const nextDeptTask = await pool.request()
            .input('nextDepId', sql.Int, nextDepId)
            .input('workFlowHdrId', sql.Int, workFlowHdrId)
            .query(`
              SELECT TOP 1 t.TaskID, t.DaysRequired
              FROM tblTasks t
              JOIN tblWorkflowDtl w ON t.TaskID = w.TaskID
              WHERE t.DepId = @nextDepId
                AND w.workFlowHdrId = @workFlowHdrId
                AND t.IsTaskSelected = 1
                AND w.TimeFinished IS NULL
              ORDER BY t.Priority ASC, t.TaskID ASC
            `);

          if (nextDeptTask.recordset.length > 0) {
            const nextDeptTaskId = nextDeptTask.recordset[0].TaskID;
            const nextDeptDays = Number(nextDeptTask.recordset[0].DaysRequired) || 1;

            const finishedCount = await pool.request()
              .input('workFlowHdrId', sql.Int, workFlowHdrId)
              .query(`SELECT COUNT(*) AS Count FROM tblWorkflowDtl WHERE workFlowHdrId = @workFlowHdrId AND TimeFinished IS NOT NULL`);

            const seqNum = finishedCount.recordset[0].Count + 1;
            const buf = (seqNum >= 3 && nextDeptDays < 20) ? 1 : 0;

            const plannedDate = new Date(finishDateObj);
            plannedDate.setDate(plannedDate.getDate() + nextDeptDays + buf);

            await pool.request()
              .input('plannedDate', sql.VarChar, plannedDate.toISOString().split('T')[0])
              .input('nextDeptTaskId', sql.Int, nextDeptTaskId)
              .query(`UPDATE tblTasks SET PlannedDate = @plannedDate WHERE TaskID = @nextDeptTaskId`);
          }
        }
      }
    }

    // Auto-advance payment steps if all tasks complete
    try {
      const allTasksFinishedResult = await pool.request()
        .input('workFlowHdrId', sql.Int, workFlowHdrId)
        .query(`
          SELECT COUNT(*) AS UnfinishedCount
          FROM tblWorkflowDtl wd
          JOIN tblTasks t ON wd.TaskID = t.TaskID
          WHERE wd.workFlowHdrId = @workFlowHdrId AND wd.TimeFinished IS NULL AND t.DepId != 9
        `);

      if (allTasksFinishedResult.recordset[0].UnfinishedCount === 0) {
        const workflowStepsResult = await pool.request()
          .input('workFlowHdrId', sql.Int, workFlowHdrId)
          .query(`
            SELECT COUNT(*) AS StepCount,
                   (SELECT stepNumber FROM tblWorkflowSteps WHERE workFlowID = @workFlowHdrId AND isActive = 1) AS CurrentStep
            FROM tblWorkflowSteps WHERE workFlowID = @workFlowHdrId
          `);

        const stepInfo = workflowStepsResult.recordset[0];
        const stepCount = stepInfo?.StepCount || 0;
        const currentStepNumber = stepInfo?.CurrentStep;

        if (stepCount > 1 && currentStepNumber) {
          const nextStepResult = await pool.request()
            .input('workFlowHdrId', sql.Int, workFlowHdrId)
            .input('currentStep', sql.Int, currentStepNumber)
            .query(`
              SELECT TOP 1 workflowStepID, stepNumber FROM tblWorkflowSteps
              WHERE workFlowID = @workFlowHdrId AND stepNumber > @currentStep
              ORDER BY stepNumber ASC
            `);

          if (nextStepResult.recordset.length > 0) {
            const nextStepNumber = nextStepResult.recordset[0].stepNumber;

            // Deactivate current step
            await pool.request()
              .input('workFlowHdrId', sql.Int, workFlowHdrId)
              .input('currentStep', sql.Int, currentStepNumber)
              .query(`UPDATE tblWorkflowSteps SET isActive = 0, StepFinished = GETDATE() WHERE workFlowID = @workFlowHdrId AND stepNumber = @currentStep`);

            // Activate next step
            await pool.request()
              .input('workFlowHdrId', sql.Int, workFlowHdrId)
              .input('nextStep', sql.Int, nextStepNumber)
              .query(`UPDATE tblWorkflowSteps SET isActive = 1 WHERE workFlowID = @workFlowHdrId AND stepNumber = @nextStep`);

            // Reset workflow details for next payment
            await pool.request()
              .input('workFlowHdrId', sql.Int, workFlowHdrId)
              .query(`UPDATE tblWorkflowDtl SET TimeStarted = NULL, TimeFinished = NULL, Delay = NULL, DelayReason = NULL, PlannedDate = NULL WHERE workFlowHdrId = @workFlowHdrId`);

            await pool.request()
              .input('workFlowHdrId', sql.Int, workFlowHdrId)
              .query(`UPDATE tblTasks SET PlannedDate = NULL WHERE WorkFlowHdrID = @workFlowHdrId`);

            // Reset all tasks as unselected
            await pool.request()
              .input('workFlowHdrId', sql.Int, workFlowHdrId)
              .query(`
                UPDATE tblTasks SET IsTaskSelected = 0
                WHERE TaskID IN (SELECT t.TaskID FROM tblTasks t JOIN tblWorkflowDtl w ON t.TaskID = w.TaskID WHERE w.workFlowHdrId = @workFlowHdrId)
              `);

            // Select first non-Contract, non-Procurement task
            const firstTaskResult = await pool.request()
              .input('workFlowHdrId', sql.Int, workFlowHdrId)
              .query(`
                SELECT TOP 1 t.TaskID FROM tblTasks t
                JOIN tblWorkflowDtl w ON t.TaskID = w.TaskID
                WHERE w.workFlowHdrId = @workFlowHdrId AND t.DepId NOT IN (8, 9)
                ORDER BY t.DepId ASC, t.Priority ASC, t.TaskID ASC
              `);

            if (firstTaskResult.recordset.length > 0) {
              await pool.request()
                .input('taskId', sql.Int, firstTaskResult.recordset[0].TaskID)
                .query(`UPDATE tblTasks SET IsTaskSelected = 1 WHERE TaskID = @taskId`);
            }
          }
        }
      }
    } catch (advanceError) {
      console.error('Error advancing workflow steps:', advanceError);
    }

    res.status(200).json({ message: 'Task finished successfully' });
  } catch (error) {
    console.error('Error finishing task:', error);
    res.status(500).json({ error: 'Failed to finish task' });
  }
}
