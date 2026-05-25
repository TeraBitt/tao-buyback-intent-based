import type { WalletType } from '../types';

export interface EthereumProviderLike {
  request: (args: { method: string; params?: unknown[] | Record<string, unknown>[] }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    ethereum?: EthereumProviderLike;
    talismanEth?: EthereumProviderLike;
  }
}

export const getInjectedProvider = (wallet?: WalletType | null): EthereumProviderLike | undefined =>
  wallet === 'talisman' ? window.talismanEth || window.ethereum : window.ethereum;
