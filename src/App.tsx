import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { type ReactNode } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { NavGuardProvider } from './context/NavGuardContext';
import { Layout } from './components/Layout';
import { Spinner } from './components/ui';
import { canApprove, isAdmin } from './services/rbac';
import type { UserWithRoles } from './types';

import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import NewFormPage from './pages/NewFormPage';
import FormRunnerPage from './pages/FormRunnerPage';
import MyFormsPage from './pages/MyFormsPage';
import PendingPage from './pages/PendingPage';
import HistoryPage from './pages/HistoryPage';
import FormViewPage from './pages/FormViewPage';
import AdminLayout from './pages/admin/AdminLayout';
import DashboardPage from './pages/admin/DashboardPage';
import UsersPage from './pages/admin/UsersPage';
import CertificationsPage from './pages/admin/CertificationsPage';
import DevicesPage from './pages/admin/DevicesPage';
import ExamsPage from './pages/admin/ExamsPage';
import ExamEditorPage from './pages/admin/ExamEditorPage';
import RenewalAdminPage from './pages/admin/RenewalAdminPage';
import ExamsListPage from './pages/ExamsListPage';
import ExamTakePage from './pages/ExamTakePage';
import ExamResultPage from './pages/ExamResultPage';
import MyCertificationsPage from './pages/MyCertificationsPage';
import RenewalsApprovalPage from './pages/RenewalsApprovalPage';
import TrackingFaultsPage from './pages/TrackingFaultsPage';
import SystemsPage from './pages/admin/SystemsPage';
import UnitsPage from './pages/admin/UnitsPage';
import RanksPage from './pages/admin/RanksPage';
import TemplatesPage from './pages/admin/TemplatesPage';
import TemplateEditorPage from './pages/admin/TemplateEditorPage';
import AuditPage from './pages/admin/AuditPage';
import SettingsPage from './pages/admin/SettingsPage';
import BackupPage from './pages/admin/BackupPage';

function RequireAuth({
  children,
  check,
}: {
  children: ReactNode;
  check?: (u: UserWithRoles) => boolean;
}) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner label="טוען…" />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (check && !check(user)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Layout>
              <HomePage />
            </Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/new"
        element={
          <RequireAuth>
            <Layout>
              <NewFormPage />
            </Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/form/:id"
        element={
          <RequireAuth>
            <Layout>
              <FormRunnerPage />
            </Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/my"
        element={
          <RequireAuth>
            <Layout>
              <MyFormsPage />
            </Layout>
          </RequireAuth>
        }
      />
      <Route path="/exams" element={<RequireAuth><Layout><ExamsListPage /></Layout></RequireAuth>} />
      <Route path="/exam/take/:attemptId" element={<RequireAuth><Layout><ExamTakePage /></Layout></RequireAuth>} />
      <Route path="/exam/result/:attemptId" element={<RequireAuth><Layout><ExamResultPage /></Layout></RequireAuth>} />
      <Route path="/my-certifications" element={<RequireAuth><Layout><MyCertificationsPage /></Layout></RequireAuth>} />
      <Route path="/renewals" element={<RequireAuth><Layout><RenewalsApprovalPage /></Layout></RequireAuth>} />
      <Route path="/tracking" element={<RequireAuth><Layout><TrackingFaultsPage /></Layout></RequireAuth>} />
      <Route
        path="/pending"
        element={
          <RequireAuth check={canApprove}>
            <Layout>
              <PendingPage />
            </Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/history"
        element={
          <RequireAuth>
            <Layout>
              <HistoryPage />
            </Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/view/:id"
        element={
          <RequireAuth>
            <FormViewPage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireAuth check={isAdmin}>
            <Layout>
              <AdminLayout />
            </Layout>
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="systems" element={<SystemsPage />} />
        <Route path="units" element={<UnitsPage />} />
        <Route path="ranks" element={<RanksPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="certifications" element={<CertificationsPage />} />
        <Route path="exams" element={<ExamsPage />} />
        <Route path="exams/:id" element={<ExamEditorPage />} />
        <Route path="renewals" element={<RenewalAdminPage />} />
        <Route path="devices" element={<DevicesPage />} />
        <Route path="templates" element={<TemplatesPage />} />
        <Route path="templates/:id" element={<TemplateEditorPage />} />
        <Route path="audit" element={<AuditPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="backup" element={<BackupPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <NavGuardProvider>
          <AppRoutes />
        </NavGuardProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
