'use client';

import { useEffect } from 'react';
import { useAuthStore } from '../store/auth-store';

/** Keep in-memory authentication consistent with rotation/logout in other tabs. */
export default function SessionSync() {
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === 'auth-storage' || event.key === null) {
        if (!localStorage.getItem('auth-storage')) useAuthStore.getState().logout();
        else void useAuthStore.persist.rehydrate();
      }
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  return null;
}
