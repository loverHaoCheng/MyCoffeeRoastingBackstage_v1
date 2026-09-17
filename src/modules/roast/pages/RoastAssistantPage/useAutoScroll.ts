import { useEffect, useRef } from 'react';

export const useAutoScroll = (
  messagesLength: number,
  hasPendingMessage: boolean,
  isSending: boolean,
  streamingAnswer: string,
) => {
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const shouldFollowLatestRef = useRef(true);
  const isProgrammaticScrollRef = useRef(false);

  useEffect(() => {
    const messagesElement = messagesRef.current;
    if (!messagesElement) return undefined;

    const handleScroll = () => {
      if (isProgrammaticScrollRef.current) return;
      const isAtLatest = messagesElement.scrollTop + messagesElement.clientHeight >= messagesElement.scrollHeight - 2;
      shouldFollowLatestRef.current = isAtLatest;
    };

    messagesElement.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      messagesElement.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    if (!shouldFollowLatestRef.current) return undefined;
    const messagesElement = messagesRef.current;
    const animationFrameId = window.requestAnimationFrame(() => {
      if (!messagesElement) return;
      isProgrammaticScrollRef.current = true;
      messagesElement.scrollTo({ behavior: 'auto', top: messagesElement.scrollHeight });
      window.requestAnimationFrame(() => {
        isProgrammaticScrollRef.current = false;
      });
    });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [messagesLength, hasPendingMessage, isSending, streamingAnswer]);

  return { messagesRef, shouldFollowLatestRef };
};
