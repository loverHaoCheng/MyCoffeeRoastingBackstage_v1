import { beforeEach, describe, expect, it } from 'vitest';

import { pocketBaseConnectionSettingsService } from '@/modules/settings/services/pocketBaseConnectionSettings.service';

describe('pocketBaseConnectionSettingsService', () => {
  beforeEach(() => {
    window.localStorage.clear();
    pocketBaseConnectionSettingsService.clear();
  });

  it('returns default PocketBase server settings without reading localStorage', () => {
    const result = pocketBaseConnectionSettingsService.load();

    expect(result.greenBean.projectUrl).toBe('http://81.70.224.75');
    expect(result.roastedBean.projectUrl).toBe('');
    expect(result.roastedBean.publishableKey).toBe('');
  });

  it('normalizes blank green bean project urls when settings are saved in runtime state', () => {
    pocketBaseConnectionSettingsService.save({
        greenBean: {
          projectUrl: '',
          publishableKey: '',
        },
        roastedBean: {
          projectUrl: '',
          publishableKey: '',
        },
        updatedAt: '2026-07-07T12:00:00.000Z',
      });

    const result = pocketBaseConnectionSettingsService.load();

    expect(result.greenBean.projectUrl).toBe('http://81.70.224.75');
    expect(result.roastedBean.projectUrl).toBe('');
  });

  it('strips legacy placeholder values from roasted bean connections', () => {
    pocketBaseConnectionSettingsService.save({
        greenBean: {
          projectUrl: 'http://127.0.0.1:8090',
          publishableKey: 'legacy-local-access',
        },
        roastedBean: {
          projectUrl: 'http://127.0.0.1:8090',
          publishableKey: 'legacy-local-access',
        },
        updatedAt: '2026-07-07T12:00:00.000Z',
      });

    const result = pocketBaseConnectionSettingsService.load();

    expect(result.greenBean.projectUrl).toBe('http://81.70.224.75');
    expect(result.roastedBean.projectUrl).toBe('');
    expect(result.roastedBean.publishableKey).toBe('');
  });

  it('keeps roasted bean supabase project urls instead of normalizing them to pocketbase defaults', () => {
    pocketBaseConnectionSettingsService.save({
        greenBean: {
          projectUrl: '',
          publishableKey: '',
        },
        roastedBean: {
          projectUrl: 'https://demo.supabase.co/',
          publishableKey: 'sb_publishable_demo',
        },
        updatedAt: '2026-07-07T12:00:00.000Z',
      });

    const result = pocketBaseConnectionSettingsService.load();

    expect(result.roastedBean.projectUrl).toBe('https://demo.supabase.co');
    expect(result.roastedBean.publishableKey).toBe('sb_publishable_demo');
  });
});
