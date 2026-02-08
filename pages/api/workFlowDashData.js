import { getPool } from '@/lib/db';
import { getSessionServerSide } from '@/lib/session';
import sql from 'mssql';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const pool = await getPool();
    
    // Get user data from session using iron-session
    const session = await getSessionServerSide(req, res);
    if (!session || !session.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const isAdmin = session.user.usrAdmin || false;
    const userDeptId = session.user.DepartmentId || null;
    const userProjectID = session.user.ProjectID || null;

    console.log('[workFlowDashData] User Info:', { isAdmin, userDeptId, userProjectID });

    // Auto-mark workflows as completed if all tasks are done
    await pool.request().query(`
      UPDATE hdr
      SET 
        hdr.completionDate = GETDATE(),
        hdr.status = 'Completed',
        hdr.DaysDone = DATEDIFF(DAY, hdr.startDate, GETDATE())
      FROM tblWorkflowHdr hdr
      WHERE EXISTS (
          SELECT 1 FROM tblWorkflowDtl dtl
          WHERE dtl.workFlowHdrId = hdr.workFlowID
      )
      AND NOT EXISTS (
          SELECT 1 FROM tblWorkflowDtl dtl
          WHERE dtl.workFlowHdrId = hdr.workFlowID
            AND dtl.TimeFinished IS NULL
      )
      AND hdr.status != 'Completed'
      AND hdr.startDate IS NOT NULL
    `);

    // Build the query with filters
    let query = `
      SELECT 
        whdr.workFlowID AS HdrID,
        whdr.processID,
        whdr.projectID,
        whdr.packageID,
        whdr.status,
        whdr.createdDate,
        whdr.startDate,
        whdr.completionDate,
        whdr.DaysDone,
        p.ProcessName,
        pj.projectName AS ProjectName,
        pkg.PkgeName AS PackageName
      FROM tblWorkflowHdr whdr
      LEFT JOIN tblProcess p ON whdr.processID = p.NumberOfProccessID
      LEFT JOIN tblProject pj ON whdr.projectID = pj.ProjectID
      LEFT JOIN tblPackages pkg ON whdr.packageID = pkg.PkgeID
      WHERE 1=1
    `;

    const request = pool.request();

    // Always filter by user's project ID from login
    if (userProjectID) {
      request.input('ProjectID', sql.Int, userProjectID);
      query += ` AND whdr.projectID = @ProjectID`;
      console.log('[workFlowDashData] Filter: Project ID =', userProjectID);
    }

    // If not admin, also filter by department
    if (!isAdmin && userDeptId) {
      request.input('UserDeptId', sql.Int, userDeptId);
      query += `
        AND EXISTS (
          SELECT 1 FROM tblProcessDepartment pd
          WHERE pd.ProcessID = whdr.processID
            AND pd.DepartmentID = @UserDeptId
        )
      `;
      console.log('[workFlowDashData] Filter: User Department ID =', userDeptId);
    }

    // Sort by status (Pending first) then by creation date
    query += `
      ORDER BY 
        CASE WHEN whdr.status = 'Pending' THEN 0 ELSE 1 END,
        whdr.status ASC,
        whdr.createdDate DESC
    `;

    const result = await request.query(query);

    console.log('[workFlowDashData] Returning', result.recordset.length, 'workflows');

    return res.status(200).json(result.recordset);

  } catch (error) {
    console.error('[workFlowDashData API] Error:', error.message);
    return res.status(500).json({ 
      error: 'Failed to fetch workflow data',
      details: error.message
    });
  }
}
