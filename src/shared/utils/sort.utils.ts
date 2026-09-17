/**
 * Sorting utilities for records
 */

/**
 * Sort records by updatedAt date in descending order (newest first)
 */
export function sortByDateDesc<T extends { updatedAt: string }>(records: T[]): T[] {
  return [...records].sort((a, b) => {
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

/**
 * Sort records by a date field
 */
export function sortByDateField<T>(
  records: T[],
  field: keyof T,
  order: 'asc' | 'desc' = 'desc',
): T[] {
  const multiplier = order === 'desc' ? -1 : 1;

  return [...records].sort((a, b) => {
    const aTime = new Date(a[field] as string).getTime();
    const bTime = new Date(b[field] as string).getTime();
    return multiplier * (bTime - aTime);
  });
}
