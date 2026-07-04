import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { appBuildVersionStorageKey, appBuildVersionUpdatedEventName } from '@/app/services/appBuildVersion.service';
import { SettingsPage } from '@/modules/settings';
import { beanCacheStorageKey } from '@/modules/bean/services';
import { supabaseConnectionSettingsStorageKey } from '@/modules/settings/services/supabaseConnectionSettings.service';
import { useSettingsStore } from '@/modules/settings/store';
import {
  createDefaultAppDisplaySettings,
  createDefaultCostTemplateSettings,
  createDefaultSupabaseConnectionSettings,
} from '@/modules/settings/types';
import { renderWithQuery } from '@/tests/renderWithProviders';

const expandSection = async (headingName: string): Promise<HTMLElement> => {
  const section = screen.getByRole('heading', { name: headingName }).closest('section');

  expect(section).not.toBeNull();

  if (section == null) {
    throw new Error(`Section not found for heading: ${headingName}`);
  }

  const resolvedSection = section;
  const expandButton = within(resolvedSection).queryByRole('button', { name: '展开' });

  if (expandButton) {
    fireEvent.click(expandButton);
    await waitFor(() => {
      expect(resolvedSection.getAttribute('data-collapsed')).toBe('false');
    });
  }

  return resolvedSection;
};

describe('SettingsPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useSettingsStore.setState({
      appDisplaySettings: createDefaultAppDisplaySettings(),
      costTemplateSettings: createDefaultCostTemplateSettings(),
      supabaseConnections: createDefaultSupabaseConnectionSettings(),
    });
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
    await expandSection('生豆数据库');
    await expandSection('熟豆数据库');

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
    await expandSection('生豆数据库');
    await expandSection('熟豆数据库');

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
    fireEvent.blur(
      screen.getByLabelText('Publishable Key', { selector: '#roasted-bean-publishable-key' }),
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
    await expandSection('生豆数据库');
    await expandSection('熟豆数据库');

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
    fireEvent.blur(
      screen.getByLabelText('Publishable Key', { selector: '#roasted-bean-publishable-key' }),
    );

    await waitFor(() => {
      const storedValue = window.localStorage.getItem(supabaseConnectionSettingsStorageKey);
      expect(storedValue).not.toBeNull();
    });
  });

  it('persists connection drafts even before the form is fully valid', async () => {
    renderWithQuery(<SettingsPage />);
    await expandSection('熟豆数据库');

    fireEvent.change(
      screen.getByLabelText('Project URL', { selector: '#roasted-bean-project-url' }),
      {
        target: { value: 'https://fevrfbblwupvroqlyihu.supabase.co' },
      },
    );
    fireEvent.blur(
      screen.getByLabelText('Project URL', { selector: '#roasted-bean-project-url' }),
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

  it('does not persist supabase connection inputs before blur', async () => {
    renderWithQuery(<SettingsPage />);
    await expandSection('生豆数据库');

    fireEvent.change(screen.getByLabelText('Project URL', { selector: '#green-bean-project-url' }), {
      target: { value: 'https://green-bean-project.supabase.co' },
    });

    expect(window.localStorage.getItem(supabaseConnectionSettingsStorageKey)).toBeNull();
  });

  it('shows local cache sync status at the bottom of the page', () => {
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

    expect(screen.queryByRole('heading', { name: '当前数据同步状态' })).not.toBeInTheDocument();
    expect(screen.getByText('已同步完成')).toBeInTheDocument();
    expect(screen.queryByText('最近同步')).not.toBeInTheDocument();
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

  it('does not show a warning when the remote bean database is simply empty', () => {
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

  it('shows unconnected status when there is old cache but no active green bean connection', () => {
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

    expect(screen.getByText('未配置连接')).toBeInTheDocument();
    expect(screen.getAllByText('未连接').length).toBeGreaterThan(0);
    expect(screen.queryByText('已连接，当前库为空')).not.toBeInTheDocument();
  });

  it('shows connection tags inside each database card and removes footer buttons', async () => {
    renderWithQuery(<SettingsPage />);

    const greenBeanSection = await expandSection('生豆数据库');
    const roastedBeanSection = await expandSection('熟豆数据库');

    expect(within(greenBeanSection).getByText('未连接')).toBeInTheDocument();
    expect(within(greenBeanSection).getByRole('button', { name: /完全同步/ })).toBeDisabled();
    expect(within(roastedBeanSection).getByText('未连接')).toBeInTheDocument();
    expect(
      within(roastedBeanSection).getByRole('button', { name: /复制熟豆建库 SQL/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '保存设置' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '清空配置' })).not.toBeInTheDocument();
  });

  it('keeps the build version label in sync with localStorage updates', async () => {
    window.localStorage.setItem(
      appBuildVersionStorageKey,
      '0.1.0-initial',
    );

    renderWithQuery(<SettingsPage />);

    expect(screen.getByText('当前 Web 上传版本：0.1.0-initial')).toBeInTheDocument();

    act(() => {
      window.localStorage.setItem(appBuildVersionStorageKey, '0.1.0-updated');
      window.dispatchEvent(new CustomEvent(appBuildVersionUpdatedEventName));
    });

    expect(await screen.findByText('当前 Web 上传版本：0.1.0-updated')).toBeInTheDocument();
  });
});
