import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';
import { useRouter } from 'next/router';

const PUBLIC = new Set(['/login']);

let meInFlight = null;

async function fetchMe() {
  if (!meInFlight) {
    meInFlight = (async () => {
      try {
        const r = await fetch('/api/auth/me');
        if (!r.ok) return { user: null };
        const d = await r.json();
        return d.authenticated && d.user ? { user: d.user } : { user: null };
      } catch {
        return { user: null };
      } finally {
        meInFlight = null;
      }
    })();
  }
  return meInFlight;
}

const Ctx = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    meInFlight = null;
    setLoading(true);
    setError(null);
    try {
      const { user: u } = await fetchMe();
      setUser(u ?? null);
    } catch (e) {
      setError(e?.message || 'Auth failed');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const value = useMemo(
    () => ({ user, loading, error, refetch }),
    [user, loading, error, refetch]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const v = useContext(Ctx);
  if (v === undefined) throw new Error('useSession: wrap app with AuthProvider');
  return v;
}

function Shell({ children }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        color: '#64748b',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '0.95rem'
      }}
    >
      {children}
    </div>
  );
}

/** One `/api/auth/me` via provider; redirect + hydration-safe first paint. */
export function AuthGate({ children }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const { user, loading } = useSession();

  useEffect(() => {
    setMounted(true);
  }, []);

  const path = router.pathname || '';
  const isPublic = PUBLIC.has(path);
  const ready = mounted && router.isReady;
  const locked = ready && !isPublic;

  useEffect(() => {
    if (!locked || loading || user) return;
    router.replace('/login');
  }, [locked, loading, user, router]);

  if (!mounted) return isPublic ? children : <Shell>Loading…</Shell>;
  if (!router.isReady && !isPublic) return <Shell>Loading…</Shell>;
  if (locked && loading) return <Shell>Checking session…</Shell>;
  if (ready && !isPublic && !loading && !user) return null;
  return children;
}

/** Single import in `_app.js`: provider + gate. */
export function AppAuth({ children }) {
  return (
    <AuthProvider>
      <AuthGate>{children}</AuthGate>
    </AuthProvider>
  );
}
