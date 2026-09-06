/**
 * Shared utility for formatting monetary amounts consistently across the entire application.
 * Always formats to en-US standard with exactly two decimal places and commas.
 */
export function formatCurrency(amount: number | string | null | undefined): string {
  const num = typeof amount === 'number' ? amount : Number(amount || 0);
  return (isNaN(num) ? 0 : num).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
