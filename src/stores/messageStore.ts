import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Message } from '../types';
import { API_BASE_URL } from '../config/api';
import { logger } from '../utils/logger';
import { useUserStore } from './userStore';

interface MessageState {
  messages: Message[];
  addMessage: (title: string, content: string) => void;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  unreadCount: () => number;
  loadMessagesFromServer: () => Promise<void>;
}

export const useMessageStore = create<MessageState>()(
  persist(
    (set, get) => ({
      messages: [],
      addMessage: (title, content) => {
        const now = Date.now();
        const message: Message = {
          id: `msg_${now}_${Math.random().toString(36).slice(2, 8)}`,
          title,
          content,
          isRead: false,
          createdAt: now,
        };
        set((state) => ({
          messages: [message, ...state.messages],
        }));
      },
      loadMessagesFromServer: async () => {
        try {
          const { currentUser, token } = useUserStore.getState();
          if (!currentUser || !token) return;
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
          
          let res: Response;
          try {
            res = await fetch(`${API_BASE_URL}/v1/message/messages`, {
              headers: {
                'Authorization': `Bearer ${token}`,
              },
              signal: controller.signal,
            });
            clearTimeout(timeoutId);
          } catch (fetchError: unknown) {
            clearTimeout(timeoutId);
            if (fetchError instanceof Error && fetchError.name === 'AbortError') {
              logger.error('[messageStore] 请求超时');
              return;
            }
            throw fetchError;
          }
          
          if (res.ok) {
            let data;
            try {
              data = await res.json();
            } catch (e) {
              logger.error('[messageStore] JSON解析失败:', e);
              return;
            }
            
            // 验证数据格式
            if (!data || !Array.isArray(data.messages)) {
              logger.error('[messageStore] 服务器数据格式不正确');
              return;
            }
            
            // 合并服务器消息和本地消息，去重
            const serverMessages = data.messages || [];
            const localMessages = get().messages;
            const messageMap = new Map<string, Message>();
            
            // 先添加本地消息
            localMessages.forEach((msg) => {
              messageMap.set(msg.id, msg);
            });
            
            // 再添加服务器消息（会覆盖本地相同ID的消息）
            serverMessages.forEach((msg: Message) => {
              messageMap.set(msg.id, msg);
            });
            
            const mergedMessages = Array.from(messageMap.values()).sort(
              (a, b) => b.createdAt - a.createdAt
            );
            
            set({ messages: mergedMessages });
          } else if (res.status === 401 || res.status === 403) {
            // Token过期，尝试刷新Token
            const refreshResult = await useUserStore.getState().refreshAccessToken();
            if (refreshResult.ok) {
              // 刷新成功，重试加载消息
              logger.log('[messageStore] Token已刷新，重试加载消息');
              return get().loadMessagesFromServer();
            } else {
              // 刷新失败，清除登录状态
              logger.warn('[messageStore] Token无效且刷新失败，清除登录状态');
              useUserStore.getState().logout();
            }
          }
        } catch (e) {
          logger.error('[messageStore] load messages error', e);
        }
      },
      markAsRead: async (id) => {
        // 先更新本地状态
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === id ? { ...m, isRead: true } : m
          ),
        }));
        // 同步到服务器
        try {
          const token = useUserStore.getState().token;
          if (!token) {
            logger.warn('[messageStore] 未登录，无法同步已读状态');
            return;
          }
          
          const res = await fetch(`${API_BASE_URL}/v1/message/messages/${id}/read`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          
          if (res.status === 401 || res.status === 403) {
            // Token过期，尝试刷新Token
            const refreshResult = await useUserStore.getState().refreshAccessToken();
            if (refreshResult.ok) {
              // 刷新成功，重试标记已读
              logger.log('[messageStore] Token已刷新，重试标记已读');
              return get().markAsRead(id);
            } else {
              // 刷新失败，清除登录状态
              logger.warn('[messageStore] Token无效且刷新失败，清除登录状态');
              useUserStore.getState().logout();
            }
          }
        } catch (e) {
          logger.error('[messageStore] mark as read error', e);
        }
      },
      markAllAsRead: async () => {
        const currentMessages = get().messages;
        const unreadMessages = currentMessages.filter((m) => !m.isRead);
        // 先更新本地状态
        set((state) => ({
          messages: state.messages.map((m) =>
            m.isRead ? m : { ...m, isRead: true }
          ),
        }));
        // 同步到服务器
        try {
          const token = useUserStore.getState().token;
          if (!token) {
            logger.warn('[messageStore] 未登录，无法同步已读状态');
            return;
          }
          
          const results = await Promise.allSettled(
            unreadMessages.map((msg) =>
              fetch(`${API_BASE_URL}/v1/message/messages/${msg.id}/read`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                },
              })
            )
          );
          
          // 检查是否有认证错误
          const authError = results.find(
            (r) => r.status === 'fulfilled' && 
            (r.value.status === 401 || r.value.status === 403)
          );
          
          if (authError) {
            // Token过期，尝试刷新Token
            const refreshResult = await useUserStore.getState().refreshAccessToken();
            if (refreshResult.ok) {
              // 刷新成功，重试标记全部已读
              logger.log('[messageStore] Token已刷新，重试标记全部已读');
              return get().markAllAsRead();
            } else {
              // 刷新失败，清除登录状态
              logger.warn('[messageStore] Token无效且刷新失败，清除登录状态');
              useUserStore.getState().logout();
            }
          }
        } catch (e) {
          logger.error('[messageStore] mark all as read error', e);
        }
      },
      unreadCount: () => {
        return get().messages.filter((m) => !m.isRead).length;
      },
    }),
    {
      name: 'piccco-message-storage',
    }
  )
);






















