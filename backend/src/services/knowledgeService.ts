import { db } from '../database/schema';
import { v4 as uuidv4 } from 'uuid';
import { modelService } from './modelService';
import { llmService } from './llmService';
import fs from 'fs';
import path from 'path';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import { logWarning } from '../utils/logger';
// Simple concurrency limiter to avoid ESM-only deps in CJS runtime
async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const workers = new Array(Math.max(1, concurrency)).fill(0).map(async () => {
    while (true) {
      const current = nextIndex++;
      if (current >= items.length) break;
      results[current] = await mapper(items[current], current);
    }
  });

  await Promise.all(workers);
  return results;
}
import type {
  KnowledgeBase,
  CreateKnowledgeBaseDto,
  SearchKnowledgeDto,
  SearchResult,
  DbKnowledgeBase
} from '../types';

// Simple in-memory vector store (in production, use Chroma or similar)
interface VectorStore {
  [knowledgeBaseId: string]: {
    chunks: Array<{
      id: string;
      content: string;
      embedding: number[];
      metadata?: Record<string, any>;
    }>;
  };
}

const vectorStore: VectorStore = {};

export class KnowledgeService {
  private uploadDir: string;

  constructor() {
    this.uploadDir = process.env.UPLOAD_DIR || './uploads';
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  /**
   * Convert database row to KnowledgeBase
   */
  private dbToKnowledgeBase(row: DbKnowledgeBase): KnowledgeBase {
    return {
      id: row.id,
      name: row.name,
      description: row.description || undefined,
      fileType: row.file_type,
      fileName: row.file_name,
      filePath: row.file_path,
      fileSize: row.file_size,
      chunkCount: row.chunk_count,
      embeddingModelId: row.embedding_model_id,
      ownerUserId: row.owner_user_id || undefined,
      isPublic: row.is_public === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Get all knowledge bases
   */
  getAllKnowledgeBasesForUser(userId?: string, isAdmin?: boolean): KnowledgeBase[] {
    let rows: DbKnowledgeBase[] = [];
    if (!userId) {
      rows = db.prepare('SELECT * FROM knowledge_bases ORDER BY created_at DESC').all() as DbKnowledgeBase[];
      return rows.map(row => ({ ...this.dbToKnowledgeBase(row), enabled: true }));
    } else {
      rows = db.prepare('SELECT * FROM knowledge_bases WHERE (owner_user_id = ? OR is_public = 1) ORDER BY created_at DESC').all(userId) as DbKnowledgeBase[];
      const list = rows.map(row => ({ ...this.dbToKnowledgeBase(row), enabled: true } as KnowledgeBase));
      return this.applyEffectiveEnabled(list, userId);
    }
  }

  /**
   * Get knowledge base by ID
   */
  getKnowledgeBaseById(id: string): KnowledgeBase | null {
    const stmt = db.prepare('SELECT * FROM knowledge_bases WHERE id = ?');
    const row = stmt.get(id) as DbKnowledgeBase | undefined;
    return row ? this.dbToKnowledgeBase(row) : null;
  }

  getUserPreference(userId: string, kbId: string): boolean | null {
    try {
      const r = db.prepare('SELECT enabled FROM user_kb_prefs WHERE user_id = ? AND kb_id = ?').get(userId, kbId) as any;
      if (!r) return null; return r.enabled === 1;
    } catch { return null; }
  }

  setUserPreference(userId: string, kbId: string, enabled: boolean): void {
    db.prepare('INSERT INTO user_kb_prefs(user_id, kb_id, enabled) VALUES(?,?,?) ON CONFLICT(user_id, kb_id) DO UPDATE SET enabled = excluded.enabled')
      .run(userId, kbId, enabled ? 1 : 0);
  }

  applyEffectiveEnabled(list: KnowledgeBase[], userId: string): KnowledgeBase[] {
    return list.map(k => {
      const pref = this.getUserPreference(userId, k.id);
      return { ...k, enabled: pref === null ? true : pref } as KnowledgeBase;
    });
  }

  /**
   * Create knowledge base from uploaded file
   */
  async createKnowledgeBase(
    dto: CreateKnowledgeBaseDto,
    file: Express.Multer.File
  , ownerUserId?: string): Promise<KnowledgeBase> {
    const id = uuidv4();
    const now = new Date().toISOString();

    // Extract text from file
    const text = await this.extractTextFromFile(file);

    // Split into chunks
    const chunks = this.splitIntoChunks(text);

    // Get embedding model
    const embeddingModel = modelService.getModelById(dto.embeddingModelId);
    if (!embeddingModel) {
      throw new Error('Embedding model not found');
    }

    // Generate embeddings for chunks (no concurrency limit)
    console.log(`Generating embeddings for ${chunks.length} chunks...`);
    const chunksWithEmbeddings = await Promise.all(
      chunks.map(async (chunk, index) => {
      try {
        const embedding = await llmService.generateEmbedding(embeddingModel, chunk);
        return {
          id: `${id}_chunk_${index}`,
          content: chunk,
          embedding,
          metadata: { index, knowledgeBaseId: id }
        };
      } catch (error) {
        console.error(`Failed to generate embedding for chunk ${index}:`, error);
        return {
          id: `${id}_chunk_${index}`,
          content: chunk,
          embedding: [],
          metadata: { index, knowledgeBaseId: id }
        };
      }
      })
    );

    // Store in vector store
    vectorStore[id] = { chunks: chunksWithEmbeddings };

    // Save to database
    const stmt = db.prepare(`
      INSERT INTO knowledge_bases (
        id, name, description, file_type, file_name, file_path,
        file_size, chunk_count, embedding_model_id, owner_user_id, is_public,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      dto.name,
      dto.description || null,
      file.mimetype,
      file.originalname,
      file.path,
      file.size,
      chunks.length,
      dto.embeddingModelId,
      ownerUserId ?? null,
      0,
      now,
      now
    );

    return this.getKnowledgeBaseById(id)!;
  }

  /**
   * Delete knowledge base
   */
  deleteKnowledgeBase(id: string, currentUserId?: string, isAdmin?: boolean): boolean {
    const kb = this.getKnowledgeBaseById(id);
    if (!kb) return false;
    if (currentUserId) {
      const isOwner = kb.ownerUserId === currentUserId;
      if (!isOwner && !isAdmin) throw new Error('Permission denied');
    }

    // Delete file
    try {
      if (fs.existsSync(kb.filePath)) {
        fs.unlinkSync(kb.filePath);
      }
    } catch (error) {
      console.error('Failed to delete file:', error);
    }

    // Delete from vector store
    delete vectorStore[id];

    // Delete from database
    const stmt = db.prepare('DELETE FROM knowledge_bases WHERE id = ?');
    const result = stmt.run(id);

    return result.changes > 0;
  }

  /**
   * Search knowledge base
   */
  async search(dto: SearchKnowledgeDto, userId?: string, isAdmin?: boolean): Promise<SearchResult[]> {
    const { query, knowledgeBaseIds, topK = 5 } = dto;

    // Get knowledge bases to search
    let kbIds: string[];
    const accessible = this.getAllKnowledgeBasesForUser(userId, isAdmin);
    const accessibleSet = new Set(accessible.map(k => k.id));
    const disabledSet = new Set(accessible.filter(k => k.enabled === false).map(k => k.id));
    // If knowledgeBaseIds is provided (even empty), respect it strictly.
    if (knowledgeBaseIds !== undefined) {
      kbIds = (knowledgeBaseIds || []).filter(id => accessibleSet.has(id) && !disabledSet.has(id));
    } else {
      // Not provided -> use all accessible (minus disabled)
      kbIds = [...accessibleSet].filter(id => !disabledSet.has(id));
    }

    if (kbIds.length === 0) {
      return [];
    }

    // Group KBs by their embedding model to ensure vector space一致
    const kbByModel = new Map<string, string[]>();
    for (const id of kbIds) {
      const kb = this.getKnowledgeBaseById(id);
      if (!kb) continue;
      const list = kbByModel.get(kb.embeddingModelId) || [];
      list.push(id);
      kbByModel.set(kb.embeddingModelId, list);
    }

    // Search in each embedding model group
    const allResults: Array<SearchResult & { score: number }> = [];

    for (const [modelId, ids] of kbByModel.entries()) {
      const model = modelService.getModelByIdForUser(modelId, userId, isAdmin);
      if (!model) continue;
      let queryEmbedding: number[] | null = null;
      try {
        queryEmbedding = await llmService.generateEmbedding(model, query);
      } catch (e: any) {
        // 如果该嵌入模型生成查询向量失败，跳过该模型组，避免 500
        const msg = e?.message || String(e);
        logWarning(`知识库检索跳过模型组 [${model.name}]，原因：查询嵌入失败：${msg}`);
        continue;
      }

      for (const kbId of ids) {
      const kb = this.getKnowledgeBaseById(kbId);
      if (!kb) continue;
      const store = vectorStore[kbId];
      if (!store) continue;
      for (const chunk of store.chunks) {
        if (chunk.embedding.length === 0) continue;
        const similarity = this.cosineSimilarity(queryEmbedding!, chunk.embedding);
        allResults.push({
          id: chunk.id,
          content: chunk.content,
          similarity,
          metadata: chunk.metadata,
          knowledgeBaseName: kb.name,
          score: similarity
        });
        }
      }
    }

    // Sort by similarity and return top K
    allResults.sort((a, b) => b.score - a.score);
    return allResults.slice(0, topK).map(({ score, ...rest }) => rest);
  }

  /**
   * Extract text from file
   */
  private async extractTextFromFile(file: Express.Multer.File): Promise<string> {
    const ext = path.extname(file.originalname).toLowerCase();

    try {
      if (ext === '.txt' || ext === '.md') {
        return fs.readFileSync(file.path, 'utf-8');
      } else if (ext === '.pdf') {
        const dataBuffer = fs.readFileSync(file.path);
        const data = await pdf(dataBuffer);
        return data.text;
      } else if (ext === '.docx') {
        const result = await mammoth.extractRawText({ path: file.path });
        return result.value;
      } else {
        throw new Error(`Unsupported file type: ${ext}`);
      }
    } catch (error) {
      throw new Error(`Failed to extract text from file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Split text into chunks
   */
  private splitIntoChunks(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      const end = start + chunkSize;
      const chunk = text.slice(start, end);
      chunks.push(chunk.trim());
      start = end - overlap;
    }

    return chunks.filter(chunk => chunk.length > 0);
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Load existing knowledge bases into memory
   */
  async loadExistingKnowledgeBases(): Promise<void> {
    console.log('Loading existing knowledge bases...');
    const kbs = this.getAllKnowledgeBasesForUser();

    for (const kb of kbs) {
      // Check if already loaded
      if (vectorStore[kb.id]) continue;

      try {
        // Re-process the file
        const file: Express.Multer.File = {
          fieldname: 'file',
          originalname: kb.fileName,
          encoding: '7bit',
          mimetype: kb.fileType,
          destination: this.uploadDir,
          filename: path.basename(kb.filePath),
          path: kb.filePath,
          size: kb.fileSize,
          stream: null as any,
          buffer: null as any
        };

        const text = await this.extractTextFromFile(file);
        const chunks = this.splitIntoChunks(text);

        const embeddingModel = modelService.getModelById(kb.embeddingModelId);
        if (!embeddingModel) {
          console.error(`Embedding model ${kb.embeddingModelId} not found for KB ${kb.name}`);
          continue;
        }

        const chunksWithEmbeddings = await mapWithConcurrency(chunks, 2, async (chunk, index) => {
          try {
            const embedding = await llmService.generateEmbedding(embeddingModel, chunk);
            return {
              id: `${kb.id}_chunk_${index}`,
              content: chunk,
              embedding,
              metadata: { index, knowledgeBaseId: kb.id }
            };
          } catch {
            return {
              id: `${kb.id}_chunk_${index}`,
              content: chunk,
              embedding: [],
              metadata: { index, knowledgeBaseId: kb.id }
            };
          }
        });

        vectorStore[kb.id] = { chunks: chunksWithEmbeddings };
        console.log(`Loaded knowledge base: ${kb.name}`);
      } catch (error) {
        console.error(`Failed to load knowledge base ${kb.name}:`, error);
      }
    }
  }
}

export const knowledgeService = new KnowledgeService();
