import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App as AntApp, ConfigProvider } from 'antd';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { beanQueryKeys, useUpdateBean } from '@/modules/bean/hooks';
import { beanService } from '@/modules/bean/services';
import type { GreenBeanUpdateInput } from '@/modules/bean/types';
import type { Bean } from '@/types/domain';

const initialBeans: Bean[] = [
  {
    agingDays: 14,
    code: 'GB-001',
    costPerKg: 90,
    createdAt: '2026-07-01T00:00:00.000Z',
    defaultRoastInputGrams: 200,
    defaultSaleUnitPrice: 48,
    defaultSaleUnitWeightGrams: 250,
    flavorTags: ['柑橘'],
    grade: 'G1',
    harvestSeason: '2025/26',
    id: 'bean-1',
    name: '测试豆一',
    origin: '埃塞俄比亚 · 古吉',
    process: '水洗',
    stockKg: 8,
    supplierName: '供应商 A',
    tastingEndDays: 40,
    updatedAt: '2026-07-01T00:00:00.000Z',
    variety: '74110',
  },
  {
    agingDays: 21,
    code: 'GB-002',
    costPerKg: 100,
    createdAt: '2026-07-02T00:00:00.000Z',
    defaultRoastInputGrams: 220,
    defaultSaleUnitPrice: 52,
    defaultSaleUnitWeightGrams: 250,
    flavorTags: ['莓果'],
    grade: 'A',
    harvestSeason: '2025/26',
    id: 'bean-2',
    name: '测试豆二',
    origin: '哥伦比亚 · 慧兰',
    process: '日晒',
    stockKg: 6,
    supplierName: '供应商 B',
    tastingEndDays: 45,
    updatedAt: '2026-07-02T00:00:00.000Z',
    variety: 'Caturra',
  },
];

const updateInput: GreenBeanUpdateInput = {
  agingDays: 18,
  altitudeMetersMax: null,
  altitudeMetersMin: null,
  code: 'GB-002',
  defaultRoastInputGrams: 220,
  defaultSaleUnitPrice: 52,
  defaultSaleUnitWeightGrams: 250,
  densityGPerL: null,
  displayName: '测试豆二',
  flavorTags: ['黑巧克力', '坚果'],
  grade: 'SHB',
  harvestSeason: '2025/26',
  millName: '',
  moisturePercent: null,
  notes: '',
  originArea: '',
  originCountry: '哥伦比亚',
  originRegion: '慧兰',
  processMethod: '日晒',
  purchaseDate: '2026-07-02',
  purchasedTotalPrice: 600,
  purchasedWeightGrams: 6000,
  remainingWeightGrams: 6000,
  supplierName: '供应商 B',
  tastingEndDays: 42,
  variety: 'Caturra',
};

function UpdateOrderHarness() {
  const updateBeanMutation = useUpdateBean();
  const { data: beans } = useQuery({
    initialData: initialBeans,
    queryKey: beanQueryKeys.list(),
    queryFn: () => Promise.resolve(initialBeans),
  });

  return (
    <>
      <div data-testid="bean-order">{beans.map((bean) => String(bean.id)).join(',')}</div>
      <button
        onClick={() => {
          updateBeanMutation.mutate({ beanId: 'bean-2', input: updateInput });
        }}
        type="button"
      >
        更新
      </button>
    </>
  );
}

describe('useUpdateBean', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps the original card order after updating a bean', async () => {
    const beanToUpdate = initialBeans[1];

    if (!beanToUpdate) {
      throw new Error('缺少测试用生豆数据');
    }

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    vi.spyOn(beanService, 'updateBean').mockResolvedValue({
      code: 0,
      data: {
        ...beanToUpdate,
        grade: 'SHB',
        updatedAt: '2026-07-06T00:00:00.000Z',
      },
      message: 'ok',
    });

    render(
      <ConfigProvider>
        <AntApp>
          <QueryClientProvider client={queryClient}>
            <UpdateOrderHarness />
          </QueryClientProvider>
        </AntApp>
      </ConfigProvider>,
    );

    expect(screen.getByTestId('bean-order')).toHaveTextContent('bean-1,bean-2');

    fireEvent.click(screen.getByRole('button', { name: '更新' }));

    await waitFor(() => {
      expect(screen.getByTestId('bean-order')).toHaveTextContent('bean-1,bean-2');
    });
  });
});
