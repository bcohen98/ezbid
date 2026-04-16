import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function randBetween(min: number, max: number) { return Math.random() * (max - min) + min; }
function randInt(min: number, max: number) { return Math.floor(randBetween(min, max + 1)); }
function pickRandom<T>(arr: T[]): T { return arr[randInt(0, arr.length - 1)]; }
function jitter(value: number, pct: number) { return value * (1 + (Math.random() * 2 - 1) * pct); }

const CLIENT_NAMES = ["James Martinez","Sarah Johnson","Michael Thompson","Lisa Anderson","Robert Garcia","Jennifer Wilson","David Lee","Amanda White","Christopher Brown","Michelle Davis","Daniel Rodriguez","Ashley Miller","Matthew Taylor","Jessica Moore","Andrew Jackson","Stephanie Harris","Ryan Clark","Nicole Lewis","Kevin Robinson","Amanda Walker","Brian Hall","Samantha Allen","Justin Young","Megan Hernandez","Brandon King","Rachel Wright","Tyler Scott","Lauren Green","Aaron Baker","Brittany Adams","Patrick Nelson","Heather Carter","Sean Mitchell","Amber Perez","Justin Roberts","Melissa Turner","Eric Phillips","Courtney Campbell","Derek Parker","Vanessa Evans"];

const ADDRESSES = ["2847 Coral Way, Miami FL 33145","1203 Brickell Ave, Miami FL 33131","4521 SW 8th St, Miami FL 33134","891 NW 7th Ave, Miami FL 33136","3301 NE 1st Ave, Miami FL 33137","1847 Alton Rd, Miami Beach FL 33139","5521 Collins Ave, Miami Beach FL 33140","2201 Pine Tree Dr, Miami Beach FL 33140","901 Venetian Dr, Miami FL 33139","4401 N Federal Hwy, Fort Lauderdale FL 33308","2891 SE 17th St, Fort Lauderdale FL 33316","1122 Las Olas Blvd, Fort Lauderdale FL 33301","7801 Stirling Rd, Hollywood FL 33024","3341 W Broward Blvd, Fort Lauderdale FL 33312","9901 Pines Blvd, Pembroke Pines FL 33024","1445 Palm Beach Lakes Blvd, West Palm Beach FL 33401","3221 S Dixie Hwy, West Palm Beach FL 33405","8821 Okeechobee Blvd, West Palm Beach FL 33411","2201 N Congress Ave, Boynton Beach FL 33426","4401 Military Trail, Jupiter FL 33458","1891 San Marco Blvd, Jacksonville FL 32207","3301 Beach Blvd, Jacksonville FL 32207","7721 Philips Hwy, Jacksonville FL 32256","2201 Gulf to Bay Blvd, Clearwater FL 33765","4521 4th St N, St Petersburg FL 33703","1201 N Dale Mabry Hwy, Tampa FL 33607","3891 Henderson Blvd, Tampa FL 33629","8801 N Florida Ave, Tampa FL 33604","2891 E Hillsborough Ave, Tampa FL 33610","1445 International Pkwy, Lake Mary FL 32746","3221 S Orange Ave, Orlando FL 32806","7801 W Colonial Dr, Orlando FL 32818","2201 E Colonial Dr, Orlando FL 32803","4401 Curry Ford Rd, Orlando FL 32806","9901 University Blvd, Orlando FL 32817","1847 S Congress Ave, Austin TX 78704","3301 N Lamar Blvd, Austin TX 78705","2201 Barton Springs Rd, Austin TX 78704","8821 Research Blvd, Austin TX 78758","4401 S 1st St, Austin TX 78745"];

const TRADE_LABELS: Record<string, string> = {
  flooring: "Flooring", landscaping: "Landscaping", roofing: "Roofing",
  hvac: "HVAC", plumbing: "Plumbing", painting: "Painting",
  general_contractor: "General Contractor",
};

function spreadDate(monthsBack: number): Date {
  const now = new Date();
  const busyMonths = [2, 3, 4, 8, 9]; // Mar, Apr, May, Sep, Oct (0-indexed)
  let d: Date;
  // Try up to 20 times with weighting
  for (let i = 0; i < 20; i++) {
    const daysBack = randInt(1, monthsBack * 30);
    d = new Date(now.getTime() - daysBack * 86400000);
    const m = d.getMonth();
    if (busyMonths.includes(m) || Math.random() < 0.71) return d;
  }
  const daysBack = randInt(1, monthsBack * 30);
  return new Date(now.getTime() - daysBack * 86400000);
}

function weightedStatus(weights: Record<string, number>): string {
  const r = Math.random();
  let cum = 0;
  for (const [status, pct] of Object.entries(weights)) {
    cum += pct / 100;
    if (r <= cum) return status;
  }
  return Object.keys(weights)[0];
}

function parseAddress(addr: string) {
  const parts = addr.split(",");
  const street = parts[0]?.trim() || addr;
  const rest = parts[1]?.trim() || "";
  const m = rest.match(/^(.+?)\s+([A-Z]{2})\s+(\d{5})$/);
  return { street, city: m?.[1] || "", state: m?.[2] || "", zip: m?.[3] || "" };
}

interface LineItem {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  subtotal: number;
  sort_order: number;
}

function generateFlooring(): { items: LineItem[]; tax_rate: number; deposit_value: number; deposit_mode: string; payment_terms: string; warranty_terms: string; statusWeights: Record<string, number> } {
  const sqft = randInt(400, 2200);
  const items: LineItem[] = [];
  let sort = 0;
  const skipPrep = Math.random() < 0.10;

  const i1price = jitter(4.50, 0.12);
  items.push({ description: "LVP Flooring Installation Labor", quantity: sqft, unit: "sqft", unit_price: Math.round(i1price * 100) / 100, subtotal: Math.round(sqft * i1price * 100) / 100, sort_order: sort++ });
  const matQty = Math.round(sqft * 1.08);
  const i2price = jitter(3.20, 0.15);
  items.push({ description: "LVP Flooring Material (12mil wear layer)", quantity: matQty, unit: "sqft", unit_price: Math.round(i2price * 100) / 100, subtotal: Math.round(matQty * i2price * 100) / 100, sort_order: sort++ });
  const i3price = jitter(0.45, 0.10);
  items.push({ description: "Underlayment", quantity: sqft, unit: "sqft", unit_price: Math.round(i3price * 100) / 100, subtotal: Math.round(sqft * i3price * 100) / 100, sort_order: sort++ });
  if (!skipPrep) {
    const q4 = randInt(1, 3); const p4 = jitter(285, 0.20);
    items.push({ description: "Subfloor Prep and Leveling", quantity: q4, unit: "lot", unit_price: Math.round(p4 * 100) / 100, subtotal: Math.round(q4 * p4 * 100) / 100, sort_order: sort++ });
  }
  const q5 = randInt(3, 12); const p5 = jitter(45, 0.15);
  items.push({ description: "Transitions, Trim and T-Molding", quantity: q5, unit: "ea", unit_price: Math.round(p5 * 100) / 100, subtotal: Math.round(q5 * p5 * 100) / 100, sort_order: sort++ });

  if (Math.random() < 0.40) { const p = jitter(150, 0.20); items.push({ description: "Furniture Moving and Protection", quantity: 1, unit: "lot", unit_price: Math.round(p * 100) / 100, subtotal: Math.round(p * 100) / 100, sort_order: sort++ }); }
  if (Math.random() < 0.40) { const q = randInt(80, 300); const p = jitter(2.80, 0.15); items.push({ description: "Baseboard Removal and Reinstall", quantity: q, unit: "lnft", unit_price: Math.round(p * 100) / 100, subtotal: Math.round(q * p * 100) / 100, sort_order: sort++ }); }
  if (Math.random() < 0.40) { const q = randInt(4, 16); const p = jitter(65, 0.15); items.push({ description: "Stair Nosing Installation", quantity: q, unit: "ea", unit_price: Math.round(p * 100) / 100, subtotal: Math.round(q * p * 100) / 100, sort_order: sort++ }); }
  if (Math.random() < 0.40) { const p = jitter(175, 0.25); items.push({ description: "Debris Haul-Away", quantity: 1, unit: "lot", unit_price: Math.round(p * 100) / 100, subtotal: Math.round(p * 100) / 100, sort_order: sort++ }); }
  if (Math.random() < 0.15) { const disc = -randBetween(150, 400); items.push({ description: "Repeat Customer Discount", quantity: 1, unit: "lot", unit_price: Math.round(disc * 100) / 100, subtotal: Math.round(disc * 100) / 100, sort_order: sort++ }); }

  return { items, tax_rate: 0, deposit_value: 50, deposit_mode: "percentage", payment_terms: "50% deposit due upon signing. Balance due upon completion of work.", warranty_terms: "1-year labor warranty on all flooring installation. Material warranty per manufacturer.", statusWeights: { signed: 40, sent: 20, draft: 15, closed: 15, expired: 10 } };
}

function generateLandscaping(): { items: LineItem[]; tax_rate: number; deposit_value: number; deposit_mode: string; payment_terms: string; warranty_terms: string; statusWeights: Record<string, number> } {
  const items: LineItem[] = []; let sort = 0;
  const q1 = randInt(8, 40); const p1 = jitter(55, 0.15);
  items.push({ description: "Landscape Labor", quantity: q1, unit: "hr", unit_price: Math.round(p1 * 100) / 100, subtotal: Math.round(q1 * p1 * 100) / 100, sort_order: sort++ });
  const q2 = randInt(1, 4); const p2 = jitter(225, 0.20);
  items.push({ description: "Debris Removal and Haul-Away", quantity: q2, unit: "lot", unit_price: Math.round(p2 * 100) / 100, subtotal: Math.round(q2 * p2 * 100) / 100, sort_order: sort++ });
  const q3 = randInt(1, 3); const p3 = jitter(185, 0.20);
  items.push({ description: "Edging and Bed Cleanup", quantity: q3, unit: "lot", unit_price: Math.round(p3 * 100) / 100, subtotal: Math.round(q3 * p3 * 100) / 100, sort_order: sort++ });
  if (Math.random() < 0.40) { const q = randInt(3, 15); const p = jitter(95, 0.15); items.push({ description: "Mulch Installation", quantity: q, unit: "yd", unit_price: Math.round(p * 100) / 100, subtotal: Math.round(q * p * 100) / 100, sort_order: sort++ }); }
  if (Math.random() < 0.40) { const q = randInt(200, 1500); const p = jitter(1.85, 0.12); items.push({ description: "Sod Installation", quantity: q, unit: "sqft", unit_price: Math.round(p * 100) / 100, subtotal: Math.round(q * p * 100) / 100, sort_order: sort++ }); }
  if (Math.random() < 0.40) { const p = jitter(285, 0.20); items.push({ description: "Irrigation System Check and Adjust", quantity: 1, unit: "lot", unit_price: Math.round(p * 100) / 100, subtotal: Math.round(p * 100) / 100, sort_order: sort++ }); }
  if (Math.random() < 0.40) { const q = randInt(2, 8); const p = jitter(145, 0.20); items.push({ description: "Tree Trimming", quantity: q, unit: "ea", unit_price: Math.round(p * 100) / 100, subtotal: Math.round(q * p * 100) / 100, sort_order: sort++ }); }
  if (Math.random() < 0.40) { const p = jitter(165, 0.15); items.push({ description: "Fertilization Treatment", quantity: 1, unit: "lot", unit_price: Math.round(p * 100) / 100, subtotal: Math.round(p * 100) / 100, sort_order: sort++ }); }
  return { items, tax_rate: 7, deposit_value: 30, deposit_mode: "percentage", payment_terms: "30% deposit due upon signing. Balance due upon completion.", warranty_terms: "30-day satisfaction guarantee on all planting and installation work.", statusWeights: { signed: 50, sent: 20, draft: 15, closed: 15 } };
}

function generateRoofing(): { items: LineItem[]; tax_rate: number; deposit_value: number; deposit_mode: string; payment_terms: string; warranty_terms: string; statusWeights: Record<string, number> } {
  const items: LineItem[] = []; let sort = 0;
  const squares = randInt(12, 45);
  const p1 = jitter(85, 0.15); items.push({ description: "Shingle Tear-Off and Disposal", quantity: squares, unit: "square", unit_price: Math.round(p1 * 100) / 100, subtotal: Math.round(squares * p1 * 100) / 100, sort_order: sort++ });
  const p2 = jitter(22, 0.10); items.push({ description: "30lb Felt Underlayment", quantity: squares, unit: "square", unit_price: Math.round(p2 * 100) / 100, subtotal: Math.round(squares * p2 * 100) / 100, sort_order: sort++ });
  const p3 = jitter(310, 0.12); items.push({ description: "Architectural Shingle Installation", quantity: squares, unit: "square", unit_price: Math.round(p3 * 100) / 100, subtotal: Math.round(squares * p3 * 100) / 100, sort_order: sort++ });
  const q4 = randInt(120, 380); const p4 = jitter(3.20, 0.15); items.push({ description: "Drip Edge Installation", quantity: q4, unit: "lnft", unit_price: Math.round(p4 * 100) / 100, subtotal: Math.round(q4 * p4 * 100) / 100, sort_order: sort++ });
  const q5 = randInt(20, 65); const p5 = jitter(8.50, 0.15); items.push({ description: "Ridge Cap Installation", quantity: q5, unit: "lnft", unit_price: Math.round(p5 * 100) / 100, subtotal: Math.round(q5 * p5 * 100) / 100, sort_order: sort++ });
  const p6 = jitter(450, 0.20); items.push({ description: "Dumpster and Disposal Fee", quantity: 1, unit: "lot", unit_price: Math.round(p6 * 100) / 100, subtotal: Math.round(p6 * 100) / 100, sort_order: sort++ });
  if (Math.random() < 0.35) { const q = randInt(2, 12); const p = jitter(95, 0.20); items.push({ description: "Decking Repair (per sheet)", quantity: q, unit: "ea", unit_price: Math.round(p * 100) / 100, subtotal: Math.round(q * p * 100) / 100, sort_order: sort++ }); }
  if (Math.random() < 0.35) { const p = jitter(485, 0.20); items.push({ description: "Chimney Flashing Replacement", quantity: 1, unit: "lot", unit_price: Math.round(p * 100) / 100, subtotal: Math.round(p * 100) / 100, sort_order: sort++ }); }
  if (Math.random() < 0.35) { const q = randInt(1, 3); const p = jitter(225, 0.20); items.push({ description: "Skylight Flashing", quantity: q, unit: "ea", unit_price: Math.round(p * 100) / 100, subtotal: Math.round(q * p * 100) / 100, sort_order: sort++ }); }
  if (Math.random() < 0.35) { const q = randInt(2, 6); const p = jitter(85, 0.15); items.push({ description: "Pipe Boot Replacement", quantity: q, unit: "ea", unit_price: Math.round(p * 100) / 100, subtotal: Math.round(q * p * 100) / 100, sort_order: sort++ }); }
  return { items, tax_rate: 0, deposit_value: 40, deposit_mode: "percentage", payment_terms: "40% deposit due upon signing. Balance due upon final inspection and completion.", warranty_terms: "10-year labor warranty. 30-year manufacturer warranty on architectural shingles.", statusWeights: { signed: 45, sent: 25, draft: 15, closed: 15 } };
}

function generateHvac(): { items: LineItem[]; tax_rate: number; deposit_value: number; deposit_mode: string; payment_terms: string; warranty_terms: string; statusWeights: Record<string, number> } {
  const items: LineItem[] = []; let sort = 0;
  const isInstall = Math.random() < 0.70;
  if (isInstall) {
    const tons = randInt(2, 5); const p1 = jitter(randBetween(1800, 3200), 0.10);
    items.push({ description: `HVAC System — ${tons} Ton Unit`, quantity: 1, unit: "ea", unit_price: Math.round(p1 * 100) / 100, subtotal: Math.round(p1 * 100) / 100, sort_order: sort++ });
    const q2 = randInt(8, 16); const p2 = jitter(95, 0.12); items.push({ description: "Installation Labor", quantity: q2, unit: "hr", unit_price: Math.round(p2 * 100) / 100, subtotal: Math.round(q2 * p2 * 100) / 100, sort_order: sort++ });
    const q3 = randInt(4, 12); const p3 = jitter(45, 0.15); items.push({ description: "Refrigerant (R-410A)", quantity: q3, unit: "lb", unit_price: Math.round(p3 * 100) / 100, subtotal: Math.round(q3 * p3 * 100) / 100, sort_order: sort++ });
    const p4 = jitter(285, 0.15); items.push({ description: "Startup and Commissioning", quantity: 1, unit: "lot", unit_price: Math.round(p4 * 100) / 100, subtotal: Math.round(p4 * 100) / 100, sort_order: sort++ });
    if (Math.random() < 0.35) { const q = randInt(2, 8); const p = jitter(185, 0.20); items.push({ description: "Ductwork Modification", quantity: q, unit: "ea", unit_price: Math.round(p * 100) / 100, subtotal: Math.round(q * p * 100) / 100, sort_order: sort++ }); }
    if (Math.random() < 0.35) { const p = jitter(325, 0.20); items.push({ description: "Permit and Inspection", quantity: 1, unit: "lot", unit_price: Math.round(p * 100) / 100, subtotal: Math.round(p * 100) / 100, sort_order: sort++ }); }
    if (Math.random() < 0.35) { const p = jitter(285, 0.15); items.push({ description: "Smart Thermostat Supply and Install", quantity: 1, unit: "ea", unit_price: Math.round(p * 100) / 100, subtotal: Math.round(p * 100) / 100, sort_order: sort++ }); }
  } else {
    const p1 = jitter(185, 0.20); items.push({ description: "Diagnostic and Service Call", quantity: 1, unit: "lot", unit_price: Math.round(p1 * 100) / 100, subtotal: Math.round(p1 * 100) / 100, sort_order: sort++ });
    const p2 = jitter(randBetween(85, 450), 0.25); items.push({ description: "Parts and Materials", quantity: 1, unit: "lot", unit_price: Math.round(p2 * 100) / 100, subtotal: Math.round(p2 * 100) / 100, sort_order: sort++ });
    const q3 = randInt(1, 4); const p3 = jitter(95, 0.15); items.push({ description: "Labor", quantity: q3, unit: "hr", unit_price: Math.round(p3 * 100) / 100, subtotal: Math.round(q3 * p3 * 100) / 100, sort_order: sort++ });
  }
  return { items, tax_rate: 0, deposit_value: isInstall ? 50 : 0, deposit_mode: "percentage", payment_terms: isInstall ? "50% deposit due upon signing. Balance due upon system startup." : "Payment due upon completion of service.", warranty_terms: "1-year labor warranty. Manufacturer warranty on all equipment.", statusWeights: { signed: 40, sent: 20, draft: 20, closed: 20 } };
}

function generatePlumbing(): { items: LineItem[]; tax_rate: number; deposit_value: number; deposit_mode: string; payment_terms: string; warranty_terms: string; statusWeights: Record<string, number> } {
  const items: LineItem[] = []; let sort = 0;
  const isService = Math.random() < 0.60;
  if (isService) {
    const p1 = jitter(165, 0.20); items.push({ description: "Service Call and Diagnosis", quantity: 1, unit: "lot", unit_price: Math.round(p1 * 100) / 100, subtotal: Math.round(p1 * 100) / 100, sort_order: sort++ });
    const q2 = randInt(1, 4); const p2 = jitter(115, 0.15); items.push({ description: "Labor", quantity: q2, unit: "hr", unit_price: Math.round(p2 * 100) / 100, subtotal: Math.round(q2 * p2 * 100) / 100, sort_order: sort++ });
    const p3 = jitter(randBetween(45, 385), 0.25); items.push({ description: "Parts and Materials", quantity: 1, unit: "lot", unit_price: Math.round(p3 * 100) / 100, subtotal: Math.round(p3 * 100) / 100, sort_order: sort++ });
  } else {
    const q1 = randInt(8, 24); const p1 = jitter(115, 0.12); items.push({ description: "Rough-In Labor", quantity: q1, unit: "hr", unit_price: Math.round(p1 * 100) / 100, subtotal: Math.round(q1 * p1 * 100) / 100, sort_order: sort++ });
    const p2 = jitter(randBetween(400, 1800), 0.20); items.push({ description: "Fixtures and Materials", quantity: 1, unit: "lot", unit_price: Math.round(p2 * 100) / 100, subtotal: Math.round(p2 * 100) / 100, sort_order: sort++ });
    const p3 = jitter(185, 0.15); items.push({ description: "Pressure Test", quantity: 1, unit: "lot", unit_price: Math.round(p3 * 100) / 100, subtotal: Math.round(p3 * 100) / 100, sort_order: sort++ });
    if (Math.random() < 0.30) { const p = jitter(285, 0.20); items.push({ description: "Permit", quantity: 1, unit: "lot", unit_price: Math.round(p * 100) / 100, subtotal: Math.round(p * 100) / 100, sort_order: sort++ }); }
    if (Math.random() < 0.30) { const q = randInt(1, 4); const p = jitter(145, 0.20); items.push({ description: "Drywall Patch", quantity: q, unit: "ea", unit_price: Math.round(p * 100) / 100, subtotal: Math.round(q * p * 100) / 100, sort_order: sort++ }); }
  }
  return { items, tax_rate: 0, deposit_value: 25, deposit_mode: "percentage", payment_terms: "25% deposit due upon signing. Balance due upon completion.", warranty_terms: "1-year warranty on all labor. Manufacturer warranty on fixtures and parts.", statusWeights: { signed: 55, sent: 20, draft: 15, closed: 10 } };
}

function generatePainting(): { items: LineItem[]; tax_rate: number; deposit_value: number; deposit_mode: string; payment_terms: string; warranty_terms: string; statusWeights: Record<string, number> } {
  const items: LineItem[] = []; let sort = 0;
  const isInterior = Math.random() < 0.60;
  if (isInterior) {
    const sqft = randInt(800, 3500);
    const p1 = jitter(2.20, 0.15); items.push({ description: "Interior Painting Labor", quantity: sqft, unit: "sqft", unit_price: Math.round(p1 * 100) / 100, subtotal: Math.round(sqft * p1 * 100) / 100, sort_order: sort++ });
    const p2 = jitter(0.45, 0.10); items.push({ description: "Primer — 1 Coat", quantity: sqft, unit: "sqft", unit_price: Math.round(p2 * 100) / 100, subtotal: Math.round(sqft * p2 * 100) / 100, sort_order: sort++ });
    const p3 = jitter(randBetween(280, 850), 0.20); items.push({ description: "Paint — 2 Coats Finish", quantity: 1, unit: "lot", unit_price: Math.round(p3 * 100) / 100, subtotal: Math.round(p3 * 100) / 100, sort_order: sort++ });
    const p4 = jitter(285, 0.20); items.push({ description: "Prep, Masking and Protection", quantity: 1, unit: "lot", unit_price: Math.round(p4 * 100) / 100, subtotal: Math.round(p4 * 100) / 100, sort_order: sort++ });
    const p5 = jitter(145, 0.20); items.push({ description: "Cleanup and Debris Removal", quantity: 1, unit: "lot", unit_price: Math.round(p5 * 100) / 100, subtotal: Math.round(p5 * 100) / 100, sort_order: sort++ });
    if (Math.random() < 0.35) { const q = randInt(400, 1800); const p = jitter(1.20, 0.15); items.push({ description: "Ceiling Painting", quantity: q, unit: "sqft", unit_price: Math.round(p * 100) / 100, subtotal: Math.round(q * p * 100) / 100, sort_order: sort++ }); }
    if (Math.random() < 0.35) { const q = randInt(8, 24); const p = jitter(85, 0.20); items.push({ description: "Trim and Door Painting", quantity: q, unit: "ea", unit_price: Math.round(p * 100) / 100, subtotal: Math.round(q * p * 100) / 100, sort_order: sort++ }); }
  } else {
    const sqft = randInt(1200, 4500);
    const p1 = jitter(2.85, 0.15); items.push({ description: "Exterior Painting Labor", quantity: sqft, unit: "sqft", unit_price: Math.round(p1 * 100) / 100, subtotal: Math.round(sqft * p1 * 100) / 100, sort_order: sort++ });
    const p2 = jitter(0.55, 0.10); items.push({ description: "Primer and Sealer", quantity: sqft, unit: "sqft", unit_price: Math.round(p2 * 100) / 100, subtotal: Math.round(sqft * p2 * 100) / 100, sort_order: sort++ });
    const p3 = jitter(randBetween(380, 1100), 0.20); items.push({ description: "Exterior Paint — 2 Coats", quantity: 1, unit: "lot", unit_price: Math.round(p3 * 100) / 100, subtotal: Math.round(p3 * 100) / 100, sort_order: sort++ });
    const p4 = jitter(385, 0.20); items.push({ description: "Pressure Washing and Prep", quantity: 1, unit: "lot", unit_price: Math.round(p4 * 100) / 100, subtotal: Math.round(p4 * 100) / 100, sort_order: sort++ });
    const p5 = jitter(225, 0.20); items.push({ description: "Caulking and Surface Repair", quantity: 1, unit: "lot", unit_price: Math.round(p5 * 100) / 100, subtotal: Math.round(p5 * 100) / 100, sort_order: sort++ });
  }
  return { items, tax_rate: 7, deposit_value: 33, deposit_mode: "percentage", payment_terms: "33% deposit due upon signing. Balance due upon completion.", warranty_terms: "2-year warranty on labor and workmanship.", statusWeights: { signed: 45, sent: 25, draft: 15, closed: 15 } };
}

function generateGC(): { items: LineItem[]; tax_rate: number; deposit_value: number; deposit_mode: string; payment_terms: string; warranty_terms: string; statusWeights: Record<string, number> } {
  const items: LineItem[] = []; let sort = 0;
  const q1 = randInt(20, 80); const p1 = jitter(95, 0.15); items.push({ description: "Project Management and Supervision", quantity: q1, unit: "hr", unit_price: Math.round(p1 * 100) / 100, subtotal: Math.round(q1 * p1 * 100) / 100, sort_order: sort++ });
  const p2 = jitter(randBetween(800, 3500), 0.25); items.push({ description: "Demolition and Removal", quantity: 1, unit: "lot", unit_price: Math.round(p2 * 100) / 100, subtotal: Math.round(p2 * 100) / 100, sort_order: sort++ });
  const p3 = jitter(randBetween(2500, 12000), 0.20); items.push({ description: "Framing and Structural", quantity: 1, unit: "lot", unit_price: Math.round(p3 * 100) / 100, subtotal: Math.round(p3 * 100) / 100, sort_order: sort++ });
  const q4 = randInt(400, 2800); const p4 = jitter(4.50, 0.15); items.push({ description: "Drywall Supply and Install", quantity: q4, unit: "sqft", unit_price: Math.round(p4 * 100) / 100, subtotal: Math.round(q4 * p4 * 100) / 100, sort_order: sort++ });
  const p5 = jitter(randBetween(1200, 4500), 0.20); items.push({ description: "Painting — Interior", quantity: 1, unit: "lot", unit_price: Math.round(p5 * 100) / 100, subtotal: Math.round(p5 * 100) / 100, sort_order: sort++ });
  const p6 = jitter(485, 0.20); items.push({ description: "Final Cleanup", quantity: 1, unit: "lot", unit_price: Math.round(p6 * 100) / 100, subtotal: Math.round(p6 * 100) / 100, sort_order: sort++ });
  if (Math.random() < 0.40) { const p = jitter(randBetween(1800, 6500), 0.20); items.push({ description: "Electrical Subcontractor", quantity: 1, unit: "lot", unit_price: Math.round(p * 100) / 100, subtotal: Math.round(p * 100) / 100, sort_order: sort++ }); }
  if (Math.random() < 0.40) { const p = jitter(randBetween(1500, 5500), 0.20); items.push({ description: "Plumbing Subcontractor", quantity: 1, unit: "lot", unit_price: Math.round(p * 100) / 100, subtotal: Math.round(p * 100) / 100, sort_order: sort++ }); }
  if (Math.random() < 0.40) { const p = jitter(randBetween(2200, 8500), 0.20); items.push({ description: "Flooring Subcontractor", quantity: 1, unit: "lot", unit_price: Math.round(p * 100) / 100, subtotal: Math.round(p * 100) / 100, sort_order: sort++ }); }
  if (Math.random() < 0.40) { const p = jitter(randBetween(450, 1800), 0.20); items.push({ description: "Permit and Inspection Fees", quantity: 1, unit: "lot", unit_price: Math.round(p * 100) / 100, subtotal: Math.round(p * 100) / 100, sort_order: sort++ }); }
  return { items, tax_rate: 0, deposit_value: 33, deposit_mode: "percentage", payment_terms: "33% deposit due upon signing. 33% at project midpoint. Balance due upon completion.", warranty_terms: "1-year warranty on all labor and workmanship.", statusWeights: { signed: 35, sent: 30, draft: 20, closed: 15 } };
}

const generators: Record<string, () => ReturnType<typeof generateFlooring>> = {
  flooring: generateFlooring, landscaping: generateLandscaping, roofing: generateRoofing,
  hvac: generateHvac, plumbing: generatePlumbing, painting: generatePainting,
  general_contractor: generateGC,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleData) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { target_user_id, trade, count, action } = await req.json();

    // CLEAR ACTION
    if (action === "clear") {
      const { data: seededProposals } = await adminClient.from("proposals").select("id").eq("user_id", target_user_id).ilike("title", "%[SEEDED]%");
      const ids = (seededProposals || []).map((p: any) => p.id);
      if (ids.length > 0) {
        await adminClient.from("proposal_line_items").delete().in("proposal_id", ids);
        await adminClient.from("proposals").delete().in("id", ids);
      }
      await adminClient.from("user_intelligence_cache").delete().eq("user_id", target_user_id);
      return new Response(JSON.stringify({ deleted: ids.length, message: `Cleared ${ids.length} seeded proposals` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // SEED ACTION
    if (!trade || !count || !target_user_id) {
      return new Response(JSON.stringify({ error: "Missing parameters" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const gen = generators[trade];
    if (!gen) return new Response(JSON.stringify({ error: "Unknown trade" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const tradeLabel = TRADE_LABELS[trade] || trade;
    let proposalNumber = 1000 + randInt(0, 500);
    const log: string[] = [];
    let totalRevenue = 0;
    let earliest: Date | null = null;
    let latest: Date | null = null;

    for (let i = 0; i < Math.min(count, 50); i++) {
      const { items, tax_rate, deposit_value, deposit_mode, payment_terms, warranty_terms, statusWeights } = gen();
      const clientName = pickRandom(CLIENT_NAMES);
      const addr = pickRandom(ADDRESSES);
      const parsed = parseAddress(addr);
      const lastName = clientName.split(" ").pop();
      const city = parsed.city;
      const createdAt = spreadDate(18);
      if (!earliest || createdAt < earliest) earliest = createdAt;
      if (!latest || createdAt > latest) latest = createdAt;

      const subtotal = items.reduce((s, it) => s + it.subtotal, 0);
      const tax_amount = Math.round(subtotal * (tax_rate / 100) * 100) / 100;
      const total = Math.round((subtotal + tax_amount) * 100) / 100;
      const deposit_amount = Math.round(total * (deposit_value / 100) * 100) / 100;
      const balance_due = Math.round((total - deposit_amount) * 100) / 100;
      const status = weightedStatus(statusWeights);
      const validUntil = new Date(createdAt.getTime() + 30 * 86400000);
      const title = `${tradeLabel} Proposal — ${lastName} — ${city} [SEEDED]`;

      const { data: proposal, error: pErr } = await adminClient.from("proposals").insert({
        user_id: target_user_id,
        proposal_number: proposalNumber,
        template: "clean",
        status,
        client_name: clientName,
        client_email: `${clientName.toLowerCase().replace(/ /g, ".")}@example.com`,
        job_site_street: parsed.street,
        job_site_city: parsed.city,
        job_site_state: parsed.state,
        job_site_zip: parsed.zip,
        title,
        job_description: `${tradeLabel} work at ${addr}`,
        subtotal,
        tax_rate,
        tax_amount,
        total,
        deposit_mode,
        deposit_value,
        deposit_amount,
        balance_due,
        payment_terms,
        warranty_terms,
        proposal_date: createdAt.toISOString().split("T")[0],
        valid_until: validUntil.toISOString().split("T")[0],
        delivery_method: "email_self",
        created_at: createdAt.toISOString(),
        trade_type: trade,
      }).select("id").single();

      if (pErr || !proposal) {
        log.push(`✗ Error inserting proposal ${i + 1}: ${pErr?.message}`);
        continue;
      }

      const lineItemRows = items.map((it) => ({ ...it, proposal_id: proposal.id }));
      await adminClient.from("proposal_line_items").insert(lineItemRows);

      totalRevenue += total;
      proposalNumber += randInt(1, 4);
      log.push(`✓ Inserted: ${title} — $${total.toFixed(2)}`);
    }

    // Clear intelligence cache so it recomputes
    await adminClient.from("user_intelligence_cache").delete().eq("user_id", target_user_id);

    return new Response(JSON.stringify({
      inserted: log.filter(l => l.startsWith("✓")).length,
      total_revenue_simulated: Math.round(totalRevenue * 100) / 100,
      date_range: { earliest: earliest?.toISOString().split("T")[0], latest: latest?.toISOString().split("T")[0] },
      summary: `Seeded ${log.filter(l => l.startsWith("✓")).length} ${tradeLabel.toLowerCase()} proposals spanning 18 months. Total simulated revenue: $${totalRevenue.toFixed(0)}.`,
      log,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("seed-test-proposals error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
