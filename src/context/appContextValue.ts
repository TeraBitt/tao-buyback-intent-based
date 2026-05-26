import { createContext, type Dispatch, type SetStateAction } from 'react';
import type {
  AppView,
  HistoryFilter,
  StakeEvent,
  StakingAction,
  StakingPositionSummary,
  StatusState,
  SubnetPresentation,
  SwapAlphaSimulation,
  WalletType,
} from '../types';
import { simulateStakeAlpha, simulateSwapAlpha, simulateUnstakeTao } from '../utils/simulations';

export type Surface = 'landing' | 'app';

export interface AppContextValue {
  account: string;
  activePositions: [string, string][];
  allAlphaBalances: { [id: number]: string };
  appView: AppView;
  availableNetuids: number[];
  balance: string;
  connectingWallet: WalletType | null;
  currentHistoryPage: number;
  destinationPage: number;
  filteredHistory: StakeEvent[];
  getUiSubnetLabel: (targetNetuid: number) => string;
  getUiSubnetPresentation: (targetNetuid: number) => SubnetPresentation;
  handleBuyAlpha: () => Promise<void>;
  handleExportHistory: () => void;
  handleSwap: () => Promise<void>;
  handleUnstake: () => Promise<void>;
  historyFilter: HistoryFilter;
  historyNote: string;
  historyPageCount: number;
  historyPageEnd: number;
  historyPageStart: number;
  isHistoryLoading: boolean;
  isStakeEstimateLoading: boolean;
  isSwapEstimateLoading: boolean;
  isUnstakeEstimateLoading: boolean;
  isWalletHydrating: boolean;
  myAlphaBalance: string;
  netuid: number;
  paginatedHistory: StakeEvent[];
  selectedStakeSubnet: SubnetPresentation;
  selectedSwapSourceSubnet: SubnetPresentation;
  selectedSwapTargetSubnet: SubnetPresentation;
  selectedUnstakeSubnet: SubnetPresentation;
  setAppView: Dispatch<SetStateAction<AppView>>;
  setDestinationPage: Dispatch<SetStateAction<number>>;
  setHistoryFilter: Dispatch<SetStateAction<HistoryFilter>>;
  setHistoryPage: Dispatch<SetStateAction<number>>;
  setNetuid: Dispatch<SetStateAction<number>>;
  setStakeAmount: Dispatch<SetStateAction<string>>;
  setStakingAction: Dispatch<SetStateAction<StakingAction>>;
  setSubnetSearchQuery: Dispatch<SetStateAction<string>>;
  setSurface: Dispatch<SetStateAction<Surface>>;
  setSwapAmount: Dispatch<SetStateAction<string>>;
  setSwapSourceNetuid: Dispatch<SetStateAction<number>>;
  setSwapTargetNetuid: Dispatch<SetStateAction<number>>;
  setUnstakeAmount: Dispatch<SetStateAction<string>>;
  setUnstakeNetuid: Dispatch<SetStateAction<number>>;
  showStatusBanner: boolean;
  showWalletModal: boolean;
  stakeAlphaEstimate: string | null;
  stakeAmount: string;
  stakingAction: StakingAction;
  stakingPositions: StakingPositionSummary[];
  stakingPositionsByNetuid: Map<number, StakingPositionSummary>;
  status: StatusState;
  stakedHotkeys: { [netuid: number]: string };
  subnetSearchQuery: string;
  surface: Surface;
  swapAlphaEstimate: SwapAlphaSimulation | null;
  swapAmount: string;
  swapSourceNetuid: number;
  swapTargetNetuid: number;
  totalAlphaStaked: string;
  unstakeAmount: string;
  unstakeNetuid: number;
  unstakeTaoEstimate: string | null;
  closeWalletModal: () => void;
  connectWallet: (wallet?: WalletType) => Promise<void>;
  disconnectWallet: () => Promise<void>;
  dismissStatusToast: () => void;
  executeStake: (amount: string, targetNetuid: number, targetHotkey?: string) => Promise<boolean>;
  executeSwap: (
    sourceNetuid: number,
    targetNetuid: number,
    amountOrHotkey: string,
    amountIfHotkeyUsed?: string,
  ) => Promise<boolean>;
  executeUnstake: (targetNetuid: number, amountOrHotkey?: string, amountIfHotkeyUsed?: string) => Promise<boolean>;
  fetchOnchainHistory: (address?: string, options?: { force?: boolean }) => Promise<void>;
  openApp: (view?: AppView) => void;
  openWalletModal: () => void;
  simulateStakeAlpha: typeof simulateStakeAlpha;
  simulateSwapAlpha: typeof simulateSwapAlpha;
  simulateUnstakeTao: typeof simulateUnstakeTao;
}

export const AppContext = createContext<AppContextValue | null>(null);
