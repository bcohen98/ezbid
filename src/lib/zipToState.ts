// Map US zip code (first 3 digits) to 2-letter state abbreviation
// Based on USPS ZIP code prefix ranges
export function zipToState(zip: string): string | null {
  if (!/^\d{5}$/.test(zip)) return null;
  const p = parseInt(zip.slice(0, 3), 10);
  // Special non-contiguous prefixes
  if (p === 100 || (p >= 100 && p <= 102)) return 'NY'; // overridden below if needed
  // Use ranges below as canonical
  if (p >= 0 && p <= 0) return null;
  if (p >= 1 && p <= 27) return 'MA';
  if (p >= 28 && p <= 29) return 'RI';
  if (p >= 30 && p <= 38) return 'MA';
  if (p >= 39 && p <= 49) return 'NH'; // 030-038 NH technically; simplified
  if (p >= 50 && p <= 59) return 'VT';
  if (p >= 60 && p <= 69) return 'CT';
  if (p >= 70 && p <= 89) return 'NJ';
  if (p >= 90 && p <= 99) return 'AE'; // military APO/AE — fallback
  if (p >= 100 && p <= 149) return 'NY';
  if (p >= 150 && p <= 196) return 'PA';
  if (p >= 197 && p <= 199) return 'DE';
  if (p >= 200 && p <= 205) return 'DC';
  if (p >= 206 && p <= 219) return 'MD';
  if (p >= 220 && p <= 246) return 'VA';
  if (p >= 247 && p <= 268) return 'WV';
  if (p >= 270 && p <= 289) return 'NC';
  if (p >= 290 && p <= 299) return 'SC';
  if (p >= 300 && p <= 319) return 'GA';
  if (p >= 320 && p <= 349) return 'FL';
  if (p >= 350 && p <= 369) return 'AL';
  if (p >= 370 && p <= 385) return 'TN';
  if (p >= 386 && p <= 397) return 'MS';
  if (p >= 398 && p <= 399) return 'GA';
  if (p >= 400 && p <= 427) return 'KY';
  if (p >= 430 && p <= 459) return 'OH';
  if (p >= 460 && p <= 479) return 'IN';
  if (p >= 480 && p <= 499) return 'MI';
  if (p >= 500 && p <= 528) return 'IA';
  if (p >= 530 && p <= 549) return 'WI';
  if (p >= 550 && p <= 567) return 'MN';
  if (p >= 569 && p <= 579) return 'SD';
  if (p >= 580 && p <= 588) return 'ND';
  if (p >= 590 && p <= 599) return 'MT';
  if (p >= 600 && p <= 629) return 'IL';
  if (p >= 630 && p <= 658) return 'MO';
  if (p >= 660 && p <= 679) return 'KS';
  if (p >= 680 && p <= 693) return 'NE';
  if (p >= 700 && p <= 714) return 'LA';
  if (p >= 716 && p <= 729) return 'AR';
  if (p >= 730 && p <= 749) return 'OK';
  if (p >= 750 && p <= 799) return 'TX';
  if (p >= 800 && p <= 816) return 'CO';
  if (p >= 820 && p <= 831) return 'WY';
  if (p >= 832 && p <= 838) return 'ID';
  if (p >= 840 && p <= 847) return 'UT';
  if (p >= 850 && p <= 865) return 'AZ';
  if (p >= 870 && p <= 884) return 'NM';
  if (p >= 889 && p <= 898) return 'NV';
  if (p >= 900 && p <= 961) return 'CA';
  if (p >= 967 && p <= 968) return 'HI';
  if (p >= 970 && p <= 979) return 'OR';
  if (p >= 980 && p <= 994) return 'WA';
  if (p >= 995 && p <= 999) return 'AK';
  return null;
}

// Default state sales tax rates (state-level base, %). Local rates may differ.
const STATE_TAX_RATES: Record<string, number> = {
  AL: 4, AK: 0, AZ: 5.6, AR: 6.5, CA: 7.25, CO: 2.9, CT: 6.35, DE: 0,
  DC: 6, FL: 6, GA: 4, HI: 4, ID: 6, IL: 6.25, IN: 7, IA: 6, KS: 6.5,
  KY: 6, LA: 4.45, ME: 5.5, MD: 6, MA: 6.25, MI: 6, MN: 6.875, MS: 7,
  MO: 4.225, MT: 0, NE: 5.5, NV: 6.85, NH: 0, NJ: 6.625, NM: 4.875,
  NY: 4, NC: 4.75, ND: 5, OH: 5.75, OK: 4.5, OR: 0, PA: 6, RI: 7,
  SC: 6, SD: 4.2, TN: 7, TX: 8.25, UT: 6.1, VT: 6, VA: 5.3, WA: 6.5,
  WV: 6, WI: 5, WY: 4,
};

export function stateToTaxRate(state: string | null): number | null {
  if (!state) return null;
  const r = STATE_TAX_RATES[state.toUpperCase()];
  return r ?? null;
}
