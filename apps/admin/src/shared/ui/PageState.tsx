type PageStateProps = {
  loading?: boolean;
  error?: Error | null;
  empty?: boolean;
  emptyTitle?: string;
  emptyHint?: string;
  children: React.ReactNode;
};

export function PageState({
  loading,
  error,
  empty,
  emptyTitle = 'Nothing here yet',
  emptyHint,
  children,
}: PageStateProps) {
  if (loading) {
    return (
      <div className="state-block" aria-busy="true">
        <div className="skeleton-line" />
        <div className="skeleton-line short" />
        <div className="skeleton-line" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="state-block error-panel" role="alert">
        <p className="error">{error.message}</p>
        <p className="muted">Retry or contact support with the request details.</p>
      </div>
    );
  }
  if (empty) {
    return (
      <div className="state-block">
        <h2>{emptyTitle}</h2>
        {emptyHint ? <p className="muted">{emptyHint}</p> : null}
      </div>
    );
  }
  return <>{children}</>;
}

export function StatusPill({ value }: { value: string }) {
  return <span className={`status-pill status-${value}`}>{value}</span>;
}
