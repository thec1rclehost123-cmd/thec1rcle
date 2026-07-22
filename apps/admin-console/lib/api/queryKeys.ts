export const queryKeys = {
  dashboard: {
    all: ['dashboard'] as const,
    kpi: () => [...queryKeys.dashboard.all, 'kpi'] as const,
  },
  users: {
    all: ['users'] as const,
    list: (params?: Record<string, string>) => [...queryKeys.users.all, 'list', params] as const,
    detail: (uid: string) => [...queryKeys.users.all, 'detail', uid] as const,
  },
  refunds: {
    all: ['refunds'] as const,
    list: (status: string) => [...queryKeys.refunds.all, 'list', status] as const,
  },
  kyc: {
    all: ['kyc'] as const,
    list: () => [...queryKeys.kyc.all, 'list'] as const,
    detail: (uid: string) => [...queryKeys.kyc.all, 'detail', uid] as const,
  },
  security: {
    all: ['security'] as const,
    incidents: (params?: Record<string, string>) =>
      [...queryKeys.security.all, 'incidents', params] as const,
    overview: () => [...queryKeys.security.all, 'overview'] as const,
    unblock: () => [...queryKeys.security.all, 'unblock'] as const,
  },
  events: {
    all: ['events'] as const,
    list: (params?: Record<string, string>) => [...queryKeys.events.all, 'list', params] as const,
  },
  venues: {
    all: ['venues'] as const,
    list: (params?: Record<string, string>) => [...queryKeys.venues.all, 'list', params] as const,
  },
  hosts: {
    all: ['hosts'] as const,
    list: (params?: Record<string, string>) => [...queryKeys.hosts.all, 'list', params] as const,
  },
  approvals: {
    all: ['approvals'] as const,
    list: () => [...queryKeys.approvals.all, 'list'] as const,
  },
  proposals: {
    all: ['proposals'] as const,
    list: () => [...queryKeys.proposals.all, 'list'] as const,
  },
  logs: {
    all: ['logs'] as const,
    list: (params?: Record<string, string>) => [...queryKeys.logs.all, 'list', params] as const,
  },
  content: {
    all: ['content'] as const,
    list: () => [...queryKeys.content.all, 'list'] as const,
    curation: () => [...queryKeys.content.all, 'curation'] as const,
    explore: () => [...queryKeys.content.all, 'explore'] as const,
  },
  payments: {
    all: ['payments'] as const,
    list: (params?: Record<string, string>) =>
      [...queryKeys.payments.all, 'list', params] as const,
  },
  admins: {
    all: ['admins'] as const,
    list: () => [...queryKeys.admins.all, 'list'] as const,
  },
  promoters: {
    all: ['promoters'] as const,
    list: () => [...queryKeys.promoters.all, 'list'] as const,
  },
  promotions: {
    all: ['promotions'] as const,
    list: () => [...queryKeys.promotions.all, 'list'] as const,
  },
  health: {
    all: ['health'] as const,
  },
  actions: {
    all: ['actions'] as const,
  },
};
