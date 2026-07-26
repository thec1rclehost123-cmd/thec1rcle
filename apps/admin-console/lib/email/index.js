import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function sendTicketEmail({
  to,
  userName,
  eventName,
  eventDate,
  eventLocation,
  eventPosterUrl,
  orderId,
  tickets,
  totalAmount,
}) {
  console.warn('sendTicketEmail is not supported in admin-console (missing TicketEmail template).');
  return { success: false, error: 'Not supported in admin-console' };
}

export async function sendAdminInvitationEmail({
  to,
  name,
  roleLabel,
  acceptLink,
  setPasswordLink = null,
}) {
  if (!resend) {
    console.warn('Resend API key not found. Skipping email send (mock).');
    return { success: true, mock: true };
  }

  const fromAddr = 'THE C1RCLE <noreply@thec1rcle.com>';

  // setPasswordLink is a genuine Firebase-signed, single-use, time-limited
  // reset link -- only present for a brand-new account. No password value is
  // ever generated for transmission; the recipient sets their own. A
  // re-invite of an email that already has Firebase Auth credentials (e.g.
  // reactivating a suspended admin) must never touch their existing password,
  // hence no link in that case either.
  const credentialBlock = setPasswordLink
    ? `
            <div style="background-color:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:24px;margin:28px 0;text-align:center;box-sizing:border-box;">
              <span style="font-size:11px;color:#71717a;letter-spacing:0.1em;font-weight:bold;text-transform:uppercase;display:block;margin-bottom:12px;">Set Your Password</span>
              <a href="${setPasswordLink}" style="background-color:rgba(99,102,241,0.15);color:#818cf8;text-decoration:none;padding:12px 24px;font-size:13px;font-weight:bold;border-radius:8px;display:inline-block;border:1px solid rgba(99,102,241,0.3);text-transform:uppercase;letter-spacing:0.05em;">Choose a Password</a>
              <span style="font-size:11px;color:#71717a;display:block;margin-top:12px;">This link is single-use and expires shortly. Use it before accepting the invitation below.</span>
            </div>
          `
    : `
            <div style="background-color:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:24px;margin:28px 0;text-align:center;box-sizing:border-box;">
              <span style="font-size:13px;color:#a1a1aa;line-height:1.6;">Sign in with your existing password. Use "Forgot password" on the login screen if you no longer have it.</span>
            </div>
          `;

  try {
    const data = await resend.emails.send({
      from: fromAddr,
      to: [to],
      subject: 'Invitation to join THE C1RCLE Admin Team',
      html: `
        <div style="background-color:#0d0d0f;padding:40px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;min-height:100vh;color:#ffffff;box-sizing:border-box;">
          <div style="background-color:#141416;color:#ffffff;padding:40px 32px;max-width:560px;margin:0 auto;border-radius:28px;border:1px solid rgba(255,255,255,0.06);box-shadow:0 8px 30px rgba(0,0,0,0.5);text-align:left;box-sizing:border-box;">
            <div style="text-align:center;margin-bottom:32px;">
              <h2 style="color:#ffffff;font-size:24px;font-weight:900;letter-spacing:0.1em;margin:0;text-transform:uppercase;">THE C1RCLE</h2>
              <span style="font-size:10px;color:#a1a1aa;letter-spacing:0.2em;font-weight:bold;text-transform:uppercase;display:block;margin-top:6px;">Administrative Node</span>
            </div>

            <h1 style="font-size:28px;font-weight:800;margin:0 0 20px 0;color:#ffffff;letter-spacing:-0.02em;">You're Invited</h1>

            <p style="font-size:15px;line-height:1.6;color:#a1a1aa;margin:0 0 24px 0;">
              Hello ${name || 'Team Member'},<br/><br/>
              You have been invited to join the administrative team on <strong>THE C1RCLE</strong> with
              <span style="background-color:rgba(99,102,241,0.15);color:#818cf8;padding:4px 10px;border-radius:6px;font-weight:bold;font-size:13px;white-space:nowrap;display:inline-block;margin:0 2px;text-transform:uppercase;letter-spacing:0.05em;">${roleLabel}</span> authority.
            </p>

            ${credentialBlock}

            <div style="text-align:center;margin:32px 0 28px 0;">
              <a href="${acceptLink}" style="background-color:#ffffff;color:#000000;text-decoration:none;padding:16px 36px;font-size:14px;font-weight:black;border-radius:12px;display:inline-block;box-shadow:0 4px 20px rgba(255,255,255,0.15);text-transform:uppercase;letter-spacing:0.1em;">Accept Invitation</a>
            </div>
            
            <p style="font-size:12px;color:#52525b;line-height:1.6;margin:32px 0 16px 0;border-top:1px solid rgba(255,255,255,0.06);padding-top:20px;">
              If you did not request or expect this invitation, you can safely ignore this email.
            </p>
            
            <p style="font-size:11px;color:#3f3f46;word-break:break-all;line-height:1.5;margin:0;">
              Or copy this link: <a href="${acceptLink}" style="color:#818cf8;text-decoration:none;word-break:break-all;">${acceptLink}</a>
            </p>
          </div>
        </div>
      `,
    });

    console.log('Invitation email sent successfully:', data);
    return { success: true, data };
  } catch (error) {
    console.error('Failed to send invitation email:', error);
    return { success: false, error };
  }
}
