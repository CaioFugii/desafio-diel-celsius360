import { useState } from 'react';

/**
 * Scope of the data currently on screen. With `keepPreviousData`, the data of the
 * previous scope stays visible until the new request settles, so the requested
 * scope only takes over once real data for it arrives.
 */
export function useDataScope(requested: string, isPlaceholderData: boolean): string {
  const [settled, setSettled] = useState(requested);
  if (!isPlaceholderData && settled !== requested) setSettled(requested);
  return isPlaceholderData ? settled : requested;
}
