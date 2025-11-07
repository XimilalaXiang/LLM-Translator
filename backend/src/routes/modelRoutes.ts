import { Router } from 'express';
import { modelService } from '../services/modelService';
import { llmService } from '../services/llmService';
import type { ApiResponse, CreateModelConfigDto, UpdateModelConfigDto, ModelConfig } from '../types';

const router = Router();

function sanitizeModel(model: ModelConfig) {
  const { apiKey, ...rest } = model as any;
  return { ...rest, hasApiKey: Boolean(apiKey && String(apiKey).length > 0) };
}

// Get all models
router.get('/', (req, res) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    const isAdmin = (req as any).user?.role === 'admin';
    const models = modelService.applyEffectiveEnabled(modelService.getAllModelsForUser(userId, isAdmin), userId).map(sanitizeModel);
    const response: ApiResponse = {
      success: true,
      data: models
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

// Get models by stage
router.get('/stage/:stage', (req, res) => {
  try {
    const { stage } = req.params;
    const userId = (req as any).user?.id as string | undefined;
    const isAdmin = (req as any).user?.role === 'admin';
    const models = modelService.getModelsByStageForUser(stage, userId, isAdmin).map(sanitizeModel);
    const response: ApiResponse = {
      success: true,
      data: models
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

// Get model by ID
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id as string | undefined;
    const isAdmin = (req as any).user?.role === 'admin';
    const model = modelService.getModelByIdForUser(id, userId, isAdmin);

    if (!model) {
      const response: ApiResponse = {
        success: false,
        error: 'Model not found'
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data: sanitizeModel(model)
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

// Create model
router.post('/', (req, res) => {
  try {
    const dto: CreateModelConfigDto = req.body;
    const userId = (req as any).user?.id as string | undefined;
    const model = modelService.createModel(dto, userId);
    const response: ApiResponse = {
      success: true,
      data: sanitizeModel(model),
      message: 'Model created successfully'
    };
    res.status(201).json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(response);
  }
});

// Update model
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const dto: UpdateModelConfigDto = { ...req.body, id };
    const userId = (req as any).user?.id as string | undefined;
    const isAdmin = (req as any).user?.role === 'admin';
    const model = modelService.updateModel(dto, userId, isAdmin);

    if (!model) {
      const response: ApiResponse = {
        success: false,
        error: 'Model not found'
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data: sanitizeModel(model),
      message: 'Model updated successfully'
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

// Delete model
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id as string | undefined;
    const isAdmin = (req as any).user?.role === 'admin';
    const success = modelService.deleteModel(id, userId, isAdmin);

    if (!success) {
      const response: ApiResponse = {
        success: false,
        error: 'Model not found'
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse = {
      success: true,
      message: 'Model deleted successfully'
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

// Test model connection
router.post('/:id/test', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id as string | undefined;
    const isAdmin = (req as any).user?.role === 'admin';
    const model = modelService.getModelByIdForUser(id, userId, isAdmin);

    if (!model) {
      const response: ApiResponse = {
        success: false,
        error: 'Model not found'
      };
      return res.status(404).json(response);
    }

    const isConnected = await llmService.testConnection(model);

    const response: ApiResponse = {
      success: true,
      data: { connected: isConnected },
      message: isConnected ? 'Connection successful' : 'Connection failed'
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

// Reorder models
router.post('/stage/:stage/reorder', (req, res) => {
  try {
    const { stage } = req.params;
    const { modelIds } = req.body as { modelIds: string[] };

    if (!Array.isArray(modelIds)) {
      const response: ApiResponse = {
        success: false,
        error: 'modelIds must be an array'
      };
      return res.status(400).json(response);
    }

    const userId = (req as any).user?.id as string | undefined;
    const isAdmin = (req as any).user?.role === 'admin';
    modelService.reorderModels(stage, modelIds, userId, isAdmin);

    const response: ApiResponse = {
      success: true,
      message: 'Models reordered successfully'
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

// Set per-user preference for model enable/disable (non-owner allowed)
router.post('/:id/pref', (req, res) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body as { enabled?: boolean };
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ success: false, error: 'enabled must be boolean' });
    }
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });
    const model = modelService.getModelByIdForUser(id, userId, (req as any).user?.role === 'admin');
    if (!model) return res.status(404).json({ success: false, error: 'Model not found' });
    modelService.setUserPreference(userId, id, enabled);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'Failed' });
  }
});

export default router;
