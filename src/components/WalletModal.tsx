import type { CSSProperties, ReactNode } from 'react';
import { WALLET_OPTIONS } from '../data/wallets';
import type { WalletOption, WalletType } from '../types';

interface WalletModalProps {
  connectingWallet: WalletType | null;
  statusBanner: ReactNode;
  onClose: () => void;
  onSelectWallet: (wallet: WalletType) => void;
}

const renderWalletCardStyle = (option: WalletOption): CSSProperties =>
  ({
    '--wallet-accent': option.accent,
    '--wallet-accent-rgb': option.accentRgb,
  }) as CSSProperties;

export default function WalletModal({ connectingWallet, statusBanner, onClose, onSelectWallet }: WalletModalProps) {
  return (
    <div className="wallet-modal-backdrop" onClick={onClose}>
      <div className="wallet-modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="wallet-modal-card__header">
          <div>
            <span className="section-kicker">Connect wallet</span>
            <h3>Choose your wallet provider</h3>
          </div>
          <button type="button" className="wallet-modal-card__close" onClick={onClose}>
            ×
          </button>
        </div>

        <p className="wallet-modal-card__copy">
          This build is focused on Bittensor subEVM staking. Cross-chain routing remains clearly marked as coming soon
          until it is actually live.
        </p>

        {statusBanner}

        <div className="wallet-modal-card__options">
          {WALLET_OPTIONS.map((option) => {
            const isConnecting = connectingWallet === option.id;

            return (
              <button
                key={option.id}
                type="button"
                className={`wallet-modal-option ${isConnecting ? 'is-loading' : ''}`}
                style={renderWalletCardStyle(option)}
                onClick={() => onSelectWallet(option.id)}
                disabled={Boolean(connectingWallet)}
              >
                <div className="wallet-modal-option__icon-shell">
                  <img src={option.iconSrc} alt="" className="wallet-modal-option__icon" />
                </div>
                <div className="wallet-modal-option__copy">
                  <img src={option.wordmarkSrc} alt={`${option.label} logo`} className="wallet-modal-option__wordmark" />
                  <p>{option.description}</p>
                </div>
                <span className="wallet-modal-option__action">{isConnecting ? 'Connecting' : 'Select'}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
