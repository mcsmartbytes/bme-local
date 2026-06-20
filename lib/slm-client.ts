/**
 * SLM client for books-made-easy-local.
 * Loads GGUF models from the local Models directory via node-llama-cpp.
 * Output is always treated as untrusted text (see CAT7 tests).
 */

import fs from 'fs';
import path from 'path';

const MODELS_DIR = process.env.MODELS_PATH
  || (process.platform === 'win32' ? 'C:\\Users\\Michelle\\Models' : '/mnt/c/Users/Michelle/Models');

const DEFAULT_MODEL = 'Qwen3-4B-Q4_K_M.gguf';
const MAX_OUTPUT_CHARS = 500;

export interface SLMRequest {
  prompt: string;
  maxTokens?: number;
}

export interface SLMResponse {
  text: string;
  modelUsed?: string;
  source?: 'local' | 'fallback';
}

type SlmRuntime = {
  completion: { generateCompletion: (prompt: string, opts: Record<string, unknown>) => Promise<string> };
  modelFile: string;
};

let runtimePromise: Promise<SlmRuntime | null> | null = null;

export function getModelsDir() {
  return MODELS_DIR;
}

export function sanitizeSlmOutput(text: string): string {
  const cleaned = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim();
  return cleaned.length > MAX_OUTPUT_CHARS ? cleaned.slice(0, MAX_OUTPUT_CHARS) : cleaned;
}

function fallbackText(req: SLMRequest): string {
  return sanitizeSlmOutput(
    `Analysis: Operations require review this period. Recommendation: check overdue invoices and cash position. (${req.prompt.slice(0, 80)}…)`,
  );
}

function stubResponse(req: SLMRequest, modelFile?: string): SLMResponse {
  return {
    text: fallbackText(req),
    modelUsed: modelFile ?? 'fallback',
    source: 'fallback',
  };
}

async function loadRuntime(): Promise<SlmRuntime | null> {
  if (process.env.SLM_DISABLED === 'true') return null;

  const modelFile = process.env.SLM_MODEL || DEFAULT_MODEL;
  const modelPath = path.join(MODELS_DIR, modelFile);

  if (!fs.existsSync(modelPath)) {
    console.error('[slm] model not found:', modelPath);
    return null;
  }

  try {
    const { getLlama, LlamaCompletion } = await import('node-llama-cpp');
    const llama = await getLlama({ gpu: process.env.SLM_GPU === 'true' ? 'auto' : false });
    const model = await llama.loadModel({ modelPath });
    const context = await model.createContext({
      contextSize: Number(process.env.SLM_CONTEXT_SIZE || 2048),
    });
    const completion = new LlamaCompletion({ contextSequence: context.getSequence() });

    console.log('[slm] loaded', modelFile, 'from', MODELS_DIR);
    return { completion, modelFile };
  } catch (err) {
    console.error('[slm] failed to load model:', err);
    return null;
  }
}

async function getRuntime(): Promise<SlmRuntime | null> {
  if (!runtimePromise) runtimePromise = loadRuntime();
  return runtimePromise;
}

export async function runSLM(req: SLMRequest): Promise<SLMResponse> {
  const runtime = await getRuntime();
  if (!runtime) return stubResponse(req);

  const wrappedPrompt = [
    'You are a bookkeeping advisor for a small business.',
    'Reply in plain English only. Be direct and specific. No bullet lists.',
    '',
    req.prompt,
    '',
    'Response:',
  ].join('\n');

  try {
    const raw = await runtime.completion.generateCompletion(wrappedPrompt, {
      maxTokens: req.maxTokens ?? 120,
      temperature: 0.3,
    });
    const text = sanitizeSlmOutput(raw);
    if (!text) return stubResponse(req, runtime.modelFile);

    return {
      text,
      modelUsed: runtime.modelFile,
      source: 'local',
    };
  } catch (err) {
    console.error('[slm] inference error:', err);
    return stubResponse(req, runtime.modelFile);
  }
}