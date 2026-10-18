import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, ArrowUpRight, BarChart3, Bell, BookOpen, CalendarPlus,
  CheckCircle2, ClipboardList, Compass, GraduationCap, Image, Inbox, PieChart,
  PlaySquare, Radio, RefreshCw, ScrollText, ShieldAlert, Sparkles, UserPlus,
} from 'lucide-react';
import { apiFetch } from '../../../shared/api/client';
import { useAuth } from '../../../shared/auth/AuthContext';
import { PageState } from '../../../shared/ui/PageState';

type DashboardMetrics = {
  learners: { total: number; active: number; suspended: number; pendingVerification: number };
  enrollments: { total: number };
  courses: { published: number; draft: number };
  explore: { published: number };
  banners: { published: number; scheduled: number };
  queues: { draftsAwaitingReview: number; suspendedLearners: number };
  recentAudit: Array<{ id: string; occurredAtUtc: string; actorDisplay: string | null; action: string; resourceType: string }>;
};

function useCountUp(value: number) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 700);
      setDisplay(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return display;
}

function KpiValue({ value }: { value: number }) {
  return <>{useCountUp(value).toLocaleString()}</>;
}

function relativeTime(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

export function DashboardPage() {
  const { user } = useAuth();
  const firstName = user?.name?.split(' ')[0] ?? 'there';
  const [chartMode, setChartMode] = useState<'donut' | 'bars'>('donut');
  const [hoverSeg, setHoverSeg] = useState<string | null>(null);
  const [queueFilter, setQueueFilter] = useState<'all' | 'action'>('all');
  const { data, isLoading, error, refetch, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiFetch<DashboardMetrics>('/admin/dashboard'),
    refetchInterval: 60_000,
  });

  const segments = useMemo(
    () =>
      !data
        ? []
        : [
            { key: 'active', label: 'Active learners', value: data.learners.active, color: '#2f9e7b', to: '/learners' },
            { key: 'pending', label: 'Pending verification', value: data.learners.pendingVerification, color: '#c9a227', to: '/learners' },
            { key: 'suspended', label: 'Suspended', value: data.learners.suspended, color: '#d46565', to: '/learners?state=suspended' },
          ],
    [data],
  );
  const segTotal = segments.reduce((a, s) => a + s.value, 0) || 1;
  const maxSeg = Math.max(1, ...segments.map((s) => s.value));

  let acc = 0;
  const arcs = segments.map((s) => {
    const frac = s.value / segTotal;
    const a = { ...s, dash: `${frac * 100} ${100 - frac * 100}`, offset: 25 - acc * 100 };
    acc += frac;
    return a;
  });

  const kpis = data
    ? [
        {
          label: 'Learners',
          value: data.learners.total,
          sub: `${data.learners.active} active · ${data.learners.suspended} suspended`,
          icon: GraduationCap,
          color: '#2f9e7b',
          to: '/learners',
          pct: data.learners.total ? (data.learners.active / data.learners.total) * 100 : 0,
          pctLabel: 'active rate',
        },
        {
          label: 'Courses',
          value: data.courses.published,
          sub: `${data.courses.draft} drafts in progress`,
          icon: BookOpen,
          color: '#5b8def',
          to: '/courses',
          pct: data.courses.published + data.courses.draft ? (data.courses.published / (data.courses.published + data.courses.draft)) * 100 : 0,
          pctLabel: 'published',
        },
        {
          label: 'Explore sections',
          value: data.explore.published,
          sub: 'published on learner app',
          icon: Compass,
          color: '#9b7bea',
          to: '/explore',
          pct: 100,
          pctLabel: 'live',
        },
        {
          label: 'Banners',
          value: data.banners.published,
          sub: `${data.banners.scheduled} scheduled`,
          icon: Image,
          color: '#e08a3c',
          to: '/banners',
          pct: data.banners.published + data.banners.scheduled ? (data.banners.published / (data.banners.published + data.banners.scheduled)) * 100 : 0,
          pctLabel: 'live now',
        },
      ]
    : [];

  const queues = data
    ? [
        {
          label: 'Suspended learners',
          desc: 'Accounts blocked — review and restore or keep suspended',
          count: data.queues.suspendedLearners,
          icon: ShieldAlert,
          color: '#d46565',
          to: '/learners?state=suspended',
          cta: 'Review learners',
          action: true,
        },
        {
          label: 'Courses in review',
          desc: 'Draft courses waiting to be published',
          count: data.queues.draftsAwaitingReview,
          icon: ClipboardList,
          color: '#c9a227',
          to: '/courses',
          cta: 'Open courses',
          action: true,
        },
        {
          label: 'Pending verification',
          desc: 'Learners who have not completed verification',
          count: data.learners.pendingVerification,
          icon: AlertTriangle,
          color: '#e08a3c',
          to: '/learners',
          cta: 'Verify now',
          action: true,
        },
        {
          label: 'Total enrollments',
          desc: 'All-time course enrollments across batches',
          count: data.enrollments.total,
          icon: CheckCircle2,
          color: '#2f9e7b',
          to: '/learners',
          cta: 'View enrollments',
          action: false,
        },
      ]
    : [];

  const shownQueues = queueFilter === 'action' ? queues.filter((q) => q.action && q.count > 0) : queues;
  const attentionCount = queues.filter((q) => q.action).reduce((n, q) => n + q.count, 0);

  const quickActions = [
    { label: 'Add learner', desc: 'Enrol a new student', icon: UserPlus, to: '/learners', color: '#2f9e7b' },
    { label: 'Create course', desc: 'Start a new course draft', icon: BookOpen, to: '/courses', color: '#5b8def' },
    { label: 'Add lesson', desc: 'Upload lesson / resource', icon: PlaySquare, to: '/lessons', color: '#9b7bea' },
    { label: 'Schedule live class', desc: 'Plan the next session', icon: Radio, to: '/live-classes', color: '#e0506b' },
    { label: 'Send notification', desc: 'Notify learners', icon: Bell, to: '/notifications', color: '#e08a3c' },
    { label: 'New banner', desc: 'Promote on home screen', icon: Image, to: '/banners', color: '#2aa198' },
  ];

  return (
    <section className="dash">
      <div className="page-header dash-head">
        <div>
          <p className="dash-kicker">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1>
            {greeting()}, {firstName}
          </h1>
          <p>
            Operational overview for REDI admin staff
            {dataUpdatedAt ? ` · updated ${relativeTime(new Date(dataUpdatedAt).toISOString())}` : ''}
          </p>
        </div>
        <div className="topbar-actions">
          <button className="btn btn-ghost dash-refresh" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw size={15} className={isFetching ? 'spin' : ''} /> {isFetching ? 'Refreshing…' : 'Refresh'}
          </button>
          <Link className="btn" to="/courses">
            <Sparkles size={15} /> New course
          </Link>
        </div>
      </div>

      <PageState loading={isLoading} error={error instanceof Error ? error : null}>
        {data ? (
          <>
            {attentionCount > 0 && (
              <button type="button" className="dash-alert" onClick={() => setQueueFilter('action')}>
                <span className="dash-alert-icon">
                  <AlertTriangle size={18} />
                </span>
                <span>
                  <strong>
                    {attentionCount} item{attentionCount === 1 ? '' : 's'} need attention
                  </strong>
                  <span className="muted small"> Review suspended accounts, pending verifications, and draft courses.</span>
                </span>
                <span className="dash-alert-cta">
                  Show queues <ArrowRight size={14} />
                </span>
              </button>
            )}

            <div className="metric-grid dash-kpis">
              {kpis.map((k) => {
                const Icon = k.icon;
                return (
                  <Link key={k.label} className="metric-card dash-kpi" to={k.to} style={{ '--kpi': k.color } as React.CSSProperties}>
                    <span className="kpi-top">
                      <span className="kpi-icon">
                        <Icon size={20} />
                      </span>
                      <ArrowUpRight size={16} className="kpi-arrow" />
                    </span>
                    <span className="muted">{k.label}</span>
                    <strong>
                      <KpiValue value={k.value} />
                    </strong>
                    <span className="muted small">{k.sub}</span>
                    <span className="kpi-bar">
                      <span style={{ width: `${Math.round(k.pct)}%` }} />
                    </span>
                    <span className="kpi-pct">
                      {Math.round(k.pct)}% {k.pctLabel}
                    </span>
                  </Link>
                );
              })}
            </div>

            <div className="dash-grid">
              <div className="panel padded dash-chart">
                <div className="panel-head">
                  <div>
                    <h2>Learner composition</h2>
                    <p className="muted small">Hover a segment to inspect · click the legend to open</p>
                  </div>
                  <div className="seg-toggle" role="tablist" aria-label="Chart type">
                    <button type="button" className={chartMode === 'donut' ? 'active' : ''} onClick={() => setChartMode('donut')}>
                      <PieChart size={14} /> Donut
                    </button>
                    <button type="button" className={chartMode === 'bars' ? 'active' : ''} onClick={() => setChartMode('bars')}>
                      <BarChart3 size={14} /> Bars
                    </button>
                  </div>
                </div>
                {chartMode === 'donut' ? (
                  <div className="donut-wrap">
                    <svg viewBox="0 0 42 42" className="donut" role="img" aria-label="Learner composition donut chart">
                      <circle cx="21" cy="21" r="15.915" className="donut-hole" />
                      {arcs.map((a) => (
                        <circle
                          key={a.key}
                          cx="21"
                          cy="21"
                          r="15.915"
                          className={`donut-seg ${hoverSeg === a.key ? 'hot' : ''}`}
                          stroke={a.color}
                          strokeDasharray={a.dash}
                          strokeDashoffset={a.offset}
                          onMouseEnter={() => setHoverSeg(a.key)}
                          onMouseLeave={() => setHoverSeg(null)}
                        />
                      ))}
                      <text x="21" y="20" className="donut-num">
                        {(hoverSeg ? segments.find((s) => s.key === hoverSeg)?.value : data.learners.total)?.toLocaleString()}
                      </text>
                      <text x="21" y="25" className="donut-cap">
                        {hoverSeg ? segments.find((s) => s.key === hoverSeg)?.label : 'total learners'}
                      </text>
                    </svg>
                    <ul className="legend">
                      {segments.map((s) => (
                        <li key={s.key}>
                          <Link
                            to={s.to}
                            onMouseEnter={() => setHoverSeg(s.key)}
                            onMouseLeave={() => setHoverSeg(null)}
                            className={hoverSeg === s.key ? 'hot' : ''}
                          >
                            <span className="dot" style={{ background: s.color }} />
                            {s.label}
                            <strong>{s.value.toLocaleString()}</strong>
                            <span className="muted">{Math.round((s.value / segTotal) * 100)}%</span>
                            <ArrowRight size={13} />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="bars">
                    {segments.map((s) => (
                      <Link
                        key={s.key}
                        to={s.to}
                        className="bar-row"
                        onMouseEnter={() => setHoverSeg(s.key)}
                        onMouseLeave={() => setHoverSeg(null)}
                      >
                        <span className="bar-label">
                          <span className="dot" style={{ background: s.color }} />
                          {s.label}
                        </span>
                        <span className="bar-track">
                          <span className="bar-fill" style={{ width: `${(s.value / maxSeg) * 100}%`, background: s.color }} />
                        </span>
                        <strong>{s.value.toLocaleString()}</strong>
                      </Link>
                    ))}
                    <p className="muted small">Bars are scaled to the largest group. Click any row to open the filtered list.</p>
                  </div>
                )}
              </div>

              <div className="panel padded">
                <div className="panel-head">
                  <div>
                    <h2>Action queues</h2>
                    <p className="muted small">Things that need your attention</p>
                  </div>
                  <div className="seg-toggle" role="tablist" aria-label="Queue filter">
                    <button type="button" className={queueFilter === 'all' ? 'active' : ''} onClick={() => setQueueFilter('all')}>
                      All
                    </button>
                    <button type="button" className={queueFilter === 'action' ? 'active' : ''} onClick={() => setQueueFilter('action')}>
                      <Inbox size={14} /> Needs action
                    </button>
                  </div>
                </div>
                <div className="queue-cards">
                  {shownQueues.length === 0 ? (
                    <div className="empty-mini">
                      <CheckCircle2 size={22} />
                      <p className="muted">Nothing waiting in the action queues.</p>
                    </div>
                  ) : (
                    shownQueues.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link key={item.label} to={item.to} className="queue-card">
                          <span
                            className="queue-icon"
                            style={{ color: item.color, background: `color-mix(in srgb, ${item.color} 16%, transparent)` }}
                          >
                            <Icon size={18} />
                          </span>
                          <span className="queue-body">
                            <span className="queue-title">
                              {item.label}{' '}
                              <span className="queue-count" style={{ background: item.count ? item.color : undefined }}>
                                {item.count}
                              </span>
                            </span>
                            <span className="muted small">{item.desc}</span>
                            <span className="queue-cta">
                              {item.cta} <ArrowRight size={13} />
                            </span>
                          </span>
                        </Link>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="dash-grid bottom">
              <div className="panel padded">
                <div className="panel-head">
                  <div>
                    <h2>Quick actions</h2>
                    <p className="muted small">Jump straight into common tasks</p>
                  </div>
                  <CalendarPlus size={18} className="muted" />
                </div>
                <div className="quick-grid">
                  {quickActions.map((a) => {
                    const Icon = a.icon;
                    return (
                      <Link key={a.label} to={a.to} className="quick-card">
                        <span
                          className="quick-icon"
                          style={{ color: a.color, background: `color-mix(in srgb, ${a.color} 15%, transparent)` }}
                        >
                          <Icon size={19} />
                        </span>
                        <strong>{a.label}</strong>
                        <span className="muted small">{a.desc}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>

              <div className="panel padded">
                <div className="panel-head">
                  <div>
                    <h2>Recent admin activity</h2>
                    <p className="muted small">Latest audit events</p>
                  </div>
                  <ScrollText size={18} className="muted" />
                </div>
                {data.recentAudit.length === 0 ? (
                  <div className="empty-mini">
                    <ScrollText size={22} />
                    <p className="muted">No audit events yet.</p>
                  </div>
                ) : (
                  <ol className="timeline">
                    {data.recentAudit.slice(0, 7).map((e) => (
                      <li key={e.id}>
                        <span className="tl-dot" />
                        <div>
                          <strong>{e.action}</strong> <span className="status-pill">{e.resourceType}</span>
                          <span className="muted small">
                            {' '}
                            {e.actorDisplay ?? 'system'} · {relativeTime(e.occurredAtUtc)} ·{' '}
                            {new Date(e.occurredAtUtc).toLocaleString('en-IN')}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
                <Link className="btn btn-ghost dash-audit-btn" to="/audit">
                  Open full audit log <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </>
        ) : null}
      </PageState>
    </section>
  );
}
