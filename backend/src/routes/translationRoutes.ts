import { Router } from 'express';
import { translationService } from '../services/translationService';
import { knowledgeService } from '../services/knowledgeService';
import type { ApiResponse, TranslationRequest, TranslationStageResult, ReviewResult, TranslationResponse } from '../types';

const router = Router();

// Start translation
router.post('/', async (req, res) => {
  try {
    const request: TranslationRequest = req.body;

    if (!request.sourceText || request.sourceText.trim().length === 0) {
      const response: ApiResponse = {
        success: false,
        error: 'Source text is required'
      };
      return res.status(400).json(response);
    }
    const userId = (req as any).user?.id as string | undefined;
    const result = await translationService.translate(request, userId);

    const response: ApiResponse = {
      success: true,
      data: result
    };
    res.json(response);
  } catch (error) {
    console.error('Translation error:', error);
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(response);
  }
});

// Get translation history
router.get('/history', (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const userId = (req as any).user?.id as string | undefined;
    const history = translationService.getHistory(limit, userId);

    const response: ApiResponse = {
      success: true,
      data: history
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

// Search translation history by source text
router.get('/history/search', (req, res) => {
  try {
    const q = (req.query.q as string) || '';
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    if (q.trim().length === 0) {
      const response: ApiResponse = { success: true, data: [] };
      return res.json(response);
    }
    const userId = (req as any).user?.id as string | undefined;
    const results = translationService.searchHistory(q, limit, userId);
    const response: ApiResponse = { success: true, data: results };
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(response);
  }
});

// Get translation by ID
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const translation = translationService.getTranslationById(id);

    if (!translation) {
      const response: ApiResponse = {
        success: false,
        error: 'Translation not found'
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data: translation
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

// Progressive translation endpoints

// Start: run Stage 1 and optionally compute knowledge context
router.post('/progress/start', async (req, res) => {
  try {
    const request: TranslationRequest = req.body;
    if (!request.sourceText || request.sourceText.trim().length === 0) {
      const response: ApiResponse = { success: false, error: 'Source text is required' };
      return res.status(400).json(response);
    }

    // Compute knowledge context once if needed
    let knowledgeContext: string[] = [];
    if (request.useKnowledgeBase) {
      const results = await knowledgeService.search({
        query: request.sourceText,
        knowledgeBaseIds: request.knowledgeBaseIds,
        topK: 5
      });
      knowledgeContext = results.map(r => r.content);
    }

    const stage1Results: TranslationStageResult[] = await translationService.runStage1(
      request.sourceText,
      knowledgeContext,
      request.modelIds?.translation
    );

    const partial: Partial<TranslationResponse> & { knowledgeContext?: string[] } = {
      sourceText: request.sourceText,
      stage1Results,
      stage2Results: [],
      stage3Results: [],
      knowledgeContext
    };

    const response: ApiResponse = { success: true, data: partial };
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(response);
  }
});

// Review: run Stage 2 using previous stage results
router.post('/progress/review', async (req, res) => {
  try {
    const { sourceText, stage1Results, knowledgeContext, modelIds } = req.body as {
      sourceText: string;
      stage1Results: TranslationStageResult[];
      knowledgeContext?: string[];
      modelIds?: { review?: string[] };
    };

    if (!sourceText || !Array.isArray(stage1Results)) {
      const response: ApiResponse = { success: false, error: 'sourceText and stage1Results are required' };
      return res.status(400).json(response);
    }

    const stage2Results: ReviewResult[] = await translationService.runStage2(
      sourceText,
      stage1Results,
      knowledgeContext || [],
      modelIds?.review
    );

    const response: ApiResponse = { success: true, data: { stage2Results } };
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(response);
  }
});

// Synthesis: run Stage 3 and finalize (save history)
router.post('/progress/synthesis', async (req, res) => {
  try {
    const { sourceText, stage1Results, stage2Results, knowledgeContext, modelIds } = req.body as {
      sourceText: string;
      stage1Results: TranslationStageResult[];
      stage2Results: ReviewResult[];
      knowledgeContext?: string[];
      modelIds?: { synthesis?: string[] };
    };

    if (!sourceText || !Array.isArray(stage1Results)) {
      const response: ApiResponse = { success: false, error: 'sourceText and stage1Results are required' };
      return res.status(400).json(response);
    }

    const stage3Results: TranslationStageResult[] = await translationService.runStage3(
      sourceText,
      stage1Results,
      stage2Results || [],
      knowledgeContext || [],
      modelIds?.synthesis
    );

    const userId = (req as any).user?.id as string | undefined;
    const final = await translationService.finalizeAndSave(
      sourceText,
      stage1Results,
      stage2Results || [],
      stage3Results,
      userId
    );

    const response: ApiResponse = { success: true, data: final };
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(response);
  }
});
