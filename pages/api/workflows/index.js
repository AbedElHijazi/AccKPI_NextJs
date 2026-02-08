import { getPool } from '@/lib/db';
import sql from 'mssql';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return await getWorkflows(res);
  } else if (req.method === 'POST') {
    return await createWorkflow(req, res);
  }
  return res.status(405).json({ error: 'Method not allowed' });
}

async function getWorkflows(res) {
  try {
    const pool = await getPool();
    
    const result = await pool.request().query(`
      SELECT 
        hdr.WorkFlowID,
        hdr.processID,
        hdr.projectID,
        hdr.packageID,
        hdr.startDate,
        hdr.status,
        hdr.createdDate,
        pr.ProcessName,
        pj.ProjectName,
        pk.PkgeName,
        (SELECT COUNT(*) FROM tblWorkflowDtl WHERE workFlowHdrId = hdr.WorkFlowID) as TaskCount,
        (SELECT COUNT(*) FROM tblWorkflowDtl WHERE workFlowHdrId = hdr.WorkFlowID AND TimeFinished IS NOT NULL) as CompletedCount
      FROM tblWorkflowHdr hdr
      LEFT JOIN tblProcess pr ON hdr.processID = pr.NumberOfProccessID
      LEFT JOIN tblProject pj ON hdr.projectID = pj.ProjectID
      LEFT JOIN tblPackages pk ON hdr.packageID = pk.PkgeId
      ORDER BY hdr.createdDate DESC
    `);

    return res.status(200).json(result.recordset);
  } catch (error) {
    console.error('Error fetching workflows:', error);
    return res.status(500).json({ error: 'Failed to fetch workflows' });
  }
}

async function createWorkflow(req, res) {
  const { processID, projectID, packageID, startDate, status = 'Pending' } = req.body;

  if (!processID || !projectID || !packageID) {
    return res.status(400).json({ error: 'processID, projectID, and packageID are required' });
  }

  try {
    const pool = await getPool();

    // Parse startDate if provided, otherwise use current date
    let workflowStartDate = new Date();
    if (startDate) {
      workflowStartDate = new Date(startDate);
    }
    const startDateStr = workflowStartDate.toISOString().split('T')[0];

    // Create workflow header
    const insertResult = await pool.request()
      .input('processID', sql.Int, processID)
      .input('projectID', sql.Int, projectID)
      .input('packageID', sql.Int, packageID)
      .input('startDate', sql.Date, workflowStartDate)
      .input('status', sql.VarChar(50), status)
      .query(`
        INSERT INTO tblWorkflowHdr (processID, projectID, packageID, startDate, status, createdDate)
        OUTPUT INSERTED.WorkFlowID, INSERTED.processID, INSERTED.projectID, INSERTED.packageID, INSERTED.startDate, INSERTED.status
        VALUES (@processID, @projectID, @packageID, @startDate, @status, GETDATE())
      `);

    if (insertResult.recordset.length === 0) {
      return res.status(500).json({ error: 'Failed to create workflow' });
    }

    const newWorkflow = insertResult.recordset[0];
    const newWorkflowID = newWorkflow.WorkFlowID;

    // Get all ORIGINAL template tasks for this process (WorkFlowHdrID IS NULL)
    const taskResult = await pool.request()
      .input('processID', sql.Int, processID)
      .query(`
        SELECT TaskID, TaskName, TaskPlanned, IsTaskSelected, PlannedDate, DepId, Priority, 
               PredecessorID, DaysRequired, linkTasks, IsFixed
        FROM tblTasks 
        WHERE proccessID = @processID AND WorkFlowHdrID IS NULL
      `);

    // Determine which task should be auto-selected (first by StepOrder, Priority, TaskID)
    const stepOrderRes = await pool.request()
      .input('processID', sql.Int, processID)
      .query(`
        SELECT t.TaskID, pd.StepOrder, t.Priority
        FROM tblTasks t
        INNER JOIN tblProcessDepartment pd ON pd.DepartmentID = t.DepId AND pd.ProcessID = t.proccessID
        WHERE t.proccessID = @processID AND t.WorkFlowHdrID IS NULL
        ORDER BY pd.StepOrder ASC, t.Priority ASC, t.TaskID ASC
      `);
    const firstTaskOriginalID = stepOrderRes.recordset.length > 0 ? stepOrderRes.recordset[0].TaskID : null;

    // Copy each template task into a NEW tblTasks row, then create workflow detail
    let taskCounter = 0;
    for (const task of taskResult.recordset) {
      taskCounter++;

      // The auto-selected first task (by StepOrder) gets the start date as PlannedDate
      let plannedDateStr = null;

      // Insert a COPY of the task with WorkFlowHdrID set
      const insertTaskResult = await pool.request()
        .input('taskName', sql.VarChar, task.TaskName || '')
        .input('taskPlanned', sql.VarChar, task.TaskPlanned || '')
        .input('isTaskSelected', sql.Int, task.TaskID === firstTaskOriginalID ? 1 : 0)
        .input('plannedDate', sql.Date, task.TaskID === firstTaskOriginalID ? (plannedDateStr || startDateStr) : plannedDateStr)
        .input('depId', sql.Int, task.DepId)
        .input('priority', sql.Int, task.Priority || 0)
        .input('predecessorID', sql.Int, task.PredecessorID || null)
        .input('daysRequired', sql.Int, task.DaysRequired || 0)
        .input('linkTasks', sql.Int, null)
        .input('proccessID', sql.Int, processID)
        .input('workflowID', sql.Int, newWorkflowID)
        .input('isFixed', sql.Int, task.IsFixed ? 1 : 0)
        .query(`
          INSERT INTO tblTasks (
            TaskName, TaskPlanned, IsTaskSelected, PlannedDate, DepId, Priority,
            PredecessorID, DaysRequired, linkTasks, proccessID, WorkFlowHdrID, IsFixed
          )
          OUTPUT INSERTED.TaskID
          VALUES (
            @taskName, @taskPlanned, @isTaskSelected, @plannedDate, @depId, @priority,
            @predecessorID, @daysRequired, @linkTasks, @proccessID, @workflowID, @isFixed
          )
        `);

      const newTaskID = insertTaskResult.recordset[0].TaskID;

      // Create workflow detail record with all fields explicitly NULL
      await pool.request()
        .input('workFlowHdrId', sql.Int, newWorkflowID)
        .input('taskId', sql.Int, newTaskID)
        .input('workflowName', sql.VarChar, task.TaskName || '')
        .query(`
          INSERT INTO tblWorkflowDtl (
            workFlowHdrId, TaskID, WorkflowName,
            TimeStarted, TimeFinished, DelayReason, Delay, assignUser
          )
          VALUES (
            @workFlowHdrId, @taskId, @workflowName,
            NULL, NULL, NULL, NULL, NULL
          )
        `);
    }

    return res.status(201).json({
      success: true,
      workflowID: newWorkflowID,
      workflow: newWorkflow,
      message: 'Workflow created successfully'
    });
  } catch (error) {
    console.error('Error creating workflow:', error);
    return res.status(500).json({ error: 'Failed to create workflow' });
  }
}
