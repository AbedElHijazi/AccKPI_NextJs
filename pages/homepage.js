import { useAuth } from '@/lib/hooks';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';

export default function Homepage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [processes, setProcesses] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoadingData(true);
        const [processesRes, tasksRes] = await Promise.all([
          fetch('/api/processes'),
          fetch('/api/tasks')
        ]);

        if (processesRes.ok) {
          const data = await processesRes.json();
          setProcesses(data);
        }
        if (tasksRes.ok) {
          const data = await tasksRes.json();
          setTasks(data);
        }
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setLoadingData(false);
      }
    }
    if (user) {
      fetchData();
    }
  }, [user]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout');
      router.push('/login');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  if (loading) {
    return <div className="d-flex justify-content-center align-items-center min-vh-100">Loading...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <>
      <style>{`
        :root {
          --primary: #005bab;
          --primary-dark: #003f7f;
          --primary-light: #e6f0ff;
          --accent: #007acc;
          --accent-dark: #005f99;
          --text: #333333;
          --text-light: #666666;
          --border: #e0e0e0;
          --background: #f8fafc;
          --white: #ffffff;
          --success: #28a745;
          --warning: #ffc107;
          --danger: #dc3545;
          --shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
          --transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }

        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
        }

        body {
          background-color: var(--background);
          color: var(--text);
          line-height: 1.6;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background-color: var(--white);
          padding: 1.2rem 2rem;
          border-bottom: 3px solid var(--primary);
          box-shadow: var(--shadow);
          position: sticky;
          top: 0;
          z-index: 100;
          gap: 2rem;
        }

        .logo {
          height: 40px;
          width: auto;
          flex-shrink: 0;
          object-fit: contain;
          padding: 0.25rem;
          border-radius: 4px;
          transition: transform 0.3s ease;
        }

        .logo:hover {
          transform: scale(1.05);
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 2rem;
          margin-left: auto;
        }

        .user-info {
          font-weight: 500;
          color: var(--primary-dark);
          white-space: nowrap;
          font-size: 0.95rem;
        }

        .logout-btn {
          background-color: var(--primary);
          color: var(--white);
          padding: 0.6rem 1.3rem;
          text-decoration: none;
          border-radius: 6px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 0.6rem;
          transition: var(--transition);
          white-space: nowrap;
          font-size: 0.9rem;
          cursor: pointer;
          border: none;
        }

        .logout-btn:hover {
          background-color: var(--primary-dark);
          transform: translateY(-1px);
        }

        .main-content {
          flex: 1;
          padding: 1.5rem;
          max-width: 1400px;
          margin: 0 auto;
          width: 100%;
        }

        .section-title {
          font-size: 1.4rem;
          font-weight: 600;
          color: var(--primary-dark);
          margin-bottom: 1.5rem;
          display: flex;
          align-items: center;
          gap: 0.7rem;
        }

        .quick-actions {
          margin-bottom: 2.5rem;
        }

        .actions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
        }

        .action-btn {
          background-color: var(--white);
          border: 2px solid var(--border);
          border-radius: 8px;
          padding: 1.5rem;
          text-decoration: none;
          color: var(--text);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.7rem;
          transition: var(--transition);
          text-align: center;
          cursor: pointer;
        }

        .action-btn:hover {
          border-color: var(--primary);
          box-shadow: var(--shadow);
          transform: translateY(-2px);
          background-color: var(--primary-light);
        }

        .action-btn i {
          font-size: 2rem;
          color: var(--primary);
        }

        .btn-label {
          font-weight: 600;
          font-size: 0.95rem;
          color: var(--text);
        }

        .btn-subtitle {
          font-size: 0.8rem;
          color: var(--text-light);
        }

        .process-table-container {
          background-color: var(--white);
          border-radius: 8px;
          padding: 1.5rem;
          box-shadow: var(--shadow);
          margin-bottom: 2.5rem;
        }

        .process-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 1rem;
        }

        .process-table thead {
          background-color: var(--primary-light);
          border-bottom: 2px solid var(--primary);
        }

        .process-table th {
          padding: 1rem;
          text-align: left;
          font-weight: 600;
          color: var(--primary-dark);
        }

        .process-table tbody tr {
          border-bottom: 1px solid var(--border);
          transition: var(--transition);
        }

        .process-table tbody tr:hover {
          background-color: var(--primary-light);
        }

        .process-table td {
          padding: 1rem;
        }

        .process-id {
          font-weight: 600;
          color: var(--primary);
        }

        .actions-cell {
          display: flex;
          gap: 0.5rem;
        }

        .action-buttons {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .action-buttons button,
        .action-buttons a.btn-action {
          background-color: var(--primary);
          color: var(--white);
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 4px;
          font-size: 0.85rem;
          cursor: pointer;
          transition: var(--transition);
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          white-space: nowrap;
          text-decoration: none;
        }

        .action-buttons button:hover,
        .action-buttons a.btn-action:hover {
          background-color: var(--primary-dark);
          transform: translateY(-1px);
        }

        .activity-table {
          background-color: var(--white);
          border-radius: 8px;
          padding: 1.5rem;
          box-shadow: var(--shadow);
        }

        .activity-table table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 1rem;
        }

        .activity-table thead {
          background-color: var(--primary-light);
          border-bottom: 2px solid var(--primary);
        }

        .activity-table th {
          padding: 1rem;
          text-align: left;
          font-weight: 600;
          color: var(--primary-dark);
        }

        .activity-table tbody tr {
          border-bottom: 1px solid var(--border);
          transition: var(--transition);
        }

        .activity-table tbody tr:hover {
          background-color: var(--primary-light);
        }

        .activity-table td {
          padding: 1rem;
        }

        .filters-container {
          display: flex;
          gap: 1rem;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
        }

        .filters-container input {
          flex: 1;
          min-width: 200px;
          padding: 0.7rem;
          border: 1px solid var(--border);
          border-radius: 4px;
          font-size: 0.9rem;
        }

        .filter-group {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .filter-label {
          font-weight: 500;
          color: var(--text);
        }

        .filter-select {
          padding: 0.7rem;
          border: 1px solid var(--border);
          border-radius: 4px;
          font-size: 0.9rem;
        }
      `}</style>

      <header className="dashboard-header">
        <img src="/images/accLogo.png" alt="Company Logo" className="logo" />
        <div className="header-right">
          <p className="user-info">Welcome {user.name || user.usrDesc} (User)</p>
          <button onClick={handleLogout} className="logout-btn">
            <i className="fas fa-sign-out-alt"></i> Log out
          </button>
        </div>
      </header>

      <main className="main-content">
        <section className="quick-actions">
          <h3 className="section-title"><i className="fas fa-bolt"></i> Quick Actions</h3>
          <div className="actions-grid">
            <a href="/workflowdash" className="action-btn" title="View workflows">
              <i className="fas fa-tasks"></i>
              <span className="btn-label">View Workflows</span>
              <span className="btn-subtitle">Task management</span>
            </a>
            <a href="/userpage" className="action-btn" title="View your tasks">
              <i className="fas fa-user"></i>
              <span className="btn-label">My Tasks</span>
              <span className="btn-subtitle">Assigned tasks</span>
            </a>
            {user.usrAdmin && (
              <>
                <a href="/processes" className="action-btn" title="Manage processes">
                  <i className="fas fa-cogs"></i>
                  <span className="btn-label">Manage Processes</span>
                  <span className="btn-subtitle">Process management</span>
                </a>
                <a href="/adminpage" className="action-btn" title="Admin dashboard">
                  <i className="fas fa-shield-alt"></i>
                  <span className="btn-label">Admin Panel</span>
                  <span className="btn-subtitle">System management</span>
                </a>
              </>
            )}
          </div>
        </section>

        <section className="process-table-container">
          <h3 className="section-title"><i className="fas fa-cogs"></i> Processes</h3>
          {loadingData ? (
            <p>Loading processes...</p>
          ) : processes && processes.length > 0 ? (
            <table className="process-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Process Name</th>
                  <th>Description</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {processes.map(process => (
                  <tr key={process.NumberOfProccessID}>
                    <td className="process-id">#{process.NumberOfProccessID}</td>
                    <td>{process.ProcessName}</td>
                    <td>{process.processDesc || 'No description'}</td>
                    <td className="actions-cell">
                      <div className="action-buttons">
                        <a href="/processes" title="View processes" className="btn-action"><i className="fas fa-project-diagram"></i> View</a>
                        {user.usrAdmin && (
                          <>
                            <a href="/processes" title="Manage processes" className="btn-action"><i className="fas fa-edit"></i> Edit</a>
                            <a href="/processes" title="Manage tasks" className="btn-action"><i className="fas fa-tasks"></i> Tasks</a>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No processes found</p>
          )}
        </section>

        <section className="activity-table">
          <h3 id="activityTitle" className="section-title"><i className="fas fa-clipboard-list"></i> Tasks</h3>
          <div className="filters-container">
            <input type="text" placeholder="Search tasks..." />
          </div>
          {loadingData ? (
            <p>Loading tasks...</p>
          ) : tasks && tasks.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>Task Name</th>
                  <th>Priority</th>
                  <th>Days Required</th>
                  <th>Department</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map(task => (
                  <tr key={task.TaskID}>
                    <td><strong>{task.TaskName}</strong></td>
                    <td>
                      <span className={`badge ${task.Priority === 'High' ? 'bg-danger' : task.Priority === 'Medium' ? 'bg-warning' : 'bg-info'}`}>
                        {task.Priority || 'Normal'}
                      </span>
                    </td>
                    <td>{task.DaysRequired}</td>
                    <td>{task.DeptName || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No tasks found</p>
          )}
        </section>
      </main>
    </>
  );
}
