import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { modelApi } from '@/api';
import type { ModelConfig, CreateModelConfigDto } from '@/types';

export const useModelStore = defineStore('model', () => {
  const models = ref<ModelConfig[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const translationModels = computed(() =>
    models.value.filter(m => m.stage === 'translation')
  );

  const reviewModels = computed(() =>
    models.value.filter(m => m.stage === 'review')
  );

  const synthesisModels = computed(() =>
    models.value.filter(m => m.stage === 'synthesis')
  );

  const embeddingModels = computed(() =>
    models.value.filter(m => m.stage === 'embedding')
  );

  const enabledTranslationModels = computed(() =>
    translationModels.value.filter(m => m.enabled)
  );

  const enabledReviewModels = computed(() =>
    reviewModels.value.filter(m => m.enabled)
  );

  const enabledSynthesisModels = computed(() =>
    synthesisModels.value.filter(m => m.enabled)
  );

  const enabledEmbeddingModels = computed(() =>
    embeddingModels.value.filter(m => m.enabled)
  );

  async function fetchModels() {
    loading.value = true;
    error.value = null;
    try {
      const response = await modelApi.getAll();
      if (response.success && response.data) {
        models.value = response.data;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch models';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function createModel(data: CreateModelConfigDto) {
    loading.value = true;
    error.value = null;
    try {
      const response = await modelApi.create(data);
      if (response.success && response.data) {
        models.value.push(response.data);
        return response.data;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to create model';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function updateModel(id: string, data: Partial<CreateModelConfigDto>) {
    loading.value = true;
    error.value = null;
    try {
      const response = await modelApi.update(id, data);
      if (response.success && response.data) {
        const index = models.value.findIndex(m => m.id === id);
        if (index !== -1) {
          models.value[index] = response.data;
        }
        return response.data;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to update model';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function deleteModel(id: string) {
    loading.value = true;
    error.value = null;
    try {
      const response = await modelApi.delete(id);
      if (response.success) {
        models.value = models.value.filter(m => m.id !== id);
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to delete model';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function testModel(id: string) {
    const response = await modelApi.test(id);
    return response.data?.connected || false;
  }

  async function toggleModel(id: string) {
    const model = models.value.find(m => m.id === id);
    if (!model) return;
    // 拥有者：直接更新模型；非拥有者：设置个人偏好
    const isOwner = (model as any).ownerUserId && (model as any).ownerUserId === (window as any).__currentUserId;
    const next = !model.enabled;
    if (isOwner) {
      await updateModel(id, { enabled: next });
    } else {
      await modelApi.setPreference(id, next);
      model.enabled = next;
    }
  }

  function getModelById(id: string) {
    return models.value.find(m => m.id === id);
  }

  return {
    models,
    loading,
    error,
    translationModels,
    reviewModels,
    synthesisModels,
    embeddingModels,
    enabledTranslationModels,
    enabledReviewModels,
    enabledSynthesisModels,
    enabledEmbeddingModels,
    fetchModels,
    createModel,
    updateModel,
    deleteModel,
    testModel,
    toggleModel,
    getModelById
  };
});
