export interface PaginationResult<T> {
  totalPages: number;
  safePage: number;
  pageItems: T[];
  visiblePages: number[];
}

/**
 * Calculates smart page numbers to show in the paginator.
 * Shows up to 5 pages with sliding window behavior.
 */
export function getVisiblePages(currentPage: number, totalPages: number): number[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  if (currentPage <= 3) {
    return [1, 2, 3, 4, 5];
  }
  if (currentPage >= totalPages - 2) {
    return Array.from({ length: 5 }, (_, i) => totalPages - 4 + i);
  }
  return Array.from({ length: 5 }, (_, i) => currentPage - 2 + i);
}

/**
 * Computes pagination state for a list of items.
 * @param items - The full list of items to paginate
 * @param currentPage - The current page (1-based)
 * @param pageSize - Number of items per page
 */
export function paginate<T>(items: T[], currentPage: number, pageSize: number): PaginationResult<T> {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.max(1, Math.min(currentPage, totalPages));
  const start = (safePage - 1) * pageSize;
  const end = start + pageSize;
  const pageItems = items.slice(start, end);
  const visiblePages = getVisiblePages(safePage, totalPages);

  return { totalPages, safePage, pageItems, visiblePages };
}
