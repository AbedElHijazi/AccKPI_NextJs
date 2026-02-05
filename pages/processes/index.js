import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAdminAuth } from '@/lib/hooks';

export default function ProcessesPage() {
  const router = useRouter();
  const { user, loading } = useAdminAuth();
  
  // State Management
  const [processes, setProcesses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState([]);
  const [formData, setFormData] = useState({
    ProcessName: '',
    processDesc: '',
  });
  
  // Toast Management
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);
  
  // Modal Management
  const [modalState, setModalState] = useState({
    isOpen: false,
    message: '',
    onConfirm: null,
  });
  
  // Loading Overlay
  const [isLoading, setIsLoading] = useState(false);
  
  // Validation Errors
  const [errors, setErrors] = useState({
    ProcessName: false,
    Departments: false,
  });
  
  // Drag & Drop
  const [draggedItem, setDraggedItem] = useState(null);

  // Toast Functions
  const showToast = (type, title, message, duration = 5000) => {
    const id = toastIdRef.current++;
    const toast = { id, type, title, message };
    setToasts(prev => [...prev, toast]);
    
    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }
    return id;
  };

  const hideToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Modal Functions
  const showConfirmation = (message, onConfirm) => {
    setModalState({
      isOpen: true,
      message,
      onConfirm,
    });
  };

  const closeModal = () => {
    setModalState({
      isOpen: false,
      message: '',
      onConfirm: null,
    });
  };

  const handleModalConfirm = async () => {
    if (modalState.onConfirm) {
      await modalState.onConfirm();
      closeModal();
    }
  };

  // Loading Functions
  const setLoadingOverlay = (show) => {
    setIsLoading(show);
  };

  // Validation Functions
  const validateForm = () => {
    let isValid = true;
    const newErrors = { ...errors };

    if (!formData.ProcessName.trim()) {
      newErrors.ProcessName = true;
      isValid = false;
    } else {
      newErrors.ProcessName = false;
    }

    if (selectedOrder.length === 0) {
      newErrors.Departments = true;
      isValid = false;
    } else {
      newErrors.Departments = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  // Data Fetching
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
      showToast('error', 'Error', 'Failed to load data', 5000);
    } finally {
      setLoadingData(false);
    }
  }

  // Department Management
  const handleDeptToggle = (deptId) => {
    setSelectedOrder(prev => {
      if (prev.includes(deptId)) {
        return prev.filter(id => id !== deptId);
      } else {
        return [...prev, deptId];
      }
    });
  };

  // Form Handling
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error on input
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: false
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      showToast('error', 'Validation Error', 'Please fill all required fields', 5000);
      return;
    }

    setLoadingOverlay(true);

    try {
      const payload = {
        ...formData,
        Departments: selectedOrder,
      };

      const res = await fetch('/api/processes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const responseData = await res.json();

      if (res.ok) {
        setLoadingOverlay(false);
        showToast('success', 'Success', 'Process created successfully', 4000);
        setFormData({ ProcessName: '', processDesc: '' });
        setSelectedOrder([]);
        setTimeout(() => fetchData(), 500);
      } else {
        setLoadingOverlay(false);
        showToast('error', 'Error', responseData.error || 'Failed to create process', 5000);
      }
    } catch (err) {
      setLoadingOverlay(false);
      showToast('error', 'Error', 'Failed to create process: ' + err.message, 5000);
    }
  };

  const handleDelete = async (processId) => {
    showConfirmation(
      'Are you sure you want to delete this process? This action cannot be undone.',
      async () => {
        setLoadingOverlay(true);
        
        // Just show success immediately for now
        setLoadingOverlay(false);
        showToast('success', 'Test', 'Delete endpoint called for process ' + processId, 3000);
      }
    );
  };

  const handleAddTask = (processId, processName, steps) => {
    if (!steps || steps.length === 0) {
      showToast('warning', 'No Steps Defined', 'This process has no workflow steps. Please add steps before creating tasks.', 5000);
      return;
    }

    const encodedName = encodeURIComponent(processName);
    router.push(`/add-task?processId=${processId}&process=${encodedName}`);
  };

  const handleResetForm = () => {
    if (formData.ProcessName || formData.processDesc || selectedOrder.length > 0) {
      showConfirmation(
        'Are you sure you want to clear the form? All entered data will be lost.',
        () => {
          setFormData({ ProcessName: '', processDesc: '' });
          setSelectedOrder([]);
          setErrors({ ProcessName: false, Departments: false });
          showToast('info', 'Form Cleared', 'All fields have been reset', 3000);
        }
      );
    } else {
      setFormData({ ProcessName: '', processDesc: '' });
      setSelectedOrder([]);
    }
  };

  // Drag and Drop Handlers
  const handleDragStart = (e, index) => {
    setDraggedItem(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    if (draggedItem === null || draggedItem === targetIndex) return;

    const newOrder = [...selectedOrder];
    const draggedDept = newOrder[draggedItem];
    newOrder.splice(draggedItem, 1);
    newOrder.splice(targetIndex, 0, draggedDept);
    setSelectedOrder(newOrder);
    setDraggedItem(null);
    showToast('success', 'Reordered', 'Workflow steps have been updated', 2000);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
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
          --primary-dark: #0049a8;
          --primary-light: #e8f1f8;
          --danger: #dc3545;
          --success: #10b981;
          --warning: #f59e0b;
          --info: #3b82f6;
          --light: #f8f9fa;
          --dark: #343a40;
          --border: #dee2e6;
          --shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
          --shadow-md: 0 8px 20px rgba(0, 0, 0, 0.1);
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

        .processes-wrapper {
          min-height: 100vh;
          background-color: #f5f7fa;
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

        .form-card {
          background: white;
          border-radius: 8px;
          padding: 2rem;
          margin-bottom: 2rem;
          box-shadow: var(--shadow);
          border: 1px solid var(--border);
          animation: slideInDown 0.3s ease-out;
        }

        .form-card h2 {
          color: var(--primary);
          margin-bottom: 1.5rem;
          font-size: 1.5rem;
          display: flex;
          align-items: center;
          gap: 0.75rem;
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

        .form-group label .required {
          color: var(--danger);
        }

        .form-group input,
        .form-group textarea {
          width: 100%;
          padding: 0.75rem 1rem;
          border: 2px solid var(--border);
          border-radius: 6px;
          font-size: 0.95rem;
          font-family: inherit;
          transition: var(--transition);
          background-color: #f9fafb;
        }

        .form-group input:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: var(--primary);
          box-shadow: 0 0 0 3px rgba(0, 91, 171, 0.1);
          background-color: white;
        }

        .form-group input.error,
        .form-group textarea.error {
          border-color: var(--danger);
          background-color: rgba(220, 53, 69, 0.05);
        }

        .form-group textarea {
          resize: vertical;
          min-height: 100px;
        }

        .error-message {
          color: var(--danger);
          font-size: 0.85rem;
          margin-top: 0.25rem;
          display: none;
        }

        .error-message.show {
          display: block;
        }

        .help-text {
          color: #666;
          font-size: 0.85rem;
          margin-top: 0.5rem;
          line-height: 1.4;
        }

        .departments-section {
          margin: 2rem 0;
          padding: 1.5rem;
          background-color: var(--primary-light);
          border-radius: 8px;
          border: 1px solid #c7d9e8;
        }

        .departments-section h3 {
          color: var(--primary);
          margin-bottom: 1rem;
          font-size: 1.05rem;
          font-weight: 600;
        }

        .dept-checkbox-group {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .dept-checkbox-label {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          cursor: pointer;
          padding: 0.75rem 1rem;
          border-radius: 6px;
          border: 2px solid transparent;
          background-color: white;
          transition: var(--transition);
          font-weight: 500;
        }

        .dept-checkbox-label:hover {
          border-color: var(--primary);
          background-color: #f0f7ff;
        }

        .dept-checkbox-label input {
          cursor: pointer;
          width: 18px;
          height: 18px;
        }

        .steps-display {
          margin-top: 1.5rem;
          padding: 1rem;
          background-color: white;
          border-radius: 6px;
          border: 2px dashed var(--border);
          min-height: 60px;
        }

        .steps-display.empty {
          color: #999;
          font-style: italic;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .steps-display h4 {
          color: var(--primary);
          margin-bottom: 1rem;
          font-size: 0.95rem;
        }

        .steps-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .step-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem;
          background-color: #f9fafb;
          border-radius: 6px;
          border: 1px solid var(--border);
          transition: var(--transition);
          cursor: move;
        }

        .step-item.dragging {
          opacity: 0.5;
          background-color: var(--primary-light);
          border-color: var(--primary);
        }

        .step-item:hover {
          background-color: white;
          box-shadow: var(--shadow);
          border-color: var(--primary);
        }

        .step-number {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          background-color: var(--primary);
          color: white;
          border-radius: 50%;
          font-weight: 600;
          flex-shrink: 0;
          font-size: 0.9rem;
        }

        .step-name {
          flex: 1;
          font-weight: 500;
          color: #333;
        }

        .drag-handle {
          cursor: grab;
          color: #999;
          font-size: 1.2rem;
          padding: 0.25rem 0.5rem;
          transition: var(--transition);
        }

        .drag-handle:hover {
          color: var(--primary);
        }

        .step-item.dragging .drag-handle {
          cursor: grabbing;
          color: var(--primary);
        }

        .departments-error {
          color: var(--danger);
          font-size: 0.85rem;
          margin-top: 0.5rem;
          display: none;
        }

        .departments-error.show {
          display: block;
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
          background-color: var(--primary-dark);
          transform: translateY(-2px);
          box-shadow: var(--shadow);
        }

        .btn-secondary {
          background-color: #6c757d;
          color: white;
        }

        .btn-secondary:hover {
          background-color: #5a6268;
          transform: translateY(-2px);
          box-shadow: var(--shadow);
        }

        .btn-danger {
          background-color: var(--danger);
          color: white;
          padding: 0.6rem 1.2rem;
          font-size: 0.85rem;
        }

        .btn-danger:hover {
          background-color: #c82333;
          transform: translateY(-2px);
          box-shadow: 0 2px 8px rgba(220, 53, 69, 0.3);
        }

        .btn-success {
          background-color: var(--success);
          color: white;
          padding: 0.6rem 1.2rem;
          font-size: 0.85rem;
        }

        .btn-success:hover {
          background-color: #059669;
          transform: translateY(-2px);
          box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
        }

        .table-actions {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .processes-table-card {
          background: white;
          border-radius: 8px;
          padding: 2rem;
          box-shadow: var(--shadow);
          border: 1px solid var(--border);
          animation: slideInUp 0.3s ease-out;
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

        .steps-column {
          font-size: 0.9rem;
        }

        .steps-column ol {
          margin-left: 1.5rem;
          padding: 0;
        }

        .steps-column li {
          margin: 0.25rem 0;
          color: #555;
        }

        .no-steps {
          color: #999;
          font-style: italic;
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
          font-size: 1.3rem;
        }

        .empty-state p {
          color: #999;
          margin: 0.5rem 0;
        }

        /* Toast Container */
        .toast-container {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          gap: 10px;
          max-width: 400px;
        }

        .toast {
          padding: 16px 20px;
          border-radius: 8px;
          box-shadow: var(--shadow-md);
          display: flex;
          align-items: flex-start;
          gap: 12px;
          animation: slideInRight 0.3s ease-out;
          background-color: white;
          border-left: 4px solid var(--info);
          word-break: break-word;
        }

        .toast.success {
          border-left-color: var(--success);
        }

        .toast.error {
          border-left-color: var(--danger);
        }

        .toast.warning {
          border-left-color: var(--warning);
        }

        .toast.info {
          border-left-color: var(--info);
        }

        .toast-icon {
          font-size: 20px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
        }

        .toast.success .toast-icon {
          color: var(--success);
        }

        .toast.error .toast-icon {
          color: var(--danger);
        }

        .toast.warning .toast-icon {
          color: var(--warning);
        }

        .toast.info .toast-icon {
          color: var(--info);
        }

        .toast-content {
          flex: 1;
        }

        .toast-title {
          font-weight: 600;
          margin-bottom: 4px;
          color: #333;
        }

        .toast-message {
          font-size: 14px;
          color: #666;
          line-height: 1.3;
        }

        .toast-close {
          background: none;
          border: none;
          font-size: 18px;
          cursor: pointer;
          color: #999;
          padding: 0;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: var(--transition);
        }

        .toast-close:hover {
          color: #333;
          transform: scale(1.2);
        }

        /* Modal Overlay */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.5);
          display: none;
          align-items: center;
          justify-content: center;
          z-index: 10000;
        }

        .modal-overlay.active {
          display: flex;
        }

        .modal {
          background-color: white;
          border-radius: 8px;
          box-shadow: var(--shadow-md);
          width: 90%;
          max-width: 500px;
          padding: 0;
          overflow: hidden;
          animation: scaleIn 0.3s ease-out;
        }

        .modal-header {
          padding: 1.5rem;
          border-bottom: 2px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .modal-header h3 {
          margin: 0;
          font-size: 1.25rem;
          color: #333;
        }

        .modal-close {
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          color: #999;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: var(--transition);
        }

        .modal-close:hover {
          color: #333;
          transform: scale(1.1);
        }

        .modal-body {
          padding: 1.5rem;
          color: #555;
          line-height: 1.5;
        }

        .modal-footer {
          padding: 1rem 1.5rem;
          border-top: 1px solid var(--border);
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
        }

        .modal-footer .btn {
          padding: 0.6rem 1.2rem;
          font-size: 0.9rem;
        }

        /* Loading Overlay */
        .loading-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(255, 255, 255, 0.8);
          display: none;
          align-items: center;
          justify-content: center;
          z-index: 9998;
          backdrop-filter: blur(2px);
        }

        .loading-overlay.active {
          display: flex;
        }

        .loading-spinner {
          width: 48px;
          height: 48px;
          border: 4px solid var(--primary-light);
          border-top: 4px solid var(--primary);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        /* Animations */
        @keyframes slideInDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(100px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        /* Responsive */
        @media (max-width: 768px) {
          .processes-container {
            padding: 1rem;
          }

          .processes-header {
            flex-direction: column;
            gap: 1rem;
            align-items: flex-start;
          }

          .form-card,
          .processes-table-card {
            padding: 1.5rem;
          }

          .dept-checkbox-group {
            grid-template-columns: 1fr;
          }

          .form-actions {
            flex-direction: column;
          }

          .btn {
            width: 100%;
            justify-content: center;
          }

          .table {
            font-size: 0.85rem;
          }

          .table thead th,
          .table tbody td {
            padding: 0.75rem 0.5rem;
          }

          .modal {
            width: 95%;
          }

          .toast-container {
            max-width: 90vw;
            right: 5vw;
            left: auto;
          }
        }
      `}</style>

      {/* Toast Container */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            <div className="toast-icon">
              {toast.type === 'success' && <i className="fas fa-check-circle"></i>}
              {toast.type === 'error' && <i className="fas fa-exclamation-circle"></i>}
              {toast.type === 'warning' && <i className="fas fa-exclamation-triangle"></i>}
              {toast.type === 'info' && <i className="fas fa-info-circle"></i>}
            </div>
            <div className="toast-content">
              <div className="toast-title">{toast.title}</div>
              <div className="toast-message">{toast.message}</div>
            </div>
            <button className="toast-close" onClick={() => hideToast(toast.id)}>
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Modal Overlay */}
      <div className={`modal-overlay ${modalState.isOpen ? 'active' : ''}`} style={{
        display: modalState.isOpen ? 'flex' : 'none',
      }}>
        <div className="modal" style={{
          display: 'block',
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
          maxWidth: '500px',
          width: '90%',
        }}>
          <div className="modal-header" style={{
            marginBottom: '15px',
            paddingBottom: '15px',
            borderBottom: '1px solid #ddd',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <h3 style={{ margin: 0 }}>Confirm Action</h3>
            <button className="modal-close" onClick={closeModal} style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#999',
            }}>
              ×
            </button>
          </div>
          <div className="modal-body" style={{
            marginBottom: '15px',
            color: '#555',
            fontSize: '14px',
            lineHeight: '1.6',
            minHeight: '60px',
          }}>
            {modalState.message}
          </div>
          <div className="modal-footer" style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            paddingTop: '15px',
            borderTop: '1px solid #ddd',
          }}>
            <button className="btn btn-secondary" onClick={closeModal} style={{
              padding: '8px 16px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleModalConfirm} style={{
              padding: '8px 16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}>
              Confirm
            </button>
          </div>
        </div>
      </div>

      {/* Loading Overlay */}
      <div className={`loading-overlay ${isLoading ? 'active' : ''}`}>
        <div className="loading-spinner"></div>
      </div>

      {/* Main Content */}
      <div className="processes-wrapper">
        <div className="processes-container">
          {/* Header */}
          <div className="processes-header">
            <h1>
              <i className="fas fa-cogs"></i>
              Process Management
            </h1>
          </div>

          {/* Create Process Form */}
          <div className="form-card">
            <h2>
              <i className="fas fa-plus-circle"></i>
              Create New Process
            </h2>

            <form onSubmit={handleSubmit}>
              {/* Process Name */}
              <div className="form-group">
                <label htmlFor="ProcessName">
                  Process Name <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="ProcessName"
                  name="ProcessName"
                  value={formData.ProcessName}
                  onChange={handleInputChange}
                  placeholder="e.g. Employee Onboarding, Purchase Approval"
                  className={errors.ProcessName ? 'error' : ''}
                />
                {errors.ProcessName && (
                  <div className="error-message show">Please enter a process name</div>
                )}
                <div className="help-text">Give your process a clear, descriptive name that identifies its purpose.</div>
              </div>

              {/* Description */}
              <div className="form-group">
                <label htmlFor="processDesc">
                  Description (Optional)
                </label>
                <textarea
                  id="processDesc"
                  name="processDesc"
                  value={formData.processDesc}
                  onChange={handleInputChange}
                  placeholder="Briefly describe what this process is for..."
                />
                <div className="help-text">Add additional details about the process scope and objectives.</div>
              </div>

              {/* Departments Section */}
              <div className="departments-section">
                <h3>
                  <i className="fas fa-sitemap"></i>
                  Workflow Departments
                </h3>

                <div className="dept-checkbox-group">
                  {departments.length > 0 ? (
                    departments.map(dept => (
                      <label key={dept.DepartmentID} className="dept-checkbox-label">
                        <input
                          type="checkbox"
                          checked={selectedOrder.includes(dept.DepartmentID)}
                          onChange={() => handleDeptToggle(dept.DepartmentID)}
                        />
                        <span>{dept.DeptName}</span>
                      </label>
                    ))
                  ) : (
                    <div style={{ gridColumn: '1 / -1', color: '#999', fontSize: '0.9rem' }}>
                      No departments available
                    </div>
                  )}
                </div>

                <div className="help-text">
                  Select the departments that will be involved in this workflow. You can drag departments below to reorder the workflow steps.
                </div>

                {/* Steps Display */}
                <div className={`steps-display ${selectedOrder.length === 0 ? 'empty' : ''}`}>
                  {selectedOrder.length === 0 ? (
                    <span>No departments selected yet. Workflow steps will appear here.</span>
                  ) : (
                    <>
                      <h4>📋 Workflow Steps (Drag to reorder)</h4>
                      <div className="steps-list">
                        {selectedOrder.map((deptId, idx) => {
                          const dept = departments.find(d => d.DepartmentID === deptId);
                          return (
                            <div
                              key={deptId}
                              className={`step-item ${draggedItem === idx ? 'dragging' : ''}`}
                              draggable
                              onDragStart={(e) => handleDragStart(e, idx)}
                              onDragOver={handleDragOver}
                              onDrop={(e) => handleDrop(e, idx)}
                              onDragEnd={handleDragEnd}
                            >
                              <div className="step-number">{idx + 1}</div>
                              <div className="step-name">{dept?.DeptName || 'Unknown'}</div>
                              <div className="drag-handle" title="Drag to reorder">☰</div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

                {errors.Departments && (
                  <div className="departments-error show">Please select at least one department</div>
                )}
              </div>

              {/* Form Actions */}
              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleResetForm}
                >
                  <i className="fas fa-redo"></i>
                  Clear Form
                </button>
                <button type="submit" className="btn btn-primary">
                  <i className="fas fa-save"></i>
                  Save Process
                </button>
              </div>
            </form>
          </div>

          {/* Processes Table */}
          <div className="processes-table-card">
            <h2>
              <i className="fas fa-list"></i>
              Existing Processes
            </h2>

            {processes.length === 0 ? (
              <div className="empty-state">
                <i className="fas fa-inbox"></i>
                <h3>No Processes Found</h3>
                <p>Create your first process by filling out the form above.</p>
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: '8%' }}>ID</th>
                    <th style={{ width: '18%' }}>Name</th>
                    <th style={{ width: '22%' }}>Description</th>
                    <th style={{ width: '35%' }}>Workflow Steps</th>
                    <th style={{ width: '17%' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {processes.map(process => (
                    <tr key={process.NumberOfProccessID}>
                      <td className="process-id">{process.NumberOfProccessID}</td>
                      <td className="process-name">{process.ProcessName}</td>
                      <td>{process.processDesc || '—'}</td>
                      <td className="steps-column">
                        {process.steps && process.steps.length > 0 ? (
                          <ol>
                            {process.steps.map((step, idx) => (
                              <li key={idx}>
                                Step {step.StepOrder}: {step.DeptName}
                              </li>
                            ))}
                          </ol>
                        ) : (
                          <span className="no-steps">No steps configured</span>
                        )}
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            className="btn btn-success"
                            onClick={() => handleAddTask(process.NumberOfProccessID, process.ProcessName, process.steps)}
                          >
                            <i className="fas fa-plus"></i>
                            Add Task
                          </button>
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
    </div>
  );
}
