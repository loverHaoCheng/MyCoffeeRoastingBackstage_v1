import { beforeEach, describe, expect, it } from 'vitest';

import { pocketBaseConnectionSettingsService } from '@/modules/settings/services/pocketBaseConnectionSettings.service';

describe('pocketBaseConnectionSettingsService', () => {
  const defaultPocketBaseUrl = window.location.origin;

  beforeEach(() => {
    window.localStorage.clear();
    pocketBaseConnectionSettingsService.clear();
  });

  it('returns default PocketBase server settings without reading localStorage', () => {
    const result = pocketBaseConnectionSettingsService.load();

    expect(result.greenBean.projectUrl).toBe(defaultPocketBaseUrl);
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

    expect(result.greenBean.projectUrl).toBe(defaultPocketBaseUrl);
    expect(result.roastedBean.projectUrl).toBe('');
  });

  it('keeps explicit non-supabase roasted bean project urls as-is', () => {
    pocketBaseConnectionSettingsService.save({
        greenBean: {
          projectUrl: 'http://81.70.224.75',
          publishableKey: '',
        },
        roastedBean: {
          projectUrl: 'https://mirror.example.com',
          publishableKey: 'mirror-key',
        },
        updatedAt: '2026-07-07T12:00:00.000Z',
      });

    const result = pocketBaseConnectionSettingsService.load();

    expect(result.greenBean.projectUrl).toBe('http://81.70.224.75');
    expect(result.roastedBean.projectUrl).toBe('https://mirror.example.com');
    expect(result.roastedBean.publishableKey).toBe('mirror-key');
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

  it('clears legacy pocketbase default urls from roasted bean settings after same-origin migration', () => {
    pocketBaseConnectionSettingsService.save({
        greenBean: {
          projectUrl: '',
          publishableKey: '',
        },
        roastedBean: {
          projectUrl: 'http://81.70.224.75',
          publishableKey: 'legacy-key',
        },
        updatedAt: '2026-07-07T12:00:00.000Z',
      });

    const result = pocketBaseConnectionSettingsService.load();

    expect(result.roastedBean.projectUrl).toBe('');
    expect(result.roastedBean.publishableKey).toBe('');
  });
});
