import { useState, useEffect, useCallback } from 'react';
import { getUserProfile, acceptDisclaimer as acceptInFirestore } from '../lib/firestore';

interface UseDisclaimerResult {
  accepted: boolean;
  loading: boolean;
  accept: () => Promise<void>;
}

export function useDisclaimer(uid: string | undefined): UseDisclaimerResult {
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }

    getUserProfile(uid)
      .then((profile) => {
        if (profile?.acceptedDisclaimer === true) {
          setAccepted(true);
        }
      })
      .catch((err) => {
        console.error('[useDisclaimer] fetch error:', err);
      })
      .finally(() => setLoading(false));
  }, [uid]);

  const accept = useCallback(async () => {
    if (!uid) return;
    await acceptInFirestore(uid);
    setAccepted(true);
  }, [uid]);

  return { accepted, loading, accept };
}
