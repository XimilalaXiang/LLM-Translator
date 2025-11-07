import { db } from '../database/schema';
import { v4 as uuidv4 } from 'uuid';
import type {
  ModelConfig,
  CreateModelConfigDto,
  UpdateModelConfigDto,
  DbModelConfig
} from '../types';
import { decryptSecret, encryptSecret, isEncryptedSecret } from '../utils/secret';

export class ModelService {
  // Convert database row to ModelConfig
  private dbToModel(row: DbModelConfig): ModelConfig {
    let apiKey = row.api_key || '';
    try {
      if (apiKey) {
        apiKey = decryptSecret(apiKey);
      }
    } catch (e) {
      // If decrypt fails, assume plaintext for backward compatibility
      apiKey = row.api_key || '';
    }
    return {
      id: row.id,
      name: row.name,
      stage: row.stage as any,
      apiEndpoint: row.api_endpoint,
      apiKey,
      modelId: row.model_id,
      systemPrompt: row.system_prompt,
      ownerUserId: row.owner_user_id || undefined,
      isPublic: row.is_public === 1,
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

  // helper: scope clause for user
  private scopeWhere(userId?: string, isAdmin?: boolean): { clause: string; params: any[] } {
    if (!userId) {
      // auth disabled scenario => return all
      return { clause: '1=1', params: [] };
    }
    if (isAdmin) {
      // admin sees own + public; not all by default
      return { clause: '(owner_user_id = ? OR is_public = 1)', params: [userId] };
    }
    return { clause: '(owner_user_id = ? OR is_public = 1)', params: [userId] };
  }

  getAllModelsForUser(userId?: string, isAdmin?: boolean): ModelConfig[] {
    const scope = this.scopeWhere(userId, isAdmin);
    const stmt = db.prepare(`SELECT * FROM model_configs WHERE ${scope.clause} ORDER BY stage, order_num, created_at`);
    const rows = stmt.all(...scope.params) as DbModelConfig[];
    return rows.map(row => this.dbToModel(row));
  }

  getUserPreference(userId: string, modelId: string): boolean | null {
    try {
      const row = db.prepare('SELECT enabled FROM user_model_prefs WHERE user_id = ? AND model_id = ?').get(userId, modelId) as any;
      if (!row) return null;
      return row.enabled === 1;
    } catch {
      return null;
    }
  }

  setUserPreference(userId: string, modelId: string, enabled: boolean): void {
    const stmt = db.prepare('INSERT INTO user_model_prefs(user_id, model_id, enabled) VALUES(?,?,?) ON CONFLICT(user_id, model_id) DO UPDATE SET enabled = excluded.enabled');
    stmt.run(userId, modelId, enabled ? 1 : 0);
  }

  applyEffectiveEnabled(models: ModelConfig[], userId?: string): ModelConfig[] {
    if (!userId) return models;
    return models.map(m => {
      const pref = this.getUserPreference(userId, m.id);
      const effective = pref === null ? m.enabled : pref;
      return { ...m, enabled: effective } as ModelConfig;
    });
  }

  // Get models by stage
  getModelsByStageForUser(stage: string, userId?: string, isAdmin?: boolean): ModelConfig[] {
    const scope = this.scopeWhere(userId, isAdmin);
    const stmt = db.prepare(`SELECT * FROM model_configs WHERE stage = ? AND ${scope.clause} ORDER BY order_num, created_at`);
    const rows = stmt.all(stage, ...scope.params) as DbModelConfig[];
    const list = rows.map(row => this.dbToModel(row));
    return this.applyEffectiveEnabled(list, userId);
  }

  // Get enabled models by stage
  getEnabledModelsByStageForUser(stage: string, userId?: string, isAdmin?: boolean): ModelConfig[] {
    const scope = this.scopeWhere(userId, isAdmin);
    const stmt = db.prepare(`SELECT * FROM model_configs WHERE stage = ? AND enabled = 1 AND ${scope.clause} ORDER BY order_num, created_at`);
    const rows = stmt.all(stage, ...scope.params) as DbModelConfig[];
    const list = rows.map(row => this.dbToModel(row));
    return this.applyEffectiveEnabled(list, userId).filter(m => m.enabled);
  }

  // Get model by ID
  getModelById(id: string): ModelConfig | null {
    const stmt = db.prepare('SELECT * FROM model_configs WHERE id = ?');
    const row = stmt.get(id) as DbModelConfig | undefined;
    return row ? this.dbToModel(row) : null;
  }
  getModelByIdForUser(id: string, userId?: string, isAdmin?: boolean): ModelConfig | null {
    const model = this.getModelById(id);
    if (!model) return null;
    if (!userId) return model; // auth disabled
    if (model.ownerUserId === userId) return model;
    if (model.isPublic) return model;
    if (isAdmin) return model;
    return null;
  }

  // Create model config
  createModel(dto: CreateModelConfigDto, ownerUserId?: string): ModelConfig {
    const id = uuidv4();
    const now = new Date().toISOString();
    const storedApiKey = dto.apiKey ? encryptSecret(dto.apiKey) : '';

    const stmt = db.prepare(`
      INSERT INTO model_configs (
        id, name, stage, api_endpoint, api_key, model_id, system_prompt,
        owner_user_id, is_public,
        temperature, max_tokens, top_p, frequency_penalty, presence_penalty,
        custom_params, enabled, order_num, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      dto.name,
      dto.stage,
      dto.apiEndpoint,
      storedApiKey,
      dto.modelId,
      dto.systemPrompt ?? '',
      ownerUserId ?? null,
      0,
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
  updateModel(dto: UpdateModelConfigDto, currentUserId?: string, isAdmin?: boolean): ModelConfig | null {
    const existing = this.getModelById(dto.id);
    if (!existing) return null;
    if (currentUserId) {
      const isOwner = existing.ownerUserId === currentUserId;
      if (!isOwner && !isAdmin) {
        throw new Error('Permission denied');
      }
    }

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
      const trimmed = (dto.apiKey ?? '').trim();
      if (trimmed.length > 0) {
        updates.push('api_key = ?');
        values.push(encryptSecret(trimmed));
      }
      // If empty string provided, ignore to keep existing secret (only overwrite allowed)
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
  deleteModel(id: string, currentUserId?: string, isAdmin?: boolean): boolean {
    if (currentUserId) {
      const existing = this.getModelById(id);
      if (!existing) return false;
      const isOwner = existing.ownerUserId === currentUserId;
      if (!isOwner && !isAdmin) throw new Error('Permission denied');
    }
    const stmt = db.prepare('DELETE FROM model_configs WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // Reorder models
  reorderModels(stage: string, modelIds: string[], currentUserId?: string, isAdmin?: boolean): void {
    const updateStmt = db.prepare('UPDATE model_configs SET order_num = ?, updated_at = ? WHERE id = ?');
    const now = new Date().toISOString();

    const transaction = db.transaction(() => {
      modelIds.forEach((id, index) => {
        if (currentUserId) {
          const m = this.getModelById(id);
          if (!m) return;
          const isOwner = m.ownerUserId === currentUserId;
          if (!isOwner && !isAdmin) return; // skip unauthorized ids
        }
        updateStmt.run(index, now, id);
      });
    });

    transaction();
  }
}

export const modelService = new ModelService();
