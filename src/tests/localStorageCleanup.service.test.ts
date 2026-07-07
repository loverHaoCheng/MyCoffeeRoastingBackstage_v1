import { describe, expect, it } from 'vitest';

import { localStorageCleanupService } from '@/shared/services/localStorageCleanup.service';

describe('localStorageCleanupService', () => {
  it('removes every app-prefixed key and preserves third-party keys', () => {
    window.localStorage.clear();
    window.localStorage.setItem('coffee-roasting-backstage:cost-templates', '{"templates":[]}');
    window.localStorage.setItem('coffee-roasting-backstage:cost-templates:backup', 'legacy');
    window.localStorage.setItem('coffee-roasting-backstage:submission-backups', 'legacy');
    window.localStorage.setItem('coffee-roasting-backstage:unknown-key', 'legacy');
    window.localStorage.setItem('third-party:key', 'keep');

    const removedKeys = localStorageCleanupService.cleanupObsoleteKeys();

    expect(removedKeys.sort()).toEqual([
      'coffee-roasting-backstage:cost-templates',
      'coffee-roasting-backstage:cost-templates:backup',
      'coffee-roasting-backstage:submission-backups',
      'coffee-roasting-backstage:unknown-key',
    ]);
    expect(window.localStorage.getItem('coffee-roasting-backstage:cost-templates')).toBeNull();
    expect(window.localStorage.getItem('third-party:key')).toBe('keep');
  });

  it('clears cost templates during app state reset so account data can be fully resynced', () => {
    window.localStorage.clear();
    window.localStorage.setItem('coffee-roasting-backstage:cost-templates', '{"templates":[1]}');
    window.localStorage.setItem('coffee-roasting-backstage:app-display-settings', '{"theme":"light"}');
    window.localStorage.setItem('coffee-roasting-backstage:pocketbase-connections', '{"greenBean":{}}');

    const removedKeys = localStorageCleanupService.clearAppState();

    expect(removedKeys).toContain('coffee-roasting-backstage:cost-templates');
    expect(window.localStorage.getItem('coffee-roasting-backstage:cost-templates')).toBeNull();
    expect(window.localStorage.getItem('coffee-roasting-backstage:app-display-settings')).toBeNull();
    expect(window.localStorage.getItem('coffee-roasting-backstage:pocketbase-connections')).toBeNull();
  });
});
