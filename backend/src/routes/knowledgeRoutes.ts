import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { knowledgeService } from '../services/knowledgeService';
import type { ApiResponse, CreateKnowledgeBaseDto, SearchKnowledgeDto } from '../types';

const router = Router();

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760') // 10MB default
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.txt', '.pdf', '.docx', '.md'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${ext} is not supported. Allowed types: ${allowedTypes.join(', ')}`));
    }
  }
});

// Get all knowledge bases
router.get('/', (req, res) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    const isAdmin = (req as any).user?.role === 'admin';
    const knowledgeBases = knowledgeService.getAllKnowledgeBasesForUser(userId, isAdmin);
    const response: ApiResponse = {
      success: true,
      data: knowledgeBases
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(response);
  }
});

// Get knowledge base by ID
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const knowledgeBase = knowledgeService.getKnowledgeBaseById(id);

    if (!knowledgeBase) {
      const response: ApiResponse = {
        success: false,
        error: 'Knowledge base not found'
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data: knowledgeBase
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(response);
  }
});

// Create knowledge base
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      const response: ApiResponse = {
        success: false,
        error: 'File is required'
      };
      return res.status(400).json(response);
    }

    const dto: CreateKnowledgeBaseDto = {
      name: req.body.name,
      description: req.body.description,
      embeddingModelId: req.body.embeddingModelId
    };

    if (!dto.name || !dto.embeddingModelId) {
      const response: ApiResponse = {
        success: false,
        error: 'Name and embeddingModelId are required'
      };
      return res.status(400).json(response);
    }

    const userId = (req as any).user?.id as string | undefined;
    const knowledgeBase = await knowledgeService.createKnowledgeBase(dto, req.file, userId);

    const response: ApiResponse = {
      success: true,
      data: knowledgeBase,
      message: 'Knowledge base created successfully'
    };
    res.status(201).json(response);
  } catch (error) {
    console.error('Create knowledge base error:', error);
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(response);
  }
});

// Delete knowledge base
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id as string | undefined;
    const isAdmin = (req as any).user?.role === 'admin';
    const success = knowledgeService.deleteKnowledgeBase(id, userId, isAdmin);

    if (!success) {
      const response: ApiResponse = {
        success: false,
        error: 'Knowledge base not found'
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse = {
      success: true,
      message: 'Knowledge base deleted successfully'
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(response);
  }
});

// Search knowledge base
router.post('/search', async (req, res) => {
  try {
    const dto: SearchKnowledgeDto = req.body;

    if (!dto.query || dto.query.trim().length === 0) {
      const response: ApiResponse = {
        success: false,
        error: 'Query is required'
      };
      return res.status(400).json(response);
    }

    const userId = (req as any).user?.id as string | undefined;
    const isAdmin = (req as any).user?.role === 'admin';
    const results = await knowledgeService.search(dto, userId, isAdmin);

    const response: ApiResponse = {
      success: true,
      data: results
    };
    res.json(response);
  } catch (error) {
    console.error('Search error:', error);
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(response);
  }
});

// per-user preference for knowledge base enable/disable
router.post('/:id/pref', (req, res) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body as { enabled?: boolean };
    if (typeof enabled !== 'boolean') return res.status(400).json({ success: false, error: 'enabled must be boolean' });
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });
    const kb = knowledgeService.getKnowledgeBaseById(id);
    if (!kb) return res.status(404).json({ success: false, error: 'Knowledge base not found' });
    knowledgeService.setUserPreference(userId, id, enabled);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'Failed' });
  }
});

export default router;
