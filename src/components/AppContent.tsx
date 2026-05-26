import { Activity, AlertCircle, X } from 'lucide-react';
import AppShell from './AppShell';
import ChatPortal from './ChatPortal';
import DashboardView from './DashboardView';
import HistoryView from './HistoryView';
import LandingPage from './LandingPage';
import WalletModal from './WalletModal';
import { EXPLORER_BASE_URL } from '../utils/contracts';
import { formatHistoryTime, formatShortValue, formatTokenAmount } from '../utils/formatters';
import { getHotkeyForNetuid } from '../utils/subnets';
import { useAppContext } from '../context/useAppContext';
import type { StatusState } from '../types';

function LoadingState() {
  return (
    <div className="loading-shell">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="loading-card shimmer-block" />
      ))}
    </div>
  );
}

export default function AppContent() {
  const app = useAppContext();

  const renderStatusToast = (toastStatus: StatusState = app.status) => {
    const toastType = toastStatus.type === 'idle' ? 'loading' : toastStatus.type;

    return (
      <div
        className={`status-banner status-banner--${toastType}`}
        role={toastType === 'error' ? 'alert' : 'status'}
        aria-live={toastType === 'error' ? 'assertive' : 'polite'}
      >
        {toastType === 'error' ? <AlertCircle size={16} /> : <Activity size={16} />}
        <span className="status-banner__message">{toastStatus.msg}</span>
        {toastType !== 'loading' && (
          <button type="button" className="status-banner__close" onClick={app.dismissStatusToast} aria-label="Dismiss notification">
            <X size={15} />
          </button>
        )}
      </div>
    );
  };

  return (
    <>
      {app.surface === 'landing' ? (
        <LandingPage
          account={app.account}
          formatShortValue={formatShortValue}
          onConnectWallet={app.openWalletModal}
          onDisconnectWallet={app.disconnectWallet}
          onOpenApp={() => app.openApp()}
        />
      ) : (
        <AppShell
          account={app.account}
          appView={app.appView}
          formatShortValue={formatShortValue}
          onDisconnectWallet={app.disconnectWallet}
          onConnectWallet={app.openWalletModal}
          onLoadHistory={() => app.fetchOnchainHistory(app.account || undefined)}
          onSetAppView={app.setAppView}
          statusBanner={app.showStatusBanner && !app.showWalletModal ? renderStatusToast() : null}
        >
          {app.appView === 'dashboard' && (
            <DashboardView
              account={app.account}
              activePositions={app.activePositions}
              allAlphaBalances={app.allAlphaBalances}
              availableNetuids={app.availableNetuids}
              balance={app.balance}
              destinationPage={app.destinationPage}
              formatShortValue={formatShortValue}
              formatTokenAmount={formatTokenAmount}
              getHotkeyForNetuid={getHotkeyForNetuid}
              getUiSubnetLabel={app.getUiSubnetLabel}
              getUiSubnetPresentation={app.getUiSubnetPresentation}
              handleBuyAlpha={app.handleBuyAlpha}
              handleSwap={app.handleSwap}
              handleUnstake={app.handleUnstake}
              isStakeEstimateLoading={app.isStakeEstimateLoading}
              isSwapEstimateLoading={app.isSwapEstimateLoading}
              isUnstakeEstimateLoading={app.isUnstakeEstimateLoading}
              isWalletHydrating={app.isWalletHydrating}
              loadingState={<LoadingState />}
              netuid={app.netuid}
              selectedStakeSubnet={app.selectedStakeSubnet}
              selectedSwapSourceSubnet={app.selectedSwapSourceSubnet}
              selectedSwapTargetSubnet={app.selectedSwapTargetSubnet}
              selectedUnstakeSubnet={app.selectedUnstakeSubnet}
              setDestinationPage={app.setDestinationPage}
              setNetuid={app.setNetuid}
              setStakeAmount={app.setStakeAmount}
              setStakingAction={app.setStakingAction}
              setSubnetSearchQuery={app.setSubnetSearchQuery}
              setSwapAmount={app.setSwapAmount}
              setSwapSourceNetuid={app.setSwapSourceNetuid}
              setSwapTargetNetuid={app.setSwapTargetNetuid}
              setUnstakeAmount={app.setUnstakeAmount}
              setUnstakeNetuid={app.setUnstakeNetuid}
              stakeAlphaEstimate={app.stakeAlphaEstimate}
              stakeAmount={app.stakeAmount}
              stakingAction={app.stakingAction}
              stakingPositions={app.stakingPositions}
              stakingPositionsByNetuid={app.stakingPositionsByNetuid}
              status={app.status}
              stakedHotkeys={app.stakedHotkeys}
              subnetSearchQuery={app.subnetSearchQuery}
              swapAlphaEstimate={app.swapAlphaEstimate}
              swapAmount={app.swapAmount}
              swapSourceNetuid={app.swapSourceNetuid}
              swapTargetNetuid={app.swapTargetNetuid}
              totalAlphaStaked={app.totalAlphaStaked}
              unstakeAmount={app.unstakeAmount}
              unstakeNetuid={app.unstakeNetuid}
              unstakeTaoEstimate={app.unstakeTaoEstimate}
              onConnectWallet={app.openWalletModal}
            />
          )}

          {app.appView === 'history' && (
            <HistoryView
              account={app.account}
              currentHistoryPage={app.currentHistoryPage}
              filteredHistory={app.filteredHistory}
              historyNote={app.historyNote}
              historyPageCount={app.historyPageCount}
              historyPageEnd={app.historyPageEnd}
              historyPageStart={app.historyPageStart}
              isHistoryLoading={app.isHistoryLoading}
              paginatedHistory={app.paginatedHistory}
              explorerBaseUrl={EXPLORER_BASE_URL}
              formatHistoryTime={formatHistoryTime}
              formatShortValue={formatShortValue}
              historyFilter={app.historyFilter}
              onExportHistory={app.handleExportHistory}
              onSetHistoryFilter={app.setHistoryFilter}
              onSetHistoryPage={app.setHistoryPage}
              onConnectWallet={app.openWalletModal}
            />
          )}

          {app.appView === 'chat' && (
            <ChatPortal
              account={app.account}
              balance={app.balance}
              myAlphaBalance={app.myAlphaBalance}
              allAlphaBalances={app.allAlphaBalances}
              currentNetuid={app.netuid}
              simulateStakeAlpha={app.simulateStakeAlpha}
              simulateSwapAlpha={app.simulateSwapAlpha}
              simulateUnstakeTao={app.simulateUnstakeTao}
              executeStake={app.executeStake}
              executeUnstake={app.executeUnstake}
              executeSwap={app.executeSwap}
              status={app.status}
              openWalletSelector={app.openWalletModal}
              disconnectWallet={app.disconnectWallet}
              onReturnLanding={() => app.setSurface('landing')}
            />
          )}
        </AppShell>
      )}

      {app.showWalletModal && (
        <WalletModal
          connectingWallet={app.connectingWallet}
          statusBanner={app.status.msg ? renderStatusToast() : null}
          onClose={app.closeWalletModal}
          onSelectWallet={app.connectWallet}
        />
      )}
    </>
  );
}
