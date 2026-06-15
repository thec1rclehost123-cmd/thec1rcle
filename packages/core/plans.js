const PLAN_KEYS = ['basic', 'silver', 'gold', 'diamond'];

const PLAN_DEFINITIONS = Object.freeze({
  basic: Object.freeze({
    key: 'basic',
    label: 'Basic',
    rank: 0,
    rateLimit: 150,
    maxEvents: 50,
    features: ['analytics'],
    aliases: [],
  }),
  silver: Object.freeze({
    key: 'silver',
    label: 'Silver',
    rank: 1,
    rateLimit: 1000,
    maxEvents: 500,
    maxStudents: 1000,
    features: ['analytics', 'staff', 'orders', 'inventory'],
    aliases: ['pro'],
  }),
  gold: Object.freeze({
    key: 'gold',
    label: 'Gold',
    rank: 2,
    rateLimit: 2500,
    maxEvents: 2500,
    maxStudents: 10000,
    features: ['analytics', 'staff', 'orders', 'inventory', 'advanced_reports'],
    aliases: [],
  }),
  diamond: Object.freeze({
    key: 'diamond',
    label: 'Diamond',
    rank: 3,
    rateLimit: 5000,
    maxEvents: 10000,
    maxStudents: 50000,
    features: ['analytics', 'staff', 'orders', 'inventory', 'advanced_reports', 'api_access'],
    aliases: ['enterprise'],
  }),
});

const PLAN_ALIAS_MAP = Object.freeze({
  pro: 'silver',
  enterprise: 'diamond',
});

export function normalizePlan(plan) {
  if (!plan) return 'basic';

  const normalized = String(plan).toLowerCase();
  if (PLAN_DEFINITIONS[normalized]) return normalized;
  return PLAN_ALIAS_MAP[normalized] || 'basic';
}

export function getPlanDefinition(plan) {
  return PLAN_DEFINITIONS[normalizePlan(plan)];
}

export function getPlanRank(plan) {
  return getPlanDefinition(plan).rank;
}

export function hasPlanAccess(plan, minPlan = 'basic') {
  return getPlanRank(plan) >= getPlanRank(minPlan);
}

export { PLAN_ALIAS_MAP, PLAN_DEFINITIONS, PLAN_KEYS };
