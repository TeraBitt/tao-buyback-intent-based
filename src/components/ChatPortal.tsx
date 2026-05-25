import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import type { ChatSession, FunctionDeclaration, GenerateContentResult } from '@google/generative-ai';
import { Activity, Send, ShieldAlert, Wallet } from 'lucide-react';

interface ChatPortalProps {
  account: string;
  balance: string;
  myAlphaBalance: string;
  allAlphaBalances: { [id: number]: string };
  currentNetuid: number;
  simulateStakeAlpha: (amount: string, netuid: number) => Promise<string | null>;
  simulateSwapAlpha: (
    sourceNetuid: number,
    targetNetuid: number,
    amount: string,
  ) => Promise<{ targetAlpha: string; intermediateTao: string } | null>;
  simulateUnstakeTao: (netuid: number, amount: string) => Promise<string | null>;
  executeStake: (amount: string, netuid: number) => Promise<boolean>;
  executeUnstake: (netuid: number, amount?: string) => Promise<boolean>;
  executeSwap: (sourceNetuid: number, targetNetuid: number, amount: string) => Promise<boolean>;
  status: { type: 'idle' | 'loading' | 'success' | 'error'; msg: string };
  openWalletSelector: () => void;
  disconnectWallet: () => void;
}

const stakeTool: FunctionDeclaration = {
  name: 'initiate_stake',
  description: 'Prepare a UI confirmation for staking TAO into a Bittensor subnet.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      amount: { type: SchemaType.STRING, description: 'Amount of TAO to stake, such as "1.5"' },
      netuid: { type: SchemaType.NUMBER, description: 'Target Bittensor netuid, usually 310 by default' },
    },
    required: ['amount', 'netuid'],
  },
};

const unstakeTool: FunctionDeclaration = {
  name: 'initiate_unstake',
  description: 'Prepare a UI confirmation for unstaking Alpha from a Bittensor subnet.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      netuid: { type: SchemaType.NUMBER, description: 'Netuid to unstake from, usually 310 by default' },
      amount: {
        type: SchemaType.STRING,
        description: 'Amount of Alpha to unstake. Omit to fully exit the subnet position.',
      },
    },
    required: ['netuid'],
  },
};

const swapTool: FunctionDeclaration = {
  name: 'initiate_swap',
  description:
    'Prepare a UI confirmation for moving Alpha stake from one Bittensor subnet to another on the same chain.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      sourceNetuid: { type: SchemaType.NUMBER, description: 'Source netuid that currently holds the Alpha stake' },
      targetNetuid: { type: SchemaType.NUMBER, description: 'Destination netuid that should receive the stake' },
      amount: { type: SchemaType.STRING, description: 'Amount of Alpha to move between the two subnets' },
    },
    required: ['sourceNetuid', 'targetNetuid', 'amount'],
  },
};

const checkBalancesTool: FunctionDeclaration = {
  name: 'check_balances',
  description:
    'Read the user current TAO balance and Alpha balances by netuid so the assistant can answer state-aware questions.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {},
  },
};

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  action?: {
    type: 'stake' | 'unstake' | 'swap';
    amount?: string;
    netuid: number;
    targetNetuid?: number;
    estimatedAlpha?: string;
    estimatedTao?: string;
    intermediateTao?: string;
  };
}

const INPUT_HINTS = [
  { label: '↑ Stake', prompt: 'Stake 50 TAO on Subnet 19' },
  { label: '↓ Unstake', prompt: 'Unstake my Subnet 27 position' },
  { label: '⇄ Move', prompt: 'Move 0.03 ALPHA from Subnet 310 to Subnet 395' },
  { label: '↗ Top subnet', prompt: 'What is the top subnet right now?' },
  { label: '⬡ Research', prompt: 'What does Subnet 4 do?' },
];

export default function ChatPortal({
  account,
  balance,
  myAlphaBalance,
  allAlphaBalances,
  currentNetuid,
  simulateStakeAlpha,
  simulateSwapAlpha,
  simulateUnstakeTao,
  executeStake,
  executeUnstake,
  executeSwap,
  status,
  openWalletSelector,
  disconnectWallet,
}: ChatPortalProps) {
  const initialMessage = import.meta.env.VITE_GEMINI_API_KEY
    ? "Hey! I'm TaoChat — I can help you stake, unstake, swap, and research Bittensor subnets in plain English."
    : 'The AI chat surface is wired into the dashboard, but `VITE_GEMINI_API_KEY` is still missing. The staking dashboard is already usable while chat credentials are being added.';

  const [messages, setMessages] = useState<ChatMessage[]>(() => [{ role: 'model', text: initialMessage }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const model = apiKey
    ? new GoogleGenerativeAI(apiKey).getGenerativeModel({
        model: 'gemini-2.5-flash',
        tools: [{ functionDeclarations: [stakeTool, unstakeTool, swapTool, checkBalancesTool] }],
        systemInstruction:
          'You are TaoChat for a Bittensor staking dashboard. Help users stake TAO, unstake Alpha, and move positions between Bittensor subnets. Cross-chain deposits are not live yet, so if a user asks about SOL, ETH, bridging, or cross-chain, clearly say it is coming soon and steer them toward the live on-chain staking flows. Be concise, clear, and action-oriented. When the user wants to act, always call the provided tool instead of only describing the action.',
      })
    : null;

  const [chatSession] = useState<ChatSession | null>(() => (model ? model.startChat({ history: [] }) : null));

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const adjustTextareaHeight = () => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, 160)}px`;
  };

  const formatShortValue = (value: string, start = 6, end = 4) => {
    if (!value) return '';
    return `${value.slice(0, start)}...${value.slice(-end)}`;
  };

  const formatTokenAmount = (value?: string, digits = 6) => {
    if (!value) return '';
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) return value;
    return parsed.toFixed(digits).replace(/\.?0+$/, '');
  };

  const chatReady = Boolean(chatSession);
  const hasSubmittedPrompt = messages.some((message) => message.role === 'user' && !message.text.startsWith('[System]'));
  const isIntroState = !hasSubmittedPrompt;

  const dismissAction = (messageIndex: number) => {
    setMessages((prev) =>
      prev.map((message, index) => (index === messageIndex ? { ...message, action: undefined } : message)),
    );
  };

  const handleSend = async () => {
    if (!input.trim() || !chatSession) return;

    const userText = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: userText }]);
    setLoading(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      const result = await chatSession.sendMessage(userText);
      await processResponse(result);
    } catch (error: unknown) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setMessages((prev) => [
        ...prev,
        {
          role: 'model',
          text: `I hit a network issue while preparing that response: ${errorMessage}`,
        },
      ]);
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
              currentNetuid,
            },
          };
          const nextResult = await chatSession.sendMessage([{ functionResponse }]);
          await processResponse(nextResult);
        } else if (call.name === 'initiate_stake') {
          const { amount, netuid } = call.args as { amount: string; netuid: number };
          const estimatedAlpha = await simulateStakeAlpha(amount, netuid);
          setMessages((prev) => [
            ...prev,
            {
              role: 'model',
              text: estimatedAlpha
                ? `I drafted a staking intent for ${amount} TAO into Netuid ${netuid}. Simulation estimates about ${formatTokenAmount(estimatedAlpha)} ALPHA before fees and final execution.`
                : `I drafted a staking intent for ${amount} TAO into Netuid ${netuid}. Review it below and confirm when you are ready.`,
              action: { type: 'stake', amount, netuid, estimatedAlpha: estimatedAlpha ?? undefined },
            },
          ]);
        } else if (call.name === 'initiate_unstake' && chatSession) {
          const { netuid, amount } = call.args as { netuid: number; amount?: string };
          const alphaOnNetuid = Number.parseFloat(allAlphaBalances[netuid] || '0');
          const amountToQuote = amount || allAlphaBalances[netuid] || '';

          if (alphaOnNetuid <= 0) {
            const functionResponse = {
              name: call.name,
              response: {
                error: `User has no Alpha staked on netuid ${netuid}.`,
              },
            };
            const nextResult = await chatSession.sendMessage([{ functionResponse }]);
            await processResponse(nextResult);
          } else {
            const estimatedTao = amountToQuote ? await simulateUnstakeTao(netuid, amountToQuote) : null;
            setMessages((prev) => [
              ...prev,
              {
                role: 'model',
                text: estimatedTao
                  ? `I prepared an unstake intent for ${amount ? `${amount} Alpha` : 'the full Alpha position'} on Netuid ${netuid}. Simulation estimates about ${formatTokenAmount(estimatedTao)} TAO back to your wallet.`
                  : `I prepared an unstake intent for ${amount ? `${amount} Alpha` : 'the full Alpha position'} on Netuid ${netuid}.`,
                action: { type: 'unstake', netuid, amount, estimatedTao: estimatedTao ?? undefined },
              },
            ]);
          }
        } else if (call.name === 'initiate_swap' && chatSession) {
          const { sourceNetuid, targetNetuid, amount } = call.args as {
            sourceNetuid: number;
            targetNetuid: number;
            amount: string;
          };
          const alphaOnSource = Number.parseFloat(allAlphaBalances[sourceNetuid] || '0');

          if (sourceNetuid === targetNetuid) {
            const functionResponse = {
              name: call.name,
              response: {
                error: 'Source and destination netuid must be different for a subnet rotation.',
              },
            };
            const nextResult = await chatSession.sendMessage([{ functionResponse }]);
            await processResponse(nextResult);
          } else if (alphaOnSource < Number.parseFloat(amount)) {
            const functionResponse = {
              name: call.name,
              response: {
                error: `User only has ${alphaOnSource} Alpha on source Netuid ${sourceNetuid}.`,
              },
            };
            const nextResult = await chatSession.sendMessage([{ functionResponse }]);
            await processResponse(nextResult);
          } else {
            const simulation = await simulateSwapAlpha(sourceNetuid, targetNetuid, amount);

            setMessages((prev) => [
              ...prev,
              {
                role: 'model',
                text: simulation
                  ? `I prepared a subnet rotation: move ${amount} ALPHA from Netuid ${sourceNetuid} to Netuid ${targetNetuid}. Simulation estimates about ${formatTokenAmount(simulation.targetAlpha)} ALPHA on the destination.`
                  : `I prepared a subnet rotation: move ${amount} ALPHA from Netuid ${sourceNetuid} to Netuid ${targetNetuid}. Review it below and confirm when you are ready.`,
                action: {
                  type: 'swap',
                  netuid: sourceNetuid,
                  targetNetuid,
                  amount,
                  estimatedAlpha: simulation?.targetAlpha,
                  intermediateTao: simulation?.intermediateTao,
                },
              },
            ]);
          }
        }
      }
    } else {
      const text = response.text();
      if (text) {
        setMessages((prev) => [...prev, { role: 'model', text }]);
      }
    }
  };

  const handleAction = async (action: NonNullable<ChatMessage['action']>) => {
    if (action.type === 'stake' && action.amount && chatSession) {
      const success = await executeStake(action.amount, action.netuid);
      if (success) {
        setMessages((prev) => [...prev, { role: 'user', text: `[System] Stake confirmed for ${action.amount} TAO.` }]);
        setLoading(true);
        const result = await chatSession.sendMessage(
          `The staking transaction of ${action.amount} TAO into netuid ${action.netuid} succeeded. Confirm that to the user.`,
        );
        await processResponse(result);
        setLoading(false);
      }
    } else if (action.type === 'unstake' && chatSession) {
      const success = await executeUnstake(action.netuid, action.amount);
      if (success) {
        const message = action.amount
          ? `Unstake confirmed for ${action.amount} Alpha from netuid ${action.netuid}.`
          : `Full unstake confirmed from netuid ${action.netuid}.`;
        setMessages((prev) => [...prev, { role: 'user', text: `[System] ${message}` }]);
        setLoading(true);
        const result = await chatSession.sendMessage(
          `The unstaking transaction from netuid ${action.netuid} succeeded. Confirm that to the user.`,
        );
        await processResponse(result);
        setLoading(false);
      }
    } else if (action.type === 'swap' && action.targetNetuid !== undefined && action.amount && chatSession) {
      const success = await executeSwap(action.netuid, action.targetNetuid, action.amount);
      if (success) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'user',
            text: `[System] Stake move confirmed for ${action.amount} Alpha from Netuid ${action.netuid} to Netuid ${action.targetNetuid}.`,
          },
        ]);
        setLoading(true);
        const result = await chatSession.sendMessage(
          `The subnet rotation of ${action.amount} Alpha from Netuid ${action.netuid} to Netuid ${action.targetNetuid} succeeded. Confirm that to the user.`,
        );
        await processResponse(result);
        setLoading(false);
      }
    }
  };

  return (
    <div className={`chat-wrap ${isIntroState ? 'chat-wrap--intro' : ''}`}>
      <div className="chat-head">
        <div className="chat-head-l">
          <div className="ch-title">TaoChat</div>
          <div className="ch-sub">{account ? 'Bittensor EVM testnet connected' : 'Bittensor EVM testnet · connect wallet'}</div>
        </div>

        {account ? (
          <div className="wallet-inline-actions">
            <div className="wpill" style={{ padding: '5px 10px' }}>
              <div className="wdot" />
              <span style={{ fontSize: '12px', color: 'var(--text-2)', fontFamily: 'monospace' }}>
                {formatShortValue(account, 6, 4)}
              </span>
            </div>
            <button type="button" className="tao-btn tao-btn--ghost tao-btn--small" onClick={disconnectWallet}>
              Disconnect
            </button>
          </div>
        ) : (
          <button type="button" className="tao-btn tao-btn--primary tao-btn--small" onClick={openWalletSelector}>
            <Wallet size={16} />
            Connect wallet
          </button>
        )}
      </div>

      <div className={`chat-body ${isIntroState ? 'chat-body--intro' : 'chat-body--conversation'}`}>
        {!account && (
          <div className="chat-inline-banner">
            <ShieldAlert size={16} />
            <span>Live today: Bittensor EVM testnet staking, unstaking, and subnet rotation. External-chain deposits are coming soon.</span>
          </div>
        )}

        <div className={isIntroState ? 'chat-intro-grid' : 'chat-conversation-grid'}>
          <div className="chat-msgs">
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`msg ${message.role === 'user' ? 'user' : ''}`}>
            <div className={`av ${message.role === 'user' ? 'av-u' : 'av-b'}`}>{message.role === 'user' ? 'U' : 'T'}</div>

            <div className={`bub ${message.role === 'user' ? 'user' : 'bot'}`}>
              <div className="chat-markdown">
                <ReactMarkdown>{message.text}</ReactMarkdown>
              </div>

              {message.action && (
                <div className="tcard">
                  <div className="tcard-head">
                    <span className="tcard-head-ic">
                      {message.action.type === 'stake' ? '↑' : message.action.type === 'unstake' ? '↓' : '⇄'}
                    </span>
                    <span className="tcard-head-t">
                      {message.action.type === 'stake'
                        ? 'Stake confirmation'
                        : message.action.type === 'unstake'
                          ? 'Unstake confirmation'
                          : 'Subnet rotation'}
                    </span>
                  </div>

                  <div className="tcard-body">
                    {message.action.type === 'stake' && (
                      <>
                        <div className="trow">
                          <span className="trow-k">Action</span>
                          <span className="trow-v">Stake TAO</span>
                        </div>
                        <div className="trow">
                          <span className="trow-k">Amount</span>
                          <span className="trow-v">{message.action.amount} TAO</span>
                        </div>
                        <div className="trow">
                          <span className="trow-k">Subnet</span>
                          <span className="trow-v trow-vo">Netuid {message.action.netuid}</span>
                        </div>
                        <div className="trow">
                          <span className="trow-k">Estimated receive</span>
                          <span className="trow-v trow-vg">
                            {message.action.estimatedAlpha
                              ? `≈${formatTokenAmount(message.action.estimatedAlpha)} ALPHA`
                              : 'Simulation unavailable'}
                          </span>
                        </div>
                      </>
                    )}

                    {message.action.type === 'unstake' && (
                      <>
                        <div className="trow">
                          <span className="trow-k">Action</span>
                          <span className="trow-v">Unstake ALPHA</span>
                        </div>
                        <div className="trow">
                          <span className="trow-k">Amount</span>
                          <span className="trow-v">{message.action.amount ? `${message.action.amount} ALPHA` : 'All ALPHA'}</span>
                        </div>
                        <div className="trow">
                          <span className="trow-k">From</span>
                          <span className="trow-v trow-vo">Netuid {message.action.netuid}</span>
                        </div>
                        <div className="trow">
                          <span className="trow-k">Estimated receive</span>
                          <span className="trow-v trow-vg">
                            {message.action.estimatedTao
                              ? `≈${formatTokenAmount(message.action.estimatedTao)} TAO`
                              : 'Simulation unavailable'}
                          </span>
                        </div>
                      </>
                    )}

                    {message.action.type === 'swap' && (
                      <>
                        <div className="trow">
                          <span className="trow-k">Action</span>
                          <span className="trow-v">Move ALPHA</span>
                        </div>
                        <div className="trow">
                          <span className="trow-k">Amount</span>
                          <span className="trow-v">{message.action.amount} ALPHA</span>
                        </div>
                        <div className="trow">
                          <span className="trow-k">From</span>
                          <span className="trow-v">Netuid {message.action.netuid}</span>
                        </div>
                        <div className="trow">
                          <span className="trow-k">To</span>
                          <span className="trow-v trow-vo">Netuid {message.action.targetNetuid}</span>
                        </div>
                        <div className="trow">
                          <span className="trow-k">Estimated receive</span>
                          <span className="trow-v trow-vg">
                            {message.action.estimatedAlpha
                              ? `≈${formatTokenAmount(message.action.estimatedAlpha)} ALPHA`
                              : 'Simulation unavailable'}
                          </span>
                        </div>
                        {message.action.intermediateTao && (
                          <div className="trow">
                            <span className="trow-k">Route value</span>
                            <span className="trow-v">via ≈{formatTokenAmount(message.action.intermediateTao)} TAO</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="tcard-actions">
                    <button
                      type="button"
                      className="btn-confirm"
                      onClick={() => message.action && handleAction(message.action)}
                      disabled={!account || status.type === 'loading'}
                    >
                      {message.action.type === 'stake'
                        ? 'Confirm & stake →'
                        : message.action.type === 'unstake'
                          ? 'Confirm & unstake →'
                          : 'Confirm move →'}
                    </button>
                    <button type="button" className="btn-cancel" onClick={() => dismissAction(index)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="thinking-row">
            <Activity size={16} />
            Thinking through the route...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        <div className="input-hints">
          {INPUT_HINTS.map((hint) => (
            <button key={hint.label} type="button" className="hint" onClick={() => setInput(hint.prompt)}>
              {hint.label}
            </button>
          ))}
        </div>

        <div className="chat-input-row">
          <textarea
            ref={textareaRef}
            rows={1}
            className="chat-textarea"
            placeholder={!chatReady ? 'Add VITE_GEMINI_API_KEY to enable live chat...' : 'Ask TaoChat anything — stake, unstake, swap, research…'}
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              adjustTextareaHeight();
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                handleSend();
              }
            }}
            disabled={loading || !chatReady}
          />
          <button
            type="button"
            className="send-btn"
            onClick={handleSend}
            disabled={loading || !input.trim() || !chatReady}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
        </div>
      </div>
    </div>
  );
}
