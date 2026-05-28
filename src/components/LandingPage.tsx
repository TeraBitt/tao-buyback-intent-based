import { useState } from "react";
import {
  COMMAND_PREVIEWS,
  HOW_STEPS,
  LANDING_TICKER,
  SUPPORTED_NETWORKS,
  USE_CASES,
  VISION_POINTS,
  ASSETS,
} from '../data/landing';

const CARD_POSITIONS = [
  { top: 24,  left: 16,  rotate: -6, width: 320 },
  { top: 72,  left: 210, rotate:  4, width: 280 },
  { top: 230, left: 30,  rotate:  5, width: 230 },
  { top: 210, left: 220, rotate: -4, width: 320 },
];

const getLaunchAppHref = () => {
  if (typeof window === 'undefined') {
    return '/app?view=chat';
  }

  const url = new URL(window.location.href);
  url.pathname = '/app';
  url.search = '';
  url.searchParams.set('view', 'chat');
  url.hash = '';
  return url.toString();
};

export default function LandingPage() {
  const [hoveredCardIndex, setHoveredCardIndex] = useState<number | null>(null);
  const launchAppHref = getLaunchAppHref();

  return (
    <div className="landing-shell landing-shell--taochat">
      <header className="tao-nav">
        <a href="/" className="tao-logo">
          TeraBitt <img src={ASSETS.LOGO} alt="" className="tao-logo__image" />
        </a>

        <nav className="tao-nav__links">
          <a href="#vision">Vision</a>
          <a href="#usecases">Use cases</a>
          <a href="#how">How it works</a>
        </nav>

        <div className="tao-nav__actions">
          <a href={launchAppHref} target="_blank" rel="noreferrer" className="tao-btn tao-btn--primary">
            Launch app →
          </a>
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
            <a href={launchAppHref} target="_blank" rel="noreferrer" className="tao-btn tao-btn--primary tao-btn--large">
              Launch app →
            </a>
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
            <div className="tao-section-title">One message. Done.</div>

            <div className="tao-demo__window">
              <div
                className="border-glow-wrapper"
                style={{
                  position: "relative",
                  overflow: "visible",
                }}
              >
                <img
                  src={ASSETS.APP_SCREENSHOT}
                  alt="TeraBitt app demo"
                  style={{
                    position: "relative",
                    zIndex: 1,
                    width: "100%",
                    borderRadius: 12,
                    display: "block",
                  }}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="tao-vision" id="vision">
          <div>
            <div className="tao-section-tag">Our vision</div>
            <h2 className="tao-section-title">
              Bittensor is
              for everyone.
            </h2>
            <br />
            <p className="tao-vision__copy">
              Bittensor is building the world's most important decentralised AI network. 60+ live subnets, each generating yield for stakers.
              Getting in has always meant setup, bridges, and dashboards. TeraBitt removes all of that.
            </p>
            <p className="tao-vision__copy">
              TeraBitt makes it conversational. You tell it what you want in plain English and it handles the transaction flow cleanly.
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
            <div
              style={{
                position: "relative",
                width: "100%",
                minHeight: 420,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div style={{ position: "relative", width: 440, height: 400 }}>
                {COMMAND_PREVIEWS.map((card, i) => {
                  const pos = CARD_POSITIONS[i];
                  const isHovered = hoveredCardIndex === i;

                  return (
                    <div
                      key={card.prompt}
                      onMouseEnter={() => setHoveredCardIndex(i)}
                      onMouseLeave={() => setHoveredCardIndex(null)}
                      style={{
                        position: "absolute",
                        top: pos.top,
                        left: pos.left,
                        width: pos.width,
                        background: "#141414",
                        border: isHovered
                          ? "1px solid rgba(255,255,255,0.18)"
                          : "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 16,
                        padding: "14px 16px",
                        cursor: "default",
                        zIndex: isHovered ? 99 : i + 1,
                        transform: isHovered
                          ? "rotate(0deg) scale(1.05)"
                          : `rotate(${pos.rotate}deg)`,
                        transition: "transform 0.22s ease, border 0.2s ease, z-index 0s",
                        boxShadow: isHovered
                          ? "0 20px 40px rgba(0,0,0,0.6)"
                          : "0 4px 16px rgba(0,0,0,0.4)",
                      }}
                    >
                      {/* Prompt */}
                      <div
                        style={{
                          fontFamily: "monospace",
                          fontSize: 12,
                          fontWeight: 500,
                          color: "white",
                          background: "transparent",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 8,
                          padding: "5px 10px",
                          marginBottom: 10,
                          letterSpacing: "0.01em",
                        }}
                      >
                        {card.prompt}
                      </div>

                      {/* Result */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 7,
                          fontSize: 12,
                          color: "rgba(255,255,255,0.5)",
                          lineHeight: 1.5,
                        }}
                      >
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: "#a3e635",
                            flexShrink: 0,
                            marginTop: 4,
                          }}
                        />
                        {card.result}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
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
          <h2 className="tao-section-title">How TeraBitt works</h2>

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
                  <img src={network.symbol} alt={network.name} className="tao-chains__icon" />
                  <div className="tao-chains__name">{network.name}</div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="tao-cta">
          <div className="tao-cta__inner">
            <h2 className="tao-cta__title">
              The simplest way to
              <br />
              trade on <em>Bittensor.</em>
            </h2>
            <p>Launch and make your first stake in under 60 seconds. No setup. No learning curve.</p>
            <div className="tao-hero__actions">
              <a href={launchAppHref} target="_blank" rel="noreferrer" className="tao-btn tao-btn--primary tao-btn--large">
                Launch app →
              </a>
              <a href="https://discord.com/invite/bittensor" target="_blank" rel="noreferrer" className="tao-btn tao-btn--ghost tao-btn--large">
                Join Discord
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="tao-footer">
        <div className="tao-logo tao-logo--small">
          TeraBitt <img src={ASSETS.LOGO} alt="" className="tao-logo__image" />
        </div>
        <div className="tao-footer__links">
          <a href="https://x.com/terabitt_">Twitter</a>
          <a href="https://discord.com/invite/bittensor" target="_blank" rel="noreferrer">Discord</a>
          <a href="https://github.com/TeraBitt/tao-buyback-intent-based" target="_blank" rel="noreferrer">GitHub</a>
        </div>
        <div className="tao-footer__copy">© 2026 TeraBitt · Non-custodial · Open source</div>
      </footer>
    </div>
  );
}
