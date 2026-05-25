import { ethers } from 'ethers';

export const formatShortValue = (value: string, start = 8, end = 6) => {
  if (!value) return '';
  return `${value.slice(0, start)}...${value.slice(-end)}`;
};

export const formatTokenAmount = (value: string, digits = 4) => {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return value;
  return parsed.toFixed(digits).replace(/\.?0+$/, '');
};

export const formatHistoryTime = (timestamp: number) => {
  const date = new Date(timestamp);
  return `${date.toLocaleString([], { month: 'short', day: 'numeric' })} · ${date.toLocaleString([], {
    hour: 'numeric',
    minute: '2-digit',
  })}`;
};

export const normalizeAddress = (value: string) => {
  try {
    return ethers.getAddress(value);
  } catch {
    return value.toLowerCase();
  }
};

export const escapeCsvValue = (value: string) => `"${value.replace(/"/g, '""')}"`;
