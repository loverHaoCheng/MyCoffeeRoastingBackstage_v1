import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { appBuildVersionService } from '@/app/services/appBuildVersion.service';
import { SettingsPage } from '@/modules/settings';
import { useSettingsStore } from '@/modules/settings/store';
import { renderWithQuery } from '@/tests/renderWithProviders';
import {
  createMatchMediaStub,
  expandRoastedBeanConnectionCard,
  resetSettingsPageTestState,
} from '@/tests/settingsPage.test.shared';

const { syncLocalChangeMock } = vi.hoisted(() => ({
  syncLocalChangeMock: vi.fn().mockResolvedValue(undefined),
}));

const { verifyMock } = vi.hoisted(() => ({
  verifyMock: vi.fn().mockResolvedValue(undefined),
}));

const { loadQrCodeAssetMock } = vi.hoisted(() => ({
  loadQrCodeAssetMock: vi.fn().mockResolvedValue({ default: 'author-code.webp' }),
}));

const { loadQrCodeFallbackAssetMock } = vi.hoisted(() => ({
  loadQrCodeFallbackAssetMock: vi.fn().mockResolvedValue({ default: 'author-code.png' }),
}));

const {
  createBackupMock,
  downloadBackupMock,
  getImportModeMock,
  importBackupMock,
  readBackupFileMock,
} = vi.hoisted(() => ({
  createBackupMock: vi.fn(),
  downloadBackupMock: vi.fn(),
  getImportModeMock: vi.fn(),
  importBackupMock: vi.fn(),
  readBackupFileMock: vi.fn(),
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

vi.mock('@/modules/settings/services/qrCodeAsset.service', () => ({
  loadQrCodeAsset: loadQrCodeAssetMock,
  loadQrCodeFallbackAsset: loadQrCodeFallbackAssetMock,
}));

vi.mock('@/modules/settings/services/userDataBackup.service', () => ({
  userDataBackupService: {
    createBackup: createBackupMock,
    downloadBackup: downloadBackupMock,
    getImportMode: getImportModeMock,
    importBackup: importBackupMock,
    readBackupFile: readBackupFileMock,
  },
}));

describe('SettingsPage', () => {
  beforeEach(() => {
    resetSettingsPageTestState({
      loadQrCodeAssetMock,
      loadQrCodeFallbackAssetMock,
      syncFromRemoteSafelyMock,
      syncLocalChangeMock,
      verifyMock,
    });

    const backup = {
      collections: {
        green_beans: [{ id: 'bean-1', name: 'Guji' }],
      },
      exportedAt: '2026-07-15T08:00:00.000Z',
      schema: 'easybake.user-data-backup',
      summary: {
        green_beans: 1,
      },
      version: 1,
    };

    createBackupMock.mockResolvedValue(backup);
    downloadBackupMock.mockReturnValue(undefined);
    getImportModeMock.mockReturnValue('merge-account');
    importBackupMock.mockResolvedValue({
      deleted: 0,
      imported: 1,
      skipped: 0,
      updated: 0,
    });
    readBackupFileMock.mockResolvedValue(backup);
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

  it('keeps the settings accordion in single-open mode', async () => {
    renderWithQuery(<SettingsPage />);

    const roastedBeanCard = screen.getByRole('heading', { name: '熟豆 Supabase 连接' }).closest('article');
    const appearanceCard = screen.getByRole('heading', { name: '界面外观' }).closest('section');

    expect(roastedBeanCard).not.toBeNull();
    expect(appearanceCard).not.toBeNull();

    if (roastedBeanCard == null || appearanceCard == null) {
      throw new Error('settings accordion items not found');
    }

    fireEvent.click(within(roastedBeanCard).getByRole('button', { name: '展开' }));

    await waitFor(() => {
      expect(roastedBeanCard.getAttribute('data-collapsed')).toBe('false');
    });

    fireEvent.click(within(appearanceCard).getByRole('button', { name: '展开' }));

    await waitFor(() => {
      expect(appearanceCard.getAttribute('data-collapsed')).toBe('false');
      expect(roastedBeanCard.getAttribute('data-collapsed')).toBe('true');
    });
  });

  it('loads a QR code only after it is opened and reuses it after reopening', async () => {
    renderWithQuery(<SettingsPage />);

    const authorButton = screen.getByRole('button', { name: '和作者交流一下' });

    expect(screen.queryByRole('img', { name: '作者交流二维码' })).not.toBeInTheDocument();

    fireEvent.click(authorButton);

    const firstImage = await screen.findByRole('img', { name: '作者交流二维码' });
    const firstSource = firstImage.getAttribute('src');

    expect(authorButton).toHaveAttribute('aria-pressed', 'true');
    expect(firstSource).toContain('author-code');

    fireEvent.click(authorButton);

    await waitFor(() => {
      expect(screen.queryByRole('img', { name: '作者交流二维码' })).not.toBeInTheDocument();
    });

    fireEvent.click(authorButton);

    expect(await screen.findByRole('img', { name: '作者交流二维码' })).toHaveAttribute('src', firstSource);
    expect(loadQrCodeAssetMock).toHaveBeenCalledTimes(1);
  });

  it('shows the remotely managed community QR code beside the author exchange action', async () => {
    renderWithQuery(<SettingsPage />);

    fireEvent.click(screen.getByRole('button', { name: '进群交流 bugs' }));

    expect(await screen.findByRole('img', { name: '进群交流 bugs 二维码' })).toBeInTheDocument();
    expect(loadQrCodeAssetMock).toHaveBeenCalledWith('community');
  });

  it('renders the staged AI release guidance section', async () => {
    renderWithQuery(<SettingsPage />);

    const heading = await screen.findByRole('heading', { name: 'AI 烘焙能力（筹备中）' });
    const trigger = heading.closest('section')?.querySelector('button');

    expect(heading).toBeInTheDocument();
    expect(trigger).toBeDisabled();
    expect(screen.getByText('当前版本先公开入口、规则和数据准备要求。AI 推荐与训练上传会在后续阶段逐步开放。')).toBeInTheDocument();
    expect(screen.queryByText('已正式开放')).not.toBeInTheDocument();
    expect(screen.queryByText('已公开但暂禁用')).not.toBeInTheDocument();
    expect(screen.queryByText('开放前要求')).not.toBeInTheDocument();
    expect(screen.queryByText(/训练授权默认关闭/)).not.toBeInTheDocument();
    expect(screen.queryByText(/训练上传正式开放后/)).not.toBeInTheDocument();
  });

  it('renders account backup actions in the settings footer', async () => {
    renderWithQuery(<SettingsPage />);

    expect(await screen.findByRole('button', { name: /主动备份/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /主动上传/ })).toBeInTheDocument();
  });

  it('downloads the current account data backup on demand', async () => {
    renderWithQuery(<SettingsPage />);

    fireEvent.click(await screen.findByRole('button', { name: /主动备份/ }));

    await waitFor(() => {
      expect(createBackupMock).toHaveBeenCalledTimes(1);
      expect(downloadBackupMock).toHaveBeenCalledWith(expect.objectContaining({
        schema: 'easybake.user-data-backup',
      }));
    });
  });

  it('imports a backup file into the current account after confirmation', async () => {
    renderWithQuery(<SettingsPage />);

    fireEvent.change(await screen.findByLabelText('选择备份文件'), {
      target: {
        files: [new File(['{}'], 'easybake-backup.json', { type: 'application/json' })],
      },
    });

    expect(await screen.findAllByText('上传备份到当前账号？')).not.toHaveLength(0);
    expect(screen.getByText('跨账号备份会为所有记录重新分配 ID 后新增到当前账号。生豆编号或名称相同也会保留各自数据，不会删除当前账号已有数据。')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '合并导入备份' }));

    await waitFor(() => {
      expect(readBackupFileMock).toHaveBeenCalledTimes(1);
      expect(importBackupMock).toHaveBeenCalledWith(expect.objectContaining({
        schema: 'easybake.user-data-backup',
      }), {
        strategy: 'merge',
      });
    });
  });

  it('lets same-account backup imports choose a full sync strategy', async () => {
    getImportModeMock.mockReturnValue('same-account');
    renderWithQuery(<SettingsPage />);

    fireEvent.change(await screen.findByLabelText('选择备份文件'), {
      target: {
        files: [new File(['{}'], 'easybake-backup.json', { type: 'application/json' })],
      },
    });

    expect(await screen.findByText('选择备份上传方式')).toBeInTheDocument();
    fireEvent.click(screen.getByText('完全与备份同步'));
    fireEvent.click(screen.getByRole('button', { name: '完全同步备份' }));

    await waitFor(() => {
      expect(importBackupMock).toHaveBeenCalledWith(expect.objectContaining({
        schema: 'easybake.user-data-backup',
      }), {
        strategy: 'sync',
      });
    });
  });

  it('shows a retry action when a QR code fails to load', async () => {
    loadQrCodeAssetMock
      .mockRejectedValueOnce(new Error('asset unavailable'))
      .mockResolvedValueOnce({ default: 'author-code.webp' });

    renderWithQuery(<SettingsPage />);

    fireEvent.click(screen.getByRole('button', { name: '和作者交流一下' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('二维码加载失败，请重试。');

    fireEvent.click(screen.getByRole('button', { name: '重新加载二维码' }));

    expect(await screen.findByRole('img', { name: '作者交流二维码' })).toHaveAttribute('src', 'author-code.webp');
    expect(loadQrCodeAssetMock).toHaveBeenCalledTimes(2);
  });

  it('falls back to the PNG asset when the WebP QR code cannot be decoded', async () => {
    renderWithQuery(<SettingsPage />);

    fireEvent.click(screen.getByRole('button', { name: '和作者交流一下' }));

    const qrImage = await screen.findByRole('img', { name: '作者交流二维码' });
    fireEvent.error(qrImage);

    await waitFor(() => {
      expect(loadQrCodeFallbackAssetMock).toHaveBeenCalledWith('author');
    });

    expect(await screen.findByRole('img', { name: '作者交流二维码' })).toHaveAttribute('src', 'author-code.png');
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

    vi.mocked(window.matchMedia).mockImplementation(
      createMatchMediaStub((query) => query === '(display-mode: standalone)'),
    );
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

    vi.mocked(window.matchMedia).mockImplementation(
      createMatchMediaStub((query) => query === '(display-mode: standalone)'),
    );
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

  it('keeps the build version label in sync with runtime version updates', async () => {
    appBuildVersionService.save('01020260715162823');

    renderWithQuery(<SettingsPage />);

    const buildVersion = screen.getByText('当前 Web 上传版本：01020260715162823');
    const deleteButtonLabel = screen.getByText('注销账号');
    const deleteButton = deleteButtonLabel.closest('button');

    expect(buildVersion).toBeInTheDocument();
    expect(deleteButton).not.toBeNull();

    if (deleteButton != null) {
      expect(deleteButton).toBeEnabled();
      expect(deleteButton.compareDocumentPosition(buildVersion)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    }

    act(() => {
      appBuildVersionService.save('01020260715164000');
    });

    expect(await screen.findByText('当前 Web 上传版本：01020260715164000')).toBeInTheDocument();
  });

  it('opens the account deletion confirmation when clicking the enabled danger button', async () => {
    renderWithQuery(<SettingsPage />);

    const deleteButtonLabel = await screen.findByText('注销账号');
    const deleteButton = deleteButtonLabel.closest('button');

    expect(deleteButton).not.toBeNull();

    if (deleteButton == null) {
      throw new Error('delete account button not found');
    }

    expect(deleteButton).toBeEnabled();
    fireEvent.click(deleteButton);
    expect(await screen.findAllByText('确认注销账号？')).not.toHaveLength(0);
    expect(screen.getByRole('button', { name: /确认注销（5s）/ })).toBeDisabled();
  });
});
