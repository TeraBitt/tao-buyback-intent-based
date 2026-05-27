import { ethers } from 'ethers';
import { CONFIG } from '../config';
import { STAKING_PRECOMPILE_ADDRESS } from './contracts';

const RPC_REQUEST_SPACING_MS = 300;
const RPC_RATE_LIMIT_BACKOFF_MS = 2500;
const RPC_MAX_RETRIES = 4;
const RPC_BATCH_MAX_COUNT = 45;

export const directProvider = new ethers.JsonRpcProvider(CONFIG.NETWORK.rpcUrls[0], undefined, {
  staticNetwork: true,
  batchMaxCount: RPC_BATCH_MAX_COUNT,
  batchStallTime: 25,
});

export let activeProvider: ethers.BrowserProvider | ethers.JsonRpcProvider = directProvider;

export let stakingPrecompile = new ethers.Contract(
  STAKING_PRECOMPILE_ADDRESS,
  [
    'function getTotalAlphaStaked(bytes32 hotkey, uint256 netuid) external view returns (uint256)',
    'function getStake(bytes32 hotkey, bytes32 coldkey, uint256 netuid) external view returns (uint256)',
  ],
  activeProvider,
);

export const setActiveProvider = (prov: ethers.BrowserProvider | null) => {
  activeProvider = prov || directProvider;
  stakingPrecompile = new ethers.Contract(
    STAKING_PRECOMPILE_ADDRESS,
    [
      'function getTotalAlphaStaked(bytes32 hotkey, uint256 netuid) external view returns (uint256)',
      'function getStake(bytes32 hotkey, bytes32 coldkey, uint256 netuid) external view returns (uint256)',
    ],
    activeProvider,
  );
};

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
      // Provider errors can include circular request objects.
    }
  }

  return parts.join(' ').toLowerCase();
};

export const isRetryableRpcError = (error: unknown) => {
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

export const withRpcBackoff = async <Result,>(operation: () => Promise<Result>) => {
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

export const settleRpcBatch = async (createOperations: () => Promise<unknown>[]) =>
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

export const logRejectedRpcResult = (label: string, result?: PromiseSettledResult<unknown>) => {
  if (result?.status === 'rejected') {
    console.error(`${label} failed:`, result.reason);
  }
};

export const toBigIntOrZero = (value: unknown) => {
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
