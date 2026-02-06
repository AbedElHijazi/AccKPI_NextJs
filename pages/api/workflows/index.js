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
    
    // Get process departments
    const deptResult = await pool.request()
      .input('processID', sql.Int, processID)
      .query(`
        SELECT DISTINCT DepartmentID 
        FROM tblProcessDepartment 
        WHERE ProcessID = @processID 
        ORDER BY StepOrder
      `);

    // Get tasks for this process
    const taskResult = await pool.request()
      .input('processID', sql.Int, processID)
      .query(`
        SELECT DISTINCT TaskID 
        FROM tblTasks 
        WHERE proccessID = @processID AND WorkFlowHdrID IS NULL
      `);

    // Create workflow details for each task
    for (const task of taskResult.recordset) {
      await pool.request()
        .input('workFlowHdrId', sql.Int, newWorkflow.WorkFlowID)
        .input('taskId', sql.Int, task.TaskID)
        .query(`
          INSERT INTO tblWorkflowDtl (workFlowHdrId, TaskID, WorkflowName)
          VALUES (@workFlowHdrId, @taskId, @workFlowHdrId)
        `);
    }

    return res.status(201).json({
      success: true,
      workflowID: newWorkflow.WorkFlowID,
      workflow: newWorkflow,
      message: 'Workflow created successfully'
    });
  } catch (error) {
    console.error('Error creating workflow:', error);
    return res.status(500).json({ error: 'Failed to create workflow' });
  }
}
