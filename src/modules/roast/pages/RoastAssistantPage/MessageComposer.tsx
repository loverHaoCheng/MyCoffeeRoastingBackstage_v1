import ArrowUpOutlined from '@ant-design/icons/ArrowUpOutlined';
import { Button, Input } from 'antd';
import type { PointerEvent } from 'react';

import styles from '../RoastAssistantPage.module.css';

const { TextArea } = Input;

interface MessageComposerProps {
  content: string;
  disabled: boolean;
  onBlur: () => void;
  onChange: (value: string) => void;
  onFocus: () => void;
  onSend: () => void;
  onTouchSend: (event: PointerEvent<HTMLButtonElement>) => void;
  placeholder: string;
}

export function MessageComposer({
  content,
  disabled,
  onBlur,
  onChange,
  onFocus,
  onSend,
  onTouchSend,
  placeholder,
}: MessageComposerProps) {
  return (
    <form
      className={styles.composer}
      data-skip-mobile-keyboard-recenter="true"
      onSubmit={(event) => {
        event.preventDefault();
        onSend();
      }}
    >
      <TextArea
        aria-label="AI 对话输入框"
        autoSize={{ maxRows: 5, minRows: 2 }}
        disabled={disabled}
        maxLength={2000}
        onBlur={onBlur}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        onFocus={onFocus}
        placeholder={placeholder}
        value={content}
      />
      <Button
        aria-label="发送问题"
        disabled={disabled || !content.trim()}
        htmlType="submit"
        icon={<ArrowUpOutlined />}
        loading={disabled}
        onPointerDown={onTouchSend}
        shape="circle"
        type="primary"
      />
    </form>
  );
}
