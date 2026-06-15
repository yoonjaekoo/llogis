"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetEngine = exports.batchGenerate = void 0;
exports.reloadTemplates = reloadTemplates;
exports.getAllTemplates = getAllTemplates;
exports.getTemplateById = getTemplateById;
exports.updateTemplateRewardRating = updateTemplateRewardRating;
exports.getTemplatesByUnit = getTemplatesByUnit;
exports.getTemplatesByConcept = getTemplatesByConcept;
exports.getUnits = getUnits;
exports.getConcepts = getConcepts;
exports.generateRandomProblem = generateRandomProblem;
exports.generateProblemById = generateProblemById;
exports.generateProblems = generateProblems;
const fs_1 = require("fs");
const path_1 = require("path");
const index_js_1 = require("./generation/index.js");
Object.defineProperty(exports, "batchGenerate", { enumerable: true, get: function () { return index_js_1.batchGenerate; } });
Object.defineProperty(exports, "resetEngine", { enumerable: true, get: function () { return index_js_1.resetEngine; } });
const TEMPLATES_PATH = (0, path_1.join)(__dirname, '..', 'data', 'templates.json');
let templates = null;
function normalizeTemplate(template) {
    return {
        ...template,
        reward_rating: typeof template.reward_rating === 'number' ? template.reward_rating : template.difficulty,
    };
}
function loadTemplates() {
    if (!templates) {
        const raw = (0, fs_1.readFileSync)(TEMPLATES_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed) || parsed.length === 0) {
            throw new Error('templates.json is empty or invalid');
        }
        templates = parsed.map(normalizeTemplate);
    }
    return templates;
}
function persistTemplates(nextTemplates) {
    templates = nextTemplates.map(normalizeTemplate);
    (0, fs_1.writeFileSync)(TEMPLATES_PATH, `${JSON.stringify(templates, null, 2)}\n`, 'utf-8');
    return templates;
}
function reloadTemplates() {
    templates = null;
    return loadTemplates();
}
function getAllTemplates() {
    return loadTemplates();
}
function getTemplateById(id) {
    return loadTemplates().find((t) => t.id === id);
}
function updateTemplateRewardRating(id, rewardRating) {
    const current = loadTemplates();
    const index = current.findIndex((t) => t.id === id);
    if (index === -1) {
        throw new Error('Template not found');
    }
    const updated = [...current];
    updated[index] = {
        ...updated[index],
        reward_rating: rewardRating,
    };
    return persistTemplates(updated)[index];
}
function getTemplatesByUnit(unit) {
    return loadTemplates().filter((t) => t.unit === unit);
}
function getTemplatesByConcept(concept) {
    return loadTemplates().filter((t) => t.concepts?.includes(concept));
}
function getUnits() {
    const units = new Set(loadTemplates().map((t) => t.unit).filter(Boolean));
    return [...units];
}
function getConcepts() {
    const concepts = new Set(loadTemplates().flatMap((t) => t.concepts ?? []));
    return [...concepts];
}
function generateRandomProblem() {
    const pool = loadTemplates();
    const template = pool[Math.floor(Math.random() * pool.length)];
    return (0, index_js_1.generateProblem)(template);
}
function generateProblemById(id) {
    const template = getTemplateById(id);
    if (!template)
        return null;
    return (0, index_js_1.generateProblem)(template);
}
function generateProblems(filter) {
    let pool = loadTemplates();
    if (filter?.unit) {
        pool = pool.filter((t) => t.unit === filter.unit);
    }
    if (filter?.concept) {
        pool = pool.filter((t) => t.concepts?.includes(filter.concept));
    }
    if (pool.length === 0) {
        throw new Error('No templates match the given filter');
    }
    const count = filter?.count ?? 1;
    if (count <= pool.length) {
        const shuffled = [...pool].sort(() => Math.random() - 0.5);
        return (0, index_js_1.generateProblems)(shuffled.slice(0, count));
    }
    const results = [];
    for (let i = 0; i < count; i++) {
        const template = pool[Math.floor(Math.random() * pool.length)];
        results.push((0, index_js_1.generateProblem)(template));
    }
    return results;
}
