import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Create mocked Dexie table references that survive vi.mock hoisting
const { mockExchangeRates, mockLast } = vi.hoisted(() => {
  const lastFn = vi.fn().mockResolvedValue(null);
  return {
    mockExchangeRates: {
      put: vi.fn().mockResolvedValue(undefined),
      orderBy: vi.fn().mockReturnValue({ last: lastFn }),
    },
    mockLast: lastFn,
  };
});

vi.mock('../db', () => ({
  db: { exchangeRates: mockExchangeRates },
}));

import { fetchAllRates, fetchSingleRate, getLastRateUpdate, needsRefresh } from '../exchangeRateService';

// Helper: default rate map (lowercase, as returned by primary API)
// Includes 'usd: 1' because the API always returns the base currency with rate 1
const BASE_RATES = {
  usd: 1,
  mxn: 17.5,
  eur: 0.92,
  ves: 35.0,
  cop: 4200,
  ars: 850,
  clp: 980,
  pen: 3.75,
  brl: 5.2,
  gbp: 0.79,
};

const SUPPORTED_CURRENCIES = ['USD', 'VES', 'MXN', 'EUR', 'COP', 'ARS', 'CLP', 'PEN', 'BRL', 'GBP'];
const EXPECTED_PAIRS = SUPPORTED_CURRENCIES.length * (SUPPORTED_CURRENCIES.length - 1); // 90

describe('exchangeRateService', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  function mockPrimarySuccess(rates: Record<string, number> = BASE_RATES) {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('usd.json')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ usd: { ...rates } }),
        });
      }
      if (url.includes('ves.json')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ves: { usd: 1 / 35 } }),
        });
      }
      return Promise.resolve({ ok: false });
    });
  }

  function mockFallbackSuccess(rates: Record<string, number> = { MXN: 17.5, EUR: 0.92, GBP: 0.79 }) {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('fawazahmed')) {
        return Promise.resolve({ ok: false });
      }
      if (url.includes('ves.json')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ves: { usd: 1 / 35 } }),
        });
      }
      if (url.includes('frankfurter')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ rates: { ...rates } }),
        });
      }
      return Promise.resolve({ ok: false });
    });
  }

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
    // Re-setup Dexie mock implementations (must return Promises for .then() chaining)
    mockLast.mockResolvedValue(null);
    mockExchangeRates.put.mockResolvedValue(undefined);
    mockExchangeRates.orderBy.mockReturnValue({ last: mockLast });
    mockExchangeRates.put.mockClear();
    mockExchangeRates.orderBy.mockClear();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ------------------------------------------------------------------
  // fetchAllRates
  // ------------------------------------------------------------------
  describe('fetchAllRates', () => {
    it('fetches and stores all cross-rates from primary API', async () => {
      mockPrimarySuccess();

      const result = await fetchAllRates();

      expect(result.success).toBe(true);
      expect(result.ratesFetched).toBe(EXPECTED_PAIRS);
      expect(result.errors).toHaveLength(0);
      // put should be called once per pair
      expect(mockExchangeRates.put).toHaveBeenCalledTimes(EXPECTED_PAIRS);
    });

    it('stores correct rate values (USD -> MXN direct)', async () => {
      mockPrimarySuccess();

      await fetchAllRates();

      // Find the USD->MXN put call
      const calls = mockExchangeRates.put.mock.calls;
      const usdToMxn = calls.find(
        (c: any[]) => c[0].fromCurrency === 'USD' && c[0].toCurrency === 'MXN'
      );
      expect(usdToMxn).toBeDefined();
      expect(usdToMxn![0].rate).toBeCloseTo(17.5, 6);
    });

    it('stores correct cross-rate (MXN -> EUR via USD)', async () => {
      mockPrimarySuccess();

      await fetchAllRates();

      const calls = mockExchangeRates.put.mock.calls;
      const mxnToEur = calls.find(
        (c: any[]) => c[0].fromCurrency === 'MXN' && c[0].toCurrency === 'EUR'
      );
      expect(mxnToEur).toBeDefined();
      // MXN->EUR = EURrate / MXNrate = 0.92 / 17.5 ≈ 0.0525714
      expect(mxnToEur![0].rate).toBeCloseTo(0.92 / 17.5, 6);
    });

    it('stores correct inverse rate (MXN -> USD)', async () => {
      mockPrimarySuccess();

      await fetchAllRates();

      const calls = mockExchangeRates.put.mock.calls;
      const mxnToUsd = calls.find(
        (c: any[]) => c[0].fromCurrency === 'MXN' && c[0].toCurrency === 'USD'
      );
      expect(mxnToUsd).toBeDefined();
      expect(mxnToUsd![0].rate).toBeCloseTo(1 / 17.5, 6);
    });

    it('falls back to secondary API when primary fails', async () => {
      mockFallbackSuccess();

      const result = await fetchAllRates();

      expect(result.success).toBe(true);
      expect(result.ratesFetched).toBeGreaterThan(0);
      expect(result.errors).toContain('Primary API failed, trying fallback...');
    });

    it('returns failure when both APIs fail', async () => {
      fetchMock.mockResolvedValue({ ok: false });

      const result = await fetchAllRates();

      expect(result.success).toBe(false);
      expect(result.ratesFetched).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('handles fetch exceptions gracefully', async () => {
      fetchMock.mockRejectedValue(new Error('Network error'));

      const result = await fetchAllRates();

      expect(result.success).toBe(false);
      expect(result.ratesFetched).toBe(0);
    });

    it('normalizes lowercase API keys to uppercase', async () => {
      mockPrimarySuccess();

      await fetchAllRates();

      // All stored pairs should have uppercase currency codes
      const calls = mockExchangeRates.put.mock.calls;
      for (const [record] of calls) {
        expect(record.fromCurrency).toEqual(record.fromCurrency.toUpperCase());
        expect(record.toCurrency).toEqual(record.toCurrency.toUpperCase());
      }
    });

    it('rounds rates to 6 decimal places', async () => {
      mockPrimarySuccess();

      await fetchAllRates();

      const calls = mockExchangeRates.put.mock.calls;
      for (const [record] of calls) {
        const str = record.rate.toString();
        if (str.includes('.')) {
          const decimals = str.split('.')[1].length;
          expect(decimals).toBeLessThanOrEqual(6);
        }
      }
    });

    it('includes updatedAt timestamp on each stored rate', async () => {
      mockPrimarySuccess();

      await fetchAllRates();

      const calls = mockExchangeRates.put.mock.calls;
      for (const [record] of calls) {
        expect(record.updatedAt).toBeInstanceOf(Date);
      }
    });

    it('fetches VES separately when primary returns it in the main payload', async () => {
      mockPrimarySuccess();

      await fetchAllRates();

      // VES is already in BASE_RATES, so no separate VES fetch needed
      const vesFetches = fetchMock.mock.calls.filter((c: any) => c[0].includes('ves.json'));
      expect(vesFetches.length).toBe(0);
    });

    it('fetches VES separately when primary does not include it', async () => {
      const ratesWithoutVes = { ...BASE_RATES };
      delete ratesWithoutVes.ves;
      mockPrimarySuccess(ratesWithoutVes);

      await fetchAllRates();

      // Should have made a separate VES fetch
      const vesFetches = fetchMock.mock.calls.filter((c: any) => c[0].includes('ves.json'));
      expect(vesFetches.length).toBe(1);
    });
  });

  // ------------------------------------------------------------------
  // fetchSingleRate
  // ------------------------------------------------------------------
  describe('fetchSingleRate', () => {
    it('returns a valid rate for a supported pair', async () => {
      mockPrimarySuccess();

      const rate = await fetchSingleRate('USD', 'MXN');

      expect(rate).toBeCloseTo(17.5, 6);
    });

    it('returns the inverse rate when swapping currencies', async () => {
      mockPrimarySuccess();

      const rate = await fetchSingleRate('MXN', 'USD');

      expect(rate).toBeCloseTo(1 / 17.5, 6);
    });

    it('returns null when the API fails', async () => {
      fetchMock.mockResolvedValue({ ok: false });

      const rate = await fetchSingleRate('USD', 'MXN');

      expect(rate).toBeNull();
    });

    it('returns null when the API response has no rates', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const rate = await fetchSingleRate('USD', 'MXN');

      expect(rate).toBeNull();
    });

    it('stores the fetched rate in the database', async () => {
      mockPrimarySuccess();

      await fetchSingleRate('USD', 'MXN');

      expect(mockExchangeRates.put).toHaveBeenCalledTimes(1);
      const [record] = mockExchangeRates.put.mock.calls[0];
      expect(record.fromCurrency).toBe('USD');
      expect(record.toCurrency).toBe('MXN');
      expect(record.rate).toBeCloseTo(17.5, 6);
    });

    it('handles fetch exceptions gracefully', async () => {
      fetchMock.mockRejectedValue(new Error('Network error'));

      const rate = await fetchSingleRate('USD', 'MXN');

      expect(rate).toBeNull();
    });
  });

  // ------------------------------------------------------------------
  // getLastRateUpdate
  // ------------------------------------------------------------------
  describe('getLastRateUpdate', () => {
    it('returns null when no rates are cached', async () => {
      mockLast.mockResolvedValue(null);

      const result = await getLastRateUpdate();

      expect(result).toBeNull();
    });

    it('returns the last rate update timestamp', async () => {
      const date = new Date('2024-01-15T10:00:00Z');
      mockLast.mockResolvedValue({ updatedAt: date });

      const result = await getLastRateUpdate();

      expect(result).toEqual(date);
    });

    it('queries with orderBy updatedAt descending', async () => {
      const date = new Date();
      mockLast.mockResolvedValue({ updatedAt: date });

      await getLastRateUpdate();

      expect(mockExchangeRates.orderBy).toHaveBeenCalledWith('updatedAt');
    });
  });

  // ------------------------------------------------------------------
  // needsRefresh
  // ------------------------------------------------------------------
  describe('needsRefresh', () => {
    it('returns true when no rates have ever been cached', async () => {
      mockLast.mockResolvedValue(null);

      const result = await needsRefresh();

      expect(result).toBe(true);
    });

    it('returns false when rates were updated less than 24 hours ago', async () => {
      const recent = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      mockLast.mockResolvedValue({ updatedAt: recent });

      const result = await needsRefresh();

      expect(result).toBe(false);
    });

    it('returns true when rates were updated more than 24 hours ago', async () => {
      const old = new Date(Date.now() - 30 * 60 * 60 * 1000); // 30 hours ago
      mockLast.mockResolvedValue({ updatedAt: old });

      const result = await needsRefresh();

      expect(result).toBe(true);
    });

    it('returns false when rates were updated exactly 24 hours ago', async () => {
      const exactly24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      mockLast.mockResolvedValue({ updatedAt: exactly24h });

      const result = await needsRefresh();

      // hoursElapsed > 24 should be false (exactly 24 is not > 24)
      expect(result).toBe(false);
    });
  });
});
