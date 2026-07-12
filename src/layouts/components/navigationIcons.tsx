import CalculatorOutlined from '@ant-design/icons/CalculatorOutlined';
import DatabaseOutlined from '@ant-design/icons/DatabaseOutlined';
import FireOutlined from '@ant-design/icons/FireOutlined';
import FundOutlined from '@ant-design/icons/FundOutlined';
import SettingOutlined from '@ant-design/icons/SettingOutlined';
import type { ReactNode } from 'react';

import type { AppRouteKey } from '@/router/navigation';

export const iconByRoute: Record<AppRouteKey, ReactNode> = {
  bean: <DatabaseOutlined />,
  finance: <CalculatorOutlined />,
  roast: <FundOutlined />,
  production: <FireOutlined />,
  settings: <SettingOutlined />,
};
