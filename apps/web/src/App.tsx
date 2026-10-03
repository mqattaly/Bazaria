import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<LoginPage />} path="/login" />
      <Route element={<AppShell />} path="/">
        <Route element={<Navigate replace to="/dashboard" />} index />
        <Route element={<DashboardPage />} path="dashboard" />
        <Route element={<NotFoundPage />} path="*" />
      </Route>
      <Route element={<Navigate replace to="/dashboard" />} path="/app" />
    </Routes>
  );
}
