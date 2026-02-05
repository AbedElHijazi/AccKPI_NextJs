import { getPool } from '@/lib/db';
import sql from 'mssql';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return await getTasks(req, res);
  } else if (req.method === 'POST') {
    return await createTask(req, res);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

async function getTasks(req, res) {
  try {
    const pool = await getPool();
    const { department, process, processId } = req.query;

    // Support both 'process' and 'processId' parameter names for flexibility
    const targetProcessId = processId || process;

    let query = `
      SELECT 
        t.TaskID,
        t.TaskName,
        t.TaskPlanned,
        t.PlannedDate,
        t.DepId,
        t.DaysRequired,
        t.proccessID,
        t.IsFixed,
        t.WorkFlowHdrID,
        d.DeptName,
        pr.ProcessName
      FROM tblTasks t
      LEFT JOIN tblDepartments d ON t.DepId = d.DepartmentID
      LEFT JOIN tblProcess pr ON t.proccessID = pr.NumberOfProccessID
      WHERE 1=1
    `;

    if (department) {
      query += ` AND t.DepId = ${parseInt(department)}`;
    }

    if (targetProcessId) {
      query += ` AND t.proccessID = ${parseInt(targetProcessId)}`;
    }

    query += ` ORDER BY t.TaskID DESC`;

    console.log(`[TASKS API] Query: ${query}`);
    const result = await pool.request().query(query);
    console.log(`[TASKS API] Found ${result.recordset.length} tasks`);
    return res.status(200).json(result.recordset);
  } catch (error) {
    console.error('[TASKS API] Error fetching tasks:', error);
    return res.status(500).json({ error: 'Failed to fetch tasks: ' + error.message });
  }
}

async function createTask(req, res) {
  const { 
    TaskName,
    TaskPlanned,
    DepId,
    ProcessID,
    DaysRequired,
    IsFixed,
    Priority,
    PredecessorTaskID
  } = req.body;

  // Validate required fields
  if (!TaskName || !DepId || !ProcessID) {
    return res.status(400).json({ error: 'TaskName, DepId, and ProcessID are required' });
  }

  try {
    const pool = await getPool();
    const isFixedBit = IsFixed && (IsFixed === '1' || IsFixed === 1 || IsFixed === true) ? 1 : 0;
    const daysRequired = parseInt(DaysRequired || 0, 10);

    // Get StepOrder for this department and process
    const stepOrderResult = await pool.request()
      .input('DepId', sql.Int, parseInt(DepId))
      .input('ProcessID', sql.Int, parseInt(ProcessID))
      .query(`
        SELECT StepOrder
        FROM tblProcessDepartment
        WHERE DepartmentID = @DepId AND ProcessID = @ProcessID
      `);

    if (stepOrderResult.recordset.length === 0) {
      return res.status(400).json({ error: 'Invalid department or process' });
    }

    const StepOrder = stepOrderResult.recordset[0].StepOrder;

    // Check if it's the first task for this department + process
    const taskCountResult = await pool.request()
      .input('DepId', sql.Int, parseInt(DepId))
      .input('ProcessID', sql.Int, parseInt(ProcessID))
      .query(`
        SELECT COUNT(*) AS TaskCount
        FROM tblTasks
        WHERE DepId = @DepId AND proccessID = @ProcessID
      `);
    const isFirstTask = taskCountResult.recordset[0].TaskCount === 0;

    // Determine IsTaskSelected: true only if first task AND StepOrder 1 AND no predecessor
    let IsTaskSelected = 0;
    if (isFirstTask && StepOrder === 1 && !PredecessorTaskID) {
      IsTaskSelected = 1;
    }

    // Get Priority if not provided
    let finalPriority = Priority;
    if (!Priority) {
      const priorityResult = await pool.request()
        .input('DepId', sql.Int, parseInt(DepId))
        .input('ProcessID', sql.Int, parseInt(ProcessID))
        .query(`
          SELECT ISNULL(MAX(Priority), 0) + 1 AS NewPriority
          FROM tblTasks
          WHERE DepId = @DepId AND proccessID = @ProcessID
        `);
      finalPriority = priorityResult.recordset[0].NewPriority;
    }

    // Get PredecessorID
    let PredecessorID = PredecessorTaskID || null;
    if (!isFirstTask && !PredecessorID) {
      const predResult = await pool.request()
        .input('DepId', sql.Int, parseInt(DepId))
        .input('ProcessID', sql.Int, parseInt(ProcessID))
        .query(`
          SELECT TOP 1 TaskID
          FROM tblTasks
          WHERE DepId = @DepId AND proccessID = @ProcessID
          ORDER BY Priority DESC
        `);
      PredecessorID = predResult.recordset[0]?.TaskID ?? null;
    }

    // Get WorkflowHdrID if it exists
    const hdrResult = await pool.request()
      .input('ProcessID', sql.Int, parseInt(ProcessID))
      .query(`
        SELECT TOP 1 WorkFlowID
        FROM tblWorkflowHdr
        WHERE ProcessID = @ProcessID
      `);
    const workflowHdrId = hdrResult.recordset.length > 0
      ? hdrResult.recordset[0].WorkFlowID
      : null;

    // Build dynamic INSERT statement based on whether WorkFlowHdrID exists
    const insertRequest = pool.request()
      .input('TaskName', sql.NVarChar(150), TaskName)
      .input('TaskPlanned', sql.NVarChar, TaskPlanned || '')
      .input('IsTaskSelected', sql.Bit, IsTaskSelected)
      .input('DepId', sql.Int, parseInt(DepId))
      .input('Priority', sql.Int, finalPriority)
      .input('PredecessorID', sql.Int, PredecessorID)
      .input('DaysRequired', sql.Int, daysRequired)
      .input('ProcessID', sql.Int, parseInt(ProcessID))
      .input('IsFixed', sql.Bit, isFixedBit);

    if (workflowHdrId) {
      insertRequest.input('WorkFlowHdrID', sql.Int, workflowHdrId);
    }

    // Construct SQL query with proper OUTPUT syntax
    const insertQuery = `
      INSERT INTO tblTasks (
        TaskName, TaskPlanned, IsTaskSelected,
        DepId, Priority, PredecessorID, DaysRequired, proccessID, IsFixed
        ${workflowHdrId ? ', WorkFlowHdrID' : ''}
      )
      OUTPUT INSERTED.TaskID
      VALUES (
        @TaskName, @TaskPlanned, @IsTaskSelected,
        @DepId, @Priority, @PredecessorID, @DaysRequired, @ProcessID, @IsFixed
        ${workflowHdrId ? ', @WorkFlowHdrID' : ''}
      )
    `;

    const insertResult = await insertRequest.query(insertQuery);

    if (insertResult.recordset.length === 0) {
      return res.status(500).json({ error: 'Failed to create task' });
    }

    const newTaskId = insertResult.recordset[0].TaskID;

    // If workflow exists, insert into tblWorkflowDtl
    if (workflowHdrId) {
      await pool.request()
        .input('WorkflowName', sql.NVarChar, TaskPlanned || TaskName)
        .input('TaskID', sql.Int, newTaskId)
        .input('WorkFlowHdrID', sql.Int, workflowHdrId)
        .query(`
          INSERT INTO tblWorkflowDtl (WorkflowName, TaskID, WorkFlowHdrID)
          VALUES (@WorkflowName, @TaskID, @WorkFlowHdrID)
        `);
    }

    console.log(`[TASKS API] Task created: ${newTaskId}`);
    return res.status(201).json({
      success: true,
      message: 'Task created successfully',
      taskId: newTaskId
    });
  } catch (error) {
    console.error('[TASKS API] Error creating task:', error);
    return res.status(500).json({ error: 'Failed to create task: ' + error.message });
  }
}
