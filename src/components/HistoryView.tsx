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
}: HistoryViewProps) {
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
            <table className="htable">
              <colgroup>
                <col className="history-col-date" />
                <col className="history-col-type" />
                <col className="history-col-details" />
                <col className="history-col-amount" />
                <col className="history-col-status" />
                <col className="history-col-hash" />
              </colgroup>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Details</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Tx Hash</th>
                </tr>
              </thead>
              <tbody>
                {paginatedHistory.map((event) => (
                  <tr key={`${event.txHash}-${event.timestamp}`}>
                    <td data-label="Date" style={{ color: 'var(--text-2)' }}>
                      {formatHistoryTime(event.timestamp)}
                    </td>
                    <td data-label="Type">
                      <span className={`tt ${event.type === 'stake' ? 'tt-s' : event.type === 'unstake' ? 'tt-u' : 'tt-x'}`}>
                        {event.type === 'stake' ? '↑ Stake' : event.type === 'unstake' ? '↓ Unstake' : '⇄ Move'}
                      </span>
                    </td>
                    <td data-label="Details">{event.detail}</td>
                    <td data-label="Amount" className={event.type === 'unstake' ? 'amt-n' : 'amt-p'}>
                      {event.type === 'unstake' ? '−' : '+'}
                      {event.amount}
                    </td>
                    <td data-label="Status" className="tx-ok">✓ Done</td>
                    <td data-label="Tx Hash">
                      <a
                        href={`${explorerBaseUrl}${event.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="tx-hash"
                      >
                        {formatShortValue(event.txHash, 10, 6)}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
            {account
              ? 'Confirmed stake, unstake, and move intents will appear here once they exist on-chain.'
              : 'Connect a wallet to load confirmed stake, unstake, and move intents from the contract.'}
          </div>
        </div>
      )}
    </div>
  );
}
