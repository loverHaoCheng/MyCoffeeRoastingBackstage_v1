import { fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useMobileSwipeNavigation } from '@/layouts/hooks/useMobileSwipeNavigation';
import { appNavigationItems, type AppRouteKey } from '@/router/navigation';

const bottomNavItems = appNavigationItems.filter((item) => item.showInBottomNav !== false);

interface SwipeHarnessProps {
  isMobileSettingsOpen?: boolean;
  selectedKey: AppRouteKey;
}

const navigateByKeyMock = vi.fn();
const openSettingsMock = vi.fn();
const closeSettingsMock = vi.fn();

function SwipeHarness({ isMobileSettingsOpen = false, selectedKey }: SwipeHarnessProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useMobileSwipeNavigation({
    bottomNavItems,
    containerRef,
    enabled: true,
    isMobileSettingsOpen,
    navigateByKey: navigateByKeyMock,
    onCloseSettings: closeSettingsMock,
    onOpenSettings: openSettingsMock,
    selectedKey,
  });

  return (
    <div data-testid="swipe-container" ref={containerRef}>
      <div data-testid="content">内容区</div>
      <input aria-label="可编辑字段" />
      <div data-testid="horizontal-scroll" style={{ overflowX: 'auto' }}>
        横向列表
      </div>
    </div>
  );
}

const fireSwipe = (target: Element, startX: number, endX: number, startY = 40, endY = 44) => {
  fireEvent.touchStart(target, {
    touches: [{ clientX: startX, clientY: startY }],
  });
  fireEvent.touchMove(target, {
    cancelable: true,
    touches: [{ clientX: endX, clientY: endY }],
  });
  fireEvent.touchEnd(target, {
    changedTouches: [{ clientX: endX, clientY: endY }],
  });
};

describe('useMobileSwipeNavigation', () => {
  beforeEach(() => {
    navigateByKeyMock.mockReset();
    openSettingsMock.mockReset();
    closeSettingsMock.mockReset();
  });

  it('swipes from left to right to navigate to the previous bottom menu item', () => {
    render(<SwipeHarness selectedKey="roast" />);

    fireSwipe(screen.getByTestId('content'), 40, 128);

    expect(navigateByKeyMock).toHaveBeenCalledWith('bean');
    expect(openSettingsMock).not.toHaveBeenCalled();
  });

  it('swipes from left to right on the leftmost menu item to open settings', () => {
    render(<SwipeHarness selectedKey="bean" />);

    fireSwipe(screen.getByTestId('content'), 40, 128);

    expect(openSettingsMock).toHaveBeenCalledTimes(1);
    expect(navigateByKeyMock).not.toHaveBeenCalled();
  });

  it('ignores left-to-right swipes while settings is already open', () => {
    render(<SwipeHarness isMobileSettingsOpen selectedKey="bean" />);

    fireSwipe(screen.getByTestId('content'), 40, 128);

    expect(openSettingsMock).not.toHaveBeenCalled();
    expect(closeSettingsMock).not.toHaveBeenCalled();
    expect(navigateByKeyMock).not.toHaveBeenCalled();
  });

  it('swipes from right to left to navigate to the next bottom menu item', () => {
    render(<SwipeHarness selectedKey="roast" />);

    fireSwipe(screen.getByTestId('content'), 140, 40);

    expect(navigateByKeyMock).toHaveBeenCalledWith('production');
    expect(closeSettingsMock).not.toHaveBeenCalled();
  });

  it('swipes from right to left to close settings when the settings panel is open', () => {
    render(<SwipeHarness isMobileSettingsOpen selectedKey="bean" />);

    fireSwipe(screen.getByTestId('content'), 140, 40);

    expect(closeSettingsMock).toHaveBeenCalledTimes(1);
    expect(navigateByKeyMock).not.toHaveBeenCalled();
  });

  it('does not take over interactive fields or horizontal scroll regions', () => {
    render(<SwipeHarness selectedKey="roast" />);

    fireSwipe(screen.getByLabelText('可编辑字段'), 40, 128);

    const horizontalScroll = screen.getByTestId('horizontal-scroll');
    Object.defineProperty(horizontalScroll, 'clientWidth', {
      configurable: true,
      value: 100,
    });
    Object.defineProperty(horizontalScroll, 'scrollWidth', {
      configurable: true,
      value: 220,
    });

    fireSwipe(horizontalScroll, 40, 128);

    expect(navigateByKeyMock).not.toHaveBeenCalled();
    expect(openSettingsMock).not.toHaveBeenCalled();
    expect(closeSettingsMock).not.toHaveBeenCalled();
  });
});
