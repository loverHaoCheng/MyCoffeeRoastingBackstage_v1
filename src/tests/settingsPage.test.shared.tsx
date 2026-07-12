import { fireEvent, screen, waitFor, within } from '@testing-library/react';

import { appBuildVersionService } from '@/app/services/appBuildVersion.service';
import { useAuthStore } from '@/modules/auth/store/useAuthStore';
import { costTemplateSettingsService } from '@/modules/settings/services/costTemplateSettings.service';
import { pocketBaseConnectionSettingsService } from '@/modules/settings/services/pocketBaseConnectionSettings.service';
import { useSettingsStore } from '@/modules/settings/store';
import {
  createDefaultAppDisplaySettings,
  createDefaultCostTemplateSettings,
  createDefaultPocketBaseConnectionSettings,
} from '@/modules/settings/types';

export const createMatchMediaStub = (matchesResolver?: (query: string) => boolean) => {
  return (query: string) => ({
    matches: matchesResolver?.(query) ?? false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  });
};

export const expandRoastedBeanConnectionCard = async (): Promise<HTMLElement> => {
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

export const resetSettingsPageTestState = (mocks: {
  loadQrCodeAssetMock: ReturnType<typeof vi.fn>;
  loadQrCodeFallbackAssetMock: ReturnType<typeof vi.fn>;
  syncFromRemoteSafelyMock: ReturnType<typeof vi.fn>;
  syncLocalChangeMock: ReturnType<typeof vi.fn>;
  verifyMock: ReturnType<typeof vi.fn>;
}) => {
  vi.mocked(window.matchMedia).mockImplementation(createMatchMediaStub());
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

  mocks.syncLocalChangeMock.mockClear();
  mocks.syncLocalChangeMock.mockResolvedValue(undefined);
  mocks.verifyMock.mockClear();
  mocks.verifyMock.mockResolvedValue(undefined);
  mocks.loadQrCodeAssetMock.mockClear();
  mocks.loadQrCodeAssetMock.mockResolvedValue({ default: 'author-code.webp' });
  mocks.loadQrCodeFallbackAssetMock.mockClear();
  mocks.loadQrCodeFallbackAssetMock.mockResolvedValue({ default: 'author-code.png' });
  mocks.syncFromRemoteSafelyMock.mockClear();
  mocks.syncFromRemoteSafelyMock.mockResolvedValue({
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
  useAuthStore.setState({
    hasHydrated: true,
    status: 'authenticated',
    user: {
      email: 'tester@example.com',
      id: 'test-user',
    },
  });
};
