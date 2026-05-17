import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { Shield, Wallet, ArrowRightLeft, Activity, AlertCircle, History } from 'lucide-react';
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
  const [totalAlphaStaked, setTotalAlphaStaked] = useState<string>('0');
  const [myAlphaBalance, setMyAlphaBalance] = useState<string>('0');
  const [allAlphaBalances, setAllAlphaBalances] = useState<{ [id: number]: string }>({});
  const [stakeHistory, setStakeHistory] = useState<StakeEvent[]>([]);

  const [stakeAmount, setStakeAmount] = useState<string>('');
  const [unstakeAmount, setUnstakeAmount] = useState<string>('');
  const [netuid, setNetuid] = useState<number>(CONFIG.DEFAULT_NETUID);
  const [activeTab, setActiveTab] = useState<'staking' | 'chat'>('staking');

  const [status, setStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error', msg: string }>({ type: 'idle', msg: '' });

  const fetchStakeHistory = async (prov: ethers.BrowserProvider, userAddress: string, currentNetuid: number) => {
    try {
      const contract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, CONTRACT_ABI, prov);
      
      const currentBlock = await prov.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 50000);
      
      const stakeFilter = contract.filters.StakeExecuted(userAddress);
      const stakeEvents = await contract.queryFilter(stakeFilter, fromBlock, 'latest');
      
      const unstakeFilter = contract.filters.UnstakeExecuted(userAddress);
      const unstakeEvents = await contract.queryFilter(unstakeFilter, fromBlock, 'latest');

      const history: StakeEvent[] = [];
      const combinedEvents: { type: 'stake' | 'unstake', log: ethers.EventLog }[] = [];

      for (const ev of stakeEvents) combinedEvents.push({ type: 'stake', log: ev as ethers.EventLog });
      for (const ev of unstakeEvents) combinedEvents.push({ type: 'unstake', log: ev as ethers.EventLog });

      combinedEvents.sort((a, b) => {
        if (a.log.blockNumber !== b.log.blockNumber) return a.log.blockNumber - b.log.blockNumber;
        return a.log.index - b.log.index;
      });

      const netBalances: { [id: number]: bigint } = {};

      for (const item of combinedEvents) {
        const { type, log } = item;
        const evNetuid = Number(log.args[3]);
        if (netBalances[evNetuid] === undefined) netBalances[evNetuid] = BigInt(0);

        if (type === 'stake') {
          const taoWei = log.args[2];
          const alphaRao = log.args[4];
          netBalances[evNetuid] += alphaRao;
          history.push({
            type: 'stake',
            taoAmount: (Number(taoWei) / 1e18).toFixed(4),
            alphaAmount: (Number(alphaRao) / 1e9).toFixed(4),
            netuid: evNetuid,
            txHash: log.transactionHash,
            blockNumber: log.blockNumber,
          });
        } else {
          const alphaRao = log.args[2];
          const taoWei = log.args[4];
          if (alphaRao === BigInt(0)) {
            netBalances[evNetuid] = BigInt(0);
          } else {
            netBalances[evNetuid] -= alphaRao;
          }
          history.push({
            type: 'unstake',
            taoAmount: (Number(taoWei) / 1e18).toFixed(4),
            alphaAmount: alphaRao === BigInt(0) ? 'ALL' : (Number(alphaRao) / 1e9).toFixed(4),
            netuid: evNetuid,
            txHash: log.transactionHash,
            blockNumber: log.blockNumber,
          });
        }
      }

      history.sort((a, b) => b.blockNumber - a.blockNumber);

      const bal = netBalances[currentNetuid] || BigInt(0);
      setMyAlphaBalance((Number(bal) / 1e9).toFixed(4));
      
      const formattedBalances: { [id: number]: string } = {};
      for (const [id, value] of Object.entries(netBalances)) {
        formattedBalances[Number(id)] = (Number(value) / 1e9).toFixed(4);
      }
      setAllAlphaBalances(formattedBalances);
      
      setStakeHistory(history);
    } catch (e) {
      console.error('Failed to fetch stake history:', e);
    }
  };

  const fetchStats = async (prov: ethers.BrowserProvider, address: string) => {
    try {
      const bal = await prov.getBalance(address);
      setBalance(ethers.formatEther(bal));

      const stakingPrecompile = new ethers.Contract(
        "0x0000000000000000000000000000000000000805",
        ["function getTotalAlphaStaked(bytes32 hotkey, uint256 netuid) external view returns (uint256)"],
        prov
      );
      const alpha = await stakingPrecompile.getTotalAlphaStaked(CONFIG.DEFAULT_HOTKEY, netuid);
      setTotalAlphaStaked((Number(alpha) / 1e9).toFixed(4));

      await fetchStakeHistory(prov, address, netuid);
    } catch (e) {
      console.error(e);
    }
  };

  // Auto-refresh when netuid changes
  useEffect(() => {
    if (provider && account) {
      fetchStats(provider, account);
    }
  }, [netuid, account, provider]);

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

      setStatus({ type: 'success', msg: 'Connected successfully' });
    } catch (err: any) {
      console.error(err);
      setStatus({ type: 'error', msg: err.message || 'Failed to connect' });
    }
  };

  useEffect(() => {
    if (window.ethereum) {
      // Prompt wallet connection on load if not connected, as requested
      connectWallet();

      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length > 0) {
          connectWallet();
        } else {
          setAccount('');
          setSigner(null);
          setProvider(null);
          setStatus({ type: 'idle', msg: '' });
          setBalance('0');
          setTotalAlphaStaked('0');
          setMyAlphaBalance('0');
          setStakeHistory([]);
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

  const executeStake = async (amount: string, targetNetuid: number): Promise<boolean> => {
    if (!signer || !amount) return false;
    try {
      setStatus({ type: 'loading', msg: `Staking ${amount} TAO to Netuid ${targetNetuid}...` });
      const contract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const amountInWei = ethers.parseEther(amount);
      const tx = await contract.buyAlpha(amountInWei, 1, CONFIG.DEFAULT_HOTKEY, targetNetuid, { value: amountInWei });
      setStatus({ type: 'loading', msg: 'Waiting for confirmation...' });
      await tx.wait();
      setStatus({ type: 'success', msg: 'Stake added successfully!' });
      await fetchStats(provider!, account);
      return true;
    } catch (err: any) {
      console.error(err);
      setStatus({ type: 'error', msg: err.reason || err.message || 'Transaction failed' });
      return false;
    }
  };

  const executeUnstake = async (targetNetuid: number, amount?: string): Promise<boolean> => {
    if (!signer) return false;
    try {
      const contract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      if (amount && amount !== '' && parseFloat(amount) > 0) {
        setStatus({ type: 'loading', msg: `Unstaking ${amount} Alpha from Netuid ${targetNetuid}...` });
        const amountInRao = ethers.parseUnits(amount, 9);
        const tx = await contract.sellAlpha(amountInRao, 1, CONFIG.DEFAULT_HOTKEY, targetNetuid);
        setStatus({ type: 'loading', msg: 'Waiting for confirmation...' });
        await tx.wait();
        setStatus({ type: 'success', msg: `Successfully unstaked ${amount} Alpha!` });
      } else {
        setStatus({ type: 'loading', msg: `Unstaking all Alpha from Netuid ${targetNetuid}...` });
        const tx = await contract.sellAlphaFull(1, CONFIG.DEFAULT_HOTKEY, targetNetuid);
        setStatus({ type: 'loading', msg: 'Waiting for confirmation...' });
        await tx.wait();
        setStatus({ type: 'success', msg: 'All Alpha unstaked! TAO returned to your wallet.' });
      }
      await fetchStats(provider!, account);
      return true;
    } catch (err: any) {
      console.error(err);
      setStatus({ type: 'error', msg: err.reason || err.message || 'Transaction failed' });
      return false;
    }
  };

  const handleBuyAlpha = async () => {
    if (await executeStake(stakeAmount, netuid)) {
      setStakeAmount('');
    }
  };

  const handleUnstake = async () => {
    if (await executeUnstake(netuid, unstakeAmount)) {
      setUnstakeAmount('');
    }
  };

  return (
    <>
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Shield color="var(--accent-primary)" size={28} />
            <h2 style={{ margin: 0 }}>SyncIntent<span className="text-accent-gradient"> OS</span></h2>
          </div>
          
          <nav style={{ display: 'flex', gap: '8px' }}>
            <a href="#" className={`nav-link ${activeTab === 'staking' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveTab('staking'); }}>Staking</a>
            <a href="#" className={`nav-link ${activeTab === 'chat' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveTab('chat'); }}>Chat portal</a>
          </nav>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} className="text-sm">
            <span className={`status-indicator ${account ? '' : 'offline'}`}></span>
            {account ? 'Connected to subEVM' : 'Disconnected'}
          </div>
          {!account ? (
            <button className="btn btn-primary" onClick={connectWallet}>
              <Wallet size={16} /> Connect Wallet
            </button>
          ) : (
            <div className="glass-panel" style={{ padding: '6px 12px', fontSize: '14px' }}>
              <span className="mono">{account.substring(0, 6)}...{account.substring(38)}</span>
            </div>
          )}
        </div>
      </header>

      <main className="container">
        {activeTab === 'staking' && (
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h1>Synchronous <span className="text-accent-gradient">Staking</span></h1>
            <p style={{ color: 'var(--text-secondary)' }}>Native TAO intent execution architecture.</p>
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
            {account && (
              <div className="glass-panel" style={{ padding: '24px', marginBottom: '32px', display: 'flex', gap: '48px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <p className="text-sm text-muted" style={{ marginBottom: '4px' }}>Wallet Balance</p>
              <h2 style={{ margin: 0, fontSize: '32px' }} className="mono">{parseFloat(balance).toFixed(4)} <span className="text-sm text-muted">TAO</span></h2>
            </div>
            <div style={{ width: '1px', height: '40px', background: 'var(--border-subtle)' }}></div>
            <div>
              <p className="text-sm text-muted" style={{ marginBottom: '4px' }}>Your Staked Alpha (Netuid {netuid})</p>
              <h2 style={{ margin: 0, fontSize: '32px' }} className="mono text-accent-gradient">
                {myAlphaBalance} <span className="text-sm text-muted" style={{ WebkitTextFillColor: 'var(--text-muted)' }}>ALPHA</span>
              </h2>
            </div>
            <div style={{ width: '1px', height: '40px', background: 'var(--border-subtle)' }}></div>
            <div>
              <p className="text-sm text-muted" style={{ marginBottom: '4px' }}>Global Hotkey Alpha (Netuid {CONFIG.DEFAULT_NETUID})</p>
              <h2 style={{ margin: 0, fontSize: '24px' }} className="mono">{totalAlphaStaked} <span className="text-sm text-muted">ALPHA</span></h2>
            </div>
          </div>
        )}

        <div className="grid-cols-2">
          {/* Add Stake Panel */}
          <div className="glass-panel" style={{ padding: '32px' }}>
            <h3 style={{ marginBottom: '8px' }}>Add Stake</h3>
            <p className="text-sm text-muted" style={{ marginBottom: '24px' }}>Deposit TAO to mint Alpha</p>

            <div style={{ marginBottom: '16px' }}>
              <label className="text-sm text-muted" style={{ display: 'block', marginBottom: '8px' }}>Netuid</label>
              <input
                type="number"
                className="input-field"
                value={netuid}
                onChange={(e) => setNetuid(Number(e.target.value))}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label className="text-sm text-muted" style={{ display: 'block', marginBottom: '8px' }}>Amount (TAO)</label>
              <input
                type="number"
                className="input-field"
                placeholder="0.00"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
              />
            </div>

            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              disabled={!account || !stakeAmount || status.type === 'loading'}
              onClick={handleBuyAlpha}
            >
              <ArrowRightLeft size={16} /> Stake TAO
            </button>
          </div>

          {/* Remove Stake Panel */}
          <div className="glass-panel" style={{ padding: '32px' }}>
            <h3 style={{ marginBottom: '8px' }}>Remove Stake</h3>
            <p className="text-sm text-muted" style={{ marginBottom: '24px' }}>Unstake Alpha and withdraw TAO from Netuid {netuid}</p>

            <div style={{ marginBottom: '16px' }}>
              <label className="text-sm text-muted" style={{ display: 'block', marginBottom: '8px' }}>Amount (Alpha)</label>
              <input
                type="number"
                className="input-field"
                placeholder="Leave blank for MAX"
                value={unstakeAmount}
                onChange={(e) => setUnstakeAmount(e.target.value)}
              />
            </div>

            <div style={{ marginBottom: '24px', padding: '16px', background: 'rgba(0,229,255,0.05)', borderRadius: '8px', border: '1px solid rgba(0,229,255,0.15)' }}>
              <p className="text-sm" style={{ color: 'var(--accent-secondary)', marginBottom: '4px' }}>How it works</p>
              <p className="text-sm text-muted">Burns staked Alpha on the selected hotkey and converts it back to native TAO atomically. Leave amount blank to unstake all.</p>
            </div>

            <button
              className="btn btn-secondary"
              style={{ width: '100%' }}
              disabled={!account || status.type === 'loading' || myAlphaBalance === '0.0000'}
              onClick={handleUnstake}
            >
              <ArrowRightLeft size={16} /> {unstakeAmount ? 'Unstake Alpha' : 'Unstake All Alpha'}
            </button>
          </div>
        </div>

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
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          background: ev.type === 'stake' ? 'rgba(0,255,136,0.1)' : 'rgba(255,51,102,0.1)',
                          color: ev.type === 'stake' ? 'var(--status-success)' : 'var(--status-error)',
                        }}>
                          {ev.type === 'stake' ? 'STAKE' : 'UNSTAKE'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', padding: '10px 12px' }} className="mono">{ev.netuid}</td>
                      <td style={{ textAlign: 'right', padding: '10px 12px' }} className="mono">{ev.taoAmount}</td>
                      <td style={{ textAlign: 'right', padding: '10px 12px' }} className="mono">{ev.alphaAmount}</td>
                      <td style={{ textAlign: 'right', padding: '10px 12px' }} className="mono text-muted">{ev.blockNumber}</td>
                      <td style={{ textAlign: 'right', padding: '10px 12px' }}>
                        <span className="mono text-muted" style={{ fontSize: '11px' }}>{ev.txHash.substring(0, 10)}...</span>
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
            status={status}
          />
        )}
      </main>
    </>
  );
}

export default App;
