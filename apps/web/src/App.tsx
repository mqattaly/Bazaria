import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { SessionProvider, useSession } from './session/SessionContext';
import { Layout } from './components/Layout';
import { Alert, Button, Spinner } from './components/ui';
import { LoginPage } from './pages/LoginPage';
import { SetPasswordPage } from './pages/SetPasswordPage';
import { CompaniesPage } from './pages/CompaniesPage';
import { CompanyPage } from './pages/CompanyPage';
import { StoresPage } from './pages/StoresPage';
import { StoreCreatePage } from './pages/StoreCreatePage';
import { StoreDetailPage } from './pages/StoreDetailPage';
import { AccountPage } from './pages/AccountPage';
import { NoAccessPage } from './pages/NoAccessPage';
import { NotFoundPage } from './pages/NotFoundPage';

function SessionGate({ children }: { children: ReactNode }): JSX.Element {
  const { status, error, refresh } = useSession();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <Layout>
        <Spinner />
      </Layout>
    );
  }

  if (status === 'error') {
    return (
      <Layout>
        <Alert title="دریافت اطلاعات حساب ناموفق بود">
          <p>{error}</p>
          <Button className="mt-3" variant="secondary" onClick={() => void refresh()}>
            تلاش دوباره
          </Button>
        </Alert>
      </Layout>
    );
  }

  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}

function CompanyGate({ children }: { children: ReactNode }): JSX.Element {
  const { activeCompany } = useSession();
  if (!activeCompany) return <Navigate to="/companies" replace />;
  return <>{children}</>;
}

function AppRoutes(): JSX.Element {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/set-password" element={<SetPasswordPage />} />
      <Route
        path="/companies"
        element={
          <SessionGate>
            <CompaniesPage />
          </SessionGate>
        }
      />
      <Route
        path="/company"
        element={
          <SessionGate>
            <CompanyGate>
              <CompanyPage />
            </CompanyGate>
          </SessionGate>
        }
      />
      <Route
        path="/stores"
        element={
          <SessionGate>
            <CompanyGate>
              <StoresPage />
            </CompanyGate>
          </SessionGate>
        }
      />
      <Route
        path="/stores/new"
        element={
          <SessionGate>
            <CompanyGate>
              <StoreCreatePage />
            </CompanyGate>
          </SessionGate>
        }
      />
      <Route
        path="/stores/:storeId"
        element={
          <SessionGate>
            <CompanyGate>
              <StoreDetailPage />
            </CompanyGate>
          </SessionGate>
        }
      />
      <Route
        path="/account"
        element={
          <SessionGate>
            <AccountPage />
          </SessionGate>
        }
      />
      <Route
        path="/no-access"
        element={
          <SessionGate>
            <NoAccessPage />
          </SessionGate>
        }
      />
      <Route path="/" element={<Navigate to="/companies" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export function App(): JSX.Element {
  return (
    <BrowserRouter>
      <SessionProvider>
        <AppRoutes />
      </SessionProvider>
    </BrowserRouter>
  );
}
