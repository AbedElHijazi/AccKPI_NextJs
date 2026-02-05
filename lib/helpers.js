import sql from 'mssql';
import { getPool } from './db';

/**
 * Execute a database query with error handling
 */
export async function executeQuery(query, inputs = {}) {
  try {
    const pool = await getPool();
    const request = pool.request();
    
    Object.keys(inputs).forEach(key => {
      const { type, value } = inputs[key];
      request.input(key, type, value);
    });
    
    const result = await request.query(query);
    return result.recordset;
  } catch (err) {
    console.error('Database query error:', err);
    throw err;
  }
}

/**
 * Get user by ID from database
 */
export async function getUserById(userId) {
  try {
    const pool = await getPool();
    const request = pool.request();
    request.input('userId', sql.NVarChar, userId);
    
    const result = await request.query(`
      SELECT usrID, usrDesc, DepartmentID, usrAdmin, IsSpecialUser, usrEmail
      FROM tblUsers 
      WHERE usrID = @userId
    `);
    
    return result.recordset[0] || null;
  } catch (err) {
    console.error('Error fetching user:', err);
    throw err;
  }
}

/**
 * Get department by ID from database
 */
export async function getDepartmentById(departmentId) {
  try {
    const pool = await getPool();
    const request = pool.request();
    request.input('departmentId', sql.Int, departmentId);
    
    const result = await request.query(`
      SELECT DepartmentID, DeptName, DeptEmail
      FROM tblDepartments 
      WHERE DepartmentID = @departmentId
    `);
    
    return result.recordset[0] || { DeptName: 'Unknown', DepartmentID: departmentId };
  } catch (err) {
    console.error('Error fetching department:', err);
    throw err;
  }
}

/**
 * Get workflow tasks by workflow ID
 */
export async function getWorkflowTasks(workflowId) {
  try {
    const pool = await getPool();
    const request = pool.request();
    request.input('workflowId', sql.Int, workflowId);
    
    const result = await request.query(`
      SELECT 
        t.TaskID,
        t.TaskName,
        t.TaskPlanned,
        t.IsTaskSelected,
        t.PlannedDate,
        t.DepId,
        t.Priority,
        t.PredecessorID,
        t.DaysRequired,
        t.IsFixed,
        t.WorkFlowHdrID,
        t.linkTasks,
        d.WorkflowDtlId,
        d.workFlowHdrId,
        d.WorkflowName,
        d.TimeStarted,
        d.TimeFinished,
        d.DelayReason,
        d.Delay,
        d.assignUser,
        pr.NumberOfProccessID,
        pr.ProcessName,
        pj.ProjectID,
        pj.ProjectName,
        pk.PkgeName,
        dp.DeptName,
        pd.StepOrder,
        ISNULL(ws.stepNumber, 0) AS PaymentStep,
        (SELECT COUNT(*) FROM tblWorkflowSteps WHERE workFlowID = @workflowId) AS PaymentCount
      FROM tblWorkflowDtl d
      INNER JOIN tblTasks t ON d.TaskID = t.TaskID
      INNER JOIN tblWorkflowHdr hdr ON d.workFlowHdrId = hdr.WorkFlowID
      INNER JOIN tblProcess pr ON hdr.ProcessID = pr.NumberOfProccessID
      INNER JOIN tblProject pj ON hdr.ProjectID = pj.ProjectID
      INNER JOIN tblPackages pk ON pk.PkgeId = hdr.packageID
      INNER JOIN tblDepartments dp ON dp.DepartmentID = t.DepId
      INNER JOIN tblProcessDepartment pd ON pd.DepartmentID = t.DepId AND pd.ProcessID = pr.NumberOfProccessID
      LEFT JOIN tblWorkflowSteps ws ON ws.workFlowID = @workflowId AND ws.isActive = 1
      WHERE d.workFlowHdrId = @workflowId
      ORDER BY pd.StepOrder ASC, t.Priority ASC
    `);
    
    return result.recordset;
  } catch (err) {
    console.error('Error fetching workflow tasks:', err);
    throw err;
  }
}

/**
 * Get all packages
 */
export async function getAllPackages() {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT PkgeID, PkgeName, Division, Trade, FilePath, insertDate
      FROM tblPackages
      ORDER BY PkgeName
    `);
    
    return result.recordset;
  } catch (err) {
    console.error('Error fetching packages:', err);
    throw err;
  }
}

/**
 * Get all processes
 */
export async function getAllProcesses() {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT NumberOfProccessID, ProcessName, processDesc
      FROM tblProcess
      ORDER BY NumberOfProccessID
    `);
    
    return result.recordset;
  } catch (err) {
    console.error('Error fetching processes:', err);
    throw err;
  }
}

/**
 * Get all projects
 */
export async function getAllProjects() {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT projectID, projectName
      FROM tblProject
      ORDER BY projectName
    `);
    
    return result.recordset;
  } catch (err) {
    console.error('Error fetching projects:', err);
    throw err;
  }
}

/**
 * Get all departments
 */
export async function getAllDepartments() {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT DepartmentID, DeptName, DeptEmail
      FROM tblDepartments
      ORDER BY DeptName
    `);
    
    return result.recordset;
  } catch (err) {
    console.error('Error fetching departments:', err);
    throw err;
  }
}

/**
 * Get process departments with step order
 */
export async function getProcessDepartments(processId) {
  try {
    const pool = await getPool();
    const request = pool.request();
    request.input('processId', sql.Int, processId);
    
    const result = await request.query(`
      SELECT 
        pd.ProcessID,
        pd.DepartmentID,
        pd.StepOrder,
        pd.IsActive,
        d.DeptName
      FROM tblProcessDepartment pd
      JOIN tblDepartments d ON d.DepartmentID = pd.DepartmentID
      WHERE pd.ProcessID = @processId
      ORDER BY pd.StepOrder
    `);
    
    return result.recordset;
  } catch (err) {
    console.error('Error fetching process departments:', err);
    throw err;
  }
}

/**
 * Build user object
 */
export function buildUserObject(sessionUser, department) {
  return {
    id: sessionUser.id,
    name: sessionUser.name || 'User',
    usrAdmin: sessionUser.usrAdmin,
    DepartmentId: sessionUser.DepartmentId,
    DeptName: department.DeptName || 'Admin'
  };
}
