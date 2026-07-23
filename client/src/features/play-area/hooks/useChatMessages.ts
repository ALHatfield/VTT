import { useCallback, useEffect, useState } from 'react';

import type { ChatMessage } from '@vtt/shared';
import { CHAT_HISTORY_LIMIT } from '@vtt/shared';

interface UseChatMessagesReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  addMessage: (message: ChatMessage) => void;
}

/**
 * Fetches the historical chat messages for a campaign on mount and provides
 * an `addMessage` callback for the socket layer to append incoming messages.
 */
export function useChatMessages(campaignId: string | undefined): UseChatMessagesReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!campaignId) return;

    let cancelled = false;

    const fetchHistory = async (): Promise<void> => {
      setIsLoading(true);
      try {
        const res = await fetch(
          `/api/campaigns/${campaignId}/messages?limit=${CHAT_HISTORY_LIMIT.toString()}`,
          { credentials: 'include' },
        );
        if (!res.ok) {
          console.error('[useChatMessages] Failed to fetch history:', res.status);
          return;
        }
        const body = (await res.json()) as { data: ChatMessage[] };
        if (!cancelled) {
          setMessages(body.data);
        }
      } catch (err) {
        console.error('[useChatMessages] Error fetching history:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void fetchHistory();

    return (): void => {
      cancelled = true;
    };
  }, [campaignId]);

  const addMessage = useCallback((message: ChatMessage): void => {
    setMessages((prev) => [...prev, message]);
  }, []);

  return { messages, isLoading, addMessage };
}
