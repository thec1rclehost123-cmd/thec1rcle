/**
 * Register Store (Refactored for API Governance)
 *
 * Uses the unified C1rcleApiClient to manage daily venue operational registers.
 * All DB access moved to API Gateway's /registers routes.
 */

import { getApiClient } from "./apiClient";

export async function getDateRegister(venueId, date, token) {
  const client = getApiClient(token);
  try {
    return await client.getDateRegister(venueId, date);
  } catch (error) {
    console.error("[RegisterStore] getDateRegister failed:", error.message);
    return null;
  }
}

export async function updateRegisterNotes(venueId, date, noteType, content, updatedBy, token) {
  const client = getApiClient(token);
  return client.updateRegister(venueId, date, {
    [`notes.${noteType}`]: content,
    lastUpdatedBy: updatedBy,
  });
}

export async function updateExpectedFootfall(venueId, date, count, updatedBy, token) {
  const client = getApiClient(token);
  return client.updateRegister(venueId, date, {
    expectedFootfall: count,
    lastUpdatedBy: updatedBy,
  });
}

export async function addStaffAssignment(venueId, date, assignment, token) {
  const client = getApiClient(token);
  const register = await getDateRegister(venueId, date, token);
  const staffAssignments = [
    ...(register?.staffAssignments || []),
    {
      id: crypto.randomUUID(),
      ...assignment,
      confirmed: false,
      createdAt: new Date().toISOString(),
    },
  ];
  return client.updateRegister(venueId, date, { staffAssignments });
}

export async function logIncident(venueId, date, incident, reportedBy, token) {
  const client = getApiClient(token);
  const register = await getDateRegister(venueId, date, token);
  const incidents = [
    ...(register?.incidents || []),
    {
      id: crypto.randomUUID(),
      ...incident,
      reportedBy: { uid: reportedBy.uid, name: reportedBy.name || "" },
      resolved: false,
      timestamp: new Date().toISOString(),
    },
  ];
  return client.updateRegister(venueId, date, { incidents });
}

export async function addReminder(venueId, date, reminder, createdBy, token) {
  const client = getApiClient(token);
  const register = await getDateRegister(venueId, date, token);
  const reminders = [
    ...(register?.reminders || []),
    {
      id: crypto.randomUUID(),
      ...reminder,
      completed: false,
      createdBy: { uid: createdBy.uid, name: createdBy.name || "" },
      createdAt: new Date().toISOString(),
    },
  ];
  return client.updateRegister(venueId, date, { reminders });
}

export async function updateDayClose(venueId, date, closeData, closedBy, token) {
  const client = getApiClient(token);
  return client.updateRegister(venueId, date, {
    actualFootfall: closeData.actualFootfall || 0,
    revenue: closeData.revenue || {},
    status: "completed",
    closedAt: new Date().toISOString(),
    closedBy: { uid: closedBy.uid, name: closedBy.name || "" },
  });
}

export async function getRegistersForRange(venueId, startDate, endDate, token) {
  const client = getApiClient(token);
  try {
    return await client.getRegistersForRange(venueId, startDate, endDate);
  } catch (error) {
    console.error("[RegisterStore] getRegistersForRange failed:", error.message);
    return [];
  }
}
export async function removeStaffAssignment(venueId, date, assignmentId, token) {
  const client = getApiClient(token);
  const register = await getDateRegister(venueId, date, token);
  const staffAssignments = (register?.staffAssignments || []).filter((a) => a.id !== assignmentId);
  return client.updateRegister(venueId, date, { staffAssignments });
}

export async function resolveIncident(venueId, date, incidentId, resolution, user, token) {
  const client = getApiClient(token);
  const register = await getDateRegister(venueId, date, token);
  const incidents = (register?.incidents || []).map((inc) => {
    if (inc.id === incidentId) {
      return {
        ...inc,
        resolved: true,
        resolution,
        resolvedBy: { uid: user.uid, name: user.name || "" },
        resolvedAt: new Date().toISOString(),
      };
    }
    return inc;
  });
  return client.updateRegister(venueId, date, { incidents });
}

export async function completeReminder(venueId, date, reminderId, user, token) {
  const client = getApiClient(token);
  const register = await getDateRegister(venueId, date, token);
  const reminders = (register?.reminders || []).map((rem) => {
    if (rem.id === reminderId) {
      return {
        ...rem,
        completed: true,
        completedBy: { uid: user.uid, name: user.name || "" },
        completedAt: new Date().toISOString(),
      };
    }
    return rem;
  });
  return client.updateRegister(venueId, date, { reminders });
}

export async function addInspection(venueId, date, inspection, user, token) {
  const client = getApiClient(token);
  const register = await getDateRegister(venueId, date, token);
  const inspections = [
    ...(register?.inspections || []),
    {
      id: crypto.randomUUID(),
      ...inspection,
      inspector: { uid: user.uid, name: user.name || "" },
      createdAt: new Date().toISOString(),
    },
  ];
  return client.updateRegister(venueId, date, { inspections });
}

export async function getIncidentSummary(venueId, startDate, endDate, token) {
  const registers = await getRegistersForRange(venueId, startDate, endDate, token);
  const allIncidents = registers.flatMap((r) =>
    (r.incidents || []).map((i) => ({ ...i, date: r.date })),
  );

  return {
    total: allIncidents.length,
    resolved: allIncidents.filter((i) => i.resolved).length,
    pending: allIncidents.filter((i) => !i.resolved).length,
    incidents: allIncidents,
  };
}

export default {
  getDateRegister,
  updateRegisterNotes,
  updateExpectedFootfall,
  addStaffAssignment,
  removeStaffAssignment,
  logIncident,
  resolveIncident,
  addInspection,
  addReminder,
  completeReminder,
  updateDayClose,
  getRegistersForRange,
  getIncidentSummary,
};
