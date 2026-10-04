/** Granular admin permission keys (requirements §5.3) */
export const PERMISSIONS = [
  'users.read',
  'users.update',
  'users.suspend',
  'users.export',
  'users.impersonate_safe',
  'enrollments.create',
  'enrollments.revoke',
  'content.create',
  'content.edit',
  'content.review',
  'content.publish',
  'content.archive',
  'explore.manage',
  'banners.manage',
  'assessments.author',
  'assessments.publish',
  'results.read',
  'results.recompute',
  'results.override',
  'results.publish',
  'semester.review',
  'semester.approve',
  'documents.generate',
  'documents.issue',
  'documents.revoke',
  'live.schedule',
  'live.host',
  'live.moderate',
  'notifications.send_single',
  'notifications.send_bulk',
  'payments.read',
  'payments.refund_request',
  'payments.refund_approve',
  'settings.manage',
  'admins.manage',
  'audit.read',
  'reports.read',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export type ContentLifecycle =
  | 'draft'
  | 'in_review'
  | 'changes_requested'
  | 'approved'
  | 'scheduled'
  | 'published'
  | 'unpublished'
  | 'archived';

export type LearnerAccountState =
  | 'pending_verification'
  | 'active'
  | 'suspended'
  | 'deletion_requested'
  | 'deleted'
  | 'blocked';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  roles: string[];
  permissions: Permission[];
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type LoginResponse = {
  accessToken: string;
  user: AuthUser;
};

export type Paginated<T> = {
  items: T[];
  nextCursor: string | null;
  total: number;
};

export type Learner = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  accountState: LearnerAccountState;
  verifiedEmail: boolean;
  verifiedPhone: boolean;
  batchId: string | null;
  batch?: Batch | null;
  lastActiveAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Batch = {
  id: string;
  code: string | null;
  name: string;
  subject: string | null;
  courseId: string | null;
  startDate: string | null;
  endDate: string | null;
  timezone: string;
  capacity: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  _count?: { learners: number };
};

export type Course = {
  id: string;
  slug: string;
  title: string;
  shortTitle: string | null;
  summary: string | null;
  deliveryType: string;
  commercialMode: string;
  lifecycle: ContentLifecycle;
  featured: boolean;
  revision: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { lessons: number; enrollments: number };
};

export type Lesson = {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  sortOrder: number;
  durationMinutes: number | null;
  contentType: string;
  isPreview: boolean;
  lifecycle: ContentLifecycle;
};

export type ExploreSection = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  badge: string | null;
  category: 'learn' | 'prepare' | 'discover';
  targetKind: string;
  targetRef: string;
  pricingFilter: string;
  sortOrder: number;
  featured: boolean;
  homeVisible: boolean;
  lifecycle: ContentLifecycle;
  startsAt: string | null;
  endsAt: string | null;
  revision: number;
  publishedAt: string | null;
};

export type Banner = {
  id: string;
  campaignName: string;
  title: string;
  subtitle: string | null;
  ctaLabel: string | null;
  placement: 'hero' | 'compact' | 'live_class' | 'modal';
  priority: number;
  targetKind: string;
  targetRef: string;
  lifecycle: ContentLifecycle;
  startsAt: string | null;
  endsAt: string | null;
  revision: number;
  publishedAt: string | null;
};

export type AuditEvent = {
  id: string;
  occurredAtUtc: string;
  actorDisplay: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  reason: string | null;
  outcome: string;
  severity: string;
};

export type DashboardMetrics = {
  learners: {
    total: number;
    active: number;
    suspended: number;
    pendingVerification: number;
  };
  enrollments: { total: number };
  courses: { published: number; draft: number };
  explore: { published: number };
  banners: { published: number; scheduled: number };
  queues: {
    draftsAwaitingReview: number;
    suspendedLearners: number;
  };
  recentAudit: AuditEvent[];
};
