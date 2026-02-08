import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAdminAuth } from '@/lib/hooks';

export default function AddTaskPage() {
  const router = useRouter();
  const { user, loading } = useAdminAuth();
  const { processId, process: processName } = router.query;

  // State Management
  const [formData, setFormData] = useState({
    ProcessID: '',
    DepId: '',
    TaskName: '',
    DaysRequired: '',
    IsFixed: 0,
    linkTasks: '',
  });

  const [tasks, setTasks] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [processSteps, setProcessSteps] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [toasts, setToasts] = useState([]);
  const [editingTask, setEditingTask] = useState(null);
  const [editForm, setEditForm] = useState({});

  const tasksPerPage = 10;

  // Initialize form with processId
  useEffect(() => {
    if (processId) {
      setFormData(prev => ({
        ...prev,
        ProcessID: parseInt(processId),
      }));
      loadProcessData();
      loadTasks();
    }
  }, [processId]);

  // Load process steps and departments
  const loadProcessData = async () => {
    try {
      const response = await fetch(`/api/processes`);
      if (!response.ok) throw new Error('Failed to fetch processes');
      
      const processes = await response.json();
      const currentProcess = processes.find(p => p.NumberOfProccessID === parseInt(processId));
      
      if (currentProcess && currentProcess.steps) {
        setProcessSteps(currentProcess.steps);
      }
    } catch (err) {
      console.error('Error loading process data:', err);
    }

    // Load departments
    try {
      const response = await fetch(`/api/departments`);
      if (!response.ok) throw new Error('Failed to fetch departments');
      
      const depts = await response.json();
      setDepartments(depts);
    } catch (err) {
      console.error('Error loading departments:', err);
    }
  };

  // Load tasks for this process
  const loadTasks = async () => {
    try {
      const response = await fetch(`/api/tasks?processId=${processId}`);
      if (!response.ok) throw new Error('Failed to fetch tasks');
      
      const tasksData = await response.json();
      setTasks(Array.isArray(tasksData) ? tasksData : []);
    } catch (err) {
      console.error('Error loading tasks:', err);
      showToast('error', 'Error', 'Failed to load tasks');
    }
  };

  // Show toast notification
  const showToast = (type, title, message) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.DepId) newErrors.DepId = 'Department is required';
    if (!formData.TaskName.trim()) newErrors.TaskName = 'Task name is required';
    if (!formData.DaysRequired || isNaN(formData.DaysRequired) || formData.DaysRequired < 0) {
      newErrors.DaysRequired = 'Valid number of days required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form input change
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (checked ? 1 : 0) : value,
    }));
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      showToast('error', 'Validation Error', 'Please fix the errors in the form');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          TaskName: formData.TaskName,
          TaskPlanned: '',
          DepId: parseInt(formData.DepId),
          ProcessID: parseInt(formData.ProcessID),
          DaysRequired: parseInt(formData.DaysRequired),
          IsFixed: formData.IsFixed,
          Priority: null,
          PredecessorTaskID: formData.linkTasks ? parseInt(formData.linkTasks) : null
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create task');
      }

      showToast('success', 'Success', 'Task created successfully!');
      
      // Reset form
      setFormData({
        ProcessID: parseInt(processId),
        DepId: '',
        TaskName: '',
        DaysRequired: '',
        IsFixed: 0,
        linkTasks: '',
      });

      // Reload tasks
      await loadTasks();
    } catch (err) {
      console.error('Error:', err);
      showToast('error', 'Error', err.message || 'Failed to create task');
    } finally {
      setIsLoading(false);
    }
  };

  // Delete task
  const handleDeleteTask = async (taskId) => {
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
      const response = await fetch(`/api/delete-task/${taskId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete task');

      showToast('success', 'Success', 'Task deleted successfully');
      await loadTasks();
    } catch (err) {
      console.error('Error:', err);
      showToast('error', 'Error', 'Failed to delete task');
    }
  };

  // Edit task
  const handleEditTask = (taskId) => {
    const task = tasks.find(t => t.TaskID === taskId);
    if (!task) return;

    setEditingTask(task);
    setEditForm({
      TaskName: task.TaskName || '',
      DaysRequired: task.DaysRequired || '',
      IsFixed: task.IsFixed || 0,
    });
  };

  // Save edited task
  const handleSaveEdit = async () => {
    if (!editingTask) return;

    if (!editForm.TaskName.trim() || !editForm.DaysRequired) {
      showToast('error', 'Validation Error', 'All fields are required');
      return;
    }

    try {
      const response = await fetch(`/api/tasks/${editingTask.TaskID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          TaskName: editForm.TaskName,
          DaysRequired: parseInt(editForm.DaysRequired),
          IsFixed: editForm.IsFixed,
        }),
      });

      if (!response.ok) throw new Error('Failed to update task');

      showToast('success', 'Success', 'Task updated successfully');
      setEditingTask(null);
      setEditForm({});
      await loadTasks();
    } catch (err) {
      console.error('Error:', err);
      showToast('error', 'Error', err.message || 'Failed to update task');
    }
  };

  // Filter and paginate tasks
  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.TaskName?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = !statusFilter || task.Status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Group tasks by department
  const groupedTasks = {};
  filteredTasks.forEach(task => {
    if (!groupedTasks[task.DepId]) {
      groupedTasks[task.DepId] = {
        DeptName: task.DeptName || 'Unknown',
        StepOrder: processSteps.find(p => p.DepartmentID === task.DepId)?.StepOrder ?? 9999,
        Tasks: []
      };
    }
    groupedTasks[task.DepId].Tasks.push(task);
  });

  // Sort groups by StepOrder and tasks by Priority
  const sortedGroups = Object.values(groupedTasks)
    .sort((a, b) => a.StepOrder - b.StepOrder)
    .map(group => ({
      ...group,
      Tasks: group.Tasks.sort((a, b) => (a.Priority ?? 9999) - (b.Priority ?? 9999))
    }));

  // Paginate the groups
  const paginatedGroups = sortedGroups.slice(
    (currentPage - 1) * tasksPerPage,
    currentPage * tasksPerPage
  );

  const totalPages = Math.ceil(sortedGroups.length / tasksPerPage);

  if (loading || !processId) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{ fontSize: '1.2rem', color: '#666' }}>Loading...</div>
      </div>
    );
  }

  return (
    <div>
      <style>{`
        :root {
          --primary: #005bab;
          --primary-dark: #0049a8;
          --danger: #dc3545;
          --success: #10b981;
          --warning: #f59e0b;
          --info: #3b82f6;
          --light: #f8f9fa;
          --dark: #343a40;
          --border: #dee2e6;
          --shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', sans-serif;
          line-height: 1.6;
          color: #333;
          background-color: #f5f7fa;
        }

        .add-task-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
        }

        .navigation-buttons {
          display: flex;
          gap: 10px;
          margin-bottom: 30px;
        }

        .btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;
          text-decoration: none;
        }

        .btn-primary {
          background-color: var(--primary);
          color: white;
        }

        .btn-primary:hover {
          background-color: var(--primary-dark);
        }

        .btn-secondary {
          background-color: #6c757d;
          color: white;
        }

        .btn-secondary:hover {
          background-color: #5a6268;
        }

        .btn-danger {
          background-color: var(--danger);
          color: white;
        }

        .btn-danger:hover {
          background-color: #c82333;
        }

        .form-container {
          background: white;
          border-radius: 8px;
          box-shadow: var(--shadow);
          padding: 30px;
          margin-bottom: 30px;
        }

        .form-header {
          display: flex;
          align-items: center;
          gap: 15px;
          margin-bottom: 30px;
          border-bottom: 2px solid var(--border);
          padding-bottom: 20px;
        }

        .form-header h1 {
          font-size: 28px;
          color: #333;
          margin: 0;
        }

        .form-header i {
          font-size: 24px;
          color: var(--primary);
        }

        .workflow-info {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
          padding: 20px;
          background-color: var(--light);
          border-radius: 6px;
          margin-bottom: 25px;
        }

        .workflow-info div {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 14px;
        }

        .workflow-info i {
          color: var(--primary);
          width: 20px;
        }

        .process-steps {
          margin-bottom: 25px;
          padding: 20px;
          background-color: #f0f6ff;
          border-left: 4px solid var(--primary);
          border-radius: 6px;
        }

        .process-steps h3 {
          margin-bottom: 15px;
          color: #333;
          font-size: 16px;
        }

        .process-steps ol {
          padding-left: 20px;
        }

        .process-steps li {
          margin-bottom: 8px;
          color: #555;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-group label {
          display: block;
          margin-bottom: 8px;
          font-weight: 500;
          color: #333;
        }

        .required-field::after {
          content: ' *';
          color: var(--danger);
        }

        .form-group input,
        .form-group select,
        .form-group textarea {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--border);
          border-radius: 6px;
          font-size: 14px;
          font-family: inherit;
          transition: border-color 0.3s ease;
        }

        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: var(--primary);
          box-shadow: 0 0 0 3px rgba(0, 91, 171, 0.1);
        }

        .form-group input.error,
        .form-group select.error,
        .form-group textarea.error {
          border-color: var(--danger);
        }

        .validation-error {
          color: var(--danger);
          font-size: 12px;
          margin-top: 4px;
          display: none;
        }

        .validation-error.visible {
          display: block;
        }

        .char-counter {
          font-size: 12px;
          color: #999;
          margin-top: 4px;
        }

        .form-actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
          padding-top: 20px;
          border-top: 1px solid var(--border);
        }

        .tasks-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          border-bottom: 2px solid var(--border);
          padding-bottom: 15px;
        }

        .tasks-header h2 {
          font-size: 20px;
          margin: 0;
        }

        .refresh-btn {
          padding: 8px 16px;
          background-color: var(--primary);
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .refresh-btn:hover {
          background-color: var(--primary-dark);
        }

        .search-container {
          display: grid;
          grid-template-columns: 1fr 200px;
          gap: 10px;
          margin-bottom: 20px;
        }

        .search-input {
          padding: 10px 12px;
          border: 1px solid var(--border);
          border-radius: 6px;
          font-size: 14px;
        }

        .tasks-table {
          width: 100%;
          border-collapse: collapse;
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: var(--shadow);
        }

        .tasks-table thead {
          background-color: var(--light);
          border-bottom: 2px solid var(--border);
        }

        .tasks-table th {
          padding: 12px;
          text-align: left;
          font-weight: 600;
          color: #333;
          font-size: 14px;
        }

        .tasks-table td {
          padding: 12px;
          border-bottom: 1px solid var(--border);
          font-size: 14px;
        }

        .tasks-table tbody tr:hover {
          background-color: var(--light);
        }

        .department-group {
          margin-bottom: 25px;
        }

        .task-actions {
          display: flex;
          gap: 8px;
        }

        .task-actions button {
          padding: 6px 12px;
          border: none;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .edit-btn {
          background-color: var(--info);
          color: white;
        }

        .edit-btn:hover {
          background-color: #0056b3;
        }

        .delete-btn {
          background-color: var(--danger);
          color: white;
        }

        .delete-btn:hover {
          background-color: #c82333;
        }

        .pagination {
          display: flex;
          justify-content: center;
          gap: 5px;
          margin-top: 20px;
        }

        .page-btn {
          padding: 8px 12px;
          border: 1px solid var(--border);
          background: white;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }

        .page-btn.active {
          background-color: var(--primary);
          color: white;
          border-color: var(--primary);
        }

        .page-btn:hover {
          border-color: var(--primary);
        }

        .toast-container {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .toast {
          padding: 16px 20px;
          border-radius: 8px;
          box-shadow: var(--shadow);
          display: flex;
          align-items: flex-start;
          gap: 12px;
          animation: slideInRight 0.3s ease-out;
          background-color: white;
          border-left: 4px solid var(--info);
          max-width: 400px;
        }

        .toast.success {
          border-left-color: var(--success);
        }

        .toast.error {
          border-left-color: var(--danger);
        }

        @keyframes slideInRight {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>

      <div className="add-task-container">
        <div className="navigation-buttons">
          <button className="btn btn-secondary" onClick={() => router.push('/processes')}>
            <i className="fas fa-arrow-left"></i> Back
          </button>
          <button className="btn btn-primary" onClick={() => router.push('/workflowdashboard')}>
            <i className="fas fa-plus"></i> Create Workflow
          </button>
        </div>

        <div className="form-container">
          <div className="form-header">
            <i className="fas fa-tasks"></i>
            <h1>Create New Task</h1>
          </div>

          <div className="workflow-info">
            <div>
              <i className="fas fa-sitemap"></i>
              <span><strong>Process:</strong> {processName || 'Loading...'}</span>
            </div>
            <div>
              <i className="fas fa-layer-group"></i>
              <span><strong>Steps:</strong> {processSteps.length}</span>
            </div>
          </div>

          {processSteps.length > 0 && (
            <div className="process-steps">
              <h3><i className="fas fa-list-ol"></i> Process Steps</h3>
              <ol>
                {processSteps.map(step => (
                  <li key={step.ProcessID + step.DepartmentID}>
                    <strong>Step {step.StepOrder}:</strong> {step.DeptName}
                  </li>
                ))}
              </ol>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <input type="hidden" name="ProcessID" value={formData.ProcessID} />

            <div className="form-group">
              <label htmlFor="DepId" className="required-field">Responsible Department</label>
              <select
                id="DepId"
                name="DepId"
                value={formData.DepId}
                onChange={handleInputChange}
                className={errors.DepId ? 'error' : ''}
              >
                <option value="">Select a department</option>
                {departments
                  .filter(dept => processSteps.some(p => p.DepartmentID === dept.DepartmentID))
                  .map(dept => ({
                    ...dept,
                    StepOrder: processSteps.find(p => p.DepartmentID === dept.DepartmentID)?.StepOrder ?? 9999
                  }))
                  .sort((a, b) => a.StepOrder - b.StepOrder)
                  .map(dept => (
                    <option key={dept.DepartmentID} value={dept.DepartmentID}>
                      Step {dept.StepOrder} - {dept.DeptName}
                    </option>
                  ))}
              </select>
              {errors.DepId && <div className="validation-error visible">{errors.DepId}</div>}
            </div>

            <div className="form-group">
              <label htmlFor="TaskName" className="required-field">Task Name</label>
              <input
                type="text"
                id="TaskName"
                name="TaskName"
                value={formData.TaskName}
                onChange={handleInputChange}
                maxLength="100"
                className={errors.TaskName ? 'error' : ''}
              />
              {errors.TaskName && <div className="validation-error visible">{errors.TaskName}</div>}
            </div>

            <div className="form-group">
              <label htmlFor="DaysRequired" className="required-field">Estimated Days</label>
              <input
                type="number"
                id="DaysRequired"
                name="DaysRequired"
                value={formData.DaysRequired}
                onChange={handleInputChange}
                min="0"
                className={errors.DaysRequired ? 'error' : ''}
              />
              {errors.DaysRequired && <div className="validation-error visible">{errors.DaysRequired}</div>}
            </div>

            <div className="form-group">
              <label htmlFor="IsFixed">
                <input
                  type="checkbox"
                  id="IsFixed"
                  name="IsFixed"
                  checked={formData.IsFixed === 1}
                  onChange={handleInputChange}
                />
                {' '} Task is Fixed (cannot be delayed)
              </label>
            </div>

            <div className="form-group">
              <label htmlFor="linkTasks">Link to Task (Optional)</label>
              <select
                id="linkTasks"
                name="linkTasks"
                value={formData.linkTasks}
                onChange={handleInputChange}
              >
                <option value="">-- No Link --</option>
                {tasks
                  .filter(t => t.TaskID !== editingTask?.TaskID)
                  .map(task => ({
                    ...task,
                    StepOrder: processSteps.find(p => p.DepartmentID === task.DepId)?.StepOrder ?? 9999
                  }))
                  .sort((a, b) => {
                    if (a.StepOrder !== b.StepOrder) return a.StepOrder - b.StepOrder;
                    return (a.Priority ?? 9999) - (b.Priority ?? 9999);
                  })
                  .map(task => (
                    <option key={task.TaskID} value={task.TaskID}>
                      {task.TaskName} ({task.DeptName})
                    </option>
                  ))}
              </select>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={isLoading}>
                <i className="fas fa-plus-circle"></i>
                {isLoading ? 'Creating...' : 'Create Task'}
              </button>
            </div>
          </form>
        </div>

        <div className="form-container">
          <div className="tasks-header">
            <h2><i className="fas fa-clipboard-list"></i> Current Tasks</h2>
            <button className="refresh-btn" onClick={loadTasks}>
              <i className="fas fa-sync-alt"></i> Refresh
            </button>
          </div>

          <div className="search-container">
            <input
              type="text"
              className="search-input"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
            <select
              className="search-input"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          {tasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
              <i className="fas fa-inbox" style={{ fontSize: '48px', marginBottom: '15px', display: 'block' }}></i>
              <p>No tasks yet. Create one above!</p>
            </div>
          ) : (
            <>
              {paginatedGroups.map((group) => (
                <div key={`dept-${group.DeptName}`} style={{ marginBottom: '30px' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '15px',
                    backgroundColor: '#f0f6ff',
                    borderLeft: '4px solid #005bab',
                    marginBottom: '15px',
                    borderRadius: '6px'
                  }}>
                    <i className="fas fa-building" style={{ color: '#005bab', fontSize: '18px' }}></i>
                    <h3 style={{ margin: 0, fontSize: '16px', flex: 1 }}>
                      Step {group.StepOrder} - {group.DeptName}
                    </h3>
                    <span style={{
                      background: '#005bab',
                      color: 'white',
                      padding: '4px 12px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}>
                      {group.Tasks.length} tasks
                    </span>
                  </div>
                  
                  <table className="tasks-table">
                    <thead>
                      <tr>
                        <th>Task Name</th>
                        <th>Days</th>
                        <th>Priority</th>
                        <th>Fixed</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.Tasks.map(task => (
                        <tr key={task.TaskID}>
                          <td>{task.TaskName}</td>
                          <td>{task.DaysRequired || 0}</td>
                          <td>{task.Priority || '-'}</td>
                          <td>{task.IsFixed ? 'Yes' : 'No'}</td>
                          <td>
                            <div className="task-actions">
                              <button className="edit-btn" onClick={() => handleEditTask(task.TaskID)}>
                                <i className="fas fa-edit"></i> Edit
                              </button>
                              <button 
                                className="delete-btn" 
                                onClick={() => handleDeleteTask(task.TaskID)}
                              >
                                <i className="fas fa-trash"></i> Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}

              {totalPages > 1 && (
                <div className="pagination">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      className={`page-btn ${currentPage === page ? 'active' : ''}`}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {editingTask && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9000
          }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '30px',
              maxWidth: '500px',
              width: '90%',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
            }}>
              <h2 style={{ marginTop: 0, marginBottom: '20px', color: '#333' }}>Edit Task</h2>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Task Name</label>
                <input
                  type="text"
                  value={editForm.TaskName || ''}
                  onChange={(e) => setEditForm({ ...editForm, TaskName: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Days Required</label>
                <input
                  type="number"
                  min="0"
                  value={editForm.DaysRequired || ''}
                  onChange={(e) => setEditForm({ ...editForm, DaysRequired: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={editForm.IsFixed === 1 || false}
                    onChange={(e) => setEditForm({ ...editForm, IsFixed: e.target.checked ? 1 : 0 })}
                  />
                  Task is Fixed (cannot be delayed)
                </label>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    setEditingTask(null);
                    setEditForm({});
                  }}
                  style={{
                    padding: '10px 20px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    backgroundColor: '#f5f5f5',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  style={{
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '6px',
                    backgroundColor: '#005bab',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            <div>
              <strong>{toast.title}</strong>
              <div>{toast.message}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
