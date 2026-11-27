import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Render a long list in pages that grow as the user scrolls ("infinite scroll").
 *
 * The data is already in memory; this only limits how much is rendered, so a
 * phone does not paint hundreds of product cards at once. Attach `sentinelRef`
 * to an element after the list: when it comes within `rootMargin` of the
 * viewport, the next page is shown. `resetKey` (e.g. the search term) goes
 * back to the first page when it changes.
 */
export function useIncrementalList<T>(items: T[], pageSize = 30, resetKey?: unknown) {
  const [count, setCount] = useState(pageSize);
  const [lastResetKey, setLastResetKey] = useState(resetKey);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Reset during render (not in an effect) so the first page shows right away.
  if (resetKey !== lastResetKey) {
    setLastResetKey(resetKey);
    setCount(pageSize);
  }

  const hasMore = count < items.length;

  const sentinelRef = useCallback(
    (node: HTMLElement | null) => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      if (!node || !hasMore || typeof IntersectionObserver === 'undefined') return;
      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            setCount((c) => c + pageSize);
          }
        },
        { rootMargin: '400px 0px' },
      );
      observerRef.current.observe(node);
    },
    [hasMore, pageSize],
  );

  useEffect(() => () => observerRef.current?.disconnect(), []);

  return {
    visibleItems: items.slice(0, count),
    hasMore,
    sentinelRef,
    showMore: () => setCount((c) => c + pageSize),
  };
}
