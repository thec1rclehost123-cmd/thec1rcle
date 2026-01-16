import { getAdminDb } from "../firebase/admin";

/**
 * THE C1RCLE Insights Engine (v1)
 * Rule-based diagnostic layer that answers "Why" things happened.
 */

export async function generateEventInsights(eventId, rollups = []) {
    if (!rollups || rollups.length === 0) return [];

    const insights = [];

    // Aggregated totals from rollups
    const totalJoins = rollups.reduce((sum, r) => sum + (r.metrics?.demand_joins || 0), 0);
    const totalEntries = rollups.reduce((sum, r) => sum + (r.metrics?.entries || 0), 0);
    const totalConversions = rollups.reduce((sum, r) => sum + (r.metrics?.conversions || 0), 0);
    const totalDenials = rollups.reduce((sum, r) => sum + (r.metrics?.denied_scans || 0), 0);
    const totalIssued = rollups[0]?.metrics?.issued || 0; // Assume constant or use max

    // Rule 1: High Demand, Low Conversion
    const conversionRate = totalJoins > 0 ? (totalConversions / totalJoins) * 100 : 100;
    if (totalJoins > 200 && conversionRate < 10) {
        insights.push({
            insightId: "HIGH_DEMAND_LOW_CONV",
            severity: "warning",
            title: "People are interested but not buying",
            explanation: `Many people joined the queue (${totalJoins}), but only ${conversionRate.toFixed(1)}% finished buying. This usually means the price is too high or the checkout is too slow.`,
            supportingMetrics: { totalJoins, conversionRate },
            suggestedAction: {
                text: "Consider lowering the price or making the booking form shorter for the next event."
            }
        });
    }

    // Rule 2: RSVP-Heavy, Entry-Light (No-Show Alert)
    const turnoutRate = totalIssued > 0 ? (totalEntries / totalIssued) * 100 : 100;
    if (totalIssued > 100 && turnoutRate < 40) {
        insights.push({
            insightId: "RSVP_NO_SHOW_SPIKE",
            severity: "critical",
            title: "Too many people didn't show up",
            explanation: `Only ${turnoutRate.toFixed(1)}% of people who took a ticket actually came. You have an empty room because people took tickets they didn't use.`,
            supportingMetrics: { totalIssued, totalEntries, turnoutRate },
            suggestedAction: {
                text: "You may want to charge a small ₹500 deposit next time so only serious people book."
            }
        });
    }

    // Rule 3: Gate Denial Spike
    const totalAttempts = totalEntries + totalDenials;
    const denialRate = totalAttempts > 0 ? (totalDenials / totalAttempts) * 100 : 0;
    if (denialRate > 15) {
        insights.push({
            insightId: "GATE_DENIAL_SPIKE",
            severity: "critical",
            title: "Too many people rejected at door",
            explanation: `Mistake at gate: ${denialRate.toFixed(1)}% of people were turned away. This makes guests angry and stresses out security.`,
            supportingMetrics: { totalDenials, denialRate },
            suggestedAction: {
                text: "Brief your gate staff on entry rules or check if people are sharing tickets."
            }
        });
    }

    // Rule 4: Late-night arrival clustering
    for (const rollup of rollups) {
        if (rollup.bucketType === "1h") {
            const bucketHour = new Date(rollup.bucketStartIST).getHours();
            const bucketEntries = rollup.metrics?.entries || 0;
            const concentration = totalEntries > 0 ? (bucketEntries / totalEntries) * 100 : 0;

            // Peak clusters after 11:30 PM (23:30)
            if (bucketHour >= 23 && concentration > 35) {
                insights.push({
                    insightId: "LATE_NIGHT_CLUSTER",
                    severity: "warning",
                    title: "Late-night arrival rush",
                    explanation: `A large ${concentration.toFixed(1)}% of your crowd is arriving after 11:00 PM. This pushes your peak operations into the late hours, increasing risk.`,
                    supportingMetrics: { bucketEntries, concentration },
                    suggestedAction: {
                        text: "Consider early-entry drink rewards or 'Arrival Credits' for guests who check in before 10 PM."
                    }
                });
                break;
            }
        }
    }

    // Rule 5: Refund Rate Spike (Revenue Health)
    // Assume we track refunds in metrics or calculate from ledger if needed
    // For now, use a placeholder logic if metrics.refunds exists
    const totalRefunds = rollups.reduce((sum, r) => sum + (r.metrics?.total_refunds || 0), 0);
    const refundRate = totalConversions > 0 ? (totalRefunds / totalConversions) * 100 : 0;
    if (refundRate > 10) {
        insights.push({
            insightId: "REFUND_SPIKE",
            severity: "critical",
            title: "Abnormal Refund Rate",
            explanation: `Your refund rate is at ${refundRate.toFixed(1)}%, which is above the usual limit of 5%. This often means people were unhappy with the event or entry policy.`,
            supportingMetrics: { totalRefunds, refundRate },
            suggestedAction: {
                text: "Review your event description or check for recent negative feedback regarding door policy."
            }
        });
    }

    // Rule 6: Dangerous Entry Spike
    for (const rollup of rollups) {
        if (rollup.bucketType === "1h") {
            const bucketEntries = rollup.metrics?.entries || 0;
            const concentration = totalEntries > 0 ? (bucketEntries / totalEntries) * 100 : 0;
            if (concentration > 40) {
                insights.push({
                    insightId: "ENTRY_CONGESTION",
                    severity: "warning",
                    title: "Dangerous rush at the gate",
                    explanation: `${concentration.toFixed(1)}% of your crowd arrived at the same time (${rollup.bucketStartIST}). The gate cannot handle this rush safely.`,
                    supportingMetrics: { bucketEntries, concentration },
                    suggestedAction: {
                        text: "Add one additional gate staff during this peak arrival window next time.",
                        context: { timeWindow: rollup.bucketStartIST }
                    }
                });
                break;
            }
        }
    }


    return insights;
}

