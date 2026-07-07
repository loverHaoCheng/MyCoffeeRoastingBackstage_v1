import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { appBuildVersionStorageKey, appBuildVersionUpdatedEventName } from '@/app/services/appBuildVersion.service';
import { SettingsPage } from '@/modules/settings';
import { beanCacheStorageKey } from '@/modules/bean/services';
import { costTemplateSettingsStorageKey } from '@/modules/settings/services/costTemplateSettings.service';
import { pocketBaseConnectionSettingsStorageKey } from '@/modules/settings/services/pocketBaseConnectionSettings.service';
import { useSettingsStore } from '@/modules/settings/store';
import {
  createDefaultAppDisplaySettings,
  createDefaultCostTemplateSettings,
  createDefaultPocketBaseConnectionSettings,
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
      pocketBaseConnections: createDefaultPocketBaseConnectionSettings(),
    });
  });

  it('loads saved PocketBase connection settings', async () => {
    window.localStorage.setItem(
      pocketBaseConnectionSettingsStorageKey,
      JSON.stringify({
        greenBean: {
          projectUrl: 'http://127.0.0.1:8091',
          publishableKey: 'local-access-green',
        },
        roastedBean: {
          projectUrl: 'http://127.0.0.1:8091',
          publishableKey: 'local-access-roasted',
        },
        updatedAt: '2026-06-28T12:00:00.000Z',
      }),
    );

    renderWithQuery(<SettingsPage />);
    await expandSection('生豆 PocketBase');
    await expandSection('熟豆 PocketBase');

    await waitFor(() => {
      expect(
        screen.getByLabelText('PocketBase 地址', { selector: '#green-bean-project-url' }),
      ).toHaveValue('http://127.0.0.1:8091');
    });
    expect(
      screen.getByLabelText('访问密钥', { selector: '#roasted-bean-publishable-key' }),
    ).toHaveValue('local-access-roasted');
  });

  it('saves both PocketBase connection configs', async () => {
    renderWithQuery(<SettingsPage />);
    await expandSection('生豆 PocketBase');
    await expandSection('熟豆 PocketBase');

    fireEvent.change(screen.getByLabelText('PocketBase 地址', { selector: '#green-bean-project-url' }), {
      target: { value: 'http://127.0.0.1:8091' },
    });
    fireEvent.change(
      screen.getByLabelText('访问密钥', { selector: '#green-bean-publishable-key' }),
      {
        target: { value: 'local-access-green' },
      },
    );
    fireEvent.change(
      screen.getByLabelText('PocketBase 地址', { selector: '#roasted-bean-project-url' }),
      {
        target: { value: 'http://127.0.0.1:8091' },
      },
    );
    fireEvent.change(
      screen.getByLabelText('访问密钥', { selector: '#roasted-bean-publishable-key' }),
      {
        target: { value: 'local-access-roasted' },
      },
    );
    fireEvent.blur(
      screen.getByLabelText('访问密钥', { selector: '#roasted-bean-publishable-key' }),
    );

    await waitFor(() => {
      expect(window.localStorage.getItem(pocketBaseConnectionSettingsStorageKey)).not.toBeNull();
    });

    const storedValue = JSON.parse(
      window.localStorage.getItem(pocketBaseConnectionSettingsStorageKey) ?? '{}',
    ) as {
      greenBean?: { projectUrl?: string };
      roastedBean?: { publishableKey?: string };
      updatedAt?: string;
    };

    expect(storedValue.greenBean?.projectUrl).toBe('http://127.0.0.1:8091');
    expect(storedValue.roastedBean?.publishableKey).toBe('local-access-roasted');
    expect(storedValue.updatedAt).toEqual(expect.any(String));
  });

  it('allows leaving the roasted bean database blank', async () => {
    renderWithQuery(<SettingsPage />);
    await expandSection('生豆 PocketBase');
    await expandSection('熟豆 PocketBase');

    fireEvent.change(screen.getByLabelText('PocketBase 地址', { selector: '#green-bean-project-url' }), {
      target: { value: 'http://127.0.0.1:8091' },
    });
    fireEvent.change(
      screen.getByLabelText('访问密钥', { selector: '#green-bean-publishable-key' }),
      {
        target: { value: 'local-access-green' },
      },
    );
    fireEvent.change(
      screen.getByLabelText('PocketBase 地址', { selector: '#roasted-bean-project-url' }),
      {
        target: { value: '' },
      },
    );
    fireEvent.change(
      screen.getByLabelText('访问密钥', { selector: '#roasted-bean-publishable-key' }),
      {
        target: { value: '' },
      },
    );
    fireEvent.blur(
      screen.getByLabelText('访问密钥', { selector: '#roasted-bean-publishable-key' }),
    );

    await waitFor(() => {
      const storedValue = window.localStorage.getItem(pocketBaseConnectionSettingsStorageKey);
      expect(storedValue).not.toBeNull();
    });
  });

  it('persists connection drafts even before the form is fully valid', async () => {
    renderWithQuery(<SettingsPage />);
    await expandSection('熟豆 PocketBase');

    fireEvent.change(
      screen.getByLabelText('PocketBase 地址', { selector: '#roasted-bean-project-url' }),
      {
        target: { value: 'http://127.0.0.1:8091' },
      },
    );
    fireEvent.blur(
      screen.getByLabelText('PocketBase 地址', { selector: '#roasted-bean-project-url' }),
    );

    await waitFor(() => {
      const storedValue = JSON.parse(
        window.localStorage.getItem(pocketBaseConnectionSettingsStorageKey) ?? '{}',
      ) as {
        roastedBean?: { projectUrl?: string };
      };

      expect(storedValue.roastedBean?.projectUrl).toBe('http://127.0.0.1:8091');
    });
  });

  it('does not persist PocketBase connection inputs before blur', async () => {
    renderWithQuery(<SettingsPage />);
    await expandSection('生豆 PocketBase');

    fireEvent.change(screen.getByLabelText('PocketBase 地址', { selector: '#green-bean-project-url' }), {
      target: { value: 'http://127.0.0.1:8091' },
    });

    expect(window.localStorage.getItem(pocketBaseConnectionSettingsStorageKey)).toBeNull();
  });

  it('shows local cache sync status at the bottom of the page', () => {
    window.localStorage.setItem(
      pocketBaseConnectionSettingsStorageKey,
      JSON.stringify({
        greenBean: {
          projectUrl: 'http://127.0.0.1:8091',
          publishableKey: 'local-access-green',
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
        source: 'pocketbase',
        status: 'cached',
        syncedAt: '2026-06-28T11:00:00.000Z',
        version: 1,
      }),
    );

    renderWithQuery(<SettingsPage />);

    expect(screen.queryByRole('heading', { name: '当前数据同步状态' })).not.toBeInTheDocument();
    expect(screen.getAllByText('已连接').length).toBeGreaterThan(0);
    expect(screen.queryByText('最近同步')).not.toBeInTheDocument();
    expect(screen.queryByText('生豆连接')).not.toBeInTheDocument();
    expect(screen.queryByText('熟豆连接')).not.toBeInTheDocument();
  });

  it('does not show a warning when the remote bean database is simply empty', () => {
    window.localStorage.setItem(
      pocketBaseConnectionSettingsStorageKey,
      JSON.stringify({
        greenBean: {
          projectUrl: 'http://127.0.0.1:8091',
          publishableKey: 'local-access-green',
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
        source: 'pocketbase',
        status: 'empty',
        syncedAt: '2026-06-28T11:00:00.000Z',
        version: 1,
      }),
    );

    renderWithQuery(<SettingsPage />);

    expect(screen.queryByText('网络连接异常，请检查当前网络或 PocketBase 服务可达性。')).not.toBeInTheDocument();
    expect(screen.getAllByText('已连接').length).toBeGreaterThan(0);
  });

  it('shows connected status when local PocketBase config is present', () => {
    window.localStorage.setItem(
      beanCacheStorageKey,
      JSON.stringify({
        beans: [],
        errorCode: null,
        lastReadAt: '2026-06-28T11:00:00.000Z',
        source: 'pocketbase',
        status: 'empty',
        syncedAt: '2026-06-28T11:00:00.000Z',
        version: 1,
      }),
    );

    renderWithQuery(<SettingsPage />);

    expect(screen.getAllByText('已连接').length).toBeGreaterThan(0);
    expect(screen.getAllByText('已连接').length).toBeGreaterThan(0);
  });

  it('shows connection tags inside each database card and removes footer buttons', async () => {
    renderWithQuery(<SettingsPage />);

    const greenBeanSection = await expandSection('生豆 PocketBase');
    const roastedBeanSection = await expandSection('熟豆 PocketBase');

    expect(within(greenBeanSection).getByText('已连接')).toBeInTheDocument();
    expect(within(greenBeanSection).getByRole('button', { name: /完全同步/ })).not.toBeDisabled();
    expect(within(roastedBeanSection).getByText('已连接')).toBeInTheDocument();
    expect(
      within(roastedBeanSection).getByRole('button', { name: /复制熟豆 PocketBase 后台地址/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '保存设置' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '清空配置' })).not.toBeInTheDocument();
  });

  it('allows clearing the default cost template without removing the template', async () => {
    window.localStorage.setItem(
      costTemplateSettingsStorageKey,
      JSON.stringify({
        defaultTemplateId: 'template-default',
        templates: [
          {
            createdAt: '2026-07-07T10:00:00.000Z',
            dehydrationRate: 14,
            energyCost: 0,
            id: 'template-default',
            laborCost: 0,
            name: 'test-成本',
            notes: '',
            otherCost: 0,
            packagingCost: 0,
            roastInputWeightGrams: 200,
            saleUnitWeightGrams: 100,
            targetProfitRate: 30,
            updatedAt: '2026-07-07T10:00:00.000Z',
          },
        ],
        updatedAt: '2026-07-07T10:00:00.000Z',
      }),
    );

    renderWithQuery(<SettingsPage />);
    const section = await expandSection('成本模板');
    const templateCard = within(section).getByText('test-成本').closest('article');

    expect(templateCard).not.toBeNull();

    if (templateCard == null) {
      throw new Error('template card not found');
    }

    fireEvent.click(within(templateCard).getByRole('button', { name: '取消默认' }));

    await waitFor(() => {
      const storedValue = JSON.parse(window.localStorage.getItem(costTemplateSettingsStorageKey) ?? '{}') as {
        defaultTemplateId?: null | string;
      };

      expect(storedValue.defaultTemplateId).toBeNull();
    });

    expect(within(templateCard).queryByText('默认模板')).not.toBeInTheDocument();
    expect(within(templateCard).getByRole('button', { name: '设为默认' })).toBeInTheDocument();
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
