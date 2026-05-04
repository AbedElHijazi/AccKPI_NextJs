import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useSession } from '@/lib/AuthContext';

/** Same session as `useSession`, plus `isAuthenticated` (no redirect — `AuthGate` handles that). */
export function useAuth() {
  const s = useSession();
  return { ...s, isAuthenticated: !!s.user };
}

export function useAdminAuth() {
  const { user, loading, error } = useSession();
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setIsAdmin(false);
      return;
    }
    if (user.usrAdmin) setIsAdmin(true);
    else router.push('/');
  }, [user, loading, router]);

  return {
    user,
    loading,
    error,
    isAdmin: isAdmin && !!user,
    isAuthenticated: !!user
  };
}
