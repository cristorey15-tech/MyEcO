import { describe, it, expect } from 'vitest';
import { paginate, getVisiblePages } from '../paginationUtils';

describe('getVisiblePages', () => {
  it('returns all pages when totalPages <= 5', () => {
    expect(getVisiblePages(1, 1)).toEqual([1]);
    expect(getVisiblePages(1, 3)).toEqual([1, 2, 3]);
    expect(getVisiblePages(3, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('shows pages 1-5 when on early pages (page <= 3)', () => {
    expect(getVisiblePages(1, 10)).toEqual([1, 2, 3, 4, 5]);
    expect(getVisiblePages(2, 10)).toEqual([1, 2, 3, 4, 5]);
    expect(getVisiblePages(3, 10)).toEqual([1, 2, 3, 4, 5]);
  });

  it('shows last 5 pages when on late pages (page >= total - 2)', () => {
    expect(getVisiblePages(8, 10)).toEqual([6, 7, 8, 9, 10]);
    expect(getVisiblePages(9, 10)).toEqual([6, 7, 8, 9, 10]);
    expect(getVisiblePages(10, 10)).toEqual([6, 7, 8, 9, 10]);
  });

  it('shows a centered sliding window when in the middle', () => {
    expect(getVisiblePages(5, 10)).toEqual([3, 4, 5, 6, 7]);
    expect(getVisiblePages(6, 10)).toEqual([4, 5, 6, 7, 8]);
    expect(getVisiblePages(4, 10)).toEqual([2, 3, 4, 5, 6]);
  });
});

describe('paginate', () => {
  const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  it('returns first page items with pageSize=3', () => {
    const result = paginate(items, 1, 3);
    expect(result.pageItems).toEqual([1, 2, 3]);
    expect(result.totalPages).toBe(4);
    expect(result.safePage).toBe(1);
    expect(result.visiblePages).toEqual([1, 2, 3, 4]);
  });

  it('returns second page items', () => {
    const result = paginate(items, 2, 3);
    expect(result.pageItems).toEqual([4, 5, 6]);
    expect(result.safePage).toBe(2);
  });

  it('returns last page (partial)', () => {
    const result = paginate(items, 4, 3);
    expect(result.pageItems).toEqual([10]);
    expect(result.safePage).toBe(4);
  });

  it('clamps currentPage to valid range when it exceeds totalPages', () => {
    const result = paginate(items, 100, 3);
    expect(result.safePage).toBe(4);
    expect(result.pageItems).toEqual([10]);
  });

  it('clamps currentPage to 1 when it is less than 1', () => {
    const result = paginate(items, -5, 3);
    expect(result.safePage).toBe(1);
    expect(result.pageItems).toEqual([1, 2, 3]);
  });

  it('returns totalPages=1 for empty items', () => {
    const result = paginate([], 1, 15);
    expect(result.totalPages).toBe(1);
    expect(result.safePage).toBe(1);
    expect(result.pageItems).toEqual([]);
    expect(result.visiblePages).toEqual([1]);
  });

  it('handles pageSize larger than items length', () => {
    const result = paginate(items, 1, 100);
    expect(result.totalPages).toBe(1);
    expect(result.safePage).toBe(1);
    expect(result.pageItems).toEqual(items);
  });

  it('calculates correct totalPages when items divide evenly', () => {
    const result = paginate(items, 1, 5);
    expect(result.totalPages).toBe(2);
    expect(result.pageItems).toEqual([1, 2, 3, 4, 5]);
  });

  it('shows correct visiblePages for middle page with many pages', () => {
    // 100 items, pageSize=10, page=5 => totalPages=10
    const manyItems = Array.from({ length: 100 }, (_, i) => i + 1);
    const result = paginate(manyItems, 5, 10);
    expect(result.totalPages).toBe(10);
    expect(result.visiblePages).toEqual([3, 4, 5, 6, 7]);
    // page 5 of 10 => middle, window centered around 5
  });

  it('shows correct visiblePages for last page with many pages', () => {
    const manyItems = Array.from({ length: 100 }, (_, i) => i + 1);
    const result = paginate(manyItems, 10, 10);
    expect(result.totalPages).toBe(10);
    expect(result.visiblePages).toEqual([6, 7, 8, 9, 10]);
    expect(result.pageItems).toEqual([91, 92, 93, 94, 95, 96, 97, 98, 99, 100]);
  });

  it('shows correct visiblePages for first page with many pages', () => {
    const manyItems = Array.from({ length: 100 }, (_, i) => i + 1);
    const result = paginate(manyItems, 1, 10);
    expect(result.visiblePages).toEqual([1, 2, 3, 4, 5]);
    expect(result.pageItems).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});
