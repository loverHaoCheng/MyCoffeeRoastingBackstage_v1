import { useEffect } from 'react';

export const useComposerFocusEffect = (isComposerFocused: boolean) => {
  useEffect(() => {
    if (isComposerFocused) {
      document.documentElement.setAttribute('data-composer-focused', 'true');
    } else {
      document.documentElement.removeAttribute('data-composer-focused');
    }

    return () => {
      document.documentElement.removeAttribute('data-composer-focused');
    };
  }, [isComposerFocused]);
};
