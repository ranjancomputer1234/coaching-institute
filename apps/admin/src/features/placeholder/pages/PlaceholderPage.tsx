type Props = {
  title: string;
  phase: number;
  summary: string;
};

export function PlaceholderPage({ title, phase, summary }: Props) {
  return (
    <section>
      <div className="page-header">
        <div>
          <h1>{title}</h1>
          <p>{summary}</p>
        </div>
      </div>
      <div className="panel padded state-block">
        <p>
          This module is scaffolded in the navigation for information
          architecture completeness.
        </p>
        <p className="muted">
          Planned for <strong>Phase {phase}</strong> per{' '}
          <code>docs/IMPLEMENTATION_PLAN.md</code>. Capability-unavailable
          until the vertical slice is implemented (no fabricated provider
          success).
        </p>
      </div>
    </section>
  );
}
