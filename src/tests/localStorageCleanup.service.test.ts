import { describe, expect, it } from 'vitest';

import { localStorageCleanupService } from '@/shared/services/localStorageCleanup.service';

describe('localStorageCleanupService', () => {
  it('removes obsolete app-prefixed keys and preserves active keys', () => {
    window.localStorage.clear();
    window.localStorage.setItem('coffee-roasting-backstage:cost-templates', '{"templates":[]}');
    window.localStorage.setItem('coffee-roasting-backstage:cost-templates:backup', 'legacy');
    window.localStorage.setItem('coffee-roasting-backstage:submission-backups', 'legacy');
    window.localStorage.setItem('coffee-roasting-backstage:unknown-key', 'legacy');
    window.localStorage.setItem('third-party:key', 'keep');

    const removedKeys = localStorageCleanupService.cleanupObsoleteKeys();

    expect(removedKeys.sort()).toEqual([
      'coffee-roasting-backstage:cost-templates:backup',
      'coffee-roasting-backstage:submission-backups',
      'coffee-roasting-backstage:unknown-key',
    ]);
    expect(window.localStorage.getItem('coffee-roasting-backstage:cost-templates')).toBe('{"templates":[]}');
    expect(window.localStorage.getItem('third-party:key')).toBe('keep');
  });
});
