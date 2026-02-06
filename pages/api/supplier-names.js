import { getPool } from '@/lib/db';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const pool = await getPool();
    
    const result = await pool.request().query(`
      SELECT 
        supplierNameID,
        supplierName
      FROM tblSupplierNames
      ORDER BY supplierName
    `);

    return res.status(200).json(result.recordset);
  } catch (error) {
    console.error('Error fetching supplier names:', error);
    return res.status(500).json({ error: 'Failed to fetch supplier names' });
  }
}
