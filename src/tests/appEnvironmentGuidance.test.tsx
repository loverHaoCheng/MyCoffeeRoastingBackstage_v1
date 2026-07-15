import { cleanup, render, screen } from '@testing-library/react';
import { App as AntApp, ConfigProvider } from 'antd';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppEnvironmentGuidance } from '@/app/components/AppEnvironmentGuidance';
import { resetEnvironmentGuidanceDisplayForTest } from '@/app/services/environmentGuidanceSession.service';
import { createMatchMediaStub } from '@/tests/settingsPage.test.shared';

const renderGuidance = () => {
  return render(
    <ConfigProvider>
      <AntApp>
        <AppEnvironmentGuidance />
      </AntApp>
    </ConfigProvider>,
  );
};

describe('AppEnvironmentGuidance', () => {
  beforeEach(() => {
    resetEnvironmentGuidanceDisplayForTest();
    vi.mocked(window.matchMedia).mockImplementation(createMatchMediaStub());
    Object.defineProperty(window.navigator, 'standalone', {
      configurable: true,
      value: false,
    });
  });

  afterEach(() => {
    cleanup();
    resetEnvironmentGuidanceDisplayForTest();
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0',
    });
    Object.defineProperty(window.navigator, 'standalone', {
      configurable: true,
      value: undefined,
    });
  });

  it('shows the system browser guidance in WeChat', async () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.58',
    });

    renderGuidance();

    expect(
      await screen.findByText(
        '微信内置浏览器可能影响登录、邮箱验证和页面稳定性，建议切换到系统浏览器继续使用。',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('2. 选择“在系统浏览器打开”。'),
    ).toBeInTheDocument();
  });

  it('shows the pwa guidance only in iPhone Safari', async () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
    });

    renderGuidance();

    expect(
      await screen.findByText(
        '你当前正在 iPhone 的 Safari 浏览器中访问，添加到主屏幕后，打开会更稳定，也更像原生应用。',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('2. 选择“添加到主屏幕”。')).toBeInTheDocument();
  });

  it('does not show the pwa guidance inside WeChat on iPhone', async () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.58',
    });

    renderGuidance();

    expect(
      await screen.findByText(
        '微信内置浏览器可能影响登录、邮箱验证和页面稳定性，建议切换到系统浏览器继续使用。',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        '你当前正在 iPhone 的 Safari 浏览器中访问，添加到主屏幕后，打开会更稳定，也更像原生应用。',
      ),
    ).not.toBeInTheDocument();
  });

  it('does not show the pwa guidance when already running as standalone pwa', () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
    });
    vi.mocked(window.matchMedia).mockImplementation(
      createMatchMediaStub((query) => query === '(display-mode: standalone)'),
    );

    renderGuidance();

    expect(
      screen.queryByText(
        '你当前正在 iPhone 的 Safari 浏览器中访问，添加到主屏幕后，打开会更稳定，也更像原生应用。',
      ),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        '微信内置浏览器可能影响登录、邮箱验证和页面稳定性，建议切换到系统浏览器继续使用。',
      ),
    ).not.toBeInTheDocument();
  });
});
