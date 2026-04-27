import { useState, useEffect, useCallback, useRef } from 'react';
import { getUserProfile, acceptDisclaimer as acceptInFirestore } from '../lib/firestore';

interface UseDisclaimerResult {
  accepted: boolean;
  loading: boolean;
  accept: () => Promise<void>;
}

export function useDisclaimer(uid: string | undefined): UseDisclaimerResult {
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(true);
  // Cache which uid we've already fetched so that re-renders (from user
  // object reference churn, StrictMode double-mounts, etc.) don't re-fetch.
  const fetchedUid = useRef<string | null>(null);

  useEffect(() => {
    if (!uid) {
      fetchedUid.current = null;
      setLoading(false);
      return;
    }
    if (fetchedUid.current === uid) {
      // Already fetched for this uid — nothing to do.
      return;
    }
    fetchedUid.current = uid;
    setLoading(true);

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
