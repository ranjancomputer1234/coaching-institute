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

type Banner = {
  id: string;
  campaignName: string;
  title: string;
  placement: string;
  priority: number;
  targetKind: string;
  targetRef: string;
  lifecycle: string;
  imageUrl: string | null;
  altText: string | null;
};

type ImageUploadSlot = {
  uploadUrl: string;
  formFields: Record<string, string>;
};

const TARGETS = [
  { kind: 'none', ref: '', label: 'Do not open a screen' },
  { kind: 'catalog', ref: 'course', label: 'Computer Courses' },
  { kind: 'catalog', ref: 'course,free', label: 'Computer Courses, free only' },
  { kind: 'catalog', ref: 'course,paid', label: 'Computer Courses, paid only' },
  { kind: 'catalog', ref: 'exam', label: 'Competitive Exam' },
  { kind: 'catalog', ref: 'news', label: 'Daily News' },
  { kind: 'catalog', ref: 'topic', label: 'General Awareness' },
  { kind: 'catalog', ref: 'fact', label: 'Amazing Facts' },
  { kind: 'catalog', ref: 'interview', label: 'Interview Prep' },
  { kind: 'course', ref: '', label: 'A specific course' },
] as const;

function targetKey(kind: string, ref: string) {
  return `${kind}|${ref}`;
}

function splitTarget(value: string) {
  const index = value.indexOf('|');
  return {
    targetKind: value.slice(0, index),
    targetRef: value.slice(index + 1),
  };
}

function isHttpsImage(value: string) {
  return value.trim().startsWith('https://');
}

async function uploadBannerFile(file: File): Promise<string> {
  const slot = await apiFetch<ImageUploadSlot>('/admin/banners/image-uploads', {
    method: 'POST',
  });
  const body = new FormData();
  Object.entries(slot.formFields).forEach(([key, value]) => body.append(key, value));
  body.append('file', file);
  const response = await fetch(slot.uploadUrl, { method: 'POST', body });
  const payload = (await response.json()) as {
    secure_url?: string;
    error?: { message?: string };
  };
  if (!response.ok || !payload.secure_url) {
    throw new Error(payload.error?.message || 'Image upload failed');
  }
  return payload.secure_url;
}

export function BannersPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Banner | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [campaignName, setCampaignName] = useState('');
  const [title, setTitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [altText, setAltText] = useState('');
  const [priority, setPriority] = useState('50');
  const [target, setTarget] = useState(targetKey('catalog', 'course'));
  const [courseId, setCourseId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [lifecycle, setLifecycle] = useState('');
  const [placement, setPlacement] = useState('');

  const list = useQuery({
    queryKey: ['banners'],
    queryFn: () => apiFetch<Banner[]>('/admin/banners'),
  });

  const resetForm = () => {
    setEditing(null);
    setCampaignName('');
    setTitle('');
    setImageUrl('');
    setAltText('');
    setPriority('50');
    setTarget(targetKey('catalog', 'course'));
    setCourseId('');
    setFormError(null);
  };

  const openCreate = () => {
    resetForm();
    setDrawerOpen(true);
  };

  const openEdit = (banner: Banner) => {
    setEditing(banner);
    setCampaignName(banner.campaignName);
    setTitle(banner.title);
    setImageUrl(banner.imageUrl ?? '');
    setAltText(banner.altText ?? '');
    setPriority(String(banner.priority));
    if (banner.targetKind === 'course') {
      setTarget(targetKey('course', ''));
      setCourseId(banner.targetRef);
    } else if (!banner.targetKind?.trim()) {
      setTarget(targetKey('none', ''));
      setCourseId('');
    } else {
      setTarget(targetKey(banner.targetKind, banner.targetRef));
      setCourseId('');
    }
    setFormError(null);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    resetForm();
  };

  const save = useMutation({
    mutationFn: async () => {
      const image = imageUrl.trim();
      if (!isHttpsImage(image)) {
        throw new Error('Paste a public https image link, or choose an image file.');
      }
      const parsed = splitTarget(target);
      const targetKind = parsed.targetKind === 'none' ? '' : parsed.targetKind;
      const targetRef = parsed.targetKind === 'course' ? courseId.trim() : parsed.targetRef;
      if (parsed.targetKind === 'course' && !targetRef) {
        throw new Error('Enter the course id this banner should open.');
      }
      const body = {
        campaignName: campaignName.trim(),
        title: title.trim(),
        imageUrl: image,
        altText: altText.trim() || title.trim(),
        placement: 'hero',
        priority: Number(priority) || 50,
        targetKind,
        targetRef,
      };
      if (editing) {
        return apiFetch(`/admin/banners/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      }
      return apiFetch('/admin/banners', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      closeDrawer();
      queryClient.invalidateQueries({ queryKey: ['banners'] });
    },
    onError: (error) => {
      setFormError(error instanceof Error ? error.message : 'Could not save the banner');
    },
  });

  const onPickFile = async (file: File | undefined) => {
    if (!file) return;
    setFormError(null);
    setUploading(true);
    try {
      const url = await uploadBannerFile(file);
      setImageUrl(url);
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Image upload failed. Paste a public https image link instead.',
      );
    } finally {
      setUploading(false);
    }
  };

  const publish = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/banners/${id}/publish`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['banners'] }),
  });

  const pause = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/banners/${id}/pause`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['banners'] }),
  });

  const rows = list.data ?? [];
  const filtered = useMemo(() => {
    let next = rows;
    next = filterBySearch(next, search, (b) => `${b.campaignName} ${b.title}`);
    next = filterWhen(next, lifecycle, (b, v) => b.lifecycle === v);
    next = filterWhen(next, placement, (b, v) => b.placement === v);
    return next;
  }, [rows, search, lifecycle, placement]);

  const lifecycleOptions = useMemo(
    () => distinctOptions(rows.map((b) => b.lifecycle)),
    [rows],
  );
  const placementOptions = useMemo(
    () => distinctOptions(rows.map((b) => b.placement)),
    [rows],
  );

  const targetOptions = useMemo(() => {
    const known: { value: string; label: string }[] = TARGETS.map((item) => ({
      value: targetKey(item.kind, item.ref),
      label: item.label,
    }));
    if (!known.some((item) => item.value === target)) {
      const { targetKind, targetRef } = splitTarget(target);
      known.unshift({
        value: target,
        label: `Current target (${targetKind}:${targetRef})`,
      });
    }
    return known;
  }, [target]);

  const canManage = hasPermission('banners.manage');

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Home banners</h1>
          <p>The phone shows the image only. Words and the button belong inside the picture.</p>
        </div>
        {canManage ? (
          <PageHeaderActions>
            <button type="button" className="btn" onClick={openCreate}>
              Add banner
            </button>
          </PageHeaderActions>
        ) : null}
      </div>

      <PageState
        loading={list.isLoading}
        error={list.error instanceof Error ? list.error : null}
        empty={!list.isLoading && rows.length === 0}
        emptyTitle="No banners"
      >
        <TableFilterBar
          search={{
            value: search,
            onChange: setSearch,
            placeholder: 'Search campaign or title…',
          }}
          selects={[
            {
              id: 'lifecycle',
              label: 'State',
              value: lifecycle,
              onChange: setLifecycle,
              options: lifecycleOptions,
            },
            {
              id: 'placement',
              label: 'Placement',
              value: placement,
              onChange: setPlacement,
              options: placementOptions,
            },
          ]}
          onReset={() => {
            setSearch('');
            setLifecycle('');
            setPlacement('');
          }}
        />
        {publish.error instanceof Error ? (
          <p className="error">{publish.error.message}</p>
        ) : null}
        <div className="panel">
          <table>
            <thead>
              <tr>
                <th>Image</th>
                <th>Campaign</th>
                <th>Title</th>
                <th>Placement</th>
                <th>Priority</th>
                <th>Opens</th>
                <th>State</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="muted">
                    No rows match filters.
                  </td>
                </tr>
              ) : (
                filtered.map((banner) => (
                  <tr key={banner.id}>
                    <td>
                      {banner.imageUrl ? (
                        <img className="banner-thumb" src={banner.imageUrl} alt="" />
                      ) : (
                        <span className="muted">No image</span>
                      )}
                    </td>
                    <td>{banner.campaignName}</td>
                    <td>{banner.title}</td>
                    <td>{banner.placement}</td>
                    <td>{banner.priority}</td>
                    <td>
                      {banner.targetKind}:{banner.targetRef}
                    </td>
                    <td>
                      <StatusPill value={banner.lifecycle} />
                    </td>
                    <td className="action-row">
                      {canManage ? (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => openEdit(banner)}
                        >
                          Edit
                        </button>
                      ) : null}
                      {banner.lifecycle === 'published' ? (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => pause.mutate(banner.id)}
                        >
                          Pause
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn"
                          disabled={!banner.imageUrl}
                          title={banner.imageUrl ? 'Publish' : 'Add an image before publishing'}
                          onClick={() => publish.mutate(banner.id)}
                        >
                          Publish
                        </button>
                      )}
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
        onClose={closeDrawer}
        title={editing ? 'Edit banner' : 'Add banner'}
      >
        <form
          className="stack-form"
          onSubmit={(event) => {
            event.preventDefault();
            setFormError(null);
            save.mutate();
          }}
        >
          <div className="field">
            <label htmlFor="banner-file">Banner image</label>
            <input
              id="banner-file"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                void onPickFile(file);
              }}
            />
            <p className="field-hint">
              Landscape, about 1080×432. The home carousel crops the edges and does not add a title.
            </p>
          </div>
          {isHttpsImage(imageUrl) ? (
            <img className="banner-thumb" src={imageUrl.trim()} alt="" />
          ) : null}
          <div className="field">
            <label htmlFor="banner-image">Or paste an https image link</label>
            <input
              id="banner-image"
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              placeholder="https://"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="banner-campaign">Campaign name</label>
            <input
              id="banner-campaign"
              value={campaignName}
              onChange={(event) => setCampaignName(event.target.value)}
              required
              minLength={2}
            />
          </div>
          <div className="field">
            <label htmlFor="banner-title">Admin title</label>
            <input
              id="banner-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              minLength={2}
            />
            <p className="field-hint">Used in this list only. It is not drawn on the phone.</p>
          </div>
          <div className="field">
            <label htmlFor="banner-alt">Image description</label>
            <input
              id="banner-alt"
              value={altText}
              onChange={(event) => setAltText(event.target.value)}
              placeholder="What the picture says"
            />
          </div>
          <div className="field">
            <label htmlFor="banner-target">Opens</label>
            <select
              id="banner-target"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
            >
              {targetOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          {splitTarget(target).targetKind === 'course' ? (
            <div className="field">
              <label htmlFor="banner-course">Course id</label>
              <input
                id="banner-course"
                value={courseId}
                onChange={(event) => setCourseId(event.target.value)}
                required
              />
            </div>
          ) : null}
          <div className="field">
            <label htmlFor="banner-priority">Priority</label>
            <input
              id="banner-priority"
              type="number"
              min={0}
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
            />
            <p className="field-hint">Higher numbers are sent first. Only the hero placement is shown.</p>
          </div>
          {formError ? <p className="error">{formError}</p> : null}
          <button type="submit" className="btn" disabled={save.isPending || uploading}>
            {uploading ? 'Uploading image…' : editing ? 'Save banner' : 'Add banner'}
          </button>
        </form>
      </ContentDrawer>
    </section>
  );
}
