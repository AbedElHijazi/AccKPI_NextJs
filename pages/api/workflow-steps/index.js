import { getPool } from '@/lib/db';
import sql from 'mssql';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return await getWorkflowSteps(res);
  } else if (req.method === 'POST') {
    return await createWorkflowSteps(req, res);
  }
  return res.status(405).json({ error: 'Method not allowed' });
}

async function getWorkflowSteps(res) {
  try {
    const pool = await getPool();
    
    const result = await pool.request().query(`
      SELECT 
        workflowStepID,
        workFlowID,
        supplierID,
        stepNumber,
        isActive,
        createdDate,
        StepFinished,
        StepStartDate
      FROM tblWorkflowSteps
      ORDER BY createdDate DESC
    `);

    return res.status(200).json(result.recordset);
  } catch (error) {
    console.error('Error fetching workflow steps:', error);
    return res.status(500).json({ error: 'Failed to fetch workflow steps' });
  }
}

async function createWorkflowSteps(req, res) {
  const { workFlowID, supplierID, numberOfPayments } = req.body;

  if (!workFlowID || !supplierID || !numberOfPayments) {
    return res.status(400).json({ 
      error: 'workFlowID, supplierID, and numberOfPayments are required' 
    });
  }

  try {
    const pool = await getPool();

    // Create payment steps
    const createdSteps = [];
    for (let i = 1; i <= numberOfPayments; i++) {
      const insertResult = await pool.request()
        .input('workFlowID', sql.Int, workFlowID)
        .input('supplierID', sql.Int, supplierID)
        .input('stepNumber', sql.Int, i)
        .input('isActive', sql.Int, i === 1 ? 1 : 0) // Only first step is active
        .query(`
          INSERT INTO tblWorkflowSteps (workFlowID, supplierID, stepNumber, isActive, createdDate, StepFinished, StepStartDate)
          OUTPUT INSERTED.workflowStepID, INSERTED.workFlowID, INSERTED.supplierID, INSERTED.stepNumber, INSERTED.isActive, INSERTED.createdDate, INSERTED.StepFinished, INSERTED.StepStartDate
          VALUES (@workFlowID, @supplierID, @stepNumber, @isActive, GETDATE(), NULL, NULL)
        `);

      if (insertResult.recordset.length > 0) {
        createdSteps.push(insertResult.recordset[0]);
      }
    }

    return res.status(201).json({
      success: true,
      steps: createdSteps,
      message: 'Workflow steps created successfully'
    });
  } catch (error) {
    console.error('Error creating workflow steps:', error);
    return res.status(500).json({ error: 'Failed to create workflow steps: ' + error.message });
  }
}
