import { v4 as uuidv4 } from 'uuid';
import { modelService } from './modelService';
import { llmService } from './llmService';
import { knowledgeService } from './knowledgeService';
import { db } from '../database/schema';
import type {
  TranslationRequest,
  TranslationResponse,
  TranslationStageResult,
  ReviewResult,
  LLMMessage
} from '../types';

export class TranslationService {
  /**
   * Execute the three-stage translation workflow
   */
  async translate(request: TranslationRequest): Promise<TranslationResponse> {
    const startTime = Date.now();
    const translationId = uuidv4();

    try {
      // Get context from knowledge base if needed
      let knowledgeContext: string[] = [];
      if (request.useKnowledgeBase) {
        knowledgeContext = await this.getKnowledgeContext(
          request.sourceText,
          request.knowledgeBaseIds
        );
      }

      // Stage 1: Initial Translation
      console.log('Starting Stage 1: Translation...');
      const stage1Results = await this.executeStage1(
        request.sourceText,
        knowledgeContext,
        request.modelIds?.translation
      );

      // Stage 2: Review and Evaluation
      console.log('Starting Stage 2: Review...');
      const stage2Results = await this.executeStage2(
        request.sourceText,
        stage1Results,
        knowledgeContext,
        request.modelIds?.review
      );

      // Stage 3: Synthesis Translation
      console.log('Starting Stage 3: Synthesis...');
      const stage3Results = await this.executeStage3(
        request.sourceText,
        stage1Results,
        stage2Results,
        knowledgeContext,
        request.modelIds?.synthesis
      );

      // Select the best final translation (use the first synthesis result)
      const finalTranslation = stage3Results[0]?.output || stage1Results[0]?.output || '';

      const totalDuration = Date.now() - startTime;

      const response: TranslationResponse = {
        id: translationId,
        sourceText: request.sourceText,
        stage1Results,
        stage2Results,
        stage3Results,
        finalTranslation,
        totalDuration,
        createdAt: new Date().toISOString()
      };

      // Save to history
      this.saveToHistory(response);

      return response;
    } catch (error) {
      console.error('Translation workflow failed:', error);
      throw error;
    }
  }

  // Public thin wrappers to enable progressive execution
  async runStage1(
    sourceText: string,
    knowledgeContext: string[],
    modelIds?: string[]
  ): Promise<TranslationStageResult[]> {
    return this.executeStage1(sourceText, knowledgeContext, modelIds);
  }

  async runStage2(
    sourceText: string,
    stage1Results: TranslationStageResult[],
    knowledgeContext: string[],
    modelIds?: string[]
  ): Promise<ReviewResult[]> {
    return this.executeStage2(sourceText, stage1Results, knowledgeContext, modelIds);
  }

  async runStage3(
    sourceText: string,
    stage1Results: TranslationStageResult[],
    stage2Results: ReviewResult[],
    knowledgeContext: string[],
    modelIds?: string[]
  ): Promise<TranslationStageResult[]> {
    return this.executeStage3(sourceText, stage1Results, stage2Results, knowledgeContext, modelIds);
  }

  finalizeAndSave(
    sourceText: string,
    stage1Results: TranslationStageResult[],
    stage2Results: ReviewResult[],
    stage3Results: TranslationStageResult[]
  ): TranslationResponse {
    const translationId = uuidv4();
    const finalTranslation = stage3Results[0]?.output || stage1Results[0]?.output || '';
    const totalDuration = [...stage1Results, ...stage2Results, ...stage3Results]
      .reduce((sum, r) => sum + (r.duration || 0), 0);

    const response: TranslationResponse = {
      id: translationId,
      sourceText,
      stage1Results,
      stage2Results,
      stage3Results,
      finalTranslation,
      totalDuration,
      createdAt: new Date().toISOString()
    };

    this.saveToHistory(response);
    return response;
  }

  /**
   * Stage 1: Multiple models translate in parallel
   */
  private async executeStage1(
    sourceText: string,
    knowledgeContext: string[],
    modelIds?: string[]
  ): Promise<TranslationStageResult[]> {
    // Get enabled translation models
    let models = modelService.getEnabledModelsByStage('translation');

    // Filter by specified model IDs if provided
    if (modelIds && modelIds.length > 0) {
      models = models.filter(m => modelIds.includes(m.id));
    }

    if (models.length === 0) {
      throw new Error('No translation models available');
    }

    // Execute translations in parallel
    const promises = models.map(async (model) => {
      const startTime = Date.now();
      try {
        const messages: LLMMessage[] = [
          {
            role: 'user',
            content: `请将以下法律英语文本翻译成中文：\n\n${sourceText}`
          }
        ];

        const { output, tokensUsed } = await llmService.callLLM(
          model,
          messages,
          knowledgeContext.length > 0 ? knowledgeContext : undefined
        );

        const duration = Date.now() - startTime;

        return {
          modelId: model.id,
          modelName: model.name,
          output,
          contextUsed: knowledgeContext.length > 0 ? knowledgeContext : undefined,
          tokensUsed,
          duration
        };
      } catch (error) {
        const duration = Date.now() - startTime;
        return {
          modelId: model.id,
          modelName: model.name,
          output: '',
          duration,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    return Promise.all(promises);
  }

  /**
   * Stage 2: Review models evaluate translations
   */
  private async executeStage2(
    sourceText: string,
    stage1Results: TranslationStageResult[],
    knowledgeContext: string[],
    modelIds?: string[]
  ): Promise<ReviewResult[]> {
    // Get enabled review models
    let models = modelService.getEnabledModelsByStage('review');

    if (modelIds && modelIds.length > 0) {
      models = models.filter(m => modelIds.includes(m.id));
    }

    if (models.length === 0) {
      console.log('No review models available, skipping Stage 2');
      return [];
    }

    const reviews: ReviewResult[] = [];

    // Review each translation with each review model
    for (const translation of stage1Results) {
      if (translation.error) continue; // Skip failed translations

      for (const model of models) {
        const startTime = Date.now();
        try {
          const reviewPrompt = this.buildReviewPrompt(sourceText, translation.output);
          const messages: LLMMessage[] = [
            { role: 'user', content: reviewPrompt }
          ];

          const { output, tokensUsed } = await llmService.callLLM(
            model,
            messages,
            knowledgeContext.length > 0 ? knowledgeContext : undefined
          );

          const duration = Date.now() - startTime;

          reviews.push({
            modelId: model.id,
            modelName: model.name,
            translationModelId: translation.modelId,
            output,
            contextUsed: knowledgeContext.length > 0 ? knowledgeContext : undefined,
            tokensUsed,
            duration
          });
        } catch (error) {
          const duration = Date.now() - startTime;
          reviews.push({
            modelId: model.id,
            modelName: model.name,
            translationModelId: translation.modelId,
            output: '',
            duration,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }

    return reviews;
  }

  /**
   * Stage 3: Synthesis models create final translation
   */
  private async executeStage3(
    sourceText: string,
    stage1Results: TranslationStageResult[],
    stage2Results: ReviewResult[],
    knowledgeContext: string[],
    modelIds?: string[]
  ): Promise<TranslationStageResult[]> {
    // Get enabled synthesis models
    let models = modelService.getEnabledModelsByStage('synthesis');

    if (modelIds && modelIds.length > 0) {
      models = models.filter(m => modelIds.includes(m.id));
    }

    if (models.length === 0) {
      console.log('No synthesis models available, skipping Stage 3');
      return [];
    }

    // Build synthesis prompt with all previous results
    const synthesisPrompt = this.buildSynthesisPrompt(
      sourceText,
      stage1Results,
      stage2Results
    );

    const promises = models.map(async (model) => {
      const startTime = Date.now();
      try {
        const messages: LLMMessage[] = [
          { role: 'user', content: synthesisPrompt }
        ];

        const { output, tokensUsed } = await llmService.callLLM(
          model,
          messages,
          knowledgeContext.length > 0 ? knowledgeContext : undefined
        );

        const duration = Date.now() - startTime;

        return {
          modelId: model.id,
          modelName: model.name,
          output,
          contextUsed: knowledgeContext.length > 0 ? knowledgeContext : undefined,
          tokensUsed,
          duration
        };
      } catch (error) {
        const duration = Date.now() - startTime;
        return {
          modelId: model.id,
          modelName: model.name,
          output: '',
          duration,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    return Promise.all(promises);
  }

  /**
   * Get relevant knowledge from knowledge base
   */
  private async getKnowledgeContext(
    query: string,
    knowledgeBaseIds?: string[]
  ): Promise<string[]> {
    try {
      const results = await knowledgeService.search({
        query,
        knowledgeBaseIds,
        topK: 5
      });

      return results.map(r => r.content);
    } catch (error) {
      console.error('Failed to get knowledge context:', error);
      return [];
    }
  }

  /**
   * Build review prompt
   */
  private buildReviewPrompt(sourceText: string, translation: string): string {
    return `请以 Markdown 格式输出对以下法律英语翻译的专业审核评价与改进建议：

## 原文
${sourceText}

## 译文
${translation}

## 评价维度（逐条给出结论与证据）
- 准确性：是否准确表达法律含义
- 专业性：法律术语是否恰当
- 流畅性：是否通顺易懂
- 完整性：是否存在遗漏或添加

## 评分
- 总评分（1-10）: <请给出分数并简述依据>

## 关键问题与修改建议
- <问题1> → <修改建议>
- <问题2> → <修改建议>

> 要求：使用标题、列表、强调等 Markdown 语法，条理清晰，便于阅读。`;
  }

  /**
   * Build synthesis prompt
   */
  private buildSynthesisPrompt(
    sourceText: string,
    translations: TranslationStageResult[],
    reviews: ReviewResult[]
  ): string {
    let prompt = `请基于以下多个AI模型的翻译结果和审核意见，综合它们的优点，生成一个更准确、专业、流畅的最终译文。

原文：
${sourceText}

`;

    // Add translations
    prompt += '=== 各模型的翻译结果 ===\n\n';
    translations.forEach((t, i) => {
      if (!t.error) {
        prompt += `翻译${i + 1}（${t.modelName}）：\n${t.output}\n\n`;
      }
    });

    // Add reviews
    if (reviews.length > 0) {
      prompt += '=== 审核意见 ===\n\n';
      reviews.forEach((r, i) => {
        if (!r.error) {
          const translation = translations.find(t => t.modelId === r.translationModelId);
          prompt += `对翻译"${translation?.modelName}"的评价（${r.modelName}）：\n${r.output}\n\n`;
        }
      });
    }

    prompt += `请综合以上所有信息，生成最佳的中文译文。只需要输出最终译文，不需要额外的解释。`;

    return prompt;
  }

  /**
   * Save translation to history
   */
  private saveToHistory(response: TranslationResponse): void {
    try {
      const stmt = db.prepare(`
        INSERT INTO translation_history (id, source_text, result_json, created_at)
        VALUES (?, ?, ?, ?)
      `);

      stmt.run(
        response.id,
        response.sourceText,
        JSON.stringify(response),
        response.createdAt
      );
    } catch (error) {
      console.error('Failed to save translation history:', error);
    }
  }

  /**
   * Get translation history
   */
  getHistory(limit: number = 50): TranslationResponse[] {
    const stmt = db.prepare(`
      SELECT * FROM translation_history
      ORDER BY created_at DESC
      LIMIT ?
    `);

    const rows = stmt.all(limit) as any[];
    return rows.map(row => JSON.parse(row.result_json));
  }

  /**
   * Get translation by ID
   */
  getTranslationById(id: string): TranslationResponse | null {
    const stmt = db.prepare('SELECT * FROM translation_history WHERE id = ?');
    const row = stmt.get(id) as any;

    if (!row) return null;
    return JSON.parse(row.result_json);
  }
}

export const translationService = new TranslationService();
