export const normalizeInterestedUserGender = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "other";

  if ([
    "female",
    "woman",
    "women",
    "girl",
    "girls",
    "f",
    "cis female",
    "cis woman",
  ].includes(normalized)) {
    return "female";
  }

  if ([
    "male",
    "man",
    "men",
    "boy",
    "boys",
    "m",
    "cis male",
    "cis man",
  ].includes(normalized)) {
    return "male";
  }

  return "other";
};

const takeInterestedUsers = (bucket, count, usedIds) => {
  if (!Array.isArray(bucket) || count <= 0) return [];

  const selected = [];
  for (const user of bucket) {
    if (!user?.id || usedIds.has(user.id)) continue;
    selected.push(user);
    usedIds.add(user.id);
    if (selected.length >= count) break;
  }
  return selected;
};

export const selectInterestedUsersForDisplay = (users = [], limit = 20) => {
  const safeLimit = Math.max(Number(limit) || 0, 0);
  if (safeLimit === 0 || !Array.isArray(users) || users.length === 0) return [];

  const femaleUsers = [];
  const maleUsers = [];
  const otherUsers = [];

  for (const user of users) {
    const bucket = normalizeInterestedUserGender(user?.gender);
    if (bucket === "female") {
      femaleUsers.push(user);
      continue;
    }
    if (bucket === "male") {
      maleUsers.push(user);
      continue;
    }
    otherUsers.push(user);
  }

  const usedIds = new Set();
  const selected = [];
  const preferredFemaleCount = Math.min(Math.round(safeLimit * 0.7), femaleUsers.length);
  const preferredMaleCount = Math.min(safeLimit - preferredFemaleCount, maleUsers.length);

  selected.push(...takeInterestedUsers(femaleUsers, preferredFemaleCount, usedIds));
  selected.push(...takeInterestedUsers(maleUsers, preferredMaleCount, usedIds));

  const fillPools = [femaleUsers, maleUsers, otherUsers];
  for (const pool of fillPools) {
    if (selected.length >= safeLimit) break;
    selected.push(...takeInterestedUsers(pool, safeLimit - selected.length, usedIds));
  }

  return selected.slice(0, safeLimit);
};
