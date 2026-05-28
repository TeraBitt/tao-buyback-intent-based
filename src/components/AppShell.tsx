import { useEffect, useState, type ReactNode } from 'react';
import {
  History,
  LogOut,
  MessageCircle,
  MessageSquareText,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Repeat2,
  SquarePen,
  Trash2,
  Wallet,
} from 'lucide-react';
import TERABITT_LOGO from '../assets/terabitt_logo.png';
import { formatChatUid } from '../utils/chatConversations';
import type { AppView, ChatConversation } from '../types';

interface AppShellProps {
  account: string;
  appView: AppView;
  activeChatId: string;
  chatRecents: ChatConversation[];
  children: ReactNode;
  statusBanner: ReactNode;
  formatShortValue: (value: string, start?: number, end?: number) => string;
  onDisconnectWallet: () => void;
  onConnectWallet: () => void;
  onCreateChat: () => void;
  onLoadHistory: () => void;
  onSelectChat: (conversationId: string) => void;
  onDeleteChat: (conversationId: string) => void;
  onSetAppView: (view: AppView) => void;
}

export default function AppShell({
  account,
  appView,
  activeChatId,
  chatRecents,
  children,
  statusBanner,
  formatShortValue,
  onDisconnectWallet,
  onConnectWallet,
  onCreateChat,
  onLoadHistory,
  onSelectChat,
  onDeleteChat,
  onSetAppView,
}: AppShellProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const handleNavigation = (view: AppView) => {
    onSetAppView(view);
    if (view === 'history') {
      onLoadHistory();
    }
  };

  const handleCreateChat = () => {
    onCreateChat();
    onSetAppView('chat');
  };

  const [openRecentMenu, setOpenRecentMenu] = useState<string | null>(null);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) {
        return;
      }
      if (event.target.closest('.app-sidebar__recent-actions, .app-sidebar__recent-actions-summary, .app-sidebar__recent-menu')) {
        return;
      }
      setOpenRecentMenu(null);
    };

    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, []);

  const handleSelectChat = (conversationId: string) => {
    onSelectChat(conversationId);
    onSetAppView('chat');
    setOpenRecentMenu(null);
  };

  const toggleRecentMenu = (conversationId: string, event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setOpenRecentMenu((current) => (current === conversationId ? null : conversationId));
  };

  const handleDeleteRecent = (conversationId: string, event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onDeleteChat(conversationId);
    setOpenRecentMenu(null);
  };

  const navigationItems = [
    {
      view: 'chat' as const,
      label: 'Chat',
      icon: <MessageCircle size={16} />,
    },
    {
      view: 'dashboard' as const,
      label: 'Swap',
      icon: <Repeat2 size={16} />,
    },
    {
      view: 'history' as const,
      label: 'Transactions',
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
            aria-label="Open TeraBitt"
            title="TeraBitt"
          >
            <span className="app-sidebar__brand-lockup">
              <span>TeraBitt</span>
              <img src={TERABITT_LOGO} alt="" className="app-sidebar__brand-logo" />
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

        <button type="button" className="app-sidebar__new-chat" onClick={handleCreateChat} title="New chat">
          <SquarePen size={15} />
          <span>New chat</span>
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
              </span>
            </button>
          ))}
        </nav>

        {chatRecents.length > 0 && (
          <div className="app-sidebar__recents">
            <div className="app-sidebar__section-label app-sidebar__section-label--recents">Recents</div>
            <div className="app-sidebar__recent-list" aria-label="Recent chats">
              {chatRecents.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`app-sidebar__recent ${appView === 'chat' && activeChatId === conversation.id ? 'is-active' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelectChat(conversation.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleSelectChat(conversation.id);
                    }
                  }}
                  title={`${conversation.title} · UID ${formatChatUid(conversation.id)}`}
                >
                  <MessageSquareText size={14} />
                  <span className="app-sidebar__recent-copy">
                    <span className="app-sidebar__recent-title">{conversation.title}</span>
                    <span className="app-sidebar__recent-id">UID {formatChatUid(conversation.id)}</span>
                  </span>

                  <div className="app-sidebar__recent-actions">
                    <button
                      type="button"
                      className="app-sidebar__recent-actions-summary"
                      aria-expanded={openRecentMenu === conversation.id}
                      aria-label="Open chat actions"
                      onClick={(event) => toggleRecentMenu(conversation.id, event)}
                    >
                      <MoreHorizontal size={14} />
                    </button>
                    {openRecentMenu === conversation.id && (
                      <div className="app-sidebar__recent-menu" onClick={(event) => event.stopPropagation()}>
                        <button
                          type="button"
                          className="app-sidebar__recent-menu-item"
                          onClick={(event) => handleDeleteRecent(conversation.id, event)}
                        >
                          <Trash2 size={14} />
                          <span>Delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
