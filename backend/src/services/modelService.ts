import { db } from '../database/schema';
import { v4 as uuidv4 } from 'uuid';
import type {
  ModelConfig,
  CreateModelConfigDto,
  UpdateModelConfigDto,
  DbModelConfig
} from '../types';

export class ModelService {
  // Convert database row to ModelConfig
  private dbToModel(row: DbModelConfig): ModelConfig {
    return {
      id: row.id,
      name: row.name,
      stage: row.stage as any,
      apiEndpoint: row.api_endpoint,
      apiKey: row.api_key,
      modelId: row.model_id,
      systemPrompt: row.system_prompt,
      temperature: row.temperature ?? undefined,
      maxTokens: row.max_tokens ?? undefined,
      topP: row.top_p ?? undefined,
      frequencyPenalty: row.frequency_penalty ?? undefined,
      presencePenalty: row.presence_penalty ?? undefined,
      customParams: row.custom_params ? JSON.parse(row.custom_params) : undefined,
      enabled: row.enabled === 1,
      order: row.order_num,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  // Get all model configs
  getAllModels(): ModelConfig[] {
    const stmt = db.prepare('SELECT * FROM model_configs ORDER BY stage, order_num, created_at');
    const rows = stmt.all() as DbModelConfig[];
    return rows.map(row => this.dbToModel(row));
  }

  // Get models by stage
  getModelsByStage(stage: string): ModelConfig[] {
    const stmt = db.prepare('SELECT * FROM model_configs WHERE stage = ? ORDER BY order_num, created_at');
    const rows = stmt.all(stage) as DbModelConfig[];
    return rows.map(row => this.dbToModel(row));
  }

  // Get enabled models by stage
  getEnabledModelsByStage(stage: string): ModelConfig[] {
    const stmt = db.prepare('SELECT * FROM model_configs WHERE stage = ? AND enabled = 1 ORDER BY order_num, created_at');
    const rows = stmt.all(stage) as DbModelConfig[];
    return rows.map(row => this.dbToModel(row));
  }

  // Get model by ID
  getModelById(id: string): ModelConfig | null {
    const stmt = db.prepare('SELECT * FROM model_configs WHERE id = ?');
    const row = stmt.get(id) as DbModelConfig | undefined;
    return row ? this.dbToModel(row) : null;
  }

  // Create model config
  createModel(dto: CreateModelConfigDto): ModelConfig {
    const id = uuidv4();
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO model_configs (
        id, name, stage, api_endpoint, api_key, model_id, system_prompt,
        temperature, max_tokens, top_p, frequency_penalty, presence_penalty,
        custom_params, enabled, order_num, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      dto.name,
      dto.stage,
      dto.apiEndpoint,
      dto.apiKey,
      dto.modelId,
      dto.systemPrompt ?? '',
      dto.temperature ?? null,
      dto.maxTokens ?? null,
      dto.topP ?? null,
      dto.frequencyPenalty ?? null,
      dto.presencePenalty ?? null,
      dto.customParams ? JSON.stringify(dto.customParams) : null,
      dto.enabled !== false ? 1 : 0,
      dto.order ?? 0,
      now,
      now
    );

    return this.getModelById(id)!;
  }

  // Update model config
  updateModel(dto: UpdateModelConfigDto): ModelConfig | null {
    const existing = this.getModelById(dto.id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const updates: string[] = [];
    const values: any[] = [];

    if (dto.name !== undefined) {
      updates.push('name = ?');
      values.push(dto.name);
    }
    if (dto.stage !== undefined) {
      updates.push('stage = ?');
      values.push(dto.stage);
    }
    if (dto.apiEndpoint !== undefined) {
      updates.push('api_endpoint = ?');
      values.push(dto.apiEndpoint);
    }
    if (dto.apiKey !== undefined) {
      updates.push('api_key = ?');
      values.push(dto.apiKey);
    }
    if (dto.modelId !== undefined) {
      updates.push('model_id = ?');
      values.push(dto.modelId);
    }
    if (dto.systemPrompt !== undefined) {
      updates.push('system_prompt = ?');
      values.push(dto.systemPrompt);
    }
    if (dto.temperature !== undefined) {
      updates.push('temperature = ?');
      values.push(dto.temperature);
    }
    if (dto.maxTokens !== undefined) {
      updates.push('max_tokens = ?');
      values.push(dto.maxTokens);
    }
    if (dto.topP !== undefined) {
      updates.push('top_p = ?');
      values.push(dto.topP);
    }
    if (dto.frequencyPenalty !== undefined) {
      updates.push('frequency_penalty = ?');
      values.push(dto.frequencyPenalty);
    }
    if (dto.presencePenalty !== undefined) {
      updates.push('presence_penalty = ?');
      values.push(dto.presencePenalty);
    }
    if (dto.customParams !== undefined) {
      updates.push('custom_params = ?');
      values.push(JSON.stringify(dto.customParams));
    }
    if (dto.enabled !== undefined) {
      updates.push('enabled = ?');
      values.push(dto.enabled ? 1 : 0);
    }
    if (dto.order !== undefined) {
      updates.push('order_num = ?');
      values.push(dto.order);
    }

    updates.push('updated_at = ?');
    values.push(now);
    values.push(dto.id);

    const stmt = db.prepare(`UPDATE model_configs SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return this.getModelById(dto.id);
  }

  // Delete model config
  deleteModel(id: string): boolean {
    const stmt = db.prepare('DELETE FROM model_configs WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // Reorder models
  reorderModels(stage: string, modelIds: string[]): void {
    const updateStmt = db.prepare('UPDATE model_configs SET order_num = ?, updated_at = ? WHERE id = ?');
    const now = new Date().toISOString();

    const transaction = db.transaction(() => {
      modelIds.forEach((id, index) => {
        updateStmt.run(index, now, id);
      });
    });

    transaction();
  }
}

export const modelService = new ModelService();
