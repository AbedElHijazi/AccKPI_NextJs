import { getPool } from '@/lib/db';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const pool = await getPool();

    // Get total counts
    const [workflowCount, taskCount, activeWorkflows] = await Promise.all([
      pool.request().query(`SELECT COUNT(*) as total FROM tblWorkflowHdr`),
      pool.request().query(`SELECT COUNT(*) as total FROM tblTasks`),
      pool.request().query(`
        SELECT COUNT(*) as total FROM tblWorkflowHdr 
        WHERE status = 'Active'
      `)
    ]);

    // Get recent workflows
    const recentWorkflows = await pool.request().query(`
      SELECT TOP 10
        hdr.WorkFlowID,
        hdr.processID,
        hdr.projectID,
        hdr.status,
        hdr.createdDate,
        pr.ProcessName,
        pj.ProjectName
      FROM tblWorkflowHdr hdr
      LEFT JOIN tblProcess pr ON hdr.processID = pr.NumberOfProccessID
      LEFT JOIN tblProject pj ON hdr.projectID = pj.ProjectID
      ORDER BY hdr.createdDate DESC
    `);

    // Get pending tasks
    const pendingTasks = await pool.request().query(`
      SELECT TOP 10
        t.TaskID,
        t.TaskName,
        t.Priority,
        t.DaysRequired,
        d.DeptName,
        pr.ProcessName
      FROM tblTasks t
      LEFT JOIN tblDepartments d ON t.DepId = d.DepartmentID
      LEFT JOIN tblProcess pr ON t.proccessID = pr.NumberOfProccessID
      WHERE t.IsTaskSelected = 0
      ORDER BY t.Priority DESC, t.TaskName ASC
    `);

    return res.status(200).json({
      stats: {
        totalWorkflows: workflowCount.recordset[0].total,
        totalTasks: taskCount.recordset[0].total,
        activeWorkflows: activeWorkflows.recordset[0].total
      },
      recentWorkflows: recentWorkflows.recordset,
      pendingTasks: pendingTasks.recordset
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
}
