import { useState, type ReactNode } from 'react';
import { History, LogOut, MessageCircle, PanelLeftClose, PanelLeftOpen, Repeat2, Wallet } from 'lucide-react';
import type { AppView } from '../types';

interface AppShellProps {
  account: string;
  appView: AppView;
  children: ReactNode;
  statusBanner: ReactNode;
  formatShortValue: (value: string, start?: number, end?: number) => string;
  onDisconnectWallet: () => void;
  onConnectWallet: () => void;
  onLoadHistory: () => void;
  onSetAppView: (view: AppView) => void;
}

export default function AppShell({
  account,
  appView,
  children,
  statusBanner,
  formatShortValue,
  onDisconnectWallet,
  onConnectWallet,
  onLoadHistory,
  onSetAppView,
}: AppShellProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const handleNavigation = (view: AppView) => {
    onSetAppView(view);
    if (view === 'history') {
      onLoadHistory();
    }
  };

  const navigationItems = [
    {
      view: 'chat' as const,
      label: 'Chat',
      description: 'Ask and execute',
      icon: <MessageCircle size={16} />,
    },
    {
      view: 'dashboard' as const,
      label: 'Swap',
      description: 'Stake tools',
      icon: <Repeat2 size={16} />,
    },
    {
      view: 'history' as const,
      label: 'History',
      description: 'Past intents',
      icon: <History size={16} />,
    },
  ];

  return (
    <div className={`dashboard-shell ${isSidebarCollapsed ? 'is-sidebar-collapsed' : ''}`}>
      <aside className="app-sidebar">
        <div className="app-sidebar__top">
          <button
            type="button"
            className="app-sidebar__brand"
            onClick={() => handleNavigation('chat')}
            aria-label="Open TaoChat"
            title="TaoChat"
          >
            <span className="tao-logo tao-logo--small">
              tao<b>chat</b>
            </span>
          </button>

          <button
            type="button"
            className="app-sidebar__collapse"
            onClick={() => setIsSidebarCollapsed((value) => !value)}
            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isSidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>

        <div className="app-sidebar__section-label">Workspace</div>
        <nav className="app-sidebar__nav" aria-label="App navigation">
          {navigationItems.map((item) => (
            <button
              key={item.view}
              type="button"
              className={`app-sidebar__nav-item ${appView === item.view ? 'is-active' : ''}`}
              onClick={() => handleNavigation(item.view)}
              aria-current={appView === item.view ? 'page' : undefined}
              title={item.label}
            >
              <span className="app-sidebar__icon">{item.icon}</span>
              <span className="app-sidebar__nav-copy">
                <span>{item.label}</span>
                <small>{item.description}</small>
              </span>
            </button>
          ))}
        </nav>

      </aside>

      <section className="app-main">
        <div className="app-main__wallet">
          {account ? (
            <div className="app-wallet-chip" title={account}>
              <span className="app-wallet-chip__dot" />
              <span>{formatShortValue(account, 6, 4)}</span>
              <button type="button" onClick={onDisconnectWallet} aria-label="Disconnect wallet" title="Disconnect wallet">
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <button type="button" className="tao-btn tao-btn--primary app-wallet-connect" onClick={onConnectWallet}>
              <Wallet size={15} />
              <span>Connect wallet</span>
            </button>
          )}
        </div>
        {statusBanner}
        {children}
      </section>
    </div>
  );
}
