import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/hooks';
import Layout from '@/components/Layout';

// ─── Utility Functions ───────────────────────────────────────────

const getDelayColor = (delayDays, daysRequired) => {
  if (delayDays === null || delayDays === undefined) return 'delay-on-time';
  if (!daysRequired || daysRequired <= 0) return 'delay-red';
  if (delayDays > 0) return 'delay-red';
  if (delayDays >= -3) return 'delay-yellow';
  return 'delay-green';
};

const calculateDelayFromDates = (finishDate, plannedDate) => {
  if (!finishDate || !plannedDate) return 0;
  const finishParts = finishDate.split('T');
  const plannedParts = plannedDate.split('T');
  const finishDateStr = finishParts[0];
  const plannedDateStr = plannedParts[0];
  const finishTimeStr = finishParts[1] || '00:00:00';
  const finishHour = parseInt(finishTimeStr.split(':')[0]);

  const [fY, fM, fD] = finishDateStr.split('-');
  const [pY, pM, pD] = plannedDateStr.split('-');
  let finish = new Date(parseInt(fY), parseInt(fM) - 1, parseInt(fD));
  const planned = new Date(parseInt(pY), parseInt(pM) - 1, parseInt(pD));
  if (finishHour >= 18) finish.setDate(finish.getDate() + 1);
  return Math.round((finish - planned) / (1000 * 60 * 60 * 24));
};

const formatDateString = (dateStr) => {
  if (!dateStr) return '';
  if (typeof dateStr === 'string') {
    const datePart = dateStr.split('T')[0].split(' ')[0];
    if (datePart && datePart.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = datePart.split('-');
      return new Date(year, month - 1, day).toLocaleDateString();
    }
  }
  return new Date(dateStr).toLocaleDateString();
};

const getDateInputValue = (dateStr) => {
  if (!dateStr) return '';
  if (typeof dateStr === 'string') {
    const datePart = dateStr.split('T')[0].split(' ')[0];
    if (datePart && datePart.match(/^\d{4}-\d{2}-\d{2}$/)) return datePart;
  }
  const d = new Date(dateStr);
  return d.toISOString().split('T')[0];
};

/** Latest calendar day among completed tasks (YYYY-MM-DD), for sequencing start dates. */
const getLatestTimeFinishedDateStr = (taskList) => {
  if (!Array.isArray(taskList)) return null;
  let latest = null;
  for (const t of taskList) {
    if (!t?.TimeFinished) continue;
    const d = getDateInputValue(t.TimeFinished);
    if (!d) continue;
    if (!latest || d > latest) latest = d;
  }
  return latest;
};

const compareWorkflowOrder = (a, b) =>
  (Number(a?.StepOrder ?? 9999) - Number(b?.StepOrder ?? 9999))
  || (Number(a?.Priority ?? 9999) - Number(b?.Priority ?? 9999))
  || (Number(a?.TaskID) - Number(b?.TaskID));

/** True if any task that sorts strictly before `task` still has no finish date (same workflow list). */
const hasUnfinishedWorkflowPredecessor = (task, workflowTaskList) => {
  if (!task || !Array.isArray(workflowTaskList)) return false;
  return workflowTaskList.some(
    (t) =>
      t.TaskID !== task.TaskID
      && compareWorkflowOrder(t, task) < 0
      && !t.TimeFinished
  );
};

function DateModalBody({ dateModal, onCancel, onConfirm, showError }) {
  const [val, setVal] = useState(() => dateModal.defaultValue || '');
  const min = dateModal.minDate || '1900-01-01';
  const max = dateModal.maxDate || '9999-12-31';
  /** Start + finish pickers: cannot confirm outside [min, max] (finish min = task start date). */
  const confirmDisabled = !val || val < min || val > max;

  return (
    <>
      <div className="modal-title"><i className="fas fa-calendar" /> {dateModal.title}</div>
      <p className="modal-hint">{dateModal.hint}</p>
      <input
        type="date"
        id="date-modal-input"
        className="modal-date-input"
        min={dateModal.minDate}
        max={dateModal.maxDate}
        value={val}
        onChange={(e) => setVal(e.target.value)}
      />
      <div className="modal-actions">
        <button type="button" className="btn-cancel" onClick={onCancel}>Cancel</button>
        <button
          type="button"
          className="btn-confirm"
          disabled={confirmDisabled}
          onClick={() => {
            if (!val) return;
            if (val < min || val > max) {
              showError(`Date must be on or after ${min} and on or before ${max}.`);
              return;
            }
            onConfirm(val);
          }}
        >
          Confirm
        </button>
      </div>
    </>
  );
}

// ─── Main Component ──────────────────────────────────────────────

export default function WorkflowUserPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { hdrId } = router.query;

  // Core state
  const [workflow, setWorkflow] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [paymentSteps, setPaymentSteps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // UI state
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedDepts, setCollapsedDepts] = useState({});
  const [allCollapsed, setAllCollapsed] = useState(false);
  const [allDepartmentsMaster, setAllDepartmentsMaster] = useState(false);
  const [masterCollapsed, setMasterCollapsed] = useState(false);

  // Messages
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Modals
  const [dateModal, setDateModal] = useState(null);
  const [delayModal, setDelayModal] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [paymentDateModal, setPaymentDateModal] = useState(null);

  // Task history
  const [taskHistory, setTaskHistory] = useState([]);
  const [historyPaymentFilter, setHistoryPaymentFilter] = useState('');
  const [historyCollapsed, setHistoryCollapsed] = useState({});

  // Editable fields tracking
  const [editedDays, setEditedDays] = useState({});

  // Refs for modal promise
  const dateResolveRef = useRef(null);
  const dateRejectRef = useRef(null);

  // ─── Derived Values ──────────────────────────────────────────

  const userId = user?.id;
  const deptId = user?.DepartmentId;
  const isAdmin = user?.usrAdmin;

  const activePayment = paymentSteps.find(s => s.isActive);
  const activeStepNumber = activePayment?.stepNumber || null;
  const isPayment1 = activeStepNumber === 1 || !paymentSteps || paymentSteps.length === 0;

  // ─── Show messages ───────────────────────────────────────────

  const showSuccess = useCallback((msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  }, []);

  const showError = useCallback((msg) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(''), 5000);
  }, []);

  // ─── Fetch Data ──────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!hdrId) return;
    try {
      setLoading(true);
      setError(null);

      const [workflowRes, tasksRes, stepsRes] = await Promise.all([
        fetch(`/api/workflows/${hdrId}`),
        fetch(`/api/workflows/${hdrId}/tasks`),
        fetch(`/api/workflow-steps/${hdrId}`)
      ]);

      if (!workflowRes.ok) throw new Error('Failed to load workflow');
      setWorkflow(await workflowRes.json());

      if (!tasksRes.ok) throw new Error('Failed to load tasks');
      setTasks(await tasksRes.json());

      if (stepsRes.ok) {
        setPaymentSteps(await stepsRes.json());
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [hdrId]);

  useEffect(() => { fetchData(); }, [fetchData]);
  // ─── Task History ────────────────────────────────────────────

  const fetchHistory = useCallback(async () => {
    if (!hdrId) return;
    try {
      const res = await fetch(`/api/tasks/history?workFlowID=${hdrId}`);
      const data = await res.json();
      let history = data.history || [];
      if (activePayment) {
        history = history.filter(t => t.PaymentStep < activePayment.stepNumber);
      }
      setTaskHistory(history);
    } catch (err) {
      console.error('Error loading history:', err);
    }
  }, [hdrId, activePayment]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // ─── Computed task groups ────────────────────────────────────

  const visibleTasks = tasks.filter(task => {
    if ((task.DepId === 9 || task.DepId === 8) && !isPayment1) return false;
    return true;
  });

  const filteredTasks = visibleTasks.filter(task => {
    if (searchQuery && !task.TaskName?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (statusFilter === 'pending' && (task.TimeStarted || task.TimeFinished)) return false;
    if (statusFilter === 'inprogress' && (!task.TimeStarted || task.TimeFinished)) return false;
    if (statusFilter === 'completed' && !task.TimeFinished) return false;
    if (statusFilter === 'overdue' && !(task.TimeFinished && task.Delay > 0)) return false;
    return true;
  }).sort((a, b) => (a.StepOrder - b.StepOrder) || (a.Priority - b.Priority) || (a.TaskID - b.TaskID));

  // Group by department
  let grouped = {};
  if (allDepartmentsMaster) {
    // Group all tasks by department under a master header
    grouped = {};
    filteredTasks.forEach(task => {
      if (!grouped[task.DepId]) {
        grouped[task.DepId] = { deptName: task.DeptName || `Department ${task.DepId}`, stepOrder: task.StepOrder || 9999, tasks: [] };
      }
      grouped[task.DepId].tasks.push(task);
    });
  } else {
    filteredTasks.forEach(task => {
      if (!grouped[task.DepId]) {
        grouped[task.DepId] = { deptName: task.DeptName || `Department ${task.DepId}`, stepOrder: task.StepOrder || 9999, tasks: [] };
      }
      grouped[task.DepId].tasks.push(task);
    });
  }
  const sortedGroups = Object.values(grouped).sort((a, b) => a.stepOrder - b.stepOrder);

  // Status counts
  const counts = { pending: 0, inprogress: 0, completed: 0, overdue: 0 };
  visibleTasks.forEach(task => {
    if (task.TimeFinished) { task.Delay > 0 ? counts.overdue++ : counts.completed++; }
    else if (task.TimeStarted) counts.inprogress++;
    else counts.pending++;
  });
  const completionPercentage = visibleTasks.length > 0 ? Math.round((counts.completed / visibleTasks.length) * 100) : 0;

  // ─── Date Picker Modal (Promise-based) ───────────────────────

  /**
   * @param {string} title
   * @param {string|null|{ minDate?: string, maxDate?: string, defaultValue?: string, hint?: string }} [options]
   *   Pass a string (min start date for finish flow), null/omit for default start picker, or an object to set min+max (e.g. start date floored by last TimeFinished).
   */
  const showDatePicker = (title, options = null) => {
    return new Promise((resolve, reject) => {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

      let minDate = '1900-01-01';
      let maxDate = today;
      let defaultValue = today;
      let hint = 'You can backdate start date';

      if (options != null && typeof options === 'string') {
        const minDateStr = options;
        minDate = minDateStr || '1900-01-01';
        maxDate = minDateStr ? '9999-12-31' : today;
        // Finish task: default picker to today (still constrained by min = start date).
        defaultValue = minDateStr
          ? (today >= minDateStr ? today : minDateStr)
          : today;
        hint = minDateStr
          ? `Finish date must be on or after start date (${minDateStr}); default is today`
          : 'You can backdate start date';
      } else if (options != null && typeof options === 'object') {
        minDate = options.minDate || '1900-01-01';
        maxDate = options.maxDate ?? today;
        if (minDate > maxDate) {
          minDate = maxDate;
        }
        defaultValue = options.defaultValue
          ?? (today >= minDate && today <= maxDate ? today : minDate);
        hint = options.hint
          ?? (minDate !== '1900-01-01'
            ? `Date must be from ${minDate} through ${maxDate}`
            : 'You can backdate start date');
      }

      setDateModal({ title, minDate, maxDate, defaultValue, hint });
      dateResolveRef.current = resolve;
      dateRejectRef.current = reject;
    });
  };

  // ─── Task Actions ────────────────────────────────────────────

  const handleStartTask = async (taskId) => {
    const task = tasks.find(t => t.TaskID === Number(taskId));
    if (!task) return showError('Task not found');
    const wfId = task.WorkFlowHdrID || task.workFlowHdrId || hdrId;
    if (!wfId) return showError('Workflow ID not found');

    try {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
      const latestFinish = getLatestTimeFinishedDateStr(
        tasks.filter(t => t.TaskID !== Number(taskId))
      );
      let selectedDate;
      if (latestFinish) {
        if (latestFinish > today) {
          showError('Last finished task date is after today; cannot pick a valid start date.');
          return;
        }
        selectedDate = await showDatePicker('Select Start Date', {
          minDate: latestFinish,
          maxDate: today,
          hint: `Start date cannot be before the last finished task (${formatDateString(latestFinish)})`
        });
      } else {
        selectedDate = await showDatePicker('Select Start Date');
      }
      if (latestFinish && (selectedDate < latestFinish || selectedDate > today)) {
        showError('Start date must be on or after the last finished task and not after today.');
        return;
      }
      if (!latestFinish && selectedDate > today) {
        showError('Start date cannot be after today.');
        return;
      }
      const res = await fetch('/api/tasks/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: Number(taskId),
          startTime: selectedDate,
          workFlowHdrId: Number(wfId),
          processID: task.NumberOfProccessID || task.ProcessID
        })
      });
      if (!res.ok) throw new Error('Failed to start task');
      showSuccess('Task started successfully');
      fetchData();
    } catch (err) {
      if (err.message !== 'Cancelled') showError(err.message);
    }
  };

  const handleFinishTask = async (taskId) => {
    const task = tasks.find(t => t.TaskID === Number(taskId));
    if (!task) return showError('Task not found');
    const wfId = task.WorkFlowHdrID || task.workFlowHdrId || hdrId;
    if (!wfId) return showError('Workflow ID not found');

    try {
      let startDate = null;
      if (task.TimeStarted) {
        startDate = getDateInputValue(task.TimeStarted);
      }
      const selectedDate = await showDatePicker('Select Finish Date', startDate);
      const res = await fetch('/api/tasks/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: Number(taskId),
          finishTime: selectedDate,
          workFlowHdrId: Number(wfId),
          processID: task.NumberOfProccessID || task.ProcessID
        })
      });
      if (!res.ok) throw new Error('Failed to finish task');
      showSuccess('Task marked as finished');
      setTimeout(() => fetchData(), 500);
    } catch (err) {
      if (err.message !== 'Cancelled') showError(err.message);
    }
  };

  const handleSaveDelayReason = async (taskId, reason) => {
    if (!reason.trim()) return showError('Please enter a delay reason');
    try {
      const res = await fetch('/api/tasks/save-updates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: [{ taskId: Number(taskId), field: 'delayReason', value: reason, usrID: userId }]
        })
      });
      if (!res.ok) throw new Error('Failed to save');
      showSuccess('Delay reason saved');
      setDelayModal(null);
      fetchData();
    } catch (err) {
      showError(err.message);
    }
  };

  const handleSaveDaysRequired = async (taskId) => {
    const newVal = editedDays[taskId];
    if (!newVal || newVal < 1) return showError('Days must be at least 1');
    const taskRow = tasks.find((t) => t.TaskID === Number(taskId));
    if (taskRow && hasUnfinishedWorkflowPredecessor(taskRow, tasks)) {
      return showError('Finish earlier workflow tasks (by step / priority) before changing days required.');
    }
    try {
      const res = await fetch('/api/tasks/save-updates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: [{ taskId: Number(taskId), field: 'daysRequired', value: Number(newVal), usrID: userId }]
        })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to save');
      }
      showSuccess('Days required updated');
      setEditedDays(prev => { const n = { ...prev }; delete n[taskId]; return n; });
      fetchData();
    } catch (err) {
      showError(err.message);
    }
  };

  // ─── Payment Date ───────────────────────────────────────────

  const handleSetPaymentDate = (paymentStep) => {
    const paymentTasks = tasks.filter(t => t.PaymentStep === paymentStep && t.DepId !== 9 && t.DepId !== 8);
    let defaultDate = new Date().toISOString().split('T')[0];
    if (paymentTasks.length > 0) {
      const sorted = [...paymentTasks].sort((a, b) => a.TaskID - b.TaskID);
      if (sorted[0].PlannedDate) {
        defaultDate = getDateInputValue(sorted[0].PlannedDate);
      }
    }
    setPaymentDateModal({ paymentStep, defaultDate });
  };

  const handleConfirmPaymentDate = async (paymentStep, selectedDate) => {
    try {
      // 1. Set StepStartDate on the payment step
      const activeStep = paymentSteps.find(s => s.isActive && s.stepNumber === paymentStep);
      if (activeStep) {
        await fetch(`/api/workflow-steps/${hdrId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stepNumber: paymentStep, StepStartDate: selectedDate })
        });
      }

      // 2. Find first task (by StepOrder, excluding Contract/Procurement)
      const paymentTasks = tasks.filter(t => t.DepId !== 9 && t.DepId !== 8);
      if (paymentTasks.length > 0) {
        const sorted = [...paymentTasks].sort((a, b) =>
          (a.StepOrder || 9999) - (b.StepOrder || 9999) || (a.Priority || 0) - (b.Priority || 0) || a.TaskID - b.TaskID
        );
        const firstTask = sorted[0];

        // 3. Set PlannedDate and IsTaskSelected on the first task
        await fetch(`/api/tasks/${firstTask.TaskID}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ PlannedDate: selectedDate, IsTaskSelected: 1 })
        });
      }

      showSuccess(`Start date for Payment ${paymentStep} set to ${selectedDate}`);
    } catch (err) {
      console.error('Error setting payment date:', err);
      showError('Failed to set payment date');
    }
    setPaymentDateModal(null);
    fetchData();
  };

  // ─── CSV Export ─────────────────────────────────────────────

  const exportCSV = () => {
    if (tasks.length === 0) return showError('No tasks to export');
    const headers = ['Task Name', 'Department', 'Status', 'Start Date', 'Date Finished', 'Days Delay', 'Days Required', 'Priority'];
    const rows = tasks.map(task => {
      const status = task.TimeStarted ? (task.TimeFinished ? 'Completed' : 'In Progress') : 'Pending';
      return [
        `"${task.TaskName}"`, `"${task.DeptName}"`, `"${status}"`,
        task.TimeStarted ? formatDateString(task.TimeStarted) : '-',
        task.TimeFinished ? formatDateString(task.TimeFinished) : '-',
        task.TimeFinished ? (task.Delay > 0 ? task.Delay : 0) : '-',
        task.DaysRequired, task.Priority
      ].join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `tasks-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showSuccess('Exported to CSV');
  };

  // ─── Toggle helpers ────────────────────────────────────────

  const toggleDept = (depId) => {
    setCollapsedDepts(prev => ({ ...prev, [depId]: !prev[depId] }));
  } 

  const toggleAll = () => {
    const newVal = !allCollapsed;
    setAllCollapsed(newVal);
    const newState = {};
    Object.keys(grouped).forEach(key => { newState[key] = newVal; });
    setCollapsedDepts(newState);
  } 

  // Toggle all departments in master mode
  const toggleMasterCollapse = () => {
    const newVal = !masterCollapsed;
    setMasterCollapsed(newVal);
    const newState = {};
    Object.values(grouped).forEach(group => {
      const depId = group.tasks[0]?.DepId;
      if (depId !== undefined) newState[depId] = newVal;
    });
    setCollapsedDepts(newState);
  } 

  // ─── Render Helpers ────────────────────────────────────────

  const getStatusBadge = (task) => {
    if (task.TimeStarted && !task.TimeFinished) {
      return <span className="status-badge status-inprogress"><i className="fas fa-spinner" /> In Progress</span>;
    }
    if (!task.TimeFinished && task.IsTaskSelected && !task.PlannedDate) {
      if (task.PaymentStep > 0) {
        return <span className="status-badge status-waiting"><i className="fas fa-calendar" /> Waiting for Payment {task.PaymentStep} start date</span>;
      }
      return <span className="status-badge status-pending"><i className="fas fa-clock" /> Pending</span>;
    }
    if (!task.TimeFinished && task.IsTaskSelected) {
      return <span className="status-badge status-pending"><i className="fas fa-clock" /> Pending</span>;
    }
    if (task.TimeFinished) {
      return task.Delay > 0
        ? <span className="status-badge status-overdue"><i className="fas fa-exclamation-triangle" /> Delayed ({task.Delay} days)</span>
        : <span className="status-badge status-completed"><i className="fas fa-check" /> Completed</span>;
    }
    return <span className="status-badge status-not-started"><i className="fas fa-minus" /> Not Started</span>;
  };

  const getActionButtons = (task) => {
    const isOwnDepartment = task.DepId == deptId;
    if (!isOwnDepartment || !task.IsTaskSelected) return null;

    if (!task.TimeStarted && task.PlannedDate) {
      return <button className="btn-start" onClick={() => handleStartTask(task.TaskID)}><i className="fas fa-play" /> Start</button>;
    }
    if (task.TimeStarted && !task.TimeFinished && task.PlannedDate) {
      return <button className="btn-finish" onClick={() => handleFinishTask(task.TaskID)}><i className="fas fa-check" /> Finish</button>;
    }
    return null;
  };

  // ─── Loading / Error States ────────────────────────────────

  // if (authLoading || loading) {
  //   return (
  //     <Layout>
  //       <div className="loading-container"><div className="spinner-anim"></div><p>Loading workflow details...</p></div>
  //       <style jsx>{styles}</style>
  //     </Layout>
  //   );
  // }
  if(!loading && !authLoading){
  if (error) {
    return (
      <Layout>
        <div className="error-container">
          <div className="alert-danger"><strong>Error:</strong> {error}</div>
          <button onClick={() => router.back()} className="btn-primary">Go Back</button>
        </div>
        <style jsx>{styles}</style>
      </Layout>
    );
  }

  if (!workflow) {
    return (
      <Layout user={user}>
        <div className="error-container">
          <div className="alert-warning">Workflow not found</div>
          <button onClick={() => router.back()} className="btn-primary">Go Back</button>
        </div>
        <style jsx>{styles}</style>
      </Layout>
    );
  }
}

  // ─── History Grouping ──────────────────────────────────────

  const filteredHistory = historyPaymentFilter
    ? taskHistory.filter(t => t.PaymentStep == historyPaymentFilter)
    : taskHistory;

  const historyGrouped = {};
  filteredHistory.forEach(task => {
    const pKey = `payment-${task.PaymentStep}`;
    if (!historyGrouped[pKey]) historyGrouped[pKey] = { paymentStep: task.PaymentStep, departments: {} };
    const dKey = `dept-${task.DepId}`;
    if (!historyGrouped[pKey].departments[dKey]) {
      historyGrouped[pKey].departments[dKey] = { depId: task.DepId, deptName: task.DeptName, tasks: [] };
    }
    historyGrouped[pKey].departments[dKey].tasks.push(task);
  });

  const historyPayments = [...new Set(taskHistory.map(t => t.PaymentStep))].sort((a, b) => a - b);

  // ─── RENDER ────────────────────────────────────────────────

  return (
    <Layout user={user}>
      {(authLoading || loading) && (
        <div className="loading-container" aria-busy="true" aria-live="polite">
          <div className="loading-container-inner">
            <div className="spinner-anim" />
            <p>Loading workflow details...</p>
          </div>
        </div>
      )}

      <main className={`workflow-user-page${authLoading || loading ? ' workflow-user-page--loading' : ''}`}>
        {/* Toast Messages */}
        {successMsg && <div className="toast toast-success"><i className="fas fa-check-circle" /> {successMsg}</div>}
        {errorMsg && <div className="toast toast-error"><i className="fas fa-exclamation-circle" /> {errorMsg}</div>}

        {/* Top Header */}
        <header className="top-header">
          <div className="header-left">
            <nav className="breadcrumb-nav">
              <button onClick={() => router.push('/workflowdashboard')} className="breadcrumb-link">
                <i className="fas fa-home" /> Dashboard
              </button>
              <span className="breadcrumb-sep">/</span>
              <span className="breadcrumb-current">Workflow #{workflow?.HdrID}</span>
            </nav>
          </div>
          <div className="header-right">
            <button onClick={() => router.back()} className="action-btn"><i className="fas fa-arrow-left" /> Back</button>
            <button onClick={exportCSV} className="action-btn"><i className="fas fa-file-csv" /> Export CSV</button>
          </div>
        </header>

        {/* Main Header with Progress */}
        <section className="main-header">
          <div className="header-title">
            <h1><i className="fas fa-tasks" /> Task Management</h1>
            <p className="header-subtitle">
              {workflow?.ProjectName} &bull; {workflow?.ProcessName} &bull; {workflow?.PackageName}
            </p>
          </div>
          <div className="completion-section">
            <div className="progress-display">
              <div className="progress-ring-container">
                <svg viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" className="progress-ring-bg" />
                  <circle cx="50" cy="50" r="45" className="progress-ring-fill"
                    style={{ strokeDasharray: `${(completionPercentage / 100) * 283} 283` }} />
                </svg>
                <div className="progress-pct">{completionPercentage}%</div>
              </div>
              <div className="progress-info">
                <span className="progress-label">Completion</span>
                <span className="progress-text">{counts.completed} of {visibleTasks.length} tasks</span>
              </div>
            </div>
          </div>
        </section>

        {/* Status Cards */}
        <section className="status-cards">
          {[
            { label: 'All Tasks', count: visibleTasks.length, icon: 'fas fa-list', cls: '', filter: '' },
            { label: 'Pending', count: counts.pending, icon: 'fas fa-clock', cls: 'pending', filter: 'pending' },
            { label: 'In Progress', count: counts.inprogress, icon: 'fas fa-spinner', cls: 'inprogress', filter: 'inprogress' },
            { label: 'Completed', count: counts.completed, icon: 'fas fa-check-circle', cls: 'completed', filter: 'completed' },
            { label: 'Overdue', count: counts.overdue, icon: 'fas fa-exclamation-triangle', cls: 'overdue', filter: 'overdue' }
          ].map(s => (
            <div key={s.label}
              className={`status-card ${s.cls} ${statusFilter === s.filter ? 'active' : ''}`}
              onClick={() => setStatusFilter(statusFilter === s.filter ? '' : s.filter)}>
              <div className={`status-icon ${s.cls}`}><i className={s.icon} /></div>
              <div className="status-info">
                <span className="status-label">{s.label}</span>
                <span className="status-count">{s.count}</span>
              </div>
            </div>
          ))}
        </section>

        {/* Timeline */}
        <section className="timeline-section">
          <h3><i className="fas fa-stream" /> Task Timeline</h3>
          <div className="task-timeline">
            {[...visibleTasks]
              .sort((a, b) => (a.StepOrder - b.StepOrder) || (a.Priority - b.Priority) || (a.TaskID - b.TaskID))
              .map(task => {
                const isCompleted = !!task.TimeFinished;
                let dotClass = 'timeline-dot';
                if (isCompleted) {
                  const calcDelay = calculateDelayFromDates(task.TimeFinished, task.PlannedDate);
                  dotClass += ` ${getDelayColor(calcDelay, task.DaysRequired)}`;
                }
                return (
                  <div key={task.TaskID} className={`timeline-item ${isCompleted ? 'completed' : ''} ${task.IsTaskSelected ? 'current' : ''}`}>
                    <div className={dotClass}></div>
                    <div className="timeline-label">{task.DeptName}</div>
                  </div>
                );
              })}
          </div>
        </section>

        {/* Payment Steps */}
        {paymentSteps.length > 0 && (
          <section className="payment-section">
            <h2><i className="fas fa-credit-card" /> Payment Steps ({paymentSteps.length})</h2>
            <div className="steps-grid">
              {paymentSteps.map(step => (
                <div key={step.workflowStepID} className={`step-card ${step.isActive ? 'active' : step.StepFinished ? 'done' : 'waiting'}`}>
                  <div className="step-number">Payment {step.stepNumber}</div>
                  <div className="step-status">
                    {step.isActive ? '\uD83D\uDFE2 Active' : step.StepFinished ? '\u2705 Completed' : '\u23F3 Waiting'}
                  </div>
                  {step.StepStartDate && <div className="step-date">Started: {formatDateString(step.StepStartDate)}</div>}
                  {step.StepFinished && <div className="step-date">Finished: {formatDateString(step.StepFinished)}</div>}
                  {step.isActive && step.stepNumber > 1 && !step.StepStartDate && (
                    <button className="btn-set-date" onClick={() => handleSetPaymentDate(step.stepNumber)}>
                      <i className="fas fa-calendar-plus" /> Set Start Date
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Search & Filter */}
        <section className="filters-bar">
          <div className="search-box">
            <i className="fas fa-search" />
            <input type="text" placeholder="Search tasks..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          <button onClick={() => { setStatusFilter(''); setSearchQuery(''); }} className="btn-outline">
            <i className="fas fa-times" /> Reset
          </button>
        </section>

        {/* Department Toggle All */}
        <div className="master-toggle" onClick={() => {
          if (!allDepartmentsMaster) {
            setAllDepartmentsMaster(true);
            setMasterCollapsed(false);
            // Reset collapse state when switching to master
            const newState = {};
            Object.values(grouped).forEach(group => {
              const depId = group.tasks[0]?.DepId;
              if (depId !== undefined) newState[depId] = false;
            });
            setCollapsedDepts(newState);
          } else {
            // If already in master mode, toggle collapse/expand all
            toggleMasterCollapse();
          }
        }}>
          <i className="fas fa-layer-group" />
          <span>All Departments</span>
          <span className="badge">{sortedGroups.length} departments</span>
          <i className={`fas fa-chevron-${allDepartmentsMaster && masterCollapsed ? 'right' : 'down'}`} />
        </div>

        {/* Task Tables by Department, with master grouping if toggled */}
        <section className="tasks-section">
          {sortedGroups.length === 0 ? (
            <div className="empty-msg"><i className="fas fa-tasks" /><p>No tasks match your filters</p></div>
          ) : allDepartmentsMaster ? (
            <div className="payment-history-group">
              {/* Removed duplicate All Departments header */}
              {!masterCollapsed && sortedGroups.map(group => {
                const deptKey = group.tasks[0]?.DepId;
                const isCollapsed = collapsedDepts[deptKey];
                return (
                  <div key={deptKey} className={`department-section history-dept${isCollapsed ? ' collapsed' : ''}`}>
                    <div className="department-label" onClick={() => toggleDept(deptKey)} style={{ cursor: 'pointer' }}>
                      <i className="fas fa-building" /> {group.deptName}
                      <span className="badge">{group.tasks.length} tasks</span>
                      <i className={`fas fa-chevron-${isCollapsed ? 'right' : 'down'} toggle-icon`} />
                    </div>
                    {!isCollapsed && (
                      <div className="table-container">
                        <table className="department-table">
                          <thead>
                            <tr>
                              <th>Task Name</th>
                              <th>Planned Date</th>
                              <th>Days Required</th>
                              <th>Start Date</th>
                              <th>Finished Date</th>
                              <th>Status</th>
                              <th>Days Delay</th>
                              <th>Delay Reason</th>
                              <th>Linked To</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.tasks.map(task => {
                              const isOwn = task.DepId == deptId;
                              const isLocked = task.IsFixed === true || task.IsFixed === 1 || task.TimeFinished || !isOwn;
                              const daysLockedByPredecessor = hasUnfinishedWorkflowPredecessor(task, tasks);
                              const daysReadOnly = isLocked || daysLockedByPredecessor;
                              const daysLockTitle = !isOwn
                                ? 'Not your department'
                                : task.TimeFinished
                                  ? 'Task is finished'
                                  : task.IsFixed === true || task.IsFixed === 1
                                    ? 'Fixed task'
                                    : daysLockedByPredecessor
                                      ? 'Earlier workflow tasks must be finished first (step / priority order)'
                                      : '';
                              const delayReason = task.DelayReason || '';

                              return (
                                <tr key={task.TaskID} className={task.IsTaskSelected ? 'active-task-row' : ''}>
                                  <td data-label="Task Name">{task.TaskName || ''}</td>
                                  <td data-label="Planned Date">
                                    <span className="date-display"><i className="fas fa-calendar-alt" /> {formatDateString(task.PlannedDate)}</span>
                                  </td>
                                  <td data-label="Days Required">
                                    {daysReadOnly ? (
                                      <span className="days-fixed" title={daysLockTitle}>
                                        {task.DaysRequired} <i className="fas fa-lock lock-icon" />
                                      </span>
                                    ) : (
                                      <div className="days-edit-group">
                                        <input type="number" min="1"
                                          className="days-input"
                                          value={editedDays[task.TaskID] ?? task.DaysRequired}
                                          onChange={e => setEditedDays(prev => ({ ...prev, [task.TaskID]: e.target.value }))}
                                        />
                                        {editedDays[task.TaskID] !== undefined && String(editedDays[task.TaskID]) !== String(task.DaysRequired) && (
                                          <button className="btn-save-sm" onClick={() => handleSaveDaysRequired(task.TaskID)}>
                                            <i className="fas fa-save" />
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </td>
                                  <td data-label="Start Date">
                                    <span className={`date-display ${task.TimeStarted ? 'has-date' : ''}`}>
                                      <i className="fas fa-play-circle" /> {formatDateString(task.TimeStarted) || '-'}
                                    </span>
                                  </td>
                                  <td data-label="Finished Date">
                                    <span className={`date-display ${task.TimeFinished ? 'has-date' : ''}`}>
                                      <i className="fas fa-check-circle" /> {formatDateString(task.TimeFinished) || '-'}
                                    </span>
                                  </td>
                                  <td data-label="Status">{getStatusBadge(task)}</td>
                                  <td data-label="Days Delay">
                                    {task.TimeFinished ? (task.Delay !== null && task.Delay > 0 ? task.Delay : '0') : '-'}
                                  </td>
                                  <td data-label="Delay Reason">
                                    {!isOwn || !task.TimeFinished ? (
                                      <span className="text-muted">{'\u2014'}</span>
                                    ) : task.Delay <= 0 ? (
                                      <span className="text-success">{'\u2713'} On Time</span>
                                    ) : (
                                      <div className="delay-reason-cell">
                                        <span className={delayReason ? 'has-reason' : 'no-reason'}>
                                          {delayReason || 'No reason provided'}
                                        </span>
                                        <button className="btn-edit-reason"
                                          onClick={() => setDelayModal({ taskId: task.TaskID, currentReason: delayReason })}>
                                          <i className="fas fa-edit" />
                                        </button>
                                      </div>
                                    )}
                                  </td>
                                  <td data-label="Linked To">
                                    {task.linkTasks ? (() => {
                                      const linked = tasks.find(t => t.TaskID === task.linkTasks);
                                      return linked ? `${linked.TaskName} (${linked.DeptName})` : 'N/A';
                                    })() : '-'}
                                  </td>
                                  <td data-label="Actions">
                                    <div className="button-container">{getActionButtons(task)}</div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            sortedGroups.map(group => {
              const deptKey = group.tasks[0]?.DepId;
              const isCollapsed = collapsedDepts[deptKey];
              return (
                <div key={deptKey} className={`department-section ${isCollapsed ? 'collapsed' : ''}`}>
                  <div className="department-label" onClick={() => toggleDept(deptKey)}>
                    <i className="fas fa-building" />
                    <span>{group.deptName}</span>
                    <span className="badge">{group.tasks.length} tasks</span>
                    <i className={`fas fa-chevron-${isCollapsed ? 'right' : 'down'} toggle-icon`} />
                  </div>
                  {!isCollapsed && (
                    <div className="table-container">
                      <table className="department-table">
                        <thead>
                          <tr>
                            <th>Task Name</th>
                            <th>Planned Date</th>
                            <th>Days Required</th>
                            <th>Start Date</th>
                            <th>Finished Date</th>
                            <th>Status</th>
                            <th>Days Delay</th>
                            <th>Delay Reason</th>
                            <th>Linked To</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.tasks.map(task => {
                            const isOwn = task.DepId == deptId;
                            const isLocked = task.IsFixed === true || task.IsFixed === 1 || task.TimeFinished || !isOwn;
                            const daysLockedByPredecessor = hasUnfinishedWorkflowPredecessor(task, tasks);
                            const daysReadOnly = isLocked || daysLockedByPredecessor;
                            const daysLockTitle = !isOwn
                              ? 'Not your department'
                              : task.TimeFinished
                                ? 'Task is finished'
                                : task.IsFixed === true || task.IsFixed === 1
                                  ? 'Fixed task'
                                  : daysLockedByPredecessor
                                    ? 'Earlier workflow tasks must be finished first (step / priority order)'
                                    : '';
                            const delayReason = task.DelayReason || '';

                            return (
                              <tr key={task.TaskID} className={task.IsTaskSelected ? 'active-task-row' : ''}>
                                <td data-label="Task Name">{task.TaskName || ''}</td>
                                <td data-label="Planned Date">
                                  <span className="date-display"><i className="fas fa-calendar-alt" /> {formatDateString(task.PlannedDate)}</span>
                                </td>
                                <td data-label="Days Required">
                                  {daysReadOnly ? (
                                    <span className="days-fixed" title={daysLockTitle}>
                                      {task.DaysRequired} <i className="fas fa-lock lock-icon" />
                                    </span>
                                  ) : (
                                    <div className="days-edit-group">
                                      <input type="number" min="1"
                                        className="days-input"
                                        value={editedDays[task.TaskID] ?? task.DaysRequired}
                                        onChange={e => setEditedDays(prev => ({ ...prev, [task.TaskID]: e.target.value }))}
                                      />
                                      {editedDays[task.TaskID] !== undefined && String(editedDays[task.TaskID]) !== String(task.DaysRequired) && (
                                        <button className="btn-save-sm" onClick={() => handleSaveDaysRequired(task.TaskID)}>
                                          <i className="fas fa-save" />
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </td>
                                <td data-label="Start Date">
                                  <span className={`date-display ${task.TimeStarted ? 'has-date' : ''}`}>
                                    <i className="fas fa-play-circle" /> {formatDateString(task.TimeStarted) || '-'}
                                  </span>
                                </td>
                                <td data-label="Finished Date">
                                  <span className={`date-display ${task.TimeFinished ? 'has-date' : ''}`}>
                                    <i className="fas fa-check-circle" /> {formatDateString(task.TimeFinished) || '-'}
                                  </span>
                                </td>
                                <td data-label="Status">{getStatusBadge(task)}</td>
                                <td data-label="Days Delay">
                                  {task.TimeFinished ? (task.Delay !== null && task.Delay > 0 ? task.Delay : '0') : '-'}
                                </td>
                                <td data-label="Delay Reason">
                                  {!isOwn || !task.TimeFinished ? (
                                    <span className="text-muted">{'\u2014'}</span>
                                  ) : task.Delay <= 0 ? (
                                    <span className="text-success">{'\u2713'} On Time</span>
                                  ) : (
                                    <div className="delay-reason-cell">
                                      <span className={delayReason ? 'has-reason' : 'no-reason'}>
                                        {delayReason || 'No reason provided'}
                                      </span>
                                      <button className="btn-edit-reason"
                                        onClick={() => setDelayModal({ taskId: task.TaskID, currentReason: delayReason })}>
                                        <i className="fas fa-edit" />
                                      </button>
                                    </div>
                                  )}
                                </td>
                                <td data-label="Linked To">
                                  {task.linkTasks ? (() => {
                                    const linked = tasks.find(t => t.TaskID === task.linkTasks);
                                    return linked ? `${linked.TaskName} (${linked.DeptName})` : 'N/A';
                                  })() : '-'}
                                </td>
                                <td data-label="Actions">
                                  <div className="button-container">{getActionButtons(task)}</div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </section>

        {/* Task History - only for multi-payment workflows */}
        {paymentSteps.length > 0 && taskHistory.length > 0 && (
          <section className="history-section">
            <h2><i className="fas fa-history" /> Task History</h2>
            <div className="history-filters">
              <select value={historyPaymentFilter} onChange={e => setHistoryPaymentFilter(e.target.value)}>
                <option value="">All Payments</option>
                {historyPayments.map(step => (
                  <option key={step} value={step}>Payment {step}</option>
                ))}
              </select>
            </div>
            <div className="history-container">
              {Object.keys(historyGrouped)
                .sort((a, b) => historyGrouped[a].paymentStep - historyGrouped[b].paymentStep)
                .map(paymentKey => {
                  const paymentData = historyGrouped[paymentKey];
                  const pCollapsed = historyCollapsed[paymentKey];
                  return (
                    <div key={paymentKey} className="payment-history-group">
                      <div className="payment-header" onClick={() => setHistoryCollapsed(prev => ({ ...prev, [paymentKey]: !prev[paymentKey] }))}>
                        <i className="fas fa-credit-card" />
                        <span>Payment {paymentData.paymentStep}</span>
                        <i className={`fas fa-chevron-${pCollapsed ? 'right' : 'down'}`} style={{ marginLeft: 'auto' }} />
                      </div>
                      {!pCollapsed && Object.values(paymentData.departments)
                        .sort((a, b) => a.depId - b.depId)
                        .map(dept => (
                          <div key={dept.depId} className="department-section history-dept">
                            <div className="department-label">
                              <i className="fas fa-building" /> {dept.deptName}
                              <span className="badge">{dept.tasks.length}</span>
                            </div>
                            <div className="table-container">
                              <table className="department-table">
                                <thead>
                                  <tr>
                                    <th>Task Name</th>
                                    <th>Planned Date</th>
                                    <th>Start Date</th>
                                    <th>Finished Date</th>
                                    <th>Status</th>
                                    <th>Delay</th>
                                    <th>Priority</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {dept.tasks
                                    .sort((a, b) => (a.Priority || 0) - (b.Priority || 0))
                                    .map(task => {
                                      const calcDelay = calculateDelayFromDates(task.TimeFinished, task.PlannedDate);
                                      const colorClass = getDelayColor(calcDelay, task.DaysRequired || 1);
                                      return (
                                        <tr key={task.TaskHistoryID}>
                                          <td>{task.TaskName}</td>
                                          <td>{formatDateString(task.PlannedDate)}</td>
                                          <td>{formatDateString(task.TimeStarted)}</td>
                                          <td>{formatDateString(task.TimeFinished)}</td>
                                          <td><span className={`status-dot ${colorClass}`}></span> {task.Delay > 0 ? `Delayed (${task.Delay}d)` : 'On Time'}</td>
                                          <td>{task.Delay > 0 ? task.Delay : 0}</td>
                                          <td>{task.Priority}</td>
                                        </tr>
                                      );
                                    })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ))}
                    </div>
                  );
                })}
            </div>
          </section>
        )}

        {/* ─── MODALS ─── */}

        {/* Date Picker Modal */}
        {dateModal && (
          <div className="modal-overlay" onClick={() => { dateRejectRef.current?.(new Error('Cancelled')); setDateModal(null); }}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <DateModalBody
                key={`${dateModal.minDate}|${dateModal.maxDate}|${dateModal.defaultValue}|${dateModal.title}`}
                dateModal={dateModal}
                showError={showError}
                onCancel={() => { dateRejectRef.current?.(new Error('Cancelled')); setDateModal(null); }}
                onConfirm={(picked) => { dateResolveRef.current?.(picked); setDateModal(null); }}
              />
            </div>
          </div>
        )}

        {/* Delay Reason Modal */}
        {delayModal && (
          <div className="modal-overlay" onClick={() => setDelayModal(null)}>
            <div className="modal-content delay-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-title"><i className="fas fa-exclamation-circle" /> Delay Reason</div>
              <p className="delay-modal-desc">Please explain why this task was delayed:</p>
              <textarea id="delay-reason-textarea" className="delay-textarea" maxLength="500"
                defaultValue={delayModal.currentReason}
                placeholder="Explain the reason for this delay... (max 500 characters)" />
              <div className="modal-actions">
                <button className="btn-cancel" onClick={() => setDelayModal(null)}>Cancel</button>
                <button className="btn-confirm" onClick={() => {
                  const reason = document.getElementById('delay-reason-textarea').value;
                  handleSaveDelayReason(delayModal.taskId, reason);
                }}>Save Reason</button>
              </div>
            </div>
          </div>
        )}

        {/* Confirm Modal */}
        {confirmModal && (
          <div className="modal-overlay" onClick={() => setConfirmModal(null)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <div className="modal-title"><i className="fas fa-question-circle" /> Confirm</div>
              <p>{confirmModal.message}</p>
              <div className="modal-actions">
                <button className="btn-cancel" onClick={() => setConfirmModal(null)}>Cancel</button>
                <button className="btn-confirm" onClick={() => { confirmModal.onConfirm(); setConfirmModal(null); }}>Confirm</button>
              </div>
            </div>
          </div>
        )}

        {/* Payment Start Date Modal */}
        {paymentDateModal && (
          <div className="modal-overlay" onClick={() => setPaymentDateModal(null)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <div className="modal-title"><i className="fas fa-calendar-plus" /> Set Payment {paymentDateModal.paymentStep} Start Date</div>
              <input type="date" id="payment-date-input" className="modal-date-input" defaultValue={paymentDateModal.defaultDate} />
              <div className="modal-actions">
                <button className="btn-cancel" onClick={() => setPaymentDateModal(null)}>Cancel</button>
                <button className="btn-confirm" onClick={() => {
                  const val = document.getElementById('payment-date-input').value;
                  if (val) handleConfirmPaymentDate(paymentDateModal.paymentStep, val);
                  else showError('Please select a date');
                }}>Confirm</button>
              </div>
            </div>
          </div>
        )}
      </main>

      <style jsx>{styles}</style>
    </Layout>
  );
}

// ═══════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════

const styles = `
  .workflow-user-page {
    padding: 0;
    background: #f4f6f9;
    min-height: 100vh;
    font-family: 'Inter', -apple-system, sans-serif;
  }

  /* Toast Messages */
  .toast {
    position: fixed; top: 1rem; right: 1rem;
    padding: 0.75rem 1.25rem; border-radius: 8px; color: white; font-weight: 500;
    z-index: 9999; animation: slideIn 0.3s ease;
    display: flex; align-items: center; gap: 0.5rem;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  }
  .toast-success { background: #10b981; }
  .toast-error { background: #ef4444; }
  @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }

  /* Top Header */
  .top-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 0.75rem 1.5rem; background: white;
    border-bottom: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  }
  .header-left, .header-right { display: flex; align-items: center; gap: 0.75rem; }
  .breadcrumb-nav { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; }
  .breadcrumb-link {
    background: none; border: none; color: #3b82f6; cursor: pointer;
    display: flex; align-items: center; gap: 0.4rem; font-size: inherit;
    padding: 0.25rem 0.5rem; border-radius: 4px;
  }
  .breadcrumb-link:hover { background: #f1f5f9; }
  .breadcrumb-sep { color: #cbd5e1; }
  .breadcrumb-current { color: #64748b; font-weight: 500; }
  .action-btn {
    background: white; border: 1px solid #d1d5db; padding: 0.4rem 0.75rem;
    border-radius: 6px; cursor: pointer; display: flex; align-items: center;
    gap: 0.4rem; font-size: 0.8rem; color: #374151; transition: all 0.15s;
  }
  .action-btn:hover { background: #f3f4f6; border-color: #9ca3af; }

  /* Main Header */
  .main-header {
    padding: 1.5rem 2rem; background: white; border-bottom: 1px solid #e2e8f0;
    display: flex; justify-content: space-between; align-items: center; gap: 2rem; flex-wrap: wrap;
  }
  .header-title h1 { margin: 0; font-size: 1.5rem; color: #1e293b; display: flex; align-items: center; gap: 0.6rem; }
  .header-subtitle { margin: 0.4rem 0 0; color: #64748b; font-size: 0.85rem; }
  .progress-display { display: flex; align-items: center; gap: 1rem; background: #f8fafc; padding: 1rem; border-radius: 10px; }
  .progress-ring-container { position: relative; width: 80px; height: 80px; }
  .progress-ring-container svg { width: 100%; height: 100%; transform: rotate(-90deg); }
  .progress-ring-bg { fill: none; stroke: #e2e8f0; stroke-width: 6; }
  .progress-ring-fill { fill: none; stroke: #10b981; stroke-width: 6; stroke-linecap: round; transition: stroke-dasharray 0.4s ease; }
  .progress-pct { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 1.25rem; font-weight: 700; color: #1e293b; }
  .progress-info { display: flex; flex-direction: column; gap: 0.2rem; }
  .progress-label { font-size: 0.8rem; color: #64748b; font-weight: 500; }
  .progress-text { font-size: 0.9rem; color: #1e293b; font-weight: 500; }

  /* Status Cards */
  .status-cards {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 0.75rem; padding: 1.25rem 2rem; background: white; border-bottom: 1px solid #e2e8f0;
  }
  .status-card {
    display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem;
    background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;
    cursor: pointer; transition: all 0.15s;
  }
  .status-card:hover { background: #f1f5f9; border-color: #cbd5e1; }
  .status-card.active { border-color: #3b82f6; background: #eff6ff; box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }
  .status-icon { width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; background: #e2e8f0; }
  .status-icon.pending { background: #fef3c7; color: #92400e; }
  .status-icon.inprogress { background: #dbeafe; color: #1e40af; }
  .status-icon.completed { background: #d1fae5; color: #065f46; }
  .status-icon.overdue { background: #fee2e2; color: #991b1b; }
  .status-info { display: flex; flex-direction: column; gap: 0.2rem; }
  .status-label { font-size: 0.75rem; color: #64748b; font-weight: 500; }
  .status-count { font-size: 1.25rem; font-weight: 700; color: #1e293b; }

  /* Timeline */
  .timeline-section { padding: 1.25rem 2rem; background: white; border-bottom: 1px solid #e2e8f0; }
  .timeline-section h3 { margin: 0 0 0.75rem; font-size: 1rem; color: #1e293b; display: flex; align-items: center; gap: 0.5rem; }
  .task-timeline { display: flex; align-items: flex-start; gap: 0; overflow-x: auto; padding: 0.5rem 0; }
  .timeline-item { display: flex; flex-direction: column; align-items: center; min-width: 80px; position: relative; }
  .timeline-item:not(:last-child)::after { content: ''; position: absolute; top: 10px; left: 50%; width: 100%; height: 2px; background: #e2e8f0; }
  .timeline-item.completed:not(:last-child)::after { background: #10b981; }
  .timeline-dot { width: 20px; height: 20px; border-radius: 50%; background: #e2e8f0; border: 3px solid white; box-shadow: 0 0 0 2px #e2e8f0; z-index: 1; margin-bottom: 0.4rem; }
  .timeline-dot.delay-green { background: #10b981; box-shadow: 0 0 0 2px #10b981; }
  .timeline-dot.delay-yellow { background: #f59e0b; box-shadow: 0 0 0 2px #f59e0b; }
  .timeline-dot.delay-red { background: #ef4444; box-shadow: 0 0 0 2px #ef4444; }
  .timeline-dot.delay-on-time { background: #10b981; box-shadow: 0 0 0 2px #10b981; }
  .timeline-item.current .timeline-dot { background: #3b82f6; box-shadow: 0 0 0 2px #3b82f6, 0 0 8px rgba(59,130,246,0.4); }
  .timeline-label { font-size: 0.65rem; color: #64748b; text-align: center; max-width: 80px; word-wrap: break-word; }

  /* Filters */
  .filters-bar {
    display: flex; gap: 0.75rem; padding: 0.75rem 2rem; background: #f8fafc;
    border-bottom: 1px solid #e2e8f0; align-items: center; flex-wrap: wrap;
  }
  .search-box {
    display: flex; align-items: center; gap: 0.5rem; background: white;
    border: 1px solid #d1d5db; border-radius: 6px; padding: 0.4rem 0.75rem; flex: 1; max-width: 300px;
  }
  .search-box i { color: #9ca3af; }
  .search-box input { border: none; outline: none; font-size: 0.85rem; width: 100%; background: none; }
  .btn-outline {
    background: white; border: 1px solid #d1d5db; padding: 0.4rem 0.75rem;
    border-radius: 6px; cursor: pointer; font-size: 0.8rem; color: #6b7280;
    display: flex; align-items: center; gap: 0.3rem;
  }
  .btn-outline:hover { background: #f3f4f6; }

  /* Master Toggle */
  .master-toggle {
    display: flex; align-items: center; gap: 0.6rem; padding: 0.75rem 2rem;
    background: #f1f5f9; cursor: pointer; font-weight: 600; color: #334155;
    border-bottom: 1px solid #e2e8f0;
  }
  .master-toggle:hover { background: #e2e8f0; }
  .badge { background: #dbeafe; color: #1e40af; padding: 0.15rem 0.5rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 500; }

  /* Department Sections */
  .tasks-section { padding: 0.5rem 2rem 2rem; }
  .department-section { margin-bottom: 0.75rem; background: white; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
  .department-label {
    display: flex; align-items: center; gap: 0.6rem; padding: 0.75rem 1rem;
    background: #f8fafc; cursor: pointer; font-weight: 600; color: #334155;
    border-bottom: 1px solid #e2e8f0; font-size: 0.9rem;
  }
  .department-label:hover { background: #f1f5f9; }
  .toggle-icon { margin-left: auto; color: #94a3b8; font-size: 0.8rem; }
  .table-container { overflow-x: auto; }
  .department-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
  .department-table thead { background: #f8fafc; }
  .department-table th {
    padding: 0.6rem 0.75rem; text-align: left; font-weight: 600; color: #475569;
    border-bottom: 2px solid #e2e8f0; font-size: 0.75rem; text-transform: uppercase;
    letter-spacing: 0.3px; white-space: nowrap;
  }
  .department-table td { padding: 0.6rem 0.75rem; border-bottom: 1px solid #f1f5f9; color: #334155; }
  .department-table tr:hover { background: #f8fafc; }
  .active-task-row { background: #eff6ff !important; border-left: 3px solid #3b82f6; }

  .date-display { display: flex; align-items: center; gap: 0.3rem; color: #64748b; font-size: 0.8rem; white-space: nowrap; }
  .date-display.has-date { color: #334155; }
  .days-fixed { display: flex; align-items: center; gap: 0.3rem; color: #64748b; }
  .lock-icon { font-size: 0.7rem; color: #94a3b8; }
  .days-edit-group { display: flex; align-items: center; gap: 0.3rem; }
  .days-input { width: 60px; padding: 0.25rem 0.4rem; border: 1px solid #d1d5db; border-radius: 4px; font-size: 0.8rem; }
  .btn-save-sm { background: #10b981; color: white; border: none; padding: 0.25rem 0.4rem; border-radius: 4px; cursor: pointer; font-size: 0.7rem; }
  .btn-save-sm:hover { background: #059669; }

  .delay-reason-cell { display: flex; align-items: center; gap: 0.3rem; }
  .has-reason { color: #334155; font-size: 0.8rem; }
  .no-reason { color: #94a3b8; font-style: italic; font-size: 0.8rem; }
  .btn-edit-reason { background: none; border: none; color: #3b82f6; cursor: pointer; padding: 0.2rem; font-size: 0.8rem; }
  .btn-edit-reason:hover { color: #2563eb; }
  .text-muted { color: #94a3b8; }
  .text-success { color: #10b981; font-weight: 500; }

  .button-container { display: flex; gap: 0.3rem; }
  .btn-start {
    background: #3b82f6; color: white; border: none; padding: 0.35rem 0.75rem;
    border-radius: 5px; cursor: pointer; font-size: 0.78rem;
    display: flex; align-items: center; gap: 0.3rem; font-weight: 500; white-space: nowrap;
  }
  .btn-start:hover { background: #2563eb; }
  .btn-finish {
    background: #10b981; color: white; border: none; padding: 0.35rem 0.75rem;
    border-radius: 5px; cursor: pointer; font-size: 0.78rem;
    display: flex; align-items: center; gap: 0.3rem; font-weight: 500; white-space: nowrap;
  }
  .btn-finish:hover { background: #059669; }

  /* Status Badges */
  .status-badge {
    display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.2rem 0.6rem;
    border-radius: 9999px; font-size: 0.72rem; font-weight: 500; white-space: nowrap;
  }
  .status-inprogress { background: #dbeafe; color: #1e40af; }
  .status-pending { background: #fef3c7; color: #92400e; }
  .status-waiting { background: #e0e7ff; color: #3730a3; }
  .status-completed { background: #d1fae5; color: #065f46; }
  .status-overdue { background: #fee2e2; color: #991b1b; }
  .status-not-started { background: #f1f5f9; color: #64748b; }

  /* Payment Section */
  .payment-section { padding: 1.5rem 2rem; }
  .payment-section h2 { margin: 0 0 1rem; font-size: 1.1rem; color: #1e293b; display: flex; align-items: center; gap: 0.5rem; }
  .steps-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem; }
  .step-card { padding: 1rem; border: 2px solid #e2e8f0; border-radius: 8px; text-align: center; background: white; transition: all 0.2s; }
  .step-card.active { border-color: #10b981; background: #f0fdf4; }
  .step-card.done { border-color: #a7f3d0; background: #f8fffe; }
  .step-card.waiting { border-color: #e2e8f0; background: #f8fafc; }
  .step-number { font-weight: 600; font-size: 1rem; color: #1e293b; margin-bottom: 0.4rem; }
  .step-status { font-size: 0.8rem; margin-bottom: 0.4rem; color: #64748b; }
  .step-date { font-size: 0.72rem; color: #94a3b8; }
  .btn-set-date {
    margin-top: 0.5rem; background: #eff6ff; color: #3b82f6; border: 1px solid #bfdbfe;
    padding: 0.3rem 0.6rem; border-radius: 5px; cursor: pointer; font-size: 0.75rem;
    display: inline-flex; align-items: center; gap: 0.3rem;
  }
  .btn-set-date:hover { background: #dbeafe; }

  /* History */
  .history-section { padding: 1.5rem 2rem; }
  .history-section h2 { margin: 0 0 1rem; font-size: 1.1rem; color: #1e293b; display: flex; align-items: center; gap: 0.5rem; }
  .history-filters { margin-bottom: 1rem; }
  .history-filters select { padding: 0.4rem 0.75rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.85rem; }
  .payment-history-group { margin-bottom: 1rem; }
  .payment-header {
    display: flex; align-items: center; gap: 0.6rem; padding: 0.6rem 1rem;
    background: #f1f5f9; border-radius: 6px; cursor: pointer; font-weight: 600; color: #334155;
    margin-bottom: 0.5rem;
  }
  .payment-header:hover { background: #e2e8f0; }
  .history-dept { margin-left: 1rem; }
  .status-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 0.4rem; }
  .status-dot.delay-green { background: #10b981; }
  .status-dot.delay-yellow { background: #f59e0b; }
  .status-dot.delay-red { background: #ef4444; }
  .status-dot.delay-on-time { background: #10b981; }

  /* Modals */
  .modal-overlay {
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.5); z-index: 10000;
    display: flex; align-items: center; justify-content: center;
    animation: fadeIn 0.2s ease;
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .modal-content {
    background: white; padding: 1.5rem; border-radius: 12px;
    min-width: 350px; max-width: 480px; box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    animation: scaleIn 0.2s ease;
  }
  @keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  .modal-title { font-size: 1.1rem; font-weight: 600; color: #1e293b; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem; }
  .modal-hint { font-size: 0.85rem; color: #3b82f6; margin-bottom: 0.75rem; }
  .modal-date-input { width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.9rem; margin-bottom: 1rem; box-sizing: border-box; }
  .modal-actions { display: flex; justify-content: flex-end; gap: 0.5rem; }
  .btn-cancel { background: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0; padding: 0.4rem 1rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem; }
  .btn-cancel:hover { background: #e2e8f0; }
  .btn-confirm { background: #3b82f6; color: white; border: none; padding: 0.4rem 1rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-weight: 500; }
  .btn-confirm:hover:not(:disabled) { background: #2563eb; }
  .btn-confirm:disabled { opacity: 0.45; cursor: not-allowed; }
  .delay-textarea { width: 100%; min-height: 100px; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.85rem; resize: vertical; margin-bottom: 1rem; font-family: inherit; box-sizing: border-box; }
  .delay-modal-desc { color: #64748b; font-size: 0.85rem; margin-bottom: 0.75rem; }

  /* Misc */
  .empty-msg { text-align: center; padding: 3rem; color: #94a3b8; }
  .empty-msg i { font-size: 2rem; margin-bottom: 0.5rem; display: block; }
  .loading-container {
    position: fixed;
    inset: 0;
    z-index: 9999;
    margin: 0;
    padding: 1rem;
    background: transparent;
    backdrop-filter: blur(3px);
  }
  .loading-container-inner {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    background: white;
    padding: 2rem 2.5rem;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(15, 23, 42, 0.1);
    min-width: 220px;
  }
  .loading-container-inner p {
    margin: 0.75rem 0 0;
    color: #64748b;
    font-size: 0.95rem;
  }
  .workflow-user-page--loading { pointer-events: none; user-select: none; }
  .error-container { text-align: center; padding: 3rem 2rem; background: white; border-radius: 8px; margin: 2rem; }
  .spinner-anim { width: 40px; height: 40px; margin: 0 auto; border: 4px solid #e2e8f0; border-top: 4px solid #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite; }
  @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  .alert-danger { background: #fee2e2; color: #991b1b; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; }
  .alert-warning { background: #fef3c7; color: #92400e; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; }
  .btn-primary { background: #3b82f6; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem; }

  /* Responsive */
  @media (max-width: 768px) {
    .top-header { flex-direction: column; gap: 0.5rem; padding: 0.75rem; }
    .main-header { flex-direction: column; padding: 1rem; gap: 1rem; }
    .status-cards { grid-template-columns: repeat(2, 1fr); padding: 0.75rem; }
    .tasks-section { padding: 0 0.75rem 1rem; }
    .filters-bar { padding: 0.75rem; }
    .timeline-section { padding: 0.75rem; }
    .master-toggle { padding: 0.75rem; }
    .department-table { font-size: 0.72rem; }
    .department-table th, .department-table td { padding: 0.4rem; }
    .payment-section, .history-section { padding: 1rem; }
  }
`;
