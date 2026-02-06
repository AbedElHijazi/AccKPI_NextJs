import { getPool } from '@/lib/db';
import sql from 'mssql';

export default async function handler(req, res) {
  const { hdrId } = req.query;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!hdrId) {
    return res.status(400).json({ error: 'hdrId is required' });
  }

  try {
    const pool = await getPool();

    // Query workflow payment/step details
    const result = await pool.request()
      .input('workFlowHdrID', sql.Int, parseInt(hdrId))
      .query(`
        SELECT 
          DtlID,
          workFlowHdrID,
          TaskID,
          WorkflowName,
          DtlStatus,
          StepStartDate,
          StepFinished,
          stepNumber,
          isActive,
          t.TaskName,
          t.TaskPlanned,
          t.DaysRequired,
          t.DepId,
          d.DeptName
        FROM tblWorkflowDtl wd
        LEFT JOIN tblTasks t ON wd.TaskID = t.TaskID
        LEFT JOIN tblDepartments d ON t.DepId = d.DepartmentID
        WHERE wd.workFlowHdrID = @workFlowHdrID
        ORDER BY wd.stepNumber ASC
      `);

    return res.status(200).json(result.recordset);
  } catch (error) {
    console.error('Error fetching workflow steps:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch workflow steps',
      details: error.message 
    });
  }
}
