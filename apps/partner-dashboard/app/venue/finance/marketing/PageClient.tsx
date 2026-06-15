'use client';

import {
  Megaphone,
  ArrowRight,
  Info,
  Users,
  IndianRupee,
  Building2,
  MessageCircle,
  Zap,
  BarChart2,
} from 'lucide-react';

function FlowStep({
  icon: Icon,
  label,
  sublabel,
  accent,
  accentBg,
}: {
  icon: React.ElementType;
  label: string;
  sublabel: string;
  accent: string;
  accentBg: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 text-center flex-1">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center"
        style={{ background: accentBg, border: `1px solid ${accent}30` }}
      >
        <Icon className="w-5 h-5" style={{ color: accent }} />
      </div>
      <p className="text-[13px] font-semibold" style={{ color: 'var(--v-text-primary)' }}>
        {label}
      </p>
      <p className="text-[11px]" style={{ color: 'var(--v-text-tertiary)' }}>
        {sublabel}
      </p>
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="flex items-center justify-center px-1 pt-1">
      <ArrowRight className="w-4 h-4" style={{ color: 'var(--v-text-tertiary)' }} />
    </div>
  );
}

export function MarketingClient() {
  return (
    <div className="space-y-6">
      {/* Info banner */}
      <div
        className="flex items-start gap-3 rounded-2xl p-4"
        style={{ background: 'rgba(129,140,248,0.08)', border: '1px solid rgba(129,140,248,0.18)' }}
      >
        <Info className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#818CF8' }} />
        <div>
          <p className="text-[13px] font-semibold" style={{ color: '#818CF8' }}>
            CRM & Marketing spend is coming soon
          </p>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--v-text-secondary)' }}>
            When activated, campaign costs are automatically deducted from your C1RCLE wallet. All
            funds pass through the C1RCLE platform account before being routed to carrier APIs
            (WhatsApp Business, SMS).
          </p>
        </div>
      </div>

      {/* Spend summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: 'Spent This Month',
            value: '₹0',
            icon: IndianRupee,
            color: '#F44A22',
            bg: 'rgba(244,74,34,0.08)',
          },
          {
            label: 'Users Reached',
            value: '0',
            icon: Users,
            color: '#34D399',
            bg: 'rgba(52,211,153,0.08)',
          },
          {
            label: 'Active Campaigns',
            value: '0',
            icon: Megaphone,
            color: '#818CF8',
            bg: 'rgba(129,140,248,0.08)',
          },
          {
            label: 'Avg. Cost / User',
            value: '—',
            icon: BarChart2,
            color: '#FBBF24',
            bg: 'rgba(251,191,36,0.08)',
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl p-4 flex flex-col gap-2"
            style={{ background: 'var(--v-card)', border: '1px solid var(--v-border)' }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: stat.bg }}
            >
              <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
            </div>
            <p
              className="text-[11px] font-bold uppercase tracking-widest"
              style={{ color: 'var(--v-text-tertiary)' }}
            >
              {stat.label}
            </p>
            <p
              className="text-[24px] font-black tabular-nums"
              style={{ color: 'var(--v-text-primary)' }}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Fund flow diagram */}
      <div
        className="rounded-2xl p-6"
        style={{ background: 'var(--v-card)', border: '1px solid var(--v-border)' }}
      >
        <p
          className="text-[11px] font-bold uppercase tracking-widest mb-5"
          style={{ color: 'var(--v-text-tertiary)' }}
        >
          How Campaign Funds Flow
        </p>

        <div className="flex items-start gap-1">
          <FlowStep
            icon={Building2}
            label="Your Wallet"
            sublabel="Deducted per campaign"
            accent="#F44A22"
            accentBg="rgba(244,74,34,0.10)"
          />
          <FlowArrow />
          <FlowStep
            icon={Zap}
            label="C1RCLE Account"
            sublabel="Platform fee applied here"
            accent="#FBBF24"
            accentBg="rgba(251,191,36,0.10)"
          />
          <FlowArrow />
          <FlowStep
            icon={MessageCircle}
            label="WhatsApp / SMS API"
            sublabel="Carrier charges paid by C1RCLE"
            accent="#34D399"
            accentBg="rgba(52,211,153,0.10)"
          />
          <FlowArrow />
          <FlowStep
            icon={Users}
            label="Your Guests"
            sublabel="Message delivered"
            accent="#818CF8"
            accentBg="rgba(129,140,248,0.10)"
          />
        </div>

        <div
          className="mt-5 rounded-xl p-4 flex flex-col gap-2"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--v-border)' }}
        >
          <p className="text-[12px] font-semibold" style={{ color: 'var(--v-text-primary)' }}>
            Cost model
          </p>
          <ul className="flex flex-col gap-1.5">
            {[
              'You are charged per user selected in your campaign.',
              'A platform fee is added on top of the per-user carrier cost.',
              'All funds go to C1RCLE first — we pay the carrier API (WhatsApp Business API / SMS gateway).',
              'No direct carrier account or credit needed on your end.',
            ].map((line) => (
              <li key={line} className="flex items-start gap-2">
                <span
                  className="w-1 h-1 rounded-full mt-1.5 shrink-0"
                  style={{ background: '#F44A22' }}
                />
                <span className="text-[12px]" style={{ color: 'var(--v-text-secondary)' }}>
                  {line}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Empty campaigns state */}
      <div
        className="rounded-2xl py-16 flex flex-col items-center gap-4"
        style={{ border: '2px dashed var(--v-border)' }}
      >
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center"
          style={{ background: 'var(--v-elevated)' }}
        >
          <Megaphone className="w-7 h-7" style={{ color: 'var(--v-text-tertiary)' }} />
        </div>
        <div className="text-center">
          <p className="text-[14px] font-semibold" style={{ color: 'var(--v-text-primary)' }}>
            No campaigns yet
          </p>
          <p className="text-[12px] mt-1" style={{ color: 'var(--v-text-tertiary)' }}>
            Campaign creation will be available once CRM is activated for your venue.
          </p>
        </div>
        <button
          disabled
          className="px-5 py-2 rounded-xl text-[12px] font-bold uppercase tracking-widest opacity-40 cursor-not-allowed"
          style={{ background: '#F44A22', color: '#fff' }}
        >
          + New Campaign
        </button>
      </div>
    </div>
  );
}
