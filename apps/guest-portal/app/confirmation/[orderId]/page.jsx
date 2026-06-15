import PageClient from './PageClient';
import { buildOrderConfirmationView } from '../../../lib/bff/orders.js';
import { isGuestBffEnabled } from '../../../lib/bff/flags.js';

async function resolveParams(params) {
  return await params;
}

function mapConfirmationStatus(result) {
  if (result?.status === 401) return 'unauthorized';
  if (result?.status === 403 || result?.status === 404) return 'missing';
  if (!result?.ok) return 'error';
  return result?.data?.status || 'ready';
}

export default async function ConfirmationPage({ params }) {
  const resolved = await resolveParams(params);
  const orderId = decodeURIComponent(String(resolved?.orderId || ''));

  if (isGuestBffEnabled('confirmation') && orderId) {
    const result = await buildOrderConfirmationView(orderId);
    return (
      <PageClient
        initialConfirmation={result.data}
        initialOrderId={orderId}
        initialStatus={mapConfirmationStatus(result)}
      />
    );
  }

  return <PageClient initialOrderId={orderId} />;
}
