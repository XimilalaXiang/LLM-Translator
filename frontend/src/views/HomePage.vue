<template>
  <div class="home-page">
    <div class="max-w-4xl mx-auto">
      <!-- Title -->
      <div class="mb-8">
        <h2 class="text-2xl font-bold text-black dark:text-white mb-2">法律英语翻译</h2>
        <p class="text-gray-600 dark:text-gray-300">输入法律英语文本，系统将通过三阶段工作流生成专业译文</p>
      </div>

      <!-- Input Section -->
      <div class="mb-6">
        <div class="bg-white dark:bg-zinc-900 border-2 border-black dark:border-gray-700 rounded-2xl p-6">
          <textarea
            v-model="sourceText"
            placeholder="请输入法律英语文本..."
            class="w-full h-40 resize-none border-0 focus:outline-none text-base bg-transparent dark:text-gray-100"
          ></textarea>

          <!-- Options -->
          <div class="mt-4 pt-4 border-t border-gray-200">
            <div class="flex items-center space-x-4 mb-4">
              <label class="flex items-center space-x-2">
                <input
                  v-model="useKnowledgeBase"
                  type="checkbox"
                  class="w-4 h-4 border-2 border-black rounded"
                />
                <span class="text-sm">使用知识库增强</span>
              </label>

              <!-- Knowledge Base Selection -->
              <div v-if="useKnowledgeBase && knowledgeBases.length > 0" class="flex-1">
                <select
                  v-model="selectedKnowledgeBases"
                  multiple
                  class="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-zinc-900 text-black dark:text-gray-100 focus:border-black dark:focus:border-white"
                >
                  <option
                    v-for="kb in knowledgeBases"
                    :key="kb.id"
                    :value="kb.id"
                  >
                    {{ kb.name }}
                  </option>
                </select>
              </div>
            </div>

            <!-- Submit Button -->
            <button
              @click="handleTranslate"
              :disabled="!sourceText.trim() || loading"
              class="w-full bg-black text-white py-3 rounded-lg font-medium hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              <span v-if="!loading">开始翻译</span>
              <span v-else class="flex items-center justify-center">
                <span class="spinner mr-2"></span>
                翻译中...
              </span>
            </button>
          </div>
        </div>
      </div>

      <!-- Results Section -->
      <div v-if="currentTranslation" class="space-y-6">
        <!-- Stage 1: Translation Results -->
        <div class="bg-white dark:bg-zinc-900 border-2 border-gray-200 dark:border-gray-700 rounded-xl p-6">
          <h3 class="text-lg font-bold mb-4 flex items-center">
            <span class="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center mr-3 text-sm">1</span>
            初始翻译
          </h3>
          <div class="space-y-4">
            <div
              v-for="result in currentTranslation.stage1Results"
              :key="result.modelId"
              class="border border-gray-300 rounded-lg p-4"
            >
              <div class="flex items-center justify-between mb-2">
                <span class="font-medium text-sm">{{ result.modelName }}</span>
                <span class="text-xs text-gray-500">{{ result.duration }}ms</span>
              </div>
              <div v-if="!result.error" class="prose prose-sm max-w-none text-gray-800 dark:prose-invert dark:text-gray-100" v-html="renderMd(result.output)"></div>
              <p v-else class="text-red-500 text-sm">错误: {{ result.error }}</p>
            </div>
          </div>
        </div>

        <!-- Stage 2: Review Results -->
        <div
          v-if="currentTranslation.stage2Results.length > 0"
          class="bg-white dark:bg-zinc-900 border-2 border-gray-200 dark:border-gray-700 rounded-xl p-6"
        >
          <h3 class="text-lg font-bold mb-4 flex items-center">
            <span class="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center mr-3 text-sm">2</span>
            审核评价
          </h3>
          <div class="space-y-4">
            <div
              v-for="result in currentTranslation.stage2Results"
              :key="`${result.modelId}-${result.translationModelId}`"
              class="border border-gray-300 rounded-lg p-4"
            >
              <div class="flex items-center justify-between mb-2">
                <span class="font-medium text-sm">
                  {{ result.modelName }} 评价 "{{ getModelName(result.translationModelId) }}"
                </span>
                <span class="text-xs text-gray-500">{{ result.duration }}ms</span>
              </div>
              <div v-if="!result.error" class="prose prose-sm max-w-none text-gray-800 dark:prose-invert dark:text-gray-100" v-html="renderMd(result.output)"></div>
              <p v-else class="text-red-500 text-sm">错误: {{ result.error }}</p>
            </div>
          </div>
        </div>

        <!-- Stage 3: Synthesis Results -->
        <div
          v-if="currentTranslation.stage3Results.length > 0"
          class="bg-white dark:bg-zinc-900 border-2 border-gray-200 dark:border-gray-700 rounded-xl p-6"
        >
          <h3 class="text-lg font-bold mb-4 flex items-center">
            <span class="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center mr-3 text-sm">3</span>
            综合翻译
          </h3>
          <div class="space-y-4">
            <div
              v-for="result in currentTranslation.stage3Results"
              :key="result.modelId"
              class="border border-gray-300 rounded-lg p-4"
            >
              <div class="flex items-center justify-between mb-2">
                <span class="font-medium text-sm">{{ result.modelName }}</span>
                <span class="text-xs text-gray-500">{{ result.duration }}ms</span>
              </div>
              <div v-if="!result.error" class="prose prose-sm max-w-none text-gray-800 dark:prose-invert dark:text-gray-100" v-html="renderMd(result.output)"></div>
              <p v-else class="text-red-500 text-sm">错误: {{ result.error }}</p>
            </div>
          </div>
        </div>

        <!-- Final Translation -->
        <div v-if="currentTranslation.finalTranslation" class="bg-black text-white rounded-xl p-6">
          <h3 class="text-lg font-bold mb-4">最终译文</h3>
          <div class="prose prose-invert max-w-none" v-html="renderMd(currentTranslation.finalTranslation)"></div>
          <div class="mt-4 pt-4 border-t border-gray-700 text-sm text-gray-300">
            总耗时: {{ currentTranslation.totalDuration }}ms
          </div>
        </div>
      </div>

      <!-- Error Display -->
      <div v-if="error" class="bg-red-50 dark:bg-red-900 border-2 border-red-500 dark:border-red-600 rounded-xl p-4 text-red-800 dark:text-red-100">
        {{ error }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';
import { useTranslationStore } from '@/stores/translationStore';
import { useKnowledgeStore } from '@/stores/knowledgeStore';
import { useModelStore } from '@/stores/modelStore';

const translationStore = useTranslationStore();
const knowledgeStore = useKnowledgeStore();
const modelStore = useModelStore();

const sourceText = ref('');
const useKnowledgeBase = ref(false);
const selectedKnowledgeBases = ref<string[]>([]);

const loading = computed(() => translationStore.loading);
const error = computed(() => translationStore.error);
const currentTranslation = computed(() => translationStore.currentTranslation);
const knowledgeBases = computed(() => knowledgeStore.knowledgeBases.filter(k => k.enabled !== false));

const getModelName = (modelId: string) => {
  const model = modelStore.getModelById(modelId);
  return model?.name || 'Unknown Model';
};

// Markdown renderer
const md = new MarkdownIt({ breaks: true, linkify: true, typographer: true });
const normalizeMarkdown = (input: string) => {
  let out = input.replace(/\r\n/g, '\n');
  // Normalize full-width characters and excessive leading spaces before headings
  out = out.replace(/\uFF03/g, '#').replace(/\u3000/g, ' ');
  out = out.replace(/^[ \t]+(?=#)/gm, '');
  return out;
};
const renderMd = (text?: string) => {
  if (!text) return '';
  try {
    const html = md.render(normalizeMarkdown(String(text)));
    return DOMPurify.sanitize(html);
  } catch {
    return String(text);
  }
};

const handleTranslate = async () => {
  if (!sourceText.value.trim()) return;

  try {
    await translationStore.translateLive({
      sourceText: sourceText.value,
      useKnowledgeBase: useKnowledgeBase.value,
      knowledgeBaseIds: useKnowledgeBase.value ? selectedKnowledgeBases.value : undefined
    });
  } catch (err) {
    console.error('Translation failed:', err);
  }
};
</script>

<style scoped>
/* Component-specific styles */
</style>
