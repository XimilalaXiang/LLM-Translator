<template>
  <div class="space-y-8">
    <h2 class="text-2xl font-bold">管理员面板</h2>

    <div class="p-4 border border-gray-300 dark:border-gray-700 rounded-md">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-lg font-medium">启用登录注册</p>
          <p class="text-sm text-gray-600 dark:text-gray-400">开启后，访问站点需先登录；历史记录将按账号隔离。</p>
        </div>
        <label class="inline-flex items-center cursor-pointer">
          <input type="checkbox" class="sr-only" :checked="store.authEnabled" @change="onToggleAuth" />
          <div class="w-11 h-6 bg-gray-200 dark:bg-gray-700 rounded-full peer-focus:outline-none peer-checked:bg-black dark:peer-checked:bg-white relative">
            <div :class="['absolute top-0.5 left-0.5 w-5 h-5 bg-white dark:bg-black rounded-full transition-transform', store.authEnabled ? 'translate-x-5' : '']"></div>
          </div>
        </label>
      </div>
    </div>

    <div v-if="store.authEnabled" class="p-4 border border-gray-300 dark:border-gray-700 rounded-md">
      <h3 class="text-lg font-medium mb-3">首次创建管理员</h3>
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">当系统没有管理员时，可在此创建首个管理员账号。</p>
      <form @submit.prevent="bootstrap">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <input v-model="username" placeholder="管理员用户名" class="input" />
          <input v-model="password" placeholder="管理员密码（≥6位）" type="password" class="input" />
        </div>
        <div class="mt-4 flex items-center gap-3">
          <button class="px-4 py-2 border-2 border-black dark:border-white rounded-md hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors">创建管理员</button>
          <span v-if="message" class="text-sm" :class="messageType === 'ok' ? 'text-green-600' : 'text-red-600'">{{ message }}</span>
        </div>
      </form>
    </div>
  </div>
  
  <div class="p-4 border border-red-300 dark:border-red-700 rounded-md">
    <h3 class="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">危险操作</h3>
    <p class="text-sm text-gray-700 dark:text-gray-300 mb-3">清空所有 AI 模型配置（可选同时清空知识库）。启用登录后仅管理员可执行。</p>
    <div class="flex items-center gap-3 mb-3">
      <label class="inline-flex items-center gap-2 text-sm">
        <input type="checkbox" v-model="deleteKB" class="mr-1" /> 同时清空知识库
      </label>
    </div>
    <button @click="resetModels" class="px-4 py-2 border-2 border-red-600 text-red-600 rounded-md hover:bg-red-600 hover:text-white transition-colors">清空模型配置</button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAuthStore } from '@/stores/authStore';
import { adminApi } from '@/api';

const store = useAuthStore();
const username = ref('');
const password = ref('');
const message = ref('');
const messageType = ref<'ok' | 'err'>('ok');
const deleteKB = ref(true);

onMounted(async () => {
  await store.fetchStatus();
});

async function onToggleAuth(e: Event) {
  const target = e.target as HTMLInputElement;
  const ok = await store.toggleAuthEnabled(target.checked);
  if (!ok) {
    message.value = '切换失败';
    messageType.value = 'err';
  } else {
    message.value = '已更新设置';
    messageType.value = 'ok';
  }
}

async function resetModels() {
  const ok = confirm('确定要清空所有模型配置吗？此操作不可恢复！');
  if (!ok) return;
  try {
    const res = await adminApi.resetModels(deleteKB.value);
    if ((res as any)?.success) {
      message.value = '已清空模型配置';
      messageType.value = 'ok';
    } else {
      message.value = (res as any)?.error || '清空失败';
      messageType.value = 'err';
    }
  } catch (e: any) {
    message.value = e?.message || '清空失败';
    messageType.value = 'err';
  }
}
async function bootstrap() {
  if (!username.value || password.value.length < 6) {
    message.value = '请输入有效的用户名与密码';
    messageType.value = 'err';
    return;
  }
  const ok = await store.bootstrapAdmin(username.value.trim(), password.value);
  if (ok) {
    message.value = '管理员创建成功';
    messageType.value = 'ok';
    await store.fetchStatus();
  } else {
    message.value = '创建失败或管理员已存在';
    messageType.value = 'err';
  }
}
</script>

<style scoped>
.input { @apply w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-md bg-transparent outline-none focus:border-black dark:focus:border-white; }
</style>


