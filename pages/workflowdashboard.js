import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function WorkflowDashboard() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSpecialUser, setIsSpecialUser] = useState(false);
  const [projectID, setProjectID] = useState(null);

  // Form state for creating workflow
  const [processes, setProcesses] = useState([]);
  const [projects, setProjects] = useState([]);
  const [packages, setPackages] = useState([]);
  const [formData, setFormData] = useState({
    processId: '',
    projectId: '',
    packageId: '',
    status: 'Pending'
  });
  const [autoSelectEnabled, setAutoSelectEnabled] = useState(false);

  // Dashboard state
  const [allWorkflows, setAllWorkflows] = useState([]);
  const [filteredWorkflows, setFilteredWorkflows] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [processFilter, setProcessFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Pagination & Sorting
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState('HdrID');
  const [sortDirection, setSortDirection] = useState('asc');
  const rowsPerPage = 10;

  // UI State
  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmText, setConfirmText] = useState('');

  // Load initial data
  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  const checkAuthAndLoadData = async () => {
    try {
      // Check user session (you may need to adjust this based on your auth setup)
      const sessionRes = await fetch('/api/auth/session');
      if (sessionRes.ok) {
        const session = await sessionRes.json();
        setIsAdmin(session.usrAdmin || false);
        setIsSpecialUser(session.isSpecialUser || false);
        setProjectID(session.projectID || null);
      }

      // Load form data
      await Promise.all([
        loadProcesses(),
        loadProjects(),
        loadPackages(),
        loadWorkflowData()
      ]);
    } catch (err) {
      console.error('Failed to load data:', err);
      showToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadProcesses = async () => {
    try {
      const res = await fetch('/api/processes');
      if (res.ok) {
        const data = await res.json();
        setProcesses(data);
      }
    } catch (err) {
      console.error('Failed to load processes:', err);
    }
  };

  const loadProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
        
        // Auto-select project from login if enabled
        if (autoSelectEnabled && projectID) {
          setFormData(prev => ({ ...prev, projectId: projectID }));
        }
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  };

  const loadPackages = async () => {
    try {
      const res = await fetch('/api/packages');
      if (res.ok) {
        const data = await res.json();
        setPackages(data);
      }
    } catch (err) {
      console.error('Failed to load packages:', err);
    }
  };

  const loadWorkflowData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/workFlowDashData?t=${new Date().getTime()}`);
      if (res.ok) {
        let workflows = await res.json();
        
        // Filter to only Pending and Completed
        workflows = workflows.filter(w => w.Status === 'Pending' || w.Status === 'Completed');
        
        // Fetch payment steps for each workflow
        for (let workflow of workflows) {
          try {
            const paymentRes = await fetch(`/api/workflow-steps/${workflow.HdrID}`);
            if (paymentRes.ok) {
              workflow.paymentSteps = await paymentRes.json();
            } else {
              workflow.paymentSteps = [];
            }
          } catch (err) {
            console.error(`Failed to fetch payment steps for ${workflow.HdrID}:`, err);
            workflow.paymentSteps = [];
          }
        }
        
        setAllWorkflows(workflows);
        setFilteredWorkflows(workflows);
      }
    } catch (err) {
      console.error('Failed to load workflows:', err);
      showToast('Failed to load workflows', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === 'autoSelect') {
      setAutoSelectEnabled(checked);
      localStorage.setItem('autoSelectProject', checked);
      if (checked && projectID) {
        setFormData(prev => ({ ...prev, projectId: projectID }));
      }
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.processId || !formData.projectId || !formData.packageId) {
      showToast('All fields are required', 'error');
      return;
    }

    try {
      setFormLoading(true);
      const res = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processID: formData.processId,
          projectID: formData.projectId,
          packageID: formData.packageId,
          status: formData.status
        })
      });

      if (res.ok) {
        showToast('Workflow created successfully', 'success');
        setFormData({ processId: '', projectId: '', packageId: '', status: 'Pending' });
        await loadWorkflowData();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to create workflow', 'error');
      }
    } catch (err) {
      console.error('Error creating workflow:', err);
      showToast('Error creating workflow', 'error');
    } finally {
      setFormLoading(false);
    }
  };

  // Apply filters
  useEffect(() => {
    applyFilters();
  }, [searchQuery, processFilter, statusFilter, allWorkflows]);

  const applyFilters = () => {
    let filtered = allWorkflows.filter(workflow => {
      const matchesSearch = !searchQuery || 
        workflow.HdrID?.toString().includes(searchQuery) ||
        workflow.ProcessName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        workflow.PackageName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        workflow.ProjectName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        workflow.Status?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesProcess = !processFilter || workflow.ProcessName === processFilter;
      const matchesStatus = !statusFilter || workflow.Status === statusFilter;

      return matchesSearch && matchesProcess && matchesStatus;
    });

    setFilteredWorkflows(filtered);
    setCurrentPage(1);
  };

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const getSortedWorkflows = () => {
    const sorted = [...filteredWorkflows].sort((a, b) => {
      let valueA = a[sortColumn];
      let valueB = b[sortColumn];

      if (valueA === null || valueA === undefined) valueA = '';
      if (valueB === null || valueB === undefined) valueB = '';

      if (sortColumn === 'HdrID') {
        return sortDirection === 'asc' ? valueA - valueB : valueB - valueA;
      }

      if (sortColumn.includes('Date')) {
        const dateA = valueA ? new Date(valueA) : new Date(0);
        const dateB = valueB ? new Date(valueB) : new Date(0);
        return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
      }

      return sortDirection === 'asc'
        ? String(valueA).localeCompare(String(valueB))
        : String(valueB).localeCompare(String(valueA));
    });

    return sorted;
  };

  const paginatedWorkflows = (() => {
    const sorted = getSortedWorkflows();
    const startIdx = (currentPage - 1) * rowsPerPage;
    return sorted.slice(startIdx, startIdx + rowsPerPage);
  })();

  const totalPages = Math.ceil(filteredWorkflows.length / rowsPerPage);

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const dateOnly = dateStr.split('T')[0];
    const [year, month, day] = dateOnly.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getDisplayStatus = (workflow) => {
    if (workflow.paymentSteps && Array.isArray(workflow.paymentSteps) && workflow.paymentSteps.length > 0) {
      const completed = workflow.paymentSteps.filter(s => s.StepFinished).length;
      if (completed === workflow.paymentSteps.length) {
        return 'Completed';
      }
    }
    return workflow.Status;
  };

  const calculateStats = () => {
    const total = allWorkflows.length;
    const completed = allWorkflows.filter(w => w.Status === 'Completed').length;
    const pending = allWorkflows.filter(w => w.Status === 'Pending').length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, pending, rate };
  };

  const stats = calculateStats();

  const handleExport = () => {
    if (filteredWorkflows.length === 0) {
      showToast('No data to export', 'error');
      return;
    }

    const headers = ['HDR ID', 'Process', 'Package', 'Project', 'Status', 'Created Date', 'Start Date', 'Finished Date'];
    const rows = filteredWorkflows.map(w => [
      w.HdrID,
      w.ProcessName || '',
      w.PackageName || '',
      w.ProjectName || '',
      w.Status || '',
      w.createdDate || '',
      w.startDate || '',
      w.completionDate || ''
    ]);

    let csvContent = headers.join(',') + '\n';
    rows.forEach(row => {
      csvContent += row.map(f => `"${f.toString().replace(/"/g, '""')}"`).join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `workflows_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('Export completed successfully', 'success');
  };

  const handleNavigateToUserPage = (hdrId) => {
    router.push(`/userpage/${hdrId}`);
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div> Loading...</div>;
  }

  return (
    <>
      <Head>
        <title>Workflow Dashboard</title>
      </Head>

      <div className="workflow-dashboard">
        {/* Toast Notifications */}
        <div className="toast-container">
          {toasts.map(toast => (
            <div key={toast.id} className={`toast toast-${toast.type}`}>
              {toast.message}
            </div>
          ))}
        </div>

        {/* Confirmation Modal */}
        {showConfirmModal && (
          <div className="modal-overlay" onClick={() => setShowConfirmModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <h3>Confirm Action</h3>
              <p>{confirmText}</p>
              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={() => setShowConfirmModal(false)}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={() => {
                  confirmAction?.();
                  setShowConfirmModal(false);
                }}>
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Workflow Button Section */}
        {isSpecialUser && (
          <div className="admin-section">
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px' }}>
              <h1 style={{ margin: 0, flex: 1 }}>Workflows</h1>
              <button
                className="btn btn-primary"
                onClick={() => router.push('/add-workflow')}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <span style={{ fontSize: '18px' }}>⊕</span>
                Add New Workflow
              </button>
            </div>
          </div>
        )}

        {/* Dashboard Section */}
        <div className="dashboard">
          <h1>System Engineering Workflow Dashboard</h1>

          {/* Toolbar */}
          <div className="toolbar">
            <div className="search-box">
              <input
                type="text"
                placeholder="Search workflows..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            <button className="btn btn-outline" onClick={handleExport}>
              Export
            </button>
            <button
              className="btn btn-outline"
              onClick={() => {
                setSearchQuery('');
                setProcessFilter('');
                setStatusFilter('');
              }}
            >
              Reset
            </button>
            <button
              className="btn btn-outline"
              onClick={() => router.push('/login')}
            >
              Logout
            </button>

            {isSpecialUser && (
              <>
                <button
                  className="btn btn-outline"
                  onClick={() => router.push('/add-workflow')}
                >
                  Add Workflow
                </button>
                <button
                  className="btn btn-outline"
                  onClick={() => router.push('/subpackage')}
                >
                  Add Package
                </button>
              </>
            )}
          </div>

          {/* Stats */}
          <div className="stats-container">
            <div className="stat-card">
              <div className="stat-value">{stats.total}</div>
              <div className="stat-label">Total Workflows</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.completed}</div>
              <div className="stat-label">Completed</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.pending}</div>
              <div className="stat-label">Pending</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.rate}%</div>
              <div className="stat-label">Completion Rate</div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${stats.rate}%` }}></div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="filters">
            <div className="filter-group">
              <label>Process</label>
              <select value={processFilter} onChange={e => setProcessFilter(e.target.value)}>
                <option key="default" value="">All Processes</option>
                {processes.filter(p => p.NumberOfProcessID).map(p => (
                  <option key={`process-filter-${p.NumberOfProcessID}`} value={p.ProcessName}>
                    {p.ProcessName}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Status</label>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="table-responsive">
            {filteredWorkflows.length === 0 ? (
              <div className="no-results">
                <p>No workflows match your search criteria</p>
                <button
                  className="btn btn-outline"
                  onClick={() => {
                    setSearchQuery('');
                    setProcessFilter('');
                    setStatusFilter('');
                  }}
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <>
                <table>
                  <thead>
                    <tr>
                      <th onClick={() => handleSort('HdrID')} style={{ cursor: 'pointer' }}>
                        ID {sortColumn === 'HdrID' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th onClick={() => handleSort('ProcessName')} style={{ cursor: 'pointer' }}>
                        Process {sortColumn === 'ProcessName' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th onClick={() => handleSort('PackageName')} style={{ cursor: 'pointer' }}>
                        Package {sortColumn === 'PackageName' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th onClick={() => handleSort('ProjectName')} style={{ cursor: 'pointer' }}>
                        Project {sortColumn === 'ProjectName' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th onClick={() => handleSort('Status')} style={{ cursor: 'pointer' }}>
                        Status {sortColumn === 'Status' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th onClick={() => handleSort('createdDate')} style={{ cursor: 'pointer' }}>
                        Created {sortColumn === 'createdDate' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th onClick={() => handleSort('startDate')} style={{ cursor: 'pointer' }}>
                        Started {sortColumn === 'startDate' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th onClick={() => handleSort('completionDate')} style={{ cursor: 'pointer' }}>
                        Finished {sortColumn === 'completionDate' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th>Days</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedWorkflows.map(workflow => {
                      const displayStatus = getDisplayStatus(workflow);
                      return (
                        <tr key={workflow.HdrID} onClick={() => handleNavigateToUserPage(workflow.HdrID)} style={{ cursor: 'pointer' }}>
                          <td>{workflow.HdrID}</td>
                          <td>{workflow.ProcessName || '-'}</td>
                          <td>{workflow.PackageName || '-'}</td>
                          <td>{workflow.ProjectName || '-'}</td>
                          <td>
                            <span className={`status-badge status-${displayStatus?.toLowerCase()}`}>
                              {displayStatus}
                            </span>
                          </td>
                          <td>{formatDate(workflow.createdDate)}</td>
                          <td>{formatDate(workflow.startDate)}</td>
                          <td>{formatDate(workflow.completionDate)}</td>
                          <td>{workflow.DaysDone === 0 ? 1 : (workflow.DaysDone || '-')}</td>
                          <td onClick={e => e.stopPropagation()}>
                            <button
                              className="btn btn-sm btn-outline"
                              onClick={() => handleNavigateToUserPage(workflow.HdrID)}
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Pagination */}
                <div className="pagination">
                  <div className="page-info">
                    Showing {filteredWorkflows.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1} to{' '}
                    {Math.min(currentPage * rowsPerPage, filteredWorkflows.length)} of {filteredWorkflows.length} entries
                  </div>
                  <div className="page-controls">
                    <button
                      className="page-btn"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(1)}
                    >
                      « First
                    </button>
                    <button
                      className="page-btn"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    >
                      ‹ Prev
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(p => Math.abs(p - currentPage) <= 2 || p === 1 || p === totalPages)
                      .map((page, idx, arr) => (
                        <div key={page}>
                          {idx > 0 && arr[idx - 1] !== page - 1 && <span className="pagination-ellipsis">...</span>}
                          <button
                            className={`page-btn ${currentPage === page ? 'active' : ''}`}
                            onClick={() => setCurrentPage(page)}
                          >
                            {page}
                          </button>
                        </div>
                      ))}
                    <button
                      className="page-btn"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    >
                      Next ›
                    </button>
                    <button
                      className="page-btn"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(totalPages)}
                    >
                      Last »
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .workflow-dashboard {
          display: flex;
          flex-direction: column;
          gap: 2rem;
          padding: 2rem;
          max-width: 1400px;
          margin: 0 auto;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        .admin-section {
          background: white;
          padding: 2rem;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          margin-bottom: 2rem;
        }

        .admin-section h1 {
          margin: 0 0 1.5rem 0;
          font-size: 1.5rem;
          color: #1f2937;
        }

        form {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1.5rem;
          margin-bottom: 1.5rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .form-row {
          display: flex;
          gap: 1rem;
          align-items: flex-start;
        }

        .auto-select-toggle {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-top: 1.75rem;
        }

        .auto-select-toggle input {
          width: 20px;
          height: 20px;
          cursor: pointer;
        }

        .auto-select-toggle label {
          margin: 0;
          cursor: pointer;
          font-size: 0.875rem;
        }

        label {
          font-weight: 600;
          color: #374151;
          font-size: 0.875rem;
        }

        select, input {
          padding: 0.5rem;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          font-size: 0.875rem;
          font-family: inherit;
        }

        select:focus, input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        select:disabled {
          background-color: #f3f4f6;
          cursor: not-allowed;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background-color: #fef3c7;
          color: #92400e;
          border-radius: 4px;
          font-size: 0.875rem;
          width: fit-content;
        }

        .btn {
          padding: 0.5rem 1rem;
          border: none;
          border-radius: 4px;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary {
          background-color: #3b82f6;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background-color: #2563eb;
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-secondary {
          background-color: #e5e7eb;
          color: #374151;
        }

        .btn-secondary:hover {
          background-color: #d1d5db;
        }

        .btn-outline {
          background-color: white;
          color: #374151;
          border: 1px solid #d1d5db;
        }

        .btn-outline:hover {
          background-color: #f9fafb;
          border-color: #9ca3af;
        }

        .btn-sm {
          padding: 0.375rem 0.75rem;
          font-size: 0.8125rem;
        }

        .dashboard {
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .dashboard h1 {
          padding: 1.5rem;
          margin: 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          font-size: 1.5rem;
        }

        .toolbar {
          display: flex;
          gap: 1rem;
          padding: 1.5rem;
          border-bottom: 1px solid #e5e7eb;
          flex-wrap: wrap;
        }

        .search-box {
          flex: 1;
          min-width: 200px;
        }

        .search-box input {
          width: 100%;
          padding: 0.5rem;
          border: 1px solid #d1d5db;
          border-radius: 4px;
        }

        .stats-container {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          padding: 1.5rem;
          background-color: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
        }

        .stat-card {
          background: white;
          padding: 1rem;
          border-radius: 4px;
          border: 1px solid #e5e7eb;
        }

        .stat-value {
          font-size: 1.875rem;
          font-weight: bold;
          color: #1f2937;
        }

        .stat-label {
          font-size: 0.875rem;
          color: #6b7280;
          margin-top: 0.5rem;
        }

        .progress-bar {
          background-color: #e5e7eb;
          height: 4px;
          border-radius: 2px;
          margin-top: 0.5rem;
          overflow: hidden;
        }

        .progress-fill {
          background-color: #10b981;
          height: 100%;
          transition: width 0.3s ease;
        }

        .filters {
          display: flex;
          gap: 1rem;
          padding: 1.5rem;
          border-bottom: 1px solid #e5e7eb;
          flex-wrap: wrap;
        }

        .filter-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          min-width: 150px;
        }

        .filter-group label {
          font-size: 0.8125rem;
        }

        .filter-group select {
          min-width: 150px;
        }

        .table-responsive {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          padding: 1rem;
        }

        thead {
          background-color: #f3f4f6;
          border-bottom: 2px solid #e5e7eb;
        }

        th {
          padding: 0.75rem;
          text-align: left;
          font-weight: 600;
          font-size: 0.875rem;
          color: #374151;
          white-space: nowrap;
        }

        td {
          padding: 0.75rem;
          border-bottom: 1px solid #e5e7eb;
          font-size: 0.875rem;
          color: #1f2937;
        }

        tbody tr {
          transition: background-color 0.2s;
        }

        tbody tr:hover {
          background-color: #f9fafb;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.375rem 0.75rem;
          border-radius: 4px;
          font-size: 0.8125rem;
          font-weight: 600;
          width: fit-content;
        }

        .status-pending {
          background-color: #fef3c7;
          color: #92400e;
        }

        .status-completed {
          background-color: #d1fae5;
          color: #065f46;
        }

        .no-results {
          padding: 3rem;
          text-align: center;
          color: #6b7280;
        }

        .no-results p {
          margin: 0 0 1rem 0;
          font-size: 1rem;
        }

        .pagination {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem;
          border-top: 1px solid #e5e7eb;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .page-info {
          font-size: 0.875rem;
          color: #6b7280;
        }

        .page-controls {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .page-btn {
          padding: 0.375rem 0.75rem;
          border: 1px solid #d1d5db;
          background: white;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.8125rem;
          transition: all 0.2s;
        }

        .page-btn:hover:not(:disabled) {
          background-color: #f9fafb;
          border-color: #9ca3af;
        }

        .page-btn.active {
          background-color: #3b82f6;
          color: white;
          border-color: #3b82f6;
        }

        .page-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .pagination-ellipsis {
          padding: 0 0.25rem;
          color: #6b7280;
        }

        .toast-container {
          position: fixed;
          top: 1rem;
          right: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          z-index: 1000;
        }

        .toast {
          padding: 1rem;
          border-radius: 4px;
          animation: slideIn 0.3s ease;
        }

        .toast-success {
          background-color: #d1fae5;
          color: #065f46;
          border-left: 4px solid #10b981;
        }

        .toast-error {
          background-color: #fee2e2;
          color: #991b1b;
          border-left: 4px solid #ef4444;
        }

        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 999;
        }

        .modal {
          background: white;
          padding: 2rem;
          border-radius: 8px;
          max-width: 400px;
          width: 90%;
          box-shadow: 0 20px 25px rgba(0, 0, 0, 0.15);
        }

        .modal h3 {
          margin: 0 0 1rem 0;
          color: #1f2937;
        }

        .modal p {
          margin: 0 0 1.5rem 0;
          color: #6b7280;
        }

        .modal-actions {
          display: flex;
          gap: 1rem;
          justify-content: flex-end;
        }

        .loading {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 400px;
          color: #6b7280;
          gap: 1rem;
        }

        .spinner {
          width: 32px;
          height: 32px;
          border: 3px solid #e5e7eb;
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 768px) {
          .workflow-dashboard {
            padding: 1rem;
          }

          form {
            grid-template-columns: 1fr;
          }

          .toolbar {
            flex-direction: column;
          }

          .search-box {
            min-width: auto;
          }

          .stats-container {
            grid-template-columns: 1fr 1fr;
          }

          .filters {
            flex-direction: column;
          }

          .filter-group {
            min-width: auto;
          }

          table {
            font-size: 0.75rem;
          }

          th, td {
            padding: 0.5rem 0.25rem;
          }

          .pagination {
            flex-direction: column;
            gap: 1rem;
          }

          .page-controls {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </>
  );
}
