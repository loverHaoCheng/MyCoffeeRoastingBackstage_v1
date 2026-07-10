import { fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ResponsiveMasonry } from '@/shared/components/ResponsiveMasonry';

const createRect = (width: number, height: number): DOMRect => {
  return new DOMRect(0, 0, width, height);
};

describe('ResponsiveMasonry', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps data order from left to right while placing each next card in the shortest column', () => {
    const { container } = render(
      <ResponsiveMasonry ariaLabel="测试瀑布流">
        <article>第一张</article>
        <article>第二张</article>
        <article>第三张</article>
      </ResponsiveMasonry>,
    );
    const masonry = container.querySelector<HTMLElement>('[aria-label="测试瀑布流"]');

    expect(masonry).not.toBeNull();

    if (!masonry) {
      throw new Error('masonry container not found');
    }

    const masonryItems = Array.from(masonry.querySelectorAll<HTMLElement>('[data-masonry-item="true"]'));
    const itemHeights = [100, 200, 80];

    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function getBoundingClientRect(this: HTMLElement) {
      if (this === masonry) {
        return createRect(700, 0);
      }

      const itemIndex = masonryItems.indexOf(this);

      return createRect(344, itemIndex >= 0 ? (itemHeights[itemIndex] ?? 0) : 0);
    });

    fireEvent(window, new Event('resize'));

    expect(masonry).toHaveAttribute('data-ready', 'true');
    expect(masonry.style.height).toBe('200px');
    expect(masonryItems[0]).toHaveStyle({ transform: 'translate3d(0px, 0px, 0)', width: '344px' });
    expect(masonryItems[1]).toHaveStyle({ transform: 'translate3d(356px, 0px, 0)', width: '344px' });
    expect(masonryItems[2]).toHaveStyle({ transform: 'translate3d(0px, 112px, 0)', width: '344px' });
  });
});
