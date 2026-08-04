/**
 * Shared transform for the per-event computed analytics contract.
 * Converts the gateway /analytics/event/:id/computed response (plus optional
 * finance enrichment) into the normalizeAnalyticsV2 shape used by the
 * EventAnalyticsClient. Used by both the venue and host BFF routes.
 */

function buildRevenueTimeline(salesTimeline: any[], days = 30) {
  const byDate = new Map<string, number>();
  for (const p of salesTimeline) {
    const raw = String(p.date ?? p.label ?? '');
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
    byDate.set(iso ?? raw, Number(p.revenue ?? 0));
  }
  const now = new Date();
  const result: { date: string; gross: number; net: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - (days - 1 - i));
    const iso = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const value = byDate.get(iso) ?? 0;
    result.push({ date: label, gross: value, net: value });
  }
  return result;
}

export function transformComputedAnalytics(
  data: Record<string, any>,
  finance: Record<string, any>,
) {
  const totalRevenue = data.totalRevenue ?? 0;
  const ticketsSold = data.ticketsSold ?? 0;
  const totalCheckIns = data.totalCheckIns ?? 0;
  const guestlistSignups = data.guestlistSignups ?? 0;
  const capacity = data.capacity ?? 0;
  const views = data.views ?? 0;
  const refundAmount = data.refundAmount ?? 0;
  const repeatGuests = data.repeatGuests ?? 0;
  const salesTimeline = Array.isArray(data.salesTimeline) ? data.salesTimeline : [];
  const hourlyTimeline = Array.isArray(data.hourlyTimeline) ? data.hourlyTimeline : [];
  const netFinance = finance?.net ?? 0;

  return {
    dataReady: totalRevenue > 0 || ticketsSold > 0 || totalCheckIns > 0 || views > 0,
    totalRevenue,
    totalNetPayable: netFinance || totalRevenue,
    ticketsSold,
    totalCheckIns,
    guestlistSignups,
    capacity,
    views,
    avgTicketPrice: data.avgTicketPrice ?? 0,
    occupancyRate: data.occupancyRate ?? 0,
    sellThroughRate: data.sellThroughRate ?? 0,
    refundAmount,
    refundRate: data.refundRate ?? 0,
    noShowRate: data.noShowRate ?? 0,
    repeatGuests,
    repeatGuestRate: data.repeatGuestRate ?? 0,
    firstTimeGuestRate: data.firstTimeGuestRate ?? 0,
    promoterDrivenSales: 0,
    directSales: totalRevenue,
    pendingPayout: finance?.settlementStatus === 'paid' ? 0 : netFinance || totalRevenue,
    completedPayout: finance?.settlementStatus === 'paid' ? netFinance || totalRevenue : 0,
    profitEstimate: netFinance,
    contributionMargin: totalRevenue > 0 ? (netFinance / totalRevenue) * 100 : 0,
    purchaseToArrival: data.purchaseToArrival ?? 0,
    guestlistToArrival: data.guestlistToArrival ?? 0,
    viewToPurchase: data.viewToPurchase ?? 0,
    viewToGuestlist: data.viewToGuestlist ?? 0,
    uniqueAttendees: repeatGuests || 0,
    newGuests: 0,
    totalScans: totalCheckIns,
    revenueTimeline: buildRevenueTimeline(salesTimeline),
    ticketsTimeline: salesTimeline.map((p: any) => ({
      date: p.date ?? p.label,
      tickets: Number(p.tickets ?? 0),
    })),
    revenueByTicketType: Array.isArray(data.ticketMix)
      ? data.ticketMix.map((t: any) => ({
          type: t.tierName ?? 'General',
          revenue: Number(t.revenue ?? 0),
          pct: totalRevenue > 0 ? (Number(t.revenue ?? 0) / totalRevenue) * 100 : 0,
        }))
      : [],
    revenueByPhase:
      data.salesByPhase && typeof data.salesByPhase === 'object'
        ? Object.entries(data.salesByPhase).map(([phase, v]: any) => ({
            phase,
            revenue: Number(v?.revenue ?? 0),
            ticketsSold: Number(v?.ticketsSold ?? 0),
            pct: totalRevenue > 0 ? (Number(v?.revenue ?? 0) / totalRevenue) * 100 : 0,
          }))
        : [],
    funnel: [
      { stage: 'Page Views', count: views },
      { stage: 'Guestlist Starts', count: guestlistSignups },
      { stage: 'Purchases', count: ticketsSold },
      { stage: 'Arrived & Checked In', count: totalCheckIns },
    ],
    entryCurve: hourlyTimeline.map((p: any) => ({
      hour: p.label ?? `${p.hour}:00`,
      count: Number(p.checkIns ?? 0),
      pct: totalCheckIns > 0 ? (Number(p.checkIns ?? 0) / totalCheckIns) * 100 : 0,
    })),
    peakArrivalWindow: data.peakCheckInHour?.label ?? '—',
    scanSuccessRate: data.purchaseToArrival ?? 0,
  };
}
