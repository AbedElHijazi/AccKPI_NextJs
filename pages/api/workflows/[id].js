import { getPool } from '@/lib/db';
import { getWorkflowTasks } from '@/lib/helpers';
import sql from 'mssql';

export default async function handler(req, res) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Workflow ID is required' });
  }

  if (req.method === 'GET') {
    return await getWorkflowDetail(parseInt(id), res);
  } else if (req.method === 'PUT') {
    return await updateWorkflow(parseInt(id), req, res);
  } else if (req.method === 'DELETE') {
    return await deleteWorkflow(parseInt(id), res);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

async function getWorkflowDetail(workflowId, res) {
  try {
    const pool = await getPool();

    // Get workflow header
    const hdrResult = await pool.request()
      .input('id', sql.Int, workflowId)
      .query(`
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
        pk.PkgeName
      FROM tblWorkflowHdr hdr
      LEFT JOIN tblProcess pr ON hdr.processID = pr.NumberOfProccessID
      LEFT JOIN tblProject pj ON hdr.projectID = pj.ProjectID
      LEFT JOIN tblPackages pk ON hdr.packageID = pk.PkgeId
      WHERE hdr.WorkFlowID = @id
    `);

    if (hdrResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    // Transform workflow data to match frontend expectations
    const workflow = hdrResult.recordset[0];
    const transformedWorkflow = {
      HdrID: workflow.WorkFlowID,
      ProcessName: workflow.ProcessName,
      ProjectName: workflow.ProjectName,
      PackageName: workflow.PkgeName,
      startDate: workflow.startDate,
      Status: workflow.status,
      createdDate: workflow.createdDate
    };

    return res.status(200).json(transformedWorkflow);
  } catch (error) {
    console.error('Error fetching workflow:', error);
    return res.status(500).json({ error: 'Failed to fetch workflow' });
  }
}

async function updateWorkflow(workflowId, req, res) {
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }

  try {
    const pool = await getPool();

    const result = await pool.request()
      .input('workflowId', sql.Int, workflowId)
      .input('status', sql.NVarChar, status)
      .query(`
        UPDATE tblWorkflowHdr
        SET status = @status
        WHERE WorkFlowID = @workflowId
      `);

    return res.status(200).json({
      success: true,
      message: 'Workflow updated successfully'
    });
  } catch (error) {
    console.error('Error updating workflow:', error);
    return res.status(500).json({ error: 'Failed to update workflow' });
  }
}

async function deleteWorkflow(workflowId, res) {
  try {
    const pool = await getPool();

    // Delete workflow details first (foreign key constraint)
    await pool.request()
      .input('workflowId', sql.Int, workflowId)
      .query(`DELETE FROM tblWorkflowDtl WHERE workFlowHdrId = @workflowId`);

    // Delete workflow header
    await pool.request()
      .input('workflowId', sql.Int, workflowId)
      .query(`DELETE FROM tblWorkflowHdr WHERE WorkFlowID = @workflowId`);

    return res.status(200).json({
      success: true,
      message: 'Workflow deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting workflow:', error);
    return res.status(500).json({ error: 'Failed to delete workflow' });
  }
}
