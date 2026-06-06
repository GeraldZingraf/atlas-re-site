// Shared SMTP sender (Gmail, app-password auth). nodemailer is imported dynamically
// so a bundling/resolution failure surfaces as a catchable runtime error rather than
// crashing the function at module load.

export async function sendMail(env, { to, subject, text, bcc }) {
  const sender = env.ATLAS_EMAIL;
  const pass = env.ATLAS_APP_PASSWORD;
  if (!sender || !pass) throw new Error('ATLAS_EMAIL / ATLAS_APP_PASSWORD not set in Netlify env');
  if (!to) throw new Error('sendMail: missing "to"');
  const nodemailer = (await import('nodemailer')).default;
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(env.SMTP_PORT || '587', 10),
    secure: false,
    requireTLS: true,
    auth: { user: sender, pass },
  });
  await transport.sendMail({
    from: `Atlas <${sender}>`,
    to,
    bcc: bcc || undefined,
    subject,
    text,
  });
}
