import { ethers } from 'ethers';
import type { SwapAlphaSimulation } from '../types';
import { activeProvider, withRpcBackoff } from './rpc';
import {
  bytesFromScaleResult,
  decodeSimSwapAlphaAmount,
  decodeSimSwapOutputRao,
  decodeSimSwapTaoAmount,
} from './scaleDecoders';

export const simulateStakeAlpha = async (amount: string, targetNetuid: number): Promise<string | null> => {
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

    const simulation = await withRpcBackoff(() => activeProvider.send('swap_simSwapTaoForAlpha', [targetNetuid, amountParam]));
    return decodeSimSwapAlphaAmount(simulation);
  } catch (error) {
    console.error('Failed to simulate stake output:', error);
    return null;
  }
};

export const simulateSwapAlpha = async (
  sourceNetuid: number,
  targetNetuid: number,
  amount: string,
): Promise<SwapAlphaSimulation | null> => {
  const numericAmount = Number.parseFloat(amount);
  if (
    !Number.isFinite(numericAmount) ||
    numericAmount <= 0 ||
    sourceNetuid < 0 ||
    targetNetuid < 0 ||
    sourceNetuid === targetNetuid
  ) {
    return null;
  }

  try {
    const amountInRao = ethers.parseUnits(amount, 9);
    const amountParam = Number(amountInRao);

    if (!Number.isSafeInteger(amountParam) || amountParam <= 0) {
      return null;
    }

    const taoSimulation = await withRpcBackoff(() =>
      activeProvider.send('swap_simSwapAlphaForTao', [sourceNetuid, amountParam]),
    );
    const taoRao = decodeSimSwapOutputRao(bytesFromScaleResult(taoSimulation), 0);
    if (taoRao === null || taoRao <= 0n) {
      return null;
    }

    const taoParam = Number(taoRao);
    if (!Number.isSafeInteger(taoParam) || taoParam <= 0) {
      return null;
    }

    const alphaSimulation = await withRpcBackoff(() =>
      activeProvider.send('swap_simSwapTaoForAlpha', [targetNetuid, taoParam]),
    );
    const targetAlphaRao = decodeSimSwapOutputRao(bytesFromScaleResult(alphaSimulation), 8);
    if (targetAlphaRao === null) {
      return null;
    }

    return {
      targetAlpha: ethers.formatUnits(targetAlphaRao, 9),
      intermediateTao: ethers.formatUnits(taoRao, 9),
    };
  } catch (error) {
    console.error('Failed to simulate subnet rotation:', error);
    return null;
  }
};

export const simulateUnstakeTao = async (sourceNetuid: number, amount: string): Promise<string | null> => {
  const numericAmount = Number.parseFloat(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0 || sourceNetuid < 0) {
    return null;
  }

  try {
    const amountInRao = ethers.parseUnits(amount, 9);
    const amountParam = Number(amountInRao);

    if (!Number.isSafeInteger(amountParam) || amountParam <= 0) {
      return null;
    }

    const simulation = await withRpcBackoff(() =>
      activeProvider.send('swap_simSwapAlphaForTao', [sourceNetuid, amountParam]),
    );
    return decodeSimSwapTaoAmount(simulation);
  } catch (error) {
    console.error('Failed to simulate unstake output:', error);
    return null;
  }
};
