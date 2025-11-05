// Model Configuration Types
export interface ModelConfig {
  id: string;
  name: string;
  stage: 'translation' | 'review' | 'synthesis' | 'embedding';
  apiEndpoint: string;
  apiKey: string;
  modelId: string;
  systemPrompt: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  customParams?: Record<string, any>;
  enabled: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateModelConfigDto {
  name: string;
  stage: 'translation' | 'review' | 'synthesis' | 'embedding';
  apiEndpoint: string;
  apiKey: string;
  modelId: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  customParams?: Record<string, any>;
  enabled?: boolean;
  order?: number;
}

export interface UpdateModelConfigDto extends Partial<CreateModelConfigDto> {
  id: string;
}

// Translation Workflow Types
export interface TranslationRequest {
  sourceText: string;
  useKnowledgeBase: boolean;
  knowledgeBaseIds?: string[];
  modelIds?: {
    translation?: string[];
    review?: string[];
    synthesis?: string[];
  };
}

export interface TranslationStageResult {
  modelId: string;
  modelName: string;
  output: string;
  contextUsed?: string[];
  tokensUsed?: number;
  duration: number;
  error?: string;
}

export interface ReviewResult extends TranslationStageResult {
  translationModelId: string;
  score?: number;
  suggestions?: string[];
}

export interface TranslationResponse {
  id: string;
  sourceText: string;
  stage1Results: TranslationStageResult[];
  stage2Results: ReviewResult[];
  stage3Results: TranslationStageResult[];
  finalTranslation?: string;
  totalDuration: number;
  createdAt: string;
}

// Knowledge Base Types
export interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  fileType: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  chunkCount: number;
  embeddingModelId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateKnowledgeBaseDto {
  name: string;
  description?: string;
  embeddingModelId: string;
}

export interface KnowledgeChunk {
  id: string;
  knowledgeBaseId: string;
  content: string;
  metadata?: Record<string, any>;
  embedding?: number[];
}

export interface SearchKnowledgeDto {
  query: string;
  knowledgeBaseIds?: string[];
  topK?: number;
}

export interface SearchResult {
  id: string;
  content: string;
  similarity: number;
  metadata?: Record<string, any>;
  knowledgeBaseName: string;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// LLM API Request Types
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMRequest {
  model: string;
  messages: LLMMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  [key: string]: any;
}

export interface LLMResponse {
  id?: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason?: string;
    index?: number;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Database Schema Types
export interface DbModelConfig {
  id: string;
  name: string;
  stage: string;
  api_endpoint: string;
  api_key: string;
  model_id: string;
  system_prompt: string;
  temperature: number | null;
  max_tokens: number | null;
  top_p: number | null;
  frequency_penalty: number | null;
  presence_penalty: number | null;
  custom_params: string | null;
  enabled: number;
  order_num: number;
  created_at: string;
  updated_at: string;
}

export interface DbKnowledgeBase {
  id: string;
  name: string;
  description: string | null;
  file_type: string;
  file_name: string;
  file_path: string;
  file_size: number;
  chunk_count: number;
  embedding_model_id: string;
  created_at: string;
  updated_at: string;
}

export interface DbTranslationHistory {
  id: string;
  source_text: string;
  result_json: string;
  created_at: string;
}
