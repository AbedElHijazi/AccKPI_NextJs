import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAdminAuth } from '@/lib/hooks';

export default function ProcessesPage() {
  const router = useRouter();
  const { user, loading } = useAdminAuth();
  
  const [processes, setProcesses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [selectedDepts, setSelectedDepts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    ProcessName: '',
    processDesc: '',
  });
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  async function fetchData() {
    try {
      const [procRes, deptRes] = await Promise.all([
        fetch('/api/processes'),
        fetch('/api/departments'),
      ]);

      if (procRes.ok) {
        const procData = await procRes.json();
        setProcesses(Array.isArray(procData) ? procData : procData.processes || []);
      }

      if (deptRes.ok) {
        const deptData = await deptRes.json();
        setDepartments(Array.isArray(deptData) ? deptData : deptData.departments || []);
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setErrorMsg('Failed to load data');
    } finally {
      setLoadingData(false);
    }
  }

  const handleDeptToggle = (deptId) => {
    setSelectedDepts(prev => {
      if (prev.includes(deptId)) {
        return prev.filter(id => id !== deptId);
      } else {
        return [...prev, deptId];
      }
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!formData.ProcessName.trim()) {
      setErrorMsg('Process name is required');
      return;
    }

    try {
      const payload = {
        ...formData,
        Departments: selectedDepts,
      };

      console.log('Submitting payload:', payload);

      const res = await fetch('/api/processes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      console.log('Response status:', res.status);
      const responseData = await res.json();
      console.log('Response data:', responseData);

      if (res.ok) {
        setSuccessMsg('Process created successfully!');
        setFormData({ ProcessName: '', processDesc: '' });
        setSelectedDepts([]);
        setShowForm(false);
        await fetchData();
      } else {
        setErrorMsg(responseData.error || 'Failed to create process');
      }
    } catch (err) {
      console.error('Failed to create process:', err);
      setErrorMsg('Failed to create process: ' + err.message);
    }
  };

  const handleDelete = async (processId) => {
    if (!window.confirm('Are you sure you want to delete this process?')) return;

    try {
      console.log('Deleting process:', processId);
      const res = await fetch(`/api/processes/${processId}`, {
        method: 'DELETE',
      });

      console.log('Delete response status:', res.status);
      const responseData = await res.json();
      console.log('Delete response:', responseData);

      if (res.ok) {
        setSuccessMsg('Process deleted successfully!');
        setTimeout(() => setSuccessMsg(''), 3000);
        await fetchData();
      } else {
        setErrorMsg(responseData.error || 'Failed to delete process');
        setTimeout(() => setErrorMsg(''), 5000);
      }
    } catch (err) {
      console.error('Failed to delete process:', err);
      setErrorMsg('Failed to delete process: ' + err.message);
      setTimeout(() => setErrorMsg(''), 5000);
    }
  };

  if (loading || loadingData) {
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
          --danger: #dc3545;
          --success: #28a745;
          --warning: #ffc107;
          --info: #17a2b8;
          --light: #f8f9fa;
          --dark: #343a40;
          --border: #dee2e6;
          --shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
          --transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
          background-color: #f5f7fa;
          color: #333;
        }

        .processes-container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 2rem;
        }

        .processes-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
          padding-bottom: 1.5rem;
          border-bottom: 3px solid var(--primary);
        }

        .processes-header h1 {
          font-size: 2rem;
          color: var(--primary);
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .processes-header h1 i {
          font-size: 2.2rem;
        }

        .btn-add {
          padding: 0.75rem 1.5rem;
          background-color: var(--primary);
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.95rem;
          font-weight: 600;
          transition: var(--transition);
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .btn-add:hover {
          background-color: #0049a8;
          transform: translateY(-2px);
          box-shadow: var(--shadow);
        }

        .alert {
          padding: 1rem 1.25rem;
          border-radius: 6px;
          margin-bottom: 1.5rem;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-weight: 500;
        }

        .alert-success {
          background-color: #d4edda;
          border: 1px solid #c3e6cb;
          color: #155724;
        }

        .alert-danger {
          background-color: #f8d7da;
          border: 1px solid #f5c6cb;
          color: #721c24;
        }

        .alert i {
          font-size: 1.2rem;
        }

        .form-card {
          background: white;
          border-radius: 8px;
          padding: 2rem;
          margin-bottom: 2rem;
          box-shadow: var(--shadow);
          border: 1px solid var(--border);
        }

        .form-card h2 {
          color: var(--primary);
          margin-bottom: 1.5rem;
          font-size: 1.5rem;
        }

        .form-group {
          margin-bottom: 1.5rem;
        }

        .form-group label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 600;
          color: #333;
          font-size: 0.95rem;
        }

        .form-group input,
        .form-group textarea {
          width: 100%;
          padding: 0.75rem 1rem;
          border: 1px solid var(--border);
          border-radius: 6px;
          font-size: 0.95rem;
          font-family: inherit;
          transition: var(--transition);
        }

        .form-group input:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: var(--primary);
          box-shadow: 0 0 0 3px rgba(0, 91, 171, 0.1);
          background-color: #f9fafb;
        }

        .form-group textarea {
          resize: vertical;
          min-height: 100px;
        }

        .departments-selection {
          margin: 1.5rem 0;
        }

        .departments-selection h4 {
          margin-bottom: 1rem;
          color: #333;
          font-size: 0.95rem;
        }

        .dept-checkbox-group {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 1rem;
        }

        .dept-checkbox-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
          padding: 0.75rem;
          border-radius: 6px;
          border: 1px solid var(--border);
          transition: var(--transition);
        }

        .dept-checkbox-label:hover {
          border-color: var(--primary);
          background-color: #f9fafb;
        }

        .dept-checkbox-label input {
          cursor: pointer;
        }

        .form-actions {
          display: flex;
          gap: 1rem;
          margin-top: 2rem;
          justify-content: flex-end;
        }

        .btn {
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.95rem;
          font-weight: 600;
          transition: var(--transition);
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .btn-primary {
          background-color: var(--primary);
          color: white;
        }

        .btn-primary:hover {
          background-color: #0049a8;
          transform: translateY(-2px);
          box-shadow: var(--shadow);
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
          padding: 0.5rem 1rem;
          font-size: 0.85rem;
        }

        .btn-danger:hover {
          background-color: #c82333;
          transform: translateY(-2px);
          box-shadow: 0 2px 8px rgba(220, 53, 69, 0.3);
        }

        .processes-table-card {
          background: white;
          border-radius: 8px;
          padding: 2rem;
          box-shadow: var(--shadow);
          border: 1px solid var(--border);
        }

        .processes-table-card h2 {
          color: var(--primary);
          margin-bottom: 1.5rem;
          font-size: 1.5rem;
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 1rem;
        }

        .table thead {
          background-color: var(--light);
          border-bottom: 2px solid var(--border);
        }

        .table thead th {
          padding: 1rem;
          text-align: left;
          font-weight: 600;
          color: #333;
          font-size: 0.9rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .table tbody tr {
          border-bottom: 1px solid var(--border);
          transition: var(--transition);
        }

        .table tbody tr:hover {
          background-color: #f9fafb;
        }

        .table tbody td {
          padding: 1rem;
          color: #555;
          font-size: 0.95rem;
        }

        .table tbody td.process-id {
          font-weight: 600;
          color: var(--primary);
          font-size: 0.9rem;
        }

        .table tbody td.process-name {
          font-weight: 500;
          color: #333;
        }

        .steps-list {
          margin-top: 0.5rem;
        }

        .steps-list ol {
          margin-left: 1.5rem;
          padding: 0.5rem 0;
          font-size: 0.9rem;
        }

        .steps-list li {
          margin: 0.25rem 0;
          color: #555;
        }

        .no-steps {
          color: #999;
          font-style: italic;
          font-size: 0.9rem;
        }

        .table-actions {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .empty-state {
          text-align: center;
          padding: 3rem 2rem;
          color: #999;
        }

        .empty-state i {
          font-size: 3rem;
          margin-bottom: 1rem;
          color: #ddd;
        }

        .empty-state h3 {
          color: #666;
          margin: 1rem 0;
        }

        .empty-state p {
          color: #999;
          margin: 0.5rem 0;
        }

        @media (max-width: 768px) {
          .processes-container {
            padding: 1rem;
          }

          .processes-header {
            flex-direction: column;
            gap: 1rem;
            align-items: flex-start;
          }

          .btn-add {
            width: 100%;
            justify-content: center;
          }

          .dept-checkbox-group {
            grid-template-columns: 1fr;
          }

          .table {
            font-size: 0.85rem;
          }

          .table tbody td {
            padding: 0.75rem 0.5rem;
          }

          .table-actions {
            flex-direction: column;
          }

          .btn-danger {
            width: 100%;
          }
        }
      `}</style>

      <div className="processes-container">
        {/* Header */}
        <div className="processes-header">
          <h1>
            <i className="fas fa-cogs"></i>
            Process Management
          </h1>
          <button className="btn-add" onClick={() => setShowForm(!showForm)}>
            <i className="fas fa-plus"></i>
            {showForm ? 'Cancel' : 'New Process'}
          </button>
        </div>

        {/* Alerts */}
        {successMsg && (
          <div className="alert alert-success">
            <i className="fas fa-check-circle"></i>
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="alert alert-danger">
            <i className="fas fa-exclamation-circle"></i>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Create Form */}
        {showForm && (
          <div className="form-card">
            <h2>Create New Process</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="ProcessName">Process Name *</label>
                <input
                  type="text"
                  id="ProcessName"
                  name="ProcessName"
                  value={formData.ProcessName}
                  onChange={handleInputChange}
                  placeholder="e.g. Employee Onboarding"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="processDesc">Description (Optional)</label>
                <textarea
                  id="processDesc"
                  name="processDesc"
                  value={formData.processDesc}
                  onChange={handleInputChange}
                  placeholder="Describe this process..."
                />
              </div>

              <div className="departments-selection">
                <h4>Select Departments for Workflow Steps (Optional)</h4>
                <div className="dept-checkbox-group">
                  {departments.length > 0 ? (
                    departments.map(dept => (
                      <label key={dept.DepartmentID} className="dept-checkbox-label">
                        <input
                          type="checkbox"
                          checked={selectedDepts.includes(dept.DepartmentID)}
                          onChange={() => handleDeptToggle(dept.DepartmentID)}
                        />
                        <span>{dept.DeptName}</span>
                      </label>
                    ))
                  ) : (
                    <p style={{ color: '#999', fontSize: '0.9rem' }}>No departments available</p>
                  )}
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => {
                  setShowForm(false);
                  setFormData({ ProcessName: '', processDesc: '' });
                  setSelectedDepts([]);
                }}>
                  <i className="fas fa-times"></i>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  <i className="fas fa-save"></i>
                  Save Process
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Processes Table */}
        <div className="processes-table-card">
          <h2>
            <i className="fas fa-list"></i>
            All Processes
          </h2>

          {processes.length === 0 ? (
            <div className="empty-state">
              <i className="fas fa-inbox"></i>
              <h3>No Processes Found</h3>
              <p>Create your first process by clicking the "New Process" button above.</p>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: '10%' }}>ID</th>
                  <th style={{ width: '20%' }}>Name</th>
                  <th style={{ width: '25%' }}>Description</th>
                  <th style={{ width: '30%' }}>Workflow Steps</th>
                  <th style={{ width: '15%' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {processes.map(process => (
                  <tr key={process.NumberOfProccessID}>
                    <td className="process-id">{process.NumberOfProccessID}</td>
                    <td className="process-name">{process.ProcessName}</td>
                    <td>{process.processDesc || '—'}</td>
                    <td>
                      {process.steps && process.steps.length > 0 ? (
                        <div className="steps-list">
                          <ol>
                            {process.steps.map((step, idx) => (
                              <li key={idx}>
                                Step {step.StepOrder}: {step.DeptName}
                              </li>
                            ))}
                          </ol>
                        </div>
                      ) : (
                        <span className="no-steps">No steps configured</span>
                      )}
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="btn btn-danger"
                          onClick={() => handleDelete(process.NumberOfProccessID)}
                        >
                          <i className="fas fa-trash"></i>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
