import { CourseCommercialMode } from '@prisma/client';

export type LearnerAccess = {
  granted: boolean;
  canPreview: boolean;
  canDownload: boolean;
  reason?: string | null;
  source?: string | null;
};

/** Guest/paid access for catalogue rows that use commercialMode. */
export function resolveCommercialAccess(
  commercialMode: string,
  opts?: { learnerId?: string | null; entitled?: boolean },
): LearnerAccess {
  const mode = String(commercialMode);
  if (mode === 'free') {
    return {
      granted: true,
      canPreview: true,
      canDownload: false,
      reason: null,
      source: 'free',
    };
  }
  if (opts?.entitled) {
    return {
      granted: true,
      canPreview: true,
      canDownload: true,
      reason: null,
      source: 'entitlement',
    };
  }
  return {
    granted: false,
    canPreview: false,
    canDownload: false,
    reason: opts?.learnerId ? 'purchase_required' : 'login_required',
    source: null,
  };
}

/** Pricing string free|paid used by editorial and tests. */
export function resolvePricingAccess(
  pricing: string | null | undefined,
  opts?: { learnerId?: string | null; entitled?: boolean },
): LearnerAccess {
  const value = (pricing ?? 'free').toLowerCase();
  return resolveCommercialAccess(
    value === 'paid' ? CourseCommercialMode.paid : CourseCommercialMode.free,
    opts,
  );
}

export function parseJsonArray<T = unknown>(
  raw: string | null | undefined,
): T[] {
  try {
    const parsed = JSON.parse(raw || '[]') as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}
