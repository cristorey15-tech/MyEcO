import { db } from './db';

// Primary API: fawazahmed0/currency-api (supports all currencies including VES)
const CURRENCY_API = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies';
// Fallback: Frankfurter API (more reliable for major currencies)
const FRANKFURTER_API = 'https://api.frankfurter.dev/v2';

// Currencies we support in MyEco — USD first, VES included
const SUPPORTED_CURRENCIES = ['USD', 'VES', 'MXN', 'EUR', 'COP', 'ARS', 'CLP', 'PEN', 'BRL', 'GBP'];

export interface FetchResult {
  success: boolean;
  ratesFetched: number;
  errors: string[];
}

/**
 * Fetch rates from the primary API (fawazahmed0/currency-api).
 * Returns a map of currency -> rate relative to USD, or null on failure.
 */
async function fetchFromPrimary(): Promise<Record<string, number> | null> {
  try {
    // API returns all rates relative to USD
    const url = `${CURRENCY_API}/usd.json`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    return data?.usd || null;
  } catch {
    return null;
  }
}

/**
 * Fetch rates from fallback API (Frankfurter).
 * Returns a map of currency -> rate relative to USD, or null on failure.
 * Note: Frankfurter does NOT support VES.
 */
async function fetchFromFallback(): Promise<Record<string, number> | null> {
  try {
    const url = `${FRANKFURTER_API}/latest?base=USD`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    return data?.rates || null;
  } catch {
    return null;
  }
}

/**
 * Fetch latest exchange rates for all supported currencies and cache them in Dexie.
 * Uses primary API (fawazahmed0), falls back to Frankfurter if it fails.
 * Also stores historical snapshots in rateHistory table.
 */
export async function fetchAllRates(): Promise<FetchResult> {
  const result: FetchResult = { success: true, ratesFetched: 0, errors: [] };

  let rates: Record<string, number> | null = null;

  // Try primary API first
  rates = await fetchFromPrimary();
  if (!rates) {
    result.errors.push('Primary API failed, trying fallback...');
    rates = await fetchFromFallback();
  }

  if (!rates) {
    result.success = false;
    result.errors.push('All APIs failed to fetch rates');
    return result;
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const promises: Promise<any>[] = [];

  // VES is only available in primary API — try fetching it directly if not in rates
  if (!rates['ves']) {
    try {
      const vesUrl = `${CURRENCY_API}/ves.json`;
      const vesResp = await fetch(vesUrl);
      if (vesResp.ok) {
        const vesData = await vesResp.json();
        if (vesData?.ves?.usd) {
          rates['ves'] = 1 / vesData.ves.usd; // ves per usd
        }
      }
    } catch {
      // VES rate unavailable
    }
  }

  // Normalize keys to uppercase
  const normalizedRates: Record<string, number> = {};
  for (const [key, value] of Object.entries(rates)) {
    if (typeof value === 'number' && value > 0 && isFinite(value)) {
      normalizedRates[key.toUpperCase()] = value;
    }
  }

  // First, save current rates to history before overwriting
  const currentRates = await db.exchangeRates.toArray();
  for (const currentRate of currentRates) {
    // Check if we already have a snapshot for today
    const existingHistory = await db.rateHistory
      .where({ fromCurrency: 'USD', toCurrency: currentRate.toCurrency })
      .filter(h => {
        const hDate = new Date(h.date);
        return hDate.getFullYear() === today.getFullYear() &&
               hDate.getMonth() === today.getMonth() &&
               hDate.getDate() === today.getDate();
      })
      .first();

    if (!existingHistory) {
      promises.push(
        db.rateHistory.add({
          fromCurrency: 'USD',
          toCurrency: currentRate.toCurrency,
          rate: currentRate.rate,
          date: today,
        }).catch(() => {}) // Ignore duplicate errors
      );
    }
  }

  // Clear old rates before storing new ones
  await db.exchangeRates.clear();

  // Store only USD base rates (USD -> X)
  for (const toCurrency of SUPPORTED_CURRENCIES) {
    if (toCurrency === 'USD') continue;

    const rate = normalizedRates[toCurrency] || 0;

    if (rate > 0 && isFinite(rate)) {
      promises.push(
        db.exchangeRates.put({
          fromCurrency: 'USD',
          toCurrency,
          rate: roundToDecimals(rate, 6),
          updatedAt: now,
        }).then(() => { result.ratesFetched++; })
      );
    }
  }

  await Promise.all(promises);
  result.success = result.ratesFetched > 0;
  if (!result.success) {
    result.errors.push('No rates could be fetched');
  }

  return result;
}

/**
 * Fetch a single exchange rate pair from the API and cache it.
 */
export async function fetchSingleRate(from: string, to: string): Promise<number | null> {
  try {
    const url = `${CURRENCY_API}/usd.json`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    const rates = data?.usd;
    if (!rates) return null;

    const fromRate = rates[from.toLowerCase()];
    const toRate = rates[to.toLowerCase()];

    if (!fromRate || !toRate) return null;

    const rate = toRate / fromRate;

    if (rate > 0 && isFinite(rate)) {
      // Store only USD base rate
      if (from === 'USD') {
        await db.exchangeRates.put({
          fromCurrency: from,
          toCurrency: to,
          rate: roundToDecimals(rate, 6),
          updatedAt: new Date(),
        });
      }
      return rate;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Get last updated timestamp for cached rates
 */
export async function getLastRateUpdate(): Promise<Date | null> {
  const rate = await db.exchangeRates
    .orderBy('updatedAt')
    .last();

  return rate?.updatedAt || null;
}

/**
 * Get historical rate data for a currency pair, sorted by date ascending.
 */
export async function getRateHistory(fromCurrency: string, toCurrency: string): Promise<{ date: string; rate: number }[]> {
  const history = await db.rateHistory
    .where({ fromCurrency: fromCurrency.toUpperCase(), toCurrency: toCurrency.toUpperCase() })
    .sortBy('date');

  return history.map(h => ({
    date: h.date.toISOString().split('T')[0],
    rate: h.rate,
  }));
}

/**
 * Detect if a rate has dropped significantly (more than X% drop in the last N days).
 */
export async function detectRateDrop(fromCurrency: string, toCurrency: string, thresholdPercent = 10, days = 30): Promise<{ dropped: boolean; dropPercent: number; oldRate: number; currentRate: number } | null> {
  const current = await db.exchangeRates
    .where({ fromCurrency: fromCurrency.toUpperCase(), toCurrency: toCurrency.toUpperCase() })
    .first();

  if (!current) return null;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const oldHistory = await db.rateHistory
    .where({ fromCurrency: fromCurrency.toUpperCase(), toCurrency: toCurrency.toUpperCase() })
    .filter(h => h.date <= cutoff)
    .sortBy('date');

  if (oldHistory.length === 0) return null;

  const oldRate = oldHistory[oldHistory.length - 1].rate;
  const dropPercent = ((oldRate - current.rate) / oldRate) * 100;

  return {
    dropped: dropPercent >= thresholdPercent,
    dropPercent: Math.round(dropPercent * 10) / 10,
    oldRate,
    currentRate: current.rate,
  };
}

/**
 * Check if rates need refreshing (older than 24 hours)
 */
export async function needsRefresh(): Promise<boolean> {
  const lastUpdate = await getLastRateUpdate();
  if (!lastUpdate) return true;

  const hoursElapsed = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);
  return hoursElapsed > 24;
}

function roundToDecimals(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
