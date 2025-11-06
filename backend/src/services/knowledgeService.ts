import { db } from '../database/schema';
import { v4 as uuidv4 } from 'uuid';
import { modelService } from './modelService';
import { llmService } from './llmService';
import fs from 'fs';
import path from 'path';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
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
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Get all knowledge bases
   */
  getAllKnowledgeBases(): KnowledgeBase[] {
    const stmt = db.prepare('SELECT * FROM knowledge_bases ORDER BY created_at DESC');
    const rows = stmt.all() as DbKnowledgeBase[];
    return rows.map(row => this.dbToKnowledgeBase(row));
  }

  /**
   * Get knowledge base by ID
   */
  getKnowledgeBaseById(id: string): KnowledgeBase | null {
    const stmt = db.prepare('SELECT * FROM knowledge_bases WHERE id = ?');
    const row = stmt.get(id) as DbKnowledgeBase | undefined;
    return row ? this.dbToKnowledgeBase(row) : null;
  }

  /**
   * Create knowledge base from uploaded file
   */
  async createKnowledgeBase(
    dto: CreateKnowledgeBaseDto,
    file: Express.Multer.File
  ): Promise<KnowledgeBase> {
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

    // Generate embeddings for chunks with concurrency control
    console.log(`Generating embeddings for ${chunks.length} chunks...`);
    const concurrency = parseInt(process.env.EMBEDDING_CONCURRENCY || '4', 10);
    const limit = Number.isFinite(concurrency) && concurrency > 0 ? concurrency : 4;
    const chunksWithEmbeddings = await mapWithConcurrency(chunks, limit, async (chunk, index) => {
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
    });

    // Store in vector store
    vectorStore[id] = { chunks: chunksWithEmbeddings };

    // Save to database
    const stmt = db.prepare(`
      INSERT INTO knowledge_bases (
        id, name, description, file_type, file_name, file_path,
        file_size, chunk_count, embedding_model_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      now,
      now
    );

    return this.getKnowledgeBaseById(id)!;
  }

  /**
   * Delete knowledge base
   */
  deleteKnowledgeBase(id: string): boolean {
    const kb = this.getKnowledgeBaseById(id);
    if (!kb) return false;

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
  async search(dto: SearchKnowledgeDto): Promise<SearchResult[]> {
    const { query, knowledgeBaseIds, topK = 5 } = dto;

    // Get knowledge bases to search
    let kbIds: string[];
    if (knowledgeBaseIds && knowledgeBaseIds.length > 0) {
      kbIds = knowledgeBaseIds;
    } else {
      const allKbs = this.getAllKnowledgeBases();
      kbIds = allKbs.map(kb => kb.id);
    }

    if (kbIds.length === 0) {
      return [];
    }

    // Get first embedding model to generate query embedding
    const embeddingModels = modelService.getEnabledModelsByStage('embedding');
    if (embeddingModels.length === 0) {
      throw new Error('No embedding model available');
    }

    const embeddingModel = embeddingModels[0];

    // Generate query embedding
    const queryEmbedding = await llmService.generateEmbedding(embeddingModel, query);

    // Search in each knowledge base
    const allResults: Array<SearchResult & { score: number }> = [];

    for (const kbId of kbIds) {
      const kb = this.getKnowledgeBaseById(kbId);
      if (!kb) continue;

      const store = vectorStore[kbId];
      if (!store) continue;

      // Calculate similarity for each chunk
      for (const chunk of store.chunks) {
        if (chunk.embedding.length === 0) continue;

        const similarity = this.cosineSimilarity(queryEmbedding, chunk.embedding);
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
    const kbs = this.getAllKnowledgeBases();

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

        const concurrency = parseInt(process.env.EMBEDDING_CONCURRENCY || '4', 10);
        const limit = Number.isFinite(concurrency) && concurrency > 0 ? concurrency : 4;
        const chunksWithEmbeddings = await mapWithConcurrency(chunks, limit, async (chunk, index) => {
          try {
            const embedding = await llmService.generateEmbedding(embeddingModel, chunk);
            return {
              id: `${kb.id}_chunk_${index}`,
              content: chunk,
              embedding,
              metadata: { index, knowledgeBaseId: kb.id }
            };
          } catch (error) {
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
