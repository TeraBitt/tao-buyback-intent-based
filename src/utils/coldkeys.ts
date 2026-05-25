import { blake2b } from 'blakejs';

export const hexToBytes = (hex: string) => {
  const clean = hex.replace('0x', '');
  const bytes: number[] = [];

  for (let i = 0; i < clean.length; i += 2) {
    bytes.push(Number.parseInt(clean.substring(i, i + 2), 16));
  }

  return bytes;
};

export const getEvmColdkey = (address: string) => {
  const evmHex = address.replace('0x', '');
  const evmAddrBytes = new Uint8Array(evmHex.length / 2);

  for (let i = 0; i < evmHex.length; i += 2) {
    evmAddrBytes[i / 2] = Number.parseInt(evmHex.substring(i, i + 2), 16);
  }

  const prefix = new TextEncoder().encode('evm:');
  const input = new Uint8Array(prefix.length + evmAddrBytes.length);
  input.set(prefix);
  input.set(evmAddrBytes, prefix.length);

  const hashBytes = blake2b(input, undefined, 32);
  return `0x${Array.from(hashBytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')}`;
};
