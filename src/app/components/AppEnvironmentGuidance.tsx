import { App, Typography } from 'antd';
import { type ReactNode, useEffect } from 'react';

import {
  resolveEnvironmentGuidance,
  type EnvironmentGuidanceType,
} from '@/app/services/environmentGuidance.service';
import {
  hasShownEnvironmentGuidance,
  markEnvironmentGuidanceAsShown,
} from '@/app/services/environmentGuidanceSession.service';

const { Paragraph, Text } = Typography;

const createGuidanceContent = (
  guidanceType: EnvironmentGuidanceType,
): {
  content: ReactNode;
  title: string;
} => {
  if (guidanceType === 'wechat-system-browser') {
    return {
      title: '请到系统浏览器访问',
      content: (
        <>
          <Paragraph>
            微信内置浏览器可能影响登录、邮箱验证和页面稳定性，建议切换到系统浏览器继续使用。
          </Paragraph>
          <Paragraph>
            <Text strong>操作指引</Text>
          </Paragraph>
          <Paragraph>1. 点击右上角菜单按钮。</Paragraph>
          <Paragraph>2. 选择“在系统浏览器打开”。</Paragraph>
          <Paragraph>3. 打开后再继续注册、登录或验证邮件。</Paragraph>
        </>
      ),
    };
  }

  return {
    title: '建议添加到主屏幕',
    content: (
      <>
        <Paragraph>
          你当前正在 iPhone 的 Safari 浏览器中访问，添加到主屏幕后，打开会更稳定，也更像原生应用。
        </Paragraph>
        <Paragraph>
          <Text strong>操作指引</Text>
        </Paragraph>
        <Paragraph>1. 点击底部“分享”按钮。</Paragraph>
        <Paragraph>2. 选择“添加到主屏幕”。</Paragraph>
        <Paragraph>3. 之后从桌面的 EasyBake 图标进入。</Paragraph>
      </>
    ),
  };
};

export function AppEnvironmentGuidance() {
  const { modal } = App.useApp();

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (hasShownEnvironmentGuidance()) {
      return;
    }

    const guidanceType = resolveEnvironmentGuidance(window);

    if (!guidanceType) {
      return;
    }

    markEnvironmentGuidanceAsShown();

    const { content, title } = createGuidanceContent(guidanceType);
    const modalInstance = modal.info({
      centered: true,
      content,
      maskClosable: true,
      okText: '我知道了',
      title,
      width: 420,
    });

    return () => {
      modalInstance.destroy();
    };
  }, [modal]);

  return null;
}
