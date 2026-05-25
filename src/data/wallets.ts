import type { WalletOption } from '../types';

export const WALLET_OPTIONS: WalletOption[] = [
  {
    id: 'metamask',
    label: 'MetaMask',
    subtitle: 'EVM native',
    description: 'Recommended for the current Bittensor subEVM staking flow that is live today.',
    iconSrc: '/wallets/metamask-icon.svg',
    wordmarkSrc: '/wallets/metamask-wordmark.svg',
    accent: '#F6851B',
    accentRgb: '246, 133, 27',
  },
  {
    id: 'talisman',
    label: 'Talisman',
    subtitle: 'Bittensor friendly',
    description: 'A strong fit when you want a wallet that already feels close to the broader Bittensor stack.',
    iconSrc: '/wallets/talisman-icon.svg',
    wordmarkSrc: '/wallets/talisman-wordmark.svg',
    accent: '#FF4D6D',
    accentRgb: '255, 77, 109',
  },
];
