import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/hooks';
import Layout from '@/components/Layout';

export default function WorkflowUserPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { hdrId } = router.query;

  // State
  const [workflow, setWorkflow] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [paymentSteps, setPaymentSteps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [completionPercentage, setCompletionPercentage] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  // Load workflow data
  useEffect(() => {
    if (!hdrId) return;

    const fetchWorkflowData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch workflow details
        const workflowRes = await fetch(`/api/workflows/${hdrId}`);
        if (!workflowRes.ok) throw new Error('Failed to load workflow');
        const workflowData = await workflowRes.json();
        setWorkflow(workflowData);

        // Fetch tasks for this workflow
        const tasksRes = await fetch(`/api/workflows/${hdrId}/tasks`);
        if (!tasksRes.ok) throw new Error('Failed to load tasks');
        const tasksData = await tasksRes.json();
        setTasks(tasksData);

        // Fetch payment steps
        const stepsRes = await fetch(`/api/workflow-steps/${hdrId}`);
        if (stepsRes.ok) {
          const stepsData = await stepsRes.json();
          setPaymentSteps(stepsData);
        }

        // Calculate completion percentage
        if (tasksData.length > 0) {
          const completed = tasksData.filter(t => t.TimeFinished).length;
          const percentage = Math.round((completed / tasksData.length) * 100);
          setCompletionPercentage(percentage);
        }

      } catch (err) {
        console.error('Error loading workflow data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkflowData();
  }, [hdrId]);

  // Filter tasks based on status and search
  const filteredTasks = tasks
    .filter(task => {
      const matchesSearch = !searchQuery || 
        task.TaskName?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || task.Status === statusFilter;
      
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      // Sort by: StepOrder → Department → Priority
      if (a.StepOrder !== b.StepOrder) {
        return a.StepOrder - b.StepOrder;
      }
      if (a.DeptName !== b.DeptName) {
        return a.DeptName.localeCompare(b.DeptName);
      }
      return a.Priority - b.Priority;
    });

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading workflow details...</p>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="error-container">
          <div className="alert alert-danger">
            <strong>Error:</strong> {error}
          </div>
          <button onClick={() => router.back()} className="btn btn-primary">
            Go Back
          </button>
        </div>
      </Layout>
    );
  }

  if (!workflow) {
    return (
      <Layout>
        <div className="error-container">
          <div className="alert alert-warning">
            Workflow not found
          </div>
          <button onClick={() => router.back()} className="btn btn-primary">
            Go Back
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <main className="workflow-user-page">
        {/* Top Navigation Header */}
        <header className="top-header">
          <div className="header-left">
            <nav className="breadcrumb">
              <button onClick={() => router.back()} className="breadcrumb-link">
                <span className="breadcrumb-icon">🏠</span>
                Dashboard
              </button>
              <span className="breadcrumb-separator">/</span>
              <span className="breadcrumb-current">Workflow #{workflow?.HdrID}</span>
            </nav>
          </div>

          <div className="header-right">
            <button onClick={() => router.back()} className="action-button">
              <span className="button-icon">←</span>
              Back
            </button>
            <button onClick={() => window.print()} className="action-button">
              <span className="button-icon">🖨️</span>
              Print
            </button>
          </div>
        </header>

        {/* Main Content Header */}
        <section className="main-header">
          <div className="header-title">
            <h1>
              <span className="title-icon">✓</span>
              Task Management
            </h1>
            <p className="header-subtitle">Workflow #{workflow?.HdrID} - {workflow?.Status}</p>
          </div>

          {/* Completion Progress */}
          <div className="completion-section">
            <div className="progress-display">
              <div className="progress-visual">
                <div className="progress-ring">
                  <svg viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" className="progress-ring-bg"></circle>
                    <circle 
                      cx="50" 
                      cy="50" 
                      r="45" 
                      className="progress-ring-fill"
                      style={{ 
                        strokeDasharray: `${(completionPercentage / 100) * 283} 283`,
                        strokeDashoffset: 0
                      }}
                    ></circle>
                  </svg>
                  <div className="progress-percentage">{completionPercentage}%</div>
                </div>
              </div>
              <div className="progress-info">
                <span className="progress-label">Task Completion</span>
                <span className="progress-text">{tasks.filter(t => t.TimeFinished).length} of {tasks.length} completed</span>
              </div>
            </div>
          </div>
        </section>

        {/* Status Quick View Cards */}
        <section className="status-quickview">
          <div className="status-card">
            <div className="status-badge-icon">📋</div>
            <div className="status-info">
              <span className="status-label">All Tasks</span>
              <span className="status-count">{tasks.length}</span>
            </div>
          </div>

          <div className="status-card">
            <div className="status-badge-icon pending">⏳</div>
            <div className="status-info">
              <span className="status-label">Pending</span>
              <span className="status-count">{tasks.filter(t => !t.TimeStarted && !t.TimeFinished).length}</span>
            </div>
          </div>

          <div className="status-card">
            <div className="status-badge-icon inprogress">⚙️</div>
            <div className="status-info">
              <span className="status-label">In Progress</span>
              <span className="status-count">{tasks.filter(t => t.TimeStarted && !t.TimeFinished).length}</span>
            </div>
          </div>

          <div className="status-card">
            <div className="status-badge-icon completed">✓</div>
            <div className="status-info">
              <span className="status-label">Completed</span>
              <span className="status-count">{tasks.filter(t => t.TimeFinished).length}</span>
            </div>
          </div>
        </section>

        {/* Workflow Info */}
        <section className="workflow-info">
          <div className="info-column">
            <div className="info-item">
              <span className="info-icon">📊</span>
              <div className="info-content">
                <span className="info-label">Process</span>
                <span className="info-value">{workflow?.ProcessName || '-'}</span>
              </div>
            </div>
            <div className="info-item">
              <span className="info-icon">📁</span>
              <div className="info-content">
                <span className="info-label">Project</span>
                <span className="info-value">{workflow?.ProjectName || '-'}</span>
              </div>
            </div>
          </div>

          <div className="info-column">
            <div className="info-item">
              <span className="info-icon">📦</span>
              <div className="info-content">
                <span className="info-label">Package</span>
                <span className="info-value">{workflow?.PackageName || '-'}</span>
              </div>
            </div>
            <div className="info-item">
              <span className="info-icon">📅</span>
              <div className="info-content">
                <span className="info-label">Started</span>
                <span className="info-value">
                  {workflow?.startDate ? new Date(workflow.startDate).toLocaleDateString() : '-'}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Filters & Search */}
        <section className="filters-section">
          <div className="filter-group">
            <label>Filter by Status:</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="filter-select">
              <option value="all">All Tasks</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div className="search-group">
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>

          <button onClick={() => { setStatusFilter('all'); setSearchQuery(''); }} className="btn btn-outline">
            Reset Filters
          </button>
        </section>

        {/* Tasks Table - Grouped by Step */}
        <section className="tasks-section">
          <div className="section-header">
            <h2>Tasks ({filteredTasks.length})</h2>
          </div>

          {filteredTasks.length === 0 ? (
            <div className="no-results">
              <p>{tasks.length === 0 ? 'No tasks found' : 'No tasks match your filters'}</p>
            </div>
          ) : (
            (() => {
              // Group tasks by StepOrder
              const grouped = {};
              filteredTasks.forEach(task => {
                const stepKey = `step_${task.StepOrder}`;
                if (!grouped[stepKey]) {
                  grouped[stepKey] = {
                    stepOrder: task.StepOrder,
                    deptId: task.DepId,
                    deptName: task.DeptName,
                    tasks: []
                  };
                }
                grouped[stepKey].tasks.push(task);
              });

              // Sort by step order and render
              return Object.values(grouped)
                .sort((a, b) => a.stepOrder - b.stepOrder)
                .map(group => (
                  <div key={`step_${group.stepOrder}`} className="step-group">
                    <div className="step-header">
                      <i className="fas fa-building"></i> 
                      <span className="step-title">Step {group.stepOrder} - {group.deptName}</span>
                      <span className="task-count">{group.tasks.length} tasks</span>
                    </div>
                    <div className="table-responsive">
                      <table className="tasks-table">
                        <thead>
                          <tr>
                            <th>Task ID</th>
                            <th>Task Name</th>
                            <th>Priority</th>
                            <th>Status</th>
                            <th>Started</th>
                            <th>Finished</th>
                            <th>Days Required</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.tasks
                            .sort((a, b) => a.Priority - b.Priority)
                            .map(task => (
                            <tr key={task.TaskID} className={`task-row status-${task.Status?.toLowerCase()}`}>
                              <td>{task.TaskID}</td>
                              <td className="task-name">{task.TaskName || '-'}</td>
                              <td className="priority">{task.Priority || '-'}</td>
                              <td>
                                <span className={`status-badge status-${task.Status?.toLowerCase()}`}>
                                  {task.Status || 'Pending'}
                                </span>
                              </td>
                              <td>{task.TimeStarted ? new Date(task.TimeStarted).toLocaleDateString() : '-'}</td>
                              <td>{task.TimeFinished ? new Date(task.TimeFinished).toLocaleDateString() : '-'}</td>
                              <td>{task.DaysRequired || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ));
            })()
          )}
        </section>

        {/* Payment Steps (if any) */}
        {paymentSteps.length > 0 && (
          <section className="payment-steps-section">
            <div className="section-header">
              <h2>Payment Steps ({paymentSteps.length})</h2>
            </div>
            <div className="steps-grid">
              {paymentSteps.map((step, idx) => (
                <div key={step.workflowStepID} className={`step-card status-${step.isActive ? 'active' : 'inactive'}`}>
                  <div className="step-number">Step {step.stepNumber}</div>
                  <div className="step-status">
                    {step.isActive ? '🟢 Active' : step.StepFinished ? '✓ Completed' : '⏳ Waiting'}
                  </div>
                  {step.StepStartDate && (
                    <div className="step-date">Started: {new Date(step.StepStartDate).toLocaleDateString()}</div>
                  )}
                  {step.StepFinished && (
                    <div className="step-date">Finished: {new Date(step.StepFinished).toLocaleDateString()}</div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <style jsx>{`
        .workflow-user-page {
          padding: 0;
          background: #f9fafb;
          min-height: 100vh;
        }

        /* TOP HEADER */
        .top-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 2rem;
          background: white;
          border-bottom: 1px solid #e5e7eb;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }

        .header-left,
        .header-right {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .breadcrumb {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
        }

        .breadcrumb-link {
          background: none;
          border: none;
          color: #3b82f6;
          cursor: pointer;
          text-decoration: none;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: inherit;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          transition: background 0.2s;
        }

        .breadcrumb-link:hover {
          background: #f3f4f6;
          text-decoration: none;
        }

        .breadcrumb-icon {
          font-size: 1rem;
        }

        .breadcrumb-separator {
          color: #d1d5db;
        }

        .breadcrumb-current {
          color: #6b7280;
          font-weight: 500;
        }

        .action-button {
          background: none;
          border: 1px solid #d1d5db;
          padding: 0.5rem 1rem;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          color: #374151;
          transition: all 0.2s;
        }

        .action-button:hover {
          background: #f3f4f6;
          border-color: #9ca3af;
        }

        .button-icon {
          font-size: 1rem;
        }

        /* MAIN HEADER */
        .main-header {
          padding: 2rem;
          background: white;
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 2rem;
        }

        .header-title h1 {
          margin: 0;
          font-size: 1.875rem;
          color: #1f2937;
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .title-icon {
          font-size: 2rem;
        }

        .header-subtitle {
          margin: 0.5rem 0 0 0;
          color: #6b7280;
          font-size: 0.875rem;
        }

        .completion-section {
          flex-shrink: 0;
        }

        .progress-display {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          background: #f9fafb;
          padding: 1.5rem;
          border-radius: 12px;
        }

        .progress-visual {
          position: relative;
          width: 100px;
          height: 100px;
        }

        .progress-ring {
          position: relative;
          width: 100%;
          height: 100%;
        }

        .progress-ring svg {
          width: 100%;
          height: 100%;
          transform: rotate(-90deg);
        }

        .progress-ring-bg {
          fill: none;
          stroke: #e5e7eb;
          stroke-width: 6;
        }

        .progress-ring-fill {
          fill: none;
          stroke: #10b981;
          stroke-width: 6;
          stroke-linecap: round;
          transition: stroke-dasharray 0.3s ease;
        }

        .progress-percentage {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 1.5rem;
          font-weight: 700;
          color: #1f2937;
        }

        .progress-info {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .progress-label {
          font-size: 0.875rem;
          color: #6b7280;
          font-weight: 500;
        }

        .progress-text {
          font-size: 1rem;
          color: #1f2937;
          font-weight: 500;
        }

        /* STATUS QUICK VIEW */
        .status-quickview {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          padding: 2rem;
          background: white;
          border-bottom: 1px solid #e5e7eb;
        }

        .status-card {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          transition: all 0.2s;
          cursor: pointer;
        }

        .status-card:hover {
          background: #f3f4f6;
          border-color: #d1d5db;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .status-badge-icon {
          font-size: 1.75rem;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 50px;
          height: 50px;
          border-radius: 8px;
          background: #dbeafe;
        }

        .status-badge-icon.pending {
          background: #fef3c7;
          color: #92400e;
        }

        .status-badge-icon.inprogress {
          background: #bfdbfe;
          color: #0c4a6e;
        }

        .status-badge-icon.completed {
          background: #d1fae5;
          color: #065f46;
        }

        .status-info {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .status-label {
          font-size: 0.875rem;
          color: #6b7280;
          font-weight: 500;
        }

        .status-count {
          font-size: 1.5rem;
          font-weight: 700;
          color: #1f2937;
        }

        /* WORKFLOW INFO */
        .workflow-info {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2rem;
          padding: 2rem;
          background: white;
          border-bottom: 1px solid #e5e7eb;
        }

        .info-column {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .info-item {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.75rem;
          border-radius: 6px;
          transition: background 0.2s;
        }

        .info-item:hover {
          background: #f9fafb;
        }

        .info-icon {
          font-size: 1.5rem;
          min-width: 24px;
        }

        .info-content {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .info-label {
          font-size: 0.75rem;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 600;
        }

        .info-value {
          font-size: 1rem;
          color: #1f2937;
          font-weight: 500;
        }

        .filters-section {
          display: flex;
          gap: 1rem;
          margin-bottom: 2rem;
          padding: 1rem;
          background: #f9fafb;
          border-radius: 8px;
          flex-wrap: wrap;
          align-items: flex-end;
        }

        .filter-group,
        .search-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .filter-group label {
          font-size: 0.875rem;
          font-weight: 500;
          color: #6b7280;
        }

        .filter-select,
        .search-input {
          padding: 0.5rem 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 0.875rem;
          font-family: inherit;
        }

        .search-input {
          min-width: 200px;
        }

        .filter-select:focus,
        .search-input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
        }

        .section-header {
          margin-bottom: 1rem;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 0.75rem;
        }

        .section-header h2 {
          margin: 0;
          font-size: 1.125rem;
          color: #1f2937;
        }

        .tasks-section,
        .payment-steps-section {
          margin-bottom: 2rem;
          padding: 1.5rem;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
        }

        .step-group {
          margin-bottom: 1.5rem;
        }

        .step-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem;
          background: #f3f4f6;
          border-radius: 6px;
          margin-bottom: 1rem;
          border-left: 4px solid #3b82f6;
        }

        .step-header i {
          font-size: 1.25rem;
          color: #3b82f6;
        }

        .step-title {
          font-weight: 600;
          color: #1f2937;
          flex: 1;
        }

        .task-count {
          background: #dbeafe;
          color: #1e40af;
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.875rem;
          font-weight: 500;
        }

        .table-responsive {
          overflow-x: auto;
        }

        .tasks-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.875rem;
        }

        .tasks-table thead {
          background: #f9fafb;
        }

        .tasks-table th {
          padding: 0.75rem;
          text-align: left;
          font-weight: 600;
          color: #1f2937;
          border-bottom: 1px solid #e5e7eb;
          font-size: 0.8125rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .tasks-table td {
          padding: 0.75rem;
          border-bottom: 1px solid #e5e7eb;
          color: #374151;
        }

        .task-row:hover {
          background: #f9fafb;
        }

        .task-name {
          font-weight: 500;
          color: #1f2937;
        }

        .priority {
          font-weight: 500;
        }

        .no-results {
          text-align: center;
          padding: 2rem;
          color: #6b7280;
          background: #f9fafb;
          border-radius: 6px;
          margin-top: 1rem;
        }

        .steps-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 1rem;
          margin-top: 1rem;
        }

        .step-card {
          padding: 1rem;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          text-align: center;
          background: white;
          transition: all 0.2s;
        }

        .step-card.status-active {
          border-color: #10b981;
          background: #f0fdf4;
          box-shadow: 0 0 8px rgba(16, 185, 129, 0.1);
        }

        .step-card.status-inactive {
          border-color: #d1d5db;
          background: #f9fafb;
        }

        .step-number {
          font-weight: 600;
          font-size: 1rem;
          color: #1f2937;
          margin-bottom: 0.5rem;
        }

        .step-status {
          font-size: 0.875rem;
          margin-bottom: 0.5rem;
          color: #6b7280;
          font-weight: 500;
        }

        .step-date {
          font-size: 0.75rem;
          color: #9ca3af;
        }

        .loading-container,
        .error-container {
          text-align: center;
          padding: 3rem 2rem;
          background: white;
          border-radius: 8px;
          margin: 2rem;
        }

        .spinner {
          width: 40px;
          height: 40px;
          margin: 0 auto 1rem;
          border: 4px solid #e5e7eb;
          border-top: 4px solid #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .top-header {
            flex-direction: column;
            gap: 1rem;
            align-items: flex-start;
            padding: 1rem;
          }

          .header-left {
            width: 100%;
          }

          .header-right {
            width: 100%;
            justify-content: flex-end;
          }

          .main-header {
            flex-direction: column;
            gap: 1rem;
            padding: 1.5rem;
          }

          .completion-section {
            width: 100%;
          }

          .progress-display {
            flex-direction: column;
            gap: 1rem;
          }

          .status-quickview {
            grid-template-columns: 1fr;
            padding: 1rem;
          }

          .workflow-info {
            grid-template-columns: 1fr;
            gap: 1rem;
            padding: 1rem;
          }

          .filters-section {
            flex-direction: column;
            padding: 1rem;
          }

          .filter-group,
          .search-group {
            min-width: 100%;
          }

          .tasks-section,
          .payment-steps-section {
            padding: 0 1rem 1rem 1rem;
          }

          .section-header {
            padding: 1rem;
          }

          .steps-grid {
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          }

          .tasks-table {
            font-size: 0.75rem;
          }

          .tasks-table th,
          .tasks-table td {
            padding: 0.5rem;
          }
        }
      `}</style>
    </Layout>
  );
}
