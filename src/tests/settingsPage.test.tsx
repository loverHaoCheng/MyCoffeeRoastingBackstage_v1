import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { appBuildVersionService } from '@/app/services/appBuildVersion.service';
import { SettingsPage } from '@/modules/settings';
import { costTemplateSettingsService } from '@/modules/settings/services/costTemplateSettings.service';
import { pocketBaseConnectionSettingsService } from '@/modules/settings/services/pocketBaseConnectionSettings.service';
import { useSettingsStore } from '@/modules/settings/store';
import {
  createDefaultAppDisplaySettings,
  createDefaultCostTemplateSettings,
  createDefaultPocketBaseConnectionSettings,
} from '@/modules/settings/types';
import { renderWithQuery } from '@/tests/renderWithProviders';

const { syncLocalChangeMock } = vi.hoisted(() => ({
  syncLocalChangeMock: vi.fn().mockResolvedValue(undefined),
}));

const { verifyMock } = vi.hoisted(() => ({
  verifyMock: vi.fn().mockResolvedValue(undefined),
}));

const { syncFromRemoteSafelyMock } = vi.hoisted(() => ({
  syncFromRemoteSafelyMock: vi.fn().mockResolvedValue({
    greenBean: {
      projectUrl: 'http://81.70.224.75',
      publishableKey: '',
    },
    roastedBean: {
      projectUrl: '',
      publishableKey: '',
    },
    updatedAt: null,
  }),
}));

vi.mock(
  '@/modules/settings/services/roastedBeanSupabaseConnectionSync.service',
  async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/modules/settings/services/roastedBeanSupabaseConnectionSync.service')>();

    return {
      ...actual,
      roastedBeanSupabaseConnectionSyncService: {
        ...actual.roastedBeanSupabaseConnectionSyncService,
        syncFromRemoteSafely: syncFromRemoteSafelyMock,
        syncLocalChange: syncLocalChangeMock,
      },
    };
  },
);

vi.mock('@/modules/settings/services/pocketBaseConnectionProbe.service', () => ({
  pocketBaseConnectionProbeService: {
    verify: verifyMock,
  },
}));

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

const expandRoastedBeanConnectionCard = async (): Promise<HTMLElement> => {
  const card = screen.getByRole('heading', { name: '熟豆 Supabase 连接' }).closest('article');

  expect(card).not.toBeNull();

  if (card == null) {
    throw new Error('roasted bean connection card not found');
  }

  const expandButton = within(card).getByRole('button', { name: '展开' });
  fireEvent.click(expandButton);

  await waitFor(() => {
    expect(card.getAttribute('data-collapsed')).toBe('false');
  });

  return card;
};

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: vi.fn().mockReturnValue(true),
    });
    window.localStorage.clear();
    appBuildVersionService.clear();
    costTemplateSettingsService.clear();
    pocketBaseConnectionSettingsService.clear();
    syncLocalChangeMock.mockClear();
    syncLocalChangeMock.mockResolvedValue(undefined);
    verifyMock.mockClear();
    verifyMock.mockResolvedValue(undefined);
    syncFromRemoteSafelyMock.mockClear();
    syncFromRemoteSafelyMock.mockResolvedValue({
      greenBean: {
        projectUrl: 'http://81.70.224.75',
        publishableKey: '',
      },
      roastedBean: {
        projectUrl: '',
        publishableKey: '',
      },
      updatedAt: null,
    });
    useSettingsStore.setState({
      appDisplaySettings: createDefaultAppDisplaySettings(),
      costTemplateSettings: createDefaultCostTemplateSettings(),
      pocketBaseConnections: createDefaultPocketBaseConnectionSettings(),
    });
  });

  it('renders the roasted bean supabase connection card', async () => {
    renderWithQuery(<SettingsPage />);

    const card = screen.getByRole('heading', { name: '熟豆 Supabase 连接' }).closest('article');

    expect(card).not.toBeNull();

    if (card == null) {
      throw new Error('roasted bean card not found');
    }

    expect(await screen.findByRole('heading', { name: '熟豆 Supabase 连接' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '界面外观' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '成本模板' })).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: '展开' })).toBeInTheDocument();
    expect(card.getAttribute('data-collapsed')).toBe('true');
    expect(document.getElementById('roasted-bean-project-url')).toHaveValue('');
    expect(document.getElementById('roasted-bean-publishable-key')).toHaveValue('');
    expect(screen.getByText('未配置')).toBeInTheDocument();
  });

  it('renders the brew guide note and link in the roasted bean card', async () => {
    renderWithQuery(<SettingsPage />);

    const card = await expandRoastedBeanConnectionCard();
    const guideLink = within(card).getByRole('link', { name: '进一步了解...' });
    expect(within(card).getByRole('button', { name: /重新检测/ })).toBeInTheDocument();

    expect(within(card).getByText(/熟豆数据将会发送至 Brew Guide 中进行展示。/)).toBeInTheDocument();
    expect(guideLink).toHaveAttribute('href', 'https://chu3.top/brewguide');
    expect(guideLink).toHaveAttribute('target', '_blank');
  });

  it('syncs roasted bean supabase settings on blur and keeps cleared values', async () => {
    renderWithQuery(<SettingsPage />);
    await expandRoastedBeanConnectionCard();

    const projectUrlInput = document.getElementById('roasted-bean-project-url');

    expect(projectUrlInput).not.toBeNull();

    if (projectUrlInput == null) {
      throw new Error('roasted bean project url input not found');
    }

    fireEvent.change(projectUrlInput, { target: { value: '' } });
    fireEvent.blur(projectUrlInput);

    await waitFor(() => {
      expect(useSettingsStore.getState().pocketBaseConnections.roastedBean.projectUrl).toBe('');
    });

    expect(syncLocalChangeMock).not.toHaveBeenCalled();
    expect(screen.getByText('未配置')).toBeInTheDocument();
  });

  it('marks roasted bean supabase as connected after a verified save and syncs remote settings', async () => {
    renderWithQuery(<SettingsPage />);
    await expandRoastedBeanConnectionCard();

    const projectUrlInput = document.getElementById('roasted-bean-project-url');
    const publishableKeyInput = document.getElementById('roasted-bean-publishable-key');

    expect(projectUrlInput).not.toBeNull();
    expect(publishableKeyInput).not.toBeNull();

    if (projectUrlInput == null || publishableKeyInput == null) {
      throw new Error('roasted bean connection inputs not found');
    }

    fireEvent.change(projectUrlInput, { target: { value: 'https://roasted.example.com' } });
    fireEvent.change(publishableKeyInput, { target: { value: 'real-publishable-key' } });
    fireEvent.blur(publishableKeyInput);

    await waitFor(() => {
      expect(syncLocalChangeMock).toHaveBeenCalledWith({
        projectUrl: 'https://roasted.example.com',
        publishableKey: 'real-publishable-key',
      });
    });
    expect(syncLocalChangeMock).toHaveBeenCalledTimes(1);
    expect(verifyMock).toHaveBeenCalledTimes(1);

    expect(await screen.findByText('已连通')).toBeInTheDocument();
  });

  it('rehydrates roasted bean supabase settings from remote storage after refresh', async () => {
    syncFromRemoteSafelyMock.mockResolvedValueOnce({
      greenBean: {
        projectUrl: 'http://81.70.224.75',
        publishableKey: '',
      },
      roastedBean: {
        projectUrl: 'https://demo.supabase.co',
        publishableKey: 'sb_publishable_demo',
      },
      updatedAt: null,
    });

    renderWithQuery(<SettingsPage />);

    await waitFor(() => {
      expect(document.getElementById('roasted-bean-project-url')).toHaveValue('https://demo.supabase.co');
      expect(document.getElementById('roasted-bean-publishable-key')).toHaveValue('sb_publishable_demo');
    });

    expect(await screen.findByText('已连通')).toBeInTheDocument();
  });

  it('toggles the roasted bean connection card collapse button', async () => {
    renderWithQuery(<SettingsPage />);

    const card = screen.getByRole('heading', { name: '熟豆 Supabase 连接' }).closest('article');

    expect(card).not.toBeNull();

    if (card == null) {
      throw new Error('roasted bean card not found');
    }

    const collapseButton = within(card).getByRole('button', { name: '展开' });

    fireEvent.click(collapseButton);

    await waitFor(() => {
      expect(card.getAttribute('data-collapsed')).toBe('false');
    });

    expect(within(card).getByRole('button', { name: '收起' })).toBeInTheDocument();
  });

  it('loads and verifies roasted bean settings only once across settings page remounts in the same session', async () => {
    syncFromRemoteSafelyMock.mockResolvedValue({
      greenBean: {
        projectUrl: 'http://81.70.224.75',
        publishableKey: '',
      },
      roastedBean: {
        projectUrl: 'https://demo.supabase.co',
        publishableKey: 'sb_publishable_demo',
      },
      updatedAt: null,
    });

    const firstRender = renderWithQuery(<SettingsPage />);

    await waitFor(() => {
      expect(document.getElementById('roasted-bean-project-url')).toHaveValue('https://demo.supabase.co');
    });
    expect(await screen.findByText('已连通')).toBeInTheDocument();
    expect(syncFromRemoteSafelyMock).toHaveBeenCalledTimes(1);
    expect(verifyMock).toHaveBeenCalledTimes(1);

    firstRender.unmount();

    renderWithQuery(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '熟豆 Supabase 连接' })).toBeInTheDocument();
    });

    expect(syncFromRemoteSafelyMock).toHaveBeenCalledTimes(1);
    expect(verifyMock).toHaveBeenCalledTimes(1);
  });

  it('retries roasted bean connection verification on demand even when the current config is unchanged', async () => {
    syncFromRemoteSafelyMock.mockResolvedValue({
      greenBean: {
        projectUrl: 'http://81.70.224.75',
        publishableKey: '',
      },
      roastedBean: {
        projectUrl: 'https://demo.supabase.co',
        publishableKey: 'sb_publishable_demo',
      },
      updatedAt: null,
    });

    renderWithQuery(<SettingsPage />);

    await waitFor(() => {
      expect(verifyMock).toHaveBeenCalledTimes(1);
    });

    const card = await expandRoastedBeanConnectionCard();
    fireEvent.click(within(card).getByRole('button', { name: /重新检测/ }));

    await waitFor(() => {
      expect(verifyMock).toHaveBeenCalledTimes(2);
    });
  });

  it('copies the brew guide link in standalone pwa runtime', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);

    vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
      matches: query === '(display-mode: standalone)',
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: writeTextMock,
      },
    });

    renderWithQuery(<SettingsPage />);

    const card = await expandRoastedBeanConnectionCard();
    const guideLink = within(card).getByRole('link', { name: '进一步了解...' });

    fireEvent.click(guideLink);

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith('https://chu3.top/brewguide');
    });
    expect(await screen.findByText('已复制链接，可以到浏览器粘贴展示')).toBeInTheDocument();
  });

  it('falls back to execCommand copy in standalone pwa when clipboard api rejects', async () => {
    const writeTextMock = vi.fn().mockRejectedValue(new Error('clipboard denied'));
    const execCommandMock = vi.fn().mockReturnValue(true);

    vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
      matches: query === '(display-mode: standalone)',
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: writeTextMock,
      },
    });
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommandMock,
    });

    renderWithQuery(<SettingsPage />);

    const card = await expandRoastedBeanConnectionCard();
    const guideLink = within(card).getByRole('link', { name: '进一步了解...' });

    fireEvent.click(guideLink);

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith('https://chu3.top/brewguide');
      expect(execCommandMock).toHaveBeenCalledWith('copy');
    });
    expect(await screen.findByText('已复制链接，可以到浏览器粘贴展示')).toBeInTheDocument();
  });

  it('allows clearing the default cost template without removing the template', async () => {
    costTemplateSettingsService.save({
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
    });

    renderWithQuery(<SettingsPage />);
    const section = await expandSection('成本模板');
    const templateCard = within(section).getByText('test-成本').closest('article');

    expect(templateCard).not.toBeNull();

    if (templateCard == null) {
      throw new Error('template card not found');
    }

    fireEvent.click(within(templateCard).getByRole('button', { name: '取消默认' }));

    await waitFor(() => {
      expect(useSettingsStore.getState().costTemplateSettings.defaultTemplateId).toBeNull();
    });

    expect(within(templateCard).queryByText('默认模板')).not.toBeInTheDocument();
    expect(within(templateCard).getByRole('button', { name: '设为默认' })).toBeInTheDocument();
  });

  it('keeps the build version label in sync with runtime version updates', async () => {
    appBuildVersionService.save('0.1.0-initial');

    renderWithQuery(<SettingsPage />);

    expect(screen.getByText('当前 Web 上传版本：0.1.0-initial')).toBeInTheDocument();

    act(() => {
      appBuildVersionService.save('0.1.0-updated');
    });

    expect(await screen.findByText('当前 Web 上传版本：0.1.0-updated')).toBeInTheDocument();
  });
});
