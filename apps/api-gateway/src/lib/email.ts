import { randomInt } from 'node:crypto';

export function generateTemporaryPassword(): string {
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowercase = 'abcdefghijkmnopqrstuvwxyz';
  const numbers = '23456789';
  const symbols = '!@#$%&*';

  const all = uppercase + lowercase + numbers + symbols;

  // randomInt uses rejection sampling, so it is unbiased (unlike `bytes % len`).
  const chars: string[] = [
    // Ensure at least one of each category
    uppercase[randomInt(uppercase.length)],
    lowercase[randomInt(lowercase.length)],
    numbers[randomInt(numbers.length)],
    symbols[randomInt(symbols.length)],
  ];

  // Fill the rest up to 12 chars
  for (let i = 0; i < 8; i++) {
    chars.push(all[randomInt(all.length)]);
  }

  // Fisher-Yates shuffle (unbiased) so the guaranteed categories are not
  // always in the first four positions.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}

export async function sendInvitationEmail({
  recipient,
  name,
  roleLabel,
  venueName,
  tempPassword,
  acceptLink,
  setPasswordLink,
}: {
  recipient: string;
  name: string;
  roleLabel: string;
  venueName: string;
  tempPassword: string;
  acceptLink: string;
  setPasswordLink: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Email provider (Resend API key) not configured');
    }
    console.log('\n========================================');
    console.log(`MOCK EMAIL INVITATION for ${recipient}:`);
    console.log(`To: ${name}`);
    console.log(`Venue: ${venueName}`);
    console.log(`Role: ${roleLabel}`);
    console.log(`Temp Password: ${tempPassword}`);
    console.log(`Accept Link: ${acceptLink}`);
    console.log(`Set Password Link: ${setPasswordLink}`);
    console.log('========================================\n');
    return;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'noreply@thec1rcle.com',
      to: recipient,
      subject: `Invitation to join ${venueName} on THE C1RCLE`,
      html: `
        <div style="background-color:#f4f4f5;padding:40px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;min-height:100%;box-sizing:border-box;">
          <div style="background-color:#ffffff;color:#18181b;padding:40px 32px;max-width:560px;margin:0 auto;border-radius:28px;border:1px solid #e4e4e7;box-shadow:0 8px 30px rgba(0,0,0,0.04);text-align:left;box-sizing:border-box;">
            
            <h1 style="font-size:32px;font-weight:800;margin:0 0 20px 0;color:#09090b;letter-spacing:-0.03em;font-family:sans-serif;">You're invited!</h1>
            
            <p style="font-size:16px;line-height:1.6;color:#3f3f46;margin:0 0 24px 0;font-family:sans-serif;">
              You've been invited to join <strong style="color:#09090b;">${venueName}</strong> as a <span style="background-color:#fef3c7;color:#d97706;padding:2px 8px;border-radius:6px;font-weight:bold;font-size:14px;white-space:nowrap;display:inline-block;vertical-align:middle;margin:0 2px;">${roleLabel}</span> on The C1rcle Partner Dashboard.
            </p>
            
            <div style="background-color:#f4f4f5;padding:20px;border-radius:16px;margin:24px 0;border:1px solid #e4e4e7;box-sizing:border-box;">
              <p style="margin:0 0 10px 0;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#71717a;font-weight:bold;font-family:sans-serif;">Temporary Login Credentials</p>
              <p style="margin:5px 0;font-size:14px;color:#18181b;font-family:sans-serif;"><strong>Email:</strong> ${recipient}</p>
              <p style="margin:5px 0;font-size:14px;color:#18181b;font-family:sans-serif;"><strong>Temporary Password:</strong> <code style="background-color:#e4e4e7;padding:3px 6px;border-radius:4px;color:#e11d48;font-weight:bold;font-family:monospace;font-size:13px;">${tempPassword}</code></p>
            </div>
            
            <div style="text-align:center;margin:32px 0 24px 0;">
              <a href="${acceptLink}" style="background:linear-gradient(135deg, #f97316, #e11d48);color:#ffffff;text-decoration:none;padding:16px 36px;font-size:15px;font-weight:bold;border-radius:12px;display:inline-block;box-shadow:0 4px 15px rgba(249,115,22,0.3);text-transform:none;letter-spacing:0;font-family:sans-serif;">Accept Invitation</a>
            </div>

            <p style="font-size:14px;line-height:1.6;color:#3f3f46;text-align:center;margin:20px 0 32px 0;font-family:sans-serif;">
              Alternatively, you can choose to directly accept and set your new password here:<br/>
              <a href="${setPasswordLink}" style="color:#f97316;text-decoration:underline;font-weight:bold;display:inline-block;margin-top:8px;">Set Your Password</a>
            </p>
            
            <p style="font-size:12px;color:#71717a;line-height:1.6;margin:32px 0 16px 0;border-top:1px solid #e4e4e7;padding-top:20px;font-family:sans-serif;">
              This invitation expires in 7 days. If you didn't expect this, you can safely ignore it.
            </p>
            
            <p style="font-size:11px;color:#a1a1aa;word-break:break-all;line-height:1.5;margin:0;font-family:sans-serif;">
              Or copy this link: <a href="${acceptLink}" style="color:#f97316;text-decoration:none;word-break:break-all;">${acceptLink}</a>
            </p>
            
          </div>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('Resend API error:', response.status, errorData);
    throw new Error(errorData.message || 'Unable to send invitation email.');
  }
}

export async function sendHostInvitationEmail({
  recipient,
  name,
  roleLabel,
  partnerName,
  acceptLink,
}: {
  recipient: string;
  name: string;
  roleLabel: string;
  partnerName: string;
  acceptLink: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Email provider (Resend API key) not configured');
    }
    console.log('\n========================================');
    console.log(`MOCK EMAIL INVITATION for ${recipient}:`);
    console.log(`To: ${name}`);
    console.log(`Host: ${partnerName}`);
    console.log(`Role: ${roleLabel}`);
    console.log(`Accept Link: ${acceptLink}`);
    console.log('========================================\n');
    return;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'noreply@thec1rcle.com',
      to: recipient,
      subject: `Invitation to join ${partnerName} on THE C1RCLE`,
      html: `
        <div style="background-color:#f4f4f5;padding:40px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;min-height:100%;box-sizing:border-box;">
          <div style="background-color:#ffffff;color:#18181b;padding:40px 32px;max-width:560px;margin:0 auto;border-radius:28px;border:1px solid #e4e4e7;box-shadow:0 8px 30px rgba(0,0,0,0.04);text-align:left;box-sizing:border-box;">
            
            <h1 style="font-size:32px;font-weight:800;margin:0 0 20px 0;color:#09090b;letter-spacing:-0.03em;font-family:sans-serif;">You're invited!</h1>
            
            <p style="font-size:16px;line-height:1.6;color:#3f3f46;margin:0 0 24px 0;font-family:sans-serif;">
              You've been invited to join the host team <strong style="color:#09090b;">${partnerName}</strong> as a <span style="background-color:#fef3c7;color:#d97706;padding:2px 8px;border-radius:6px;font-weight:bold;font-size:14px;white-space:nowrap;display:inline-block;vertical-align:middle;margin:0 2px;">${roleLabel}</span> on The C1rcle Partner Dashboard.
            </p>
            
            <div style="text-align:center;margin:32px 0 24px 0;">
              <a href="${acceptLink}" style="background:linear-gradient(135deg, #f97316, #e11d48);color:#ffffff;text-decoration:none;padding:16px 36px;font-size:15px;font-weight:bold;border-radius:12px;display:inline-block;box-shadow:0 4px 15px rgba(249,115,22,0.3);text-transform:none;letter-spacing:0;font-family:sans-serif;">Accept Invitation</a>
            </div>
            
            <p style="font-size:12px;color:#71717a;line-height:1.6;margin:32px 0 16px 0;border-top:1px solid #e4e4e7;padding-top:20px;font-family:sans-serif;">
              If you didn't expect this, you can safely ignore it.
            </p>
            
            <p style="font-size:11px;color:#a1a1aa;word-break:break-all;line-height:1.5;margin:0;font-family:sans-serif;">
              Or copy this link: <a href="${acceptLink}" style="color:#f97316;text-decoration:none;word-break:break-all;">${acceptLink}</a>
            </p>
            
          </div>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('Resend API error:', response.status, errorData);
    throw new Error(errorData.message || 'Unable to send invitation email.');
  }
}
