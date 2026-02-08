import sql from 'mssql';
import { getPool } from '@/lib/db';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { workFlowID } = req.query;

  if (!workFlowID) {
    return res.status(400).json({ success: false, message: 'Workflow ID is required' });
  }

  try {
    const pool = await getPool();

    const result = await pool.request()
      .input('workFlowID', sql.Int, parseInt(workFlowID))
      .query(`
        SELECT TOP (1000)
          [TaskHistoryID],
          [workFlowID],
          [PaymentStep],
          [TaskID],
          [TaskName],
          [DepId],
          [DeptName],
          [IsTaskSelected],
          [TimeStarted],
          [TimeFinished],
          [Delay],
          [DelayReason],
          [Priority],
          [PlannedDate],
          [CompletionDate]
        FROM [AccDBF].[dbo].[tblWorkflowTaskHistory]
        WHERE [workFlowID] = @workFlowID
        ORDER BY [PaymentStep] ASC, [DepId] ASC, [TimeFinished] DESC
      `);

    res.json({
      success: true,
      history: result.recordset || [],
      workFlowID: workFlowID
    });
  } catch (error) {
    console.error('Error fetching task history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch task history',
      error: error.message
    });
  }
}
