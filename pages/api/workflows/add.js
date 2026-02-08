import { getPool } from '@/lib/db';
import { getSessionServerSide } from '@/lib/session';
import sql from 'mssql';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check authentication
    const session = await getSessionServerSide(req, res);
    if (!session || !session.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Only special users can add workflows
    if (!session.user.IsSpecialUser) {
      return res.status(403).json({ error: 'Forbidden: Special users only' });
    }

    const { processID, projectID, packageID, startDate, status } = req.body;

    console.log('\n📝 POST /api/workflows/add - Received workflow request');
    console.log(`  - processID: ${processID}`);
    console.log(`  - projectID: ${projectID}`);
    console.log(`  - packageID: ${packageID}`);
    console.log(`  - startDate: ${startDate}`);
    console.log(`  - status: ${status}`);

    // Validate required fields
    if (!processID || !projectID || !packageID || !startDate) {
      console.log('❌ Validation failed: Missing required fields');
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Validate processID is numeric
    if (isNaN(processID)) {
      return res.status(400).json({
        error: 'Invalid processID: Must be a non-empty numeric value'
      });
    }

    const pool = await getPool();

    // 1️⃣ Confirm the process exists in tblTasks at all
    const processCheck = await pool.request()
      .input('processID', sql.Int, parseInt(processID))
      .query(`
        SELECT TOP 1 TaskID 
        FROM tblTasks 
        WHERE proccessID = @processID AND WorkFlowHdrID IS NULL
      `);

    if (processCheck.recordset.length === 0) {
      return res.status(400).json({
        error: 'No tasks found for the specified processID'
      });
    }

    // 2️⃣ Get ALL departments for the process from tblProcessDepartment
    const depRes = await pool.request()
      .input('processID', sql.Int, parseInt(processID))
      .query(`
        SELECT DepartmentID
        FROM tblProcessDepartment
        WHERE ProcessID = @processID
      `);

    const expectedDeps = depRes.recordset.map(row => row.DepartmentID);

    if (expectedDeps.length === 0) {
      return res.status(400).json({
        error: 'No departments are defined for this process in tblProcessDepartment'
      });
    }

    // 3️⃣ For each DepartmentID, check that there is at least one task in tblTasks
    const missingDeps = [];
    for (const depId of expectedDeps) {
      const taskCheck = await pool.request()
        .input('processID', sql.Int, parseInt(processID))
        .input('depId', sql.Int, depId)
        .query(`
          SELECT TOP 1 TaskID
          FROM tblTasks
          WHERE proccessID = @processID AND DepId = @depId AND WorkFlowHdrID IS NULL
        `);
      
      if (taskCheck.recordset.length === 0) {
        missingDeps.push(depId);
      }
    }

    if (missingDeps.length > 0) {
      return res.status(400).json({
        error: `Cannot create workflow: No tasks found for department(s): ${missingDeps.join(', ')}`
      });
    }

    // 4️⃣ Insert workflow header and get the new workFlowID
    const insertResult = await pool.request()
      .input('processID', sql.Int, parseInt(processID))
      .input('projectID', sql.Int, parseInt(projectID))
      .input('packageID', sql.Int, parseInt(packageID))
      .input('startDate', sql.Date, startDate)
      .input('status', sql.VarChar, status || 'Pending')
      .query(`
        INSERT INTO tblWorkFlowHdr (processID, projectID, packageID, startDate, status, createdDate)
        OUTPUT INSERTED.workFlowID, INSERTED.projectID, INSERTED.startDate, INSERTED.status
        VALUES (@processID, @projectID, @packageID, @startDate, @status, GETDATE())
      `);

    const newWorkflowID = insertResult.recordset[0].workFlowID;
    console.log('✅ Workflow inserted successfully:');
    console.log(`  - New Workflow ID: ${newWorkflowID}`);
    console.log(`  - Saved projectID: ${insertResult.recordset[0].projectID}`);
    console.log(`  - Saved startDate: ${insertResult.recordset[0].startDate}`);
    console.log(`  - Saved status: ${insertResult.recordset[0].status}`);

    // 5️⃣ Get all ORIGINAL tasks for this process (not workflow copies)
    const tasks = await pool.request()
      .input('processID', sql.Int, parseInt(processID))
      .query(`
        SELECT TaskID, TaskName, TaskPlanned, IsTaskSelected, PlannedDate, DepId, Priority, PredecessorID, DaysRequired, linkTasks, IsFixed
        FROM tblTasks
        WHERE proccessID = @processID AND WorkFlowHdrID IS NULL
      `);

    // 6️⃣ Insert new task copies with all properties and create workflow detail records
    if (tasks.recordset.length > 0) {
      const taskMap = {};
      const [year, month, day] = startDate.split('-').map(Number);
      const baseDate = new Date(Date.UTC(year, month - 1, day));
      let taskCounter = 0;
      
      console.log(`\n📦 Creating ${tasks.recordset.length} task copies for workflow ${newWorkflowID}`);
      console.log(`  Base Date: ${baseDate.toISOString()}`);
      
      for (const task of tasks.recordset) {
        try {
          let taskPlannedDate = null;
          taskCounter++;
          
          if (taskCounter === 1) {
            taskPlannedDate = new Date(baseDate);
          }
          
          let plannedDateStr = null;
          if (taskPlannedDate) {
            plannedDateStr = taskPlannedDate.toISOString().split('T')[0];
          }
          
          console.log(`\n  📋 Task ${taskCounter}:`);
          console.log(`    - Original ID: ${task.TaskID}`);
          console.log(`    - Name: ${task.TaskName}`);
          console.log(`    - Planned Date: ${plannedDateStr || 'NULL'}`);
          
          // Insert new task copy with all properties
          const insertTaskResult = await pool.request()
            .input('taskName', sql.VarChar, task.TaskName || '')
            .input('taskPlanned', sql.VarChar, task.TaskPlanned || '')
            .input('isTaskSelected', sql.Int, task.IsTaskSelected ? 1 : 0)
            .input('plannedDate', sql.Date, plannedDateStr)
            .input('depId', sql.Int, task.DepId)
            .input('priority', sql.Int, task.Priority || 0)
            .input('predecessorID', sql.Int, task.PredecessorID || null)
            .input('daysRequired', sql.Int, task.DaysRequired || 0)
            .input('linkTasks', sql.VarChar, task.linkTasks || '')
            .input('processID', sql.Int, parseInt(processID))
            .input('workflowID', sql.Int, newWorkflowID)
            .input('isFixed', sql.Int, task.IsFixed ? 1 : 0)
            .query(`
              INSERT INTO tblTasks (
                TaskName,
                TaskPlanned,
                IsTaskSelected,
                PlannedDate,
                DepId,
                Priority,
                PredecessorID,
                DaysRequired,
                linkTasks,
                proccessID,
                WorkFlowHdrID,
                IsFixed
              )
              OUTPUT INSERTED.TaskID
              VALUES (
                @taskName,
                @taskPlanned,
                @isTaskSelected,
                @plannedDate,
                @depId,
                @priority,
                @predecessorID,
                @daysRequired,
                @linkTasks,
                @processID,
                @workflowID,
                @isFixed
              )
            `);
          
          if (!insertTaskResult.recordset || insertTaskResult.recordset.length === 0) {
            throw new Error(`Failed to insert task: ${task.TaskName}`);
          }
          
          const newTaskID = insertTaskResult.recordset[0].TaskID;
          taskMap[task.TaskID] = newTaskID;
          
          console.log(`    ✅ Created with ID: ${newTaskID}`);
          
          // Create workflow detail record for state tracking
          const dtlResult = await pool.request()
            .input('workflowID', sql.Int, newWorkflowID)
            .input('taskID', sql.Int, newTaskID)
            .input('workflowName', sql.VarChar, task.TaskName || '')
            .query(`
              INSERT INTO tblWorkflowDtl (
                workFlowHdrId,
                TaskID,
                WorkflowName,
                TimeStarted,
                TimeFinished,
                DelayReason,
                Delay,
                assignUser
              )
              VALUES (
                @workflowID,
                @taskID,
                @workflowName,
                NULL,
                NULL,
                NULL,
                NULL,
                NULL
              )
            `);
          
          console.log(`    ✅ Workflow detail record created`);
        } catch (taskError) {
          console.error(`❌ Error creating task ${taskCounter}:`, taskError.message);
          throw new Error(`Failed to create task ${taskCounter} (${task.TaskName}): ${taskError.message}`);
        }
      }
      
      console.log(`\n✅ All ${taskCounter} tasks created successfully\n`);
    }

    return res.status(201).json({ 
      message: 'Workflow added successfully!',
      success: true,
      workflowID: newWorkflowID
    });
  } catch (error) {
    console.error('Error adding workflow:', error);
    return res.status(500).json({ 
      error: 'Failed to add workflow',
      details: error.message 
    });
  }
}
