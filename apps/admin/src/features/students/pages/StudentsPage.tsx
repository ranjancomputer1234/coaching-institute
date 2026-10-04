import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../../shared/api/client';

type Student = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  batch?: { name: string } | null;
};

export function StudentsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['students'],
    queryFn: () => apiFetch<Student[]>('/students'),
  });

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Students</h1>
          <p>Manage enrolled coaching students</p>
        </div>
      </div>

      {isLoading ? <p className="muted">Loading students…</p> : null}
      {error ? (
        <p className="error">
          {error instanceof Error ? error.message : 'Failed to load'}
        </p>
      ) : null}

      {data ? (
        <div className="panel">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Batch</th>
              </tr>
            </thead>
            <tbody>
              {data.map((student) => (
                <tr key={student.id}>
                  <td>
                    {student.firstName} {student.lastName}
                  </td>
                  <td>{student.email ?? '—'}</td>
                  <td>{student.phone ?? '—'}</td>
                  <td>{student.batch?.name ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
