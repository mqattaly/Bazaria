import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { MeResponse, MyCompany } from '@bazaria/shared';
import { ApiError, api } from '../lib/api';

const ACTIVE_COMPANY_KEY = 'bz.activeCompanyId';

type SessionStatus = 'loading' | 'anonymous' | 'ready' | 'error';

interface SessionValue {
  status: SessionStatus;
  user: MeResponse | null;
  companies: MyCompany[];
  activeCompany: MyCompany | null;
  error: string | null;
  login: (mobile: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  selectCompany: (companyId: string) => void;
  clearActiveCompany: () => void;
  refresh: () => Promise<void>;
  refreshCompanies: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }): JSX.Element {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [user, setUser] = useState<MeResponse | null>(null);
  const [companies, setCompanies] = useState<MyCompany[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clearLocal = useCallback(() => {
    localStorage.removeItem(ACTIVE_COMPANY_KEY);
    setActiveCompanyId(null);
    setUser(null);
    setCompanies([]);
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [me, myCompanies] = await Promise.all([api.me(), api.myCompanies()]);
      setUser(me);
      setCompanies(myCompanies);
      const stored = localStorage.getItem(ACTIVE_COMPANY_KEY);
      if (stored && myCompanies.some((company) => company.id === stored)) {
        setActiveCompanyId(stored);
      } else {
        localStorage.removeItem(ACTIVE_COMPANY_KEY);
        setActiveCompanyId(null);
      }
      setStatus('ready');
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.code === 'AUTH_REQUIRED')) {
        clearLocal();
        setStatus('anonymous');
        return;
      }
      setError(err instanceof Error ? err.message : 'خطا در دریافت اطلاعات حساب.');
      setStatus('error');
    }
  }, [clearLocal]);

  useEffect(() => {
    void load();
  }, [load]);

  const login = useCallback(
    async (mobile: string, password: string) => {
      await api.login(mobile, password);
      await load();
    },
    [load],
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      clearLocal();
      setStatus('anonymous');
    }
  }, [clearLocal]);

  const selectCompany = useCallback(
    (companyId: string) => {
      if (!companies.some((company) => company.id === companyId)) return;
      localStorage.setItem(ACTIVE_COMPANY_KEY, companyId);
      setActiveCompanyId(companyId);
    },
    [companies],
  );

  const clearActiveCompany = useCallback(() => {
    localStorage.removeItem(ACTIVE_COMPANY_KEY);
    setActiveCompanyId(null);
  }, []);

  const refreshCompanies = useCallback(async () => {
    const myCompanies = await api.myCompanies();
    setCompanies(myCompanies);
    if (
      activeCompanyId &&
      !myCompanies.some((company) => company.id === activeCompanyId)
    ) {
      clearActiveCompany();
    }
  }, [activeCompanyId, clearActiveCompany]);

  const activeCompany = useMemo(
    () => companies.find((company) => company.id === activeCompanyId) ?? null,
    [companies, activeCompanyId],
  );

  const value = useMemo<SessionValue>(
    () => ({
      status,
      user,
      companies,
      activeCompany,
      error,
      login,
      logout,
      selectCompany,
      clearActiveCompany,
      refresh: load,
      refreshCompanies,
    }),
    [
      status,
      user,
      companies,
      activeCompany,
      error,
      login,
      logout,
      selectCompany,
      clearActiveCompany,
      load,
      refreshCompanies,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used inside SessionProvider');
  return context;
}
