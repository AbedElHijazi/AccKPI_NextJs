import nodemailer from 'nodemailer';

function getEnv(...keys) {
  for (const key of keys) {
    const value = process.env[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return '';
}

function normalizeToList(to) {
  const arr = Array.isArray(to) ? to : [to];
  return [...new Set(arr.map((e) => String(e || '').trim()).filter((e) => e.includes('@')))];
}

function isTransientSmtpError(error) {
  const code = String(error?.code || '').toUpperCase();
  const msg = String(error?.message || '').toUpperCase();
  return code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ESOCKET' || msg.includes('ECONNRESET');
}

export async function sendAppEmail({ to, subject, text, html, from, replyTo }) {
  const recipients = normalizeToList(to);
  if (recipients.length === 0) {
    return { sent: false, reason: 'no-recipients' };
  }

  const smtpHost = getEnv('SMTP_HOST');
  const smtpPort = Number(getEnv('SMTP_PORT') || 587);
  const smtpSecure = getEnv('SMTP_SECURE') === 'true';
  const smtpUser = getEnv('SMTP_USER');
  const smtpPass = getEnv('SMTP_PASS');
  const requireTLS = getEnv('SMTP_REQUIRE_TLS') === 'true';
  const rejectUnauthorized = getEnv('SMTP_TLS_REJECT_UNAUTHORIZED') !== 'false';

  if (!smtpHost) {
    return { sent: false, reason: 'not-configured' };
  }

  const effectiveFrom = from || getEnv('SMTP_FROM', 'EMAIL_FROM') || smtpUser;
  const effectiveReplyTo = replyTo || getEnv('HANDOFF_REPLY_TO', 'EMAIL_REPLY_TO') || undefined;

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    requireTLS,
    auth: smtpUser ? { user: smtpUser, pass: smtpPass || '' } : undefined,
    tls: { rejectUnauthorized },
  });

  const payload = {
    from: effectiveFrom,
    to: recipients.join(','),
    subject,
    text: text || undefined,
    html: html || undefined,
    replyTo: effectiveReplyTo,
  };

  try {
    await transporter.sendMail(payload);
  } catch (error) {
    if (!isTransientSmtpError(error)) throw error;
    await transporter.sendMail(payload);
  }

  return { sent: true, provider: 'smtp' };
}
