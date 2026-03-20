/**
 * @file utils/formatDateString.ts
 * @description Formats an ISO-8601 date string into a compact human-readable label.
 *
 * - Same year as today → "12 May"
 * - Different year     → "15 Oct 2022"
 */
export const formatDateString = (isoString: string): string => {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return isoString;
  const now = new Date();
  const day = date.getDate();
  const month = date.toLocaleString('default', { month: 'short' });
  const year = date.getFullYear();
  return date.getFullYear() === now.getFullYear()
    ? `${day} ${month}`
    : `${day} ${month} ${year}`;
};
