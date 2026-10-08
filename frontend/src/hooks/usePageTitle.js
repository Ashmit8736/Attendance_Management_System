import { useEffect } from 'react';

/**
 * Sets the browser tab title (also what screen readers announce on navigation).
 */
export const usePageTitle = (title) => {
  useEffect(() => {
    document.title = title ? `${title} | AttendTrack` : 'AttendTrack';
  }, [title]);
};
