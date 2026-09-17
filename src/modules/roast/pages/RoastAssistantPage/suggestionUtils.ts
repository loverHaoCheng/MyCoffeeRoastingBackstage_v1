import type { RoastConversationMode } from '../../services/roastConversation.service';

export const getSuggestions = (
  mode: RoastConversationMode,
  roastBatchId: string | undefined,
  activeBeanId: string | undefined,
): string[] => {
  const isGeneralMode = mode === 'general';

  if (isGeneralMode) {
    return ['一爆通常意味着什么？', '浅烘焙如何避免尖酸？', '如何判断豆子是否养好？'];
  }

  if (roastBatchId) {
    return ['这炉最需要调整什么？', '生成下一炉烘焙计划', '结合杯测继续分析'];
  }

  if (activeBeanId) {
    return ['建议做中浅烘还是中烘？', '生成一份手冲浅烘计划', '如何突出花香与果酸？'];
  }

  return ['如何判断 RoR 是否稳定？', '浅烘焙如何控制发展时间？', '帮我规划一炉手冲浅烘'];
};

export const getEmptyStateHint = (
  mode: RoastConversationMode,
  roastBatchId: string | undefined,
  activeBeanId: string | undefined,
): string => {
  const isGeneralMode = mode === 'general';

  if (isGeneralMode) {
    return '提问咖啡和咖啡烘焙的常识性问题。';
  }

  if (roastBatchId) {
    return '基于当前烘焙记录，分析曲线并生成改进计划。';
  }

  if (activeBeanId) {
    return '基于当前生豆，讨论烘焙目标并生成计划。';
  }

  return '提问烘焙技巧、分析历史曲线、生成优化计划。';
};

export const getComposerPlaceholder = (
  mode: RoastConversationMode,
  roastBatchId: string | undefined,
  activeBeanId: string | undefined,
): string => {
  const isGeneralMode = mode === 'general';

  if (isGeneralMode) {
    return '例如:浅烘焙一爆后 RoR 应如何控制？';
  }

  if (roastBatchId) {
    return '例如:请复盘这次曲线,并给出下一炉计划。';
  }

  if (activeBeanId) {
    return '例如:请根据这支豆子生成中浅烘计划。';
  }

  return '例如:浅烘焙一爆后 RoR 应如何控制?';
};
