import {
  COMMAND_PREVIEWS,
  HOW_STEPS,
  LANDING_TICKER,
  SUPPORTED_NETWORKS,
  USE_CASES,
  VISION_POINTS,
} from '../data/landing';

interface LandingPageProps {
  account: string;
  formatShortValue: (value: string, start?: number, end?: number) => string;
  onConnectWallet: () => void;
  onDisconnectWallet: () => void;
  onOpenApp: () => void;
}

export default function LandingPage({
  account,
  formatShortValue,
  onConnectWallet,
  onDisconnectWallet,
  onOpenApp,
}: LandingPageProps) {
  return (
    <div className="landing-shell landing-shell--taochat">
      <header className="tao-nav">
        <div className="tao-logo">
          tao<b>chat</b>
        </div>

        <nav className="tao-nav__links">
          <a href="#vision">Vision</a>
          <a href="#usecases">Use cases</a>
          <a href="#how">How it works</a>
        </nav>

        <div className="tao-nav__actions">
          {account ? (
            <div className="wallet-inline-actions">
              <div className="tao-status-pill">
                <span className="status-dot status-dot--success" />
                {formatShortValue(account, 6, 4)}
              </div>
              <button type="button" className="tao-btn tao-btn--ghost tao-btn--small" onClick={onDisconnectWallet}>
                Disconnect
              </button>
            </div>
          ) : (
            <button type="button" className="tao-btn tao-btn--ghost" onClick={onConnectWallet}>
              Connect wallet
            </button>
          )}
          <button type="button" className="tao-btn tao-btn--primary" onClick={onOpenApp}>
            Launch app →
          </button>
        </div>
      </header>

      <main>
        <section className="tao-hero">
          <div className="tao-badge">
            <span className="tao-badge__dot" />
            Live on Bittensor EVM testnet
          </div>
          <h1>
            Bittensor DeFi.
            <br />
            <em>Just say it.</em>
          </h1>
          <p>
            Stake, unstake, and swap on Bittensor subnets using plain English. External-chain routes will land later,
            but the live experience today stays focused on Bittensor EVM testnet.
          </p>
          <div className="tao-hero__actions">
            <button type="button" className="tao-btn tao-btn--primary tao-btn--large" onClick={onOpenApp}>
              Launch app →
            </button>
            <button type="button" className="tao-btn tao-btn--ghost tao-btn--large">
              Read docs
            </button>
          </div>
        </section>

        <section className="tao-ticker" aria-label="Featured subnet routes">
          <div className="tao-ticker__track">
            {[...LANDING_TICKER, ...LANDING_TICKER].map((item, index) => (
              <div key={`${item.label}-${index}`} className="tao-ticker__item">
                <span className="tao-ticker__label">{item.label}</span>
                <span>{item.value}</span>
                <span className={item.positive ? 'is-positive' : 'is-negative'}>{item.delta}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="tao-demo" id="demo">
          <div className="tao-demo__inner">
            <div className="tao-section-tag">See it in action</div>
            <div className="tao-section-title tao-section-title--demo">One message. Done.</div>
            <div className="tao-demo__window">
              <div className="tao-demo__bar">
                <div className="tao-demo__title">
                  <span className="tao-demo__dot" />
                  <span>TaoChat</span>
                </div>
                <div className="tao-demo__connected">● Connected</div>
              </div>

              <div className="tao-demo__body">
                <div className="tao-demo__row tao-demo__row--user">
                  <div className="tao-demo__bubble tao-demo__bubble--user">
                    Stake 100 TAO on the strongest subnet right now
                  </div>
                </div>
                <div className="tao-demo__row">
                  <div className="tao-demo__bubble tao-demo__bubble--bot">
                    I found a top route, drafted the staking intent, and surfaced the exact route before asking for
                    confirmation.
                    <div className="tao-demo__ok">Confirmed: 100 TAO routed into the selected subnet.</div>
                  </div>
                </div>
                <div className="tao-demo__row tao-demo__row--user">
                  <div className="tao-demo__bubble tao-demo__bubble--user">Move half of that position into Subnet 27.</div>
                </div>
                <div className="tao-demo__row">
                  <div className="tao-demo__bubble tao-demo__bubble--bot">
                    Rotation prepared on the same chain. Source route, destination route, and amount are all ready for
                    review.
                    <div className="tao-demo__ok">Moved: 50 TAO worth of Alpha into the new subnet route.</div>
                  </div>
                </div>
              </div>

              <div className="tao-demo__footer">
                <div className="tao-demo__input">
                  Try: &quot;Unstake my Alpha from Netuid 310&quot; or &quot;What does Subnet 11 do?&quot;
                </div>
                <button type="button" className="tao-btn tao-btn--primary tao-demo__send" onClick={onOpenApp}>
                  Send
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="tao-vision" id="vision">
          <div>
            <div className="tao-section-tag">Our vision</div>
            <h2 className="tao-vision__title">
              DeFi on Bittensor should be
              <br />
              for <em>everyone.</em>
            </h2>
            <p className="tao-vision__copy">
              Bittensor is building the most important decentralised AI network in the world. Over 60 live subnets,
              each earning yield for stakers. But getting in has always required wallets, bridges, dashboards, and
              technical patience most people don&apos;t have.
            </p>
            <p className="tao-vision__copy">
              TaoChat makes it conversational. You tell it what you want in plain English and it handles the live
              Bittensor EVM testnet flow cleanly, while upcoming external-chain routes stay clearly marked as coming
              soon.
            </p>
            <div className="tao-vision__points">
              {VISION_POINTS.map((point) => (
                <div key={point.title} className="tao-vision__point">
                  <div className="tao-vision__icon">{point.icon}</div>
                  <div>
                    <h3>{point.title}</h3>
                    <p>{point.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="tao-command-list">
            {COMMAND_PREVIEWS.map((preview) => (
              <div key={preview.prompt} className="tao-command-card">
                <div className="tao-command-card__label">User says</div>
                <div className="tao-command-card__prompt">{preview.prompt}</div>
                <div className="tao-command-card__result">
                  <span className="tao-command-card__result-dot" />
                  {preview.result}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="tao-usecases" id="usecases">
          <div className="tao-usecases__inner">
            <div className="tao-usecases__header">
              <div className="tao-section-tag">What you can do</div>
              <h2 className="tao-section-title">Simple commands. Real outcomes.</h2>
            </div>

            <div className="tao-usecases__grid">
              {USE_CASES.map((item) => (
                <article key={item.id} className="tao-usecases__card">
                  <div className="tao-usecases__index">{item.id}</div>
                  <div className="tao-usecases__icon">{item.icon}</div>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                  <div className="tao-usecases__example">
                    &quot;<span>{item.example}</span>&quot;
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="tao-how" id="how">
          <div className="tao-section-tag">Process</div>
          <h2 className="tao-section-title">How TaoChat works</h2>

          <div className="tao-how__steps">
            {HOW_STEPS.map((item) => (
              <div key={item.step} className="tao-how__step">
                <div className="tao-how__step-number">{item.step}</div>
                <div className="tao-how__step-title">{item.title}</div>
                <div className="tao-how__step-copy">{item.description}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="tao-chains">
          <div className="tao-chains__inner">
            <div className="tao-section-tag">Supported networks</div>
            <h2 className="tao-section-title">Stake from any chain</h2>

            <div className="tao-chains__grid">
              {SUPPORTED_NETWORKS.map((network) => (
                <article key={network.name} className="tao-chains__card">
                  <div className="tao-chains__icon" style={network.style}>
                    {network.symbol}
                  </div>
                  <div className="tao-chains__name">{network.name}</div>
                  <div
                    className={
                      network.status === 'Live' ? 'tao-chains__status' : 'tao-chains__status tao-chains__status--soon'
                    }
                  >
                    {network.status === 'Live' ? '● Live' : 'Coming soon'}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="tao-cta">
          <div className="tao-cta__inner">
            <div className="tao-section-tag">Get started</div>
            <h2 className="tao-cta__title">
              The simplest way to
              <br />
              earn on <em>Bittensor.</em>
            </h2>
            <p>Connect and make your first stake in under 60 seconds. No setup. No learning curve.</p>
            <div className="tao-hero__actions">
              <button type="button" className="tao-btn tao-btn--primary tao-btn--large" onClick={onOpenApp}>
                Launch app →
              </button>
              <button type="button" className="tao-btn tao-btn--ghost tao-btn--large">
                Join Discord
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="tao-footer">
        <div className="tao-logo tao-logo--small">
          tao<b>chat</b>
        </div>
        <div className="tao-footer__links">
          <a href="#">Docs</a>
          <a href="#">Twitter</a>
          <a href="#">Discord</a>
          <a href="#">GitHub</a>
          <a href="#">Terms</a>
        </div>
        <div className="tao-footer__copy">© 2025 TaoChat · Non-custodial · Open source</div>
      </footer>
    </div>
  );
}
