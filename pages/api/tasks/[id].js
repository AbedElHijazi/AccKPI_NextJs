import { getPool } from '@/lib/db';
import sql from 'mssql';

export default async function handler(req, res) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Task ID is required' });
  }

  if (req.method === 'GET') {
    return await getTaskDetail(parseInt(id), res);
  } else if (req.method === 'PUT') {
    return await updateTask(parseInt(id), req, res);
  } else if (req.method === 'DELETE') {
    return await deleteTask(parseInt(id), res);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

async function getTaskDetail(taskId, res) {
  try {
    const pool = await getPool();

    const result = await pool.request()
      .input('taskId', sql.Int, taskId)
      .query(`
        SELECT 
          t.TaskID,
          t.TaskName,
          t.TaskPlanned,
          t.IsTaskSelected,
          t.PlannedDate,
          t.DepId,
          t.Priority,
          t.DaysRequired,
          t.proccessID,
          d.DeptName,
          pr.ProcessName
        FROM tblTasks t
        LEFT JOIN tblDepartments d ON t.DepId = d.DepartmentID
        LEFT JOIN tblProcess pr ON t.proccessID = pr.NumberOfProccessID
        WHERE t.TaskID = @taskId
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    return res.status(200).json(result.recordset[0]);
  } catch (error) {
    console.error('Error fetching task:', error);
    return res.status(500).json({ error: 'Failed to fetch task' });
  }
}

async function updateTask(taskId, req, res) {
  const { taskName, priority, daysRequired, isTaskSelected } = req.body;

  try {
    const pool = await getPool();

    let updateQuery = 'UPDATE tblTasks SET ';
    const updates = [];

    if (taskName !== undefined) {
      updates.push('TaskName = @taskName');
    }
    if (priority !== undefined) {
      updates.push('Priority = @priority');
    }
    if (daysRequired !== undefined) {
      updates.push('DaysRequired = @daysRequired');
    }
    if (isTaskSelected !== undefined) {
      updates.push('IsTaskSelected = @isTaskSelected');
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateQuery += updates.join(', ') + ' WHERE TaskID = @taskId';

    const request = pool.request().input('taskId', sql.Int, taskId);

    if (taskName !== undefined) {
      request.input('taskName', sql.NVarChar, taskName);
    }
    if (priority !== undefined) {
      request.input('priority', sql.Int, priority);
    }
    if (daysRequired !== undefined) {
      request.input('daysRequired', sql.Int, daysRequired);
    }
    if (isTaskSelected !== undefined) {
      request.input('isTaskSelected', sql.Bit, isTaskSelected);
    }

    await request.query(updateQuery);

    return res.status(200).json({
      success: true,
      message: 'Task updated successfully'
    });
  } catch (error) {
    console.error('Error updating task:', error);
    return res.status(500).json({ error: 'Failed to update task' });
  }
}

async function deleteTask(taskId, res) {
  try {
    const pool = await getPool();

    await pool.request()
      .input('taskId', sql.Int, taskId)
      .query(`DELETE FROM tblTasks WHERE TaskID = @taskId`);

    return res.status(200).json({
      success: true,
      message: 'Task deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting task:', error);
    return res.status(500).json({ error: 'Failed to delete task' });
  }
}
