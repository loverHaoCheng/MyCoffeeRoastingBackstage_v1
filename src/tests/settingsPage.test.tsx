import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { SettingsPage } from '@/modules/settings';
import { beanCacheStorageKey } from '@/modules/bean/services';
import { supabaseConnectionSettingsStorageKey } from '@/modules/settings/services/supabaseConnectionSettings.service';
import { renderWithQuery } from '@/tests/renderWithProviders';

describe('SettingsPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('loads saved supabase connection settings', async () => {
    window.localStorage.setItem(
      supabaseConnectionSettingsStorageKey,
      JSON.stringify({
        greenBean: {
          projectUrl: 'https://green-demo.supabase.co',
          publishableKey: 'sb_publishable_green_demo',
        },
        roastedBean: {
          projectUrl: 'https://roasted-demo.supabase.co',
          publishableKey: 'sb_publishable_roasted_demo',
        },
        updatedAt: '2026-06-28T12:00:00.000Z',
      }),
    );

    renderWithQuery(<SettingsPage />);

    await waitFor(() => {
      expect(
        screen.getByLabelText('Project URL', { selector: '#green-bean-project-url' }),
      ).toHaveValue('https://green-demo.supabase.co');
    });
    expect(
      screen.getByLabelText('Publishable Key', { selector: '#roasted-bean-publishable-key' }),
    ).toHaveValue('sb_publishable_roasted_demo');
  });

  it('saves both supabase connection configs', async () => {
    renderWithQuery(<SettingsPage />);

    fireEvent.change(screen.getByLabelText('Project URL', { selector: '#green-bean-project-url' }), {
      target: { value: 'https://green-bean-project.supabase.co' },
    });
    fireEvent.change(
      screen.getByLabelText('Publishable Key', { selector: '#green-bean-publishable-key' }),
      {
        target: { value: 'sb_publishable_green_1234567890' },
      },
    );
    fireEvent.change(
      screen.getByLabelText('Project URL', { selector: '#roasted-bean-project-url' }),
      {
        target: { value: 'https://roasted-bean-project.supabase.co' },
      },
    );
    fireEvent.change(
      screen.getByLabelText('Publishable Key', { selector: '#roasted-bean-publishable-key' }),
      {
        target: { value: 'sb_publishable_roasted_1234567890' },
      },
    );

    await waitFor(() => {
      expect(window.localStorage.getItem(supabaseConnectionSettingsStorageKey)).not.toBeNull();
    });

    const storedValue = JSON.parse(
      window.localStorage.getItem(supabaseConnectionSettingsStorageKey) ?? '{}',
    ) as {
      greenBean?: { projectUrl?: string };
      roastedBean?: { publishableKey?: string };
      updatedAt?: string;
    };

    expect(storedValue.greenBean?.projectUrl).toBe('https://green-bean-project.supabase.co');
    expect(storedValue.roastedBean?.publishableKey).toBe('sb_publishable_roasted_1234567890');
    expect(storedValue.updatedAt).toEqual(expect.any(String));
  });

  it('allows leaving the roasted bean database blank', async () => {
    renderWithQuery(<SettingsPage />);

    fireEvent.change(screen.getByLabelText('Project URL', { selector: '#green-bean-project-url' }), {
      target: { value: 'https://green-bean-project.supabase.co' },
    });
    fireEvent.change(
      screen.getByLabelText('Publishable Key', { selector: '#green-bean-publishable-key' }),
      {
        target: { value: 'sb_publishable_green_only' },
      },
    );
    fireEvent.change(
      screen.getByLabelText('Project URL', { selector: '#roasted-bean-project-url' }),
      {
        target: { value: '' },
      },
    );
    fireEvent.change(
      screen.getByLabelText('Publishable Key', { selector: '#roasted-bean-publishable-key' }),
      {
        target: { value: '' },
      },
    );

    await waitFor(() => {
      const storedValue = window.localStorage.getItem(supabaseConnectionSettingsStorageKey);
      expect(storedValue).not.toBeNull();
    });
  });

  it('persists connection drafts even before the form is fully valid', async () => {
    renderWithQuery(<SettingsPage />);

    fireEvent.change(
      screen.getByLabelText('Project URL', { selector: '#roasted-bean-project-url' }),
      {
        target: { value: 'https://fevrfbblwupvroqlyihu.supabase.co' },
      },
    );

    await waitFor(() => {
      const storedValue = JSON.parse(
        window.localStorage.getItem(supabaseConnectionSettingsStorageKey) ?? '{}',
      ) as {
        roastedBean?: { projectUrl?: string };
      };

      expect(storedValue.roastedBean?.projectUrl).toBe('https://fevrfbblwupvroqlyihu.supabase.co');
    });
  });

  it('shows local cache sync status at the bottom of the page', async () => {
    window.localStorage.setItem(
      beanCacheStorageKey,
      JSON.stringify({
        beans: [
          {
            id: 'bean-1',
            name: '测试生豆',
            origin: '埃塞俄比亚 · 古吉',
            process: '水洗',
            grade: 'G1',
            stockKg: 12,
            costPerKg: 86,
            createdAt: '2026-06-28T10:00:00.000Z',
            updatedAt: '2026-06-28T10:00:00.000Z',
          },
        ],
        errorCode: null,
        lastReadAt: '2026-06-28T11:00:00.000Z',
        source: 'supabase',
        status: 'cached',
        syncedAt: '2026-06-28T11:00:00.000Z',
        version: 1,
      }),
    );

    renderWithQuery(<SettingsPage />);

    expect(await screen.findByRole('heading', { name: '当前数据同步状态' })).toBeInTheDocument();
    expect(screen.getAllByText('已同步完成').length).toBeGreaterThan(0);
    expect(screen.getByText('最近同步')).toBeInTheDocument();
    expect(screen.queryByText('生豆连接')).not.toBeInTheDocument();
    expect(screen.queryByText('熟豆连接')).not.toBeInTheDocument();
  });

  it('shows a sync warning at the top when bean sync fails', async () => {
    window.localStorage.setItem(
      supabaseConnectionSettingsStorageKey,
      JSON.stringify({
        greenBean: {
          projectUrl: 'https://green-demo.supabase.co',
          publishableKey: 'sb_publishable_green_demo',
        },
        roastedBean: {
          projectUrl: '',
          publishableKey: '',
        },
        updatedAt: '2026-06-28T12:00:00.000Z',
      }),
    );
    window.localStorage.setItem(
      beanCacheStorageKey,
      JSON.stringify({
        beans: [],
        errorCode: 'NETWORK',
        lastReadAt: '2026-06-28T11:00:00.000Z',
        source: 'supabase',
        status: 'error',
        syncedAt: null,
        version: 1,
      }),
    );

    renderWithQuery(<SettingsPage />);

    expect(await screen.findByText('生豆数据暂时无法同步')).toBeInTheDocument();
    expect(screen.getByText('网络连接异常，请检查当前网络或 Supabase 服务可达性。')).toBeInTheDocument();
  });

  it('does not show a warning when the remote bean database is simply empty', async () => {
    window.localStorage.setItem(
      supabaseConnectionSettingsStorageKey,
      JSON.stringify({
        greenBean: {
          projectUrl: 'https://green-demo.supabase.co',
          publishableKey: 'sb_publishable_green_demo',
        },
        roastedBean: {
          projectUrl: '',
          publishableKey: '',
        },
        updatedAt: '2026-06-28T12:00:00.000Z',
      }),
    );
    window.localStorage.setItem(
      beanCacheStorageKey,
      JSON.stringify({
        beans: [],
        errorCode: null,
        lastReadAt: '2026-06-28T11:00:00.000Z',
        source: 'supabase',
        status: 'empty',
        syncedAt: '2026-06-28T11:00:00.000Z',
        version: 1,
      }),
    );

    renderWithQuery(<SettingsPage />);

    expect(screen.queryByText('生豆数据暂时无法同步')).not.toBeInTheDocument();
    expect(screen.getAllByText('已连接，当前库为空').length).toBeGreaterThan(0);
  });

  it('shows connection tags inside each database card and removes footer buttons', async () => {
    renderWithQuery(<SettingsPage />);

    const greenBeanSection = screen.getByRole('heading', { name: '生豆数据库' }).closest('section');
    const roastedBeanSection = screen.getByRole('heading', { name: '熟豆数据库' }).closest('section');

    expect(greenBeanSection).not.toBeNull();
    expect(roastedBeanSection).not.toBeNull();
    expect(within(greenBeanSection as HTMLElement).getByText('已连接')).toBeInTheDocument();
    expect(within(roastedBeanSection as HTMLElement).getByText('未连接')).toBeInTheDocument();
    expect(
      within(roastedBeanSection as HTMLElement).getByText('熟豆数据库可暂时留空；未配置时，未来新增烘焙记录不会同步到熟豆库。'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '保存设置' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '清空配置' })).not.toBeInTheDocument();
  });
});
