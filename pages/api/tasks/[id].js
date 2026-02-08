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
  const { 
    taskName, TaskName,
    taskPlanned, TaskPlanned,
    priority, Priority,
    daysRequired, DaysRequired,
    isTaskSelected, IsTaskSelected,
    isFixed, IsFixed,
    plannedDate, PlannedDate
  } = req.body;

  const name = TaskName || taskName;
  const description = TaskPlanned || taskPlanned;
  const days = DaysRequired !== undefined ? DaysRequired : daysRequired;
  const fixed = IsFixed !== undefined ? IsFixed : isFixed;
  const selected = IsTaskSelected !== undefined ? IsTaskSelected : isTaskSelected;
  const prio = Priority !== undefined ? Priority : priority;
  const planned = PlannedDate !== undefined ? PlannedDate : plannedDate;

  try {
    const pool = await getPool();

    let updateQuery = 'UPDATE tblTasks SET ';
    const updates = [];
    const request = pool.request().input('taskId', sql.Int, taskId);

    if (name !== undefined) {
      updates.push('TaskName = @TaskName');
      request.input('TaskName', sql.NVarChar(150), name);
    }
    if (description !== undefined) {
      updates.push('TaskPlanned = @TaskPlanned');
      request.input('TaskPlanned', sql.NVarChar, description);
    }
    if (days !== undefined) {
      updates.push('DaysRequired = @DaysRequired');
      request.input('DaysRequired', sql.Int, parseInt(days));
    }
    if (prio !== undefined) {
      updates.push('Priority = @Priority');
      request.input('Priority', sql.Int, prio);
    }
    if (selected !== undefined) {
      updates.push('IsTaskSelected = @IsTaskSelected');
      request.input('IsTaskSelected', sql.Bit, selected);
    }
    if (fixed !== undefined) {
      updates.push('IsFixed = @IsFixed');
      request.input('IsFixed', sql.Bit, fixed ? 1 : 0);
    }
    if (planned !== undefined) {
      updates.push('PlannedDate = @PlannedDate');
      request.input('PlannedDate', sql.VarChar(30), planned);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateQuery += updates.join(', ') + ' WHERE TaskID = @taskId';

    await request.query(updateQuery);

    console.log(`[TASKS API] Updated task ${taskId}`);
    return res.status(200).json({
      success: true,
      message: 'Task updated successfully',
      taskId: taskId
    });
  } catch (error) {
    console.error('[TASKS API] Error updating task:', error);
    return res.status(500).json({ error: 'Failed to update task: ' + error.message });
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
