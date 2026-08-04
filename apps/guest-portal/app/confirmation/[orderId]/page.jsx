import PageClient from './PageClient';

async function resolveParams(params) {
  return await params;
}

export default async function ConfirmationPage({ params }) {
  const resolved = await resolveParams(params);
  const orderId = decodeURIComponent(String(resolved?.orderId || ''));

  return <PageClient initialOrderId={orderId} />;
}
