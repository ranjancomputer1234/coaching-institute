import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { NAV_GROUPS, canSeeNavItem } from '../nav/nav';

const ENV = import.meta.env.VITE_APP_ENV ?? 'local';

export function AppLayout() {
  const { user, logout } = useAuth();
  const permissions = user?.permissions ?? [];

  return (
    <div className="app-shell">
      {ENV !== 'production' ? (
        <div className="env-ribbon" role="status">
          Environment: {ENV}
        </div>
      ) : null}
      <aside className="sidebar">
        <div className="brand">
          REDI
          <span>Ranjan Educational Institute · Admin</span>
        </div>
        <nav className="nav" aria-label="Main">
          {NAV_GROUPS.map((group) => {
            const items = group.items.filter((item) =>
              canSeeNavItem(item, permissions),
            );
            if (!items.length) return null;
            return (
              <div key={group.label} className="nav-group">
                <div className="nav-group-label">{group.label}</div>
                {items.map((item) => (
                  <NavLink key={item.to} to={item.to} end={item.to === '/'}>
                    {item.label}
                    {item.phase && item.phase > 1 ? (
                      <span className="nav-phase">P{item.phase}</span>
                    ) : null}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="muted small">
            {user?.name}
            <br />
            {user?.roles?.join(', ')}
          </div>
          <button type="button" className="btn btn-ghost" onClick={logout}>
            Log out
          </button>
        </div>
      </aside>
      <div className="main">
        <Outlet />
      </div>
    </div>
  );
}
