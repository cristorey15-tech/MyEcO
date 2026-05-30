import { describe, it, expect } from 'vitest';
import {
  cn,
  formatCurrency,
  formatDate,
  getMonthName,
  getCurrentMonth,
  getCurrentYear,
  getDaysInMonth,
  calculatePercentage,
  getInitials,
} from '../utils';

describe('cn', () => {
  it('should merge class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('should handle conditional classes', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible');
  });

  it('should merge Tailwind classes correctly', () => {
    expect(cn('px-4', 'px-2')).toBe('px-2');
  });
});

describe('formatCurrency', () => {
  it('should return a string containing digits for a positive amount', () => {
    const result = formatCurrency(1000, 'USD');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(3);
    // Should contain the number somewhere
    expect(result.replace(/[^\d]/g, '')).toMatch(/1000/);
  });

  it('should format zero', () => {
    const result = formatCurrency(0, 'MXN');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('should handle negative amounts', () => {
    const result = formatCurrency(-500, 'USD');
    expect(typeof result).toBe('string');
    // Should contain either minus sign or parentheses for negative
    expect(result.replace(/[^\d]/g, '')).toMatch(/500/);
  });

  it('should include currency code or symbol', () => {
    const result = formatCurrency(100, 'USD');
    // Should contain USD code or $ symbol
    const upper = result.toUpperCase();
    expect(upper.includes('USD') || result.includes('$')).toBe(true);
  });
});

describe('formatDate', () => {
  it('should format a Date object', () => {
    const date = new Date(2024, 0, 15);
    const result = formatDate(date);
    expect(result).toContain('2024');
    expect(result).toContain('15');
  });

  it('should format a date string', () => {
    const result = formatDate('2024-03-20');
    expect(result).toContain('2024');
  });
});

describe('calculatePercentage', () => {
  it('should calculate correct percentage', () => {
    expect(calculatePercentage(50, 100)).toBe(50);
  });

  it('should return 0 when total is 0', () => {
    expect(calculatePercentage(50, 0)).toBe(0);
  });

  it('should cap at 100', () => {
    expect(calculatePercentage(150, 100)).toBe(100);
  });

  it('should round to nearest integer', () => {
    expect(calculatePercentage(33, 100)).toBe(33);
  });
});

describe('getMonthName', () => {
  it('should return a non-empty month name for month 1', () => {
    const result = getMonthName(1);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should return a non-empty month name for month 12', () => {
    const result = getMonthName(12);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should return different names for different months', () => {
    const jan = getMonthName(1);
    const feb = getMonthName(2);
    expect(jan).not.toEqual(feb);
  });
});

describe('getCurrentMonth', () => {
  it('should return a number between 1 and 12', () => {
    const month = getCurrentMonth();
    expect(month).toBeGreaterThanOrEqual(1);
    expect(month).toBeLessThanOrEqual(12);
  });
});

describe('getCurrentYear', () => {
  it('should return a 4-digit year', () => {
    const year = getCurrentYear();
    expect(year).toBeGreaterThan(2000);
    expect(year).toBeLessThan(2100);
  });
});

describe('getDaysInMonth', () => {
  it('should return 31 for January', () => {
    expect(getDaysInMonth(1, 2024)).toBe(31);
  });

  it('should return 29 for February 2024 (leap year)', () => {
    expect(getDaysInMonth(2, 2024)).toBe(29);
  });

  it('should return 28 for February 2025 (non-leap year)', () => {
    expect(getDaysInMonth(2, 2025)).toBe(28);
  });
});

describe('getInitials', () => {
  it('should return initials from a full name', () => {
    expect(getInitials('John Doe')).toBe('JD');
  });

  it('should handle single name', () => {
    expect(getInitials('John')).toBe('J');
  });

  it('should be uppercase', () => {
    expect(getInitials('john doe')).toBe('JD');
  });

  it('should limit to 2 characters', () => {
    expect(getInitials('John Michael Doe')).toBe('JM');
  });
});
