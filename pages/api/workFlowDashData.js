import { getPool } from '@/lib/db';
import sql from 'mssql';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const pool = await getPool();

    // Query with JOINs to get related data
    const result = await pool.request().query(`
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
      ORDER BY whdr.workFlowID DESC
    `);

    return res.status(200).json(result.recordset);

  } catch (error) {
    console.error('[workFlowDashData API] Error:', error.message);
    return res.status(500).json({ 
      error: 'Failed to fetch workflow data',
      details: error.message,
      severity: error.severity,
      number: error.number
    });
  }
}
