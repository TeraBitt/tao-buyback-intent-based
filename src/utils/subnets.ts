import { DISPLAY_SUBNETS } from '../data/subnets';
import type { SubnetPresentation } from '../types';

const getSubnetMeta = (targetNetuid: number) =>
  DISPLAY_SUBNETS.find((subnet) => subnet.netuid === targetNetuid) ?? null;

export const getMockApyForNetuid = (targetNetuid: number) => {
  const subnetMeta = getSubnetMeta(targetNetuid);
  if (subnetMeta?.apy) return subnetMeta.apy;

  const baseApy = 14 + ((targetNetuid * 7) % 13);
  const fractional = ((targetNetuid * 3) % 10) / 10;
  return `${(baseApy + fractional).toFixed(1)}%`;
};

export const getSubnetPresentation = (targetNetuid: number): SubnetPresentation => {
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

export const getSubnetLabel = (targetNetuid: number) => {
  const subnetMeta = getSubnetPresentation(targetNetuid);
  return `${subnetMeta.code} - ${subnetMeta.name}`;
};

export const getHotkeyForNetuid = (targetNetuid: number): string => {
  if (targetNetuid === 310) {
    return '0x3cba5f549c02a4da782cadb65564d0e8159f339f5610db4bd5773f36c760f97c';
  }

  return '0x1e738b33dfbd68eaba7db3f03fe942cfa4e32b728e52c26743b16dbca15af464';
};
