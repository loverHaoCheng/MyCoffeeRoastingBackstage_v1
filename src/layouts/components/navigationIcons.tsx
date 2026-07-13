import AccountBookFilled from '@ant-design/icons/AccountBookFilled';
import AccountBookOutlined from '@ant-design/icons/AccountBookOutlined';
import FireFilled from '@ant-design/icons/FireFilled';
import FireOutlined from '@ant-design/icons/FireOutlined';
import FundFilled from '@ant-design/icons/FundFilled';
import FundOutlined from '@ant-design/icons/FundOutlined';
import HddFilled from '@ant-design/icons/HddFilled';
import HddOutlined from '@ant-design/icons/HddOutlined';
import SettingOutlined from '@ant-design/icons/SettingOutlined';
import type { ReactNode } from 'react';

import type { AppRouteKey } from '@/router/navigation';

const outlinedIconByRoute: Record<AppRouteKey, ReactNode> = {
  bean: <HddOutlined />,
  finance: <AccountBookOutlined />,
  roast: <FundOutlined />,
  production: <FireOutlined />,
  settings: <SettingOutlined />,
};

const filledIconByRoute: Partial<Record<AppRouteKey, ReactNode>> = {
  bean: <HddFilled />,
  finance: <AccountBookFilled />,
  roast: <FundFilled />,
  production: <FireFilled />,
};

export function getNavigationIcon(routeKey: AppRouteKey, isActive: boolean): ReactNode {
  return isActive ? (filledIconByRoute[routeKey] ?? outlinedIconByRoute[routeKey]) : outlinedIconByRoute[routeKey];
}
