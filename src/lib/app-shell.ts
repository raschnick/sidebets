import { useOutletContext } from 'react-router-dom';
import type { AppBootstrap } from './types.js';

export type AppShellContext = {
  bootstrap: AppBootstrap;
  refreshBootstrap: () => Promise<void>;
};

export function useAppShell() {
  return useOutletContext<AppShellContext>();
}
