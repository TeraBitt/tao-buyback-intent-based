# Styles Layout

`src/index.css` is only the import map. Put new CSS in the smallest matching file:

- `01-landing-legacy.css`: original landing/global button styles kept for cascade compatibility.
- `02-base-and-app-foundation.css`: variables, reset continuation, app foundation, shared wallet/modal primitives.
- `03-landing.css`: current landing page theme and responsive rules.
- `04-app-shell.css`: app frame, panels, chat base, swap base, history base.
- `05-dashboard-refresh.css`: current swap/dashboard visual refresh.
- `06-chat.css`: current chat surface, message, composer, and intro layout.
- `07-sidebar-and-layout.css`: sidebar shell and responsive app chrome.
- `08-managed-grids.css`: grid/layout repair rules shared by chat/history.
- `09-theme-and-modals.css`: final theme contrast pass and wallet modal styling.
- `10-history.css`: history table and scrolling behavior.
- `11-app-header-wallet.css`: top-right wallet connect/address control.
- `12-chat-polish.css`: small chat-header and chat-banner overrides.
- `13-swap-polish.css`: swap action dock and route flip button behavior.
- `14-button-typography.css`: shared button font-weight normalization.
- `15-wallet-modal.css`: app-theme wallet modal overrides.
- `16-landing-demo-polish.css`: landing screenshot framing and visibility.

When changing a component, prefer editing its matching file instead of adding broad overrides at the end.
