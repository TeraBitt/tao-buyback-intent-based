import type { WalletType } from '../types';

export interface EthereumProviderLike {
  request: (args: { method: string; params?: unknown[] | Record<string, unknown>[] }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
  isTalisman?: boolean;
  providers?: EthereumProviderLike[];
}

declare global {
  interface Window {
    ethereum?: EthereumProviderLike;
    talismanEth?: EthereumProviderLike;
  }
}

const getInjectedProviders = () => window.ethereum?.providers ?? (window.ethereum ? [window.ethereum] : []);

export const getInjectedProvider = (wallet?: WalletType | null): EthereumProviderLike | undefined => {
  if (wallet === 'talisman') {
    return window.talismanEth ?? getInjectedProviders().find((provider) => provider.isTalisman);
  }

  if (wallet === 'metamask') {
    return getInjectedProviders().find((provider) => provider.isMetaMask) ?? window.ethereum;
  }

  return window.ethereum;
};
