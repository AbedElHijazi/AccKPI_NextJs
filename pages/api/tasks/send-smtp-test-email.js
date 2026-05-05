import { sendAppEmail } from '@/lib/email';

function getEnv(...keys) {
  for (const key of keys) {
    const value = process.env[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return '';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const from = getEnv('SMTP_USER', 'SMTPUserName') || 'no-reply@accsal.com';
    const to = 'omar.zrayka@accsal.com';
    const now = new Date().toISOString();
    console.log('to', to);
    console.log('from', from);
    const result = await sendAppEmail({
      to: [to],
      from: `ACC Workflow <${from}>`,
      replyTo: from,
      subject: 'SMTP department-to-department test',
      text: `SMTP test email sent at ${now}\nFrom: ${from}\nTo: ${to}`,
      html: `<p><strong>SMTP test email</strong></p><p>Sent at: ${now}</p><p>From: ${from}</p><p>To: ${to}</p>`,
      transport: 'smtp',
    });

   
    console.log('result', result);

    if (!result?.sent) {
      return res.status(500).json({ error: 'Email not sent', details: result });
    }

    return res.status(200).json({
      message: 'SMTP test email sent successfully',
      from,
      to,
      result,
    });
  } catch (error) {
    console.error('send-smtp-test-email error:', error);
    return res.status(500).json({ error: error.message || 'Failed to send SMTP test email' });
  }
}
