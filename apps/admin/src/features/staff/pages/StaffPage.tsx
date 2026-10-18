import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { apiFetch } from '../../../shared/api/client';
import { filterBySearch } from '../../../shared/lib/tableFilters';
import { ContentDrawer } from '../../../shared/ui/ContentDrawer';
import { PageHeaderActions } from '../../../shared/ui/PageHeaderActions';
import { PageState, StatusPill } from '../../../shared/ui/PageState';
import { TableFilterBar } from '../../../shared/ui/TableFilterBar';

type Staff = {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  roles: Array<{ role: { key: string; name: string } }>;
};

type Role = { id: string; key: string; name: string };

export function StaffPage() {
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleKey, setRoleKey] = useState('content_editor');
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('');

  const list = useQuery({
    queryKey: ['staff'],
    queryFn: () => apiFetch<Staff[]>('/admin/staff'),
  });
  const roles = useQuery({
    queryKey: ['roles'],
    queryFn: () => apiFetch<Role[]>('/admin/roles'),
  });

  const create = useMutation({
    mutationFn: () =>
      apiFetch('/admin/staff', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, roleKey }),
      }),
    onSuccess: () => {
      setName('');
      setEmail('');
      setPassword('');
      setDrawerOpen(false);
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
  });

  const toggle = useMutation({
    mutationFn: (staff: Staff) =>
      apiFetch(`/admin/staff/${staff.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !staff.isActive }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff'] }),
  });

  const rows = list.data ?? [];
  const filtered = useMemo(() => {
    let next = rows;
    next = filterBySearch(next, search, (s) => `${s.name} ${s.email}`);
    if (activeFilter === 'active') next = next.filter((s) => s.isActive);
    if (activeFilter === 'inactive') next = next.filter((s) => !s.isActive);
    return next;
  }, [rows, search, activeFilter]);

  const roleFilterOptions = useMemo(() => {
    const keys = new Set<string>();
    for (const s of rows) {
      for (const r of s.roles) keys.add(r.role.key);
    }
    return [...keys].sort().map((k) => ({ value: k, label: k }));
  }, [rows]);

  const filteredByRole = useMemo(() => {
    if (!activeFilter.startsWith('role:')) return filtered;
    const key = activeFilter.slice(5);
    return filtered.filter((s) => s.roles.some((r) => r.role.key === key));
  }, [filtered, activeFilter]);

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Staff & roles</h1>
          <p>Admin accounts and the role each person holds</p>
        </div>
        <PageHeaderActions>
          <button type="button" className="btn" onClick={() => setDrawerOpen(true)}>
            Add staff
          </button>
        </PageHeaderActions>
      </div>

      <PageState
        loading={list.isLoading}
        error={list.error instanceof Error ? list.error : null}
        empty={!list.isLoading && rows.length === 0}
        emptyTitle="No staff accounts"
      >
        <TableFilterBar
          search={{
            value: search,
            onChange: setSearch,
            placeholder: 'Search name or email…',
          }}
          selects={[
            {
              id: 'state',
              label: 'Account',
              value: activeFilter.startsWith('role:') ? '' : activeFilter,
              onChange: setActiveFilter,
              options: [
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ],
            },
            {
              id: 'role',
              label: 'Role',
              value: activeFilter.startsWith('role:') ? activeFilter.slice(5) : '',
              onChange: (v) => setActiveFilter(v ? `role:${v}` : ''),
              options: roleFilterOptions,
            },
          ]}
          onReset={() => {
            setSearch('');
            setActiveFilter('');
          }}
        />
        <div className="panel">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Roles</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredByRole.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted">
                    No rows match filters.
                  </td>
                </tr>
              ) : (
                filteredByRole.map((staff) => (
                  <tr key={staff.id}>
                    <td>{staff.name}</td>
                    <td>{staff.email}</td>
                    <td>{staff.roles.map((item) => item.role.name).join(', ') || '—'}</td>
                    <td>
                      <StatusPill value={staff.isActive ? 'active' : 'inactive'} />
                    </td>
                    <td>
                      <button
                        className="btn btn-ghost"
                        type="button"
                        onClick={() => toggle.mutate(staff)}
                      >
                        {staff.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </PageState>

      <ContentDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Add staff member"
        size="full"
      >
        <form
          className="stack-form"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <div className="field">
            <label htmlFor="staff-name">Name</label>
            <input
              id="staff-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="staff-email">Email</label>
            <input
              id="staff-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="staff-password">Password</label>
            <input
              id="staff-password"
              type="password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="staff-role">Role</label>
            <select
              id="staff-role"
              value={roleKey}
              onChange={(e) => setRoleKey(e.target.value)}
            >
              {(roles.data ?? []).map((role) => (
                <option key={role.id} value={role.key}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>
          <button className="btn" type="submit" disabled={create.isPending}>
            Add staff
          </button>
          {create.error instanceof Error ? <p className="error">{create.error.message}</p> : null}
        </form>
      </ContentDrawer>
    </section>
  );
}
