<template>
  <div class="knowledge-page">
    <div class="mb-8 flex justify-between items-center">
      <div>
        <h2 class="text-2xl font-bold text-black dark:text-white mb-2">知识库管理</h2>
        <p class="text-gray-600 dark:text-gray-300">上传法律词典等参考文档，增强翻译质量</p>
      </div>
      <button
        @click="showUploadModal = true"
        class="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
      >
        + 上传文档
      </button>
    </div>

    <!-- Knowledge Bases List -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div
        v-for="kb in knowledgeBases"
        :key="kb.id"
        class="border-2 border-gray-200 dark:border-gray-700 rounded-xl p-6 hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
      >
        <div class="flex items-start justify-between mb-4">
          <div class="flex-1">
            <div class="flex items-center space-x-2 mb-2">
              <h3 class="text-lg font-bold">{{ kb.name }}</h3>
              <span v-if="kb.isPublic" class="px-2 py-0.5 text-[10px] rounded bg-blue-100 text-blue-700">共享</span>
            </div>
            <p v-if="kb.description" class="text-sm text-gray-600 dark:text-gray-300 mb-3">
              {{ kb.description }}
            </p>
          </div>
        </div>

        <div class="space-y-2 text-sm mb-4">
          <div class="flex justify-between">
            <span class="text-gray-500 dark:text-gray-400">文件名:</span>
            <span class="text-gray-800 dark:text-gray-200">{{ kb.fileName }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-500 dark:text-gray-400">文件大小:</span>
            <span class="text-gray-800 dark:text-gray-200">{{ formatFileSize(kb.fileSize) }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-500 dark:text-gray-400">分块数量:</span>
            <span class="text-gray-800 dark:text-gray-200">{{ kb.chunkCount }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-500 dark:text-gray-400">创建时间:</span>
            <span class="text-gray-800 dark:text-gray-200">{{ formatDate(kb.createdAt) }}</span>
          </div>
        </div>

        <div class="flex gap-2">
          <button
            @click="toggleKb(kb.id)"
            class="flex-1 px-3 py-2 text-sm border-2 border-gray-300 rounded-lg hover:border-black transition-colors"
          >
            {{ kb.enabled === false ? '启用' : '禁用' }}
          </button>
          <button
            @click="handleDelete(kb.id)"
            class="flex-1 px-3 py-2 text-sm border-2 border-red-300 text-red-600 rounded-lg hover:border-red-500 transition-colors"
          >
            删除
          </button>
        </div>
      </div>

      <div v-if="knowledgeBases.length === 0" class="col-span-full text-center py-12 text-gray-500 dark:text-gray-400">
        暂无知识库，点击右上角按钮上传文档
      </div>
    </div>

    <!-- Upload Modal -->
    <div
      v-if="showUploadModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click.self="closeModal"
    >
      <div class="bg-white dark:bg-zinc-900 rounded-xl p-8 max-w-lg w-full">
        <h3 class="text-xl font-bold mb-6">上传知识库文档</h3>

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-2">名称</label>
            <input
              v-model="uploadForm.name"
              type="text"
              class="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 dark:bg-zinc-900 dark:text-gray-100 rounded-lg focus:border-black dark:focus:border-white focus:outline-none"
              placeholder="例如: 法律英语词典"
            />
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">描述 (可选)</label>
            <textarea
              v-model="uploadForm.description"
              rows="3"
              class="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 dark:bg-zinc-900 dark:text-gray-100 rounded-lg focus:border-black dark:focus:border-white focus:outline-none"
              placeholder="描述这个知识库的内容..."
            ></textarea>
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">嵌入模型</label>
            <select
              v-model="uploadForm.embeddingModelId"
              class="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 dark:bg-zinc-900 dark:text-gray-100 rounded-lg focus:border-black dark:focus:border-white focus:outline-none"
            >
              <option value="">请选择嵌入模型</option>
              <option
                v-for="model in embeddingModels"
                :key="model.id"
                :value="model.id"
              >
                {{ model.name }}
              </option>
            </select>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              如果没有可用的嵌入模型，请先在"模型配置"页面添加
            </p>
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">文件</label>
            <input
              ref="fileInput"
              type="file"
              accept=".txt,.pdf,.docx,.md"
              @change="handleFileChange"
              class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-black focus:outline-none"
            />
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              支持格式: TXT, PDF, DOCX, MD (最大 10MB)
            </p>
          </div>
        </div>

        <div class="flex space-x-4 mt-6">
          <button
            @click="handleUpload"
            class="flex-1 bg-black text-white py-2 rounded-lg hover:bg-gray-800 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            :disabled="!isUploadFormValid || uploading"
          >
            <span v-if="!uploading">上传</span>
            <span v-else class="flex items-center justify-center">
              <span class="spinner mr-2"></span>
              上传中...
            </span>
          </button>
          <button
            @click="closeModal"
            class="flex-1 border-2 border-gray-300 dark:border-gray-600 py-2 rounded-lg hover:border-black dark:hover:border-white transition-colors"
            :disabled="uploading"
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
import { useKnowledgeStore } from '@/stores/knowledgeStore';
import { useModelStore } from '@/stores/modelStore';
import { useAuthStore } from '@/stores/authStore';

const knowledgeStore = useKnowledgeStore();
const modelStore = useModelStore();
const authStore = useAuthStore();
const currentUserId = computed(() => authStore.user?.id);

const showUploadModal = ref(false);
const uploading = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const selectedFile = ref<File | null>(null);

const uploadForm = ref({
  name: '',
  description: '',
  embeddingModelId: ''
});

const knowledgeBases = computed(() => knowledgeStore.knowledgeBases);
const embeddingModels = computed(() => modelStore.enabledEmbeddingModels);

const isUploadFormValid = computed(() => {
  return uploadForm.value.name.trim() !== '' &&
    uploadForm.value.embeddingModelId !== '' &&
    selectedFile.value !== null;
});

const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    selectedFile.value = target.files[0];
  }
};

const handleUpload = async () => {
  if (!isUploadFormValid.value || !selectedFile.value) return;

  uploading.value = true;
  try {
    await knowledgeStore.createKnowledgeBase(
      {
        name: uploadForm.value.name,
        description: uploadForm.value.description || undefined,
        embeddingModelId: uploadForm.value.embeddingModelId
      },
      selectedFile.value
    );
    closeModal();
  } catch (err) {
    console.error('Failed to upload:', err);
    alert('上传失败: ' + (err instanceof Error ? err.message : '未知错误'));
  } finally {
    uploading.value = false;
  }
};

const handleDelete = async (id: string) => {
  if (confirm('确定要删除这个知识库吗？')) {
    try {
      await knowledgeStore.deleteKnowledgeBase(id);
    } catch (err) {
      console.error('Failed to delete:', err);
      alert('删除失败: ' + (err instanceof Error ? err.message : '未知错误'));
    }
  }
};

const toggleKb = async (id: string) => {
  try {
    await knowledgeStore.toggleKnowledgeBase(id);
  } catch {}
};

const closeModal = () => {
  showUploadModal.value = false;
  uploadForm.value = {
    name: '',
    description: '',
    embeddingModelId: ''
  };
  selectedFile.value = null;
  if (fileInput.value) {
    fileInput.value.value = '';
  }
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('zh-CN') + ' ' + date.toLocaleTimeString('zh-CN');
};
</script>
