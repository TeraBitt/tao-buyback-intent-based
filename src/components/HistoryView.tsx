import type { HistoryFilter, StakeEvent } from '../types';

interface HistoryViewProps {
  account: string;
  currentHistoryPage: number;
  filteredHistory: StakeEvent[];
  historyNote: string;
  historyPageCount: number;
  historyPageEnd: number;
  historyPageStart: number;
  isHistoryLoading: boolean;
  paginatedHistory: StakeEvent[];
  explorerBaseUrl: string;
  formatHistoryTime: (timestamp: number) => string;
  formatShortValue: (value: string, start?: number, end?: number) => string;
  historyFilter: HistoryFilter;
  onExportHistory: () => void;
  onSetHistoryFilter: (filter: HistoryFilter) => void;
  onSetHistoryPage: (page: number) => void;
  onConnectWallet: () => void;
}

const HISTORY_FILTERS: { id: HistoryFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'stake', label: 'Stakes' },
  { id: 'unstake', label: 'Unstakes' },
  { id: 'swap', label: 'Moves' },
];

export default function HistoryView({
  account,
  currentHistoryPage,
  filteredHistory,
  historyNote,
  historyPageCount,
  historyPageEnd,
  historyPageStart,
  isHistoryLoading,
  paginatedHistory,
  explorerBaseUrl,
  formatHistoryTime,
  formatShortValue,
  historyFilter,
  onExportHistory,
  onSetHistoryFilter,
  onSetHistoryPage,
  onConnectWallet,
}: HistoryViewProps) {
  // If not connected, show the connect wallet screen
  if (!account) {
    return (
      <div className="hist-wrap">
        <div className="hist-top">
          <h2>History</h2>
        </div>
        <div className="empty">
          <div className="empty-ic">☰</div>
          <div className="empty-t">Connect your wallet</div>
          <div className="empty-d">
            Please connect your wallet to view your Bittensor EVM testnet staking history and transaction activity.
          </div>
          <button
            type="button"
            className="tao-btn tao-btn--primary"
            onClick={onConnectWallet}
            style={{ marginTop: '20px', padding: '10px 24px' }}
          >
            Connect wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="hist-wrap">
      <div className="hist-top">
        <h2>History</h2>
        <button
          type="button"
          className="tao-btn tao-btn--ghost tao-btn--small"
          onClick={onExportHistory}
          disabled={filteredHistory.length === 0}
        >
          Export CSV
        </button>
      </div>

      <div className="history-subbar">
        <div className="frow">
          {HISTORY_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className={`fp ${historyFilter === filter.id ? 'on' : ''}`}
              onClick={() => {
                onSetHistoryFilter(filter.id);
                onSetHistoryPage(1);
              }}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="history-note">{historyNote}</div>
      </div>

      {isHistoryLoading ? (
        <div className="empty">
          <div className="empty-ic">◌</div>
          <div className="empty-t">Loading contract history</div>
          <div className="empty-d">Fetching confirmed stake, unstake, and move intents from the contract.</div>
        </div>
      ) : filteredHistory.length > 0 ? (
        <>
          <div className="history-table-shell">
            <div className="history-explorer-grid">
              <div className="history-grid-header">
                <span className="gh-date">DATE</span>
                <span className="gh-type">TYPE</span>
                <span className="gh-details">DETAILS</span>
                <span className="gh-amount">AMOUNT</span>
                <span className="gh-status">STATUS</span>
                <span className="gh-hash">TX HASH</span>
              </div>

              <div className="history-grid-body">
                {paginatedHistory.map((event) => (
                  <div key={`${event.txHash}-${event.timestamp}`} className="history-grid-row">
                    <div className="gd-date">{formatHistoryTime(event.timestamp)}</div>
                    <div className="gd-type">
                      <span className={`tt ${event.type === 'stake' ? 'tt-s' : event.type === 'unstake' ? 'tt-u' : 'tt-x'}`}>
                        {event.type === 'stake' ? '↑ Stake' : event.type === 'unstake' ? '↓ Unstake' : '⇄ Move'}
                      </span>
                    </div>
                    <div className="gd-details">{event.detail}</div>
                    <div className={`gd-amount ${event.type === 'unstake' ? 'amt-n' : 'amt-p'}`}>
                      {event.type === 'unstake' ? '−' : '+'}
                      {event.amount}
                    </div>
                    <div className="gd-status">✓ Done</div>
                    <div className="gd-hash">
                      <a
                        href={`${explorerBaseUrl}${event.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="tx-hash"
                      >
                        {formatShortValue(event.txHash, 10, 6)}
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="history-pagination">
            <div className="history-pagination__range">
              Showing {historyPageStart}-{historyPageEnd} of {filteredHistory.length}
            </div>
            <div className="history-pagination__controls">
              <button
                type="button"
                className="history-pagination__button"
                onClick={() => onSetHistoryPage(Math.max(1, currentHistoryPage - 1))}
                disabled={currentHistoryPage === 1}
              >
                Previous
              </button>
              <span className="history-pagination__page">
                Page {currentHistoryPage} of {historyPageCount}
              </span>
              <button
                type="button"
                className="history-pagination__button"
                onClick={() => onSetHistoryPage(Math.min(historyPageCount, currentHistoryPage + 1))}
                disabled={currentHistoryPage === historyPageCount}
              >
                Next
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="empty">
          <div className="empty-ic">☰</div>
          <div className="empty-t">No matching activity yet</div>
          <div className="empty-d">
            Confirmed stake, unstake, and move intents will appear here once they exist on-chain.
          </div>
        </div>
      )}
    </div>
  );
}
