import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';
import { WeeklyPlan } from '../types';
import { getApiBaseUrl } from '../utils/platform';

interface StreamingState {
  isGenerating: boolean;
  progress: number;
  currentDay: string | null;
  currentMessage: string | null;
  partialPlan: WeeklyPlan | null;
  error: string | null;
}

interface StreamProgressPayload {
  day?: string;
  dayName?: string;
  message?: string;
  progress?: number;
  partialDay?: unknown;
  partialDays?: unknown[];
}

const initialState: StreamingState = {
  isGenerating: false,
  progress: 0,
  currentDay: null,
  currentMessage: null,
  partialPlan: null,
  error: null,
};

function looksLikeFamilyGroupId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    || value.startsWith('family_')
    || value.startsWith('group_');
}

function normalizeOptionalArgs(
  familyGroupId?: string | null,
  userApiKey?: string
): { familyGroupId?: string | null; userApiKey?: string } {
  if (familyGroupId && !userApiKey && !looksLikeFamilyGroupId(familyGroupId)) {
    return {
      familyGroupId: null,
      userApiKey: familyGroupId,
    };
  }

  return { familyGroupId, userApiKey };
}

async function getStreamingHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Authentication required. Please sign in again.');
  }

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  };
}

export function useStreamingGeneration() {
  const [state, setState] = useState<StreamingState>(initialState);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  const generateWithStreaming = useCallback(
    async (
      userId: string,
      preferences: unknown,
      learningSummary?: unknown,
      familyGroupId?: string | null,
      userApiKey?: string
    ): Promise<WeeklyPlan> => {
      const normalized = normalizeOptionalArgs(familyGroupId, userApiKey);

      setState({
        isGenerating: true,
        progress: 0,
        currentDay: null,
        currentMessage: 'Preparing your weekly plan...',
        partialPlan: null,
        error: null,
      });

      try {
        const response = await fetch(`${getApiBaseUrl()}/api/ai-stream`, {
          method: 'POST',
          headers: await getStreamingHeaders(),
          body: JSON.stringify({
            userId,
            familyGroupId: normalized.familyGroupId ?? null,
            preferences,
            learningSummary,
            userApiKey: normalized.userApiKey,
          }),
        });

        if (!response.ok || !response.body) {
          let errorMessage = 'Streaming generation failed';

          try {
            const errorData = await response.json();
            errorMessage = errorData?.error || errorMessage;
          } catch {
            const text = await response.text().catch(() => '');
            if (text) {
              errorMessage = text;
            }
          }

          throw new Error(errorMessage);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let finalPlan: WeeklyPlan | null = null;

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split('\n\n');
          buffer = chunks.pop() || '';

          for (const chunk of chunks) {
            const lines = chunk.split('\n');
            let eventType = 'message';
            let data = '';

            for (const line of lines) {
              if (line.startsWith('event: ')) {
                eventType = line.slice(7).trim();
              } else if (line.startsWith('data: ')) {
                data += line.slice(6);
              }
            }

            if (!data) {
              continue;
            }

            if (eventType === 'error') {
              const payload = JSON.parse(data);
              throw new Error(payload.error || 'Streaming generation failed');
            }

            if (eventType === 'progress' || eventType === 'thinking') {
              const payload = JSON.parse(data) as StreamProgressPayload;
              const partialDays = Array.isArray(payload.partialDays)
                ? payload.partialDays
                : payload.partialDay
                  ? [payload.partialDay]
                  : [];

              setState((previous) => ({
                ...previous,
                progress: payload.progress ?? previous.progress,
                currentDay: payload.dayName || payload.day || previous.currentDay,
                currentMessage: payload.message || previous.currentMessage,
                partialPlan: partialDays.length > 0
                  ? ({ days: partialDays } as WeeklyPlan)
                  : previous.partialPlan,
              }));
              continue;
            }

            if (eventType === 'complete') {
              finalPlan = JSON.parse(data) as WeeklyPlan;
              setState((previous) => ({
                ...previous,
                isGenerating: false,
                progress: 100,
                currentMessage: 'Plan ready',
                partialPlan: finalPlan,
              }));
            }
          }
        }

        if (!finalPlan) {
          throw new Error('Streaming completed without returning a meal plan.');
        }

        return finalPlan;
      } catch (error: any) {
        const message = error instanceof Error ? error.message : 'Streaming generation failed';
        setState((previous) => ({
          ...previous,
          isGenerating: false,
          error: message,
        }));
        throw error;
      }
    },
    []
  );

  return {
    ...state,
    generateWithStreaming,
    reset,
  };
}
