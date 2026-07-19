import { fireEvent, render, screen } from '@testing-library/react';
import { createElement, useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveRecenteredScrollTop, useMobileKeyboardViewportFocus } from '@/layouts/hooks/useMobileKeyboardViewportFocus';

const MOBILE_EDITING_ATTRIBUTE = 'data-app-mobile-editing';

const createDomRect = (top: number, height: number) => {
  return {
    bottom: top + height,
    height,
    left: 0,
    right: 360,
    toJSON: () => undefined,
    top,
    width: 360,
    x: 0,
    y: top,
  } as DOMRect;
};

function KeyboardFocusFixture() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useMobileKeyboardViewportFocus({
    enabled: true,
    fallbackContainerRef: containerRef,
  });

  return createElement(
    'div',
    { 'data-app-scroll-viewport': 'true', ref: containerRef },
    createElement(
      'label',
      { 'data-field-path': 'notes' },
      createElement('span', null, '备注'),
      createElement('input', { 'aria-label': '备注' }),
    ),
    createElement('footer', { 'data-drawer-action-bar': 'true' }),
  );
}

describe('resolveRecenteredScrollTop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.documentElement.removeAttribute(MOBILE_EDITING_ATTRIBUTE);

    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 800,
      writable: true,
    });

    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      return window.setTimeout(() => {
        callback(performance.now());
      }, 0);
    });
    vi.stubGlobal('cancelAnimationFrame', (handle: number) => {
      window.clearTimeout(handle);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.documentElement.removeAttribute(MOBILE_EDITING_ATTRIBUTE);
  });

  it('returns a larger scrollTop when the focused field is below the visible center', () => {
    expect(
      resolveRecenteredScrollTop({
        currentScrollTop: 120,
        maxScrollTop: 800,
        targetBottom: 540,
        targetTop: 500,
        visibleBottom: 420,
        visibleTop: 120,
      }),
    ).toBe(370);
  });

  it('returns a smaller scrollTop when the focused field is above the visible center', () => {
    expect(
      resolveRecenteredScrollTop({
        currentScrollTop: 240,
        maxScrollTop: 800,
        targetBottom: 180,
        targetTop: 140,
        visibleBottom: 520,
        visibleTop: 220,
      }),
    ).toBe(30);
  });

  it('clamps the next scrollTop into the scrollable range', () => {
    expect(
      resolveRecenteredScrollTop({
        currentScrollTop: 760,
        maxScrollTop: 800,
        targetBottom: 900,
        targetTop: 860,
        visibleBottom: 420,
        visibleTop: 120,
      }),
    ).toBe(800);
  });

  it('returns null when the field is already close to the visible center', () => {
    expect(
      resolveRecenteredScrollTop({
        currentScrollTop: 200,
        maxScrollTop: 800,
        targetBottom: 326,
        targetTop: 286,
        visibleBottom: 420,
        visibleTop: 200,
      }),
    ).toBeNull();
  });

  it('hides action bars while editing and recenters the last focused field after keyboard closes', () => {
    const visualViewportMock = {
      addEventListener: vi.fn(),
      height: 420,
      offsetTop: 0,
      removeEventListener: vi.fn(),
      scrollTop: 0,
      width: 360,
    };

    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: visualViewportMock,
    });

    render(createElement(KeyboardFocusFixture));

    const container = screen.getByRole('textbox', { name: '备注' }).closest('[data-app-scroll-viewport="true"]');
    const field = screen.getByRole('textbox', { name: '备注' }).closest('[data-field-path="notes"]');
    const input = screen.getByRole('textbox', { name: '备注' });
    const footer = document.querySelector('[data-drawer-action-bar="true"]');

    if (!container || !field || !footer) {
      throw new Error('keyboard focus test fixture is incomplete');
    }
    const scrollToMock = vi.fn(({ top }: { top: number }) => {
      container.scrollTop = top;
    });

    Object.defineProperty(container, 'clientHeight', {
      configurable: true,
      value: 640,
    });
    Object.defineProperty(container, 'scrollHeight', {
      configurable: true,
      value: 1400,
    });
    Object.defineProperty(container, 'scrollTop', {
      configurable: true,
      value: 120,
      writable: true,
    });
    Object.defineProperty(container, 'scrollTo', {
      configurable: true,
      value: scrollToMock,
    });

    const fieldContentTop = 620;

    container.getBoundingClientRect = () => createDomRect(0, 640);
    field.getBoundingClientRect = () => createDomRect(fieldContentTop - container.scrollTop, 44);
    footer.getBoundingClientRect = () => createDomRect(560, 60);

    input.focus();
    fireEvent.focusIn(input);
    vi.runAllTimers();

    expect(document.documentElement).toHaveAttribute(MOBILE_EDITING_ATTRIBUTE, 'true');
    expect(scrollToMock).toHaveBeenCalled();

    const initialCallCount = scrollToMock.mock.calls.length;

    input.blur();
    fireEvent.focusOut(input);
    vi.runAllTimers();

    visualViewportMock.height = 800;
    window.dispatchEvent(new Event('resize'));
    vi.runAllTimers();

    expect(document.documentElement).not.toHaveAttribute(MOBILE_EDITING_ATTRIBUTE);
    expect(scrollToMock.mock.calls.length).toBeGreaterThan(initialCallCount);
  });
});
