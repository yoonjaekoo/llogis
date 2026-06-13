import { readFileSync } from 'fs';
import { join } from 'path';
import {
  generateProblem as engineGenerateProblem,
  generateProblems as engineGenerateProblems,
  batchGenerate,
  resetEngine,
} from './generation/index.js';
import type { ProblemTemplateInput, GeneratedProblem } from './generation/types.js';

const TEMPLATES_PATH = join(__dirname, '..', 'data', 'templates.json');

let templates: ProblemTemplateInput[] | null = null;

function loadTemplates(): ProblemTemplateInput[] {
  if (!templates) {
    const raw = readFileSync(TEMPLATES_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as ProblemTemplateInput[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('templates.json is empty or invalid');
    }
    templates = parsed;
  }
  return templates;
}

export function reloadTemplates(): ProblemTemplateInput[] {
  templates = null;
  return loadTemplates();
}

export function getAllTemplates(): ProblemTemplateInput[] {
  return loadTemplates();
}

export function getTemplateById(id: string): ProblemTemplateInput | undefined {
  return loadTemplates().find((t) => t.id === id);
}

export function getTemplatesByUnit(unit: string): ProblemTemplateInput[] {
  return loadTemplates().filter((t) => t.unit === unit);
}

export function getTemplatesByConcept(concept: string): ProblemTemplateInput[] {
  return loadTemplates().filter((t) => t.concepts?.includes(concept));
}

export function getUnits(): string[] {
  const units = new Set(loadTemplates().map((t) => t.unit).filter(Boolean));
  return [...units] as string[];
}

export function getConcepts(): string[] {
  const concepts = new Set(loadTemplates().flatMap((t) => t.concepts ?? []));
  return [...concepts];
}

export function generateRandomProblem(): GeneratedProblem {
  const pool = loadTemplates();
  const template = pool[Math.floor(Math.random() * pool.length)];
  return engineGenerateProblem(template);
}

export function generateProblemById(id: string): GeneratedProblem | null {
  const template = getTemplateById(id);
  if (!template) return null;
  return engineGenerateProblem(template);
}

export function generateProblems(
  filter?: { unit?: string; concept?: string; count?: number },
): GeneratedProblem[] {
  let pool = loadTemplates();
  if (filter?.unit) {
    pool = pool.filter((t) => t.unit === filter.unit);
  }
  if (filter?.concept) {
    pool = pool.filter((t) => t.concepts?.includes(filter.concept!));
  }
  if (pool.length === 0) {
    throw new Error('No templates match the given filter');
  }

  const count = filter?.count ?? 1;

  if (count <= pool.length) {
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return engineGenerateProblems(shuffled.slice(0, count));
  }

  const results: GeneratedProblem[] = [];
  for (let i = 0; i < count; i++) {
    const template = pool[Math.floor(Math.random() * pool.length)];
    results.push(engineGenerateProblem(template));
  }
  return results;
}

export { batchGenerate, resetEngine };
