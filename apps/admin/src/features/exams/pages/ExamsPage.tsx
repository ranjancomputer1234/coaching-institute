import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { apiFetch } from '../../../shared/api/client';
import { useAuth } from '../../../shared/auth/AuthContext';
import {
  distinctOptions,
  filterBySearch,
  filterWhen,
} from '../../../shared/lib/tableFilters';
import { confirmDelete } from '../../../shared/lib/confirmDelete';
import { usePersistedViewMode } from '../../../shared/lib/usePersistedViewMode';
import { ContentDrawer } from '../../../shared/ui/ContentDrawer';
import { LayoutViewToggle } from '../../../shared/ui/LayoutViewToggle';
import { PageHeaderActions } from '../../../shared/ui/PageHeaderActions';
import { PageState, StatusPill } from '../../../shared/ui/PageState';
import { TableFilterBar } from '../../../shared/ui/TableFilterBar';

type Exam = {
  id: string;
  title: string;
  summary: string | null;
  description?: string | null;
  commercialMode: string;
  lifecycle: string;
  learnerCount: number;
  iconKey?: string | null;
  relatedExamsJson?: string | null;
  _count?: { tests: number };
};

type DrawerMode = 'create' | 'view' | 'edit';

function parseRelated(json?: string | null) {
  try {
    const parsed = JSON.parse(json || '[]') as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === 'string').join(', ')
      : '';
  } catch {
    return '';
  }
}

export function ExamsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canCreate = hasPermission('content.create');
  const canEdit = hasPermission('content.edit');
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<DrawerMode>('create');
  const [editing, setEditing] = useState<Exam | null>(null);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [commercialMode, setCommercialMode] = useState('free');
  const [iconKey, setIconKey] = useState('target');
  const [learnerCount, setLearnerCount] = useState('0');
  const [related, setRelated] = useState('');
  const [search, setSearch] = useState('');
  const [lifecycle, setLifecycle] = useState('');
  const [viewMode, setViewMode] = usePersistedViewMode('admin.exams.view');

  const list = useQuery({
    queryKey: ['exams'],
    queryFn: () => apiFetch<Exam[]>('/admin/exams'),
  });

  const resetForm = () => {
    setEditing(null);
    setTitle('');
    setSummary('');
    setDescription('');
    setCommercialMode('free');
    setIconKey('target');
    setLearnerCount('0');
    setRelated('');
  };

  const fillForm = (exam: Exam) => {
    setEditing(exam);
    setTitle(exam.title);
    setSummary(exam.summary ?? '');
    setDescription(exam.description ?? '');
    setCommercialMode(exam.commercialMode || 'free');
    setIconKey(exam.iconKey ?? 'target');
    setLearnerCount(String(exam.learnerCount ?? 0));
    setRelated(parseRelated(exam.relatedExamsJson));
  };

  const openCreate = () => {
    resetForm();
    setMode('create');
    setOpen(true);
  };

  const openView = (exam: Exam) => {
    fillForm(exam);
    setMode('view');
    setOpen(true);
  };

  const openEdit = (exam: Exam) => {
    fillForm(exam);
    setMode('edit');
    setOpen(true);
  };

  const closeDrawer = () => {
    setOpen(false);
    resetForm();
  };

  const save = useMutation({
    mutationFn: () => {
      const body = {
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
      };
      if (mode === 'edit' && editing) {
        return apiFetch(`/admin/exams/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      }
      return apiFetch('/admin/exams', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      closeDrawer();
      queryClient.invalidateQueries({ queryKey: ['exams'] });
    },
  });

  const publish = useMutation({
    mutationFn: (id: string) => apiFetch(`/admin/exams/${id}/publish`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exams'] }),
  });

  const archive = useMutation({
    mutationFn: (id: string) => apiFetch(`/admin/exams/${id}/archive`, { method: 'POST' }),
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

  const readOnly = mode === 'view';
  const drawerTitle =
    mode === 'view' ? 'View exam' : mode === 'edit' ? 'Edit exam' : 'Add exam';

  const renderActions = (exam: Exam) => (
    <>
      <button type="button" className="btn btn-ghost" onClick={() => openView(exam)}>
        View
      </button>
      {canEdit ? (
        <button type="button" className="btn btn-ghost" onClick={() => openEdit(exam)}>
          Edit
        </button>
      ) : null}
      {exam.lifecycle !== 'published' && hasPermission('content.publish') ? (
        <button type="button" className="btn" onClick={() => publish.mutate(exam.id)}>
          Publish
        </button>
      ) : null}
      {hasPermission('content.archive') && exam.lifecycle !== 'archived' ? (
        <button
          type="button"
          className="btn btn-danger-ghost"
          onClick={() => { if (confirmDelete(exam.title)) archive.mutate(exam.id); }}
        >
          Delete
        </button>
      ) : null}
    </>
  );

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Competitive exams</h1>
          <p>Published exams and their tests. Explore tiles do not fill this list.</p>
        </div>
        <PageHeaderActions>
          <LayoutViewToggle value={viewMode} onChange={setViewMode} />
          {canCreate ? (
            <button type="button" className="btn" onClick={openCreate}>
              Add exam
            </button>
          ) : null}
        </PageHeaderActions>
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
        {viewMode === 'grid' ? (
          <div className="entity-grid">
            {filtered.length === 0 ? (
              <p className="muted">No rows match filters.</p>
            ) : (
              filtered.map((exam) => (
                <div key={exam.id} className="entity-card">
                  <div className="entity-card-cover-empty" />
                  <div className="entity-card-meta">
                    <strong>{exam.title}</strong>
                    <StatusPill value={exam.lifecycle} />
                    <span className="muted small">
                      {exam.commercialMode === 'paid' ? 'Paid' : 'Free'} · {exam._count?.tests ?? 0} tests · {exam.learnerCount} learners
                    </span>
                  </div>
                  <div className="entity-card-actions action-row">
                    {renderActions(exam)}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : viewMode === 'compact' ? (
          <div className="panel">
            <ul className="entity-compact-list">
              {filtered.length === 0 ? (
                <li className="muted">No rows match filters.</li>
              ) : (
                filtered.map((exam) => (
                  <li key={exam.id}>
                    <div className="entity-compact-main">
                      <strong>{exam.title}</strong>
                      <span className="muted small">
                        {exam.commercialMode === 'paid' ? 'Paid' : 'Free'} · {exam._count?.tests ?? 0} tests
                      </span>
                      <StatusPill value={exam.lifecycle} />
                    </div>
                    <div className="entity-card-actions action-row">
                      {renderActions(exam)}
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        ) : (
          <div className="panel">
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Pricing</th>
                  <th>Tests</th>
                  <th>Learners</th>
                  <th>State</th>
                  <th>Actions</th>
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
                    <td className="action-row">
                      {renderActions(exam)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageState>
      <ContentDrawer open={open} onClose={closeDrawer} title={drawerTitle}>
        <form
          className="stack-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (readOnly) return;
            save.mutate();
          }}
        >
          <div className="field">
            <label htmlFor="exam-title">Title</label>
            <input
              id="exam-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              minLength={2}
              readOnly={readOnly}
              disabled={readOnly}
            />
          </div>
          <div className="field">
            <label htmlFor="exam-summary">Summary</label>
            <input
              id="exam-summary"
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              readOnly={readOnly}
              disabled={readOnly}
            />
          </div>
          <div className="field">
            <label htmlFor="exam-description">Description</label>
            <textarea
              id="exam-description"
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              readOnly={readOnly}
              disabled={readOnly}
            />
          </div>
          <div className="field">
            <label htmlFor="exam-pricing">Pricing</label>
            <select
              id="exam-pricing"
              value={commercialMode}
              onChange={(event) => setCommercialMode(event.target.value)}
              disabled={readOnly}
            >
              <option value="free">Free</option>
              <option value="paid">Paid</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="exam-icon">Icon name</label>
            <input
              id="exam-icon"
              value={iconKey}
              onChange={(event) => setIconKey(event.target.value)}
              readOnly={readOnly}
              disabled={readOnly}
            />
          </div>
          <div className="field">
            <label htmlFor="exam-learners">Learner count</label>
            <input
              id="exam-learners"
              type="number"
              min={0}
              value={learnerCount}
              onChange={(event) => setLearnerCount(event.target.value)}
              readOnly={readOnly}
              disabled={readOnly}
            />
          </div>
          <div className="field">
            <label htmlFor="exam-related">Related exams</label>
            <input
              id="exam-related"
              value={related}
              onChange={(event) => setRelated(event.target.value)}
              placeholder="Banking, Railways"
              readOnly={readOnly}
              disabled={readOnly}
            />
            <p className="field-hint">Up to two labels are shown on the card.</p>
          </div>
          {mode === 'view' && canEdit ? (
            <button type="button" className="btn" onClick={() => setMode('edit')}>
              Edit exam
            </button>
          ) : null}
          {!readOnly ? (
            <button className="btn" type="submit" disabled={save.isPending}>
              {mode === 'edit' ? 'Save changes' : 'Save draft'}
            </button>
          ) : null}
          {save.error instanceof Error ? <p className="error">{save.error.message}</p> : null}
        </form>
      </ContentDrawer>
    </section>
  );
}
