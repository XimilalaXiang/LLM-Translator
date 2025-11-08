import { defineStore } from 'pinia';
import { ref } from 'vue';
import { knowledgeApi } from '@/api';
import type { KnowledgeBase, CreateKnowledgeBaseDto } from '@/types';

export const useKnowledgeStore = defineStore('knowledge', () => {
  const knowledgeBases = ref<KnowledgeBase[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const kbStatus = ref<Record<string, { ready: boolean; total: number; processed: number }>>({});

  async function fetchKnowledgeBases() {
    loading.value = true;
    error.value = null;
    try {
      const response = await knowledgeApi.getAll();
      if (response.success && response.data) {
        knowledgeBases.value = response.data;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch knowledge bases';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function createKnowledgeBase(data: CreateKnowledgeBaseDto, file: File) {
    loading.value = true;
    error.value = null;
    try {
      const response = await knowledgeApi.create(data, file);
      if (response.success && response.data) {
        knowledgeBases.value.push(response.data);
        // 后台构建，启动状态轮询（不阻塞）
        void pollKnowledgeStatus(response.data.id);
        return response.data;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to create knowledge base';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function deleteKnowledgeBase(id: string) {
    loading.value = true;
    error.value = null;
    try {
      const response = await knowledgeApi.delete(id);
      if (response.success) {
        knowledgeBases.value = knowledgeBases.value.filter(kb => kb.id !== id);
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to delete knowledge base';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function toggleKnowledgeBase(id: string) {
    const kb = knowledgeBases.value.find(k => k.id === id);
    if (!kb) return;
    const next = !(kb.enabled !== false);
    await knowledgeApi.setPreference(id, next);
    kb.enabled = next;
  }

  function getKnowledgeBaseById(id: string) {
    return knowledgeBases.value.find(kb => kb.id === id);
  }

  async function pollKnowledgeStatus(id: string, intervalMs = 5000, maxTries = 120) {
    let tries = 0;
    while (tries < maxTries) {
      try {
        const res = await knowledgeApi.getStatus(id);
        if (res.success && res.data) {
          kbStatus.value[id] = res.data;
          if (res.data.ready) break;
        }
      } catch {
        // 忽略单次查询失败，继续下一次
      }
      await new Promise(resolve => setTimeout(resolve, intervalMs));
      tries++;
    }
  }

  return {
    knowledgeBases,
    loading,
    error,
    kbStatus,
    fetchKnowledgeBases,
    createKnowledgeBase,
    deleteKnowledgeBase,
    getKnowledgeBaseById,
    toggleKnowledgeBase,
    pollKnowledgeStatus
  };
});
