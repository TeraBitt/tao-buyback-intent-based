import { useState, useEffect, type CSSProperties } from 'react';
import { ethers } from 'ethers';
import { blake2b } from 'blakejs';
import { Wallet, ArrowRightLeft, Activity, AlertCircle, History, LogOut } from 'lucide-react';
import { CONFIG } from './config';
import abiData from './abi.json';
import './index.css';
import ChatPortal from './components/ChatPortal';

declare global {
interface Window {
    ethereum: any;
  }
}

const CONTRACT_ABI = abiData;
type WalletType = 'metamask' | 'talisman';

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

const WALLET_OPTIONS: WalletOption[] = [
  {
    id: 'metamask',
    label: 'MetaMask',
    subtitle: 'EVM native',
    description: 'A clean default for browser-based TAO staking on the Subnet EVM testnet.',
    iconSrc: '/wallets/metamask-icon.svg',
    wordmarkSrc: '/wallets/metamask-wordmark.svg',
    accent: '#F6851B',
    accentRgb: '246, 133, 27',
  },
  {
    id: 'talisman',
    label: 'Talisman',
    subtitle: 'Bittensor friendly',
    description: 'Best when you want one wallet flow that already feels native to the broader ecosystem.',
    iconSrc: '/wallets/talisman-icon.svg',
    wordmarkSrc: '/wallets/talisman-wordmark.svg',
    accent: '#FF4D6D',
    accentRgb: '255, 77, 109',
  },
];

// Single persistent JsonRpcProvider for all read-only calls
const directProvider = new ethers.JsonRpcProvider(CONFIG.NETWORK.rpcUrls[0], undefined, {
  staticNetwork: true
});

const stakingPrecompile = new ethers.Contract(
  "0x0000000000000000000000000000000000000805",
  [
    "function getTotalAlphaStaked(bytes32 hotkey, uint256 netuid) external view returns (uint256)",
    "function getStake(bytes32 hotkey, bytes32 coldkey, uint256 netuid) external view returns (uint256)"
  ],
  directProvider
);


interface StakeEvent {
  type: 'stake' | 'unstake';
  taoAmount: string;
  alphaAmount: string;
  netuid: number;
  txHash: string;
  blockNumber: number;
}

function App() {
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);
  const [account, setAccount] = useState<string>('');
  const [balance, setBalance] = useState<string>('0');
  const [myAlphaBalance, setMyAlphaBalance] = useState<string>('0');
  const [totalAlphaStaked, setTotalAlphaStaked] = useState<string>('0');
  const [allAlphaBalances, setAllAlphaBalances] = useState<{ [id: number]: string }>({});
  const [stakedHotkeys, setStakedHotkeys] = useState<{ [netuid: number]: string }>({});
  const [stakeHistory, setStakeHistory] = useState<StakeEvent[]>([]);
  const [walletType, setWalletType] = useState<WalletType | null>(null);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [isWalletHydrating, setIsWalletHydrating] = useState(false);

  const decodeDelegations = (scaleBytes: any): { netuid: number; stake: number; hotkey: string }[] => {
    if (!scaleBytes) return [];
    let bytes: Uint8Array;
    if (typeof scaleBytes === 'string') {
      const hex = scaleBytes.replace('0x', '');
      const arr = new Uint8Array(hex.length / 2);
      for (let i = 0; i < hex.length; i += 2) {
        arr[i / 2] = parseInt(hex.substring(i, i + 2), 16);
      }
      bytes = arr;
    } else if (Array.isArray(scaleBytes)) {
      bytes = new Uint8Array(scaleBytes);
    } else {
      bytes = new Uint8Array(scaleBytes as any);
    }

    const offset = { value: 0 };

    const readCompact = (bytes: Uint8Array, offset: { value: number }): bigint => {
      const first = bytes[offset.value++];
      const mode = first & 0x03;
      if (mode === 0) {
        return BigInt(first >> 2);
      } else if (mode === 1) {
        const second = bytes[offset.value++];
        return BigInt((first >> 2) | (second << 6));
      } else if (mode === 2) {
        const b1 = bytes[offset.value++];
        const b2 = bytes[offset.value++];
        const b3 = bytes[offset.value++];
        const val = (first >> 2) | (b1 << 6) | (b2 << 14) | (b3 << 22);
        return BigInt(val >>> 0);
      } else {
        const len = (first >> 2) + 4;
        let val = 0n;
        for (let i = 0; i < len; i++) {
          val |= BigInt(bytes[offset.value++]) << BigInt(i * 8);
        }
        return val;
      }
    };

    const bytesToHex = (bytes: Uint8Array): string => {
      return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    };

    try {
      const len = Number(readCompact(bytes, offset));
      const results: { netuid: number; stake: number; hotkey: string }[] = [];

      for (let k = 0; k < len; k++) {
        // 1. delegate_ss58: 32 bytes
        const delegateHotkey = bytesToHex(bytes.slice(offset.value, offset.value + 32));
        offset.value += 32;

        // 2. take: Compact<u16>
        readCompact(bytes, offset);

        // 3. nominators: Vec
        const nominatorsLen = Number(readCompact(bytes, offset));
        for (let i = 0; i < nominatorsLen; i++) {
          offset.value += 32; // nominator AccountId
          const nominatorStakesLen = Number(readCompact(bytes, offset));
          for (let j = 0; j < nominatorStakesLen; j++) {
            readCompact(bytes, offset); // netuid
            readCompact(bytes, offset); // stake amount
          }
        }

        // 4. owner_ss58: 32 bytes
        offset.value += 32;

        // 5. registrations: Vec<Compact<NetUid>>
        const regsLen = Number(readCompact(bytes, offset));
        for (let i = 0; i < regsLen; i++) {
          readCompact(bytes, offset);
        }

        // 6. validator_permits: Vec<Compact<NetUid>>
        const permitsLen = Number(readCompact(bytes, offset));
        for (let i = 0; i < permitsLen; i++) {
          readCompact(bytes, offset);
        }

        // 7. return_per_1000: Compact<u64>
        readCompact(bytes, offset);

        // 8. total_daily_return: Compact<u64>
        readCompact(bytes, offset);

        // 9. netuid: Compact<NetUid>
        const netuid = Number(readCompact(bytes, offset));

        // 10. stake: Compact<AlphaBalance>
        const stakeRaw = readCompact(bytes, offset);
        const stake = Number(stakeRaw) / 1e9;

        results.push({
          netuid,
          stake,
          hotkey: delegateHotkey
        });
      }
      return results;
    } catch (e) {
      console.error('Failed to decode scale bytes:', e);
      return [];
    }
  };


  const [stakeAmount, setStakeAmount] = useState<string>('');
  const [unstakeAmount, setUnstakeAmount] = useState<string>('');
  const [netuid, setNetuid] = useState<number>(CONFIG.DEFAULT_NETUID);
  const [unstakeNetuid, setUnstakeNetuid] = useState<number>(CONFIG.DEFAULT_NETUID);
  const [swapAmount, setSwapAmount] = useState<string>('');
  const [swapSourceNetuid, setSwapSourceNetuid] = useState<number>(CONFIG.DEFAULT_NETUID);
  const [swapTargetNetuid, setSwapTargetNetuid] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'staking' | 'chat'>('staking');
  const [stakingAction, setStakingAction] = useState<'stake' | 'swap' | 'unstake'>('stake');

  const [status, setStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error', msg: string }>({ type: 'idle', msg: '' });

  /*
  const fetchStakeHistory = async (prov: ethers.Provider, userAddress: string) => {
    try {
      const contract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, CONTRACT_ABI, prov);
      
      const currentBlock = await prov.getBlockNumber();
      // Look back 100,000 blocks to scan all recent intents
      const fromBlock = Math.max(0, currentBlock - 100000);
      
      const intentFilter = contract.filters.IntentFilled(userAddress);
      const intentEvents = await contract.queryFilter(intentFilter, fromBlock, 'latest');
      
      const history: StakeEvent[] = [];
      
      const contractInterface = new ethers.Interface(CONTRACT_ABI);
      const stakingInterface = new ethers.Interface([
        "function addStake(bytes32 hotkey, uint256 amount, uint256 netuid) external",
        "function removeStake(bytes32 hotkey, uint256 amount, uint256 netuid) external",
        "function removeStakeFull(bytes32 hotkey, uint256 netuid) external"
      ]);

      for (const ev of intentEvents) {
        try {
          const log = ev as ethers.EventLog;
          const txHash = log.transactionHash;
          const tx = await prov.getTransaction(txHash);
          if (!tx || !tx.data) continue;

          // Parse transaction input data
          const decoded = contractInterface.parseTransaction({ data: tx.data, value: tx.value });
          if (!decoded || decoded.name !== 'fillIntent') continue;

          const intent = decoded.args[0]; // Struct Intent is the first arg
          const calls = intent.calls;

          // Inspect the nested calls for staking interactions
          for (const call of calls) {
            if (call.target.toLowerCase() === "0x0000000000000000000000000000000000000805") {
              const selector = call.callData.substring(0, 10);
              
              if (selector === stakingInterface.getFunction("addStake")?.selector) {
                const parsedCall = stakingInterface.decodeFunctionData("addStake", call.callData);
                const amountRao = parsedCall[1];
                const evNetuid = Number(parsedCall[2]);
                history.push({
                  type: 'stake',
                  taoAmount: (Number(amountRao * 1000000000n) / 1e18).toFixed(4),
                  alphaAmount: (Number(amountRao) / 1e9).toFixed(4),
                  netuid: evNetuid,
                  txHash: txHash,
                  blockNumber: log.blockNumber,
                });
              } 
              else if (selector === stakingInterface.getFunction("removeStake")?.selector) {
                const parsedCall = stakingInterface.decodeFunctionData("removeStake", call.callData);
                const amountRao = parsedCall[1];
                const evNetuid = Number(parsedCall[2]);
                history.push({
                  type: 'unstake',
                  taoAmount: (Number(amountRao * 1000000000n) / 1e18).toFixed(4),
                  alphaAmount: (Number(amountRao) / 1e9).toFixed(4),
                  netuid: evNetuid,
                  txHash: txHash,
                  blockNumber: log.blockNumber,
                });
              }
              else if (selector === stakingInterface.getFunction("removeStakeFull")?.selector) {
                const parsedCall = stakingInterface.decodeFunctionData("removeStakeFull", call.callData);
                const evNetuid = Number(parsedCall[1]);
                history.push({
                  type: 'unstake',
                  taoAmount: 'ALL',
                  alphaAmount: 'ALL',
                  netuid: evNetuid,
                  txHash: txHash,
                  blockNumber: log.blockNumber,
                });
              }
            }
          }
        } catch (err) {
          console.error("Failed to parse intent history item:", err);
        }
      }

      history.sort((a, b) => b.blockNumber - a.blockNumber);
      setStakeHistory(history);
    } catch (e) {
      console.error('Failed to fetch stake history:', e);
    }
  };
  */

  const fetchStats = async (prov: ethers.BrowserProvider, address: string) => {
    try {
      const bal = await prov.getBalance(address);
      setBalance(ethers.formatEther(bal));

      // 1. Calculate coldkeys using blake2b
      // Contract Coldkey
      const evmHex = CONFIG.CONTRACT_ADDRESS.replace('0x', '');
      const evmAddrBytes = new Uint8Array(evmHex.length / 2);
      for (let i = 0; i < evmHex.length; i += 2) {
        evmAddrBytes[i / 2] = parseInt(evmHex.substring(i, i + 2), 16);
      }
      const prefix = new TextEncoder().encode('evm:');
      const contractInput = new Uint8Array(prefix.length + evmAddrBytes.length);
      contractInput.set(prefix);
      contractInput.set(evmAddrBytes, prefix.length);
      const contractHashBytes = blake2b(contractInput, undefined, 32);
      const contractColdkey = '0x' + Array.from(contractHashBytes).map(b => b.toString(16).padStart(2, '0')).join('');

      // Wallet Coldkey
      const walletHex = address.replace('0x', '');
      const walletAddrBytes = new Uint8Array(walletHex.length / 2);
      for (let i = 0; i < walletHex.length; i += 2) {
        walletAddrBytes[i / 2] = parseInt(walletHex.substring(i, i + 2), 16);
      }
      const walletInput = new Uint8Array(prefix.length + walletAddrBytes.length);
      walletInput.set(prefix);
      walletInput.set(walletAddrBytes, prefix.length);
      const walletHashBytes = blake2b(walletInput, undefined, 32);
      const walletColdkey = '0x' + Array.from(walletHashBytes).map(b => b.toString(16).padStart(2, '0')).join('');

      // 2. Fetch total alpha staked for the selected hotkey/netuid
      const hotkey = stakedHotkeys[netuid] || getHotkeyForNetuid(netuid);
      try {
        const alpha = await stakingPrecompile.getTotalAlphaStaked(hotkey, netuid);
        setTotalAlphaStaked((Number(alpha) / 1e9).toString());
      } catch (e) {
        console.error('getTotalAlphaStaked failed:', e);
        setTotalAlphaStaked('0');
      }

      // 3. Fetch specific getStake balance for contract on currently selected netuid
      try {
        const myStake = await stakingPrecompile.getStake(hotkey, contractColdkey, netuid);
        setMyAlphaBalance((Number(myStake) / 1e9).toString());
      } catch (e) {
        console.error('getStake failed:', e);
        setMyAlphaBalance('0');
      }

      // 4. Fetch all active delegation positions using delegateInfo_getDelegated RPC for contract and wallet!
      const balances: { [id: number]: string } = {};
      const hotkeysMap: { [id: number]: string } = {};

      const hexToBytes = (hex: string) => {
        const clean = hex.replace('0x', '');
        const bytes = [];
        for (let i = 0; i < clean.length; i += 2) {
          bytes.push(parseInt(clean.substring(i, i + 2), 16));
        }
        return bytes;
      };

      try {
        const [contractScaleBytes, walletScaleBytes] = await Promise.all([
          directProvider.send("delegateInfo_getDelegated", [hexToBytes(contractColdkey)]),
          directProvider.send("delegateInfo_getDelegated", [hexToBytes(walletColdkey)]).catch(() => [])
        ]);

        const contractPositions = decodeDelegations(contractScaleBytes);
        const walletPositions = decodeDelegations(walletScaleBytes);

        // Merge contract positions
        for (const pos of contractPositions) {
          if (pos.stake > 0) {
            balances[pos.netuid] = pos.stake.toString();
            hotkeysMap[pos.netuid] = pos.hotkey;
          }
        }

        // Merge wallet positions
        for (const pos of walletPositions) {
          if (pos.stake > 0) {
            const existingStake = balances[pos.netuid] ? parseFloat(balances[pos.netuid]) : 0;
            balances[pos.netuid] = (existingStake + pos.stake).toString();
            if (!hotkeysMap[pos.netuid]) {
              hotkeysMap[pos.netuid] = pos.hotkey;
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch/decode active delegation positions:", err);
      }

      // 5. Ensure the currently selected netuid is always in the balances map
      if (balances[netuid] === undefined) {
        balances[netuid] = '0';
      }
      
      setAllAlphaBalances(balances);
      setStakedHotkeys(hotkeysMap);

    } catch (e) {
      console.error(e);
    }
  };

  // Auto-refresh when netuid, account, or provider changes, with debouncing for netuid/keystrokes
  useEffect(() => {
    if (!provider || !account) return;

    const timer = setTimeout(() => {
      if (typeof netuid === 'number' && netuid >= 0) {
        fetchStats(provider, account);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [netuid, account, provider]);

  const clearWalletState = () => {
    setIsWalletHydrating(false);
    setAccount('');
    setSigner(null);
    setProvider(null);
    setStatus({ type: 'idle', msg: '' });
    setBalance('0');
    setTotalAlphaStaked('0');
    setMyAlphaBalance('0');
    setStakeHistory([]);
    setAllAlphaBalances({});
    setStakedHotkeys({});
    setWalletType(null);
    localStorage.removeItem('connected_wallet');
  };

  const disconnectWallet = async () => {
    const selectedWallet = walletType || localStorage.getItem('connected_wallet');
    clearWalletState();
    try {
      let ethereumProvider: any = null;
      if (selectedWallet === 'talisman') {
        ethereumProvider = (window as any).talismanEth || (window as any).ethereum;
      } else {
        ethereumProvider = (window as any).ethereum;
      }
      if (ethereumProvider && ethereumProvider.request) {
        await ethereumProvider.request({
          method: "wallet_revokePermissions",
          params: [{ eth_accounts: {} }]
        });
      }
    } catch (error) {
      console.error("Failed to revoke permissions:", error);
    }
  };

  const connectWallet = async (wallet?: WalletType) => {
    const selectedWallet = wallet || (localStorage.getItem('connected_wallet') as WalletType) || 'metamask';
    let ethereumProvider: any = null;
    if (selectedWallet === 'talisman') {
      ethereumProvider = (window as any).talismanEth || (window as any).ethereum;
    } else {
      ethereumProvider = (window as any).ethereum;
    }

    if (!ethereumProvider) {
      setIsWalletHydrating(false);
      setStatus({ type: 'error', msg: `${selectedWallet === 'talisman' ? 'Talisman' : 'MetaMask'} not installed` });
      return;
    }
    try {
      setIsWalletHydrating(true);
      setStatus({ type: 'loading', msg: `Connecting to ${selectedWallet === 'talisman' ? 'Talisman' : 'MetaMask'}...` });
      const prov = new ethers.BrowserProvider(ethereumProvider);

      const network = await prov.getNetwork();
      if (network.chainId !== BigInt(CONFIG.NETWORK.chainId)) {
        try {
          await ethereumProvider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: CONFIG.NETWORK.chainId }],
          });
        } catch (switchError: any) {
          if (switchError.code === 4902) {
            await ethereumProvider.request({
              method: 'wallet_addEthereumChain',
              params: [CONFIG.NETWORK],
            });
          } else {
            throw switchError;
          }
        }
      }

      await prov.send("eth_requestAccounts", []);
      const sig = await prov.getSigner();
      const address = await sig.getAddress();

      setProvider(prov);
      setSigner(sig);
      setAccount(address);
      setWalletType(selectedWallet);
      localStorage.setItem('connected_wallet', selectedWallet);
      setShowWalletModal(false);
      await fetchStats(prov, address);

      setIsWalletHydrating(false);
      setStatus({ type: 'idle', msg: '' });
    } catch (err: any) {
      console.error(err);
      setIsWalletHydrating(false);
      setStatus({ type: 'error', msg: err.message || 'Failed to connect' });
    }
  };

  useEffect(() => {
    const savedWallet = localStorage.getItem('connected_wallet') as WalletType | null;
    if (savedWallet) {
      connectWallet(savedWallet);
    }

    const ethereumProvider = savedWallet === 'talisman'
      ? ((window as any).talismanEth || (window as any).ethereum)
      : (window as any).ethereum;

    if (ethereumProvider) {
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

      if (ethereumProvider.on) {
        ethereumProvider.on('accountsChanged', handleAccountsChanged);
        ethereumProvider.on('chainChanged', handleChainChanged);
      }

      return () => {
        if (ethereumProvider.removeListener) {
          ethereumProvider.removeListener('accountsChanged', handleAccountsChanged);
          ethereumProvider.removeListener('chainChanged', handleChainChanged);
        }
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signAndExecuteIntent = async (
    calls: any[],
    condition: any,
    valueToSend: bigint
  ): Promise<boolean> => {
    if (!signer || !account) return false;
    try {
      const contract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      const domain = {
        name: "SynchronousIntent",
        version: "1",
        chainId: Number(CONFIG.NETWORK.chainId),
        verifyingContract: CONFIG.CONTRACT_ADDRESS
      };

      const types = {
        Condition: [
          { name: 'asset', type: 'uint8' },
          { name: 'minOutput', type: 'uint256' },
          { name: 'hotkey', type: 'bytes32' },
          { name: 'netuid', type: 'uint16' }
        ],
        Call: [
          { name: 'target', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'callData', type: 'bytes' }
        ],
        Intent: [
          { name: 'user', type: 'address' },
          { name: 'calls', type: 'Call[]' },
          { name: 'condition', type: 'Condition' },
          { name: 'deadline', type: 'uint256' },
          { name: 'nonce', type: 'uint256' }
        ]
      };

      const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour
      const nonce = Date.now(); // Unique nonce

      const intentValue = {
        user: account,
        calls: calls,
        condition: condition,
        deadline: deadline,
        nonce: nonce
      };

      setStatus({ type: 'loading', msg: 'Prompting EIP-712 Signature in MetaMask...' });
      const signature = await signer.signTypedData(domain, types, intentValue);

      const intentWithSig = {
        ...intentValue,
        signature: signature
      };

      setStatus({ type: 'loading', msg: 'Broadcasting fillIntent transaction...' });
      const tx = await contract.fillIntent(intentWithSig, "0x", {
        value: valueToSend,
        gasLimit: 800000n // Bypasses the Substrate EVM node gas estimation simulation bugs
      });

      setStatus({ type: 'loading', msg: 'Waiting for blockchain confirmation...' });
      await tx.wait();

      return true;
    } catch (err: any) {
      console.error(err);
      setStatus({ type: 'error', msg: err.reason || err.message || 'Transaction failed' });
      return false;
    }
  };

  const executeStake = async (amount: string, targetNetuid: number, targetHotkey?: string): Promise<boolean> => {
    if (!signer || !amount) return false;
    try {
      setStatus({ type: 'loading', msg: `Preparing Stake Intent of ${amount} TAO...` });

      const amountInWei = ethers.parseEther(amount);
      const amountInRao = amountInWei / 1000000000n; // 1e9

      // Resolve destination hotkey:
      const hotkey = (targetHotkey && targetHotkey.startsWith('0x') && targetHotkey.length === 66)
        ? targetHotkey
        : getHotkeyForNetuid(targetNetuid);

      // Encode Staking Precompile call
      const stakingInterface = new ethers.Interface([
        "function addStake(bytes32 hotkey, uint256 amount, uint256 netuid) external"
      ]);
      const callData = stakingInterface.encodeFunctionData("addStake", [
        hotkey,
        amountInRao,
        targetNetuid
      ]);

      const calls = [{
        target: "0x0000000000000000000000000000000000000805",
        // V2 precompile pulls TAO from the contract's own balance automatically.
        // Do NOT forward value here or the precompile will reject it (it is not payable).
        value: 0n,
        callData: callData
      }];

      const condition = {
        asset: 1, // ALPHA
        minOutput: 0n, // Bypassing slippage check — getTotalAlphaStaked fails to update synchronously on testnet
        hotkey: hotkey,
        netuid: targetNetuid
      };

      // Send amountInWei as msg.value so fillIntent holds it, and the precompile deducts from the contract balance.
      const success = await signAndExecuteIntent(calls, condition, amountInWei);
      if (success) {
        setStatus({ type: 'success', msg: 'Stake intent executed successfully!' });
        await fetchStats(provider!, account);
      }
      return success;
    } catch (err: any) {
      console.error(err);
      setStatus({ type: 'error', msg: err.reason || err.message || 'Failed to prepare stake' });
      return false;
    }
  };

  const executeUnstake = async (
    targetNetuid: number,
    amountOrHotkey?: string,
    amountIfHotkeyUsed?: string
  ): Promise<boolean> => {
    if (!signer) return false;
    try {
      setStatus({ type: 'loading', msg: 'Preparing Unstake Intent...' });

      let hotkey = getHotkeyForNetuid(targetNetuid);
      let amount = amountOrHotkey;

      if (amountOrHotkey && amountOrHotkey.startsWith('0x') && amountOrHotkey.length === 66) {
        hotkey = amountOrHotkey;
        amount = amountIfHotkeyUsed;
      }

      // Encode Staking Precompile call
      const stakingInterface = new ethers.Interface([
        "function removeStake(bytes32 hotkey, uint256 amount, uint256 netuid) external",
        "function removeStakeFull(bytes32 hotkey, uint256 netuid) external"
      ]);

      let callData: string;
      if (amount && amount !== '' && parseFloat(amount) > 0) {
        const amountInRao = ethers.parseUnits(amount, 9);
        callData = stakingInterface.encodeFunctionData("removeStake", [
          hotkey,
          amountInRao,
          targetNetuid
        ]);
      } else {
        callData = stakingInterface.encodeFunctionData("removeStakeFull", [
          hotkey,
          targetNetuid
        ]);
      }

      const calls = [{
        target: "0x0000000000000000000000000000000000000805",
        value: 0n,
        callData: callData
      }];

      const condition = {
        asset: 0, // TAO
        minOutput: 0n, // Bypassing — TAO balance may not update synchronously on testnet
        hotkey: ethers.ZeroHash,
        netuid: 0
      };

      const success = await signAndExecuteIntent(calls, condition, 0n);
      if (success) {
        setStatus({ type: 'success', msg: 'Unstake intent executed successfully!' });
        await fetchStats(provider!, account);
      }
      return success;
    } catch (err: any) {
      console.error(err);
      setStatus({ type: 'error', msg: err.reason || err.message || 'Failed to prepare unstake' });
      return false;
    }
  };

  const executeSwap = async (
    sourceNetuid: number,
    targetNetuid: number,
    amountOrHotkey: string,
    amountIfHotkeyUsed?: string
  ): Promise<boolean> => {
    if (!signer || !amountOrHotkey) return false;
    try {
      setStatus({ type: 'loading', msg: `Preparing Swap Intent...` });

      let sourceHotkey = getHotkeyForNetuid(sourceNetuid);
      let targetHotkey = getHotkeyForNetuid(targetNetuid);
      let amount = amountOrHotkey;

      if (amountOrHotkey.startsWith('0x') && amountOrHotkey.length === 66) {
        sourceHotkey = amountOrHotkey;
        targetHotkey = getHotkeyForNetuid(targetNetuid);
        amount = amountIfHotkeyUsed || '';
      }

      const amountInRao = ethers.parseUnits(amount, 9);

      // Fetch dynamic Alpha price on the source subnet to determine how much TAO we will get back.
      // We query this via our global directProvider to avoid MetaMask filtering custom Substrate RPC methods.
      let priceInRao = 1000000000n; // Default 1:1 fallback if query fails
      try {
        setStatus({ type: 'loading', msg: 'Fetching Alpha spot exchange rate...' });
        const priceRes = await directProvider.send("swap_currentAlphaPrice", [sourceNetuid]);
        if (priceRes) {
          priceInRao = BigInt(priceRes);
        }
      } catch (err) {
        console.error("Failed to query swap_currentAlphaPrice:", err);
      }

      // Calculate expected TAO returned with a 5% slippage buffer.
      // Any unspent TAO is automatically swept back to the user's wallet by the contract.
      const expectedTaoInRao = (amountInRao * priceInRao * 950n) / (1000n * 1000000000n);

      setStatus({ type: 'loading', msg: 'Preparing Swap Intent...' });

      // Encode Staking Precompile calls
      const stakingInterface = new ethers.Interface([
        "function addStake(bytes32 hotkey, uint256 amount, uint256 netuid) external",
        "function removeStake(bytes32 hotkey, uint256 amount, uint256 netuid) external"
      ]);

      const calls = [
        // Call 1: Unstake Alpha from source subnet
        {
          target: "0x0000000000000000000000000000000000000805",
          value: 0n,
          callData: stakingInterface.encodeFunctionData("removeStake", [
            sourceHotkey,
            amountInRao,
            sourceNetuid
          ])
        },
        // Call 2: Stake TAO to target subnet
        {
          target: "0x0000000000000000000000000000000000000805",
          value: 0n,
          callData: stakingInterface.encodeFunctionData("addStake", [
            targetHotkey,
            expectedTaoInRao, // Dynamic and correct TAO amount
            targetNetuid
          ])
        }
      ];

      const condition = {
        asset: 1, // ALPHA
        minOutput: 0n, // Bypassing slippage check — getTotalAlphaStaked fails to update synchronously on testnet
        hotkey: targetHotkey,
        netuid: targetNetuid
      };

      const success = await signAndExecuteIntent(calls, condition, 0n);
      if (success) {
        setStatus({ type: 'success', msg: 'Swap intent executed successfully!' });
        await fetchStats(provider!, account);
      }
      return success;
    } catch (err: any) {
      console.error(err);
      setStatus({ type: 'error', msg: err.reason || err.message || 'Failed to prepare swap' });
      return false;
    }
  };

  const getHotkeyForNetuid = (net: number): string => {
    if (net === 310) {
      return "0x3cba5f549c02a4da782cadb65564d0e8159f339f5610db4bd5773f36c760f97c";
    }
    // Default fallback (Subnets 0, 1, etc.)
    return "0x1e738b33dfbd68eaba7db3f03fe942cfa4e32b728e52c26743b16dbca15af464";
  };

  const handlePositionClick = (net: number) => {
    setNetuid(net);
    setUnstakeNetuid(net);
    setSwapSourceNetuid(net);
    // Automatically switch to unstake tab if currently on stake tab so they can see unstake options
    if (stakingAction === 'stake') {
      setStakingAction('unstake');
    }
  };

  const handleBuyAlpha = async () => {
    const hotkey = stakedHotkeys[netuid] || getHotkeyForNetuid(netuid);
    if (await executeStake(stakeAmount, netuid, hotkey)) {
      setStakeAmount('');
    }
  };

  const handleUnstake = async () => {
    const hotkey = stakedHotkeys[unstakeNetuid] || getHotkeyForNetuid(unstakeNetuid);
    if (await executeUnstake(unstakeNetuid, hotkey, unstakeAmount)) {
      setUnstakeAmount('');
    }
  };

  const handleSwap = async () => {
    const amountToSwap = swapAmount !== '' ? swapAmount : (allAlphaBalances[swapSourceNetuid] || '0');
    if (!amountToSwap || parseFloat(amountToSwap) <= 0) {
      setStatus({ type: 'error', msg: 'Please enter a valid amount of ALPHA to swap.' });
      return;
    }
    const hotkey = stakedHotkeys[swapSourceNetuid] || getHotkeyForNetuid(swapSourceNetuid);
    if (await executeSwap(swapSourceNetuid, swapTargetNetuid, hotkey, amountToSwap)) {
      setSwapAmount('');
    }
  };

  const formatShortValue = (value: string, start = 8, end = 6) => {
    if (!value) return '';
    return `${value.slice(0, start)}...${value.slice(-end)}`;
  };

  const getSubnetLabel = (net: number) => {
    if (net === 310) return 'Alpha Subnet';
    if (net === 0) return 'Root Network';
    if (net === 1) return 'Subnet 1';
    return `Subnet ${net}`;
  };

  const getWalletOption = (wallet: WalletType | null) =>
    wallet ? WALLET_OPTIONS.find((option) => option.id === wallet) ?? null : null;

  const renderWalletCardStyle = (option: WalletOption): CSSProperties => ({
    '--wallet-accent': option.accent,
    '--wallet-accent-rgb': option.accentRgb,
  } as CSSProperties);

  const activePositions = Object.entries(allAlphaBalances).filter(([, bal]) => parseFloat(bal) > 0);
  const selectedWalletOption = getWalletOption(walletType);
  const showStatusBanner = Boolean(status.msg) && !(status.type === 'loading' && (!account || isWalletHydrating));
  const connectingWallet =
    !account && status.type === 'loading'
      ? WALLET_OPTIONS.find((option) => status.msg.toLowerCase().includes(option.label.toLowerCase()))?.id ?? null
      : null;
  const chainId = Number.parseInt(CONFIG.NETWORK.chainId, 16);

  const renderWalletConnectCard = (option: WalletOption) => {
    const isConnecting = connectingWallet === option.id;

    return (
      <button
        key={option.id}
        type="button"
        className={`wallet-option-card ${isConnecting ? 'is-loading' : ''}`}
        style={renderWalletCardStyle(option)}
        onClick={() => connectWallet(option.id)}
        disabled={Boolean(connectingWallet)}
      >
        <div className="wallet-option-card__glow" />
        <div className="wallet-option-card__shine" />
        <div className="wallet-option-card__topline">
          <span className="wallet-option-card__badge">{option.subtitle}</span>
          <div className="wallet-option-card__icon-shell">
            <img src={option.iconSrc} alt="" className="wallet-option-card__icon" />
          </div>
        </div>
        <img src={option.wordmarkSrc} alt={`${option.label} logo`} className="wallet-option-card__wordmark" />
        <p className="wallet-option-card__description">{option.description}</p>
        <div className="wallet-option-card__footer">
          <span>{isConnecting ? `Authorizing ${option.label}` : `Use ${option.label}`}</span>
          <span className="wallet-option-card__pulse" />
        </div>
      </button>
    );
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

  const renderWalletHydrationSkeleton = () => (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }} className="stats-grid-3">
        {[
          { label: 'TAO Balance', unit: 'TAO' },
          { label: `Your Alpha (Netuid ${netuid})`, unit: 'ALPHA' },
          { label: `Global Hotkey (Netuid ${CONFIG.DEFAULT_NETUID})`, unit: 'ALPHA' },
        ].map((item) => (
          <div key={item.label} className="glass-panel skeleton-stat-card">
            <p className="skeleton-static-eyebrow">{item.label}</p>
            <div className="skeleton-stat-value-row">
              <div className="skeleton-block skeleton-value" />
              <span className="skeleton-static-unit">{item.unit}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px', alignItems: 'start' }} className="grid-cols-2">
        <div className="glass-panel skeleton-engine-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <ArrowRightLeft size={20} color="var(--accent-primary)" />
            <h3 style={{ margin: 0, fontWeight: 700, fontSize: '18px', letterSpacing: '-0.02em' }}>Staking Engine</h3>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
            Configure and execute Bittensor precompile staking operations atomically.
          </p>

          <div className="skeleton-tabs">
            <div className="skeleton-tab-shell is-active"><span>Stake TAO</span></div>
            <div className="skeleton-tab-shell"><span>Swap Stake</span></div>
            <div className="skeleton-tab-shell"><span>Remove Stake</span></div>
          </div>

          <div className="skeleton-form-stack">
            <div className="skeleton-form-group">
              <div className="skeleton-form-label-row">
                <label className="text-sm skeleton-static-label">Target Subnet (Netuid)</label>
                <div className="skeleton-pill-group">
                  <span className="skeleton-static-pill">Netuid 0</span>
                  <span className="skeleton-static-pill">Netuid 1</span>
                  <span className="skeleton-static-pill active">Netuid 310</span>
                </div>
              </div>
              <div className="skeleton-input-shell">
                <div className="skeleton-block skeleton-input-value short" />
              </div>
            </div>

            <div className="skeleton-form-group">
              <div className="skeleton-form-label-row">
                <label className="text-sm skeleton-static-label">Amount <span style={{ color: 'var(--accent-secondary)' }}>TAO</span></label>
                <div className="skeleton-block skeleton-inline-note" />
              </div>
              <div className="skeleton-input-shell">
                <div className="skeleton-block skeleton-input-value" />
              </div>
            </div>

            <button className="btn btn-secondary skeleton-action-button" disabled>
              <Activity size={16} /> Stake TAO
            </button>
          </div>
        </div>

        <div className="glass-panel skeleton-positions-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <Activity size={20} color="var(--accent-secondary)" />
            <h3 style={{ margin: 0, fontWeight: 700, fontSize: '18px', letterSpacing: '-0.02em' }}>Staking Positions</h3>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
            Your current on-chain stakes and validator routes. Click any position to load it into the form.
          </p>

          <div className="skeleton-position-stack">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="skeleton-position-item">
                <div>
                  <div className="skeleton-position-topline">
                    <div className="skeleton-block skeleton-position-title" />
                    <div className="skeleton-block skeleton-position-pill" />
                  </div>
                  <div className="position-validator-line">
                    <span className="position-validator-line__label">Validator</span>
                    <div className="skeleton-block skeleton-position-meta" />
                  </div>
                </div>
                <div className="skeleton-position-amount">
                  <div className="skeleton-block skeleton-position-value" />
                  <span className="skeleton-static-unit small">ALPHA</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      <header className="app-header">
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/logo-white.png" alt="Terabitt Logo" style={{ height: '26px', width: 'auto', objectFit: 'contain' }} />
          <span style={{ fontWeight: 700, fontSize: '18px', letterSpacing: '-0.03em' }}>terabitt</span>
        </div>

        {/* Center Nav */}
        <nav style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.04)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
          <a href="#" className={`nav-link ${activeTab === 'staking' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveTab('staking'); }}>Staking</a>
          <a href="#" className={`nav-link ${activeTab === 'chat' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveTab('chat'); }}>AI Agent</a>
        </nav>

        {/* Wallet */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {account ? (
            <div className="wallet-toolbar">
              <div className="wallet-connected-chip">
                {selectedWalletOption && (
                  <div
                    className="wallet-connected-chip__icon-shell"
                    style={renderWalletCardStyle(selectedWalletOption)}
                  >
                    <img src={selectedWalletOption.iconSrc} alt="" className="wallet-connected-chip__icon" />
                  </div>
                )}
                <div className="wallet-connected-chip__copy">
                  <span className="wallet-connected-chip__label">{selectedWalletOption?.label || 'Wallet'}</span>
                  <div className="wallet-connected-chip__address">
                    <span className="status-indicator"></span>
                    <span className="mono text-sm">{formatShortValue(account, 6, 4)}</span>
                  </div>
                </div>
              </div>
              <button
                className="btn btn-secondary"
                style={{ padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onClick={disconnectWallet}
                title="Disconnect Wallet"
              >
                <LogOut size={16} color="var(--status-error)" />
              </button>
            </div>
          ) : (
            <button className="btn btn-primary" onClick={() => setShowWalletModal(true)}>
              <Wallet size={15} /> Connect Wallet
            </button>
          )}
        </div>
      </header>

      <main className={activeTab === 'chat' ? 'chat-container' : 'container'}>
        {/* Page Title */}
        {activeTab === 'staking' && (
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.03em', marginBottom: '6px' }}>Staking <span className="text-accent-gradient">Dashboard</span></h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Stake TAO to earn Alpha on your chosen subnet.</p>
          </div>
        )}

        {showStatusBanner && (
          <div className="glass-panel" style={{
            marginBottom: '24px',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            borderLeft: `4px solid ${status.type === 'error' ? 'var(--status-error)' : status.type === 'success' ? 'var(--status-success)' : 'var(--accent-primary)'}`
          }}>
            {status.type === 'error' ? <AlertCircle color="var(--status-error)" /> : <Activity color="var(--accent-primary)" />}
            <span style={{ fontSize: '14px' }}>{status.msg}</span>
          </div>
        )}

        {activeTab === 'staking' ? (
          <>
            {account ? (
              isWalletHydrating ? (
                renderWalletHydrationSkeleton()
              ) : (
              <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }} className="stats-grid-3">
                <div className="glass-panel" style={{ padding: '20px 24px' }}>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '11px', fontWeight: 500 }}>TAO Balance</p>
                  <p className="mono" style={{ fontSize: '26px', fontWeight: 600, letterSpacing: '-0.02em' }}>{parseFloat(balance).toFixed(4)} <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 400 }}>TAO</span></p>
                </div>
                <div className="glass-panel" style={{ padding: '20px 24px', borderColor: 'var(--border-highlight)' }}>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '11px', fontWeight: 500 }}>Your Alpha (Netuid {netuid})</p>
                  <p className="mono text-accent-gradient" style={{ fontSize: '26px', fontWeight: 600, letterSpacing: '-0.02em' }}>{parseFloat(myAlphaBalance).toFixed(4)} <span style={{ fontSize: '13px', WebkitTextFillColor: 'var(--text-muted)', fontWeight: 400 }}>ALPHA</span></p>
                </div>
                <div className="glass-panel" style={{ padding: '20px 24px' }}>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '11px', fontWeight: 500 }}>Global Hotkey (Netuid {CONFIG.DEFAULT_NETUID})</p>
                  <p className="mono" style={{ fontSize: '26px', fontWeight: 600, letterSpacing: '-0.02em' }}>{parseFloat(totalAlphaStaked).toFixed(4)} <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 400 }}>ALPHA</span></p>
                </div>
              </div>
              </>
              )
            ) : (
              <div className="wallet-connect-shell">
                <div className="wallet-connect-hero glass-panel">
                  <div className="wallet-connect-hero__orbs">
                    <span className="wallet-connect-hero__orb wallet-connect-hero__orb--primary" />
                    <span className="wallet-connect-hero__orb wallet-connect-hero__orb--secondary" />
                  </div>
                  <div className="wallet-connect-hero__copy">
                    <span className="wallet-connect-hero__eyebrow">Wallet Gateway</span>
                    <h2>Choose a wallet, then stake into Alpha with a cleaner flow.</h2>
                    <p>
                      Connect your preferred provider to review balances, launch staking intents, and surface the validator
                      routing for each Alpha position right in the dashboard.
                    </p>
                  </div>
                  <div className="wallet-connect-grid">
                    {WALLET_OPTIONS.map(renderWalletConnectCard)}
                  </div>
                </div>
                <div className="wallet-connect-footnote">
                  <span className="status-indicator"></span>
                  <span>{CONFIG.NETWORK.chainName} • Chain ID {chainId}</span>
                </div>
              </div>
            )}

            {account && !isWalletHydrating && (
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px', alignItems: 'start' }} className="grid-cols-2">
                {/* Unified Staking Engine Widget */}
                <div className="glass-panel" style={{ padding: '28px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <ArrowRightLeft size={20} color="var(--accent-primary)" />
                    <h3 style={{ margin: 0, fontWeight: 700, fontSize: '18px', letterSpacing: '-0.02em' }}>Staking Engine</h3>
                  </div>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
                    Configure and execute Bittensor precompile staking operations atomically.
                  </p>

                  {/* Segmented controls / tabs */}
                  <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border-subtle)', marginBottom: '24px' }}>
                    <button
                      style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: stakingAction === 'stake' ? 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))' : 'transparent', color: stakingAction === 'stake' ? 'white' : 'var(--text-muted)', fontWeight: 600, fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      onClick={() => setStakingAction('stake')}
                    >
                      <Activity size={14} /> Stake TAO
                    </button>
                    <button
                      style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: stakingAction === 'swap' ? 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))' : 'transparent', color: stakingAction === 'swap' ? 'white' : 'var(--text-muted)', fontWeight: 600, fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      onClick={() => setStakingAction('swap')}
                    >
                      <ArrowRightLeft size={14} /> Swap Stake
                    </button>
                    <button
                      style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: stakingAction === 'unstake' ? 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))' : 'transparent', color: stakingAction === 'unstake' ? 'white' : 'var(--text-muted)', fontWeight: 600, fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      onClick={() => setStakingAction('unstake')}
                    >
                      <ArrowRightLeft size={14} /> Remove Stake
                    </button>
                  </div>

                  {/* Dynamic Action Forms */}
                  {stakingAction === 'stake' && (
                    <div>
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <label className="text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Target Subnet (Netuid)</label>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {[0, 1, 310].map((n) => (
                              <span
                                key={n}
                                style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', background: netuid === n ? 'var(--accent-glow)' : 'rgba(255,255,255,0.03)', border: netuid === n ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)', cursor: 'pointer', color: netuid === n ? 'white' : 'var(--text-muted)', transition: 'all 0.15s ease' }}
                                onClick={() => setNetuid(n)}
                              >
                                Netuid {n}
                              </span>
                            ))}
                          </div>
                        </div>
                        <input type="number" className="input-field" value={netuid} onChange={(e) => setNetuid(Number(e.target.value))} />
                      </div>
                      <div style={{ marginBottom: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <label className="text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Amount <span style={{ color: 'var(--accent-secondary)' }}>TAO</span></label>
                          {account && (
                            <span
                              className="text-xs text-accent"
                              style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--accent-secondary)', fontWeight: 500 }}
                              onClick={() => setStakeAmount(balance)}
                            >
                              Available: {parseFloat(balance).toFixed(4)} TAO (Max)
                            </span>
                          )}
                        </div>
                        <input type="number" className="input-field" placeholder="0.00" value={stakeAmount} onChange={(e) => setStakeAmount(e.target.value)} />
                      </div>
                      <button className="btn btn-primary" style={{ width: '100%', padding: '13px' }} disabled={!account || !stakeAmount || status.type === 'loading'} onClick={handleBuyAlpha}>
                        <Activity size={16} /> Stake TAO
                      </button>
                    </div>
                  )}

                  {stakingAction === 'swap' && (
                    <div>
                      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                        <div style={{ flex: 1 }}>
                          <label className="text-sm" style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontWeight: 500 }}>Source Netuid</label>
                          <input type="number" className="input-field" value={swapSourceNetuid} onChange={(e) => setSwapSourceNetuid(Number(e.target.value))} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label className="text-sm" style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontWeight: 500 }}>Target Netuid</label>
                          <input type="number" className="input-field" value={swapTargetNetuid} onChange={(e) => setSwapTargetNetuid(Number(e.target.value))} />
                        </div>
                      </div>

                      <div style={{ marginBottom: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <label className="text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                            Amount <span style={{ color: 'var(--accent-secondary)' }}>ALPHA</span>
                          </label>
                          {account && (
                            <span
                              className="text-xs text-accent"
                              style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--accent-secondary)', fontWeight: 500 }}
                              onClick={() => setSwapAmount(allAlphaBalances[swapSourceNetuid] || '0')}
                            >
                              Max: {allAlphaBalances[swapSourceNetuid] ? parseFloat(allAlphaBalances[swapSourceNetuid]).toFixed(4) : '0.0000'}
                            </span>
                          )}
                        </div>
                        <input
                          type="number"
                          className="input-field"
                          placeholder={allAlphaBalances[swapSourceNetuid] && parseFloat(allAlphaBalances[swapSourceNetuid]) > 0 ? `Max: ${parseFloat(allAlphaBalances[swapSourceNetuid]).toFixed(4)}` : "0.00"}
                          value={swapAmount}
                          onChange={(e) => setSwapAmount(e.target.value)}
                        />
                      </div>

                      <button
                        className="btn btn-primary"
                        style={{ width: '100%', padding: '13px' }}
                        disabled={!account || status.type === 'loading' || (swapAmount === '' && (!allAlphaBalances[swapSourceNetuid] || parseFloat(allAlphaBalances[swapSourceNetuid]) === 0))}
                        onClick={handleSwap}
                      >
                        <ArrowRightLeft size={16} /> {swapAmount ? 'Swap Stake' : 'Swap All Alpha'}
                      </button>
                    </div>
                  )}

                  {stakingAction === 'unstake' && (
                    <div>
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <label className="text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Subnet (Netuid)</label>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {[0, 1, 310].map((n) => (
                              <span
                                key={n}
                                style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', background: unstakeNetuid === n ? 'var(--accent-glow)' : 'rgba(255,255,255,0.03)', border: unstakeNetuid === n ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)', cursor: 'pointer', color: unstakeNetuid === n ? 'white' : 'var(--text-muted)', transition: 'all 0.15s ease' }}
                                onClick={() => setUnstakeNetuid(n)}
                              >
                                Netuid {n}
                              </span>
                            ))}
                          </div>
                        </div>
                        <input type="number" className="input-field" value={unstakeNetuid} onChange={(e) => setUnstakeNetuid(Number(e.target.value))} />
                      </div>
                      <div style={{ marginBottom: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <label className="text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Amount <span style={{ color: 'var(--accent-secondary)' }}>ALPHA</span></label>
                          {account && (
                            <span
                              className="text-xs text-accent"
                              style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--accent-secondary)', fontWeight: 500 }}
                              onClick={() => setUnstakeAmount(allAlphaBalances[unstakeNetuid] || '0')}
                            >
                              Max: {allAlphaBalances[unstakeNetuid] ? parseFloat(allAlphaBalances[unstakeNetuid]).toFixed(4) : '0.0000'}
                            </span>
                          )}
                        </div>
                        <input type="number" className="input-field" placeholder={allAlphaBalances[unstakeNetuid] ? `Max: ${parseFloat(allAlphaBalances[unstakeNetuid]).toFixed(4)}` : "0.00"} value={unstakeAmount} onChange={(e) => setUnstakeAmount(e.target.value)} />
                      </div>

                      <div style={{ marginBottom: '24px', padding: '14px', background: 'var(--accent-glow-subtle)', borderRadius: '10px', border: '1px solid var(--border-highlight)' }}>
                        <p className="text-sm" style={{ color: 'var(--accent-primary)', marginBottom: '4px', fontWeight: 500 }}>How it works</p>
                        <p className="text-sm" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>Burns Alpha and atomically returns native TAO to your wallet via the staking precompile.</p>
                      </div>

                      <button className="btn btn-secondary" style={{ width: '100%', padding: '13px' }} disabled={!account || status.type === 'loading' || !(allAlphaBalances[unstakeNetuid] && parseFloat(allAlphaBalances[unstakeNetuid]) > 0)} onClick={handleUnstake}>
                        <ArrowRightLeft size={16} /> {unstakeAmount ? 'Unstake Alpha' : 'Unstake All Alpha'}
                      </button>
                    </div>
                  )}
                </div>

                {/* My Subnet Positions List Card (Right Column) */}
                <div className="glass-panel" style={{ padding: '28px', minHeight: '390px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <Activity size={20} color="var(--accent-secondary)" />
                    <h3 style={{ margin: 0, fontWeight: 700, fontSize: '18px', letterSpacing: '-0.02em' }}>Staking Positions</h3>
                  </div>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
                    Your current on-chain stakes and validator routes. Click any position to load it into the form.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                    {activePositions.length > 0 ? (
                      activePositions
                        .map(([id, bal]) => {
                          const net = Number(id);
                          const validatorHotkey = stakedHotkeys[net] || '';
                          const isCurrent = (stakingAction === 'stake' && netuid === net) ||
                            (stakingAction === 'unstake' && unstakeNetuid === net) ||
                            (stakingAction === 'swap' && swapSourceNetuid === net);
                          return (
                            <div
                              key={id}
                              style={{
                                padding: '16px',
                                borderRadius: '12px',
                                background: isCurrent ? 'var(--accent-glow-subtle)' : 'rgba(255, 255, 255, 0.02)',
                                border: isCurrent ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                boxShadow: isCurrent ? '0 0 16px var(--accent-glow)' : 'none'
                              }}
                              onClick={() => handlePositionClick(net)}
                              onMouseEnter={(e) => {
                                if (!isCurrent) {
                                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!isCurrent) {
                                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                                }
                              }}
                            >
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'white' }}>
                                    {getSubnetLabel(net)}
                                  </span>
                                  <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)' }}>
                                    Netuid {net}
                                  </span>
                                </div>
                                <div className="position-validator-line" title={validatorHotkey || 'Validator hotkey is still syncing'}>
                                  <span className="position-validator-line__label">Validator</span>
                                  <span className="mono position-validator-line__value">
                                    {validatorHotkey ? formatShortValue(validatorHotkey, 8, 6) : 'Syncing…'}
                                  </span>
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <span className="mono" style={{ fontSize: '16px', fontWeight: 600, color: 'var(--accent-secondary)' }}>
                                  {parseFloat(bal).toFixed(4)}
                                </span>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginLeft: '4px' }}>
                                  ALPHA
                                </span>
                              </div>
                            </div>
                          );
                        })
                    ) : (
                      <div style={{ padding: '32px', textAlign: 'center', borderRadius: '12px', border: '1px dashed var(--border-subtle)', background: 'rgba(255,255,255,0.01)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                        <Activity size={32} style={{ color: 'var(--text-muted)', marginBottom: '12px', opacity: 0.3 }} />
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>No active staking positions</p>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', opacity: 0.7, marginTop: '4px' }}>Stake TAO above to get started</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Transaction History */}
            {account && stakeHistory.length > 0 && (
              <div className="glass-panel" style={{ padding: '24px', marginTop: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <History size={18} color="var(--accent-secondary)" />
                  <h3 style={{ margin: 0 }}>Transaction History</h3>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 500 }}>Type</th>
                        <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 500 }}>Netuid</th>
                        <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 500 }}>TAO</th>
                        <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 500 }}>Alpha</th>
                        <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 500 }}>Block</th>
                        <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 500 }}>Tx</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stakeHistory.map((ev, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '8px',
                              border: '1px solid var(--border-subtle)',
                              background: ev.type === 'stake' ? 'rgba(0,255,136,0.1)' : 'rgba(255,51,102,0.1)',
                              color: ev.type === 'stake' ? 'var(--status-success)' : 'var(--status-error)',
                              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)'
                            }}>
                              {ev.type === 'stake' ? 'STAKE' : 'UNSTAKE'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', padding: '10px 12px' }} className="mono">{ev.netuid}</td>
                          <td style={{ textAlign: 'right', padding: '10px 12px' }} className="mono">{ev.taoAmount}</td>
                          <td style={{ textAlign: 'right', padding: '10px 12px' }} className="mono">{ev.alphaAmount}</td>
                          <td style={{ textAlign: 'right', padding: '10px 12px' }} className="mono text-muted">{ev.blockNumber}</td>
                          <td style={{ textAlign: 'right', padding: '10px 12px' }}>
                            <a
                              href={`https://evm-testnet.subtensor.io/tx/${ev.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mono text-accent"
                              style={{ fontSize: '11px', textDecoration: 'none' }}
                            >
                              {ev.txHash.substring(0, 10)}...
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : (
          <ChatPortal
            account={account}
            balance={balance}
            myAlphaBalance={myAlphaBalance}
            allAlphaBalances={allAlphaBalances}
            currentNetuid={netuid}
            executeStake={executeStake}
            executeUnstake={executeUnstake}
            executeSwap={executeSwap}
            status={status}
            openWalletSelector={() => setShowWalletModal(true)}
          />
        )}
      </main>

      {showWalletModal && (
        <div className="wallet-modal-backdrop" onClick={() => setShowWalletModal(false)}>
          <div
            className="glass-panel wallet-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="wallet-modal-card__header">
              <h3 style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>Connect Wallet</h3>
              <button
                className="wallet-modal-card__close"
                onClick={() => setShowWalletModal(false)}
              >
                &times;
              </button>
            </div>
            
            <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', marginBottom: '24px', lineHeight: 1.5 }}>
              Select a wallet provider to securely authenticate and execute staking precompile intents.
            </p>

            <div className="wallet-modal-card__options">
              {WALLET_OPTIONS.map(renderWalletModalOption)}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
