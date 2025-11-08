import axios, { AxiosError } from 'axios';
import fs from 'fs';
import path from 'path';
import type { ModelConfig, LLMRequest, LLMResponse, LLMMessage } from '../types';
import { logError, logWarning } from '../utils/logger';

export class LLMService {
  private defaultPromptCache: Record<'translation' | 'review' | 'synthesis', string | null> = {
    translation: null,
    review: null,
    synthesis: null
  };

  private resolveSystemPrompt(config: ModelConfig): string | undefined {
    if (config.systemPrompt && config.systemPrompt.trim().length > 0) {
      return config.systemPrompt;
    }

    // Load default prompt by stage
    if (config.stage === 'embedding') return undefined;
    const stage = config.stage as 'translation' | 'review' | 'synthesis';
    return this.getDefaultPromptForStage(stage) || undefined;
  }

  private getDefaultPromptForStage(stage: 'translation' | 'review' | 'synthesis'): string | null {
    if (this.defaultPromptCache[stage] !== null) {
      return this.defaultPromptCache[stage];
    }

    const fileNameMap: Record<typeof stage, string> = {
      translation: 'first_prompt.md',
      review: 'second_prompt.md',
      synthesis: 'third_prompt.md'
    };

    const candidates: string[] = [];
    const envDir = process.env.DEFAULT_PROMPTS_DIR;
    if (envDir) {
      candidates.push(path.resolve(envDir, fileNameMap[stage]));
    }
    // When compiled, __dirname is dist/services; prompts copied to dist/prompts
    candidates.push(path.resolve(__dirname, '../prompts', fileNameMap[stage]));
    // Dev runs (tsx), __dirname is src/services; try project prompts locations
    candidates.push(path.resolve(__dirname, '../../prompts', fileNameMap[stage]));
    candidates.push(path.resolve(process.cwd(), 'backend/prompts', fileNameMap[stage]));
    candidates.push(path.resolve(process.cwd(), 'prompts', fileNameMap[stage]));

    for (const p of candidates) {
      try {
        if (fs.existsSync(p)) {
          const content = fs.readFileSync(p, 'utf-8');
          this.defaultPromptCache[stage] = content;
          return content;
        }
      } catch {
        // ignore and continue
      }
    }

    this.defaultPromptCache[stage] = null;
    return null;
  }

  /**
   * Call LLM API with the given configuration and messages
   */
  async callLLM(
    config: ModelConfig,
    messages: LLMMessage[],
    contextFromKnowledgeBase?: string[]
  ): Promise<{ output: string; tokensUsed?: number }> {
    try {
      // Prepare messages with context if available
      let finalMessages = [...messages];

      if (contextFromKnowledgeBase && contextFromKnowledgeBase.length > 0) {
        const contextMessage: LLMMessage = {
          role: 'system',
          content: `参考信息（来自知识库）：\n\n${contextFromKnowledgeBase.join('\n\n---\n\n')}`
        };
        finalMessages = [contextMessage, ...messages];
      }

      // Add system prompt if provided; otherwise try default by stage
      const systemPrompt = this.resolveSystemPrompt(config);
      if (systemPrompt) {
        finalMessages = [
          { role: 'system', content: systemPrompt },
          ...finalMessages
        ];
      }

      // Build request payload
      const requestPayload: LLMRequest = {
        model: config.modelId,
        messages: finalMessages,
        ...this.buildParameters(config)
      };

      // Prepare headers (OpenAI-compatible); add OpenRouter hints if needed
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      };

      // Some OpenRouter keys enforce Referer/X-Title — harmless for others
      if (typeof config.apiEndpoint === 'string' && config.apiEndpoint.includes('openrouter.ai')) {
        const referer = process.env.OPENROUTER_REFERRER || 'http://localhost:5173';
        const title = process.env.OPENROUTER_TITLE || 'Legal Translation Review System';
        headers['HTTP-Referer'] = referer;
        headers['X-Title'] = title;
        headers['Accept'] = 'application/json';
      }

      // Call API
      const response = await axios.post<LLMResponse>(
        config.apiEndpoint,
        requestPayload,
        this.buildAxiosOptions(config.apiEndpoint, headers, 120000)
      );

      // Extract response
      const output = response.data.choices[0]?.message?.content || '';
      const tokensUsed = response.data.usage?.total_tokens;

      return { output, tokensUsed };
    } catch (error) {
      const axiosError = error as AxiosError;
      const errorMessage = axiosError.response?.data
        ? JSON.stringify(axiosError.response.data)
        : axiosError.message;

      // 记录详细错误信息
      logError(`LLM API调用失败 [Model:${config.name}] [Endpoint:${config.apiEndpoint}] [Error:${errorMessage}]`);

      throw new Error(`LLM API call failed: ${errorMessage}`);
    }
  }

  /**
   * Build parameters for LLM request
   */
  private buildParameters(config: ModelConfig): Record<string, any> {
    const params: Record<string, any> = {};

    if (config.temperature !== undefined) params.temperature = config.temperature;
    if (config.maxTokens !== undefined) params.max_tokens = config.maxTokens;
    if (config.topP !== undefined) params.top_p = config.topP;
    if (config.frequencyPenalty !== undefined) params.frequency_penalty = config.frequencyPenalty;
    if (config.presencePenalty !== undefined) params.presence_penalty = config.presencePenalty;

    // Merge custom parameters
    if (config.customParams) {
      Object.assign(params, config.customParams);
    }

    return params;
  }

  /**
   * Build axios options with optional system proxy support
   */
  private buildAxiosOptions(
    apiEndpoint: string,
    headers: Record<string, string>,
    timeoutMs: number
  ): Record<string, any> {
    const options: Record<string, any> = {
      headers,
      timeout: timeoutMs,
      // default: disable axios built-in proxy to avoid conflicts
      proxy: false
    };

    try {
      const useSystemProxy = (process.env.USE_SYSTEM_PROXY || '').toLowerCase() === 'true';
      if (!useSystemProxy) return options;

      const url = new URL(apiEndpoint);
      const hostname = url.hostname;
      const protocol = url.protocol; // 'https:' | 'http:'

      const noProxy = process.env.NO_PROXY || process.env.no_proxy;
      if (noProxy) {
        const entries = noProxy.split(',').map(s => s.trim()).filter(Boolean);
        const match = entries.some((rule) => {
          if (rule === '*') return true;
          if (rule === hostname) return true;
          if (rule.startsWith('.')) return hostname.endsWith(rule);
          return false;
        });
        if (match) return options; // bypass proxy for this host
      }

      // Prefer HTTPS proxy for https endpoints
      const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.ALL_PROXY || process.env.all_proxy;
      const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy || process.env.ALL_PROXY || process.env.all_proxy;

      if (protocol === 'https:' && httpsProxy) {
        // Lazy require to avoid hard dependency if not used
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { HttpsProxyAgent } = require('https-proxy-agent');
        options.httpsAgent = new HttpsProxyAgent(httpsProxy);
      } else if (protocol === 'http:' && httpProxy) {
        // Optional: try to use http proxy when calling non-TLS endpoints
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { HttpProxyAgent } = require('http-proxy-agent');
          options.httpAgent = new HttpProxyAgent(httpProxy);
        } catch {
          // http-proxy-agent 未安装则忽略
        }
      }
    } catch {
      // silently fallback to direct connection
    }

    return options;
  }

  /**
   * Generate embedding for text
   */
  async generateEmbedding(config: ModelConfig, text: string): Promise<number[]> {
    try {
      // Many OpenAI-compatible providers use different endpoints for embeddings vs chat
      // If the configured endpoint looks like a chat endpoint, try to derive an embeddings endpoint.
      const deriveEmbeddingEndpoints = (endpoint: string): string[] => {
        const candidates: string[] = [];
        try {
          const u = new URL(endpoint);
          let p = u.pathname;
          const replacements = [
            ['chat/completions', 'embeddings'],
            ['/chat/completions', '/embeddings'],
            ['/messages', '/embeddings'],
            ['completions', 'embeddings']
          ];
          for (const [from, to] of replacements) {
            if (p.includes(from)) {
              const replaced = p.replace(from, to);
              const newUrl = `${u.origin}${replaced}`;
              candidates.push(newUrl);
            }
          }
        } catch {
          // ignore parse error
        }
        // Always include the original endpoint as last resort
        candidates.push(endpoint);
        // unique
        return Array.from(new Set(candidates));
      };

      const endpointsToTry = deriveEmbeddingEndpoints(config.apiEndpoint);
      let lastError: any = null;
      for (const endpoint of endpointsToTry) {
        try {
      const response = await axios.post(
            endpoint,
        {
          model: config.modelId,
          input: text
        },
        this.buildAxiosOptions(
              endpoint,
        {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
          },
          60000
        )
      );

          // Extract embedding from response (OpenAI/compatible or generic)
          if (response.data?.data && Array.isArray(response.data.data) && response.data.data[0]?.embedding) {
            return response.data.data[0].embedding as number[];
      }
          if (Array.isArray(response.data) && response.data[0]?.embedding) {
            return response.data[0].embedding as number[];
          }
          if (response.data?.embedding) {
            return response.data.embedding as number[];
      }

          // If format not recognized, continue to next candidate
          lastError = new Error('Invalid embedding response format');
        } catch (err) {
          lastError = err;
          // continue to next candidate
        }
      }

      // If all attempts failed, surface the most recent error message
      const axiosError = lastError as AxiosError;
      const errorMessage = axiosError?.response?.data
        ? JSON.stringify(axiosError.response.data)
        : axiosError?.message || 'Embedding request failed';
      
      logError(`Embedding生成失败 [Model:${config.name}] [Endpoints尝试:${endpointsToTry.join(', ')}] [Error:${errorMessage}]`);

      throw new Error(`Embedding generation failed: ${errorMessage}`);
    } catch (error) {
      const axiosError = error as AxiosError;
      const errorMessage = axiosError?.message || String(error);
      
      logError(`Embedding生成异常 [Model:${config.name}] [Error:${errorMessage}]`);
      
      throw new Error(`Embedding generation failed: ${axiosError?.response?.data ? JSON.stringify(axiosError.response.data) : errorMessage}`);
    }
  }

  /**
   * Test model connection
   */
  async testConnection(config: ModelConfig): Promise<boolean> {
    try {
      // Embedding 模型使用 embeddings 接口测试
      if (config.stage === 'embedding') {
        const emb = await this.generateEmbedding(config, 'health check');
        return Array.isArray(emb) && emb.length > 0;
      }

      // 其他阶段（translation/review/synthesis）使用 Chat Completions 测试
      const testMessages: LLMMessage[] = [
        { role: 'user', content: 'Hello, please reply with "OK".' }
      ];
      await this.callLLM(config, testMessages);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Model connection test failed:', message);
      throw new Error(message);
    }
  }
}

export const llmService = new LLMService();
