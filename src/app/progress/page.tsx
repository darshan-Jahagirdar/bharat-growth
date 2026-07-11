'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  Compass,
  Flame,
  Focus,
  Layers3,
  Rocket,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type MilestoneState = 'complete' | 'active' | 'planned';
type Range = 'week' | 'month';

type Milestone = {
  id: string;
  title: string;
  detail: string;
  group: string;
  state: MilestoneState;
};

const STORAGE_KEY = 'bharatgrowth-progress-milestones';

const initialMilestones: Milestone[] = [
  {
    id: 'foundation',
    title: 'Multi-tenant foundation',
    detail: 'Shops, users, permissions, and a secure data layer.',
    group: 'Foundation',
    state: 'complete',
  },
  {
    id: 'billing',
    title: 'Fast GST billing',
    detail: 'Keyboard-first invoicing with a clear tax breakdown.',
    group: 'Core product',
    state: 'complete',
  },
  {
    id: 'inventory',
    title: 'Inventory command center',
    detail: 'Products, purchase records, stock alerts, and adjustments.',
    group: 'Core product',
    state: 'active',
  },
  {
    id: 'loyalty',
    title: 'Customer & loyalty engine',
    detail: 'Customer context, consent, and repeat-visit signals.',
    group: 'Retention',
    state: 'active',
  },
  {
    id: 'campaigns',
    title: 'WhatsApp campaign loop',
    detail: 'Automated outreach with measurable retention impact.',
    group: 'Retention',
    state: 'active',
  },
  {
    id: 'storefront',
    title: 'Online storefront',
    detail: 'A discoverable shopfront connected to live inventory.',
    group: 'Growth',
    state: 'active',
  },
  {
    id: 'payments',
    title: 'Subscriptions & reconciliation',
    detail: 'Pricing, payment collection, and a clean finance view.',
    group: 'Scale',
    state: 'planned',
  },
  {
    id: 'expansion',
    title: 'Multi-store expansion',
    detail: 'The system ready for more shops, locations, and teams.',
    group: 'Scale',
    state: 'planned',
  },
];

const weeklyMomentum = [
  { label: 'Mon', shipped: 3, focus: 4 },
  { label: 'Tue', shipped: 5, focus: 4 },
  { label: 'Wed', shipped: 4, focus: 5 },
  { label: 'Thu', shipped: 7, focus: 5 },
  { label: 'Fri', shipped: 6, focus: 6 },
  { label: 'Sat', shipped: 9, focus: 6 },
  { label: 'Today', shipped: 11, focus: 7 },
];

const monthlyMomentum = [
  { label: 'Feb', shipped: 11, focus: 14 },
  { label: 'Mar', shipped: 17, focus: 15 },
  { label: 'Apr', shipped: 20, focus: 17 },
  { label: 'May', shipped: 24, focus: 19 },
  { label: 'Jun', shipped: 29, focus: 22 },
  { label: 'Jul', shipped: 35, focus: 25 },
];

const statusMeta: Record<MilestoneState, { label: string; className: string }> = {
  complete: {
    label: 'Shipped',
    className: 'bg-emerald-400/10 text-emerald-300 ring-1 ring-inset ring-emerald-300/20',
  },
  active: {
    label: 'In motion',
    className: 'bg-amber-300/10 text-amber-200 ring-1 ring-inset ring-amber-200/20',
  },
  planned: {
    label: 'On deck',
    className: 'bg-white/[0.055] text-slate-300 ring-1 ring-inset ring-white/10',
  },
};

function getNextState(state: MilestoneState): MilestoneState {
  if (state === 'planned') return 'active';
  if (state === 'active') return 'complete';
  return 'planned';
}

function ProgressRing({ value }: { value: number }) {
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (value / 100) * circumference;

  return (
    <div className="relative grid h-32 w-32 place-items-center">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 112 112" aria-hidden="true">
        <circle cx="56" cy="56" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
        <circle
          cx="56"
          cy="56"
          r={radius}
          fill="none"
          stroke="url(#progressGradient)"
          strokeLinecap="round"
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
        <defs>
          <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#fb7185" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute text-center">
        <p className="font-display text-3xl font-semibold tracking-[-0.08em] text-white">{value}</p>
        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">complete</p>
      </div>
    </div>
  );
}

function MomentumTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-white/10 bg-[#121726] px-3.5 py-3 shadow-2xl shadow-black/30">
      <p className="mb-2 text-xs font-medium text-slate-300">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-6 text-xs">
          <span className="flex items-center gap-2 text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: entry.color }} />
            {entry.name}
          </span>
          <span className="font-semibold text-white">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function BharatGrowthProgressPage() {
  const [milestones, setMilestones] = useState(initialMilestones);
  const [range, setRange] = useState<Range>('week');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const savedMilestones = window.localStorage.getItem(STORAGE_KEY);
    if (savedMilestones) {
      try {
        const parsed = JSON.parse(savedMilestones) as Milestone[];
        if (Array.isArray(parsed) && parsed.length === initialMilestones.length) {
          setMilestones(parsed);
        }
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(milestones));
    }
  }, [hydrated, milestones]);

  const summary = useMemo(() => {
    const complete = milestones.filter((milestone) => milestone.state === 'complete').length;
    const active = milestones.filter((milestone) => milestone.state === 'active').length;
    const planned = milestones.length - complete - active;
    const score = Math.round(((complete + active * 0.55) / milestones.length) * 100);
    return { complete, active, planned, score };
  }, [milestones]);

  const groupedMilestones = useMemo(() => {
    const groups = ['Foundation', 'Core product', 'Retention', 'Growth', 'Scale'];
    return groups
      .map((group) => ({ group, items: milestones.filter((milestone) => milestone.group === group) }))
      .filter(({ items }) => items.length > 0);
  }, [milestones]);

  const toggleMilestone = (id: string) => {
    setMilestones((current) =>
      current.map((milestone) =>
        milestone.id === id ? { ...milestone, state: getNextState(milestone.state) } : milestone,
      ),
    );
  };

  const resetTracker = () => setMilestones(initialMilestones);
  const momentum = range === 'week' ? weeklyMomentum : monthlyMomentum;

  return (
    <main className="min-h-screen overflow-hidden bg-[#090d18] text-slate-100 selection:bg-amber-300 selection:text-slate-950">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-24 top-[-12rem] h-[28rem] w-[28rem] rounded-full bg-amber-300/10 blur-[130px]" />
        <div className="absolute right-[-10rem] top-[8rem] h-[24rem] w-[24rem] rounded-full bg-rose-400/10 blur-[120px]" />
        <div className="absolute bottom-[-14rem] left-[26%] h-[26rem] w-[26rem] rounded-full bg-sky-400/[0.07] blur-[140px]" />
      </div>

      <div className="relative mx-auto max-w-[1440px] px-5 py-5 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between gap-5 border-b border-white/[0.08] pb-5">
          <Link href="/" className="group flex items-center gap-3" aria-label="BharatGrowth home">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-amber-300 via-orange-400 to-rose-500 shadow-lg shadow-orange-500/20 transition-transform duration-300 group-hover:scale-105">
              <span className="font-display text-lg font-bold text-slate-950">B</span>
            </div>
            <div>
              <p className="font-display text-base font-semibold tracking-[-0.04em] text-white">
                Bharat<span className="text-amber-300">Growth</span>
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">builder&apos;s tracker</p>
            </div>
          </Link>

          <div className="hidden items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.035] p-1 sm:flex">
            <span className="rounded-full bg-white/[0.08] px-3 py-1.5 text-xs font-medium text-white">Progress</span>
            <Link href="/dashboard" className="rounded-full px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:text-white">
              Store dashboard
            </Link>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-40" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-300" />
            </span>
            <span className="hidden sm:inline">Building steadily</span>
          </div>
        </header>

        <section className="grid gap-8 pb-9 pt-9 lg:grid-cols-[1.28fr_0.72fr] lg:items-end lg:pt-12">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-200/15 bg-amber-300/[0.07] px-3 py-1.5 text-xs font-medium text-amber-100">
              <Sparkles className="h-3.5 w-3.5" />
              Launch progress, kept in one place
            </div>
            <h1 className="max-w-3xl font-display text-5xl font-semibold leading-[0.94] tracking-[-0.075em] text-white sm:text-6xl xl:text-7xl">
              Make every <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-orange-300 to-rose-300">meaningful step</span> visible.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
              A calm command center for the BharatGrowth journey—from a faster billing counter to an engine for repeat customers.
            </p>
          </div>

          <div className="rounded-[28px] border border-white/[0.09] bg-gradient-to-br from-white/[0.085] to-white/[0.025] p-5 shadow-2xl shadow-black/20 backdrop-blur sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200/80">Current signal</p>
                <p className="mt-2 font-display text-2xl font-medium tracking-[-0.055em] text-white">Phase 3: intelligence & growth</p>
              </div>
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-300/10 text-amber-200">
                <Rocket className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-7 flex items-end justify-between gap-4">
              <div>
                <p className="text-sm text-slate-400">Next meaningful move</p>
                <p className="mt-1 text-sm font-medium leading-5 text-slate-100">Turn campaign insight into a repeatable pilot-shop win.</p>
              </div>
              <ArrowUpRight className="h-5 w-5 shrink-0 text-amber-200" />
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[26px] border border-white/[0.09] bg-white/[0.045] p-5 backdrop-blur sm:p-6">
            <div className="flex items-center justify-between">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-sky-300/10 text-sky-200"><Layers3 className="h-5 w-5" /></span>
              <span className="text-xs font-medium text-slate-500">Live tracker</span>
            </div>
            <p className="mt-8 text-sm text-slate-400">Milestones shipped</p>
            <p className="mt-1 font-display text-4xl font-semibold tracking-[-0.07em] text-white">{summary.complete}<span className="ml-1 text-lg text-slate-500">/ {milestones.length}</span></p>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-emerald-300"><TrendingUp className="h-3.5 w-3.5" /> {summary.active} currently in motion</p>
          </div>

          <div className="rounded-[26px] border border-white/[0.09] bg-white/[0.045] p-5 backdrop-blur sm:p-6">
            <div className="flex items-center justify-between">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-300/10 text-amber-200"><Flame className="h-5 w-5" /></span>
              <span className="text-xs font-medium text-slate-500">This week</span>
            </div>
            <p className="mt-8 text-sm text-slate-400">Momentum score</p>
            <p className="mt-1 font-display text-4xl font-semibold tracking-[-0.07em] text-white">11<span className="ml-1 text-lg text-slate-500">points</span></p>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-200"><Zap className="h-3.5 w-3.5" /> Strongest push: shipping flow</p>
          </div>

          <div className="rounded-[26px] border border-white/[0.09] bg-white/[0.045] p-5 backdrop-blur sm:p-6">
            <div className="flex items-center justify-between">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-rose-300/10 text-rose-200"><Target className="h-5 w-5" /></span>
              <span className="text-xs font-medium text-slate-500">Next horizon</span>
            </div>
            <p className="mt-8 text-sm text-slate-400">Focus window</p>
            <p className="mt-1 font-display text-4xl font-semibold tracking-[-0.07em] text-white">14<span className="ml-1 text-lg text-slate-500">days</span></p>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-rose-200"><CalendarDays className="h-3.5 w-3.5" /> Get the loyalty loop pilot-ready</p>
          </div>
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-[1.37fr_0.63fr]">
          <div className="rounded-[28px] border border-white/[0.09] bg-[#101523]/80 p-5 shadow-2xl shadow-black/10 backdrop-blur sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-amber-200"><BarChart3 className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-[0.16em]">Build momentum</span></div>
                <h2 className="mt-3 font-display text-2xl font-medium tracking-[-0.055em] text-white">Progress has a rhythm.</h2>
              </div>
              <div className="flex rounded-xl border border-white/[0.09] bg-white/[0.035] p-1">
                {(['week', 'month'] as Range[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setRange(option)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${range === option ? 'bg-white/[0.12] text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    {option === 'week' ? '7 days' : '6 months'}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 h-[260px] sm:h-[300px]">
              {hydrated ? <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={momentum} margin={{ top: 8, right: 8, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="shippedGradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.42} />
                      <stop offset="100%" stopColor="#fbbf24" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="focusGradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#60a5fa" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#687386', fontSize: 11 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#687386', fontSize: 11 }} allowDecimals={false} />
                  <Tooltip content={<MomentumTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.14)', strokeWidth: 1 }} />
                  <Area type="monotone" dataKey="focus" name="Focus" stroke="#60a5fa" strokeWidth={2} fill="url(#focusGradient)" />
                  <Area type="monotone" dataKey="shipped" name="Shipped" stroke="#fbbf24" strokeWidth={2.5} fill="url(#shippedGradient)" />
                </AreaChart>
              </ResponsiveContainer> : <div className="h-full animate-pulse rounded-2xl bg-white/[0.025]" />}
            </div>

            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 border-t border-white/[0.07] pt-4 text-xs text-slate-400">
              <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-300" /> Shipped work</span>
              <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-sky-400" /> Focus capacity</span>
              <span className="ml-auto text-slate-500">Use this as your weekly reflection, not a pressure meter.</span>
            </div>
          </div>

          <aside className="rounded-[28px] border border-white/[0.09] bg-gradient-to-b from-[#1b1a25] to-[#101522] p-5 shadow-2xl shadow-black/10 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-rose-200"><Compass className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-[0.16em]">Trajectory</span></div>
                <h2 className="mt-3 font-display text-2xl font-medium tracking-[-0.055em] text-white">A launch with shape.</h2>
              </div>
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-rose-300/10 text-rose-200"><Focus className="h-4 w-4" /></span>
            </div>

            <div className="mt-7 flex justify-center">
              <ProgressRing value={summary.score} />
            </div>
            <div className="mt-5 grid grid-cols-3 divide-x divide-white/[0.08] text-center">
              <div><p className="font-display text-xl font-semibold tracking-[-0.05em] text-white">{summary.complete}</p><p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-slate-500">shipped</p></div>
              <div><p className="font-display text-xl font-semibold tracking-[-0.05em] text-amber-200">{summary.active}</p><p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-slate-500">active</p></div>
              <div><p className="font-display text-xl font-semibold tracking-[-0.05em] text-slate-300">{summary.planned}</p><p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-slate-500">on deck</p></div>
            </div>

            <div className="mt-7 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
              <div className="flex gap-3">
                <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" />
                <div>
                  <p className="text-sm font-medium text-white">The small promise</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">Keep the next milestone concrete enough to finish this week. Clarity compounds faster than ambition.</p>
                </div>
              </div>
            </div>
          </aside>
        </section>

        <section className="mt-4 rounded-[28px] border border-white/[0.09] bg-white/[0.035] p-5 backdrop-blur sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-emerald-200"><CheckCircle2 className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-[0.16em]">Project map</span></div>
              <h2 className="mt-3 font-display text-2xl font-medium tracking-[-0.055em] text-white">Mark the work as it becomes real.</h2>
              <p className="mt-2 text-sm text-slate-400">Click a milestone to move it from on deck → in motion → shipped. Your choices stay on this device.</p>
            </div>
            <button type="button" onClick={resetTracker} className="rounded-xl border border-white/[0.1] px-3.5 py-2 text-xs font-medium text-slate-300 transition hover:border-white/[0.18] hover:bg-white/[0.06] hover:text-white">
              Reset tracker
            </button>
          </div>

          <div className="mt-7 grid gap-x-8 gap-y-7 lg:grid-cols-2">
            {groupedMilestones.map(({ group, items }) => (
              <div key={group}>
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{group}</p>
                <div className="space-y-2">
                  {items.map((milestone) => {
                    const meta = statusMeta[milestone.state];
                    const isComplete = milestone.state === 'complete';
                    return (
                      <button
                        key={milestone.id}
                        type="button"
                        onClick={() => toggleMilestone(milestone.id)}
                        className="group flex w-full items-center gap-3 rounded-2xl border border-transparent px-3 py-3 text-left transition hover:border-white/[0.09] hover:bg-white/[0.045] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/70"
                        aria-label={`${milestone.title}: ${meta.label}. Click to update.`}
                      >
                        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl transition ${isComplete ? 'bg-emerald-300 text-slate-950' : milestone.state === 'active' ? 'bg-amber-300/15 text-amber-200' : 'bg-white/[0.055] text-slate-500'}`}>
                          {isComplete ? <Check className="h-4 w-4" strokeWidth={3} /> : milestone.state === 'active' ? <Circle className="h-4 w-4 fill-current" /> : <Circle className="h-4 w-4" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-slate-100 transition group-hover:text-white">{milestone.title}</span>
                          <span className="mt-0.5 block truncate text-xs text-slate-500">{milestone.detail}</span>
                        </span>
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${meta.className}`}>{meta.label}</span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-slate-300" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        <footer className="flex flex-col gap-2 py-7 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <p>BharatGrowth progress view · a private workspace for building with intent.</p>
          <Link href="/dashboard" className="inline-flex items-center gap-1 text-slate-500 transition hover:text-amber-200">Open store dashboard <ArrowUpRight className="h-3.5 w-3.5" /></Link>
        </footer>
      </div>
    </main>
  );
}
