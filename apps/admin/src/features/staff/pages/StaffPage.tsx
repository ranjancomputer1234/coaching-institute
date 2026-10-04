import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch } from '../../../shared/api/client';
import { PageState, StatusPill } from '../../../shared/ui/PageState';

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
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleKey, setRoleKey] = useState('content_editor');

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

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Staff & roles</h1>
          <p>Admin accounts and the role each person holds</p>
        </div>
      </div>

      <form
        className="inline-form panel padded"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <div className="field">
          <label htmlFor="staff-name">Name</label>
          <input id="staff-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="staff-email">Email</label>
          <input id="staff-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="staff-password">Password</label>
          <input id="staff-password" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="staff-role">Role</label>
          <select id="staff-role" value={roleKey} onChange={(e) => setRoleKey(e.target.value)}>
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

      <PageState
        loading={list.isLoading}
        error={list.error instanceof Error ? list.error : null}
        empty={!list.isLoading && rows.length === 0}
        emptyTitle="No staff accounts"
      >
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
              {rows.map((staff) => (
                <tr key={staff.id}>
                  <td>{staff.name}</td>
                  <td>{staff.email}</td>
                  <td>{staff.roles.map((item) => item.role.name).join(', ') || '—'}</td>
                  <td>
                    <StatusPill value={staff.isActive ? 'active' : 'inactive'} />
                  </td>
                  <td>
                    <button className="btn-ghost" type="button" onClick={() => toggle.mutate(staff)}>
                      {staff.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageState>
    </section>
  );
}
