import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, ChevronDown, ChevronLeft, LogOut, Menu, PanelLeftClose, PanelLeftOpen,
  ScrollText, Search, Settings, X,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { ALL_NAV_ITEMS, NAV_GROUPS, canSeeNavItem, type NavGroup } from '../nav/nav';

const ENV = import.meta.env.VITE_APP_ENV ?? 'local';
const LS_OPEN = 'redi.nav.openGroups.v2';
const LS_COLLAPSED = 'redi.nav.collapsed';

function loadOpen(fallback: string[]): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(LS_OPEN) ?? '');
    return Array.isArray(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

const initials = (n?: string) =>
  (n ?? '?').split(' ').map((s) => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

type Flyout = { label: string; top: number; left: number };

export function AppLayout() {
  const { user, logout } = useAuth();
  const permissions = useMemo(() => user?.permissions ?? [], [user]);
  const location = useLocation();
  const navigate = useNavigate();

  const groups = useMemo(
    () =>
      NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => canSeeNavItem(i, permissions)) })).filter(
        (g) => g.items.length,
      ),
    [permissions],
  );

  const activeGroup = groups.find((g) =>
    g.items.some((i) => (i.to === '/' ? location.pathname === '/' : location.pathname.startsWith(i.to))),
  )?.label;

  const [open, setOpen] = useState<string[]>(() => loadOpen(activeGroup ? [activeGroup] : ['Overview']));
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(LS_COLLAPSED) === '1');
  const [mobile, setMobile] = useState(false);
  const [query, setQuery] = useState('');
  const [searchFocus, setSearchFocus] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [flyout, setFlyout] = useState<Flyout | null>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeGroup) setOpen((p) => (p.includes(activeGroup) ? p : [...p, activeGroup]));
  }, [activeGroup]);
  useEffect(() => {
    localStorage.setItem(LS_OPEN, JSON.stringify(open));
  }, [open]);
  useEffect(() => {
    localStorage.setItem(LS_COLLAPSED, collapsed ? '1' : '0');
    if (!collapsed) setFlyout(null);
  }, [collapsed]);
  useEffect(() => {
    setMobile(false);
    setFlyout(null);
  }, [location.pathname]);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!userMenuRef.current?.contains(t)) setUserMenu(false);
      if (!flyoutRef.current?.contains(t) && !(t as HTMLElement).closest?.('[data-rail-cat]')) setFlyout(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setUserMenu(false);
        setSearchFocus(false);
        setMobile(false);
        setFlyout(null);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        document.getElementById('global-search')?.focus();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
        e.preventDefault();
        setCollapsed((c) => !c);
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const toggleGroup = (label: string) =>
    setOpen((p) => (p.includes(label) ? p.filter((l) => l !== label) : [...p, label]));
  const expandAll = () => setOpen(groups.map((g) => g.label));
  const collapseAll = () => setOpen(activeGroup ? [activeGroup] : []);

  const openFlyout = (group: NavGroup, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setFlyout((cur) =>
      cur?.label === group.label ? null : { label: group.label, top: Math.max(8, r.top), left: r.right + 10 },
    );
  };

  const q = query.trim().toLowerCase();
  const visibleGroups = q
    ? groups
        .map((g) => ({
          ...g,
          items: g.items.filter((i) => i.label.toLowerCase().includes(q) || g.label.toLowerCase().includes(q)),
        }))
        .filter((g) => g.items.length)
    : groups;
  const searchResults = q
    ? ALL_NAV_ITEMS.filter(
        (i) => canSeeNavItem(i, permissions) && (i.label.toLowerCase().includes(q) || i.group.toLowerCase().includes(q)),
      ).slice(0, 8)
    : [];
  const current = ALL_NAV_ITEMS.find((i) =>
    i.to === '/' ? location.pathname === '/' : location.pathname.startsWith(i.to),
  );
  const flyGroup = flyout ? groups.find((g) => g.label === flyout.label) : null;
  const FlyIcon = flyGroup?.icon;

  return (
    <div className={`app-shell ${collapsed ? 'is-collapsed' : ''}`}>
      {ENV !== 'production' ? (
        <div className="env-ribbon" role="status">
          Environment: {ENV}
        </div>
      ) : null}
      {mobile && <button className="scrim" aria-label="Close menu" onClick={() => setMobile(false)} />}

      <aside className={`sidebar ${mobile ? 'is-mobile-open' : ''}`} aria-label="Sidebar">
        <div className="brand-row">
          <NavLink to="/" className="brand" title="REDI Admin home">
            <span className="brand-mark">R</span>
            {!collapsed && (
              <span className="brand-text">
                REDI
                <small>Admin console</small>
              </span>
            )}
          </NavLink>
          <button className="icon-btn mobile-only" onClick={() => setMobile(false)} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        <div className="nav-search">
          <Search size={15} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter menu…"
            aria-label="Filter menu"
          />
          {query && (
            <button className="icon-btn sm" onClick={() => setQuery('')} aria-label="Clear filter">
              <X size={13} />
            </button>
          )}
        </div>
        {!collapsed && !q && (
          <div className="nav-tools">
            <button type="button" onClick={expandAll}>
              Expand all
            </button>
            <span>·</span>
            <button type="button" onClick={collapseAll}>
              Collapse all
            </button>
          </div>
        )}

        <nav className="nav" aria-label="Main">
          {visibleGroups.length === 0 && (
            <p className="muted small nav-empty">No menu item matches “{query}”.</p>
          )}
          {visibleGroups.map((group) => {
            const GroupIcon = group.icon;
            const isOpen = q ? true : open.includes(group.label);
            const hasActive = group.items.some((i) =>
              i.to === '/' ? location.pathname === '/' : location.pathname.startsWith(i.to),
            );

            if (collapsed && !q) {
              return (
                <div key={group.label} className={`nav-group rail ${hasActive ? 'has-active' : ''}`}>
                  <button
                    type="button"
                    className={`rail-cat ${flyout?.label === group.label ? 'is-open' : ''}`}
                    data-rail-cat={group.label}
                    title={group.label}
                    aria-haspopup="menu"
                    aria-expanded={flyout?.label === group.label}
                    onClick={(e) => openFlyout(group, e.currentTarget)}
                  >
                    <GroupIcon size={18} />
                    {hasActive && <span className="rail-dot" />}
                  </button>
                </div>
              );
            }

            return (
              <div key={group.label} className={`nav-group ${hasActive ? 'has-active' : ''} ${isOpen ? 'is-open' : ''}`}>
                <button
                  type="button"
                  className="nav-group-head"
                  aria-expanded={isOpen}
                  onClick={() => toggleGroup(group.label)}
                >
                  <span className="nav-group-title">
                    <span className="nav-group-icon">
                      <GroupIcon size={15} />
                    </span>
                    {group.label}
                  </span>
                  <span className="nav-group-meta">
                    <span className="nav-count">{group.items.length}</span>
                    <ChevronDown size={15} className={`chev ${isOpen ? 'open' : ''}`} />
                  </span>
                </button>
                <div className={`nav-collapse ${isOpen ? 'open' : ''}`}>
                  <div className="nav-collapse-inner">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <NavLink key={item.to} to={item.to} end={item.to === '/'}>
                          <span className="nav-item-label">
                            <Icon size={16} className="nav-icon" />
                            {item.label}
                          </span>
                          {item.phase && item.phase > 1 ? <span className="nav-phase">P{item.phase}</span> : null}
                        </NavLink>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          {!collapsed && (
            <div className="user-chip">
              <span className="avatar">{initials(user?.name)}</span>
              <span className="user-meta">
                <strong>{user?.name}</strong>
                <small>{user?.roles?.join(', ') || user?.email}</small>
              </span>
            </div>
          )}
          <div className="sidebar-actions">
            <button type="button" className="btn btn-ghost grow" onClick={logout}>
              <LogOut size={15} />
              {!collapsed && 'Log out'}
            </button>
            <button
              type="button"
              className="icon-btn bordered"
              onClick={() => setCollapsed((c) => !c)}
              title={collapsed ? 'Expand sidebar (Ctrl+\\)' : 'Collapse sidebar (Ctrl+\\)'}
              aria-label="Toggle sidebar"
            >
              {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
            </button>
          </div>
        </div>
      </aside>

      {flyout && flyGroup && (
        <div
          ref={flyoutRef}
          className="rail-flyout"
          role="menu"
          style={{ top: flyout.top, left: flyout.left }}
        >
          <div className="rail-flyout-head">
            {FlyIcon ? <FlyIcon size={15} /> : null}
            {flyGroup.label}
          </div>
          {flyGroup.items.map((item) => {
            const Icon = item.icon;
            const active = item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                role="menuitem"
                className={active ? 'active' : ''}
                onClick={() => setFlyout(null)}
              >
                <Icon size={16} />
                {item.label}
              </NavLink>
            );
          })}
        </div>
      )}

      <div className="main-wrap">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-btn bordered mobile-only" onClick={() => setMobile(true)} aria-label="Open menu">
              <Menu size={18} />
            </button>
            <button
              className="icon-btn bordered desktop-only"
              onClick={() => setCollapsed((c) => !c)}
              aria-label="Toggle sidebar"
            >
              {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
            </button>
            <nav className="crumbs" aria-label="Breadcrumb">
              <NavLink to="/">Home</NavLink>
              <ChevronLeft size={13} className="crumb-sep" />
              {current ? (
                <>
                  <span className="muted">{current.group}</span>
                  <ChevronLeft size={13} className="crumb-sep" />
                  <strong>{current.label}</strong>
                </>
              ) : (
                <strong>Dashboard</strong>
              )}
            </nav>
          </div>

          <div className="topbar-right">
            <div className="global-search">
              <Search size={15} />
              <input
                id="global-search"
                value={query}
                onFocus={() => setSearchFocus(true)}
                onBlur={() => setTimeout(() => setSearchFocus(false), 150)}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search pages…  (Ctrl+K)"
                aria-label="Search pages"
              />
              {searchFocus && q && (
                <div className="search-pop" role="listbox">
                  {searchResults.length === 0 ? (
                    <p className="muted small">No pages found.</p>
                  ) : (
                    searchResults.map((r) => {
                      const Icon = r.icon;
                      return (
                        <button
                          key={r.to}
                          onMouseDown={() => {
                            navigate(r.to);
                            setQuery('');
                          }}
                        >
                          <Icon size={16} />
                          <span>{r.label}</span>
                          <small>{r.group}</small>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
            <span className={`env-pill env-${ENV}`}>{ENV}</span>
            <button
              className="icon-btn bordered"
              onClick={() => navigate('/notifications')}
              aria-label="Notifications"
              title="Notifications"
            >
              <Bell size={17} />
            </button>
            <div className="user-menu" ref={userMenuRef}>
              <button
                className="avatar-btn"
                onClick={() => setUserMenu((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={userMenu}
              >
                <span className="avatar">{initials(user?.name)}</span>
                <span className="user-meta desktop-only">
                  <strong>{user?.name}</strong>
                  <small>{user?.roles?.[0] ?? ''}</small>
                </span>
                <ChevronDown size={14} className={`chev ${userMenu ? 'open' : ''}`} />
              </button>
              {userMenu && (
                <div className="user-pop" role="menu">
                  <div className="user-pop-head">
                    <span className="avatar lg">{initials(user?.name)}</span>
                    <div>
                      <strong>{user?.name}</strong>
                      <small>{user?.email}</small>
                      <small>{user?.roles?.join(', ')}</small>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setUserMenu(false);
                      navigate('/settings');
                    }}
                  >
                    <Settings size={14} /> Settings
                  </button>
                  <button
                    onClick={() => {
                      setUserMenu(false);
                      navigate('/audit');
                    }}
                  >
                    <ScrollText size={14} /> Audit log
                  </button>
                  <button className="danger" onClick={logout}>
                    <LogOut size={14} /> Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
