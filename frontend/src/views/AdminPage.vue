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
    <button @click="cleanupLegacy" class="ml-3 px-4 py-2 border-2 border-red-600 text-red-600 rounded-md hover:bg-red-600 hover:text-white transition-colors">清理旧共享与无归属数据</button>
  </div>

  <div class="p-4 border border-gray-300 dark:border-gray-700 rounded-md">
    <h3 class="text-lg font-semibold mb-3">我的模型共享</h3>
    <div v-if="myModels.length === 0" class="text-sm text-gray-500">暂无模型或您不是拥有者。</div>
    <div v-for="m in myModels" :key="m.id" class="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
      <div>
        <div class="font-medium text-sm">{{ m.name }}</div>
        <div class="text-xs text-gray-500">阶段：{{ m.stage }}</div>
      </div>
      <label class="inline-flex items-center cursor-pointer text-sm">
        <input type="checkbox" class="sr-only" :checked="m.isPublic" @change="() => toggleModelShare(m)" />
        <div class="w-11 h-6 bg-gray-200 dark:bg-gray-700 rounded-full relative">
          <div :class="['absolute top-0.5 left-0.5 w-5 h-5 bg-white dark:bg-black rounded-full transition-transform', m.isPublic ? 'translate-x-5' : '']"></div>
        </div>
        <span class="ml-2">{{ m.isPublic ? '已共享' : '未共享' }}</span>
      </label>
    </div>
  </div>

  <div class="p-4 border border-gray-300 dark:border-gray-700 rounded-md">
    <h3 class="text-lg font-semibold mb-3">我的知识库共享</h3>
    <div v-if="myKbs.length === 0" class="text-sm text-gray-500">暂无知识库或您不是拥有者。</div>
    <div v-for="k in myKbs" :key="k.id" class="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
      <div>
        <div class="font-medium text-sm">{{ k.name }}</div>
        <div class="text-xs text-gray-500">文件：{{ k.fileName }}</div>
      </div>
      <label class="inline-flex items-center cursor-pointer text-sm">
        <input type="checkbox" class="sr-only" :checked="k.isPublic" @change="() => toggleKbShare(k)" />
        <div class="w-11 h-6 bg-gray-200 dark:bg-gray-700 rounded-full relative">
          <div :class="['absolute top-0.5 left-0.5 w-5 h-5 bg-white dark:bg-black rounded-full transition-transform', k.isPublic ? 'translate-x-5' : '']"></div>
        </div>
        <span class="ml-2">{{ k.isPublic ? '已共享' : '未共享' }}</span>
      </label>
    </div>
  </div>

  <div class="p-4 border border-gray-300 dark:border-gray-700 rounded-md">
    <h3 class="text-lg font-semibold mb-3">用户列表</h3>
    <button @click="loadUsers" class="mb-3 px-3 py-1 border-2 border-gray-300 rounded hover:border-black">刷新</button>
    <div v-if="users.length === 0" class="text-sm text-gray-500">暂无用户</div>
    <table v-else class="w-full text-sm">
      <thead>
        <tr class="text-left border-b border-gray-200 dark:border-gray-700">
          <th class="py-2">用户名</th>
          <th class="py-2">角色</th>
          <th class="py-2">创建时间</th>
          <th class="py-2">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="u in users" :key="u.id" class="border-b border-gray-100 dark:border-gray-800">
          <td class="py-2">{{ u.username }}</td>
          <td class="py-2">{{ u.role }}</td>
          <td class="py-2">{{ formatDate(u.created_at) }}</td>
          <td class="py-2">
            <button @click="viewUserHistory(u.id)" class="px-2 py-1 border-2 border-gray-300 rounded hover:border-black">查看历史</button>
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="selectedUserHistory.length > 0" class="mt-4">
      <h4 class="font-medium mb-2">用户历史（最近 {{ selectedUserHistory.length }} 条）</h4>
      <ul class="space-y-2 text-sm">
        <li v-for="h in selectedUserHistory" :key="h.id" class="p-2 border border-gray-200 dark:border-gray-700 rounded">
          <div class="text-gray-500 mb-1">{{ formatDate(h.createdAt) }}</div>
          <div class="line-clamp-2">{{ h.sourceText }}</div>
        </li>
      </ul>
    </div>
  </div>

  <div class="p-4 border border-gray-300 dark:border-gray-700 rounded-md">
    <h3 class="text-lg font-semibold mb-3">系统日志</h3>
    <div class="flex items-center gap-3 mb-2">
      <button @click="loadLogs" class="px-3 py-1 border-2 border-gray-300 rounded hover:border-black">刷新</button>
      <span class="text-xs text-gray-500">显示最近 {{ logLines }} 行</span>
    </div>
    <pre class="bg-black text-green-400 p-3 rounded max-h-80 overflow-auto text-xs whitespace-pre-wrap">{{ systemLogs }}</pre>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAuthStore } from '@/stores/authStore';
import { adminApi, modelApi, knowledgeApi } from '@/api';
import type { ModelConfig, KnowledgeBase } from '@/types';

const store = useAuthStore();
const username = ref('');
const password = ref('');
const message = ref('');
const messageType = ref<'ok' | 'err'>('ok');
const deleteKB = ref(true);
const myModels = ref<ModelConfig[]>([]);
const myKbs = ref<KnowledgeBase[]>([]);
const users = ref<any[]>([]);
const selectedUserHistory = ref<any[]>([]);
const systemLogs = ref('');
const logLines = ref(500);

onMounted(async () => {
  await store.fetchStatus();
  await refreshLists();
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
async function refreshLists() {
  try {
    const [modelsRes, kbsRes] = await Promise.all([modelApi.getAll(), knowledgeApi.getAll()]);
    const userId = store.user?.id;
    const allModels = (modelsRes as any)?.data || [];
    const allKbs = (kbsRes as any)?.data || [];
    myModels.value = userId ? allModels.filter((m: any) => m.ownerUserId === userId) : [];
    myKbs.value = userId ? allKbs.filter((k: any) => k.ownerUserId === userId) : [];
  } catch {}
}
async function toggleModelShare(m: ModelConfig) {
  const next = !m.isPublic;
  const res = await adminApi.shareModel(m.id, next);
  if ((res as any)?.success) {
    m.isPublic = next;
  }
}
async function toggleKbShare(k: KnowledgeBase) {
  const next = !k.isPublic;
  const res = await adminApi.shareKnowledge(k.id, next);
  if ((res as any)?.success) {
    k.isPublic = next;
  }
}

async function loadUsers() {
  try {
    const res = await adminApi.getUsers();
    users.value = (res as any)?.data || [];
  } catch {}
}

function formatDate(s: string) {
  const d = new Date(s);
  return d.toLocaleString('zh-CN');
}

async function viewUserHistory(userId: string) {
  const res = await adminApi.getUserHistory(userId, 20);
  selectedUserHistory.value = (res as any)?.data || [];
}

async function loadLogs() {
  const res = await adminApi.getSystemLogs(logLines.value);
  systemLogs.value = (res as any)?.data || '';
}
async function cleanupLegacy() {
  const ok = confirm('将删除历史上共享/无归属的模型与知识库，确定执行？');
  if (!ok) return;
  try {
    const res = await adminApi.cleanupLegacy();
    if ((res as any)?.success) {
      const d = (res as any).data || {};
      message.value = `已清理：KB ${d.kbDeleted ?? 0}，模型 ${d.modelDeleted ?? 0}`;
      messageType.value = 'ok';
    } else {
      message.value = (res as any)?.error || '清理失败';
      messageType.value = 'err';
    }
  } catch (e: any) {
    message.value = e?.message || '清理失败';
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


