import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { apiFetch } from '../../../shared/api/client';
import { PageHeaderActions } from '../../../shared/ui/PageHeaderActions';
import { PageState, StatusPill } from '../../../shared/ui/PageState';

type Overview = {
  appEnv: string;
  email: {
    provider: string;
    configured: boolean;
    fromAddress: string | null;
    fromName: string | null;
    requireVerify: boolean;
    workerEnabled: boolean;
    keyPresent: boolean;
    keyLooksLikeSmtp: boolean;
    keyLooksLikeApi: boolean;
  };
  providers: Record<string, boolean>;
};

type DiagnosticResult = {
  id: string;
  name: string;
  group: string;
  status: 'pass' | 'fail' | 'warn' | 'skip';
  durationMs: number;
  detail?: string;
};

type RunResponse = {
  ok: boolean;
  ranAt: string;
  durationMs: number;
  toEmail: string | null;
  summary: { pass: number; fail: number; warn: number; skip: number; total: number };
  results: DiagnosticResult[];
  overview: Overview;
};

type EmailProbeResponse = {
  ok: boolean;
  status: string;
  detail?: string;
  outboxId?: string;
  providerId?: string;
};

const GROUPS = ['core', 'email', 'auth', 'providers', 'data'] as const;

export function SystemTestsPage() {
  const [toEmail, setToEmail] = useState('ranjancomputerinstitute@gmail.com');
  const [dryRun, setDryRun] = useState(false);
  const [lastRun, setLastRun] = useState<RunResponse | null>(null);
  const [probeNote, setProbeNote] = useState<string | null>(null);

  const overview = useQuery({
    queryKey: ['diagnostics-overview'],
    queryFn: () => apiFetch<Overview>('/admin/diagnostics'),
  });

  const runAll = useMutation({
    mutationFn: () =>
      apiFetch<RunResponse>('/admin/diagnostics/run', {
        method: 'POST',
        body: JSON.stringify({
          toEmail: toEmail.trim() || undefined,
          dryRun,
        }),
      }),
    onSuccess: (data) => {
      setLastRun(data);
      setProbeNote(null);
      void overview.refetch();
    },
  });

  const emailOnly = useMutation({
    mutationFn: () =>
      apiFetch<EmailProbeResponse>('/admin/diagnostics/email-test', {
        method: 'POST',
        body: JSON.stringify({
          toEmail: toEmail.trim(),
          note: 'Manual probe from System Tests',
        }),
      }),
    onSuccess: (data) => {
      setProbeNote(
        data.ok
          ? `Email sent: ${data.detail || 'ok'}`
          : `Email failed: ${data.detail || data.status}`,
      );
      void overview.refetch();
    },
    onError: (err) => {
      setProbeNote(err instanceof Error ? err.message : 'Email probe failed');
    },
  });

  const ov = overview.data;
  const grouped = useMemo(() => {
    const results = lastRun?.results ?? [];
    return GROUPS.map((group) => ({
      group,
      items: results.filter((r) => r.group === group),
    })).filter((g) => g.items.length > 0);
  }, [lastRun]);

  const smtpWarning = ov?.email.keyLooksLikeSmtp;

  return (
    <section className="system-tests-page">
      <div className="page-header">
        <div>
          <h1>System tests</h1>
          <p>
            One-hit checks for email, auth OTP, providers, and core data. Use a real inbox
            to verify Brevo delivery.
          </p>
        </div>
        <PageHeaderActions>
          <button
            type="button"
            className="btn"
            disabled={runAll.isPending}
            onClick={() => runAll.mutate()}
          >
            {runAll.isPending ? 'Running…' : 'Run all tests'}
          </button>
        </PageHeaderActions>
      </div>

      <PageState
        loading={overview.isLoading}
        error={overview.error instanceof Error ? overview.error : null}
        empty={false}
      >
        {ov ? (
          <>
            {smtpWarning ? (
              <div className="banner-warn" role="status">
                Brevo key looks like an <strong>SMTP</strong> key (<code>xsmtpsib-</code>).
                Transactional API needs an <strong>API</strong> key (<code>xkeysib-</code>)
                from Brevo → SMTP &amp; API → API keys.
              </div>
            ) : null}

            <div className="metric-grid">
              <article className="metric-card">
                <h2>App env</h2>
                <strong>{ov.appEnv}</strong>
              </article>
              <article className="metric-card">
                <h2>Email</h2>
                <StatusPill
                  value={ov.email.configured ? ov.email.provider : 'not_configured'}
                />
                <p className="muted small">{ov.email.fromAddress || 'No From address'}</p>
              </article>
              <article className="metric-card">
                <h2>Worker</h2>
                <StatusPill value={ov.email.workerEnabled ? 'enabled' : 'disabled'} />
              </article>
              <article className="metric-card">
                <h2>Verify on register</h2>
                <StatusPill value={ov.email.requireVerify ? 'required' : 'off'} />
              </article>
            </div>

            <div className="metric-grid" style={{ marginTop: '1rem' }}>
              {Object.entries(ov.providers).map(([name, ready]) => (
                <article className="metric-card" key={name}>
                  <h2>{name}</h2>
                  <StatusPill value={ready ? 'configured' : 'not_configured'} />
                </article>
              ))}
            </div>

            <div className="system-tests-form card-panel">
              <label htmlFor="diag-to">Test inbox</label>
              <input
                id="diag-to"
                type="email"
                value={toEmail}
                onChange={(e) => setToEmail(e.target.value)}
                placeholder="you@gmail.com"
              />
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={dryRun}
                  onChange={(e) => setDryRun(e.target.checked)}
                />
                Dry run (skip live email send)
              </label>
              <div className="system-tests-actions">
                <button
                  type="button"
                  className="btn"
                  disabled={runAll.isPending}
                  onClick={() => runAll.mutate()}
                >
                  {runAll.isPending ? 'Running…' : 'Run all tests'}
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={emailOnly.isPending || !toEmail.trim()}
                  onClick={() => emailOnly.mutate()}
                >
                  {emailOnly.isPending ? 'Sending…' : 'Send test email only'}
                </button>
              </div>
              {probeNote ? <p className="muted">{probeNote}</p> : null}
              {runAll.error instanceof Error ? (
                <p className="form-error">{runAll.error.message}</p>
              ) : null}
            </div>

            {lastRun ? (
              <div className="system-tests-results">
                <div className="page-header" style={{ marginTop: '1.5rem' }}>
                  <div>
                    <h2>Last run</h2>
                    <p>
                      {lastRun.ranAt} · {lastRun.durationMs}ms · to{' '}
                      {lastRun.toEmail || '—'}
                    </p>
                  </div>
                  <div className="system-tests-summary">
                    <StatusPill value={lastRun.ok ? 'pass' : 'fail'} />
                    <span className="muted small">
                      pass {lastRun.summary.pass} · warn {lastRun.summary.warn} · fail{' '}
                      {lastRun.summary.fail} · skip {lastRun.summary.skip}
                    </span>
                  </div>
                </div>

                {grouped.map(({ group, items }) => (
                  <div key={group} className="system-tests-group">
                    <h3>{group}</h3>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Check</th>
                            <th>Status</th>
                            <th>Detail</th>
                            <th>ms</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((row) => (
                            <tr key={row.id}>
                              <td>
                                <strong>{row.name}</strong>
                                <div className="muted small">{row.id}</div>
                              </td>
                              <td>
                                <StatusPill value={row.status} />
                              </td>
                              <td className="wrap">{row.detail || '—'}</td>
                              <td>{row.durationMs}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </PageState>
    </section>
  );
}
