import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import Hls from 'hls.js';

import { useEffect, useMemo, useRef, useState } from 'react';

import { apiFetch } from '../../../shared/api/client';

import { useAuth } from '../../../shared/auth/AuthContext';

import {
  distinctOptions,
  filterBySearch,
  filterWhen,
} from '../../../shared/lib/tableFilters';
import { ContentDrawer } from '../../../shared/ui/ContentDrawer';
import { TableFilterBar } from '../../../shared/ui/TableFilterBar';

import { PageState, StatusPill } from '../../../shared/ui/PageState';



type Resource = {

  id: string;

  title: string;

  kind: string;

  mimeType: string;

  downloadable: boolean;

  lifecycle: string;

  course?: { title: string } | null;

  lesson?: { title: string } | null;

  mediaAsset?: {

    provider?: string | null;

    providerStatus?: string | null;

    providerPlaybackId?: string | null;

  } | null;

};



type VideoUploadStart = {

  resourceId: string;

  provider: 'mux' | 'cloudinary';

  uploadUrl: string;

  uploadMethod: 'PUT' | 'POST_FORM';

  formFields: Record<string, string> | null;

  status: string;

};

type VideoStatus = { status: string; playbackId?: string | null; error?: string | null };

type VideoPlayback = {

  provider?: string;

  playbackUrl: string;

  fallbackUrl?: string | null;

  expiresInSeconds: number | null;

};



type UploadQueueItem = {

  key: string;

  file: File;

  title: string;

  percent: number | null;

  phase: 'idle' | 'uploading' | 'done' | 'error';

  message?: string;

};



function titleFromFileName(name: string): string {

  const base = name.replace(/\.[^.]+$/, '').trim();

  return base || name;

}



/**

 * Send the file straight to the provider with progress (fetch cannot report

 * upload progress). Mux takes a raw PUT; Cloudinary (backup) takes a

 * multipart POST with the server-signed form fields.

 */

function uploadFileWithProgress(

  start: VideoUploadStart,

  file: File,

  providerLabel: string,

  onProgress: (percent: number) => void,

): Promise<void> {

  return new Promise((resolve, reject) => {

    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (event) => {

      if (event.lengthComputable) {

        onProgress(Math.round((event.loaded / event.total) * 100));

      }

    };

    xhr.onload = () =>

      xhr.status >= 200 && xhr.status < 300

        ? resolve()

        : reject(new Error(`Upload to ${providerLabel} failed (${xhr.status})`));

    xhr.onerror = () =>

      reject(new Error(`Upload to ${providerLabel} failed (network error)`));

    if (start.uploadMethod === 'POST_FORM') {

      const form = new FormData();

      for (const [key, value] of Object.entries(start.formFields ?? {})) {

        form.append(key, value);

      }

      form.append('file', file);

      xhr.open('POST', start.uploadUrl);

      xhr.send(form);

    } else {

      xhr.open('PUT', start.uploadUrl);

      xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');

      xhr.send(file);

    }

  });

}



/** Plays provider HLS: native on Safari, hls.js elsewhere, MP4 as last resort. */

function HlsPlayer({ src, fallbackSrc }: { src: string; fallbackSrc?: string | null }) {

  const ref = useRef<HTMLVideoElement>(null);



  useEffect(() => {

    const video = ref.current;

    if (!video) return;

    if (video.canPlayType('application/vnd.apple.mpegurl')) {

      video.src = src;

      return;

    }

    if (Hls.isSupported()) {

      const hls = new Hls();

      hls.loadSource(src);

      hls.attachMedia(video);

      hls.on(Hls.Events.ERROR, (_event, data) => {

        if (data.fatal && fallbackSrc) {

          hls.destroy();

          video.src = fallbackSrc;

          void video.play().catch(() => undefined);

        }

      });

      return () => hls.destroy();

    }

    video.src = fallbackSrc ?? src;

  }, [src, fallbackSrc]);



  return (

    <video

      ref={ref}

      controls

      playsInline

      style={{ width: '100%', maxWidth: '100%', background: '#000', borderRadius: 8 }}

    />

  );

}



export function LessonsPage() {

  const { hasPermission } = useAuth();

  const queryClient = useQueryClient();

  const [drawer, setDrawer] = useState<'detail' | 'upload' | null>(null);

  const [selected, setSelected] = useState<Resource | null>(null);

  const [tableSearch, setTableSearch] = useState('');

  const [kindFilter, setKindFilter] = useState('');

  const [lifecycleFilter, setLifecycleFilter] = useState('');



  const [uploadKind, setUploadKind] = useState('pdf');

  const [storageKey, setStorageKey] = useState('');

  const [nonVideoTitle, setNonVideoTitle] = useState('');

  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);

  const [uploadNote, setUploadNote] = useState<string | null>(null);

  const [detailNote, setDetailNote] = useState<string | null>(null);

  const [preview, setPreview] = useState<{

    title: string;

    url: string;

    fallbackUrl?: string | null;

    provider?: string;

  } | null>(null);



  const list = useQuery({

    queryKey: ['resources'],

    queryFn: () => apiFetch<Resource[]>('/admin/resources'),

  });



  const openDetail = (row: Resource) => {

    setSelected(row);

    setPreview(null);

    setDetailNote(null);

    setDrawer('detail');

  };



  const openUpload = () => {

    setUploadKind('video');

    setStorageKey('');

    setNonVideoTitle('');

    setUploadQueue([]);

    setUploadNote(null);

    setDrawer('upload');

  };



  const closeDrawer = () => {

    setDrawer(null);

    setPreview(null);

    setDetailNote(null);

  };



  const uploadOneVideo = async (item: UploadQueueItem): Promise<void> => {

    const update = (patch: Partial<UploadQueueItem>) => {

      setUploadQueue((q) => q.map((row) => (row.key === item.key ? { ...row, ...patch } : row)));

    };

    update({ phase: 'uploading', percent: 0, message: 'Requesting upload slot…' });

    const start = await apiFetch<VideoUploadStart>('/admin/resources/video-uploads', {

      method: 'POST',

      body: JSON.stringify({

        title: item.title.trim() || titleFromFileName(item.file.name),

        fileName: item.file.name,

        mimeType: item.file.type || 'video/mp4',

        byteSize: item.file.size,

      }),

    });

    const providerLabel = start.provider === 'cloudinary' ? 'Cloudinary' : 'Mux';

    update({ message: `Uploading to ${providerLabel}…` });

    await uploadFileWithProgress(start, item.file, providerLabel, (percent) => update({ percent }));

    update({

      phase: 'done',

      percent: 100,

      message: `Uploaded — processing on ${providerLabel}. Check status from the resource detail.`,

    });

  };



  const runVideoUploads = useMutation({

    mutationFn: async () => {

      const pending = uploadQueue.filter((i) => i.phase === 'idle' || i.phase === 'error');

      if (pending.length === 0) throw new Error('Add at least one video file');

      let failures = 0;

      for (const item of pending) {

        try {

          await uploadOneVideo(item);

        } catch (error) {

          failures += 1;

          const message = error instanceof Error ? error.message : 'Upload failed';

          setUploadQueue((q) =>

            q.map((row) =>

              row.key === item.key ? { ...row, phase: 'error', message } : row,

            ),

          );

        }

      }

      if (failures > 0) {

        throw new Error(

          failures === pending.length

            ? 'All uploads failed'

            : `${failures} of ${pending.length} uploads failed`,

        );

      }

    },

    onSuccess: () => {

      setUploadNote('All uploads finished. Videos may take a few seconds to become ready.');

      queryClient.invalidateQueries({ queryKey: ['resources'] });

    },

    onError: (error) => {

      setUploadNote(error instanceof Error ? error.message : 'Upload failed');

    },

  });



  const createNonVideo = useMutation({

    mutationFn: () =>

      apiFetch('/admin/resources', {

        method: 'POST',

        body: JSON.stringify({

          title: nonVideoTitle,

          kind: uploadKind,

          mimeType: uploadKind === 'video' ? 'video/mp4' : 'application/pdf',

          storageKey: storageKey || undefined,

          downloadable: true,

        }),

      }),

    onSuccess: () => {

      setNonVideoTitle('');

      setStorageKey('');

      setUploadNote('Resource added.');

      queryClient.invalidateQueries({ queryKey: ['resources'] });

    },

    onError: (error) => {

      setUploadNote(error instanceof Error ? error.message : 'Could not add resource');

    },

  });



  const checkStatus = useMutation({

    mutationFn: (id: string) => apiFetch<VideoStatus>(`/admin/resources/${id}/video-status`),

    onSuccess: (data) => {

      setDetailNote(

        data.status === 'ready'

          ? 'Video is ready. Use Preview below to test streaming.'

          : data.status === 'errored'

            ? `The provider could not process this video${data.error ? `: ${data.error}` : ''}`

            : `Provider status: ${data.status}. Wait a few seconds and check again.`,

      );

      queryClient.invalidateQueries({ queryKey: ['resources'] });

    },

    onError: (error) =>

      setDetailNote(error instanceof Error ? error.message : 'Status check failed'),

  });



  const openPreview = useMutation({

    mutationFn: (row: Resource) =>

      apiFetch<VideoPlayback>(`/admin/resources/${row.id}/video-playback`).then((data) => ({

        row,

        data,

      })),

    onSuccess: ({ row, data }) =>

      setPreview({

        title: row.title,

        url: data.playbackUrl,

        fallbackUrl: data.fallbackUrl,

        provider: data.provider,

      }),

    onError: (error) =>

      setDetailNote(error instanceof Error ? error.message : 'Preview failed'),

  });



  const rows = list.data ?? [];

  const filteredRows = useMemo(() => {
    let next = rows;
    next = filterBySearch(
      next,
      tableSearch,
      (r) => `${r.title} ${r.kind} ${r.course?.title ?? ''} ${r.lesson?.title ?? ''}`,
    );
    next = filterWhen(next, kindFilter, (r, v) => r.kind === v);
    next = filterWhen(next, lifecycleFilter, (r, v) => r.lifecycle === v);
    return next;
  }, [rows, tableSearch, kindFilter, lifecycleFilter]);

  const kindOptions = useMemo(
    () => distinctOptions(rows.map((r) => r.kind)),
    [rows],
  );
  const lifecycleOptions = useMemo(
    () => distinctOptions(rows.map((r) => r.lifecycle)),
    [rows],
  );

  const canCreate = hasPermission('content.create');

  const detailRow =

    selected && rows.find((r) => r.id === selected.id)

      ? rows.find((r) => r.id === selected.id)!

      : selected;



  const onPickVideos = (files: FileList | null) => {

    if (!files?.length) return;

    const next: UploadQueueItem[] = Array.from(files).map((file) => ({

      key: `${file.name}-${file.size}-${file.lastModified}`,

      file,

      title: titleFromFileName(file.name),

      percent: null,

      phase: 'idle',

    }));

    setUploadQueue((q) => {

      const keys = new Set(q.map((i) => i.key));

      return [...q, ...next.filter((i) => !keys.has(i.key))];

    });

  };



  return (

    <section>

      <div className="page-header">

        <div>

          <h1>Lessons & resources</h1>

          <p>Protected files attached to courses and lessons</p>

        </div>

        {canCreate ? (

          <button type="button" className="btn" onClick={openUpload}>

            Upload resource

          </button>

        ) : null}

      </div>



      <PageState

        loading={list.isLoading}

        error={list.error instanceof Error ? list.error : null}

        empty={!list.isLoading && rows.length === 0}

        emptyTitle="No resources yet"

        emptyHint={canCreate ? 'Use Upload resource to add files.' : undefined}

      >

        <TableFilterBar

          search={{

            value: tableSearch,

            onChange: setTableSearch,

            placeholder: 'Search title, course, lesson…',

          }}

          selects={[

            {

              id: 'kind',

              label: 'Kind',

              value: kindFilter,

              onChange: setKindFilter,

              options: kindOptions,

            },

            {

              id: 'lifecycle',

              label: 'State',

              value: lifecycleFilter,

              onChange: setLifecycleFilter,

              options: lifecycleOptions,

            },

          ]}

          onReset={() => {

            setTableSearch('');

            setKindFilter('');

            setLifecycleFilter('');

          }}

        />

        <div className="panel">

          <table>

            <thead>

              <tr>

                <th>Title</th>

                <th>Kind</th>

                <th>Course</th>

                <th>Lesson</th>

                <th>State</th>

                <th>Video</th>

              </tr>

            </thead>

            <tbody>

              {filteredRows.length === 0 ? (

                <tr>

                  <td colSpan={6} className="muted">

                    No rows match filters.

                  </td>

                </tr>

              ) : (

                filteredRows.map((row) => (

                <tr

                  key={row.id}

                  className={`row-clickable ${selected?.id === row.id && drawer === 'detail' ? 'is-selected' : ''}`}

                  onClick={() => openDetail(row)}

                >

                  <td>{row.title}</td>

                  <td>{row.kind}</td>

                  <td>{row.course?.title ?? '—'}</td>

                  <td>{row.lesson?.title ?? '—'}</td>

                  <td>

                    <StatusPill value={row.lifecycle} />

                  </td>

                  <td onClick={(e) => e.stopPropagation()}>

                    {row.kind === 'video' &&

                    (row.mediaAsset?.provider === 'mux' ||

                      row.mediaAsset?.provider === 'cloudinary') ? (

                      <>

                        {row.mediaAsset.provider}:{' '}

                        <StatusPill value={row.mediaAsset.providerStatus ?? 'waiting'} />{' '}

                        {row.mediaAsset.providerStatus === 'ready' ? (

                          <button

                            className="btn"

                            type="button"

                            disabled={openPreview.isPending}

                            onClick={() => {

                              openDetail(row);

                              openPreview.mutate(row);

                            }}

                          >

                            Preview

                          </button>

                        ) : (

                          <button

                            className="btn"

                            type="button"

                            disabled={checkStatus.isPending}

                            onClick={() => {

                              openDetail(row);

                              checkStatus.mutate(row.id);

                            }}

                          >

                            Check status

                          </button>

                        )}

                      </>

                    ) : (

                      '—'

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

        open={drawer === 'detail' && !!detailRow}

        onClose={closeDrawer}

        title={detailRow?.title ?? 'Resource'}

        size="panel"

      >

        {detailRow ? (

          <>

            <dl className="drawer-dl">

              <dt>Kind</dt>

              <dd>{detailRow.kind}</dd>

              <dt>State</dt>

              <dd>

                <StatusPill value={detailRow.lifecycle} />

              </dd>

              <dt>Course</dt>

              <dd>{detailRow.course?.title ?? '—'}</dd>

              <dt>Lesson</dt>

              <dd>{detailRow.lesson?.title ?? '—'}</dd>

              <dt>MIME</dt>

              <dd>{detailRow.mimeType}</dd>

              <dt>Download</dt>

              <dd>{detailRow.downloadable ? 'Allowed' : 'No'}</dd>

              {detailRow.mediaAsset?.provider ? (

                <>

                  <dt>Provider</dt>

                  <dd>{detailRow.mediaAsset.provider}</dd>

                  <dt>Stream</dt>

                  <dd>

                    <StatusPill value={detailRow.mediaAsset.providerStatus ?? 'waiting'} />

                  </dd>

                </>

              ) : null}

            </dl>



            {detailRow.kind === 'video' &&

            (detailRow.mediaAsset?.provider === 'mux' ||

              detailRow.mediaAsset?.provider === 'cloudinary') ? (

              <div className="action-row" style={{ marginBottom: '1rem' }}>

                {detailRow.mediaAsset.providerStatus === 'ready' ? (

                  <button

                    className="btn"

                    type="button"

                    disabled={openPreview.isPending}

                    onClick={() => openPreview.mutate(detailRow)}

                  >

                    Preview stream

                  </button>

                ) : (

                  <button

                    className="btn"

                    type="button"

                    disabled={checkStatus.isPending}

                    onClick={() => checkStatus.mutate(detailRow.id)}

                  >

                    Check video status

                  </button>

                )}

              </div>

            ) : null}



            {detailNote ? (

              <p role="status" className="muted small">

                {detailNote}

              </p>

            ) : null}



            {preview && selected?.id === detailRow.id ? (

              <div>

                <h3 style={{ marginTop: '1.25rem' }}>Streaming test</h3>

                <p className="muted small">

                  Provider: {preview.provider ?? 'mux'}. If this plays and seeks smoothly, upload

                  and streaming both work.

                </p>

                <HlsPlayer src={preview.url} fallbackSrc={preview.fallbackUrl} />

              </div>

            ) : null}

          </>

        ) : null}

      </ContentDrawer>



      <ContentDrawer

        open={drawer === 'upload'}

        onClose={closeDrawer}

        title="Upload resource"

        size="full"

      >

        <form

          className="stack-form"

          onSubmit={(event) => {

            event.preventDefault();

            if (uploadKind === 'video') {

              runVideoUploads.mutate();

            } else {

              createNonVideo.mutate();

            }

          }}

        >

          <div className="field">

            <label htmlFor="upload-kind">Kind</label>

            <select

              id="upload-kind"

              value={uploadKind}

              onChange={(event) => {

                setUploadKind(event.target.value);

                setUploadQueue([]);

                setUploadNote(null);

              }}

            >

              <option value="pdf">PDF</option>

              <option value="video">Video</option>

              <option value="notes">Notes</option>

              <option value="audio">Audio</option>

            </select>

          </div>



          {uploadKind === 'video' ? (

            <>

              <div className="field">

                <label htmlFor="upload-videos">Video files (Mux, Cloudinary backup)</label>

                <input

                  id="upload-videos"

                  type="file"

                  accept="video/*"

                  multiple

                  onChange={(event) => {

                    onPickVideos(event.target.files);

                    event.target.value = '';

                  }}

                />

                <p className="muted small">Select one or more videos. Each gets its own title below.</p>

              </div>



              {uploadQueue.length > 0 ? (

                <div className="upload-queue">

                  {uploadQueue.map((item) => (

                    <div key={item.key} className="upload-queue-item">

                      <div className="field">

                        <label htmlFor={`title-${item.key}`}>Title</label>

                        <input

                          id={`title-${item.key}`}

                          value={item.title}

                          disabled={item.phase === 'uploading' || item.phase === 'done'}

                          onChange={(event) =>

                            setUploadQueue((q) =>

                              q.map((row) =>

                                row.key === item.key ? { ...row, title: event.target.value } : row,

                              ),

                            )

                          }

                          required

                        />

                      </div>

                      <p className="muted small">

                        {item.file.name} · {(item.file.size / (1024 * 1024)).toFixed(1)} MB

                      </p>

                      {item.message ? <p className="small">{item.message}</p> : null}

                      {item.percent !== null && item.phase === 'uploading' ? (

                        <div className="upload-progress" aria-hidden>

                          <span style={{ width: `${item.percent}%` }} />

                        </div>

                      ) : null}

                      {item.phase === 'idle' || item.phase === 'error' ? (

                        <button

                          type="button"

                          className="btn btn-ghost"

                          onClick={() =>

                            setUploadQueue((q) => q.filter((row) => row.key !== item.key))

                          }

                        >

                          Remove

                        </button>

                      ) : null}

                    </div>

                  ))}

                </div>

              ) : null}



              <button

                className="btn"

                type="submit"

                disabled={runVideoUploads.isPending || uploadQueue.length === 0}

              >

                {runVideoUploads.isPending ? 'Uploading…' : 'Upload all videos'}

              </button>

            </>

          ) : (

            <>

              <div className="field">

                <label htmlFor="upload-title">Title</label>

                <input

                  id="upload-title"

                  value={nonVideoTitle}

                  onChange={(event) => setNonVideoTitle(event.target.value)}

                  required

                />

              </div>

              <div className="field">

                <label htmlFor="upload-storage-key">Storage key</label>

                <input

                  id="upload-storage-key"

                  value={storageKey}

                  placeholder="private/course/file.enc"

                  onChange={(event) => setStorageKey(event.target.value)}

                />

              </div>

              <button className="btn" type="submit" disabled={createNonVideo.isPending}>

                Add resource

              </button>

            </>

          )}



          {uploadNote ? <p role="status">{uploadNote}</p> : null}

        </form>

      </ContentDrawer>

    </section>

  );

}

