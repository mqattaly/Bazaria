import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { CategoriesPage } from './features/catalog/CategoriesPage';
import { ProductDetailsPage } from './features/catalog/ProductDetailsPage';
import { ProductsPage } from './features/catalog/ProductsPage';
import { CustomerDetailsPage } from './features/customers/CustomerDetailsPage';
import { CustomersPage } from './features/customers/CustomersPage';
import { OrderDetailsPage } from './features/orders/OrderDetailsPage';
import { NewOrderPage } from './features/orders/NewOrderPage';
import { OrdersPage } from './features/orders/OrdersPage';
import { InventoryPage } from './features/inventory/InventoryPage';
import { InventoryDetailsPage } from './features/inventory/InventoryDetailsPage';
import { PurchaseDetailsPage } from './features/purchasing/PurchaseDetailsPage';
import { NewPurchasePage } from './features/purchasing/NewPurchasePage';
import { PurchasesPage } from './features/purchasing/PurchasesPage';
import { SupplierDetailsPage } from './features/purchasing/SupplierDetailsPage';
import { SuppliersPage } from './features/purchasing/SuppliersPage';
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
        <Route element={<CustomersPage />} path="customers" />
        <Route element={<CustomerDetailsPage />} path="customers/:id" />
        <Route element={<OrdersPage />} path="orders" />
        <Route element={<NewOrderPage />} path="orders/new" />
        <Route element={<OrderDetailsPage />} path="orders/:id" />
        <Route element={<InventoryPage />} path="inventory" />
        <Route element={<InventoryDetailsPage />} path="inventory/:productId" />
        <Route element={<SuppliersPage />} path="suppliers" />
        <Route element={<SupplierDetailsPage />} path="suppliers/:id" />
        <Route element={<PurchasesPage />} path="purchases" />
        <Route element={<NewPurchasePage />} path="purchases/new" />
        <Route element={<PurchaseDetailsPage />} path="purchases/:id" />
        <Route element={<NotFoundPage />} path="*" />
      </Route>
      <Route element={<Navigate replace to="/dashboard" />} path="/app" />
    </Routes>
  );
}
