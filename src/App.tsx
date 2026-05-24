import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ethers } from 'ethers';
import { blake2b } from 'blakejs';
import {
  Activity,
  AlertCircle,
  Search,
  X,
} from 'lucide-react';
import { CONFIG } from './config';
import abiData from './abi.json';
import ChatPortal from './components/ChatPortal';

interface EthereumProviderLike {
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

const CONTRACT_ABI = abiData;
const EXPLORER_BASE_URL = 'https://evm-testnet.subtensor.io/tx/';

type WalletType = 'metamask' | 'talisman';
type Surface = 'landing' | 'app';
type AppView = 'dashboard' | 'chat' | 'history';
type StakingAction = 'stake' | 'swap' | 'unstake';
type HistoryFilter = 'all' | 'stake' | 'unstake' | 'swap';
type HistorySource = 'wallet' | 'contract';
type StatusState = { type: 'idle' | 'loading' | 'success' | 'error'; msg: string };

interface WalletOption {
  id: WalletType;
  label: string;
  subtitle: string;
  description: string;
  iconSrc: string;
  wordmarkSrc: string;
  accent: string;
  accentRgb: string;
}

interface StakeEvent {
  type: 'stake' | 'unstake' | 'swap';
  title: string;
  detail: string;
  amount: string;
  user: string;
  solver?: string;
  nonce?: string;
  txHash: string;
  blockNumber: number;
  timestamp: number;
}

interface HistoryCacheEntry {
  events: StakeEvent[];
  source: HistorySource;
}

interface StakingPositionSummary {
  netuid: number;
  hotkey: string;
  amount: string;
  apy: string;
}

interface SubnetCatalogEntry {
  netuid: number;
  name: string;
}

interface SubnetPresentation {
  netuid: number;
  code: string;
  name: string;
  category: string;
  apy: string;
}

const WALLET_OPTIONS: WalletOption[] = [
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

const LANDING_TICKER = [
  { label: 'SN19 Vision', value: '34.2% APY', delta: '↑ 2.1%', positive: true },
  { label: 'SN27 Inference', value: '28.6% APY', delta: '↑ 0.8%', positive: true },
  { label: 'SN11 Code', value: '22.3% APY', delta: '↑ 3.4%', positive: true },
  { label: 'SN4 Multimodal', value: '19.1% APY', delta: '↓ 0.4%', positive: false },
  { label: 'SN9 Translation', value: '16.4% APY', delta: '↑ 1.2%', positive: true },
  { label: 'TAO/USD', value: '$487.20', delta: '↑ 4.1%', positive: true },
  { label: 'SN1 Text', value: '14.8% APY', delta: '↓ 0.2%', positive: false },
];

const COMMAND_PREVIEWS = [
  {
    prompt: '"Stake 200 TAO on the top AI subnet this week"',
    result: '200 TAO staked on SN27 at 28.6% APY · confirmed',
  },
  {
    prompt: '"Move half my position from Subnet 310 into Subnet 19"',
    result: 'Subnet rotation prepared on Bittensor EVM testnet with source, target, and amount ready for review',
  },
  {
    prompt: '"Unstake everything from Subnet 4 and move to Subnet 11"',
    result: 'Unstake and follow-on restake flow prepared, with both steps shown before confirmation',
  },
  {
    prompt: '"What does Subnet 27 do and how is it performing?"',
    result: 'Full subnet breakdown shown · live APY, TVL, validator count',
  },
];

const VISION_POINTS = [
  {
    icon: '⌘',
    title: 'Intent to action',
    description:
      'You describe what you want. TaoChat interprets, shows you a full breakdown, and executes only after you confirm.',
  },
  {
    icon: '⇄',
    title: 'Cross-chain next',
    description:
      'SOL, ETH, and other external-chain routes are coming soon. The live build stays focused on native Bittensor EVM testnet flows for now.',
  },
  {
    icon: '◎',
    title: 'Non-custodial always',
    description:
      'Every action signs from your own wallet. TaoChat never holds funds or keys.',
  },
];

const USE_CASES = [
  {
    id: '01',
    icon: '↑',
    title: 'Stake on any subnet',
    description:
      'Pick by name, number, or ask for the best performer. Stake any amount of TAO or wALPHA directly from your wallet.',
    example: 'Stake 50 TAO on Subnet 19',
  },
  {
    id: '02',
    icon: '↓',
    title: 'Unstake anytime',
    description:
      'Exit fully or partially with one command. TaoChat handles the unbonding and returns your assets cleanly.',
    example: 'Unstake half my Subnet 4 position',
  },
  {
    id: '03',
    icon: '⟳',
    title: 'Cross-chain staking',
    description:
      'SOL, ETH, and external-chain deposit flows are planned, but they stay clearly marked as coming soon until they are fully live.',
    example: 'Cross-chain routes are coming soon',
  },
  {
    id: '04',
    icon: '↗',
    title: 'Discover top subnets',
    description:
      'Ask which subnets lead by APY, category, or momentum. Get live data and act on it instantly.',
    example: 'Which AI subnet has the best APY?',
  },
  {
    id: '05',
    icon: '⇄',
    title: 'Move between subnets',
    description:
      'Rotate a position in one command. Unstake from one, restake on another, both steps confirmed together.',
    example: 'Move my SN4 stake to Subnet 27',
  },
  {
    id: '06',
    icon: '⬡',
    title: 'Research any subnet',
    description:
      'Ask what a subnet does, its live APY, TVL, validator count, and how it compares to similar ones.',
    example: 'What does Subnet 11 do?',
  },
];

const SUPPORTED_NETWORKS = [
  { name: 'Solana', symbol: '◎', status: 'Coming soon', style: { background: '#9945FF', color: '#fff' } },
  { name: 'Ethereum', symbol: '⟠', status: 'Coming soon', style: { background: '#627EEA', color: '#fff' } },
  { name: 'Bittensor EVM Testnet', symbol: 'τ', status: 'Live', style: { background: '#E8622A', color: '#fff' } },
  { name: 'BNB Chain', symbol: '⬡', status: 'Coming soon' },
];

const DISPLAY_SUBNETS = [
  { netuid: 310, code: 'SN310', name: 'Alpha', category: 'Bittensor EVM testnet route', apy: '18.4%' },
  { netuid: 19, code: 'SN19', name: 'Vision', category: 'Image AI', apy: '34.2%' },
  { netuid: 27, code: 'SN27', name: 'Inference', category: 'LLM serving', apy: '28.6%' },
  { netuid: 11, code: 'SN11', name: 'Code', category: 'Code generation', apy: '22.3%' },
  { netuid: 4, code: 'SN4', name: 'Multimodal', category: 'Vision + language', apy: '19.1%' },
];

const CONTRACT_DEPLOY_BLOCK = 7147534;
const HISTORY_LOG_PAGE_SIZE = 5000;
const HISTORY_MAX_EVENTS = 150;
const HISTORY_PAGE_SIZE = 10;
const TESTNET_SUBNET_PAGE_SIZE = 8;
const RPC_REQUEST_SPACING_MS = 300;
const RPC_RATE_LIMIT_BACKOFF_MS = 2500;
const RPC_MAX_RETRIES = 4;
const RPC_BATCH_MAX_COUNT = 45;
const INTENT_FILLED_TOPIC = ethers.id('IntentFilled(address,address,uint256)');
const contractInterface = new ethers.Interface(CONTRACT_ABI);
const stakingCallInterface = new ethers.Interface([
  'function addStake(bytes32 hotkey, uint256 amount, uint256 netuid) external',
  'function removeStake(bytes32 hotkey, uint256 amount, uint256 netuid) external',
  'function removeStakeFull(bytes32 hotkey, uint256 netuid) external',
]);
const STAKING_PRECOMPILE_ADDRESS = '0x0000000000000000000000000000000000000805';

// Single persistent JsonRpcProvider for all read-only calls
const directProvider = new ethers.JsonRpcProvider(CONFIG.NETWORK.rpcUrls[0], undefined, {
  staticNetwork: true,
  batchMaxCount: RPC_BATCH_MAX_COUNT,
  batchStallTime: 25,
});

const stakingPrecompile = new ethers.Contract(
  STAKING_PRECOMPILE_ADDRESS,
  [
    'function getTotalAlphaStaked(bytes32 hotkey, uint256 netuid) external view returns (uint256)',
    'function getStake(bytes32 hotkey, bytes32 coldkey, uint256 netuid) external view returns (uint256)',
  ],
  directProvider,
);

const getEpochMs = () => Date.now();

const getIntentTiming = () => {
  const now = getEpochMs();
  return {
    deadline: Math.floor(now / 1000) + 3600,
    nonce: now,
  };
};

const getInjectedProvider = (wallet?: WalletType | null): EthereumProviderLike | undefined =>
  wallet === 'talisman' ? window.talismanEth || window.ethereum : window.ethereum;

const formatShortValue = (value: string, start = 8, end = 6) => {
  if (!value) return '';
  return `${value.slice(0, start)}...${value.slice(-end)}`;
};

const formatTokenAmount = (value: string, digits = 4) => {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return value;
  return parsed.toFixed(digits).replace(/\.?0+$/, '');
};

const formatHistoryTime = (timestamp: number) => {
  const date = new Date(timestamp);
  return `${date.toLocaleString([], { month: 'short', day: 'numeric' })} · ${date.toLocaleString([], {
    hour: 'numeric',
    minute: '2-digit',
  })}`;
};

const getSubnetMeta = (targetNetuid: number) =>
  DISPLAY_SUBNETS.find((subnet) => subnet.netuid === targetNetuid) ?? null;

const getMockApyForNetuid = (targetNetuid: number) => {
  const subnetMeta = getSubnetMeta(targetNetuid);
  if (subnetMeta?.apy) return subnetMeta.apy;

  const baseApy = 14 + ((targetNetuid * 7) % 13);
  const fractional = ((targetNetuid * 3) % 10) / 10;
  return `${(baseApy + fractional).toFixed(1)}%`;
};

const getSubnetPresentation = (targetNetuid: number): SubnetPresentation => {
  const subnetMeta = getSubnetMeta(targetNetuid);
  if (subnetMeta) return subnetMeta;

  if (targetNetuid === 0) {
    return {
      netuid: 0,
      code: 'SN0',
      name: 'Root Network',
      category: 'Bittensor root route',
      apy: getMockApyForNetuid(targetNetuid),
    };
  }

  if (targetNetuid === 1) {
    return {
      netuid: 1,
      code: 'SN1',
      name: 'Text',
      category: 'Text subnet',
      apy: getMockApyForNetuid(targetNetuid),
    };
  }

  return {
    netuid: targetNetuid,
    code: `SN${targetNetuid}`,
    name: `Subnet ${targetNetuid}`,
    category: 'Bittensor route',
    apy: getMockApyForNetuid(targetNetuid),
  };
};

const getSubnetLabel = (targetNetuid: number) => {
  const subnetMeta = getSubnetPresentation(targetNetuid);
  return `${subnetMeta.code} — ${subnetMeta.name}`;
};

const normalizeAddress = (value: string) => {
  try {
    return ethers.getAddress(value);
  } catch {
    return value.toLowerCase();
  }
};

const decodeIndexedAddress = (topic?: string) => {
  if (!topic || topic.length < 42) return '';
  return ethers.getAddress(`0x${topic.slice(-40)}`);
};

const getHotkeyForNetuid = (targetNetuid: number): string => {
  if (targetNetuid === 310) {
    return '0x3cba5f549c02a4da782cadb65564d0e8159f339f5610db4bd5773f36c760f97c';
  }

  return '0x1e738b33dfbd68eaba7db3f03fe942cfa4e32b728e52c26743b16dbca15af464';
};

interface IntentCall {
  target: string;
  value: bigint;
  callData: string;
}

interface IntentCondition {
  asset: number;
  minOutput: bigint;
  hotkey: string;
  netuid: number;
}

interface DecodedStakingCall {
  name: 'addStake' | 'removeStake' | 'removeStakeFull';
  hotkey: string;
  amountRao?: bigint;
  netuid: number;
}

interface RawRpcTransaction {
  input?: string;
  data?: string;
  value?: string;
}

const mergeHistoryEvents = (...historyGroups: StakeEvent[][]) => {
  const merged = new Map<string, StakeEvent>();

  for (const group of historyGroups) {
    for (const event of group) {
      const key = `${event.txHash}:${event.type}:${event.detail}`;
      if (!merged.has(key)) {
        merged.set(key, event);
      }
    }
  }

  return Array.from(merged.values()).sort(
    (left, right) => right.timestamp - left.timestamp || right.blockNumber - left.blockNumber,
  );
};

const getHistoryCacheKey = (address?: string) => (address ? `wallet:${normalizeAddress(address)}` : 'contract');

const delay = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

let nextRpcRequestAt = 0;

const waitForRpcSlot = async () => {
  const now = Date.now();
  const waitMs = Math.max(0, nextRpcRequestAt - now);
  nextRpcRequestAt = Math.max(now, nextRpcRequestAt) + RPC_REQUEST_SPACING_MS;

  if (waitMs > 0) {
    await delay(waitMs);
  }
};

const stringifyRpcError = (error: unknown) => {
  const parts: string[] = [];

  if (error instanceof Error) {
    parts.push(error.message);
  }

  if (typeof error === 'object' && error !== null) {
    const errorRecord = error as Record<string, unknown>;

    for (const key of ['code', 'status', 'shortMessage', 'reason']) {
      const value = errorRecord[key];
      if (typeof value === 'string' || typeof value === 'number') {
        parts.push(String(value));
      }
    }

    try {
      parts.push(JSON.stringify(errorRecord));
    } catch {
      // Some provider errors contain circular request objects.
    }
  }

  return parts.join(' ').toLowerCase();
};

const isRetryableRpcError = (error: unknown) => {
  const errorText = stringifyRpcError(error);
  return (
    errorText.includes('429') ||
    errorText.includes('too many') ||
    errorText.includes('rate limit') ||
    errorText.includes('failed to fetch') ||
    errorText.includes('cors') ||
    errorText.includes('preflight')
  );
};

const withRpcBackoff = async <Result,>(operation: () => Promise<Result>) => {
  for (let attempt = 0; attempt <= RPC_MAX_RETRIES; attempt += 1) {
    await waitForRpcSlot();

    try {
      return await operation();
    } catch (error) {
      if (attempt === RPC_MAX_RETRIES || !isRetryableRpcError(error)) {
        throw error;
      }

      const backoffMs = RPC_RATE_LIMIT_BACKOFF_MS * 2 ** attempt;
      nextRpcRequestAt = Math.max(nextRpcRequestAt, Date.now() + backoffMs);
      await delay(backoffMs);
    }
  }

  throw new Error('RPC request failed after retries');
};

const getAddressTopic = (address: string) => ethers.zeroPadValue(normalizeAddress(address), 32);

const settleRpcBatch = async (createOperations: () => Promise<unknown>[]) =>
  withRpcBackoff(async () => {
    const operations = createOperations();
    if (operations.length === 0) return [];

    const results = await Promise.allSettled(operations);
    const retryableFailure = results.find(
      (result) => result.status === 'rejected' && isRetryableRpcError(result.reason),
    );

    if (retryableFailure?.status === 'rejected') {
      throw retryableFailure.reason;
    }

    return results;
  });

const logRejectedRpcResult = (label: string, result?: PromiseSettledResult<unknown>) => {
  if (result?.status === 'rejected') {
    console.error(`${label} failed:`, result.reason);
  }
};

const toBigIntOrZero = (value: unknown) => {
  try {
    if (typeof value === 'bigint') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value));
    if (typeof value === 'string' && value !== '') return BigInt(value);
    if (value !== null && value !== undefined) return BigInt(String(value));
  } catch {
    return 0n;
  }

  return 0n;
};

const bytesFromScaleResult = (scaleBytes: unknown) => {
  if (!scaleBytes) return null;

  if (typeof scaleBytes === 'string') {
    const hex = scaleBytes.replace('0x', '');
    const arr = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      arr[i / 2] = Number.parseInt(hex.substring(i, i + 2), 16);
    }
    return arr;
  }

  if (Array.isArray(scaleBytes)) {
    return new Uint8Array(scaleBytes);
  }

  if (scaleBytes instanceof Uint8Array) {
    return scaleBytes;
  }

  return null;
};

const readScaleCompact = (compactBytes: Uint8Array, cursor: { value: number }): bigint => {
  const first = compactBytes[cursor.value++];
  const mode = first & 0x03;

  if (mode === 0) {
    return BigInt(first >> 2);
  }

  if (mode === 1) {
    const second = compactBytes[cursor.value++];
    return BigInt((first >> 2) | (second << 6));
  }

  if (mode === 2) {
    const b1 = compactBytes[cursor.value++];
    const b2 = compactBytes[cursor.value++];
    const b3 = compactBytes[cursor.value++];
    const val = (first >> 2) | (b1 << 6) | (b2 << 14) | (b3 << 22);
    return BigInt(val >>> 0);
  }

  const len = (first >> 2) + 4;
  let val = 0n;
  for (let i = 0; i < len; i += 1) {
    val |= BigInt(compactBytes[cursor.value++]) << BigInt(i * 8);
  }
  return val;
};

const readCompactByteString = (compactBytes: Uint8Array, cursor: { value: number }) => {
  const length = Number(readScaleCompact(compactBytes, cursor));
  const bytes: number[] = [];

  for (let index = 0; index < length; index += 1) {
    bytes.push(Number(readScaleCompact(compactBytes, cursor)));
  }

  return new TextDecoder().decode(new Uint8Array(bytes)).trim();
};

const skipRawByteVector = (compactBytes: Uint8Array, cursor: { value: number }) => {
  const length = Number(readScaleCompact(compactBytes, cursor));
  cursor.value += length;
};

const skipSubnetIdentityV3 = (compactBytes: Uint8Array, cursor: { value: number }) => {
  const optionTag = compactBytes[cursor.value++];
  if (optionTag !== 1) return;

  for (let fieldIndex = 0; fieldIndex < 8; fieldIndex += 1) {
    skipRawByteVector(compactBytes, cursor);
  }
};

const decodeSubnetCatalog = (scaleBytes: unknown): SubnetCatalogEntry[] => {
  const bytes = bytesFromScaleResult(scaleBytes);
  if (!bytes) return [];

  try {
    const cursor = { value: 0 };
    const subnetCount = Number(readScaleCompact(bytes, cursor));
    if (!Number.isFinite(subnetCount) || subnetCount <= 0) return [];

    const catalog: SubnetCatalogEntry[] = [];

    for (let index = 0; index < subnetCount && cursor.value < bytes.length; index += 1) {
      const optionTag = bytes[cursor.value++];
      if (optionTag !== 1) continue;

      const netuid = Number(readScaleCompact(bytes, cursor));
      cursor.value += 64;

      const name = readCompactByteString(bytes, cursor);
      readCompactByteString(bytes, cursor);

      for (let fieldIndex = 0; fieldIndex < 14; fieldIndex += 1) {
        readScaleCompact(bytes, cursor);
      }

      skipSubnetIdentityV3(bytes, cursor);
      cursor.value += 16;

      catalog.push({
        netuid,
        name: name || 'unknown',
      });
    }

    return catalog;
  } catch (error) {
    console.error('Failed to decode testnet subnet catalog:', error);
    return [];
  }
};

const decodeSimSwapAlphaAmount = (scaleBytes: unknown) => {
  const bytes = bytesFromScaleResult(scaleBytes);
  if (!bytes || bytes.length < 16) return null;

  try {
    let alphaAmountRao = 0n;
    for (let index = 0; index < 8; index += 1) {
      alphaAmountRao |= BigInt(bytes[8 + index]) << BigInt(index * 8);
    }

    return ethers.formatUnits(alphaAmountRao, 9);
  } catch (error) {
    console.error('Failed to decode simulated ALPHA output:', error);
    return null;
  }
};

const getTimestampFromNonce = (nonce?: string) => {
  if (!nonce) return Date.now();

  const numericNonce = Number(nonce);
  if (!Number.isFinite(numericNonce)) return Date.now();

  if (numericNonce > 1_000_000_000_000 && numericNonce < 10_000_000_000_000) {
    return numericNonce;
  }

  if (numericNonce > 946_684_800 && numericNonce < 4_102_444_800) {
    return numericNonce * 1000;
  }

  return Date.now();
};

const getIntentFilledTopics = (userAddress?: string) =>
  userAddress ? [INTENT_FILLED_TOPIC, getAddressTopic(userAddress)] : [INTENT_FILLED_TOPIC];

const sortHistoryLogs = (logs: ethers.Log[]) =>
  logs
    .sort((left, right) => right.blockNumber - left.blockNumber || right.index - left.index)
    .slice(0, HISTORY_MAX_EVENTS);

const fetchPagedIntentFilledLogs = async (userAddress?: string) => {
  const latestBlock = await withRpcBackoff(() => directProvider.getBlockNumber());
  const topics = getIntentFilledTopics(userAddress);
  const ranges: { fromBlock: number; toBlock: number }[] = [];

  for (let fromBlock = CONTRACT_DEPLOY_BLOCK; fromBlock <= latestBlock; fromBlock += HISTORY_LOG_PAGE_SIZE) {
    ranges.push({
      fromBlock,
      toBlock: Math.min(fromBlock + HISTORY_LOG_PAGE_SIZE - 1, latestBlock),
    });
  }

  const results = await settleRpcBatch(() =>
    ranges.map((range) =>
      directProvider.getLogs({
        address: CONFIG.CONTRACT_ADDRESS,
        topics,
        fromBlock: range.fromBlock,
        toBlock: range.toBlock,
      }),
    ),
  );

  return sortHistoryLogs(
    results.flatMap((result, index) => {
      logRejectedRpcResult(`history logs ${ranges[index]?.fromBlock ?? index}`, result);
      return result?.status === 'fulfilled' ? (result.value as ethers.Log[]) : [];
    }),
  );
};

const fetchIntentFilledLogGroups = async (userAddress?: string) => {
  const targets: { source: HistorySource; userAddress?: string }[] = userAddress
    ? [
        { source: 'wallet', userAddress },
        { source: 'contract' },
      ]
    : [{ source: 'contract' }];

  const results = await settleRpcBatch(() =>
    targets.map((target) =>
      directProvider.getLogs({
        address: CONFIG.CONTRACT_ADDRESS,
        topics: getIntentFilledTopics(target.userAddress),
        fromBlock: CONTRACT_DEPLOY_BLOCK,
        toBlock: 'latest',
      }),
    ),
  );

  return Promise.all(
    targets.map(async (target, index) => {
      const result = results[index];

      if (result?.status === 'fulfilled') {
        return {
          source: target.source,
          logs: sortHistoryLogs(result.value as ethers.Log[]),
        };
      }

      logRejectedRpcResult(`${target.source} history logs`, result);
      return {
        source: target.source,
        logs: await fetchPagedIntentFilledLogs(target.userAddress),
      };
    }),
  );
};

const fetchHistoryTransactions = async (logs: ethers.Log[]) => {
  if (logs.length === 0) return [];

  const results = await settleRpcBatch(() =>
    logs.map((log) => directProvider.send('eth_getTransactionByHash', [log.transactionHash])),
  );

  return results.map((result, index) => {
    logRejectedRpcResult(`history transaction ${logs[index]?.transactionHash ?? index}`, result);
    return result?.status === 'fulfilled' ? (result.value as RawRpcTransaction | null) : null;
  });
};

const decodeStakingCall = (callData: string): DecodedStakingCall | null => {
  try {
    const parsedCall = stakingCallInterface.parseTransaction({ data: callData });
    if (!parsedCall) return null;

    if (parsedCall.name === 'addStake' || parsedCall.name === 'removeStake') {
      const [hotkey, amountRao, targetNetuid] = parsedCall.args as unknown as [string, bigint, bigint];
      return {
        name: parsedCall.name,
        hotkey,
        amountRao,
        netuid: Number(targetNetuid),
      };
    }

    if (parsedCall.name === 'removeStakeFull') {
      const [hotkey, targetNetuid] = parsedCall.args as unknown as [string, bigint];
      return {
        name: parsedCall.name,
        hotkey,
        netuid: Number(targetNetuid),
      };
    }
  } catch (error) {
    console.error('Failed to decode staking call from fillIntent:', error);
  }

  return null;
};

const decodeIntentLog = (log: ethers.Log) => {
  try {
    const parsedLog = contractInterface.parseLog({ topics: log.topics, data: log.data });
    if (!parsedLog || parsedLog.name !== 'IntentFilled') {
      return {
        user: decodeIndexedAddress(log.topics[1]),
        solver: decodeIndexedAddress(log.topics[2]),
        nonce: '',
      };
    }

    return {
      user: String(parsedLog.args[0]),
      solver: String(parsedLog.args[1]),
      nonce: parsedLog.args[2]?.toString() ?? '',
    };
  } catch (error) {
    console.error('Failed to decode IntentFilled event:', error);
    return {
      user: decodeIndexedAddress(log.topics[1]),
      solver: decodeIndexedAddress(log.topics[2]),
      nonce: '',
    };
  }
};

const escapeCsvValue = (value: string) => `"${value.replace(/"/g, '""')}"`;

function App() {
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);
  const [account, setAccount] = useState('');
  const [balance, setBalance] = useState('0');
  const [myAlphaBalance, setMyAlphaBalance] = useState('0');
  const [totalAlphaStaked, setTotalAlphaStaked] = useState('0');
  const [allAlphaBalances, setAllAlphaBalances] = useState<{ [id: number]: string }>({});
  const [stakedHotkeys, setStakedHotkeys] = useState<{ [netuid: number]: string }>({});
  const [availableNetuids, setAvailableNetuids] = useState<number[]>(DISPLAY_SUBNETS.map((subnet) => subnet.netuid));
  const [subnetNamesByNetuid, setSubnetNamesByNetuid] = useState<{ [netuid: number]: string }>({});
  const [stakeHistory, setStakeHistory] = useState<StakeEvent[]>([]);
  const [sessionStakeHistory, setSessionStakeHistory] = useState<StakeEvent[]>([]);
  const [walletType, setWalletType] = useState<WalletType | null>(null);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [isWalletHydrating, setIsWalletHydrating] = useState(false);

  const [stakeAmount, setStakeAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');
  const [netuid, setNetuid] = useState<number>(CONFIG.DEFAULT_NETUID);
  const [unstakeNetuid, setUnstakeNetuid] = useState<number>(CONFIG.DEFAULT_NETUID);
  const [stakeAlphaEstimate, setStakeAlphaEstimate] = useState<string | null>(null);
  const [isStakeEstimateLoading, setIsStakeEstimateLoading] = useState(false);
  const [swapAmount, setSwapAmount] = useState('');
  const [swapSourceNetuid, setSwapSourceNetuid] = useState<number>(CONFIG.DEFAULT_NETUID);
  const [swapTargetNetuid, setSwapTargetNetuid] = useState<number>(19);
  const [destinationPage, setDestinationPage] = useState(1);
  const [subnetSearchQuery, setSubnetSearchQuery] = useState('');

  const [surface, setSurface] = useState<Surface>('landing');
  const [appView, setAppView] = useState<AppView>('dashboard');
  const [stakingAction, setStakingAction] = useState<StakingAction>('stake');
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const [historyPage, setHistoryPage] = useState(1);
  const [historySource, setHistorySource] = useState<HistorySource>('contract');
  const [status, setStatus] = useState<StatusState>({ type: 'idle', msg: '' });
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const historyCacheRef = useRef(new Map<string, HistoryCacheEntry>());
  const historyRequestsRef = useRef(new Map<string, Promise<HistoryCacheEntry>>());
  const isWalletConnectingRef = useRef(false);

  const decodeDelegations = (scaleBytes: unknown): { netuid: number; stake: number; hotkey: string }[] => {
    if (!scaleBytes) return [];

    let bytes: Uint8Array;
    if (typeof scaleBytes === 'string') {
      const hex = scaleBytes.replace('0x', '');
      const arr = new Uint8Array(hex.length / 2);
      for (let i = 0; i < hex.length; i += 2) {
        arr[i / 2] = Number.parseInt(hex.substring(i, i + 2), 16);
      }
      bytes = arr;
    } else if (Array.isArray(scaleBytes)) {
      bytes = new Uint8Array(scaleBytes);
    } else if (scaleBytes instanceof Uint8Array) {
      bytes = scaleBytes;
    } else {
      return [];
    }

    const offset = { value: 0 };

    const readCompact = (compactBytes: Uint8Array, cursor: { value: number }): bigint => {
      const first = compactBytes[cursor.value++];
      const mode = first & 0x03;

      if (mode === 0) {
        return BigInt(first >> 2);
      }

      if (mode === 1) {
        const second = compactBytes[cursor.value++];
        return BigInt((first >> 2) | (second << 6));
      }

      if (mode === 2) {
        const b1 = compactBytes[cursor.value++];
        const b2 = compactBytes[cursor.value++];
        const b3 = compactBytes[cursor.value++];
        const val = (first >> 2) | (b1 << 6) | (b2 << 14) | (b3 << 22);
        return BigInt(val >>> 0);
      }

      const len = (first >> 2) + 4;
      let val = 0n;
      for (let i = 0; i < len; i += 1) {
        val |= BigInt(compactBytes[cursor.value++]) << BigInt(i * 8);
      }
      return val;
    };

    const bytesToHex = (hexBytes: Uint8Array) =>
      `0x${Array.from(hexBytes)
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('')}`;

    try {
      const len = Number(readCompact(bytes, offset));
      const results: { netuid: number; stake: number; hotkey: string }[] = [];

      for (let index = 0; index < len; index += 1) {
        const delegateHotkey = bytesToHex(bytes.slice(offset.value, offset.value + 32));
        offset.value += 32;

        readCompact(bytes, offset);

        const nominatorsLen = Number(readCompact(bytes, offset));
        for (let i = 0; i < nominatorsLen; i += 1) {
          offset.value += 32;
          const nominatorStakesLen = Number(readCompact(bytes, offset));
          for (let j = 0; j < nominatorStakesLen; j += 1) {
            readCompact(bytes, offset);
            readCompact(bytes, offset);
          }
        }

        offset.value += 32;

        const registrationsLen = Number(readCompact(bytes, offset));
        for (let i = 0; i < registrationsLen; i += 1) {
          readCompact(bytes, offset);
        }

        const permitsLen = Number(readCompact(bytes, offset));
        for (let i = 0; i < permitsLen; i += 1) {
          readCompact(bytes, offset);
        }

        readCompact(bytes, offset);
        readCompact(bytes, offset);

        const decodedNetuid = Number(readCompact(bytes, offset));
        const stakeRaw = readCompact(bytes, offset);
        const decodedStake = Number(stakeRaw) / 1e9;

        results.push({
          netuid: decodedNetuid,
          stake: decodedStake,
          hotkey: delegateHotkey,
        });
      }

      return results;
    } catch (error) {
      console.error('Failed to decode scale bytes:', error);
      return [];
    }
  };

  const simulateStakeAlpha = async (amount: string, targetNetuid: number): Promise<string | null> => {
    const numericAmount = Number.parseFloat(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || targetNetuid < 0) {
      return null;
    }

    try {
      const amountInRao = ethers.parseEther(amount) / 1000000000n;
      const amountParam = Number(amountInRao);

      if (!Number.isSafeInteger(amountParam) || amountParam <= 0) {
        return null;
      }

      const simulation = await withRpcBackoff(() =>
        directProvider.send('swap_simSwapTaoForAlpha', [targetNetuid, amountParam]),
      );
      return decodeSimSwapAlphaAmount(simulation);
    } catch (error) {
      console.error('Failed to simulate stake output:', error);
      return null;
    }
  };

  const fetchStats = async (address: string) => {
    try {
      const evmHex = CONFIG.CONTRACT_ADDRESS.replace('0x', '');
      const evmAddrBytes = new Uint8Array(evmHex.length / 2);
      for (let i = 0; i < evmHex.length; i += 2) {
        evmAddrBytes[i / 2] = Number.parseInt(evmHex.substring(i, i + 2), 16);
      }

      const prefix = new TextEncoder().encode('evm:');
      const contractInput = new Uint8Array(prefix.length + evmAddrBytes.length);
      contractInput.set(prefix);
      contractInput.set(evmAddrBytes, prefix.length);
      const contractHashBytes = blake2b(contractInput, undefined, 32);
      const contractColdkey = `0x${Array.from(contractHashBytes)
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('')}`;

      const walletHex = address.replace('0x', '');
      const walletAddrBytes = new Uint8Array(walletHex.length / 2);
      for (let i = 0; i < walletHex.length; i += 2) {
        walletAddrBytes[i / 2] = Number.parseInt(walletHex.substring(i, i + 2), 16);
      }

      const walletInput = new Uint8Array(prefix.length + walletAddrBytes.length);
      walletInput.set(prefix);
      walletInput.set(walletAddrBytes, prefix.length);
      const walletHashBytes = blake2b(walletInput, undefined, 32);
      const walletColdkey = `0x${Array.from(walletHashBytes)
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('')}`;

      const hotkey = stakedHotkeys[netuid] || getHotkeyForNetuid(netuid);

      const balances: { [id: number]: string } = {};
      const hotkeysMap: { [id: number]: string } = {};

      const hexToBytes = (hex: string) => {
        const clean = hex.replace('0x', '');
        const bytes: number[] = [];
        for (let i = 0; i < clean.length; i += 2) {
          bytes.push(Number.parseInt(clean.substring(i, i + 2), 16));
        }
        return bytes;
      };

      const [balanceResult, totalAlphaResult, myStakeResult, contractScaleResult, walletScaleResult, subnetInfoResult] =
        await settleRpcBatch(() => [
          directProvider.getBalance(address),
          stakingPrecompile.getTotalAlphaStaked(hotkey, netuid),
          stakingPrecompile.getStake(hotkey, contractColdkey, netuid),
          directProvider.send('delegateInfo_getDelegated', [hexToBytes(contractColdkey)]),
          directProvider.send('delegateInfo_getDelegated', [hexToBytes(walletColdkey)]),
          directProvider.send('subnetInfo_getAllDynamicInfo', []),
        ]);

      logRejectedRpcResult('TAO balance', balanceResult);
      logRejectedRpcResult('getTotalAlphaStaked', totalAlphaResult);
      logRejectedRpcResult('getStake', myStakeResult);
      logRejectedRpcResult('contract delegation positions', contractScaleResult);
      logRejectedRpcResult('wallet delegation positions', walletScaleResult);
      logRejectedRpcResult('available subnet scan', subnetInfoResult);

      setBalance(balanceResult?.status === 'fulfilled' ? ethers.formatEther(toBigIntOrZero(balanceResult.value)) : '0');
      setTotalAlphaStaked(
        totalAlphaResult?.status === 'fulfilled'
          ? (Number(toBigIntOrZero(totalAlphaResult.value)) / 1e9).toString()
          : '0',
      );
      setMyAlphaBalance(
        myStakeResult?.status === 'fulfilled'
          ? (Number(toBigIntOrZero(myStakeResult.value)) / 1e9).toString()
          : '0',
      );

      const contractPositions =
        contractScaleResult?.status === 'fulfilled' ? decodeDelegations(contractScaleResult.value) : [];
      const walletPositions = walletScaleResult?.status === 'fulfilled' ? decodeDelegations(walletScaleResult.value) : [];
      const subnetCatalog =
        subnetInfoResult?.status === 'fulfilled' ? decodeSubnetCatalog(subnetInfoResult.value) : [];

      if (subnetCatalog.length > 0) {
        setAvailableNetuids(subnetCatalog.map((subnet) => subnet.netuid));
        setSubnetNamesByNetuid(
          subnetCatalog.reduce<{ [netuid: number]: string }>((namesByNetuid, subnet) => {
            namesByNetuid[subnet.netuid] = subnet.name || 'unknown';
            return namesByNetuid;
          }, {}),
        );
      }

      for (const position of contractPositions) {
        if (position.stake > 0) {
          balances[position.netuid] = position.stake.toString();
          hotkeysMap[position.netuid] = position.hotkey;
        }
      }

      for (const position of walletPositions) {
        if (position.stake > 0) {
          const existingStake = balances[position.netuid] ? Number.parseFloat(balances[position.netuid]) : 0;
          balances[position.netuid] = (existingStake + position.stake).toString();
          if (!hotkeysMap[position.netuid]) {
            hotkeysMap[position.netuid] = position.hotkey;
          }
        }
      }

      if (balances[netuid] === undefined) {
        balances[netuid] = '0';
      }

      setAllAlphaBalances(balances);
      setStakedHotkeys(hotkeysMap);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchOnchainHistory = async (address?: string, options: { force?: boolean } = {}) => {
    const cacheKey = getHistoryCacheKey(address);
    const cachedHistory = historyCacheRef.current.get(cacheKey);

    if (!options.force && cachedHistory) {
      setHistorySource(cachedHistory.source);
      setStakeHistory(cachedHistory.events);
      setIsHistoryLoading(false);
      return;
    }

    const pendingHistory = historyRequestsRef.current.get(cacheKey);
    if (!options.force && pendingHistory) {
      setIsHistoryLoading(true);
      try {
        const cachedEntry = await pendingHistory;
        if (historyRequestsRef.current.get(cacheKey) === pendingHistory) {
          setHistorySource(cachedEntry.source);
          setStakeHistory(cachedEntry.events);
        }
      } finally {
        setIsHistoryLoading(false);
      }
      return;
    }

    const historyRequest = (async (): Promise<HistoryCacheEntry> => {
      const targetAddress = address ? normalizeAddress(address) : '';

      const decodeHistoryLogs = async (logs: ethers.Log[]) => {
        const orderedLogs = [...logs].sort(
          (left, right) => right.blockNumber - left.blockNumber || right.index - left.index,
        );
        const transactions = await fetchHistoryTransactions(orderedLogs);

        const decodedHistory = orderedLogs.map((log, index): StakeEvent | null => {
          try {
            const intentEvent = decodeIntentLog(log);
            const tx = transactions[index];
            const txData = tx?.input ?? tx?.data;
            if (!txData) return null;

            const txValue = BigInt(tx?.value ?? '0x0');
            const parsedTransaction = contractInterface.parseTransaction({ data: txData, value: txValue });
            if (!parsedTransaction || parsedTransaction.name !== 'fillIntent') return null;

            const intent = parsedTransaction.args[0] as {
              user?: string;
              calls: Array<{ callData: string }>;
            };
            const intentCalls = Array.isArray(intent.calls) ? intent.calls : [];
            const decodedCalls = intentCalls
              .map((call) => decodeStakingCall(call.callData))
              .filter((call): call is DecodedStakingCall => Boolean(call));

            if (decodedCalls.length === 0) return null;

            const addCall = decodedCalls.find((call) => call.name === 'addStake');
            const removeCall = decodedCalls.find(
              (call) => call.name === 'removeStake' || call.name === 'removeStakeFull',
            );
            const timestamp = getTimestampFromNonce(intentEvent.nonce);
            const user = intentEvent.user || (intent.user ? normalizeAddress(intent.user) : '');
            const sharedEventDetails = {
              user,
              solver: intentEvent.solver,
              nonce: intentEvent.nonce,
              txHash: log.transactionHash,
              blockNumber: log.blockNumber,
              timestamp,
            };

            if (addCall && !removeCall) {
              const stakeAmount =
                txValue > 0n
                  ? ethers.formatEther(txValue)
                  : ethers.formatUnits(addCall.amountRao ?? 0n, 9);
              return {
                type: 'stake',
                title: 'Stake TAO',
                detail: `${getSubnetLabel(addCall.netuid)} • Hotkey ${formatShortValue(addCall.hotkey, 8, 6)}`,
                amount: `${formatTokenAmount(stakeAmount)} TAO`,
                ...sharedEventDetails,
              };
            }

            if (removeCall && addCall) {
              return {
                type: 'swap',
                title: 'Move stake',
                detail: `${getSubnetLabel(removeCall.netuid)} → ${getSubnetLabel(addCall.netuid)}`,
                amount:
                  removeCall.name === 'removeStake'
                    ? `${formatTokenAmount(ethers.formatUnits(removeCall.amountRao ?? 0n, 9))} ALPHA`
                    : 'All ALPHA',
                ...sharedEventDetails,
              };
            }

            if (removeCall) {
              return {
                type: 'unstake',
                title: 'Unstake Alpha',
                detail: `${getSubnetLabel(removeCall.netuid)} • Hotkey ${formatShortValue(removeCall.hotkey, 8, 6)}`,
                amount:
                  removeCall.name === 'removeStake'
                    ? `${formatTokenAmount(ethers.formatUnits(removeCall.amountRao ?? 0n, 9))} ALPHA`
                    : 'All ALPHA',
                ...sharedEventDetails,
              };
            }

            return null;
          } catch (error) {
            console.error('Failed to reconstruct on-chain history entry:', error);
            return null;
          }
        });

        return decodedHistory
          .filter((event): event is StakeEvent => Boolean(event))
          .sort((left, right) => right.timestamp - left.timestamp || right.blockNumber - left.blockNumber);
      };

      const logGroups = await fetchIntentFilledLogGroups(targetAddress || undefined);
      const walletLogGroup = logGroups.find((group) => group.source === 'wallet');
      const contractLogGroup = logGroups.find((group) => group.source === 'contract');
      let historySourceForLogs: HistorySource = walletLogGroup && walletLogGroup.logs.length > 0 ? 'wallet' : 'contract';
      let nextHistory = await decodeHistoryLogs(
        historySourceForLogs === 'wallet' ? walletLogGroup?.logs ?? [] : contractLogGroup?.logs ?? [],
      );

      if (targetAddress && historySourceForLogs === 'wallet' && nextHistory.length === 0) {
        historySourceForLogs = 'contract';
        nextHistory = await decodeHistoryLogs(contractLogGroup?.logs ?? []);
      }

      return {
        events: nextHistory,
        source: historySourceForLogs,
      };
    })();

    historyRequestsRef.current.set(cacheKey, historyRequest);
    setIsHistoryLoading(true);

    try {
      const nextHistoryEntry = await historyRequest;
      if (historyRequestsRef.current.get(cacheKey) === historyRequest) {
        historyCacheRef.current.set(cacheKey, nextHistoryEntry);
        setHistorySource(nextHistoryEntry.source);
        setStakeHistory(nextHistoryEntry.events);
      }
    } catch (error) {
      if (historyRequestsRef.current.get(cacheKey) === historyRequest) {
        console.error('Failed to fetch contract-backed history:', error);
        setHistorySource('contract');
        setStakeHistory([]);
      }
    } finally {
      if (historyRequestsRef.current.get(cacheKey) === historyRequest) {
        historyRequestsRef.current.delete(cacheKey);
      }
      setIsHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (surface !== 'app' || appView === 'history' || !provider || !account) return undefined;

    const timer = window.setTimeout(() => {
      if (typeof netuid === 'number' && netuid >= 0) {
        fetchStats(account);
      }
    }, 500);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [netuid, account, provider, surface, appView]);

  useEffect(() => {
    setDestinationPage(1);
  }, [stakingAction, availableNetuids.length, subnetSearchQuery]);

  useEffect(() => {
    if (surface !== 'app' || appView !== 'dashboard' || stakingAction !== 'stake' || !stakeAmount) {
      setStakeAlphaEstimate(null);
      setIsStakeEstimateLoading(false);
      return undefined;
    }

    let cancelled = false;
    setIsStakeEstimateLoading(true);

    const timer = window.setTimeout(() => {
      void simulateStakeAlpha(stakeAmount, netuid).then((estimate) => {
        if (cancelled) return;
        setStakeAlphaEstimate(estimate);
        setIsStakeEstimateLoading(false);
      });
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stakeAmount, netuid, stakingAction, surface, appView]);

  const clearWalletState = () => {
    setIsWalletHydrating(false);
    setIsHistoryLoading(false);
    setAccount('');
    setSigner(null);
    setProvider(null);
    setStatus({ type: 'idle', msg: '' });
    setBalance('0');
    setHistorySource('contract');
    setTotalAlphaStaked('0');
    setMyAlphaBalance('0');
    setStakeHistory([]);
    setSessionStakeHistory([]);
    setAllAlphaBalances({});
    setStakedHotkeys({});
    setStakeAlphaEstimate(null);
    setIsStakeEstimateLoading(false);
    setSubnetNamesByNetuid({});
    setAvailableNetuids(DISPLAY_SUBNETS.map((subnet) => subnet.netuid));
    setDestinationPage(1);
    setSubnetSearchQuery('');
    setWalletType(null);
    setShowWalletModal(false);
    localStorage.removeItem('connected_wallet');
    if (appView === 'history') {
      void fetchOnchainHistory();
    }
  };

  const disconnectWallet = async () => {
    const selectedWallet = walletType || (localStorage.getItem('connected_wallet') as WalletType | null);
    clearWalletState();

    try {
      const ethereumProvider = getInjectedProvider(selectedWallet);

      if (ethereumProvider) {
        await ethereumProvider.request({
          method: 'wallet_revokePermissions',
          params: [{ eth_accounts: {} }],
        });
      }
    } catch (error) {
      console.error('Failed to revoke permissions:', error);
    }
  };

  const connectWallet = async (wallet?: WalletType) => {
    const selectedWallet = wallet || (localStorage.getItem('connected_wallet') as WalletType) || 'metamask';
    const ethereumProvider = getInjectedProvider(selectedWallet);

    if (!ethereumProvider) {
      setIsWalletHydrating(false);
      setStatus({ type: 'error', msg: `${selectedWallet === 'talisman' ? 'Talisman' : 'MetaMask'} not installed` });
      return;
    }

    if (isWalletConnectingRef.current) return;
    isWalletConnectingRef.current = true;

    try {
      setIsWalletHydrating(true);
      setStatus({
        type: 'loading',
        msg: `Connecting to ${selectedWallet === 'talisman' ? 'Talisman' : 'MetaMask'}...`,
      });

      const prov = new ethers.BrowserProvider(ethereumProvider as ethers.Eip1193Provider);
      const network = await prov.getNetwork();

      if (network.chainId !== BigInt(CONFIG.NETWORK.chainId)) {
        try {
          await ethereumProvider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: CONFIG.NETWORK.chainId }],
          });
        } catch (switchError: unknown) {
          const isMissingChainError =
            typeof switchError === 'object' &&
            switchError !== null &&
            'code' in switchError &&
            switchError.code === 4902;

          if (isMissingChainError) {
            await ethereumProvider.request({
              method: 'wallet_addEthereumChain',
              params: [CONFIG.NETWORK],
            });
          } else {
            throw switchError;
          }
        }
      }

      await prov.send('eth_requestAccounts', []);
      const nextSigner = await prov.getSigner();
      const address = await nextSigner.getAddress();

      setProvider(prov);
      setSigner(nextSigner);
      setAccount(address);
      setWalletType(selectedWallet);
      localStorage.setItem('connected_wallet', selectedWallet);
      setShowWalletModal(false);
      setStakeHistory([]);
      setSessionStakeHistory([]);
      if (surface === 'app' && appView === 'history') {
        await fetchOnchainHistory(address);
      }

      setIsWalletHydrating(false);
      setStatus({ type: 'idle', msg: '' });
    } catch (error: unknown) {
      console.error(error);
      setIsWalletHydrating(false);
      setStatus({ type: 'error', msg: error instanceof Error ? error.message : 'Failed to connect' });
    } finally {
      isWalletConnectingRef.current = false;
    }
  };

  useEffect(() => {
    const savedWallet = localStorage.getItem('connected_wallet') as WalletType | null;
    if (savedWallet) {
      void Promise.resolve().then(() => connectWallet(savedWallet));
    }

    const ethereumProvider =
      savedWallet === 'talisman'
        ? window.talismanEth || window.ethereum
        : window.ethereum;

    if (!ethereumProvider) {
      return undefined;
    }

      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length > 0) {
          connectWallet();
        } else {
          clearWalletState();
        }
      };

      const handleChainChanged = () => {
        window.location.reload();
      };

      const accountsChangedListener = (...args: unknown[]) => {
        const [value] = args;
        const accounts = Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
        handleAccountsChanged(accounts);
      };

      const chainChangedListener = () => {
        handleChainChanged();
      };

      if (ethereumProvider.on) {
        ethereumProvider.on('accountsChanged', accountsChangedListener);
        ethereumProvider.on('chainChanged', chainChangedListener);
      }

      return () => {
        if (ethereumProvider.removeListener) {
          ethereumProvider.removeListener('accountsChanged', accountsChangedListener);
          ethereumProvider.removeListener('chainChanged', chainChangedListener);
        }
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signAndExecuteIntent = async (
    calls: IntentCall[],
    condition: IntentCondition,
    valueToSend: bigint,
  ): Promise<{ txHash: string; blockNumber: number } | null> => {
    if (!signer || !account) return null;

    try {
      const contract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      const domain = {
        name: 'SynchronousIntent',
        version: '1',
        chainId: Number(CONFIG.NETWORK.chainId),
        verifyingContract: CONFIG.CONTRACT_ADDRESS,
      };

      const types = {
        Condition: [
          { name: 'asset', type: 'uint8' },
          { name: 'minOutput', type: 'uint256' },
          { name: 'hotkey', type: 'bytes32' },
          { name: 'netuid', type: 'uint16' },
        ],
        Call: [
          { name: 'target', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'callData', type: 'bytes' },
        ],
        Intent: [
          { name: 'user', type: 'address' },
          { name: 'calls', type: 'Call[]' },
          { name: 'condition', type: 'Condition' },
          { name: 'deadline', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
        ],
      };

      const { deadline, nonce } = getIntentTiming();

      const intentValue = {
        user: account,
        calls,
        condition,
        deadline,
        nonce,
      };

      setStatus({ type: 'loading', msg: 'Requesting signature in your wallet...' });
      const signature = await signer.signTypedData(domain, types, intentValue);

      const intentWithSig = {
        ...intentValue,
        signature,
      };

      setStatus({ type: 'loading', msg: 'Broadcasting fillIntent transaction...' });
      const tx = await contract.fillIntent(intentWithSig, '0x', {
        value: valueToSend,
        gasLimit: 800000n,
      });

      setStatus({ type: 'loading', msg: 'Waiting for blockchain confirmation...' });
      const receipt = await tx.wait();

      return {
        txHash: tx.hash,
        blockNumber: receipt?.blockNumber ?? 0,
      };
    } catch (error: unknown) {
      console.error(error);
      const reason =
        typeof error === 'object' && error !== null && 'reason' in error && typeof error.reason === 'string'
          ? error.reason
          : error instanceof Error
            ? error.message
            : 'Transaction failed';
      setStatus({ type: 'error', msg: reason });
      return null;
    }
  };

  const executeStake = async (amount: string, targetNetuid: number, targetHotkey?: string): Promise<boolean> => {
    if (!signer || !amount) return false;

    try {
      setStatus({ type: 'loading', msg: `Preparing stake intent for ${amount} TAO...` });

      const amountInWei = ethers.parseEther(amount);
      const amountInRao = amountInWei / 1000000000n;

      const hotkey =
        targetHotkey && targetHotkey.startsWith('0x') && targetHotkey.length === 66
          ? targetHotkey
          : getHotkeyForNetuid(targetNetuid);

      const stakingInterface = new ethers.Interface([
        'function addStake(bytes32 hotkey, uint256 amount, uint256 netuid) external',
      ]);

      const calls = [
        {
          target: '0x0000000000000000000000000000000000000805',
          value: 0n,
          callData: stakingInterface.encodeFunctionData('addStake', [hotkey, amountInRao, targetNetuid]),
        },
      ];

      const condition = {
        asset: 1,
        minOutput: 0n,
        hotkey,
        netuid: targetNetuid,
      };

      const txResult = await signAndExecuteIntent(calls, condition, amountInWei);
      if (txResult) {
        setSessionStakeHistory((prev) =>
          mergeHistoryEvents(
            [
              {
                type: 'stake',
                title: 'Stake TAO',
                detail: `${getSubnetLabel(targetNetuid)} • Hotkey ${formatShortValue(hotkey, 8, 6)}`,
                amount: `${formatTokenAmount(amount)} TAO`,
                user: account,
                txHash: txResult.txHash,
                blockNumber: txResult.blockNumber,
                timestamp: Date.now(),
              },
            ],
            prev,
          ),
        );
        setStatus({ type: 'success', msg: 'Stake intent executed successfully.' });
        await fetchStats(account);
        await fetchOnchainHistory(account, { force: true });
        return true;
      }

      return false;
    } catch (error: unknown) {
      console.error(error);
      const reason =
        typeof error === 'object' && error !== null && 'reason' in error && typeof error.reason === 'string'
          ? error.reason
          : error instanceof Error
            ? error.message
            : 'Failed to prepare stake';
      setStatus({ type: 'error', msg: reason });
      return false;
    }
  };

  const executeUnstake = async (
    targetNetuid: number,
    amountOrHotkey?: string,
    amountIfHotkeyUsed?: string,
  ): Promise<boolean> => {
    if (!signer) return false;

    try {
      setStatus({ type: 'loading', msg: 'Preparing unstake intent...' });

      let hotkey = getHotkeyForNetuid(targetNetuid);
      let amount = amountOrHotkey;

      if (amountOrHotkey && amountOrHotkey.startsWith('0x') && amountOrHotkey.length === 66) {
        hotkey = amountOrHotkey;
        amount = amountIfHotkeyUsed;
      }

      const stakingInterface = new ethers.Interface([
        'function removeStake(bytes32 hotkey, uint256 amount, uint256 netuid) external',
        'function removeStakeFull(bytes32 hotkey, uint256 netuid) external',
      ]);

      const callData =
        amount && amount !== '' && Number.parseFloat(amount) > 0
          ? stakingInterface.encodeFunctionData('removeStake', [
              hotkey,
              ethers.parseUnits(amount, 9),
              targetNetuid,
            ])
          : stakingInterface.encodeFunctionData('removeStakeFull', [hotkey, targetNetuid]);

      const calls = [
        {
          target: '0x0000000000000000000000000000000000000805',
          value: 0n,
          callData,
        },
      ];

      const condition = {
        asset: 0,
        minOutput: 0n,
        hotkey: ethers.ZeroHash,
        netuid: 0,
      };

      const txResult = await signAndExecuteIntent(calls, condition, 0n);
      if (txResult) {
        setSessionStakeHistory((prev) =>
          mergeHistoryEvents(
            [
              {
                type: 'unstake',
                title: 'Unstake Alpha',
                detail: `${getSubnetLabel(targetNetuid)} • Hotkey ${formatShortValue(hotkey, 8, 6)}`,
                amount: amount && Number.parseFloat(amount) > 0 ? `${formatTokenAmount(amount)} ALPHA` : 'All ALPHA',
                user: account,
                txHash: txResult.txHash,
                blockNumber: txResult.blockNumber,
                timestamp: Date.now(),
              },
            ],
            prev,
          ),
        );
        setStatus({ type: 'success', msg: 'Unstake intent executed successfully.' });
        await fetchStats(account);
        await fetchOnchainHistory(account, { force: true });
        return true;
      }

      return false;
    } catch (error: unknown) {
      console.error(error);
      const reason =
        typeof error === 'object' && error !== null && 'reason' in error && typeof error.reason === 'string'
          ? error.reason
          : error instanceof Error
            ? error.message
            : 'Failed to prepare unstake';
      setStatus({ type: 'error', msg: reason });
      return false;
    }
  };

  const executeSwap = async (
    sourceNetuid: number,
    targetNetuid: number,
    amountOrHotkey: string,
    amountIfHotkeyUsed?: string,
  ): Promise<boolean> => {
    if (!signer || !amountOrHotkey) return false;

    try {
      setStatus({ type: 'loading', msg: 'Preparing subnet rotation intent...' });

      let sourceHotkey = getHotkeyForNetuid(sourceNetuid);
      let targetHotkey = getHotkeyForNetuid(targetNetuid);
      let amount = amountOrHotkey;

      if (amountOrHotkey.startsWith('0x') && amountOrHotkey.length === 66) {
        sourceHotkey = amountOrHotkey;
        targetHotkey = getHotkeyForNetuid(targetNetuid);
        amount = amountIfHotkeyUsed || '';
      }

      const amountInRao = ethers.parseUnits(amount, 9);

      let priceInRao = 1000000000n;
      try {
        setStatus({ type: 'loading', msg: 'Fetching Alpha spot exchange rate...' });
        const priceRes = await withRpcBackoff(() => directProvider.send('swap_currentAlphaPrice', [sourceNetuid]));
        if (priceRes) {
          priceInRao = BigInt(priceRes);
        }
      } catch (error) {
        console.error('Failed to query swap_currentAlphaPrice:', error);
      }

      const expectedTaoInRao = (amountInRao * priceInRao * 950n) / (1000n * 1000000000n);

      setStatus({ type: 'loading', msg: 'Preparing subnet rotation intent...' });

      const stakingInterface = new ethers.Interface([
        'function addStake(bytes32 hotkey, uint256 amount, uint256 netuid) external',
        'function removeStake(bytes32 hotkey, uint256 amount, uint256 netuid) external',
      ]);

      const calls = [
        {
          target: '0x0000000000000000000000000000000000000805',
          value: 0n,
          callData: stakingInterface.encodeFunctionData('removeStake', [
            sourceHotkey,
            amountInRao,
            sourceNetuid,
          ]),
        },
        {
          target: '0x0000000000000000000000000000000000000805',
          value: 0n,
          callData: stakingInterface.encodeFunctionData('addStake', [
            targetHotkey,
            expectedTaoInRao,
            targetNetuid,
          ]),
        },
      ];

      const condition = {
        asset: 1,
        minOutput: 0n,
        hotkey: targetHotkey,
        netuid: targetNetuid,
      };

      const txResult = await signAndExecuteIntent(calls, condition, 0n);
      if (txResult) {
        setSessionStakeHistory((prev) =>
          mergeHistoryEvents(
            [
              {
                type: 'swap',
                title: 'Move stake',
                detail: `${getSubnetLabel(sourceNetuid)} → ${getSubnetLabel(targetNetuid)}`,
                amount: `${formatTokenAmount(amount)} ALPHA`,
                user: account,
                txHash: txResult.txHash,
                blockNumber: txResult.blockNumber,
                timestamp: Date.now(),
              },
            ],
            prev,
          ),
        );
        setStatus({ type: 'success', msg: 'Subnet rotation executed successfully.' });
        await fetchStats(account);
        await fetchOnchainHistory(account, { force: true });
        return true;
      }

      return false;
    } catch (error: unknown) {
      console.error(error);
      const reason =
        typeof error === 'object' && error !== null && 'reason' in error && typeof error.reason === 'string'
          ? error.reason
          : error instanceof Error
            ? error.message
            : 'Failed to prepare subnet rotation';
      setStatus({ type: 'error', msg: reason });
      return false;
    }
  };

  const handleBuyAlpha = async () => {
    const hotkey = stakedHotkeys[netuid] || getHotkeyForNetuid(netuid);
    if (await executeStake(stakeAmount, netuid, hotkey)) {
      setStakeAmount('');
      setAppView('history');
    }
  };

  const handleUnstake = async () => {
    const hotkey = stakedHotkeys[unstakeNetuid] || getHotkeyForNetuid(unstakeNetuid);
    if (await executeUnstake(unstakeNetuid, hotkey, unstakeAmount)) {
      setUnstakeAmount('');
      setAppView('history');
    }
  };

  const handleSwap = async () => {
    const amountToSwap = swapAmount !== '' ? swapAmount : allAlphaBalances[swapSourceNetuid] || '0';
    if (!amountToSwap || Number.parseFloat(amountToSwap) <= 0) {
      setStatus({ type: 'error', msg: 'Please enter a valid amount of ALPHA to move.' });
      return;
    }

    const hotkey = stakedHotkeys[swapSourceNetuid] || getHotkeyForNetuid(swapSourceNetuid);
    if (await executeSwap(swapSourceNetuid, swapTargetNetuid, hotkey, amountToSwap)) {
      setSwapAmount('');
      setAppView('history');
    }
  };

  const openApp = (view: AppView = 'chat') => {
    setSurface('app');
    setAppView(view);
    if (view === 'history') {
      void fetchOnchainHistory(account || undefined);
    }
  };

  const renderWalletCardStyle = (option: WalletOption): CSSProperties =>
    ({
      '--wallet-accent': option.accent,
      '--wallet-accent-rgb': option.accentRgb,
    }) as CSSProperties;

  const activePositions = Object.entries(allAlphaBalances).filter(([, bal]) => Number.parseFloat(bal) > 0);
  const stakingPositions: StakingPositionSummary[] = activePositions
    .map(([id, bal]) => {
      const targetNetuid = Number(id);

      return {
        netuid: targetNetuid,
        hotkey: stakedHotkeys[targetNetuid] || getHotkeyForNetuid(targetNetuid),
        amount: formatTokenAmount(bal),
        apy: getMockApyForNetuid(targetNetuid),
      };
    })
    .sort((left, right) => Number.parseFloat(right.amount) - Number.parseFloat(left.amount));
  const stakingPositionsByNetuid = new Map(stakingPositions.map((position) => [position.netuid, position]));
  const hasSubnetCatalog = Object.keys(subnetNamesByNetuid).length > 0;
  const getUiSubnetPresentation = (targetNetuid: number): SubnetPresentation => {
    const presentation = getSubnetPresentation(targetNetuid);
    const registeredName = subnetNamesByNetuid[targetNetuid];

    if (registeredName !== undefined || hasSubnetCatalog) {
      return {
        ...presentation,
        name: registeredName || 'unknown',
        category: 'Registered testnet subnet',
      };
    }

    return presentation;
  };
  const getUiSubnetLabel = (targetNetuid: number) => {
    const subnetMeta = getUiSubnetPresentation(targetNetuid);
    return `${subnetMeta.code} — ${subnetMeta.name}`;
  };
  const connectingWallet =
    !account && status.type === 'loading'
      ? WALLET_OPTIONS.find((option) => status.msg.toLowerCase().includes(option.label.toLowerCase()))?.id ?? null
      : null;
  const showStatusBanner = Boolean(status.msg) && !(status.type === 'loading' && (!account || isWalletHydrating));
  const combinedHistory = mergeHistoryEvents(stakeHistory, sessionStakeHistory);
  const filteredHistory =
    historyFilter === 'all' ? combinedHistory : combinedHistory.filter((event) => event.type === historyFilter);
  const historyPageCount = Math.max(1, Math.ceil(filteredHistory.length / HISTORY_PAGE_SIZE));
  const currentHistoryPage = Math.min(historyPage, historyPageCount);
  const paginatedHistory = filteredHistory.slice(
    (currentHistoryPage - 1) * HISTORY_PAGE_SIZE,
    currentHistoryPage * HISTORY_PAGE_SIZE,
  );
  const historyPageStart = filteredHistory.length > 0 ? (currentHistoryPage - 1) * HISTORY_PAGE_SIZE + 1 : 0;
  const historyPageEnd = Math.min(currentHistoryPage * HISTORY_PAGE_SIZE, filteredHistory.length);
  const historyNote =
    historySource === 'wallet' && account
      ? `Showing decoded IntentFilled events for ${formatShortValue(account, 6, 4)}.`
      : account
        ? 'No decoded activity for this wallet yet. Showing latest decoded contract events.'
        : 'Showing latest decoded IntentFilled events from the intent contract.';
  const selectedStakeSubnet = getUiSubnetPresentation(netuid);
  const selectedSwapSourceSubnet = getUiSubnetPresentation(swapSourceNetuid);
  const selectedSwapTargetSubnet = getUiSubnetPresentation(swapTargetNetuid);
  const selectedUnstakeSubnet = getUiSubnetPresentation(unstakeNetuid);

  const handleExportHistory = () => {
    const rows = [
      ['Date', 'Type', 'Details', 'Amount', 'User', 'Solver', 'Nonce', 'Status', 'Tx Hash'],
      ...filteredHistory.map((event) => [
        new Date(event.timestamp).toISOString(),
        event.title,
        event.detail,
        event.amount,
        event.user,
        event.solver ?? '',
        event.nonce ?? '',
        'Done',
        event.txHash,
      ]),
    ];
    const csv = rows.map((row) => row.map(escapeCsvValue).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `taochat-history-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const renderWalletModalOption = (option: WalletOption) => {
    const isConnecting = connectingWallet === option.id;

    return (
      <button
        key={option.id}
        type="button"
        className={`wallet-modal-option ${isConnecting ? 'is-loading' : ''}`}
        style={renderWalletCardStyle(option)}
        onClick={() => connectWallet(option.id)}
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
  };

  const renderInlineWalletPill = () =>
    account ? (
      <div className="wallet-inline-actions">
        <div className="wpill">
          <div className="wdot" />
          <div className="waddr">{formatShortValue(account, 6, 4)}</div>
          <div className="wnet">Testnet</div>
        </div>
        <button type="button" className="tao-btn tao-btn--ghost tao-btn--small" onClick={disconnectWallet}>
          Disconnect
        </button>
      </div>
    ) : (
      <button type="button" className="tao-btn tao-btn--primary tao-btn--small" onClick={() => setShowWalletModal(true)}>
        Connect wallet
      </button>
    );

  const renderLoadingState = () => (
    <div className="loading-shell">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="loading-card shimmer-block" />
      ))}
    </div>
  );

  const renderDashboardView = () => {
    if (isWalletHydrating) {
      return renderLoadingState();
    }

    const stakeAmountValue = Number.parseFloat(stakeAmount || '0');
    const swapAmountValue = Number.parseFloat(swapAmount || allAlphaBalances[swapSourceNetuid] || '0');
    const unstakeAmountValue = Number.parseFloat(unstakeAmount || allAlphaBalances[unstakeNetuid] || '0');
    const selectedApy = Number.parseFloat(
      (stakingAction === 'stake'
        ? selectedStakeSubnet.apy
        : stakingAction === 'swap'
          ? selectedSwapTargetSubnet.apy
          : selectedUnstakeSubnet.apy
      ).replace('%', ''),
    );
    const simulationBase =
      stakingAction === 'stake' ? stakeAmountValue : stakingAction === 'swap' ? swapAmountValue : unstakeAmountValue;
    const thirtyDayReturn = (simulationBase * selectedApy) / 12 / 100;
    const ninetyDayReturn = (simulationBase * selectedApy) / 4 / 100;
    const yearlyReturn = (simulationBase * selectedApy) / 100;
    const activeSwapSources = activePositions.length > 0 ? activePositions : [['310', allAlphaBalances[310] || '0']];
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
    const sidePanelRouteNetuids = sidePanelShowsCurrentPositions
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
        ? 'Testnet destination'
        : sidePanelShowsCurrentPositions
          ? 'Current positions'
          : 'Testnet destination';

    return (
      <div className="swap-wrap">
        <div className="swap-head">
          <h2>Swap &amp; Stake</h2>
          {renderInlineWalletPill()}
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
                {stakingAction === 'swap' && (
                  <div className="swap-source-picker">
                    <div className="swap-source-picker__label">Source route</div>
                    <div className="swap-source-picker__row">
                      {activeSwapSources.map(([id, bal]) => (
                        <button
                          key={id}
                          type="button"
                          className={`swap-source-pill ${swapSourceNetuid === Number(id) ? 'is-active' : ''}`}
                          onClick={() => setSwapSourceNetuid(Number(id))}
                        >
                          {getUiSubnetLabel(Number(id))} · {formatTokenAmount(bal)} ALPHA
                        </button>
                      ))}
                    </div>
                  </div>
                )}

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
                    <div className="tok">
                      <div className={`tok-ic ${stakingAction === 'stake' ? 'it' : 'ia'}`}>
                        {stakingAction === 'stake' ? 'τ' : 'α'}
                      </div>
                      {stakingAction === 'stake' ? 'TAO' : 'ALPHA'}
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
                  <button type="button" className="swaptog">
                    ⇅
                  </button>
                </div>

                <div className="tbox">
                  <div className="tbox-top">
                    <span className="tbox-label">
                      {stakingAction === 'stake'
                        ? 'You receive (staked)'
                        : stakingAction === 'swap'
                          ? 'You receive'
                          : 'You receive back'}
                    </span>
                    <span className="tbox-bal">Bittensor EVM testnet only</span>
                  </div>
                  <div className="tbox-main">
                    <div className="tok">
                      <div className={`tok-ic ${stakingAction === 'unstake' ? 'it' : 'ia'}`}>
                        {stakingAction === 'unstake' ? 'τ' : 'α'}
                      </div>
                      {stakingAction === 'unstake' ? 'TAO' : 'ALPHA'}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="tok-amt" style={stakingAction !== 'unstake' ? { color: 'var(--text-2)' } : undefined}>
                        ≈
                        {stakingAction === 'stake' && isStakeEstimateLoading
                          ? '...'
                          : formatTokenAmount(
                              stakingAction === 'stake'
                                ? stakeAlphaEstimate ?? '0'
                                : stakingAction === 'swap'
                                  ? swapAmount || allAlphaBalances[swapSourceNetuid] || '0'
                                  : unstakeAmount || allAlphaBalances[unstakeNetuid] || '0',
                              stakingAction === 'stake' ? 6 : 4,
                            )}
                      </div>
                      <div className="tok-usd">
                        {stakingAction === 'stake'
                          ? stakeAlphaEstimate
                            ? `Simulated on ${selectedStakeSubnet.code}`
                            : `Staked on ${selectedStakeSubnet.code}`
                          : stakingAction === 'swap'
                            ? `Moved to ${selectedSwapTargetSubnet.code}`
                            : 'Returned to connected wallet'}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ margin: '1rem 0 .5rem' }}>
                  {stakingAction === 'stake' && (
                    <>
                      <div className="det-row">
                        <span>Testnet destination</span>
                        <span>{getUiSubnetLabel(netuid)}</span>
                      </div>
                      <div className="det-row">
                        <span>Current APY</span>
                        <span style={{ color: 'var(--success)' }}>{selectedStakeSubnet.apy}</span>
                      </div>
                      <div className="det-row">
                        <span>Simulated ALPHA</span>
                        <span style={{ color: 'var(--success)' }}>
                          {isStakeEstimateLoading
                            ? 'Simulating...'
                            : stakeAlphaEstimate
                              ? `≈${formatTokenAmount(stakeAlphaEstimate, 6)} ALPHA`
                              : 'Enter amount'}
                        </span>
                      </div>
                    </>
                  )}
                  {stakingAction === 'swap' && (
                    <>
                      <div className="det-row">
                        <span>Source route</span>
                        <span>{getUiSubnetLabel(swapSourceNetuid)}</span>
                      </div>
                      <div className="det-row">
                        <span>Destination</span>
                        <span>{getUiSubnetLabel(swapTargetNetuid)}</span>
                      </div>
                    </>
                  )}
                  {stakingAction === 'unstake' && (
                    <>
                      <div className="det-row">
                        <span>From subnet</span>
                        <span>{getUiSubnetLabel(unstakeNetuid)}</span>
                      </div>
                      <div className="det-row">
                        <span>Unbonding</span>
                        <span>~12 seconds</span>
                      </div>
                    </>
                  )}
                  <div className="det-row">
                    <span>Network gas</span>
                    <span>~0.0004 TAO</span>
                  </div>
                  <div className="det-row">
                    <span>Estimated arrival</span>
                    <span style={{ color: 'var(--success)' }}>~12 seconds</span>
                  </div>
                </div>

                <div className="swap-sim">
                  <div className="swap-sim-t">
                    {stakingAction === 'unstake'
                      ? 'Estimated unlocked TAO'
                      : `Simulated returns at ${selectedApy.toFixed(1)}% APY`}
                  </div>
                  <div className="swap-sim-g">
                    <div className="ssim">
                      <div className="ssim-p">30 days</div>
                      <div className="ssim-v">
                        {stakingAction === 'unstake' ? formatTokenAmount(String(simulationBase)) : `+${formatTokenAmount(String(thirtyDayReturn))}`}
                      </div>
                    </div>
                    <div className="ssim">
                      <div className="ssim-p">90 days</div>
                      <div className="ssim-v">
                        {stakingAction === 'unstake' ? formatTokenAmount(String(simulationBase)) : `+${formatTokenAmount(String(ninetyDayReturn))}`}
                      </div>
                    </div>
                    <div className="ssim">
                      <div className="ssim-p">1 year</div>
                      <div className="ssim-v">
                        {stakingAction === 'unstake' ? formatTokenAmount(String(simulationBase)) : `+${formatTokenAmount(String(yearlyReturn))}`}
                      </div>
                    </div>
                  </div>
                </div>

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
                      (swapAmount === '' &&
                        (!allAlphaBalances[swapSourceNetuid] || Number.parseFloat(allAlphaBalances[swapSourceNetuid]) === 0))
                    }
                  >
                    Move stake to {selectedSwapTargetSubnet.code} →
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
                      : 'Choose which Bittensor testnet subnet receives your position. External-chain funding stays marked as coming soon.'}
                </p>
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
                        stakingAction === 'stake'
                          ? netuid === displayNetuid
                          : stakingAction === 'swap'
                            ? swapTargetNetuid === displayNetuid
                            : unstakeNetuid === displayNetuid;
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
                              : stakingAction === 'swap'
                                ? setSwapTargetNetuid(displayNetuid)
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
                                <small>{routeApy} APY</small>
                              </>
                            ) : (
                              routeApy
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
  };

  const renderHistoryView = () => (
    <div className="hist-wrap">
      <div className="hist-top">
        <h2>History</h2>
        <button
          type="button"
          className="tao-btn tao-btn--ghost tao-btn--small"
          onClick={handleExportHistory}
          disabled={filteredHistory.length === 0}
        >
          Export CSV
        </button>
      </div>

      <div className="frow">
        {[
          { id: 'all' as const, label: 'All' },
          { id: 'stake' as const, label: 'Stakes' },
          { id: 'unstake' as const, label: 'Unstakes' },
          { id: 'swap' as const, label: 'Moves' },
        ].map((filter) => (
          <button
            key={filter.id}
            type="button"
            className={`fp ${historyFilter === filter.id ? 'on' : ''}`}
            onClick={() => {
              setHistoryFilter(filter.id);
              setHistoryPage(1);
            }}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="history-note">{historyNote}</div>

      {isHistoryLoading ? (
        <div className="empty">
          <div className="empty-ic">◌</div>
          <div className="empty-t">Loading contract history</div>
          <div className="empty-d">Fetching confirmed stake, unstake, and move intents from the contract.</div>
        </div>
      ) : filteredHistory.length > 0 ? (
        <>
          <table className="htable">
            <thead>
              <tr>
                <th style={{ width: '130px' }}>Date</th>
                <th style={{ width: '110px' }}>Type</th>
                <th>Details</th>
                <th style={{ width: '120px' }}>Amount</th>
                <th style={{ width: '85px' }}>Status</th>
                <th style={{ width: '105px' }}>Tx Hash</th>
              </tr>
            </thead>
            <tbody>
              {paginatedHistory.map((event) => (
                <tr key={`${event.txHash}-${event.timestamp}`}>
                  <td style={{ color: 'var(--text-2)' }}>{formatHistoryTime(event.timestamp)}</td>
                  <td>
                    <span className={`tt ${event.type === 'stake' ? 'tt-s' : event.type === 'unstake' ? 'tt-u' : 'tt-x'}`}>
                      {event.type === 'stake' ? '↑ Stake' : event.type === 'unstake' ? '↓ Unstake' : '⇄ Move'}
                    </span>
                  </td>
                  <td>{event.detail}</td>
                  <td className={event.type === 'unstake' ? 'amt-n' : 'amt-p'}>
                    {event.type === 'unstake' ? '−' : '+'}
                    {event.amount}
                  </td>
                  <td className="tx-ok">✓ Done</td>
                  <td>
                    <a
                      href={`${EXPLORER_BASE_URL}${event.txHash}`}
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

          <div className="history-pagination">
            <div className="history-pagination__range">
              Showing {historyPageStart}-{historyPageEnd} of {filteredHistory.length}
            </div>
            <div className="history-pagination__controls">
              <button
                type="button"
                className="history-pagination__button"
                onClick={() => setHistoryPage(Math.max(1, currentHistoryPage - 1))}
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
                onClick={() => setHistoryPage(Math.min(historyPageCount, currentHistoryPage + 1))}
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

  return (
    <>
      {surface === 'landing' ? (
        <div className="landing-shell landing-shell--taochat">
          <header className="tao-nav">
            <div className="tao-logo">
              tao<b>chat</b>
            </div>

            <nav className="tao-nav__links">
              <a href="#vision">Vision</a>
              <a href="#usecases">Use cases</a>
              <a href="#how">How it works</a>
            </nav>

            <div className="tao-nav__actions">
              {account ? (
                <div className="wallet-inline-actions">
                  <div className="tao-status-pill">
                    <span className="status-dot status-dot--success" />
                    {formatShortValue(account, 6, 4)}
                  </div>
                  <button type="button" className="tao-btn tao-btn--ghost tao-btn--small" onClick={disconnectWallet}>
                    Disconnect
                  </button>
                </div>
              ) : (
                <button type="button" className="tao-btn tao-btn--ghost" onClick={() => setShowWalletModal(true)}>
                  Connect wallet
                </button>
              )}
              <button type="button" className="tao-btn tao-btn--primary" onClick={() => openApp()}>
                Launch app →
              </button>
            </div>
          </header>

          <main>
            <section className="tao-hero">
              <div className="tao-badge">
                <span className="tao-badge__dot" />
                Live on Bittensor EVM testnet
              </div>
              <h1>
                Bittensor DeFi.
                <br />
                <em>Just say it.</em>
              </h1>
              <p>
                Stake, unstake, and swap on Bittensor subnets using plain English. External-chain routes will land
                later, but the live experience today stays focused on Bittensor EVM testnet.
              </p>
              <div className="tao-hero__actions">
                <button type="button" className="tao-btn tao-btn--primary tao-btn--large" onClick={() => openApp()}>
                  Launch app →
                </button>
                <button type="button" className="tao-btn tao-btn--ghost tao-btn--large">
                  Read docs
                </button>
              </div>
            </section>

            <section className="tao-ticker" aria-label="Featured subnet routes">
              <div className="tao-ticker__track">
                {[...LANDING_TICKER, ...LANDING_TICKER].map((item, index) => (
                  <div key={`${item.label}-${index}`} className="tao-ticker__item">
                    <span className="tao-ticker__label">{item.label}</span>
                    <span>{item.value}</span>
                    <span className={item.positive ? 'is-positive' : 'is-negative'}>{item.delta}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="tao-demo" id="demo">
              <div className="tao-demo__inner">
                <div className="tao-section-tag">See it in action</div>
                <div className="tao-section-title tao-section-title--demo">One message. Done.</div>
                <div className="tao-demo__window">
                  <div className="tao-demo__bar">
                    <div className="tao-demo__title">
                      <span className="tao-demo__dot" />
                      <span>TaoChat</span>
                    </div>
                    <div className="tao-demo__connected">● Connected</div>
                  </div>

                  <div className="tao-demo__body">
                    <div className="tao-demo__row tao-demo__row--user">
                      <div className="tao-demo__bubble tao-demo__bubble--user">Stake 100 TAO on the strongest subnet right now</div>
                    </div>
                    <div className="tao-demo__row">
                      <div className="tao-demo__bubble tao-demo__bubble--bot">
                        I found a top route, drafted the staking intent, and surfaced the exact route before asking for
                        confirmation.
                        <div className="tao-demo__ok">Confirmed: 100 TAO routed into the selected subnet.</div>
                      </div>
                    </div>
                    <div className="tao-demo__row tao-demo__row--user">
                      <div className="tao-demo__bubble tao-demo__bubble--user">Move half of that position into Subnet 27.</div>
                    </div>
                    <div className="tao-demo__row">
                      <div className="tao-demo__bubble tao-demo__bubble--bot">
                        Rotation prepared on the same chain. Source route, destination route, and amount are all ready
                        for review.
                        <div className="tao-demo__ok">Moved: 50 TAO worth of Alpha into the new subnet route.</div>
                      </div>
                    </div>
                  </div>

                  <div className="tao-demo__footer">
                    <div className="tao-demo__input">
                      Try: &quot;Unstake my Alpha from Netuid 310&quot; or &quot;What does Subnet 11 do?&quot;
                    </div>
                    <button type="button" className="tao-btn tao-btn--primary tao-demo__send" onClick={() => openApp()}>
                      Send
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="tao-vision" id="vision">
              <div>
                <div className="tao-section-tag">Our vision</div>
                <h2 className="tao-vision__title">
                  DeFi on Bittensor should be
                  <br />
                  for <em>everyone.</em>
                </h2>
                <p className="tao-vision__copy">
                  Bittensor is building the most important decentralised AI network in the world. Over 60 live
                  subnets, each earning yield for stakers. But getting in has always required wallets, bridges,
                  dashboards, and technical patience most people don&apos;t have.
                </p>
                <p className="tao-vision__copy">
                  TaoChat makes it conversational. You tell it what you want in plain English and it handles the live
                  Bittensor EVM testnet flow cleanly, while upcoming external-chain routes stay clearly marked as coming soon.
                </p>
                <div className="tao-vision__points">
                  {VISION_POINTS.map((point) => (
                    <div key={point.title} className="tao-vision__point">
                      <div className="tao-vision__icon">{point.icon}</div>
                      <div>
                        <h3>{point.title}</h3>
                        <p>{point.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="tao-command-list">
                {COMMAND_PREVIEWS.map((preview) => (
                  <div key={preview.prompt} className="tao-command-card">
                    <div className="tao-command-card__label">User says</div>
                    <div className="tao-command-card__prompt">{preview.prompt}</div>
                    <div className="tao-command-card__result">
                      <span className="tao-command-card__result-dot" />
                      {preview.result}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="tao-usecases" id="usecases">
              <div className="tao-usecases__inner">
                <div className="tao-usecases__header">
                  <div className="tao-section-tag">What you can do</div>
                  <h2 className="tao-section-title">Simple commands. Real outcomes.</h2>
                </div>

                <div className="tao-usecases__grid">
                  {USE_CASES.map((item) => (
                    <article key={item.id} className="tao-usecases__card">
                      <div className="tao-usecases__index">{item.id}</div>
                      <div className="tao-usecases__icon">{item.icon}</div>
                      <h3>{item.title}</h3>
                      <p>{item.description}</p>
                      <div className="tao-usecases__example">
                        &quot;<span>{item.example}</span>&quot;
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            <section className="tao-how" id="how">
              <div className="tao-section-tag">Process</div>
              <h2 className="tao-section-title">How TaoChat works</h2>

              <div className="tao-how__steps">
                {[
                  {
                    step: '1',
                    title: 'Connect wallet',
                    description: 'Link a wallet that supports the current Bittensor EVM testnet flow.',
                  },
                  {
                    step: '2',
                    title: 'Say what you want',
                    description: 'Type in plain English. No syntax, no commands to learn.',
                  },
                  {
                    step: '3',
                    title: 'Review & confirm',
                    description: 'See exact amounts, fees, and simulated returns before anything moves.',
                  },
                  {
                    step: '4',
                    title: 'Done',
                    description: 'Transaction confirmed on-chain. Every step logged in history.',
                  },
                ].map((item) => (
                  <div key={item.step} className="tao-how__step">
                    <div className="tao-how__step-number">{item.step}</div>
                    <div className="tao-how__step-title">{item.title}</div>
                    <div className="tao-how__step-copy">{item.description}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="tao-chains">
              <div className="tao-chains__inner">
                <div className="tao-section-tag">Supported networks</div>
                <h2 className="tao-section-title">Stake from any chain</h2>

                <div className="tao-chains__grid">
                  {SUPPORTED_NETWORKS.map((network) => (
                    <article key={network.name} className="tao-chains__card">
                      <div className="tao-chains__icon" style={network.style}>
                        {network.symbol}
                      </div>
                      <div className="tao-chains__name">{network.name}</div>
                      <div className={network.status === 'Live' ? 'tao-chains__status' : 'tao-chains__status tao-chains__status--soon'}>
                        {network.status === 'Live' ? '● Live' : 'Coming soon'}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            <section className="tao-cta">
              <div className="tao-cta__inner">
                <div className="tao-section-tag">Get started</div>
                <h2 className="tao-cta__title">
                  The simplest way to
                  <br />
                  earn on <em>Bittensor.</em>
                </h2>
                <p>Connect and make your first stake in under 60 seconds. No setup. No learning curve.</p>
                <div className="tao-hero__actions">
                  <button type="button" className="tao-btn tao-btn--primary tao-btn--large" onClick={() => openApp()}>
                    Launch app →
                  </button>
                  <button type="button" className="tao-btn tao-btn--ghost tao-btn--large">
                    Join Discord
                  </button>
                </div>
              </div>
            </section>
          </main>

          <footer className="tao-footer">
            <div className="tao-logo tao-logo--small">
              tao<b>chat</b>
            </div>
            <div className="tao-footer__links">
              <a href="#">Docs</a>
              <a href="#">Twitter</a>
              <a href="#">Discord</a>
              <a href="#">GitHub</a>
              <a href="#">Terms</a>
            </div>
            <div className="tao-footer__copy">© 2025 TaoChat · Non-custodial · Open source</div>
          </footer>
        </div>
      ) : (
        <div className="dashboard-shell">
          <aside className="app-sidebar">
            <button type="button" className="app-sidebar__brand" onClick={() => setAppView('chat')}>
              <span className="tao-logo tao-logo--small">
                tao<b>chat</b>
              </span>
            </button>

            <nav className="app-sidebar__nav">
              <button
                type="button"
                className={`app-sidebar__nav-item ${appView === 'chat' ? 'is-active' : ''}`}
                onClick={() => setAppView('chat')}
              >
                <span className="app-sidebar__icon">⌘</span>
                Chat
              </button>
              <button
                type="button"
                className={`app-sidebar__nav-item ${appView === 'dashboard' ? 'is-active' : ''}`}
                onClick={() => setAppView('dashboard')}
              >
                <span className="app-sidebar__icon">⇄</span>
                Swap
              </button>
              <button
                type="button"
                className={`app-sidebar__nav-item ${appView === 'history' ? 'is-active' : ''}`}
                onClick={() => {
                  setAppView('history');
                  void fetchOnchainHistory(account || undefined);
                }}
              >
                <span className="app-sidebar__icon">☰</span>
                History
              </button>
            </nav>

            <div className="app-sidebar__footer">
              <button type="button" className="back-link" onClick={() => setSurface('landing')}>
                ← Back to site
              </button>

              {account ? (
                <>
                  <div className="wpill">
                    <div className="wdot" />
                    <div className="waddr">{formatShortValue(account, 6, 4)}</div>
                    <div className="wnet">Testnet</div>
                  </div>
                  <button type="button" className="sidebar-disconnect" onClick={disconnectWallet}>
                    Disconnect
                  </button>
                </>
              ) : (
                <button type="button" className="tao-btn tao-btn--primary tao-btn--small sidebar-connect" onClick={() => setShowWalletModal(true)}>
                  Connect wallet
                </button>
              )}
            </div>
          </aside>

          <section className="app-main">
            {showStatusBanner && (
              <div className={`status-banner status-banner--${status.type}`}>
                {status.type === 'error' ? <AlertCircle size={16} /> : <Activity size={16} />}
                <span>{status.msg}</span>
              </div>
            )}

            {appView === 'dashboard' && renderDashboardView()}
            {appView === 'history' && renderHistoryView()}
            {appView === 'chat' && (
              <ChatPortal
                account={account}
                balance={balance}
                myAlphaBalance={myAlphaBalance}
                allAlphaBalances={allAlphaBalances}
                currentNetuid={netuid}
                simulateStakeAlpha={simulateStakeAlpha}
                executeStake={executeStake}
                executeUnstake={executeUnstake}
                executeSwap={executeSwap}
                status={status}
                openWalletSelector={() => setShowWalletModal(true)}
                disconnectWallet={disconnectWallet}
              />
            )}
          </section>
        </div>
      )}

      {showWalletModal && (
        <div className="wallet-modal-backdrop" onClick={() => setShowWalletModal(false)}>
          <div className="wallet-modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="wallet-modal-card__header">
              <div>
                <span className="section-kicker">Connect wallet</span>
                <h3>Choose your wallet provider</h3>
              </div>
              <button type="button" className="wallet-modal-card__close" onClick={() => setShowWalletModal(false)}>
                ×
              </button>
            </div>

            <p className="wallet-modal-card__copy">
              This build is focused on Bittensor subEVM staking. Cross-chain routing remains clearly marked as coming
              soon until it is actually live.
            </p>

            {Boolean(status.msg) && (
              <div className={`status-banner status-banner--${status.type === 'idle' ? 'loading' : status.type}`}>
                {status.type === 'error' ? <AlertCircle size={16} /> : <Activity size={16} />}
                <span>{status.msg}</span>
              </div>
            )}

            <div className="wallet-modal-card__options">{WALLET_OPTIONS.map(renderWalletModalOption)}</div>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
