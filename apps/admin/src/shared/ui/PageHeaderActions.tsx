type PageHeaderActionsProps = {
  children: React.ReactNode;
};

/** Primary/secondary actions aligned with page title row */
export function PageHeaderActions({ children }: PageHeaderActionsProps) {
  return <div className="page-header-actions">{children}</div>;
}
