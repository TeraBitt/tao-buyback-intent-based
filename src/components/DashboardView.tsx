import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { ArrowDown, ArrowUpDown, Search, X } from 'lucide-react';
import { DISPLAY_SUBNETS } from '../data/subnets';
import type { StakingAction, StakingPositionSummary, StatusState, SubnetPresentation, SwapAlphaSimulation } from '../types';

const APY_LABEL = 'Est. APY';
const TESTNET_SUBNET_PAGE_SIZE = 8;

interface TransactionDetailItem {
  label: string;
  value: string;
  tone?: 'success';
}

interface DashboardViewProps {
  account: string;
  activePositions: [string, string][];
  allAlphaBalances: { [id: number]: string };
  availableNetuids: number[];
  balance: string;
  destinationPage: number;
  formatShortValue: (value: string, start?: number, end?: number) => string;
  formatTokenAmount: (value: string, digits?: number) => string;
  getHotkeyForNetuid: (targetNetuid: number) => string;
  getUiSubnetLabel: (targetNetuid: number) => string;
  getUiSubnetPresentation: (targetNetuid: number) => SubnetPresentation;
  handleBuyAlpha: () => void;
  handleSwap: () => void;
  handleUnstake: () => void;
  isStakeEstimateLoading: boolean;
  isSwapEstimateLoading: boolean;
  isUnstakeEstimateLoading: boolean;
  isWalletHydrating: boolean;
  loadingState: ReactNode;
  netuid: number;
  selectedStakeSubnet: SubnetPresentation;
  selectedSwapSourceSubnet: SubnetPresentation;
  selectedSwapTargetSubnet: SubnetPresentation;
  selectedUnstakeSubnet: SubnetPresentation;
  setDestinationPage: Dispatch<SetStateAction<number>>;
  setNetuid: Dispatch<SetStateAction<number>>;
  setStakeAmount: Dispatch<SetStateAction<string>>;
  setStakingAction: Dispatch<SetStateAction<StakingAction>>;
  setSubnetSearchQuery: Dispatch<SetStateAction<string>>;
  setSwapAmount: Dispatch<SetStateAction<string>>;
  setSwapSourceNetuid: Dispatch<SetStateAction<number>>;
  setSwapTargetNetuid: Dispatch<SetStateAction<number>>;
  setUnstakeAmount: Dispatch<SetStateAction<string>>;
  setUnstakeNetuid: Dispatch<SetStateAction<number>>;
  stakeAlphaEstimate: string | null;
  stakeAmount: string;
  stakingAction: StakingAction;
  stakingPositions: StakingPositionSummary[];
  stakingPositionsByNetuid: Map<number, StakingPositionSummary>;
  status: StatusState;
  stakedHotkeys: { [netuid: number]: string };
  subnetSearchQuery: string;
  swapAlphaEstimate: SwapAlphaSimulation | null;
  swapAmount: string;
  swapSourceNetuid: number;
  swapTargetNetuid: number;
  totalAlphaStaked: string;
  unstakeAmount: string;
  unstakeNetuid: number;
  unstakeTaoEstimate: string | null;
  onConnectWallet: () => void;
}

export default function DashboardView({
  account,
  activePositions,
  allAlphaBalances,
  availableNetuids,
  balance,
  destinationPage,
  formatShortValue,
  formatTokenAmount,
  getHotkeyForNetuid,
  getUiSubnetLabel,
  getUiSubnetPresentation,
  handleBuyAlpha,
  handleSwap,
  handleUnstake,
  isStakeEstimateLoading,
  isSwapEstimateLoading,
  isUnstakeEstimateLoading,
  isWalletHydrating,
  loadingState,
  netuid,
  selectedStakeSubnet,
  selectedSwapSourceSubnet,
  selectedSwapTargetSubnet,
  selectedUnstakeSubnet,
  setDestinationPage,
  setNetuid,
  setStakeAmount,
  setStakingAction,
  setSubnetSearchQuery,
  setSwapAmount,
  setSwapSourceNetuid,
  setSwapTargetNetuid,
  setUnstakeAmount,
  setUnstakeNetuid,
  stakeAlphaEstimate,
  stakeAmount,
  stakingAction,
  stakingPositions,
  stakingPositionsByNetuid,
  status,
  stakedHotkeys,
  subnetSearchQuery,
  swapAlphaEstimate,
  swapAmount,
  swapSourceNetuid,
  swapTargetNetuid,
  totalAlphaStaked,
  unstakeAmount,
  unstakeNetuid,
  unstakeTaoEstimate,
  onConnectWallet,
}: DashboardViewProps) {
    if (isWalletHydrating) {
      return <>{loadingState}</>;
    }

    if (!account) {
      return (
        <div className="swap-wrap">
          <div className="swap-head">
            <h2>Swap &amp; Stake</h2>
          </div>
          <div className="empty">
            <div className="empty-ic">⇄</div>
            <div className="empty-t">Connect your wallet</div>
            <div className="empty-d">
              Please connect your wallet to stake, unstake, and move your positions on the Bittensor EVM testnet.
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

    const unstakeAmountToQuote = unstakeAmount || allAlphaBalances[unstakeNetuid] || '';
    const unstakeReceiveAmount = unstakeTaoEstimate ?? '';
    const selectedApyLabel =
      stakingAction === 'stake'
        ? selectedStakeSubnet.apy
        : stakingAction === 'swap'
          ? selectedSwapTargetSubnet.apy
          : selectedUnstakeSubnet.apy;
    const activeSwapSourceMap = new Map<string, string>(
      activePositions.length > 0 ? activePositions : [[String(swapSourceNetuid), allAlphaBalances[swapSourceNetuid] || '0']],
    );
    if (!activeSwapSourceMap.has(String(swapSourceNetuid))) {
      activeSwapSourceMap.set(String(swapSourceNetuid), allAlphaBalances[swapSourceNetuid] || '0');
    }
    const activeSwapSources = Array.from(activeSwapSourceMap.entries());
    const activeUnstakeSources = activePositions.length > 0 ? activePositions : [[String(unstakeNetuid), allAlphaBalances[unstakeNetuid] || '0']];
    const scannedNetuids = [...availableNetuids]
      .filter((targetNetuid) => targetNetuid > 0)
      .sort((left, right) => left - right);
    const destinationNetuids = Array.from(
      new Set([
        ...DISPLAY_SUBNETS.map((subnet) => subnet.netuid),
        ...stakingPositions.map((position) => position.netuid),
        ...scannedNetuids,
      ]),
    );
    const sidePanelShowsCurrentPositions =
      stakingAction === 'unstake' || (stakingAction === 'stake' && stakingPositions.length > 0);
    const swapDestinationNetuids = destinationNetuids.filter((targetNetuid) => targetNetuid !== swapSourceNetuid);
    const sidePanelRouteNetuids =
      stakingAction === 'swap'
        ? swapDestinationNetuids
        : sidePanelShowsCurrentPositions
          ? stakingPositions.map((position) => position.netuid)
          : destinationNetuids;
    const normalizedSubnetSearch = subnetSearchQuery.trim().toLowerCase();
    const filteredSidePanelRouteNetuids = normalizedSubnetSearch
      ? sidePanelRouteNetuids.filter((displayNetuid) => {
          const displayMeta = getUiSubnetPresentation(displayNetuid);
          const position = stakingPositionsByNetuid.get(displayNetuid);
          const searchText = [
            displayMeta.code,
            displayMeta.name,
            displayMeta.category,
            `sn${displayNetuid}`,
            String(displayNetuid),
            position?.hotkey ?? '',
          ]
            .join(' ')
            .toLowerCase();

          return searchText.includes(normalizedSubnetSearch);
        })
      : sidePanelRouteNetuids;
    const sidePanelPageCount = Math.max(1, Math.ceil(filteredSidePanelRouteNetuids.length / TESTNET_SUBNET_PAGE_SIZE));
    const currentDestinationPage = Math.min(destinationPage, sidePanelPageCount);
    const visibleSidePanelRouteNetuids = sidePanelShowsCurrentPositions
      ? filteredSidePanelRouteNetuids
      : filteredSidePanelRouteNetuids.slice(
          (currentDestinationPage - 1) * TESTNET_SUBNET_PAGE_SIZE,
          currentDestinationPage * TESTNET_SUBNET_PAGE_SIZE,
        );
    const sidePanelTitle =
      stakingAction === 'swap'
        ? 'Move preview'
        : sidePanelShowsCurrentPositions
          ? 'Current positions'
          : 'Testnet destination';
    const selectedSwapSourceBalance = formatTokenAmount(allAlphaBalances[swapSourceNetuid] || '0');
    const commonDetailItems: TransactionDetailItem[] = [
      { label: 'Gas', value: '~0.0004 TAO' },
      { label: 'Arrival', value: '~12 seconds', tone: 'success' },
    ];
    const transactionDetailItems: TransactionDetailItem[] = [
      ...(stakingAction === 'stake'
        ? [
            { label: 'Destination', value: getUiSubnetLabel(netuid) },
            {
              label: 'Receive',
              value: isStakeEstimateLoading
                ? 'Simulating...'
                : stakeAlphaEstimate
                  ? `≈${formatTokenAmount(stakeAlphaEstimate, 6)} ALPHA`
                  : 'Enter amount',
              tone: 'success' as const,
            },
          ]
        : stakingAction === 'swap'
          ? [
              { label: 'Route', value: `${getUiSubnetLabel(swapSourceNetuid)} / ${getUiSubnetLabel(swapTargetNetuid)}` },
              {
                label: 'Receive',
                value: isSwapEstimateLoading
                  ? 'Simulating...'
                  : swapAlphaEstimate
                    ? `≈${formatTokenAmount(swapAlphaEstimate.targetAlpha, 6)} ALPHA`
                    : 'Pick route',
                tone: 'success' as const,
              },
            ]
          : [
              { label: 'From', value: getUiSubnetLabel(unstakeNetuid) },
              {
                label: 'TAO receive',
                value: isUnstakeEstimateLoading
                  ? 'Simulating...'
                  : unstakeTaoEstimate
                    ? `≈${formatTokenAmount(unstakeTaoEstimate, 6)} TAO`
                    : unstakeAmountToQuote
                      ? 'Quote unavailable'
                      : 'Enter amount',
                tone: 'success' as const,
              },
            ]),
      ...commonDetailItems,
      { label: stakingAction === 'unstake' ? 'Source APY' : APY_LABEL, value: selectedApyLabel, tone: 'success' as const },
    ];
    const handleMidRouteToggle = () => {
      if (stakingAction !== 'swap') return;

      setSwapSourceNetuid(swapTargetNetuid);
      setSwapTargetNetuid(swapSourceNetuid);
      setSwapAmount('');
    };

    return (
      <div className="swap-wrap">
        <div className="swap-head">
          <h2>Swap &amp; Stake</h2>

        </div>

        <div className="swap-mode-row">
          <button
            type="button"
            className={`fp ${stakingAction === 'stake' ? 'on' : ''}`}
            onClick={() => setStakingAction('stake')}
          >
            Stake
          </button>
          <button
            type="button"
            className={`fp ${stakingAction === 'swap' ? 'on' : ''}`}
            onClick={() => setStakingAction('swap')}
          >
            Move
          </button>
          <button
            type="button"
            className={`fp ${stakingAction === 'unstake' ? 'on' : ''}`}
            onClick={() => setStakingAction('unstake')}
          >
            Unstake
          </button>
          <div className="swap-mode-note">
            Live staking uses the Bittensor EVM testnet. External-chain deposits stay clearly marked as coming soon.
            {account ? ` Tracked total: ${formatTokenAmount(totalAlphaStaked)} ALPHA.` : ''}
          </div>
        </div>

        <div className="swap-body">
          <div>
            <div className="scard">
              <div className="scard-head">
                {stakingAction === 'stake'
                  ? 'Stake TAO'
                  : stakingAction === 'swap'
                    ? 'Move stake'
                    : 'Unstake ALPHA'}
	              </div>
	              <div className="scard-body">
	                <div className="tbox">
                  <div className="tbox-top">
                    <span className="tbox-label">
                      {stakingAction === 'stake' ? 'You send' : stakingAction === 'swap' ? 'You move' : 'You remove'}
                    </span>
                    <span className="tbox-bal">
                      {stakingAction === 'stake'
                        ? `Balance: ${formatTokenAmount(balance)} TAO`
                        : `Balance: ${formatTokenAmount(
                            allAlphaBalances[stakingAction === 'swap' ? swapSourceNetuid : unstakeNetuid] || '0',
                          )} ALPHA`}
                      {' · '}
                      <span
                        onClick={() =>
                          stakingAction === 'stake'
                            ? setStakeAmount(balance)
                            : stakingAction === 'swap'
                              ? setSwapAmount(allAlphaBalances[swapSourceNetuid] || '0')
                              : setUnstakeAmount(allAlphaBalances[unstakeNetuid] || '0')
                        }
                      >
                        Max
                      </span>
                    </span>
	                  </div>
	                  <div className="tbox-main">
	                    <div className={`asset-picker ${stakingAction === 'stake' ? 'asset-picker--static' : ''}`}>
	                      <div className={`tok-ic ${stakingAction === 'stake' ? 'it' : 'ia'}`}>
	                        {stakingAction === 'stake' ? 'τ' : 'α'}
	                      </div>
	                      <span className="asset-symbol">{stakingAction === 'stake' ? 'TAO' : 'ALPHA'}</span>
	                      {stakingAction === 'swap' ? (
	                        <select
	                          className="asset-route-select"
	                          value={swapSourceNetuid}
	                          onChange={(event) => setSwapSourceNetuid(Number(event.target.value))}
	                          aria-label="Source subnet"
	                        >
	                          {activeSwapSources.map(([id, bal]) => {
	                            const sourceNetuid = Number(id);
	                            const sourceMeta = getUiSubnetPresentation(sourceNetuid);

	                            return (
	                              <option key={id} value={sourceNetuid}>
	                                {sourceMeta.code} - {sourceMeta.name} · {formatTokenAmount(bal)}α
	                              </option>
	                            );
	                          })}
	                        </select>
	                      ) : stakingAction === 'unstake' ? (
	                        <select
	                          className="asset-route-select"
	                          value={unstakeNetuid}
	                          onChange={(event) => setUnstakeNetuid(Number(event.target.value))}
	                          aria-label="Unstake source subnet"
	                        >
	                          {activeUnstakeSources.map(([id, bal]) => {
	                            const sourceNetuid = Number(id);
	                            const sourceMeta = getUiSubnetPresentation(sourceNetuid);

	                            return (
	                              <option key={id} value={sourceNetuid}>
	                                {sourceMeta.code} - {sourceMeta.name} · {formatTokenAmount(bal)}α
	                              </option>
	                            );
	                          })}
	                        </select>
	                      ) : (
	                        <span className="asset-route-static">Testnet</span>
	                      )}
	                    </div>
	                    <div className="swap-amount-shell">
                      <input
                        type="number"
                        className="swap-amt-input"
                        placeholder="0.00"
                        value={stakingAction === 'stake' ? stakeAmount : stakingAction === 'swap' ? swapAmount : unstakeAmount}
                        onChange={(event) =>
                          stakingAction === 'stake'
                            ? setStakeAmount(event.target.value)
                            : stakingAction === 'swap'
                              ? setSwapAmount(event.target.value)
                              : setUnstakeAmount(event.target.value)
                        }
                      />
                      <div className="tok-usd">
                        {stakingAction === 'stake'
                          ? 'Native TAO on Bittensor EVM testnet'
                          : stakingAction === 'swap'
                            ? `From ${selectedSwapSourceSubnet.code}`
                            : `From ${selectedUnstakeSubnet.code}`}
	                  </div>
	                </div>
                  </div>
                </div>

                <div className="swap-mid-row">
                  <button
                    type="button"
                    className={`swaptog ${stakingAction !== 'swap' ? 'swaptog--static' : ''}`}
                    onClick={handleMidRouteToggle}
                    aria-label={stakingAction === 'swap' ? 'Flip source and destination subnets' : 'Route direction'}
                    disabled={stakingAction !== 'swap'}
                  >
                    {stakingAction === 'swap' ? <ArrowUpDown size={15} /> : <ArrowDown size={15} />}
                  </button>
                </div>

                <div className="tbox">
                  <div className="tbox-top">
                    <span className="tbox-label">
                      {stakingAction === 'stake'
                        ? 'You receive (staked)'
                        : stakingAction === 'swap'
                          ? 'You receive on destination'
                          : 'You receive back'}
                    </span>
                    <span className="tbox-bal">
                      {stakingAction === 'swap' ? 'Simulated quote' : 'Bittensor EVM testnet only'}
                    </span>
	                  </div>
	                  <div className="tbox-main">
	                    <div className={`asset-picker ${stakingAction === 'unstake' ? 'asset-picker--static' : ''}`}>
	                      <div className={`tok-ic ${stakingAction === 'unstake' ? 'it' : 'ia'}`}>
	                        {stakingAction === 'unstake' ? 'τ' : 'α'}
	                      </div>
	                      <span className="asset-symbol">{stakingAction === 'unstake' ? 'TAO' : 'ALPHA'}</span>
	                      {stakingAction === 'stake' ? (
	                        <select
	                          className="asset-route-select"
	                          value={netuid}
	                          onChange={(event) => setNetuid(Number(event.target.value))}
	                          aria-label="Stake destination subnet"
	                        >
	                          {destinationNetuids.map((displayNetuid) => {
	                            const displayMeta = getUiSubnetPresentation(displayNetuid);

	                            return (
	                              <option key={displayNetuid} value={displayNetuid}>
	                                {displayMeta.code} - {displayMeta.name}
	                              </option>
	                            );
	                          })}
	                        </select>
	                      ) : stakingAction === 'swap' ? (
	                        <select
	                          className="asset-route-select"
	                          value={swapTargetNetuid}
	                          onChange={(event) => setSwapTargetNetuid(Number(event.target.value))}
	                          aria-label="Destination subnet"
	                        >
	                          {swapDestinationNetuids.map((displayNetuid) => {
	                            const displayMeta = getUiSubnetPresentation(displayNetuid);

	                            return (
	                              <option key={displayNetuid} value={displayNetuid}>
	                                {displayMeta.code} - {displayMeta.name}
	                              </option>
	                            );
	                          })}
	                        </select>
	                      ) : (
	                        <span className="asset-route-static">Testnet</span>
	                      )}
	                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="tok-amt" style={stakingAction !== 'unstake' ? { color: 'var(--text-2)' } : undefined}>
                        ≈
                        {(stakingAction === 'stake' && isStakeEstimateLoading) ||
                        (stakingAction === 'swap' && isSwapEstimateLoading) ||
                        (stakingAction === 'unstake' && isUnstakeEstimateLoading)
                          ? '...'
                          : formatTokenAmount(
                              stakingAction === 'stake'
                                ? stakeAlphaEstimate ?? '0'
                                : stakingAction === 'swap'
                                  ? swapAlphaEstimate?.targetAlpha ?? '0'
                                  : unstakeReceiveAmount || '0',
                              stakingAction === 'stake' || stakingAction === 'swap' || stakingAction === 'unstake' ? 6 : 4,
                            )}
                      </div>
                      <div className="tok-usd">
                        {stakingAction === 'stake'
                          ? stakeAlphaEstimate
                            ? `Simulated on ${selectedStakeSubnet.code}`
                            : `Staked on ${selectedStakeSubnet.code}`
                          : stakingAction === 'swap'
                            ? swapAlphaEstimate
                            ? `Simulated on ${selectedSwapTargetSubnet.code}`
                            : `Move to ${selectedSwapTargetSubnet.code}`
                            : unstakeTaoEstimate
                              ? `Simulated from ${selectedUnstakeSubnet.code}`
                              : 'Returned to connected wallet'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="swap-detail-list">
                  {transactionDetailItems.map((item) => (
                    <div className="det-row" key={`${item.label}-${item.value}`}>
                      <span>{item.label}</span>
                      <span className={item.tone === 'success' ? 'det-value-success' : undefined}>{item.value}</span>
                    </div>
                  ))}
                </div>

                <div className="swap-submit-dock">

                  {stakingAction === 'stake' && (
                    <button
                      type="button"
                      className="swap-action-btn"
                      onClick={handleBuyAlpha}
                      disabled={!account || !stakeAmount || status.type === 'loading'}
                    >
                      Stake on {selectedStakeSubnet.code} →
                    </button>
                  )}

                  {stakingAction === 'swap' && (
                    <button
                      type="button"
                      className="swap-action-btn"
                      onClick={handleSwap}
                      disabled={
                        !account ||
                        status.type === 'loading' ||
                        swapSourceNetuid === swapTargetNetuid ||
                        (swapAmount === '' &&
                          (!allAlphaBalances[swapSourceNetuid] || Number.parseFloat(allAlphaBalances[swapSourceNetuid]) === 0))
                      }
                    >
                      Move {formatTokenAmount(swapAmount || allAlphaBalances[swapSourceNetuid] || '0')} ALPHA from{' '}
                      {selectedSwapSourceSubnet.code} to {selectedSwapTargetSubnet.code} →
                    </button>
                  )}

                  {stakingAction === 'unstake' && (
                    <button
                      type="button"
                      className="swap-action-btn"
                      onClick={handleUnstake}
                      disabled={
                        !account ||
                        status.type === 'loading' ||
                        !(allAlphaBalances[unstakeNetuid] && Number.parseFloat(allAlphaBalances[unstakeNetuid]) > 0)
                      }
                    >
                      Unstake from {selectedUnstakeSubnet.code} →
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="scard">
              <div className="scard-head">{sidePanelTitle}</div>
              <div className="scard-body">
                <p className="swap-side-copy">
                  {stakingAction === 'stake'
                    ? stakingPositions.length > 0
                      ? 'Your current testnet positions. Click one to stake more on that subnet.'
                      : 'Choose which Bittensor testnet subnet receives your position.'
	                    : stakingAction === 'unstake'
	                      ? 'Choose which current testnet position you want to unwind.'
	                      : 'Route preview. Change the source and destination from the ALPHA selectors in the move card.'}
                </p>
	                {stakingAction === 'swap' ? (
	                  <div className="route-preview">
	                    <div className="route-selected-summary">
	                      <div className="sn-num">{selectedSwapSourceSubnet.code}</div>
	                      <div className="route-selected-summary__main">
	                        <strong>{selectedSwapSourceSubnet.name}</strong>
	                        <span>{selectedSwapSourceBalance} ALPHA available</span>
	                      </div>
	                      <div className="route-selected-summary__stat">
	                        <span>{selectedSwapSourceSubnet.apy}</span>
	                        <small>{APY_LABEL}</small>
	                      </div>
	                    </div>
	                    <div className="route-flow-arrow">↓</div>
	                    <div className="route-selected-summary route-selected-summary--destination">
	                      <div className="sn-num">{selectedSwapTargetSubnet.code}</div>
	                      <div className="route-selected-summary__main">
	                        <strong>{selectedSwapTargetSubnet.name}</strong>
	                        <span>{selectedSwapTargetSubnet.category}</span>
	                      </div>
	                      <div className="route-selected-summary__stat">
	                        <span>{selectedSwapTargetSubnet.apy}</span>
	                        <small>{APY_LABEL}</small>
	                      </div>
	                    </div>
	                    <div className="route-quote-note">
	                      Move {formatTokenAmount(swapAmount || allAlphaBalances[swapSourceNetuid] || '0')} ALPHA from{' '}
	                      {selectedSwapSourceSubnet.code} to {selectedSwapTargetSubnet.code}
	                      {swapAlphaEstimate
	                        ? ` for about ${formatTokenAmount(swapAlphaEstimate.targetAlpha, 6)} destination ALPHA.`
	                        : '.'}
	                    </div>
	                  </div>
	                ) : (
                  <>
                    <div className="subnet-search">
                      <Search size={14} />
                      <input
                        type="text"
                        value={subnetSearchQuery}
                        onChange={(event) => setSubnetSearchQuery(event.target.value)}
                        placeholder={sidePanelShowsCurrentPositions ? 'Search positions' : 'Search subnet name or netuid'}
                      />
                      {subnetSearchQuery && (
                        <button type="button" onClick={() => setSubnetSearchQuery('')} aria-label="Clear subnet search">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    {visibleSidePanelRouteNetuids.length > 0 ? (
                      <div className="sn-list">
                        {visibleSidePanelRouteNetuids.map((displayNetuid) => {
                          const displayMeta = getUiSubnetPresentation(displayNetuid);
                          const position = stakingPositionsByNetuid.get(displayNetuid);
                          const isSelected =
                            stakingAction === 'stake' ? netuid === displayNetuid : unstakeNetuid === displayNetuid;
                          const routeAmount = position?.amount ?? formatTokenAmount(allAlphaBalances[displayNetuid] || '0');
                          const routeApy = position?.apy ?? displayMeta.apy;
                          const routeHotkey =
                            position?.hotkey ?? stakedHotkeys[displayNetuid] ?? getHotkeyForNetuid(displayNetuid);

                          return (
                            <button
                              key={displayNetuid}
                              type="button"
                              className={`sn-r ${isSelected ? 'sel' : ''}`}
                              onClick={() =>
                                stakingAction === 'stake'
                                  ? setNetuid(displayNetuid)
                                  : setUnstakeNetuid(displayNetuid)
                              }
                            >
                              <div className="sn-num">{displayMeta.code}</div>
                              <div className="sn-info">
                                <div className="sn-name">{displayMeta.name}</div>
                                <div className="sn-cat">
                                  {sidePanelShowsCurrentPositions
                                    ? `Validator ${formatShortValue(routeHotkey, 8, 6)}`
                                    : displayMeta.category}
                                </div>
                              </div>
                              <div className={`sn-apy ${sidePanelShowsCurrentPositions ? 'sn-apy--stack' : ''}`}>
                                {sidePanelShowsCurrentPositions ? (
                                  <>
                                    <span>{routeAmount}α</span>
                                    <small>{routeApy} {APY_LABEL}</small>
                                  </>
                                ) : (
                                  <>
                                    <span className="sn-apy__value">{routeApy}</span>
                                    <small className="sn-apy__label">{APY_LABEL}</small>
                                  </>
                                )}
                              </div>
                              <div className="snr-radio" />
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="staking-position-empty">
                        {subnetSearchQuery
                          ? sidePanelShowsCurrentPositions
                            ? 'No matching positions.'
                            : 'No matching testnet subnets.'
                          : 'No current testnet staking positions found for this wallet.'}
                      </div>
                    )}
                    {!sidePanelShowsCurrentPositions && sidePanelPageCount > 1 && (
                      <div className="subnet-pagination">
                        <span>
                          Page {currentDestinationPage} of {sidePanelPageCount} · {filteredSidePanelRouteNetuids.length}
                          {subnetSearchQuery ? ` of ${sidePanelRouteNetuids.length}` : ''} subnets
                        </span>
                        <div className="subnet-pagination__controls">
                          <button
                            type="button"
                            onClick={() => setDestinationPage((page) => Math.max(1, page - 1))}
                            disabled={currentDestinationPage === 1}
                          >
                            Prev
                          </button>
                          <button
                            type="button"
                            onClick={() => setDestinationPage((page) => Math.min(sidePanelPageCount, page + 1))}
                            disabled={currentDestinationPage === sidePanelPageCount}
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
                <div className="swap-side-footnote">
                  {stakingAction === 'stake'
                    ? stakingPositions.length > 0
                      ? 'Positions and validator routes are sourced from live on-chain stake.'
                      : 'Bittensor EVM testnet flows are live today. Solana, Ethereum, and other external-chain deposits are coming soon.'
                    : stakingAction === 'unstake'
                      ? 'Unstaking returns native testnet TAO to the connected wallet after the on-chain unbonding step.'
                      : 'Bittensor EVM testnet flows are live today. Solana, Ethereum, and other external-chain deposits are coming soon.'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
}
