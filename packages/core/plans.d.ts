export type PlanKey = 'basic' | 'silver' | 'gold' | 'diamond';
export type PlanAlias = 'pro' | 'enterprise';
export type WorkspacePlan = PlanKey | PlanAlias;

export interface PlanDefinition {
  key: PlanKey;
  label: string;
  rank: number;
  rateLimit: number;
  maxEvents: number;
  maxStudents?: number;
  features: string[];
  aliases: PlanAlias[];
}

export const PLAN_KEYS: readonly PlanKey[];
export const PLAN_ALIAS_MAP: Readonly<Record<PlanAlias, PlanKey>>;
export const PLAN_DEFINITIONS: Readonly<Record<PlanKey, Readonly<PlanDefinition>>>;

export function normalizePlan(plan?: string | null): PlanKey;
export function getPlanDefinition(plan?: string | null): Readonly<PlanDefinition>;
export function getPlanRank(plan?: string | null): number;
export function hasPlanAccess(plan: string | null | undefined, minPlan?: string | null): boolean;
