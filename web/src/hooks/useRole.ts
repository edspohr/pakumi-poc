import { useState, useEffect } from 'react';
import { getUserProfile } from '../lib/firestore';
import type { UserRole } from '../types';

interface UseRoleResult {
  role: UserRole | null;
  loading: boolean;
  isOwner: boolean;
  isPartner: boolean;
  isAdmin: boolean;
  isSuperadmin: boolean;
}

export function useRole(uid: string | undefined): UseRoleResult {
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setRole(null);
      setLoading(false);
      return;
    }

    getUserProfile(uid)
      .then((profile) => {
        setRole(profile?.role ?? null);
      })
      .catch((err) => {
        console.error('[useRole] fetch error:', err);
        setRole(null);
      })
      .finally(() => setLoading(false));
  }, [uid]);

  return {
    role,
    loading,
    isOwner: role === 'owner',
    isPartner: role === 'partner',
    isAdmin: role === 'admin',
    isSuperadmin: role === 'superadmin',
  };
}
