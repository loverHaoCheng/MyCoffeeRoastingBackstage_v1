import { createContext, useContext } from 'react';
import type { RefObject } from 'react';

export const ViewportScrollContext = createContext<null | RefObject<HTMLDivElement | null>>(null);

export const useViewportScrollContainer = () => {
  return useContext(ViewportScrollContext);
};
