import { getPool } from '@/lib/db';
import sql from 'mssql';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return await getSuppliers(res);
  } else if (req.method === 'POST') {
    return await createSupplier(req, res);
  }
  return res.status(405).json({ error: 'Method not allowed' });
}

async function getSuppliers(res) {
  try {
    const pool = await getPool();
    
    const result = await pool.request().query(`
      SELECT 
        supplierID,
        supplierName,
        supplierType,
        workFlowID,
        totalPayment,
        locationtype,
        createdDate
      FROM tblSuppliers
      ORDER BY createdDate DESC
    `);

    return res.status(200).json(result.recordset);
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    return res.status(500).json({ error: 'Failed to fetch suppliers' });
  }
}

async function createSupplier(req, res) {
  const { supplierName, supplierType, workFlowID, totalPayment, locationtype } = req.body;

  if (!supplierName || !supplierType || !workFlowID || !totalPayment) {
    return res.status(400).json({ 
      error: 'supplierName, supplierType, workFlowID, and totalPayment are required' 
    });
  }

  try {
    const pool = await getPool();

    // Create supplier record
    const insertResult = await pool.request()
      .input('supplierName', sql.Int, supplierName)
      .input('supplierType', sql.VarChar(50), supplierType)
      .input('workFlowID', sql.Int, workFlowID)
      .input('totalPayment', sql.Decimal(10, 2), totalPayment)
      .input('locationtype', sql.VarChar(50), locationtype || 'Local')
      .query(`
        INSERT INTO tblSuppliers (supplierName, supplierType, workFlowID, totalPayment, locationtype, createdDate)
        OUTPUT INSERTED.supplierID, INSERTED.supplierName, INSERTED.supplierType, INSERTED.workFlowID, INSERTED.totalPayment, INSERTED.locationtype
        VALUES (@supplierName, @supplierType, @workFlowID, @totalPayment, @locationtype, GETDATE())
      `);

    if (insertResult.recordset.length === 0) {
      return res.status(500).json({ error: 'Failed to create supplier' });
    }

    const newSupplier = insertResult.recordset[0];

    return res.status(201).json({
      success: true,
      supplier: newSupplier,
      message: 'Supplier created successfully'
    });
  } catch (error) {
    console.error('Error creating supplier:', error);
    return res.status(500).json({ error: 'Failed to create supplier: ' + error.message });
  }
}
