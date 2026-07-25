export interface SosRecipient {
  contactId: string;
  phone: string;
  name: string;
}

export interface SosDeliveryReceipt {
  contactId: string;
  phoneLast4: string;
  provider: 'msg91';
  providerMessageId: string;
  status: 'accepted';
}

function normalizeIndianMobile(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  throw Object.assign(new Error('Emergency contact has an invalid Indian mobile number'), {
    code: 'EMERGENCY_CONTACT_INVALID',
  });
}

export async function sendSosViaMsg91(input: {
  sosId: string;
  userName: string;
  recipients: SosRecipient[];
  latitude?: number;
  longitude?: number;
}): Promise<SosDeliveryReceipt[]> {
  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_SOS_TEMPLATE_ID;
  if (!authKey || !templateId) {
    throw Object.assign(new Error('SOS messaging provider is not configured'), {
      code: 'SOS_PROVIDER_UNAVAILABLE',
    });
  }
  if (input.recipients.length === 0) {
    throw Object.assign(new Error('No verified emergency contacts are available'), {
      code: 'SOS_NO_VERIFIED_CONTACTS',
    });
  }

  const location =
    Number.isFinite(input.latitude) && Number.isFinite(input.longitude)
      ? `https://maps.google.com/?q=${input.latitude},${input.longitude}`
      : 'Location unavailable';

  const deliveries: SosDeliveryReceipt[] = [];
  for (const recipient of input.recipients) {
    const mobile = normalizeIndianMobile(recipient.phone);
    const response = await fetch('https://control.msg91.com/api/v5/flow/', {
      method: 'POST',
      headers: {
        authkey: authKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        template_id: templateId,
        short_url: '0',
        recipients: [
          {
            mobiles: mobile,
            user_name: input.userName,
            location,
            sos_id: input.sosId,
          },
        ],
      }),
    });
    const payload: any = await response.json().catch(() => ({}));
    const providerMessageId = String(payload.request_id || payload.message || '');
    if (!response.ok || payload.type === 'error' || !providerMessageId) {
      throw Object.assign(new Error(payload.message || 'SOS provider rejected the message'), {
        code: 'SOS_PROVIDER_REJECTED',
      });
    }
    deliveries.push({
      contactId: recipient.contactId,
      phoneLast4: mobile.slice(-4),
      provider: 'msg91',
      providerMessageId,
      status: 'accepted',
    });
  }
  return deliveries;
}
