export function formatCurrency(amount: number | null | undefined): string {
  const num = Number(amount || 0);
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
