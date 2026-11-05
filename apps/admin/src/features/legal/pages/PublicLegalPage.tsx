import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { apiFetch } from '../../../shared/api/client';
import { PageState } from '../../../shared/ui/PageState';

type LegalSummary = {
  slug: string;
  title: string;
  summary: string | null;
  version: number;
  effectiveAt: string | null;
};

type LegalDocument = LegalSummary & {
  body: string;
};

function formatDay(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function PublicLegalPage() {
  const { slug } = useParams();
  const list = useQuery({
    queryKey: ['public-legal'],
    queryFn: () => apiFetch<LegalSummary[]>('/legal'),
  });
  const page = useQuery({
    queryKey: ['public-legal', slug],
    enabled: Boolean(slug),
    queryFn: () => apiFetch<LegalDocument>(`/legal/${slug}`),
  });

  const pages = list.data ?? [];
  const effective = formatDay(page.data?.effectiveAt ?? null);

  return (
    <main className="legal-public">
      <article className="legal-doc">
        <p>
          <Link className="legal-doc-back" to="/login">
            Ranjan Educational Institute
          </Link>
        </p>
        <nav className="legal-doc-nav" aria-label="Legal pages">
          <Link to="/policies">All pages</Link>
          {pages.map((item) => (
            <Link key={item.slug} to={`/policies/${item.slug}`}>
              {item.title}
            </Link>
          ))}
        </nav>
        {slug ? (
          <PageState
            loading={page.isLoading}
            error={page.error instanceof Error ? page.error : null}
            empty={!page.isLoading && !page.data}
            emptyTitle="This page is not published"
          >
            <h1>{page.data?.title}</h1>
            {effective ? (
              <p className="muted">
                Version {page.data?.version} · Effective {effective}
              </p>
            ) : null}
            <p className="legal-body">{page.data?.body}</p>
          </PageState>
        ) : (
          <PageState
            loading={list.isLoading}
            error={list.error instanceof Error ? list.error : null}
            empty={!list.isLoading && pages.length === 0}
            emptyTitle="No legal pages published"
          >
            <h1>Legal pages</h1>
            <p className="muted">
              Privacy, terms, refunds, and the other public notices for Ranjan Educational Institute.
            </p>
            <ul className="queue-list">
              {pages.map((item) => (
                <li key={item.slug}>
                  <Link to={`/policies/${item.slug}`}>{item.title}</Link>
                  {item.summary ? <p className="muted">{item.summary}</p> : null}
                </li>
              ))}
            </ul>
          </PageState>
        )}
      </article>
    </main>
  );
}
