// Model Configuration Types
export interface ModelConfig {
  id: string;
  name: string;
  stage: 'translation' | 'review' | 'synthesis' | 'embedding';
  apiEndpoint: string;
  apiKey?: string; // never returned by server; only used when creating/updating
  modelId: string;
  systemPrompt: string;
  hasApiKey?: boolean; // whether the server has a stored (encrypted) key
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

// Translation Types
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

// Progressive API payloads
export interface TranslationProgressStart {
  sourceText: string;
  stage1Results: TranslationStageResult[];
  stage2Results: ReviewResult[];
  stage3Results: TranslationStageResult[];
  knowledgeContext?: string[];
}

export interface TranslationProgressReview {
  stage2Results: ReviewResult[];
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

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
