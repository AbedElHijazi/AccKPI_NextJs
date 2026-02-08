import { getPool } from '@/lib/db';
import sql from 'mssql';

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method === 'GET') {
    return await getWorkflowStepsById(id, res);
  } else if (req.method === 'PUT') {
    return await updateWorkflowStep(id, req, res);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

async function getWorkflowStepsById(workFlowID, res) {
  try {
    if (!workFlowID || isNaN(workFlowID)) {
      return res.status(400).json({ error: 'Invalid workflow ID' });
    }

    const pool = await getPool();

    const result = await pool.request()
      .input('workFlowID', sql.Int, parseInt(workFlowID))
      .query(`
        SELECT 
          ws.workflowStepID,
          ws.workFlowID,
          ws.supplierID,
          ws.stepNumber,
          ws.isActive,
          ws.createdDate,
          ws.StepFinished,
          ws.StepStartDate,
          s.supplierName,
          s.supplierType,
          s.totalPayment
        FROM tblWorkflowSteps ws
        LEFT JOIN tblSupplier s ON ws.supplierID = s.supplierID
        WHERE ws.workFlowID = @workFlowID
        ORDER BY ws.stepNumber ASC, ws.workflowStepID ASC
      `);

    console.log('[workflow-steps] Retrieved', result.recordset.length, 'steps for workflow', workFlowID);

    return res.status(200).json(result.recordset);
  } catch (error) {
    console.error('[workflow-steps API] Error fetching workflow steps:', error.message);
    console.error('[workflow-steps API] Full error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch workflow steps',
      details: error.message,
      message: 'Database error - check if tblWorkflowSteps table exists and has correct schema'
    });
  }
}

async function updateWorkflowStep(workFlowID, req, res) {
  try {
    const { stepNumber, StepStartDate } = req.body;

    if (!stepNumber || !StepStartDate) {
      return res.status(400).json({ error: 'stepNumber and StepStartDate are required' });
    }

    const pool = await getPool();

    await pool.request()
      .input('workFlowID', sql.Int, parseInt(workFlowID))
      .input('stepNumber', sql.Int, stepNumber)
      .input('stepStartDate', sql.VarChar(30), StepStartDate)
      .query(`
        UPDATE tblWorkflowSteps
        SET StepStartDate = CAST(@stepStartDate AS DATETIME2)
        WHERE workFlowID = @workFlowID AND stepNumber = @stepNumber
      `);

    return res.status(200).json({ success: true, message: 'Step start date updated' });
  } catch (error) {
    console.error('Error updating workflow step:', error);
    return res.status(500).json({ error: 'Failed to update workflow step' });
  }
}

