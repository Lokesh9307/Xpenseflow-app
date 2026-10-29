/**
 * Format a money value for display: Indian grouping with ALWAYS exactly
 * 2 decimal places (e.g. 1234.5 → "1,234.50", 75 → "75.00").
 * Non-numeric / missing input renders as "0.00".
 */
export const fmtMoney = (value: number | string | null | undefined): string => {
  const num = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
  const safe = Number.isFinite(num) ? num : 0;
  return safe.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};