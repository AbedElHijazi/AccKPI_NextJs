import sql from 'mssql';
import { sendAppEmail } from '@/lib/email';

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isReservedOrInvalidRecipient(email) {
  const value = String(email || '').trim().toLowerCase();
  if (!value || !value.includes('@')) return true;
  const domain = value.split('@')[1] || '';
  return domain === 'example.com' || domain === 'example.org' || domain === 'example.net';
}

function getReplyToAddress() {
  return process.env.SMTP_USER || process.env.EMAIL_REPLY_TO || 'no-reply@accsal.com';
}

function getFromAddress() {
  const sender = process.env.SMTP_USER || 'no-reply@accsal.com';
  return `ACC Workflow <${sender}>`;
}

/**
 * After the last task in a department is finished and the workflow advances to the next department,
 * send handoff email from system no-reply mailbox to next department mailbox (tblDepartments.DeptEmail).
 */
export async function sendNextDepartmentHandoffNotification(pool, {
  workFlowHdrId,
  priorDepId,
  nextDepId,
  finishDateOnly,
  finishedTaskId,
}) {
  const taskResult = await pool.request()
    .input('finishedTaskId', sql.Int, finishedTaskId)
    .query('SELECT TaskName FROM tblTasks WHERE TaskID = @finishedTaskId');
  const finishedTaskName = taskResult.recordset[0]?.TaskName || 'Task';

  const ctxResult = await pool.request()
    .input('workFlowHdrId', sql.Int, workFlowHdrId)
    .input('priorDepId', sql.Int, priorDepId)
    .input('nextDepId', sql.Int, nextDepId)
    .query(`
      SELECT
        hdr.workFlowID,
        pj.projectName,
        pr.ProcessName,
        dPrior.DeptName AS priorDeptName,
        dNext.DeptName AS nextDeptName,
        dNext.DeptEmail AS nextDeptEmail
      FROM tblWorkflowHdr hdr
      INNER JOIN tblProject pj ON pj.projectID = hdr.projectID
      INNER JOIN tblProcess pr ON pr.NumberOfProccessID = hdr.processID
      LEFT JOIN tblDepartments dPrior ON dPrior.DepartmentID = @priorDepId
      LEFT JOIN tblDepartments dNext ON dNext.DepartmentID = @nextDepId
      WHERE hdr.workFlowID = @workFlowHdrId
    `);
  if (ctxResult.recordset.length === 0) {
    return { sent: false, reason: 'workflow-not-found' };
  }

  const row = ctxResult.recordset[0];

  const toEmail = row.nextDeptEmail ? String(row.nextDeptEmail).trim() : '';
  if (!toEmail) {
    return { sent: false, reason: 'next-department-email-missing' };
  }
  if (isReservedOrInvalidRecipient(toEmail)) {
    return { sent: false, reason: 'next-department-email-invalid', email: toEmail };
  }

  const replyTo = getReplyToAddress();
  const baseUrl = (process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
  const userPageLink = baseUrl ? `${baseUrl}/userpage/${workFlowHdrId}` : '';

  const subject = `Workflow handoff: ${row.projectName || 'Project'} — ${row.nextDeptName || 'Next department'} may start`;

  const lines = [
    `The previous department (${row.priorDeptName || 'prior'}) has completed all tasks for this process step.`,
    '',
    `Project: ${row.projectName || '—'}`,
    `Process: ${row.ProcessName || '—'}`,
    `Workflow ID: ${row.workFlowID}`,
    `Last finished task: ${finishedTaskName}`,
    `Finished (date): ${finishDateOnly}`,
    '',
    `Your department (${row.nextDeptName || 'next'}) is now active in the system.`,
  ];
  const text = lines.join('\n');

  const htmlParts = [
    `<p>${lines.map((l) => (l ? escHtml(l) : '<br/>')).join('<br/>')}</p>`,
  ];
  if (userPageLink) {
    htmlParts.push(`<p><a href="${escHtml(userPageLink)}">Open workflow</a></p>`);
  }
  const html = htmlParts.join('');

  return sendAppEmail({
    to: [toEmail],
    subject,
    text: text + (userPageLink ? `\n\nOpen workflow: ${userPageLink}` : ''),
    html,
    from: getFromAddress(),
    replyTo,
  });
}
