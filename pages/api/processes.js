import { getPool } from '@/lib/db';
import { getAllProcesses } from '@/lib/helpers';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const processes = await getAllProcesses();
      return res.status(200).json(processes);
    } catch (error) {
      console.error('Error fetching processes:', error);
      return res.status(500).json({ error: 'Failed to fetch processes' });
    }
  }

  if (req.method === 'POST') {
    const { ProcessName, processDesc, Departments } = req.body;

    if (!ProcessName) {
      return res.status(400).json({ error: 'Process name is required' });
    }

    try {
      const pool = await getPool();
      
      // Insert process
      const insertResult = await pool
        .request()
        .input('ProcessName', ProcessName)
        .input('processDesc', processDesc || null)
        .query('INSERT INTO tblProcess (ProcessName, processDesc) VALUES (@ProcessName, @processDesc); SELECT SCOPE_IDENTITY() AS id;');
      
      const processId = insertResult.recordset[0].id;

      // Note: tblProcessSteps table doesn't exist, so we skip inserting steps
      // In the future, this can be enhanced when the table is created

      return res.status(201).json({ 
        message: 'Process created successfully',
        processId 
      });
    } catch (error) {
      console.error('Error creating process:', error);
      return res.status(500).json({ error: 'Failed to create process: ' + error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
