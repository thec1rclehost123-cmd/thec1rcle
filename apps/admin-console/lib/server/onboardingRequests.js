function requestIdentity(request) {
  const data = request?.data || {};
  const type = String(request?.type || request?.entityType || data.type || 'partner').toLowerCase();
  const applicant = String(
    request?.uid ||
      request?.applicantUserId ||
      request?.ownerUid ||
      data.uid ||
      data.email ||
      request?.id ||
      '',
  ).toLowerCase();
  return `${type}:${applicant}`;
}

function timestamp(value) {
  if (!value) return 0;
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (typeof value === 'object' && Number.isFinite(value.seconds)) return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function requestTime(request) {
  return Math.max(
    timestamp(request?.updatedAt),
    timestamp(request?.reviewedAt),
    timestamp(request?.submittedAt),
    timestamp(request?.createdAt),
  );
}

export function dedupeCurrentOnboardingRequests(requests) {
  const groups = new Map();
  for (const request of requests) {
    const key = requestIdentity(request);
    const current = groups.get(key) || [];
    current.push(request);
    groups.set(key, current);
  }

  return [...groups.values()]
    .map((group) => {
      const sorted = [...group].sort((left, right) => requestTime(right) - requestTime(left));
      const current = sorted.find((request) => request.status === 'approved') || sorted[0];
      return {
        ...current,
        attemptCount: sorted.length,
        duplicateRequestIds: sorted
          .filter((request) => request.id !== current.id)
          .map((request) => request.id),
      };
    })
    .sort((left, right) => requestTime(right) - requestTime(left));
}
