/**
 * Data synchronization utilities
 */

/**
 * Create a sync snapshot from records (id:updatedAt pairs sorted by id)
 * Used to detect changes between local and remote data
 */
export function createSyncSnapshot<T extends { id: string; updatedAt: string }>(
  records: T[],
): string {
  return JSON.stringify(
    [...records]
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))
      .map((r) => `${r.id}:${r.updatedAt}`),
  );
}
