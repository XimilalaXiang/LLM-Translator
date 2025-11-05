import { defineStore } from 'pinia';
import { ref } from 'vue';
import { translationApi } from '@/api';
import type { TranslationRequest, TranslationResponse, TranslationProgressStart, TranslationProgressReview } from '@/types';

export const useTranslationStore = defineStore('translation', () => {
  const currentTranslation = ref<TranslationResponse | null>(null);
  const history = ref<TranslationResponse[]>([]);
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
    loading,
    error,
    translate,
    fetchHistory,
    loadTranslation,
    clearCurrent
  };
});
