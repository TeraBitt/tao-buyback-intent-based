import type { ChatConversation, ChatMessage } from '../types';

export const CHAT_WELCOME_MESSAGE =
  "Hey! I'm TaoChat, I can help you trade in Bittensor subnets in plain English.";

const CHAT_CONVERSATIONS_STORAGE_KEY = 'terabitt.chat.conversations.v1';
const ACTIVE_CHAT_STORAGE_KEY = 'terabitt.chat.activeConversationId.v1';

export interface ChatConversationState {
  conversations: ChatConversation[];
  activeConversationId: string;
}

const createConversationId = () => {
  if (globalThis.crypto?.randomUUID) {
    return `chat_${globalThis.crypto.randomUUID()}`;
  }

  return `chat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
};

const createWelcomeMessage = (): ChatMessage => ({
  role: 'model',
  text: CHAT_WELCOME_MESSAGE,
});

export const createDraftConversation = (): ChatConversation => {
  const now = Date.now();

  return {
    id: createConversationId(),
    title: 'New chat',
    messages: [createWelcomeMessage()],
    createdAt: now,
    updatedAt: now,
  };
};

export const hasStartedConversation = (conversation: ChatConversation) =>
  conversation.messages.some((message) => message.role === 'user' && !message.text.startsWith('[System]'));

export const createChatTitleFromPrompt = (prompt: string) => {
  const words = prompt
    .replace(/[^\p{L}\p{N}\s.#$%+-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .slice(0, 6);

  return words.length > 0 ? words.join(' ') : 'Untitled chat';
};

export const formatChatUid = (conversationId: string) =>
  conversationId
    .replace(/^chat_/, '')
    .replace(/-/g, '')
    .slice(0, 10)
    .toUpperCase();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isStoredChatMessage = (value: unknown): value is ChatMessage => {
  if (!isRecord(value)) return false;
  return (value.role === 'user' || value.role === 'model') && typeof value.text === 'string';
};

const normalizeStoredConversation = (value: unknown): ChatConversation | null => {
  if (!isRecord(value) || typeof value.id !== 'string') return null;

  const messages = Array.isArray(value.messages) ? value.messages.filter(isStoredChatMessage) : [];
  const normalizedMessages = messages.length > 0 ? messages : [createWelcomeMessage()];
  const createdAt = typeof value.createdAt === 'number' ? value.createdAt : Date.now();
  const updatedAt = typeof value.updatedAt === 'number' ? value.updatedAt : createdAt;
  const title = typeof value.title === 'string' && value.title.trim() ? value.title.trim() : 'New chat';

  return {
    id: value.id,
    title,
    messages: normalizedMessages,
    createdAt,
    updatedAt,
  };
};

const readStoredConversations = () => {
  if (typeof window === 'undefined') return [];

  try {
    const storedValue = window.localStorage.getItem(CHAT_CONVERSATIONS_STORAGE_KEY);
    if (!storedValue) return [];

    const parsed = JSON.parse(storedValue);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map(normalizeStoredConversation)
      .filter((conversation): conversation is ChatConversation => Boolean(conversation))
      .sort((first, second) => second.updatedAt - first.updatedAt);
  } catch {
    return [];
  }
};

export const getInitialChatConversationState = (): ChatConversationState => {
  const storedConversations = readStoredConversations();
  const conversations = storedConversations.length > 0 ? storedConversations : [createDraftConversation()];
  const storedActiveId =
    typeof window === 'undefined' ? null : window.localStorage.getItem(ACTIVE_CHAT_STORAGE_KEY);
  const activeConversationId = storedActiveId && conversations.some((conversation) => conversation.id === storedActiveId)
    ? storedActiveId
    : conversations[0].id;

  return { conversations, activeConversationId };
};

export const persistChatConversationState = ({ conversations, activeConversationId }: ChatConversationState) => {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(CHAT_CONVERSATIONS_STORAGE_KEY, JSON.stringify(conversations));
  window.localStorage.setItem(ACTIVE_CHAT_STORAGE_KEY, activeConversationId);
};
