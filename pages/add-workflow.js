import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { logout } from '@/lib/logout';

export default function AddWorkflow() {
  const router = useRouter();
  const { pkgeID } = router.query;

  // Form state
  const [formData, setFormData] = useState({
    processID: '',
    projectID: '',
    packageID: pkgeID || '',
    startDate: '',
    status: 'Pending',
    supplierType: '',
    supplierName: '',
    totalPayment: '',
    locationtype: '',
    paymentInstallments: []
  });

  // UI state
  const [processes, setProcesses] = useState([]);
  const [packages, setPackages] = useState([]);
  const [projects, setProjects] = useState([]);
  const [supplierNames, setSupplierNames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [alert, setAlert] = useState(null);
  const [errors, setErrors] = useState({});
  const [isSpecialUser, setIsSpecialUser] = useState(false);
  const [selectedProjectID, setSelectedProjectID] = useState(null);

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  // Set today's date as default
  useEffect(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;

    setFormData(prev => ({
      ...prev,
      startDate: dateString,
      projectID: selectedProjectID || ''
    }));
  }, [selectedProjectID]);

  const loadInitialData = async () => {
    try {
      setLoading(true);

      // Check authentication and get user info
      const sessionRes = await fetch('/api/auth/session');
      if (sessionRes.ok) {
        const session = await sessionRes.json();
        setIsSpecialUser(session.isSpecialUser || false);
        setSelectedProjectID(session.projectID || null);
      }

      // Load all data in parallel
      const [processesRes, packagesRes, projectsRes, suppliersRes] = await Promise.all([
        fetch('/api/processes'),
        fetch('/api/packages'),
        fetch('/api/projects'),
        fetch('/api/supplier-names')
      ]);

      if (processesRes.ok) {
        const data = await processesRes.json();
        setProcesses(data);
      }

      if (packagesRes.ok) {
        const data = await packagesRes.json();
        setPackages(data);
      }

      if (projectsRes.ok) {
        const data = await projectsRes.json();
        setProjects(data);
      }

      if (suppliersRes.ok) {
        const data = await suppliersRes.json();
        setSupplierNames(data);
      }
    } catch (err) {
      console.error('Error loading data:', err);
      showAlert('Failed to load form data', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (type === 'radio') {
      // Handle radio buttons
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));

      // Show/hide payment installments for international suppliers
      if (name === 'locationtype' && value === 'Local') {
        setFormData(prev => ({
          ...prev,
          paymentInstallments: []
        }));
      }
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handlePaymentInstallmentChange = (e) => {
    const { value, checked } = e.target;

    if (checked) {
      setFormData(prev => ({
        ...prev,
        paymentInstallments: [value]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        paymentInstallments: []
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.processID) newErrors.processID = 'Process is required';
    if (!formData.projectID) newErrors.projectID = 'Project is required';
    if (!formData.packageID) newErrors.packageID = 'Package is required';
    if (!formData.startDate) newErrors.startDate = 'Start date is required';
    if (!formData.supplierType) newErrors.supplierType = 'Supplier type is required';
    if (!formData.supplierName) newErrors.supplierName = 'Supplier name is required';
    if (!formData.totalPayment || parseFloat(formData.totalPayment) <= 0) {
      newErrors.totalPayment = 'Valid payment amount is required';
    }
    if (!formData.locationtype) newErrors.locationtype = 'Location type is required';
    if (formData.locationtype === 'International' && formData.paymentInstallments.length === 0) {
      newErrors.paymentInstallments = 'Number of payments is required for international suppliers';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      showAlert('Please fill in all required fields', 'danger');
      return;
    }

    setSubmitting(true);

    try {
      // Use projectID from login session (like the original accKPI)
      const projectID = selectedProjectID ? parseInt(selectedProjectID) : parseInt(formData.projectID);

      // Step 1: Create workflow with all basic data
      const workflowRes = await fetch('/api/workflows/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          processID: parseInt(formData.processID),
          projectID: projectID,
          packageID: parseInt(formData.packageID),
          startDate: formData.startDate,
          status: formData.status
        })
      });

      if (!workflowRes.ok) {
        const error = await workflowRes.json();
        throw new Error(error.error || 'Failed to create workflow');
      }

      const workflowData = await workflowRes.json();
      const workflowID = workflowData.workflowID;

      // Step 2: Add supplier information
      const supplierRes = await fetch('/api/suppliers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          supplierName: parseInt(formData.supplierName),
          supplierType: formData.supplierType,
          workFlowID: workflowID,
          totalPayment: parseFloat(formData.totalPayment),
          locationtype: formData.locationtype
        })
      });

      if (!supplierRes.ok) {
        console.error('Supplier save failed, but workflow was created');
      }

      const supplierData = await supplierRes.json();
      const supplierID = supplierData.supplier?.supplierID;

      // Step 3: Create workflow steps if international with multiple payments
      if (formData.locationtype === 'International' && formData.paymentInstallments.length > 0) {
        const stepsRes = await fetch('/api/workflow-steps', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            workFlowID: workflowID,
            supplierID: supplierID,
            numberOfPayments: parseInt(formData.paymentInstallments[0])
          })
        });

        if (!stepsRes.ok) {
          console.error('Failed to create workflow steps');
        }
      }

      showAlert('Workflow and supplier added successfully!', 'success');

      // Reset form
      setFormData({
        processID: '',
        projectID: selectedProjectID || '',
        packageID: '',
        startDate: '',
        status: 'Pending',
        supplierType: '',
        supplierName: '',
        totalPayment: '',
        locationtype: '',
        paymentInstallments: []
      });

      // Redirect to workflow dashboard after alert (similar to accKPI)
      setTimeout(() => {
        router.push('/workflowdashboard');
      }, 3000);
    } catch (err) {
      console.error('Error:', err);
      showAlert('An error occurred: ' + err.message, 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  const showAlert = (message, type = 'success') => {
    setAlert({ message, type });
    if (type === 'success') {
      setTimeout(() => setAlert(null), 3000);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Add Workflow</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      <div style={styles.container}>
        <div style={styles.topBar}>
          <button type="button" onClick={handleBack} style={styles.backBtn}>
            <span>←</span> Back
          </button>
          <button type="button" onClick={logout} className="btn btn-outline-danger">
            Logout
          </button>
        </div>

        <h1 style={styles.title}>
          <span style={styles.icon}>⊕</span>
          Add New Workflow
        </h1>

        {alert && (
          <div style={{
            ...styles.alert,
            backgroundColor: alert.type === 'success' ? '#d4edda' : '#f8d7da',
            color: alert.type === 'success' ? '#155724' : '#721c24',
            border: `1px solid ${alert.type === 'success' ? '#c3e6cb' : '#f5c6cb'}`
          }}>
            <span style={styles.alertIcon}>
              {alert.type === 'success' ? '✓' : '!'}
            </span>
            {alert.message}
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          {/* Workflow Setup Section */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Workflow Setup</h2>
            <div style={styles.grid}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Process *</label>
                <select
                  name="processID"
                  value={formData.processID}
                  onChange={handleInputChange}
                  style={{
                    ...styles.input,
                    borderColor: errors.processID ? '#dc3545' : '#ddd'
                  }}
                >
                  <option value="">Select Process</option>
                  {processes.map(proc => (
                    <option key={proc.NumberOfProccessID} value={proc.NumberOfProccessID}>
                      {proc.ProcessName}
                    </option>
                  ))}
                </select>
                {errors.processID && <span style={styles.error}>{errors.processID}</span>}
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Package *</label>
                <select
                  name="packageID"
                  value={formData.packageID}
                  onChange={handleInputChange}
                  style={{
                    ...styles.input,
                    borderColor: errors.packageID ? '#dc3545' : '#ddd'
                  }}
                >
                  <option value="">Select Package</option>
                  {packages.map(pkg => (
                    <option key={pkg.PkgeID} value={pkg.PkgeID}>
                      {pkg.PkgeName}
                    </option>
                  ))}
                </select>
                {errors.packageID && <span style={styles.error}>{errors.packageID}</span>}
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Start Date *</label>
                <input
                  type="date"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleInputChange}
                  style={{
                    ...styles.input,
                    borderColor: errors.startDate ? '#dc3545' : '#ddd'
                  }}
                />
                {errors.startDate && <span style={styles.error}>{errors.startDate}</span>}
              </div>
            </div>
          </div>

          {/* Supplier Information Section */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Supplier Information</h2>
            <div style={styles.grid}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Supplier Type *</label>
                <select
                  name="supplierType"
                  value={formData.supplierType}
                  onChange={handleInputChange}
                  style={{
                    ...styles.input,
                    borderColor: errors.supplierType ? '#dc3545' : '#ddd'
                  }}
                >
                  <option value="">Select Type</option>
                  <option value="Subcontractor">Subcontractor</option>
                  <option value="Supplier">Supplier</option>
                </select>
                {errors.supplierType && <span style={styles.error}>{errors.supplierType}</span>}
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Total Payment *</label>
                <input
                  type="number"
                  name="totalPayment"
                  value={formData.totalPayment}
                  onChange={handleInputChange}
                  placeholder="Enter amount"
                  step="0.01"
                  min="0"
                  style={{
                    ...styles.input,
                    borderColor: errors.totalPayment ? '#dc3545' : '#ddd'
                  }}
                />
                {errors.totalPayment && <span style={styles.error}>{errors.totalPayment}</span>}
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Subcontractor/Supplier Name *</label>
                <select
                  name="supplierName"
                  value={formData.supplierName}
                  onChange={handleInputChange}
                  style={{
                    ...styles.input,
                    borderColor: errors.supplierName ? '#dc3545' : '#ddd'
                  }}
                >
                  <option value="">Select Subcontractor/Supplier</option>
                  {supplierNames.map(supplier => (
                    <option key={supplier.supplierNameID} value={supplier.supplierNameID}>
                      {supplier.supplierName}
                    </option>
                  ))}
                </select>
                {errors.supplierName && <span style={styles.error}>{errors.supplierName}</span>}
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Location Type *</label>
                <div style={styles.radioGroup}>
                  <div style={styles.radioOption}>
                    <input
                      type="radio"
                      id="location-local"
                      name="locationtype"
                      value="Local"
                      checked={formData.locationtype === 'Local'}
                      onChange={handleInputChange}
                    />
                    <label htmlFor="location-local" style={styles.radioLabel}>Local</label>
                  </div>
                  <div style={styles.radioOption}>
                    <input
                      type="radio"
                      id="location-international"
                      name="locationtype"
                      value="International"
                      checked={formData.locationtype === 'International'}
                      onChange={handleInputChange}
                    />
                    <label htmlFor="location-international" style={styles.radioLabel}>International</label>
                  </div>
                </div>
                {errors.locationtype && <span style={styles.error}>{errors.locationtype}</span>}
              </div>

              {/* Payment Installments - Only show for International */}
              {formData.locationtype === 'International' && (
                <div style={styles.formGroup}>
                  <label style={styles.label}>Number of Payments *</label>
                  <div style={styles.checkboxGroup}>
                    {[1, 2, 3, 4].map(num => (
                      <div key={num} style={styles.checkboxItem}>
                        <input
                          type="radio"
                          id={`payment-${num}`}
                          name="paymentInstallments"
                          value={num}
                          checked={formData.paymentInstallments.includes(String(num))}
                          onChange={handlePaymentInstallmentChange}
                        />
                        <label htmlFor={`payment-${num}`} style={styles.radioLabel}>
                          {num} Payment{num > 1 ? 's' : ''}
                        </label>
                      </div>
                    ))}
                  </div>
                  {errors.paymentInstallments && <span style={styles.error}>{errors.paymentInstallments}</span>}
                </div>
              )}
            </div>
          </div>

          {/* Status Section */}
          <div style={styles.statusContainer}>
            <div style={styles.statusBadge}>
              <span style={styles.statusIcon}>⏱</span>
              {formData.status}
            </div>
            <input type="hidden" name="status" value={formData.status} />
          </div>

          {/* Buttons */}
          <div style={styles.buttonGroup}>
            <button
              type="button"
              onClick={handleBack}
              style={styles.btnSecondary}
              disabled={submitting}
            >
              <span>✕</span> Cancel
            </button>
            <button
              type="submit"
              style={styles.btnPrimary}
              disabled={submitting}
            >
              <span>💾</span> {submitting ? 'Saving...' : 'Save Workflow'}
            </button>
          </div>
        </form>

        <input type="hidden" id="selectedProjectID" value={selectedProjectID || ''} />
      </div>
    </>
  );
}

// Inline styles
const styles = {
  container: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '40px 20px',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '20px',
    flexWrap: 'wrap',
    gap: '10px'
  },
  backBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#0066cc',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'color 0.2s'
  },
  title: {
    fontSize: '28px',
    fontWeight: '600',
    marginBottom: '30px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    color: '#1a202c'
  },
  icon: {
    fontSize: '32px'
  },
  alert: {
    padding: '12px 16px',
    borderRadius: '6px',
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    animation: 'slideIn 0.3s ease'
  },
  alertIcon: {
    fontSize: '18px',
    fontWeight: 'bold'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '30px'
  },
  section: {
    backgroundColor: '#f9fafb',
    padding: '20px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb'
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '600',
    marginBottom: '15px',
    color: '#1a202c'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '15px'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column'
  },
  label: {
    fontSize: '14px',
    fontWeight: '500',
    marginBottom: '6px',
    color: '#374151'
  },
  input: {
    padding: '10px 12px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '14px',
    fontFamily: 'inherit',
    transition: 'border-color 0.2s',
    backgroundColor: '#fff'
  },
  error: {
    fontSize: '12px',
    color: '#dc3545',
    marginTop: '4px'
  },
  radioGroup: {
    display: 'flex',
    gap: '20px',
    marginTop: '8px'
  },
  radioOption: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  radioLabel: {
    fontSize: '14px',
    cursor: 'pointer',
    color: '#374151'
  },
  checkboxGroup: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: '12px',
    marginTop: '8px'
  },
  checkboxItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  statusContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    backgroundColor: '#fef3c7',
    color: '#92400e',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500'
  },
  statusIcon: {
    fontSize: '16px'
  },
  buttonGroup: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
    marginTop: '20px'
  },
  btnPrimary: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '10px 20px',
    backgroundColor: '#0066cc',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  btnSecondary: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '10px 20px',
    backgroundColor: '#e5e7eb',
    color: '#1a202c',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  }
};
