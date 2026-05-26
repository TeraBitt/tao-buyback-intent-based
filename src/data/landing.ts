import SOL from '../assets/sol.png';
import ETH from '../assets/eth.png';
import BASE from '../assets/base.png';
import TAO from '../assets/tao.png';
import LOGO from '../assets/terabitt_logo.png';
import APP_SCREENSHOT from '../assets/app-screenshot1.png';

export const ASSETS = {
  LOGO,
  APP_SCREENSHOT,
};

export const LANDING_TICKER = [
  { label: 'SN19 Vision', value: '34.2% Est. APY', delta: '↑ 2.1%', positive: true },
  { label: 'SN27 Inference', value: '28.6% Est. APY', delta: '↑ 0.8%', positive: true },
  { label: 'SN11 Code', value: '22.3% Est. APY', delta: '↑ 3.4%', positive: true },
  { label: 'SN4 Multimodal', value: '19.1% Est. APY', delta: '↓ 0.4%', positive: false },
  { label: 'SN9 Translation', value: '16.4% Est. APY', delta: '↑ 1.2%', positive: true },
  { label: 'TAO/USD', value: '$487.20', delta: '↑ 4.1%', positive: true },
  { label: 'SN1 Text', value: '14.8% Est. APY', delta: '↓ 0.2%', positive: false },
];

export const COMMAND_PREVIEWS = [
  {
    prompt: '"Stake 200 TAO on the top AI subnet this week"',
    result: '200 TAO staked on SN27 at est. 28.6% APY · confirmed',
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
    result: 'Full subnet breakdown shown · estimated APY, TVL, validator count',
  },
];

export const VISION_POINTS = [
  {
    icon: '⌘',
    title: 'Intent to action',
    description:
      'You describe what you want. TeraBitt executes only after you confirm.',
  },
  {
    icon: '⇄',
    title: 'Cross-chain next',
    description:
      'SOL, ETH, and other external-chain routes are coming soon.',
  },
  {
    icon: '◎',
    title: 'Non-custodial always',
    description: 'Every action signs from your own wallet. TeraBitt never holds funds or keys.',
  },
];

export const USE_CASES = [
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
    description: 'Exit fully or partially with one command. TeraBitt handles the unbonding and returns your assets cleanly.',
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
      'Ask which subnets lead by estimated APY, category, or momentum. Get live data from chain and act on it instantly.',
    example: 'Which AI subnet has the highest APY?',
  },
  {
    id: '05',
    icon: '⇄',
    title: 'Move between subnets',
    description: 'Rotate a position in one command. Unstake from one, restake on another, both steps confirmed together.',
    example: 'Move my SN4 stake to Subnet 27',
  },
  {
    id: '06',
    icon: '⬡',
    title: 'Research any subnet',
    description:
      'Ask what a subnet does, its estimated APY, TVL, validator count, and how it compares to similar ones.',
    example: 'What does Subnet 11 do?',
  },
];

export const HOW_STEPS = [
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
];

export const SUPPORTED_NETWORKS = [
  { name: 'Solana', symbol: SOL, status: 'Coming soon'},
  { name: 'Ethereum', symbol: ETH, status: 'Coming soon'},
  { name: 'Base', symbol: BASE, status: 'Coming soon'},
  { name: 'Bittensor', symbol: TAO, status: 'Live on testnet'},
];


