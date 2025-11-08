import { defineStore } from 'pinia';
import { ref } from 'vue';
import { translationApi } from '@/api';
import type { TranslationRequest, TranslationResponse, TranslationProgressStart, TranslationProgressReview } from '@/types';

export const useTranslationStore = defineStore('translation', () => {
  const currentTranslation = ref<TranslationResponse | null>(null);
  const history = ref<TranslationResponse[]>([]);
  const searchResults = ref<TranslationResponse[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function translate(request: TranslationRequest) {
    loading.value = true;
    error.value = null;
    try {
      currentTranslation.value = null;

      // Stage 1
      const startRes = await translationApi.progressStart(request);
      if (!startRes.success || !startRes.data) throw new Error(startRes.error || 'Stage 1 failed');
      const startData = startRes.data as TranslationProgressStart;

      currentTranslation.value = {
        id: '',
        sourceText: startData.sourceText,
        stage1Results: startData.stage1Results || [],
        stage2Results: [],
        stage3Results: [],
        totalDuration: 0,
        createdAt: new Date().toISOString()
      } as TranslationResponse;

      // Stage 2
      const reviewRes = await translationApi.progressReview({
        sourceText: startData.sourceText,
        stage1Results: startData.stage1Results,
        knowledgeContext: startData.knowledgeContext,
        modelIds: request.modelIds
      });
      if (reviewRes.success && reviewRes.data) {
        const reviewData = reviewRes.data as TranslationProgressReview;
        if (currentTranslation.value) currentTranslation.value.stage2Results = reviewData.stage2Results || [];
      }

      // Stage 3
      const synthRes = await translationApi.progressSynthesis({
        sourceText: startData.sourceText,
        stage1Results: startData.stage1Results,
        stage2Results: currentTranslation.value?.stage2Results || [],
        knowledgeContext: startData.knowledgeContext,
        modelIds: request.modelIds
      });
      if (synthRes.success && synthRes.data) {
        currentTranslation.value = synthRes.data;
      }
      return currentTranslation.value;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Translation failed';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // Streaming translation: show each model's output as soon as it finishes
  async function translateLive(request: TranslationRequest) {
    loading.value = true;
    error.value = null;
    currentTranslation.value = {
      id: '',
      sourceText: request.sourceText,
      stage1Results: [],
      stage2Results: [],
      stage3Results: [],
      totalDuration: 0,
      createdAt: new Date().toISOString()
    } as TranslationResponse;

    // helper: POST SSE and parse events
    async function postSSE(path: string, payload: any, onEvent: (evt: { event: string; data: any }) => void) {
      const res = await fetch('/api' + path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify(payload),
        credentials: 'include'
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const raw = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          // parse simple SSE block
          let event = 'message';
          const dataLines: string[] = [];
          for (const line of raw.split('\n')) {
            if (line.startsWith('event:')) event = line.slice(6).trim();
            else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
          }
          const dataStr = dataLines.join('\n');
          let data: any = null;
          try { data = JSON.parse(dataStr); } catch { data = dataStr; }
          onEvent({ event, data });
        }
      }
    }

    try {
      // Stage 1 stream
      let knowledgeContext: string[] = [];
      const stage1Results: any[] = [];
      await postSSE('/translations/progress/start/stream', request, ({ event, data }) => {
        if (event === 'init') {
          knowledgeContext = data.knowledgeContext || [];
          if (currentTranslation.value) currentTranslation.value.sourceText = request.sourceText;
        } else if (event === 'stage1Result') {
          stage1Results.push(data);
          if (currentTranslation.value) currentTranslation.value.stage1Results = [...stage1Results];
        }
      });

      // Stage 2 stream
      const stage2Results: any[] = [];
      await postSSE('/translations/progress/review/stream', {
        sourceText: request.sourceText,
        stage1Results,
        knowledgeContext,
        modelIds: request.modelIds
      }, ({ event, data }) => {
        if (event === 'stage2Result') {
          stage2Results.push(data);
          if (currentTranslation.value) currentTranslation.value.stage2Results = [...stage2Results];
        }
      });

      // Stage 3 stream
      const stage3Results: any[] = [];
      await postSSE('/translations/progress/synthesis/stream', {
        sourceText: request.sourceText,
        stage1Results,
        stage2Results,
        knowledgeContext,
        modelIds: request.modelIds
      }, ({ event, data }) => {
        if (event === 'stage3Result') {
          stage3Results.push(data);
          if (currentTranslation.value) currentTranslation.value.stage3Results = [...stage3Results];
        } else if (event === 'done') {
          currentTranslation.value = data as TranslationResponse;
        }
      });

      return currentTranslation.value;
    } catch (err: any) {
      error.value = err?.message || 'Translation failed';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function fetchHistory(limit?: number) {
    try {
      const response = await translationApi.getHistory(limit);
      if (response.success && response.data) {
        history.value = response.data;
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  }

  async function searchHistory(q: string, limit?: number) {
    try {
      if (!q.trim()) {
        searchResults.value = [];
        return [] as TranslationResponse[];
      }
      const response = await translationApi.searchHistory(q, limit);
      if (response.success && response.data) {
        searchResults.value = response.data;
        return response.data;
      }
      return [] as TranslationResponse[];
    } catch (err) {
      console.error('Failed to search history:', err);
      return [] as TranslationResponse[];
    }
  }

  async function loadTranslation(id: string) {
    try {
      const response = await translationApi.getById(id);
      if (response.success && response.data) {
        currentTranslation.value = response.data;
        return response.data;
      }
    } catch (err) {
      console.error('Failed to load translation:', err);
    }
  }

  function clearCurrent() {
    currentTranslation.value = null;
    error.value = null;
  }

  return {
    currentTranslation,
    history,
    searchResults,
    loading,
    error,
    translate,
    translateLive,
    fetchHistory,
    searchHistory,
    loadTranslation,
    clearCurrent
  };
});
