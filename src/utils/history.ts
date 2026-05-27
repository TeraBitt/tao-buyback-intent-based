import { ethers } from 'ethers';
import { CONFIG } from '../config';
import type { HistorySource, StakeEvent } from '../types';
import { contractInterface, stakingCallInterface } from './contracts';
import { formatShortValue, formatTokenAmount, normalizeAddress } from './formatters';
import { activeProvider, logRejectedRpcResult, settleRpcBatch, withRpcBackoff } from './rpc';
import { getSubnetLabel } from './subnets';

export const HISTORY_PAGE_SIZE = 10;

const CONTRACT_DEPLOY_BLOCK = 7147534;
const HISTORY_LOG_PAGE_SIZE = 5000;
const HISTORY_MAX_EVENTS = 150;
const INTENT_FILLED_TOPIC = ethers.id('IntentFilled(address,address,uint256)');

export interface HistoryCacheEntry {
  events: StakeEvent[];
  source: HistorySource;
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

const decodeIndexedAddress = (topic?: string) => {
  if (!topic || topic.length < 42) return '';
  return ethers.getAddress(`0x${topic.slice(-40)}`);
};

const getAddressTopic = (address: string) => ethers.zeroPadValue(normalizeAddress(address), 32);

const getIntentFilledTopics = (userAddress?: string) =>
  userAddress ? [INTENT_FILLED_TOPIC, getAddressTopic(userAddress)] : [INTENT_FILLED_TOPIC];

const sortHistoryLogs = (logs: ethers.Log[]) =>
  logs
    .sort((left, right) => right.blockNumber - left.blockNumber || right.index - left.index)
    .slice(0, HISTORY_MAX_EVENTS);

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

const fetchPagedIntentFilledLogs = async (userAddress?: string) => {
  const latestBlock = await withRpcBackoff(() => activeProvider.getBlockNumber());
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
      activeProvider.getLogs({
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

const fetchHistoryTransactions = async (logs: ethers.Log[]) => {
  if (logs.length === 0) return [];

  const results = await settleRpcBatch(() =>
    logs.map((log) => activeProvider.send('eth_getTransactionByHash', [log.transactionHash])),
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

export const mergeHistoryEvents = (...historyGroups: StakeEvent[][]) => {
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

export const getHistoryCacheKey = (address?: string) => (address ? `wallet:${normalizeAddress(address)}` : 'contract');

export const fetchIntentFilledLogGroups = async (userAddress?: string) => {
  const targets: { source: HistorySource; userAddress?: string }[] = userAddress
    ? [
        { source: 'wallet', userAddress },
        { source: 'contract' },
      ]
    : [{ source: 'contract' }];

  const results = await settleRpcBatch(() =>
    targets.map((target) =>
      activeProvider.getLogs({
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

export const decodeOnchainHistoryLogs = async (logs: ethers.Log[]) => {
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
