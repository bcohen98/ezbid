// Rewrites stale dollar amounts inside payment_terms / warranty / disclosures text
// so they always reflect the current grand total, deposit and balance.
// Pure presentation — does not mutate stored data.

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Amounts {
  grandTotal: number;
  depositAmount: number;
  balanceDue: number;
}

/**
 * Replace dollar figures in a block of payment-terms text with live amounts.
 * Strategy: find every $X[,XXX][.XX] token and remap based on context keywords
 * in the surrounding sentence (deposit / balance / total).
 */
export function refreshPaymentTermsText(text: string | null | undefined, a: Amounts): string {
  if (!text) return text || '';
  const sentences = text.split(/(?<=[.!?])\s+/);
  return sentences
    .map((sentence) => {
      const lower = sentence.toLowerCase();
      const hasDeposit = /deposit|down\s*payment|upon\s*signing|at\s*signing/.test(lower);
      const hasBalance = /balance|remainder|upon\s*completion|on\s*completion|final\s*payment/.test(lower);
      const hasTotal = /\b(grand\s*)?total|contract\s*price|project\s*total\b/.test(lower);

      let target: number | null = null;
      if (hasDeposit && a.depositAmount > 0) target = a.depositAmount;
      else if (hasBalance) target = a.balanceDue;
      else if (hasTotal) target = a.grandTotal;

      if (target === null) return sentence;
      // Replace the FIRST currency-looking token in this sentence
      return sentence.replace(/\$\s?[\d,]+(?:\.\d{1,2})?/, fmt(target));
    })
    .join(' ');
}
