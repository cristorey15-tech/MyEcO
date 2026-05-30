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
  const promises: Promise<void>[] = [];

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

  for (const fromCurrency of SUPPORTED_CURRENCIES) {
    for (const toCurrency of SUPPORTED_CURRENCIES) {
      if (fromCurrency === toCurrency) continue;

      let rate: number = 0;

      // USD -> X: direct lookup
      if (fromCurrency === 'USD') {
        rate = normalizedRates[toCurrency] || 0;
      }
      // X -> USD: invert
      else if (toCurrency === 'USD') {
        const fromRate = normalizedRates[fromCurrency];
        rate = fromRate ? 1 / fromRate : 0;
      }
      // X -> Y: cross via USD
      else {
        const fromRate = normalizedRates[fromCurrency];
        const toRate = normalizedRates[toCurrency];
        rate = (fromRate && toRate) ? toRate / fromRate : 0;
      }

      if (rate > 0 && isFinite(rate)) {
        promises.push(
          db.exchangeRates.put({
            fromCurrency,
            toCurrency,
            rate: roundToDecimals(rate, 6),
            updatedAt: now,
          } as any).then(() => { result.ratesFetched++; })
        );
      }
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
      await db.exchangeRates.put({
        fromCurrency: from,
        toCurrency: to,
        rate: roundToDecimals(rate, 6),
        updatedAt: new Date(),
      } as any);
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
