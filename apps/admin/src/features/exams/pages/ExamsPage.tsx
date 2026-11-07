import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { apiFetch } from '../../../shared/api/client';
import { useAuth } from '../../../shared/auth/AuthContext';
import {
  distinctOptions,
  filterBySearch,
  filterWhen,
} from '../../../shared/lib/tableFilters';
import { ContentDrawer } from '../../../shared/ui/ContentDrawer';
import { PageHeaderActions } from '../../../shared/ui/PageHeaderActions';
import { PageState, StatusPill } from '../../../shared/ui/PageState';
import { TableFilterBar } from '../../../shared/ui/TableFilterBar';

type Exam = {
  id: string;
  title: string;
  summary: string | null;
  commercialMode: string;
  lifecycle: string;
  learnerCount: number;
  _count?: { tests: number };
};

export function ExamsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [commercialMode, setCommercialMode] = useState('free');
  const [iconKey, setIconKey] = useState('target');
  const [learnerCount, setLearnerCount] = useState('0');
  const [related, setRelated] = useState('');
  const [search, setSearch] = useState('');
  const [lifecycle, setLifecycle] = useState('');

  const list = useQuery({
    queryKey: ['exams'],
    queryFn: () => apiFetch<Exam[]>('/admin/exams'),
  });

  const create = useMutation({
    mutationFn: () =>
      apiFetch('/admin/exams', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          summary: summary.trim() || undefined,
          description: description.trim() || undefined,
          commercialMode,
          iconKey: iconKey.trim() || undefined,
          learnerCount: Number(learnerCount) || 0,
          relatedExams: related
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean),
        }),
      }),
    onSuccess: () => {
      setTitle('');
      setSummary('');
      setDescription('');
      setRelated('');
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ['exams'] });
    },
  });

  const publish = useMutation({
    mutationFn: (id: string) => apiFetch(`/admin/exams/${id}/publish`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exams'] }),
  });

  const rows = list.data ?? [];
  const filtered = useMemo(() => {
    let next = filterBySearch(rows, search, (row) => `${row.title} ${row.summary ?? ''}`);
    next = filterWhen(next, lifecycle, (row, value) => row.lifecycle === value);
    return next;
  }, [rows, search, lifecycle]);
  const lifecycleOptions = useMemo(
    () => distinctOptions(rows.map((row) => row.lifecycle)),
    [rows],
  );

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Competitive exams</h1>
          <p>Published exams and their tests. Explore tiles do not fill this list.</p>
        </div>
        {hasPermission('content.create') ? (
          <PageHeaderActions>
            <button type="button" className="btn" onClick={() => setOpen(true)}>
              Add exam
            </button>
          </PageHeaderActions>
        ) : null}
      </div>
      <PageState
        loading={list.isLoading}
        error={list.error instanceof Error ? list.error : null}
        empty={!list.isLoading && rows.length === 0}
        emptyTitle="No exams"
      >
        <TableFilterBar
          search={{ value: search, onChange: setSearch, placeholder: 'Search exams…' }}
          selects={[
            {
              id: 'lifecycle',
              label: 'State',
              value: lifecycle,
              onChange: setLifecycle,
              options: lifecycleOptions,
            },
          ]}
          onReset={() => {
            setSearch('');
            setLifecycle('');
          }}
        />
        <div className="panel">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Pricing</th>
                <th>Tests</th>
                <th>Learners</th>
                <th>State</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((exam) => (
                <tr key={exam.id}>
                  <td>{exam.title}</td>
                  <td>{exam.commercialMode === 'paid' ? 'Paid' : 'Free'}</td>
                  <td>{exam._count?.tests ?? 0}</td>
                  <td>{exam.learnerCount}</td>
                  <td>
                    <StatusPill value={exam.lifecycle} />
                  </td>
                  <td>
                    {exam.lifecycle !== 'published' && hasPermission('content.publish') ? (
                      <button type="button" className="btn" onClick={() => publish.mutate(exam.id)}>
                        Publish
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageState>
      <ContentDrawer open={open} onClose={() => setOpen(false)} title="Add exam">
        <form
          className="stack-form"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <div className="field">
            <label htmlFor="exam-title">Title</label>
            <input id="exam-title" value={title} onChange={(event) => setTitle(event.target.value)} required minLength={2} />
          </div>
          <div className="field">
            <label htmlFor="exam-summary">Summary</label>
            <input id="exam-summary" value={summary} onChange={(event) => setSummary(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="exam-description">Description</label>
            <textarea id="exam-description" rows={4} value={description} onChange={(event) => setDescription(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="exam-pricing">Pricing</label>
            <select id="exam-pricing" value={commercialMode} onChange={(event) => setCommercialMode(event.target.value)}>
              <option value="free">Free</option>
              <option value="paid">Paid</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="exam-icon">Icon name</label>
            <input id="exam-icon" value={iconKey} onChange={(event) => setIconKey(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="exam-learners">Learner count</label>
            <input
              id="exam-learners"
              type="number"
              min={0}
              value={learnerCount}
              onChange={(event) => setLearnerCount(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="exam-related">Related exams</label>
            <input
              id="exam-related"
              value={related}
              onChange={(event) => setRelated(event.target.value)}
              placeholder="Banking, Railways"
            />
            <p className="field-hint">Up to two labels are shown on the card.</p>
          </div>
          {create.error instanceof Error ? <p className="error">{create.error.message}</p> : null}
          <button className="btn" type="submit" disabled={create.isPending}>
            Save draft
          </button>
        </form>
      </ContentDrawer>
    </section>
  );
}
