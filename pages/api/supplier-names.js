import { getPool } from '@/lib/db';
import { getCached, setCached, CACHE_KEYS } from '@/lib/cache';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const cached = getCached(CACHE_KEYS.SUPPLIER_NAMES);
    if (cached) return res.status(200).json(cached);

    const pool = await getPool();
    
    const result = await pool.request().query(`
      SELECT 
        supplierNameID,
        supplierName
      FROM tblSupplierNames
      ORDER BY supplierName
    `);

    setCached(CACHE_KEYS.SUPPLIER_NAMES, result.recordset);
    return res.status(200).json(result.recordset);
  } catch (error) {
    console.error('Error fetching supplier names:', error);
    return res.status(500).json({ error: 'Failed to fetch supplier names' });
  }
}
