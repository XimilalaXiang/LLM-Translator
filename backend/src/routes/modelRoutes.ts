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
    const models = modelService.getAllModels().map(sanitizeModel);
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
    const models = modelService.getModelsByStage(stage).map(sanitizeModel);
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
    const model = modelService.getModelById(id);

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
    const model = modelService.createModel(dto);
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
    const model = modelService.updateModel(dto);

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
    const success = modelService.deleteModel(id);

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
    const model = modelService.getModelById(id);

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

    modelService.reorderModels(stage, modelIds);

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

export default router;
