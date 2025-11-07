import { defineStore } from 'pinia';
import { ref } from 'vue';
import { knowledgeApi } from '@/api';
import type { KnowledgeBase, CreateKnowledgeBaseDto } from '@/types';

export const useKnowledgeStore = defineStore('knowledge', () => {
  const knowledgeBases = ref<KnowledgeBase[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

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

  return {
    knowledgeBases,
    loading,
    error,
    fetchKnowledgeBases,
    createKnowledgeBase,
    deleteKnowledgeBase,
    getKnowledgeBaseById,
    toggleKnowledgeBase
  };
});
