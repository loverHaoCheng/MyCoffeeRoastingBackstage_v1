import { useContext, useEffect, createElement } from 'react';
import PlusOutlined from '@ant-design/icons/PlusOutlined';
import HistoryOutlined from '@ant-design/icons/HistoryOutlined';
import { HeaderActionRegistrationContext } from '@/shared/components/ViewportFloatingActionButton.context';

export const useHeaderActions = (
  startNewConversation: () => void,
  openConversationHistory: () => void,
) => {
  const headerActionRegistration = useContext(HeaderActionRegistrationContext);

  useEffect(() => {
    if (!headerActionRegistration) {
      return;
    }

    return headerActionRegistration.register([
      { ariaLabel: '新建对话', icon: createElement(PlusOutlined), onClick: startNewConversation },
      { ariaLabel: '历史对话', icon: createElement(HistoryOutlined), onClick: openConversationHistory },
    ]);
  }, [headerActionRegistration, openConversationHistory, startNewConversation]);
};
