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
  const filteredTasks = tasks.filter(task => {
    const matchesSearch = !searchQuery || 
      task.TaskName?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || task.Status === statusFilter;
    
    return matchesSearch && matchesStatus;
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
        {/* Header */}
        <header className="page-header">
          <div className="header-content">
            <div className="breadcrumb">
              <button onClick={() => router.back()} className="breadcrumb-link">
                ← Dashboard
              </button>
              <span className="breadcrumb-separator">/</span>
              <span className="breadcrumb-current">Workflow #{workflow.HdrID}</span>
            </div>

            <div className="header-actions">
              <button onClick={() => router.back()} className="btn btn-outline">
                Back to Dashboard
              </button>
            </div>
          </div>
        </header>

        {/* Workflow Summary */}
        <section className="workflow-summary">
          <div className="summary-card">
            <div className="summary-header">
              <h2>Workflow Details</h2>
            </div>
            <div className="summary-content">
              <div className="summary-row">
                <label>Workflow ID:</label>
                <span>{workflow.HdrID}</span>
              </div>
              <div className="summary-row">
                <label>Process:</label>
                <span>{workflow.ProcessName || '-'}</span>
              </div>
              <div className="summary-row">
                <label>Package:</label>
                <span>{workflow.PackageName || '-'}</span>
              </div>
              <div className="summary-row">
                <label>Project:</label>
                <span>{workflow.ProjectName || '-'}</span>
              </div>
              <div className="summary-row">
                <label>Status:</label>
                <span className={`status-badge status-${workflow.Status?.toLowerCase()}`}>
                  {workflow.Status || 'Unknown'}
                </span>
              </div>
              <div className="summary-row">
                <label>Started:</label>
                <span>{workflow.startDate ? new Date(workflow.startDate).toLocaleDateString() : '-'}</span>
              </div>
            </div>
          </div>

          {/* Progress */}
          <div className="progress-card">
            <div className="progress-header">
              <h3>Task Completion</h3>
              <span className="completion-percentage">{completionPercentage}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${completionPercentage}%` }}></div>
            </div>
            <div className="progress-stats">
              <span>{tasks.filter(t => t.TimeFinished).length} of {tasks.length} tasks completed</span>
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

        {/* Tasks Table */}
        <section className="tasks-section">
          <div className="section-header">
            <h2>Tasks ({filteredTasks.length})</h2>
          </div>

          {filteredTasks.length === 0 ? (
            <div className="no-results">
              <p>{tasks.length === 0 ? 'No tasks found' : 'No tasks match your filters'}</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="tasks-table">
                <thead>
                  <tr>
                    <th>Task ID</th>
                    <th>Task Name</th>
                    <th>Department</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Started</th>
                    <th>Finished</th>
                    <th>Days Required</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.map(task => (
                    <tr key={task.TaskID} className={`task-row status-${task.Status?.toLowerCase()}`}>
                      <td>{task.TaskID}</td>
                      <td className="task-name">{task.TaskName || '-'}</td>
                      <td>{task.DeptName || '-'}</td>
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
          padding: 2rem;
          max-width: 1200px;
          margin: 0 auto;
        }

        .page-header {
          margin-bottom: 2rem;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 1rem;
        }

        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .breadcrumb {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.9rem;
          color: #6b7280;
        }

        .breadcrumb-link {
          background: none;
          border: none;
          color: #3b82f6;
          cursor: pointer;
          text-decoration: none;
          font-size: inherit;
        }

        .breadcrumb-link:hover {
          text-decoration: underline;
        }

        .breadcrumb-separator {
          color: #d1d5db;
        }

        .workflow-summary {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .summary-card,
        .progress-card {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 1.5rem;
          background: white;
        }

        .summary-header,
        .progress-header {
          margin-bottom: 1rem;
          border-bottom: 1px solid #f3f4f6;
          padding-bottom: 0.75rem;
        }

        .summary-header h2,
        .progress-header h3 {
          margin: 0;
          font-size: 1.125rem;
          color: #1f2937;
        }

        .summary-content {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem 0;
        }

        .summary-row label {
          font-weight: 500;
          color: #6b7280;
        }

        .summary-row span {
          color: #1f2937;
        }

        .status-badge {
          display: inline-block;
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.875rem;
          font-weight: 500;
        }

        .status-badge.status-pending {
          background: #fef3c7;
          color: #92400e;
        }

        .status-badge.status-completed {
          background: #d1fae5;
          color: #065f46;
        }

        .status-badge.status-in_progress {
          background: #dbeafe;
          color: #0c4a6e;
        }

        .progress-bar {
          width: 100%;
          height: 8px;
          background: #e5e7eb;
          border-radius: 9999px;
          overflow: hidden;
          margin: 1rem 0;
        }

        .progress-fill {
          height: 100%;
          background: #10b981;
          transition: width 0.3s ease;
        }

        .progress-stats {
          text-align: center;
          font-size: 0.875rem;
          color: #6b7280;
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

        .table-responsive {
          overflow-x: auto;
        }

        .tasks-table {
          width: 100%;
          border-collapse: collapse;
        }

        .tasks-table thead {
          background: #f3f4f6;
        }

        .tasks-table th {
          padding: 0.75rem;
          text-align: left;
          font-weight: 600;
          color: #1f2937;
          font-size: 0.875rem;
          border-bottom: 1px solid #e5e7eb;
        }

        .tasks-table td {
          padding: 0.75rem;
          border-bottom: 1px solid #e5e7eb;
          font-size: 0.875rem;
          color: #374151;
        }

        .task-row:hover {
          background: #f9fafb;
        }

        .task-name {
          font-weight: 500;
          color: #1f2937;
        }

        .no-results {
          text-align: center;
          padding: 2rem;
          color: #6b7280;
        }

        .steps-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
        }

        .step-card {
          padding: 1rem;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          text-align: center;
        }

        .step-card.status-active {
          border-color: #10b981;
          background: #f0fdf4;
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
        }

        .step-date {
          font-size: 0.75rem;
          color: #9ca3af;
        }

        .loading-container,
        .error-container {
          text-align: center;
          padding: 3rem 2rem;
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
          .workflow-summary {
            grid-template-columns: 1fr;
          }

          .header-content {
            flex-direction: column;
            align-items: flex-start;
            gap: 1rem;
          }

          .filters-section {
            flex-direction: column;
          }

          .search-input {
            min-width: 100%;
          }

          .tasks-table {
            font-size: 0.75rem;
          }
        }
      `}</style>
    </Layout>
  );
}
