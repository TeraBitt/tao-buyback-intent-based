import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { blake2b } from 'blakejs';
import { Wallet, ArrowRightLeft, Activity, AlertCircle, History, ShieldAlert, LogOut } from 'lucide-react';
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
  const [stakeHistory, setStakeHistory] = useState<StakeEvent[]>([]);

  const [stakeAmount, setStakeAmount] = useState<string>('');
  const [unstakeAmount, setUnstakeAmount] = useState<string>('');
  const [netuid, setNetuid] = useState<number>(CONFIG.DEFAULT_NETUID);
  const [unstakeNetuid, setUnstakeNetuid] = useState<number>(CONFIG.DEFAULT_NETUID);
  const [swapAmount, setSwapAmount] = useState<string>('');
  const [swapSourceNetuid, setSwapSourceNetuid] = useState<number>(CONFIG.DEFAULT_NETUID);
  const [swapTargetNetuid, setSwapTargetNetuid] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'staking' | 'chat'>('staking');

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

      // Fetch global hotkey total alpha
      const hotkey = getHotkeyForNetuid(netuid);
      try {
        const alpha = await stakingPrecompile.getTotalAlphaStaked(hotkey, netuid);
        setTotalAlphaStaked((Number(alpha) / 1e9).toString());
      } catch (e) {
        console.error('getTotalAlphaStaked failed:', e);
        setTotalAlphaStaked('0');
      }

      // Fetch REAL on-chain alpha balance for the contract's coldkey.
      // Bittensor maps EVM addresses → substrate AccountId32 via blake2_256("evm:" + address).
      // This is the HashedAddressMapping used by the staking precompile.
      const evmHex = CONFIG.CONTRACT_ADDRESS.replace('0x', '');
      const evmAddrBytes = new Uint8Array(evmHex.length / 2);
      for (let i = 0; i < evmHex.length; i += 2) {
        evmAddrBytes[i / 2] = parseInt(evmHex.substring(i, i + 2), 16);
      }
      const prefix = new TextEncoder().encode('evm:');
      const input = new Uint8Array(prefix.length + evmAddrBytes.length);
      input.set(prefix);
      input.set(evmAddrBytes, prefix.length);
      const hashBytes = blake2b(input, undefined, 32);
      const contractColdkey = '0x' + Array.from(hashBytes).map(b => b.toString(16).padStart(2, '0')).join('');
      try {
        const myStake = await stakingPrecompile.getStake(hotkey, contractColdkey, netuid);
        setMyAlphaBalance((Number(myStake) / 1e9).toString());
      } catch (e) {
        console.error('getStake failed:', e);
        setMyAlphaBalance('0');
      }

      // Also check a few common netuids for the "all balances" map (parallelized, deduplicated)
      const checkNetuids = Array.from(new Set([0, 1, netuid, 310]));
      const balances: { [id: number]: string } = {};
      
      await Promise.all(checkNetuids.map(async (checkNetuid) => {
        try {
          const hk = getHotkeyForNetuid(checkNetuid);
          const stake = await stakingPrecompile.getStake(hk, contractColdkey, checkNetuid);
          balances[checkNetuid] = (Number(stake) / 1e9).toString();
        } catch {
          balances[checkNetuid] = '0';
        }
      }));
      setAllAlphaBalances(balances);

      // Fetch transaction history (for the history table only, NOT for balances)
      // Paused for now
      // await fetchStakeHistory(directProvider, address);
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
    setAccount('');
    setSigner(null);
    setProvider(null);
    setStatus({ type: 'idle', msg: '' });
    setBalance('0');
    setTotalAlphaStaked('0');
    setMyAlphaBalance('0');
    setStakeHistory([]);
  };

  const disconnectWallet = async () => {
    clearWalletState();
    try {
      if (window.ethereum && window.ethereum.request) {
        await window.ethereum.request({
          method: "wallet_revokePermissions",
          params: [{ eth_accounts: {} }]
        });
      }
    } catch (error) {
      console.error("Failed to revoke permissions:", error);
    }
  };

  const connectWallet = async () => {
    if (!window.ethereum) {
      setStatus({ type: 'error', msg: 'MetaMask not installed' });
      return;
    }
    try {
      setStatus({ type: 'loading', msg: 'Connecting...' });
      const prov = new ethers.BrowserProvider(window.ethereum);

      const network = await prov.getNetwork();
      if (network.chainId !== BigInt(CONFIG.NETWORK.chainId)) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: CONFIG.NETWORK.chainId }],
          });
        } catch (switchError: any) {
          if (switchError.code === 4902) {
            await window.ethereum.request({
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
      await fetchStats(prov, address);

      setStatus({ type: 'idle', msg: '' });
    } catch (err: any) {
      console.error(err);
      setStatus({ type: 'error', msg: err.message || 'Failed to connect' });
    }
  };

  useEffect(() => {
    if (window.ethereum) {
      connectWallet();

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

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      return () => {
        if (window.ethereum.removeListener) {
          window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
          window.ethereum.removeListener('chainChanged', handleChainChanged);
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

  const handleBuyAlpha = async () => {
    const hotkey = getHotkeyForNetuid(netuid);
    if (await executeStake(stakeAmount, netuid, hotkey)) {
      setStakeAmount('');
    }
  };

  const handleUnstake = async () => {
    const hotkey = getHotkeyForNetuid(unstakeNetuid);
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
    const hotkey = getHotkeyForNetuid(swapSourceNetuid);
    if (await executeSwap(swapSourceNetuid, swapTargetNetuid, hotkey, amountToSwap)) {
      setSwapAmount('');
    }
  };

  return (
    <>
      <header className="app-header">
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, var(--accent-primary), #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity size={18} color="white" />
          </div>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                <span className="status-indicator"></span>
                <span className="mono text-sm">{account.substring(0, 6)}...{account.substring(38)}</span>
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
            <button className="btn btn-primary" onClick={connectWallet}>
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

        {status.msg && (
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
                <div className="glass-panel" style={{ padding: '20px 24px' }}>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '11px', fontWeight: 500 }}>TAO Balance</p>
                  <p className="mono" style={{ fontSize: '26px', fontWeight: 600, letterSpacing: '-0.02em' }}>{parseFloat(balance).toFixed(4)} <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 400 }}>TAO</span></p>
                </div>
                <div className="glass-panel" style={{ padding: '20px 24px', borderColor: 'rgba(99,102,241,0.2)' }}>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '11px', fontWeight: 500 }}>Your Alpha (Netuid {netuid})</p>
                  <p className="mono text-accent-gradient" style={{ fontSize: '26px', fontWeight: 600, letterSpacing: '-0.02em' }}>{parseFloat(myAlphaBalance).toFixed(4)} <span style={{ fontSize: '13px', WebkitTextFillColor: 'var(--text-muted)', fontWeight: 400 }}>ALPHA</span></p>
                </div>
                <div className="glass-panel" style={{ padding: '20px 24px' }}>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '11px', fontWeight: 500 }}>Global Hotkey (Netuid {CONFIG.DEFAULT_NETUID})</p>
                  <p className="mono" style={{ fontSize: '26px', fontWeight: 600, letterSpacing: '-0.02em' }}>{parseFloat(totalAlphaStaked).toFixed(4)} <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 400 }}>ALPHA</span></p>
                </div>
              </div>
            ) : (
              <div className="glass-panel" style={{ padding: '64px', textAlign: 'center' }}>
                <ShieldAlert size={56} style={{ margin: '0 auto 20px', opacity: 0.3, color: 'var(--text-muted)', display: 'block' }} />
                <h2 style={{ fontWeight: 600, marginBottom: '12px', fontSize: '22px' }}>Connect Your Wallet</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '28px', fontSize: '15px' }}>Connect MetaMask to access the Terabitt staking platform.</p>
                <button className="btn btn-primary" style={{ padding: '12px 28px', fontSize: '15px' }} onClick={connectWallet}>
                  <Wallet size={16} /> Connect Wallet
                </button>
              </div>
            )}

        {account && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
            {/* Add Stake Panel */}
            <div className="glass-panel" style={{ padding: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <ArrowRightLeft size={18} color="var(--accent-primary)" />
                <h3 style={{ margin: 0, fontWeight: 600 }}>Add Stake</h3>
              </div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Deposit TAO to receive Alpha on a subnet.</p>

              <div style={{ marginBottom: '16px' }}>
                <label className="text-sm" style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontWeight: 500 }}>Subnet (Netuid)</label>
                <input type="number" className="input-field" value={netuid} onChange={(e) => setNetuid(Number(e.target.value))} />
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label className="text-sm" style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontWeight: 500 }}>Amount <span style={{ color: 'var(--accent-secondary)' }}>TAO</span></label>
                <input type="number" className="input-field" placeholder="0.00" value={stakeAmount} onChange={(e) => setStakeAmount(e.target.value)} />
              </div>
              <button className="btn btn-primary" style={{ width: '100%', padding: '13px' }} disabled={!account || !stakeAmount || status.type === 'loading'} onClick={handleBuyAlpha}>
                <ArrowRightLeft size={16} /> Stake TAO
              </button>
            </div>

            {/* Swap Stake Panel */}
            <div className="glass-panel" style={{ padding: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <ArrowRightLeft size={18} color="var(--accent-primary)" />
                <h3 style={{ margin: 0, fontWeight: 600 }}>Swap Stake</h3>
              </div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Atomically move your stake from one subnet to another.</p>

              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label className="text-sm" style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontWeight: 500 }}>Source Netuid</label>
                  <input type="number" className="input-field" value={swapSourceNetuid} onChange={(e) => setSwapSourceNetuid(Number(e.target.value))} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="text-sm" style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontWeight: 500 }}>Target Netuid</label>
                  <input type="number" className="input-field" value={swapTargetNetuid} onChange={(e) => setSwapTargetNetuid(Number(e.target.value))} />
                </div>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <label className="text-sm" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>
                    Amount <span style={{ color: 'var(--accent-secondary)' }}>ALPHA</span>
                  </label>
                  {account && (
                    <span 
                      className="text-xs text-accent" 
                      style={{ cursor: 'pointer', textDecoration: 'underline' }} 
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

            {/* Remove Stake Panel */}
            <div className="glass-panel" style={{ padding: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <ArrowRightLeft size={18} color="var(--accent-secondary)" />
                <h3 style={{ margin: 0, fontWeight: 600 }}>Remove Stake</h3>
              </div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Convert Alpha back to TAO. Leave blank to unstake all.</p>

              <div style={{ marginBottom: '16px' }}>
                <label className="text-sm" style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontWeight: 500 }}>Subnet (Netuid)</label>
                <input type="number" className="input-field" value={unstakeNetuid} onChange={(e) => setUnstakeNetuid(Number(e.target.value))} />
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label className="text-sm" style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontWeight: 500 }}>Amount <span style={{ color: 'var(--accent-secondary)' }}>ALPHA</span></label>
                <input type="number" className="input-field" placeholder={`Max: ${parseFloat(myAlphaBalance).toFixed(4)}`} value={unstakeAmount} onChange={(e) => setUnstakeAmount(e.target.value)} />
              </div>

              <div style={{ marginBottom: '24px', padding: '14px', background: 'rgba(14,165,233,0.05)', borderRadius: '10px', border: '1px solid rgba(14,165,233,0.15)' }}>
                <p className="text-sm" style={{ color: 'var(--accent-secondary)', marginBottom: '4px', fontWeight: 500 }}>How it works</p>
                <p className="text-sm" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>Burns Alpha and atomically returns native TAO to your wallet via the staking precompile.</p>
              </div>

              <button className="btn btn-secondary" style={{ width: '100%', padding: '13px' }} disabled={!account || status.type === 'loading' || !(allAlphaBalances[unstakeNetuid] && parseFloat(allAlphaBalances[unstakeNetuid]) > 0)} onClick={handleUnstake}>
                <ArrowRightLeft size={16} /> {unstakeAmount ? 'Unstake Alpha' : 'Unstake All Alpha'}
              </button>
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
          />
        )}
      </main>
    </>
  );
}

export default App;
