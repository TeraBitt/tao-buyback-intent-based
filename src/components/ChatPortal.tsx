import { useState, useRef, useEffect } from 'react';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import type { FunctionDeclaration, ChatSession, GenerateContentResult } from '@google/generative-ai';
import { Send, Bot, ArrowRightLeft, ShieldAlert, Activity, User } from 'lucide-react';

interface ChatPortalProps {
  account: string;
  balance: string;
  myAlphaBalance: string;
  allAlphaBalances: { [id: number]: string };
  currentNetuid: number;
  executeStake: (amount: string, netuid: number) => Promise<boolean>;
  executeUnstake: (netuid: number, amount?: string) => Promise<boolean>;
  status: { type: 'idle' | 'loading' | 'success' | 'error', msg: string };
}

const stakeTool: FunctionDeclaration = {
  name: 'initiate_stake',
  description: 'Show a UI to the user to confirm staking TAO to get Alpha.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      amount: { type: SchemaType.STRING, description: 'Amount of TAO to stake (e.g. "1.5")' },
      netuid: { type: SchemaType.NUMBER, description: 'Netuid to stake into (default 310)' }
    },
    required: ['amount', 'netuid']
  }
};

const unstakeTool: FunctionDeclaration = {
  name: 'initiate_unstake',
  description: 'Show a UI to the user to confirm unstaking Alpha from a netuid. Can be partial or full unstake.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      netuid: { type: SchemaType.NUMBER, description: 'Netuid to unstake from (default 310)' },
      amount: { type: SchemaType.STRING, description: 'Amount of Alpha to unstake. Omit to unstake ALL alpha.' }
    },
    required: ['netuid']
  }
};

const checkBalancesTool: FunctionDeclaration = {
  name: 'check_balances',
  description: 'Get the user\'s current on-chain balances for TAO and their staked Alpha across all netuids. This allows answering questions like "What is my stake on netuid X?"',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {}
  }
};

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  action?: {
    type: 'stake' | 'unstake';
    amount?: string;
    netuid: number;
  };
}

export default function ChatPortal({ account, balance, myAlphaBalance, allAlphaBalances, currentNetuid, executeStake, executeUnstake, status }: ChatPortalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize AI
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const genAI = new GoogleGenerativeAI(apiKey || '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    tools: [{ functionDeclarations: [stakeTool, unstakeTool, checkBalancesTool] }],
    systemInstruction: "You are the SyncIntent OS AI assistant. You help users stake and unstake TAO. Be concise, cyberpunk-styled, and helpful. If a user wants to stake or unstake, always use the tools provided to initiate the action rather than just explaining it."
  });

  const [chatSession, setChatSession] = useState<ChatSession | null>(null);

  useEffect(() => {
    if (!chatSession) {
      setChatSession(model.startChat({ history: [] }));
      setMessages([{ role: 'model', text: 'Welcome to the SyncIntent Chat Portal. How can I assist you with your TAO operations today?' }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !chatSession) return;

    const userText = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setLoading(true);

    try {
      const result = await chatSession.sendMessage(userText);
      await processResponse(result);
    } catch (err: unknown) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setMessages(prev => [...prev, { role: 'model', text: 'Error communicating with the network: ' + errorMessage }]);
    } finally {
      setLoading(false);
    }
  };

  const processResponse = async (result: GenerateContentResult) => {
    const response = result.response;
    const calls = response.functionCalls();

    if (calls && calls.length > 0) {
      for (const call of calls) {
        if (call.name === 'check_balances' && chatSession) {
          const functionResponse = {
            name: call.name,
            response: {
              taoBalance: balance,
              currentNetuidAlphaBalance: myAlphaBalance,
              allAlphaBalancesByNetuid: allAlphaBalances,
              currentNetuid: currentNetuid
            }
          };
          const nextResult = await chatSession.sendMessage([{ functionResponse }]);
          await processResponse(nextResult);
        }
        else if (call.name === 'initiate_stake') {
          const { amount, netuid } = call.args as { amount: string, netuid: number };
          setMessages(prev => [...prev, {
            role: 'model',
            text: `I've prepared a staking transaction for ${amount} TAO into Netuid ${netuid}. Please confirm:`,
            action: { type: 'stake', amount, netuid }
          }]);
        }
        else if (call.name === 'initiate_unstake' && chatSession) {
          const { netuid, amount } = call.args as { netuid: number, amount?: string };
          const alphaOnNetuid = parseFloat(allAlphaBalances[netuid] || '0');
          if (alphaOnNetuid <= 0) {
            const functionResponse = {
              name: call.name,
              response: { error: `User has 0 Alpha staked on netuid ${netuid}. Cannot unstake.` }
            };
            const nextResult = await chatSession.sendMessage([{ functionResponse }]);
            await processResponse(nextResult);
          } else {
            setMessages(prev => [...prev, {
              role: 'model',
              text: `I've prepared an unstake transaction for ${amount ? amount + ' Alpha' : 'all your Alpha'} from Netuid ${netuid}. Please confirm:`,
              action: { type: 'unstake', netuid, amount }
            }]);
          }
        }
      }
    } else {
      const text = response.text();
      if (text) {
        setMessages(prev => [...prev, { role: 'model', text }]);
      }
    }
  };

  const handleAction = async (action: NonNullable<ChatMessage['action']>) => {
    // Optimistic UI disable handled by status loading state below
    if (action.type === 'stake' && action.amount && chatSession) {
      const success = await executeStake(action.amount, action.netuid);
      if (success) {
        setMessages(prev => [...prev, { role: 'user', text: `[System] Confirmed stake of ${action.amount} TAO.` }]);
        setLoading(true);
        const result = await chatSession.sendMessage(`The staking transaction of ${action.amount} TAO into netuid ${action.netuid} was successful! Confirm to the user.`);
        await processResponse(result);
        setLoading(false);
      }
    } else if (action.type === 'unstake' && chatSession) {
      const success = await executeUnstake(action.netuid, action.amount);
      if (success) {
        const textMsg = action.amount ? `Confirmed unstake of ${action.amount} Alpha from netuid ${action.netuid}.` : `Confirmed unstake from netuid ${action.netuid}.`;
        setMessages(prev => [...prev, { role: 'user', text: `[System] ${textMsg}` }]);
        setLoading(true);
        const result = await chatSession.sendMessage(`The unstaking transaction from netuid ${action.netuid} was successful! Confirm to the user.`);
        await processResponse(result);
        setLoading(false);
      }
    }
  };

  return (
    <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '20px', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)' }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Bot color="var(--accent-secondary)" size={24} /> SyncIntent OS Agent
          {account && <span className="status-indicator"></span>}
        </h3>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {!account && (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            <ShieldAlert size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
            <p>Please connect your wallet to use the Chat Portal.</p>
          </div>
        )}

        {account && messages.map((msg, idx) => (
          <div key={idx} style={{
            display: 'flex',
            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            gap: '12px',
            marginBottom: '4px'
          }}>
            {msg.role === 'model' && (
              <div style={{ flexShrink: 0, width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(14, 165, 233, 0.1)', color: 'var(--accent-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(14, 165, 233, 0.2)' }}>
                <Bot size={18} />
              </div>
            )}
            
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
              <div style={{
                padding: '14px 18px',
                borderRadius: '16px',
                background: msg.role === 'user' ? 'linear-gradient(135deg, var(--accent-primary), #4f46e5)' : 'rgba(255, 255, 255, 0.05)',
                border: msg.role === 'user' ? 'none' : '1px solid var(--border-subtle)',
                borderBottomRightRadius: msg.role === 'user' ? '4px' : '16px',
                borderBottomLeftRadius: msg.role === 'model' ? '4px' : '16px',
                color: msg.role === 'user' ? '#ffffff' : 'var(--text-primary)',
                lineHeight: 1.6,
                fontSize: '14.5px',
                boxShadow: msg.role === 'user' ? '0 4px 14px rgba(99, 102, 241, 0.2)' : 'none'
              }}>
                {msg.text}
              </div>

              {msg.action && (
                <div style={{ marginTop: '12px', width: '100%', minWidth: '280px' }} className="glass-panel">
                  <div style={{ padding: '16px' }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: 'var(--text-primary)' }}>
                      {msg.action.type === 'stake' ? 'Stake Confirmation' : 'Unstake Confirmation'}
                    </h4>
                    {msg.action.type === 'stake' && (
                      <div style={{ marginBottom: '16px', fontSize: '13px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span className="text-muted">Amount</span>
                          <span className="mono">{msg.action.amount} TAO</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span className="text-muted">Netuid</span>
                          <span className="mono">{msg.action.netuid}</span>
                        </div>
                      </div>
                    )}
                    {msg.action.type === 'unstake' && (
                      <div style={{ marginBottom: '16px', fontSize: '13px' }}>
                        {msg.action.amount && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span className="text-muted">Amount</span>
                            <span className="mono">{msg.action.amount} Alpha</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span className="text-muted">Netuid</span>
                          <span className="mono">{msg.action.netuid}</span>
                        </div>
                      </div>
                    )}
                    <button
                      className="btn btn-primary"
                      style={{ width: '100%', padding: '10px', fontSize: '13px' }}
                      onClick={() => msg.action && handleAction(msg.action)}
                      disabled={status.type === 'loading'}
                    >
                      <ArrowRightLeft size={14} /> {msg.action.type === 'stake' ? 'Execute Stake' : 'Execute Unstake'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {msg.role === 'user' && (
              <div style={{ flexShrink: 0, width: '36px', height: '36px', borderRadius: '50%', background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-subtle)' }}>
                <User size={18} color="var(--text-secondary)" />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf: 'flex-start', display: 'flex', gap: '8px', alignItems: 'center', padding: '12px', color: 'var(--text-muted)' }}>
            <Activity size={16} className="status-indicator" /> Thinking...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ padding: '20px', borderTop: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <input
            type="text"
            className="input-field"
            placeholder={account ? "E.g., 'Stake 0.5 TAO to netuid 310' or 'What is my balance?'" : "Connect wallet to chat..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            disabled={!account || loading}
            style={{ flex: 1 }}
          />
          <button
            className="btn btn-primary"
            onClick={handleSend}
            disabled={!account || loading || !input.trim()}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
