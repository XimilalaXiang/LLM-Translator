import axios from 'axios';
import type {
  ApiResponse,
  ModelConfig,
  CreateModelConfigDto,
  TranslationRequest,
  TranslationResponse,
  KnowledgeBase,
  CreateKnowledgeBaseDto
} from '@/types';

const api = axios.create({
  baseURL: '/api',
  timeout: 300000, // 5 minutes for long-running translation tasks
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

// Model API
export const modelApi = {
  getAll: () => api.get<never, ApiResponse<ModelConfig[]>>('/models'),
  getByStage: (stage: string) => api.get<never, ApiResponse<ModelConfig[]>>(`/models/stage/${stage}`),
  getById: (id: string) => api.get<never, ApiResponse<ModelConfig>>(`/models/${id}`),
  create: (data: CreateModelConfigDto) => api.post<never, ApiResponse<ModelConfig>>('/models', data),
  update: (id: string, data: Partial<CreateModelConfigDto>) => api.put<never, ApiResponse<ModelConfig>>(`/models/${id}`, data),
  delete: (id: string) => api.delete<never, ApiResponse>(`/models/${id}`),
  test: (id: string) => api.post<never, ApiResponse<{ connected: boolean }>>(`/models/${id}/test`),
  reorder: (stage: string, modelIds: string[]) => api.post<never, ApiResponse>(`/models/stage/${stage}/reorder`, { modelIds })
};

// Translation API
export const translationApi = {
  translate: (data: TranslationRequest) => api.post<never, ApiResponse<TranslationResponse>>('/translations', data),
  // progressive endpoints
  progressStart: (data: TranslationRequest) => api.post<never, ApiResponse<any>>('/translations/progress/start', data),
  progressReview: (payload: any) => api.post<never, ApiResponse<any>>('/translations/progress/review', payload),
  progressSynthesis: (payload: any) => api.post<never, ApiResponse<TranslationResponse>>('/translations/progress/synthesis', payload),
  getHistory: (limit?: number) => api.get<never, ApiResponse<TranslationResponse[]>>('/translations/history', { params: { limit } }),
  getById: (id: string) => api.get<never, ApiResponse<TranslationResponse>>(`/translations/${id}`)
};

// Knowledge Base API
export const knowledgeApi = {
  getAll: () => api.get<never, ApiResponse<KnowledgeBase[]>>('/knowledge'),
  getById: (id: string) => api.get<never, ApiResponse<KnowledgeBase>>(`/knowledge/${id}`),
  create: (data: CreateKnowledgeBaseDto, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', data.name);
    if (data.description) formData.append('description', data.description);
    formData.append('embeddingModelId', data.embeddingModelId);

    return api.post<never, ApiResponse<KnowledgeBase>>('/knowledge', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  },
  delete: (id: string) => api.delete<never, ApiResponse>(`/knowledge/${id}`)
};

// Health check
export const healthCheck = () => api.get('/health');

export default api;
