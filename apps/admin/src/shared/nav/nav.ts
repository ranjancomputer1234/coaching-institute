export type NavItem = {
  label: string;
  to: string;
  permission?: string;
  phase?: number;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

/** Information architecture from requirements §6.1 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ label: 'Dashboard', to: '/' }],
  },
  {
    label: 'People',
    items: [
      { label: 'Learners', to: '/learners', permission: 'users.read' },
      { label: 'Staff & Roles', to: '/staff', permission: 'admins.manage' },
      { label: 'Batches', to: '/batches', permission: 'users.read' },
    ],
  },
  {
    label: 'Learning',
    items: [
      { label: 'Courses', to: '/courses', permission: 'content.edit' },
      { label: 'Semesters', to: '/semesters', permission: 'semester.review' },
      { label: 'Lessons & Resources', to: '/lessons', permission: 'content.edit' },
      { label: 'Projects & Reviews', to: '/projects', permission: 'semester.review' },
    ],
  },
  {
    label: 'Assessments',
    items: [
      { label: 'Question Bank', to: '/questions', permission: 'assessments.author' },
      { label: 'Tests', to: '/tests', permission: 'assessments.author' },
      { label: 'Attempts', to: '/attempts', permission: 'results.read' },
      { label: 'Results', to: '/results', permission: 'results.read' },
    ],
  },
  {
    label: 'Live Classes',
    items: [
      { label: 'Live Classes', to: '/live-classes', permission: 'live.schedule' },
    ],
  },
  {
    label: 'Content',
    items: [
      { label: 'Explore Sections', to: '/explore', permission: 'explore.manage' },
      { label: 'Home Banners', to: '/banners', permission: 'banners.manage' },
      { label: 'News', to: '/news', permission: 'content.edit' },
      { label: 'General Awareness', to: '/awareness', permission: 'content.edit' },
      { label: 'Amazing Facts', to: '/facts', permission: 'content.edit' },
      { label: 'Interview Prep', to: '/interview', permission: 'content.edit' },
    ],
  },
  {
    label: 'Commerce',
    items: [
      { label: 'Products', to: '/products', permission: 'payments.read' },
      { label: 'Coupons', to: '/coupons', permission: 'payments.read' },
      { label: 'Orders', to: '/orders', permission: 'payments.read' },
      { label: 'Refunds', to: '/refunds', permission: 'payments.refund_approve' },
    ],
  },
  {
    label: 'Communications',
    items: [
      { label: 'Notifications', to: '/notifications', permission: 'notifications.send_single' },
      { label: 'Templates', to: '/notification-templates', permission: 'notifications.send_single' },
    ],
  },
  {
    label: 'Documents',
    items: [
      { label: 'Certificates', to: '/certificates', permission: 'documents.issue' },
      { label: 'Admit Cards', to: '/admit-cards', permission: 'documents.issue' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Support', to: '/support' },
      { label: 'Reports', to: '/reports', permission: 'reports.read' },
      { label: 'Audit Log', to: '/audit', permission: 'audit.read' },
      { label: 'Settings', to: '/settings', permission: 'settings.manage' },
    ],
  },
];

export function canSeeNavItem(
  item: NavItem,
  permissions: string[],
): boolean {
  if (!item.permission) return true;
  return permissions.includes(item.permission);
}
