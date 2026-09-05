import { useEffect } from 'react';

let lockCount = 0;
let previousOverflow = '';

/**
 * Locks background scrolling when a modal or overlay is open.
 * Uses a reference counter so nested or multiple active modals do not
 * prematurely restore scrolling until all modals are closed.
 */
export function useLockBodyScroll(lock: boolean = true) {
  useEffect(() => {
    if (!lock || typeof document === 'undefined') return;

    if (lockCount === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    lockCount++;

    return () => {
      lockCount--;
      if (lockCount <= 0) {
        lockCount = 0;
        document.body.style.overflow = previousOverflow || '';
      }
    };
  }, [lock]);
}
