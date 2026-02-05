import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export function useAuth(redirectTo = '/login') {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const router = useRouter();

  useEffect(() => {
    async function checkAuth() {
      try {
        const response = await fetch('/api/auth/me');
        
        if (!response.ok) {
          if (redirectTo) {
            router.push(redirectTo);
          }
          setLoading(false);
          return;
        }

        const data = await response.json();
        if (data.authenticated && data.user) {
          setUser(data.user);
        } else if (redirectTo) {
          router.push(redirectTo);
        }
      } catch (err) {
        console.error('Auth check error:', err);
        setError(err.message);
        if (redirectTo) {
          router.push(redirectTo);
        }
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, [router, redirectTo]);

  return { user, loading, error, isAuthenticated: !!user };
}

export function useAdminAuth() {
  const { user, loading, error, isAuthenticated } = useAuth('/login');
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      if (user.usrAdmin) {
        setIsAdmin(true);
      } else {
        router.push('/');
      }
    }
  }, [user, loading, router]);

  return { user, loading, error, isAdmin: isAdmin && isAuthenticated };
}
