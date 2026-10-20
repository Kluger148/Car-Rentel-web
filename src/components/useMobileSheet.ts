import { useEffect, type RefObject } from 'react';

/** The phone breakpoint in styles.css, where the deals page's panels become bottom sheets. */
export const PHONE_QUERY = '(max-width: 760px)';

/**
 * While a panel is open as a bottom sheet on a phone: focus moves into it, Escape closes it and
 * the page behind it does not scroll. On wider screens the same panel sits in the page, so
 * nothing is locked.
 */
export function useMobileSheet(open: boolean, onClose: () => void, focusRef?: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open || !window.matchMedia(PHONE_QUERY).matches) return;
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = 'hidden';
    focusRef?.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      root.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, focusRef]);
}
