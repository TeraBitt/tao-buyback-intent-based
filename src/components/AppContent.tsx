import { useEffect, useMemo, useState } from 'react';
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
import {
  createChatTitleFromPrompt,
  createDraftConversation,
  getInitialChatConversationState,
  hasStartedConversation,
  persistChatConversationState,
} from '../utils/chatConversations';
import { useAppContext } from '../context/useAppContext';
import type { ChatConversation, ChatMessage, StatusState } from '../types';

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
  const [chatState, setChatState] = useState(getInitialChatConversationState);

  useEffect(() => {
    persistChatConversationState(chatState);
  }, [chatState]);

  const activeChatConversation = useMemo<ChatConversation>(() => {
    const fallbackConversation = chatState.conversations[0] ?? createDraftConversation();

    return (
      chatState.conversations.find((conversation) => conversation.id === chatState.activeConversationId) ??
      fallbackConversation
    );
  }, [chatState.activeConversationId, chatState.conversations]);

  const chatRecents = useMemo(
    () =>
      chatState.conversations
        .filter(hasStartedConversation)
        .slice()
        .sort((first, second) => second.updatedAt - first.updatedAt),
    [chatState.conversations],
  );

  const handleCreateChat = () => {
    setChatState((previousState) => {
      const activeConversation = previousState.conversations.find(
        (conversation) => conversation.id === previousState.activeConversationId,
      );
      const conversationsToKeep =
        activeConversation && !hasStartedConversation(activeConversation)
          ? previousState.conversations.filter((conversation) => conversation.id !== activeConversation.id)
          : previousState.conversations;
      const nextConversation = createDraftConversation();

      return {
        conversations: [nextConversation, ...conversationsToKeep],
        activeConversationId: nextConversation.id,
      };
    });
  };

  const handleSelectChat = (conversationId: string) => {
    setChatState((previousState) => {
      if (!previousState.conversations.some((conversation) => conversation.id === conversationId)) {
        return previousState;
      }

      return {
        ...previousState,
        activeConversationId: conversationId,
      };
    });
  };

  const handleStartChatConversation = (conversationId: string, firstPrompt: string) => {
    setChatState((previousState) => ({
      ...previousState,
      conversations: previousState.conversations.map((conversation) => {
        if (conversation.id !== conversationId || hasStartedConversation(conversation)) {
          return conversation;
        }

        return {
          ...conversation,
          title: createChatTitleFromPrompt(firstPrompt),
          updatedAt: Date.now(),
        };
      }),
    }));
  };

  const handleUpdateChatMessages = (
    conversationId: string,
    updater: (messages: ChatMessage[]) => ChatMessage[],
  ) => {
    setChatState((previousState) => ({
      ...previousState,
      conversations: previousState.conversations.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, messages: updater(conversation.messages), updatedAt: Date.now() }
          : conversation,
      ),
    }));
  };

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
        <LandingPage />
      ) : (
        <AppShell
          account={app.account}
          appView={app.appView}
          activeChatId={chatState.activeConversationId}
          chatRecents={chatRecents}
          formatShortValue={formatShortValue}
          onDisconnectWallet={app.disconnectWallet}
          onConnectWallet={app.openWalletModal}
          onCreateChat={handleCreateChat}
          onLoadHistory={() => app.fetchOnchainHistory(app.account || undefined)}
          onSelectChat={handleSelectChat}
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
              conversation={activeChatConversation}
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
              onStartConversation={handleStartChatConversation}
              onUpdateConversationMessages={handleUpdateChatMessages}
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
