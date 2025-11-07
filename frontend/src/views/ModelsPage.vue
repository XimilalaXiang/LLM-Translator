<template>
  <div class="models-page">
    <div class="mb-8 flex justify-between items-center">
      <div>
        <h2 class="text-2xl font-bold text-black dark:text-white mb-2">模型配置</h2>
        <p class="text-gray-600 dark:text-gray-300">管理翻译、审核、综合和嵌入模型</p>
      </div>
      <button
        @click="openCreateModal()"
        class="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
      >
        + 添加模型
      </button>
    </div>

    <!-- Model Tabs -->
    <div class="border-b border-gray-300 dark:border-gray-700 mb-6">
      <div class="flex space-x-1">
        <button
          v-for="stage in stages"
          :key="stage.value"
          @click="currentStage = stage.value"
          :class="[
            'px-4 py-2 font-medium text-sm rounded-t-lg transition-colors',
            currentStage === stage.value
              ? 'bg-black text-white'
              : 'text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
          ]"
        >
          {{ stage.label }}
        </button>
      </div>
    </div>

    <!-- Models List -->
    <div class="space-y-4">
      <div
        v-for="model in filteredModels"
        :key="model.id"
        class="border-2 border-gray-200 dark:border-gray-700 rounded-xl p-6 hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
      >
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <div class="flex items-center space-x-3 mb-3">
              <h3 class="text-lg font-bold">{{ model.name }}</h3>
              <span v-if="model.isPublic" class="px-2 py-0.5 text-[10px] rounded bg-blue-100 text-blue-700">共享</span>
              <span
                :class="[
                  'px-2 py-1 text-xs font-medium rounded',
                  model.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                ]"
              >
                {{ model.enabled ? '已启用' : '已禁用' }}
              </span>
            </div>

            <div class="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span class="text-gray-500 dark:text-gray-400">API端点:</span>
                <span class="ml-2 text-gray-800 dark:text-gray-200">{{ model.apiEndpoint }}</span>
              </div>
              <div>
                <span class="text-gray-500 dark:text-gray-400">模型ID:</span>
                <span class="ml-2 text-gray-800 dark:text-gray-200">{{ model.modelId }}</span>
              </div>
              <div v-if="model.stage !== 'embedding'">
                <span class="text-gray-500 dark:text-gray-400">温度:</span>
                <span class="ml-2 text-gray-800 dark:text-gray-200">{{ model.temperature ?? '默认' }}</span>
              </div>
              <div v-if="model.stage !== 'embedding'">
                <span class="text-gray-500 dark:text-gray-400">最大Token:</span>
                <span class="ml-2 text-gray-800 dark:text-gray-200">{{ model.maxTokens ?? '默认' }}</span>
              </div>
            </div>

            <div class="mt-3" v-if="model.stage !== 'embedding' && model.systemPrompt">
              <span class="text-gray-500 dark:text-gray-400 text-sm">系统提示词:</span>
              <p class="text-gray-800 dark:text-gray-200 text-sm mt-1 line-clamp-2">{{ model.systemPrompt }}</p>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center space-x-2 ml-4">
            <button
              @click="handleTest(model.id)"
              class="px-3 py-1 text-sm border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:border-black dark:hover:border-white transition-colors"
              :disabled="testing === model.id"
            >
              {{ testing === model.id ? '测试中...' : '测试' }}
            </button>
            <button
              @click="handleToggle(model.id)"
              class="px-3 py-1 text-sm border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:border-black dark:hover:border-white transition-colors"
            >
              {{ model.enabled ? '禁用' : '启用' }}
            </button>
            <button
              @click="handleEdit(model)"
              class="px-3 py-1 text-sm border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:border-black dark:hover:border-white transition-colors"
            >
              编辑
            </button>
            <button
              @click="handleDelete(model.id)"
              class="px-3 py-1 text-sm border-2 border-red-300 text-red-600 rounded-lg hover:border-red-500 transition-colors"
            >
              删除
            </button>
          </div>
        </div>
      </div>

      <div v-if="filteredModels.length === 0" class="text-center py-12 text-gray-500 dark:text-gray-400">
        暂无{{ stageLabel }}模型
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <div
      v-if="showCreateModal || editingModel"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click.self="closeModal"
    >
      <div class="bg-white dark:bg-zinc-900 rounded-xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h3 class="text-xl font-bold mb-6">
          {{ editingModel ? '编辑模型' : '添加模型' }}
        </h3>

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-2">名称</label>
            <input
              v-model="formData.name"
              type="text"
              class="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 dark:bg-zinc-900 dark:text-gray-100 rounded-lg focus:border-black dark:focus:border-white focus:outline-none"
              placeholder="例如: GPT-4"
            />
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">阶段</label>
            <select
              v-model="formData.stage"
              class="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 dark:bg-zinc-900 dark:text-gray-100 rounded-lg focus:border-black dark:focus:border-white focus:outline-none"
            >
              <option value="translation">翻译模型</option>
              <option value="review">审核模型</option>
              <option value="synthesis">综合模型</option>
              <option value="embedding">嵌入模型</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">API端点</label>
            <input
              v-model="formData.apiEndpoint"
              type="url"
              class="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 dark:bg-zinc-900 dark:text-gray-100 rounded-lg focus:border-black dark:focus:border-white focus:outline-none"
              :placeholder="formData.stage === 'embedding' ? 'https://api.openai.com/v1/embeddings' : 'https://api.openai.com/v1/chat/completions'"
            />
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">API Key</label>
            <input
              v-model="formData.apiKey"
              type="password"
              class="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 dark:bg-zinc-900 dark:text-gray-100 rounded-lg focus:border-black dark:focus:border-white focus:outline-none"
              :placeholder="editingModel ? '留空保持不变' : 'sk-...'"
            />
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">模型ID</label>
            <input
              v-model="formData.modelId"
              type="text"
              class="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 dark:bg-zinc-900 dark:text-gray-100 rounded-lg focus:border-black dark:focus:border-white focus:outline-none"
              placeholder="gpt-4"
            />
          </div>

          <div v-if="formData.stage !== 'embedding'">
            <label class="block text-sm font-medium mb-2">系统提示词（留空将使用默认）</label>
            <textarea
              v-model="formData.systemPrompt"
              rows="4"
              class="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 dark:bg-zinc-900 dark:text-gray-100 rounded-lg focus:border-black dark:focus:border-white focus:outline-none"
              placeholder="你是一个专业的法律翻译...（可留空使用默认提示词）"
            ></textarea>
          </div>

          <div class="grid grid-cols-2 gap-4" v-if="formData.stage !== 'embedding'">
            <div>
              <label class="block text-sm font-medium mb-2">温度 (可选)</label>
              <input
                v-model.number="formData.temperature"
                type="number"
                step="0.1"
                min="0"
                max="2"
                class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-black focus:outline-none"
                placeholder="0.7"
              />
            </div>
            <div>
              <label class="block text.sm font-medium mb-2">最大Token (可选)</label>
              <input
                v-model.number="formData.maxTokens"
                type="number"
                class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-black focus:outline-none"
                placeholder="2000"
              />
            </div>
          </div>
        </div>

        <div class="flex space-x-4 mt-6">
          <button
            @click="handleSave"
            class="flex-1 bg-black text-white py-2 rounded-lg hover:bg-gray-800 transition-colors"
            :disabled="!isFormValid"
          >
            {{ editingModel ? '保存' : '创建' }}
          </button>
          <button
            @click="closeModal"
            class="flex-1 border-2 border-gray-300 dark:border-gray-600 py-2 rounded-lg hover:border-black dark:hover:border-white transition-colors"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useModelStore } from '@/stores/modelStore';
import { useAuthStore } from '@/stores/authStore';
import type { ModelConfig, CreateModelConfigDto } from '@/types';

const modelStore = useModelStore();
const authStore = useAuthStore();
const currentUserId = computed(() => authStore.user?.id);

const stages = [
  { value: 'translation', label: '翻译模型' },
  { value: 'review', label: '审核模型' },
  { value: 'synthesis', label: '综合模型' },
  { value: 'embedding', label: '嵌入模型' }
];

const currentStage = ref<'translation' | 'review' | 'synthesis' | 'embedding'>('translation');
const showCreateModal = ref(false);
const editingModel = ref<ModelConfig | null>(null);
const testing = ref<string | null>(null);

const formData = ref<CreateModelConfigDto>({
  name: '',
  stage: 'translation',
  apiEndpoint: '',
  apiKey: '',
  modelId: '',
  systemPrompt: '',
  temperature: undefined,
  maxTokens: undefined
});

const filteredModels = computed(() => {
  return modelStore.models.filter(m => m.stage === currentStage.value);
});

const stageLabel = computed(() => {
  return stages.find(s => s.value === currentStage.value)?.label || '';
});

const isFormValid = computed(() => {
  const base = formData.value.name.trim() !== '' &&
    formData.value.apiEndpoint.trim() !== '' &&
    formData.value.modelId.trim() !== '';
  if (editingModel.value) {
    // Editing: API Key 可留空表示不修改
    return base;
  }
  // Creating: API Key 必填
  return base && formData.value.apiKey?.trim() !== '';
});

const handleEdit = (model: ModelConfig) => {
  editingModel.value = model;
  formData.value = {
    name: model.name,
    stage: model.stage,
    apiEndpoint: model.apiEndpoint,
    apiKey: '', // 不回显，留空表示保持不变
    modelId: model.modelId,
    systemPrompt: model.systemPrompt,
    temperature: model.temperature,
    maxTokens: model.maxTokens
  };
};

const openCreateModal = () => {
  formData.value.stage = currentStage.value;
  showCreateModal.value = true;
};

const handleSave = async () => {
  try {
    if (editingModel.value) {
      const payload: any = { ...formData.value };
      if (!payload.apiKey || payload.apiKey.trim() === '') {
        delete payload.apiKey; // 留空则不修改后端存储的密钥
      }
      await modelStore.updateModel(editingModel.value.id, payload);
    } else {
      await modelStore.createModel(formData.value);
    }
    closeModal();
  } catch (err) {
    console.error('Failed to save model:', err);
  }
};

const handleDelete = async (id: string) => {
  if (confirm('确定要删除这个模型吗？')) {
    try {
      await modelStore.deleteModel(id);
    } catch (err) {
      console.error('Failed to delete model:', err);
    }
  }
};

const handleToggle = async (id: string) => {
  try {
    await modelStore.toggleModel(id);
  } catch (err) {
    console.error('Failed to toggle model:', err);
  }
};

const handleTest = async (id: string) => {
  testing.value = id;
  try {
    const result = await modelStore.testModel(id);
    alert(result ? '连接成功！' : '连接失败，请检查配置。');
  } catch (err) {
    alert('测试失败：' + (err instanceof Error ? err.message : '未知错误'));
  } finally {
    testing.value = null;
  }
};

const closeModal = () => {
  showCreateModal.value = false;
  editingModel.value = null;
  formData.value = {
    name: '',
    stage: currentStage.value,
    apiEndpoint: '',
    apiKey: '',
    modelId: '',
    systemPrompt: '',
    temperature: undefined,
    maxTokens: undefined
  };
};
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
