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
        createdDate
      FROM tblSupplier
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

  if (!supplierName || !supplierType || !workFlowID) {
    return res.status(400).json({ 
      error: 'supplierName, supplierType, and workFlowID are required' 
    });
  }

  try {
    const pool = await getPool();

    // If supplierName is an ID, get the actual name from tblSupplierNames
    let actualSupplierName = supplierName;
    if (!isNaN(supplierName)) {
      const nameResult = await pool.request()
        .input('supplierNameID', sql.Int, parseInt(supplierName))
        .query(`SELECT supplierName FROM tblSupplierNames WHERE supplierNameID = @supplierNameID`);
      
      if (nameResult.recordset.length > 0) {
        actualSupplierName = nameResult.recordset[0].supplierName;
      } else {
        return res.status(400).json({ error: 'Supplier name not found' });
      }
    }

    // Create supplier record
    const insertResult = await pool.request()
      .input('supplierName', sql.NVarChar, actualSupplierName)
      .input('supplierType', sql.VarChar(50), supplierType)
      .input('workFlowID', sql.Int, workFlowID)
      .input('totalPayment', sql.Decimal(18, 2), totalPayment || 0)
      .query(`
        INSERT INTO tblSupplier (supplierName, supplierType, workFlowID, totalPayment, createdDate)
        OUTPUT INSERTED.supplierID, INSERTED.supplierName, INSERTED.supplierType, INSERTED.workFlowID, INSERTED.totalPayment
        VALUES (@supplierName, @supplierType, @workFlowID, @totalPayment, GETDATE())
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
