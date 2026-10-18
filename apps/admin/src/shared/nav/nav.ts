import {
  LayoutDashboard, Users, ShieldCheck, Layers, BookOpen, CalendarRange, PlaySquare,
  FolderKanban, HelpCircle, FileText, ClipboardList, BarChart3, Radio, Compass,
  Image, Newspaper, Lightbulb, Sparkles, Mic, ShoppingBag, TicketPercent, ShoppingCart,
  RotateCcw, Bell, Mail, Award, IdCard, LifeBuoy, PieChart, ScrollText, Settings,
  GraduationCap, type LucideIcon,
} from 'lucide-react';

export type NavItem = {
  label: string;
  to: string;
  icon: LucideIcon;
  permission?: string;
  phase?: number;
  badgeKey?: 'suspended' | 'drafts';
};

export type NavGroup = {
  label: string;
  icon: LucideIcon;
  items: NavItem[];
};

/** Information architecture from requirements §6.1 — category-wise, icon per item */
export const NAV_GROUPS: NavGroup[] = [
  { label: 'Overview', icon: LayoutDashboard, items: [{ label: 'Dashboard', to: '/', icon: LayoutDashboard }] },
  {
    label: 'People', icon: Users,
    items: [
      { label: 'Learners', to: '/learners', icon: GraduationCap, permission: 'users.read', badgeKey: 'suspended' },
      { label: 'Staff & Roles', to: '/staff', icon: ShieldCheck, permission: 'admins.manage' },
      { label: 'Batches', to: '/batches', icon: Layers, permission: 'users.read' },
    ],
  },
  {
    label: 'Learning', icon: BookOpen,
    items: [
      { label: 'Courses', to: '/courses', icon: BookOpen, permission: 'content.edit', badgeKey: 'drafts' },
      { label: 'Semesters', to: '/semesters', icon: CalendarRange, permission: 'semester.review' },
      { label: 'Lessons & Resources', to: '/lessons', icon: PlaySquare, permission: 'content.edit' },
      { label: 'Projects & Reviews', to: '/projects', icon: FolderKanban, permission: 'semester.review' },
    ],
  },
  {
    label: 'Assessments', icon: ClipboardList,
    items: [
      { label: 'Question Bank', to: '/questions', icon: HelpCircle, permission: 'assessments.author' },
      { label: 'Tests', to: '/tests', icon: FileText, permission: 'assessments.author' },
      { label: 'Attempts', to: '/attempts', icon: ClipboardList, permission: 'results.read' },
      { label: 'Results', to: '/results', icon: BarChart3, permission: 'results.read' },
    ],
  },
  { label: 'Live Classes', icon: Radio, items: [{ label: 'Live Classes', to: '/live-classes', icon: Radio, permission: 'live.schedule' }] },
  {
    label: 'Content', icon: Compass,
    items: [
      { label: 'Explore Sections', to: '/explore', icon: Compass, permission: 'explore.manage' },
      { label: 'Home Banners', to: '/banners', icon: Image, permission: 'banners.manage' },
      { label: 'News', to: '/news', icon: Newspaper, permission: 'content.edit' },
      { label: 'General Awareness', to: '/awareness', icon: Lightbulb, permission: 'content.edit' },
      { label: 'Amazing Facts', to: '/facts', icon: Sparkles, permission: 'content.edit' },
      { label: 'Interview Prep', to: '/interview', icon: Mic, permission: 'content.edit' },
    ],
  },
  {
    label: 'Commerce', icon: ShoppingBag,
    items: [
      { label: 'Products', to: '/products', icon: ShoppingBag, permission: 'payments.read' },
      { label: 'Coupons', to: '/coupons', icon: TicketPercent, permission: 'payments.read' },
      { label: 'Orders', to: '/orders', icon: ShoppingCart, permission: 'payments.read' },
      { label: 'Refunds', to: '/refunds', icon: RotateCcw, permission: 'payments.refund_approve' },
    ],
  },
  {
    label: 'Communications', icon: Bell,
    items: [
      { label: 'Notifications', to: '/notifications', icon: Bell, permission: 'notifications.send_single' },
      { label: 'Templates', to: '/notification-templates', icon: Mail, permission: 'notifications.send_single' },
    ],
  },
  {
    label: 'Documents', icon: Award,
    items: [
      { label: 'Certificates', to: '/certificates', icon: Award, permission: 'documents.issue' },
      { label: 'Admit Cards', to: '/admit-cards', icon: IdCard, permission: 'documents.issue' },
    ],
  },
  {
    label: 'Operations', icon: Settings,
    items: [
      { label: 'Support', to: '/support', icon: LifeBuoy },
      { label: 'Reports', to: '/reports', icon: PieChart, permission: 'reports.read' },
      { label: 'Audit Log', to: '/audit', icon: ScrollText, permission: 'audit.read' },
      { label: 'Settings', to: '/settings', icon: Settings, permission: 'settings.manage' },
    ],
  },
];

export const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label })));

export function canSeeNavItem(item: NavItem, permissions: string[]): boolean {
  if (!item.permission) return true;
  return permissions.includes(item.permission);
}
