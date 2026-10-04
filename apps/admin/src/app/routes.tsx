import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '../shared/auth/ProtectedRoute';
import { AppLayout } from '../shared/layout/AppLayout';
import { LoginPage } from '../features/auth/pages/LoginPage';
import { DashboardPage } from '../features/dashboard/pages/DashboardPage';
import { LearnersPage } from '../features/learners/pages/LearnersPage';
import { BatchesPage } from '../features/batches/pages/BatchesPage';
import { CoursesPage } from '../features/courses/pages/CoursesPage';
import { ExplorePage } from '../features/explore/pages/ExplorePage';
import { BannersPage } from '../features/banners/pages/BannersPage';
import { AuditPage } from '../features/audit/pages/AuditPage';
import { QuestionsPage } from '../features/questions/pages/QuestionsPage';
import { TestsPage } from '../features/tests/pages/TestsPage';
import { AttemptsPage } from '../features/attempts/pages/AttemptsPage';
import { ResultsPage } from '../features/results/pages/ResultsPage';
import { ProjectsPage } from '../features/projects/pages/ProjectsPage';
import { SemestersPage } from '../features/semesters/pages/SemestersPage';
import { StaffPage } from '../features/staff/pages/StaffPage';
import { LessonsPage } from '../features/lessons/pages/LessonsPage';
import { EditorialPage } from '../features/editorial/pages/EditorialPage';
import { LiveClassesPage } from '../features/live/pages/LiveClassesPage';
import { NotificationsPage } from '../features/notifications/pages/NotificationsPage';
import { DocumentsPage } from '../features/documents/pages/DocumentsPage';
import { OrdersPage } from '../features/commerce/pages/OrdersPage';
import { RefundsPage } from '../features/commerce/pages/RefundsPage';
import { SupportPage } from '../features/support/pages/SupportPage';
import { ReportsPage } from '../features/reports/pages/ReportsPage';
import { SettingsPage } from '../features/settings/pages/SettingsPage';
import { RecordScreen } from '../features/records/RecordScreen';

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="learners" element={<LearnersPage />} />
            <Route path="batches" element={<BatchesPage />} />
            <Route path="courses" element={<CoursesPage />} />
            <Route path="explore" element={<ExplorePage />} />
            <Route path="banners" element={<BannersPage />} />
            <Route path="audit" element={<AuditPage />} />
            <Route path="staff" element={<StaffPage />} />
            <Route path="semesters" element={<SemestersPage />} />
            <Route path="lessons" element={<LessonsPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="questions" element={<QuestionsPage />} />
            <Route path="tests" element={<TestsPage />} />
            <Route path="attempts" element={<AttemptsPage />} />
            <Route path="results" element={<ResultsPage />} />
            <Route path="live-classes" element={<LiveClassesPage />} />
            <Route
              path="news"
              element={
                <EditorialPage
                  kind="news"
                  title="News"
                  summary="Institute news shown in the learner app"
                />
              }
            />
            <Route
              path="awareness"
              element={
                <EditorialPage
                  kind="awareness"
                  title="General awareness"
                  summary="Pairs, lists, and short articles"
                />
              }
            />
            <Route
              path="facts"
              element={
                <EditorialPage
                  kind="fact"
                  title="Amazing facts"
                  summary="Fact cards grouped by category"
                />
              }
            />
            <Route
              path="interview"
              element={
                <EditorialPage
                  kind="interview"
                  title="Interview prep"
                  summary="Interview questions and categories"
                />
              }
            />
            <Route
              path="products"
              element={
                <RecordScreen
                  title="Products & pricing"
                  summary="Catalog items. Checkout stays pending until a payment provider is configured."
                  queryKey="products"
                  listPath="/admin/products"
                  createPath="/admin/products"
                  permission="payments.read"
                  fields={[
                    { name: 'sku', label: 'SKU', required: true },
                    { name: 'title', label: 'Title', required: true },
                    { name: 'pricePaise', label: 'Price (paise)', type: 'number', required: true },
                  ]}
                  columns={[
                    { header: 'SKU', value: (row) => String(row.sku ?? '') },
                    { header: 'Title', value: (row) => String(row.title ?? '') },
                    {
                      header: 'Price',
                      value: (row) =>
                        `₹${(Number(row.pricePaise ?? 0) / 100).toFixed(2)}`,
                    },
                    { header: 'State', value: (row) => String(row.lifecycle ?? '') },
                  ]}
                  statusKey="State"
                />
              }
            />
            <Route
              path="coupons"
              element={
                <RecordScreen
                  title="Coupons"
                  summary="Discount codes applied during manual order review"
                  queryKey="coupons"
                  listPath="/admin/coupons"
                  createPath="/admin/coupons"
                  permission="payments.read"
                  fields={[
                    { name: 'code', label: 'Code', required: true },
                    { name: 'percentOff', label: 'Percent off', type: 'number', required: true },
                  ]}
                  columns={[
                    { header: 'Code', value: (row) => String(row.code ?? '') },
                    {
                      header: 'Percent',
                      value: (row) => String(row.percentOff ?? '—'),
                    },
                    {
                      header: 'State',
                      value: (row) => (row.active ? 'active' : 'inactive'),
                    },
                  ]}
                  statusKey="State"
                />
              }
            />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="refunds" element={<RefundsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route
              path="notification-templates"
              element={
                <RecordScreen
                  title="Notification templates"
                  summary="Versioned message templates. Delivery still needs a push provider."
                  queryKey="templates"
                  listPath="/admin/notification-templates"
                  createPath="/admin/notification-templates"
                  permission="notifications.send_single"
                  fields={[
                    { name: 'key', label: 'Key', required: true },
                    { name: 'title', label: 'Title', required: true },
                    { name: 'body', label: 'Body', required: true },
                  ]}
                  columns={[
                    { header: 'Key', value: (row) => String(row.key ?? '') },
                    { header: 'Title', value: (row) => String(row.title ?? '') },
                    { header: 'Version', value: (row) => String(row.version ?? '') },
                  ]}
                />
              }
            />
            <Route
              path="certificates"
              element={<DocumentsPage documentType="certificate" title="Certificates" />}
            />
            <Route
              path="admit-cards"
              element={<DocumentsPage documentType="admit_card" title="Admit cards" />}
            />
            <Route path="support" element={<SupportPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>
        <Route path="students" element={<Navigate to="/learners" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
