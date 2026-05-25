import { useState, type ReactNode } from 'react';
import { ArrowLeft, History, MessageCircle, PanelLeftClose, PanelLeftOpen, Repeat2 } from 'lucide-react';
import type { AppView } from '../types';

interface AppShellProps {
  account: string;
  appView: AppView;
  children: ReactNode;
  statusBanner: ReactNode;
  formatShortValue: (value: string, start?: number, end?: number) => string;
  onDisconnectWallet: () => void;
  onLoadHistory: () => void;
  onReturnLanding: () => void;
  onSetAppView: (view: AppView) => void;
}

export default function AppShell({
  account,
  appView,
  children,
  statusBanner,
  formatShortValue,
  onDisconnectWallet,
  onLoadHistory,
  onReturnLanding,
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

        <button type="button" className="back-link app-sidebar__back" onClick={onReturnLanding} title="Back to site">
          <ArrowLeft size={14} />
          <span>Back to site</span>
        </button>

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

        {account && (
          <div className="app-sidebar__footer">
            <div className="wpill">
              <div className="wdot" />
              <div className="waddr">{formatShortValue(account, 6, 4)}</div>
              <div className="wnet">Testnet</div>
            </div>
            <button type="button" className="sidebar-disconnect" onClick={onDisconnectWallet}>
              Disconnect
            </button>
          </div>
        )}
      </aside>

      <section className="app-main">
        {statusBanner}
        {children}
      </section>
    </div>
  );
}
