import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { CategoriesPage } from './features/catalog/CategoriesPage';
import { ProductDetailsPage } from './features/catalog/ProductDetailsPage';
import { ProductsPage } from './features/catalog/ProductsPage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<LoginPage />} path="/login" />
      <Route element={<AppShell />} path="/">
        <Route element={<Navigate replace to="/dashboard" />} index />
        <Route element={<DashboardPage />} path="dashboard" />
        <Route element={<ProductsPage />} path="products" />
        <Route element={<ProductDetailsPage />} path="products/:id" />
        <Route element={<CategoriesPage />} path="categories" />
        <Route element={<NotFoundPage />} path="*" />
      </Route>
      <Route element={<Navigate replace to="/dashboard" />} path="/app" />
    </Routes>
  );
}
