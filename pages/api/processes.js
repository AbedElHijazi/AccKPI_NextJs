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
      console.log(`[POST] Created process with ID: ${processId}`);

      // Insert workflow steps/departments if provided
      if (Departments && Array.isArray(Departments) && Departments.length > 0) {
        console.log(`[POST] Adding ${Departments.length} workflow steps for process ${processId}`);
        
        for (let index = 0; index < Departments.length; index++) {
          const deptId = Departments[index];
          const stepOrder = index + 1; // Step order starts from 1
          
          try {
            await pool
              .request()
              .input('ProcessID', processId)
              .input('DepartmentID', deptId)
              .input('StepOrder', stepOrder)
              .input('IsActive', 1)
              .query(`
                INSERT INTO tblProcessDepartment 
                (ProcessID, DepartmentID, StepOrder, IsActive) 
                VALUES (@ProcessID, @DepartmentID, @StepOrder, @IsActive)
              `);
            console.log(`[POST] Added step ${stepOrder}: DepartmentID=${deptId}`);
          } catch (stepErr) {
            console.error(`[POST] Error adding step ${stepOrder}:`, stepErr.message);
            throw new Error(`Failed to add workflow step ${stepOrder}: ${stepErr.message}`);
          }
        }
        console.log(`[POST] All workflow steps added successfully`);
      } else {
        console.log(`[POST] No departments provided for process ${processId}`);
      }

      return res.status(201).json({ 
        message: 'Process created successfully with workflow steps',
        processId 
      });
    } catch (error) {
      console.error('Error creating process:', error);
      return res.status(500).json({ error: 'Failed to create process: ' + error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
