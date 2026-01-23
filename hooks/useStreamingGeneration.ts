import { useState, useCallback } from 'react';
import { WeeklyPlan, DayPlan } from '../types';
import { getApiBaseUrl } from '../utils/platform';

interface StreamingState {
    isStreaming: boolean;
    currentDay: number;
    partialPlan: Partial<WeeklyPlan> | null;
    error: string | null;
    progress: string;
}

interface UseStreamingGenerationReturn extends StreamingState {
    generateWithStreaming: (userId: string, preferences: any, learningSummary?: any, userApiKey?: string) => Promise<WeeklyPlan | null>;
    reset: () => void;
}

// Use centralized API URL (handles native vs web)
const getApiUrl = getApiBaseUrl;

export function useStreamingGeneration(): UseStreamingGenerationReturn {
    const [state, setState] = useState<StreamingState>({
        isStreaming: false,
        currentDay: 0,
        partialPlan: null,
        error: null,
        progress: ''
    });

    const reset = useCallback(() => {
        setState({
            isStreaming: false,
            currentDay: 0,
            partialPlan: null,
            error: null,
            progress: ''
        });
    }, []);

    const generateWithStreaming = useCallback(async (
        userId: string,
        preferences: any,
        learningSummary?: any,
        userApiKey?: string
    ): Promise<WeeklyPlan | null> => {
        setState(prev => ({ ...prev, isStreaming: true, error: null, progress: 'Starting...' }));

        try {
            const response = await fetch(`${getApiUrl()}/api/ai-stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    preferences,
                    learningSummary,
                    userApiKey
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Streaming failed');
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('No response body');
            }

            const decoder = new TextDecoder();
            let fullText = '';
            let finalPlan: WeeklyPlan | null = null;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));

                            switch (data.type) {
                                case 'start':
                                    setState(prev => ({ ...prev, progress: data.message }));
                                    break;

                                case 'progress':
                                    setState(prev => ({
                                        ...prev,
                                        currentDay: data.day,
                                        progress: data.message
                                    }));
                                    break;

                                case 'chunk':
                                    fullText += data.text;
                                    // Try to parse partial result
                                    try {
                                        // Count complete days from raw JSON
                                        const dayMatches = fullText.match(/"day"\s*:\s*"[^"]+"/g) || [];
                                        setState(prev => ({
                                            ...prev,
                                            currentDay: Math.max(prev.currentDay, dayMatches.length)
                                        }));
                                    } catch {
                                        // Ignore parse errors for partial JSON
                                    }
                                    break;

                                case 'complete':
                                    finalPlan = data.data as WeeklyPlan;
                                    setState(prev => ({
                                        ...prev,
                                        isStreaming: false,
                                        currentDay: 7,
                                        progress: 'Complete!'
                                    }));
                                    break;

                                case 'error':
                                    throw new Error(data.message);
                            }
                        } catch (parseError) {
                            // Ignore individual parse errors
                        }
                    }
                }
            }

            return finalPlan;
        } catch (error: any) {
            setState(prev => ({
                ...prev,
                isStreaming: false,
                error: error.message || 'Streaming failed'
            }));
            return null;
        }
    }, []);

    return {
        ...state,
        generateWithStreaming,
        reset
    };
}

export default useStreamingGeneration;
