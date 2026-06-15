'use client';

import { CalendarClock, CheckCircle2, Zap, Star, Building2, AlertCircle, Info } from 'lucide-react';

const PLANS = [
  {
    name: 'Starter',
    badge: null,
    price: 'Coming Soon',
    billing: 'per month',
    description: 'For independent venues just getting started.',
    features: [
      'Up to 5 events per month',
      'Basic analytics dashboard',
      'Guest portal listing',
      'Email support',
    ],
    cta: 'Get Notified',
    accent: 'var(--v-text-tertiary)',
    accentBg: 'rgba(255,255,255,0.04)',
  },
  {
    name: 'Growth',
    badge: 'Popular',
    price: 'Coming Soon',
    billing: 'per month',
    description: 'For venues running regular events with promoter networks.',
    features: [
      'Unlimited events',
      'Promoter commission management',
      'CRM & WhatsApp marketing',
      'Revenue split automation',
      'Priority support',
    ],
    cta: 'Get Notified',
    accent: '#F44A22',
    accentBg: 'rgba(244,74,34,0.08)',
  },
  {
    name: 'Scale',
    badge: 'Enterprise',
    price: 'Custom',
    billing: 'contact sales',
    description: 'For multi-venue groups and large-format event organizers.',
    features: [
      'Everything in Growth',
      'Multi-venue dashboard',
      'Custom revenue split rules',
      'Dedicated account manager',
      'White-label ticketing',
      'SLA guarantee',
    ],
    cta: 'Contact Sales',
    accent: '#818CF8',
    accentBg: 'rgba(129,140,248,0.08)',
  },
];

export function SubscriptionClient() {
  return (
    <div className="space-y-6">
      {/* Status banner */}
      <div
        className="flex items-start gap-3 rounded-2xl p-4"
        style={{ background: 'rgba(129,140,248,0.08)', border: '1px solid rgba(129,140,248,0.18)' }}
      >
        <Info className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#818CF8' }} />
        <div>
          <p className="text-[13px] font-semibold" style={{ color: '#818CF8' }}>
            Subscription billing is coming soon
          </p>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--v-text-secondary)' }}>
            Once active, your plan cost will be automatically debited from your C1RCLE wallet on the
            same date each month. You can cancel or upgrade anytime.
          </p>
        </div>
      </div>

      {/* Current subscription state */}
      <div
        className="rounded-2xl p-5 flex items-center gap-4"
        style={{ background: 'var(--v-card)', border: '1px solid var(--v-border)' }}
      >
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--v-border)' }}
        >
          <CalendarClock className="w-6 h-6" style={{ color: 'var(--v-text-tertiary)' }} />
        </div>
        <div className="flex-1">
          <p className="text-[14px] font-semibold" style={{ color: 'var(--v-text-primary)' }}>
            No active subscription
          </p>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--v-text-tertiary)' }}>
            Choose a plan below to unlock full platform features.
          </p>
        </div>
        <div
          className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest"
          style={{
            background: 'rgba(255,255,255,0.04)',
            color: 'var(--v-text-tertiary)',
            border: '1px solid var(--v-border)',
          }}
        >
          Inactive
        </div>
      </div>

      {/* How billing works */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          {
            icon: CalendarClock,
            title: 'Auto-debit monthly',
            desc: 'Subscription fee is automatically deducted from your C1RCLE wallet on the same date every month.',
          },
          {
            icon: AlertCircle,
            title: 'Low balance alerts',
            desc: "You'll receive a notification 7 days before billing if your wallet balance is insufficient.",
          },
          {
            icon: Zap,
            title: 'Instant activation',
            desc: 'Features activate immediately after successful billing. Cancellation takes effect at period end.',
          },
        ].map((item) => (
          <div
            key={item.title}
            className="rounded-xl p-4 flex flex-col gap-2"
            style={{ background: 'var(--v-card)', border: '1px solid var(--v-border)' }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(244,74,34,0.1)' }}
            >
              <item.icon className="w-4 h-4" style={{ color: '#F44A22' }} />
            </div>
            <p className="text-[13px] font-semibold" style={{ color: 'var(--v-text-primary)' }}>
              {item.title}
            </p>
            <p className="text-[12px] leading-relaxed" style={{ color: 'var(--v-text-tertiary)' }}>
              {item.desc}
            </p>
          </div>
        ))}
      </div>

      {/* Plan cards */}
      <div>
        <p
          className="text-[11px] font-bold uppercase tracking-widest mb-3"
          style={{ color: 'var(--v-text-tertiary)' }}
        >
          Available Plans
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className="rounded-2xl p-5 flex flex-col gap-4 relative overflow-hidden"
              style={{
                background: plan.accentBg,
                border: `1px solid ${plan.accent === '#F44A22' ? 'rgba(244,74,34,0.25)' : 'var(--v-border)'}`,
              }}
            >
              {plan.badge && (
                <div
                  className="absolute top-4 right-4 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest"
                  style={{
                    background: plan.accent === '#F44A22' ? '#F44A22' : 'rgba(129,140,248,0.2)',
                    color: plan.accent === '#F44A22' ? '#fff' : '#818CF8',
                  }}
                >
                  {plan.badge}
                </div>
              )}

              <div>
                <p
                  className="text-[12px] font-bold uppercase tracking-widest"
                  style={{ color: plan.accent }}
                >
                  {plan.name}
                </p>
                <p
                  className="text-[24px] font-black mt-1"
                  style={{ color: 'var(--v-text-primary)' }}
                >
                  {plan.price}
                </p>
                <p className="text-[11px]" style={{ color: 'var(--v-text-tertiary)' }}>
                  {plan.billing}
                </p>
                <p className="text-[12px] mt-2" style={{ color: 'var(--v-text-secondary)' }}>
                  {plan.description}
                </p>
              </div>

              <ul className="flex flex-col gap-2 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <CheckCircle2
                      className="w-3.5 h-3.5 mt-0.5 shrink-0"
                      style={{ color: plan.accent }}
                    />
                    <span className="text-[12px]" style={{ color: 'var(--v-text-secondary)' }}>
                      {f}
                    </span>
                  </li>
                ))}
              </ul>

              <button
                disabled
                className="w-full py-2.5 rounded-xl text-[12px] font-bold uppercase tracking-widest opacity-50 cursor-not-allowed"
                style={{
                  background: plan.accent === '#F44A22' ? '#F44A22' : 'var(--v-elevated)',
                  color: plan.accent === '#F44A22' ? '#fff' : 'var(--v-text-primary)',
                  border: '1px solid var(--v-border)',
                }}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
