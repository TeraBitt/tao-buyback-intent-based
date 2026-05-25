import { ethers } from 'ethers';

interface SubnetCatalogEntry {
  netuid: number;
  name: string;
}

export const bytesFromScaleResult = (scaleBytes: unknown) => {
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

const bytesToHex = (hexBytes: Uint8Array) =>
  `0x${Array.from(hexBytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')}`;

export const decodeSubnetCatalog = (scaleBytes: unknown): SubnetCatalogEntry[] => {
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

export const decodeDelegations = (scaleBytes: unknown): { netuid: number; stake: number; hotkey: string }[] => {
  const bytes = bytesFromScaleResult(scaleBytes);
  if (!bytes) return [];

  const offset = { value: 0 };

  try {
    const len = Number(readScaleCompact(bytes, offset));
    const results: { netuid: number; stake: number; hotkey: string }[] = [];

    for (let index = 0; index < len; index += 1) {
      const delegateHotkey = bytesToHex(bytes.slice(offset.value, offset.value + 32));
      offset.value += 32;

      readScaleCompact(bytes, offset);

      const nominatorsLen = Number(readScaleCompact(bytes, offset));
      for (let i = 0; i < nominatorsLen; i += 1) {
        offset.value += 32;
        const nominatorStakesLen = Number(readScaleCompact(bytes, offset));
        for (let j = 0; j < nominatorStakesLen; j += 1) {
          readScaleCompact(bytes, offset);
          readScaleCompact(bytes, offset);
        }
      }

      offset.value += 32;

      const registrationsLen = Number(readScaleCompact(bytes, offset));
      for (let i = 0; i < registrationsLen; i += 1) {
        readScaleCompact(bytes, offset);
      }

      const permitsLen = Number(readScaleCompact(bytes, offset));
      for (let i = 0; i < permitsLen; i += 1) {
        readScaleCompact(bytes, offset);
      }

      readScaleCompact(bytes, offset);
      readScaleCompact(bytes, offset);

      const decodedNetuid = Number(readScaleCompact(bytes, offset));
      const stakeRaw = readScaleCompact(bytes, offset);
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

export const decodeSimSwapOutputRao = (bytes: Uint8Array | null, byteOffset: number) => {
  if (!bytes || bytes.length < byteOffset + 8) return null;

  try {
    let amountRao = 0n;
    for (let index = 0; index < 8; index += 1) {
      amountRao |= BigInt(bytes[byteOffset + index]) << BigInt(index * 8);
    }

    return amountRao;
  } catch (error) {
    console.error('Failed to decode simulated swap output:', error);
    return null;
  }
};

export const decodeSimSwapAlphaAmount = (scaleBytes: unknown) => {
  const bytes = bytesFromScaleResult(scaleBytes);
  const alphaAmountRao = decodeSimSwapOutputRao(bytes, 8);
  return alphaAmountRao === null ? null : ethers.formatUnits(alphaAmountRao, 9);
};

export const decodeSimSwapTaoAmount = (scaleBytes: unknown) => {
  const bytes = bytesFromScaleResult(scaleBytes);
  const taoAmountRao = decodeSimSwapOutputRao(bytes, 0);
  return taoAmountRao === null ? null : ethers.formatUnits(taoAmountRao, 9);
};
