"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateNimProblems = generateNimProblems;
const NIM_API_URL = process.env.NIM_API_URL || 'https://integrate.api.nvidia.com/v1/chat/completions';
function extractBetween(text, startMarker, endMarker) {
    const startIdx = text.indexOf(startMarker);
    if (startIdx === -1)
        return '';
    const afterStart = text.slice(startIdx + startMarker.length);
    const endIdx = afterStart.indexOf(endMarker);
    if (endIdx === -1)
        return afterStart.trim();
    return afterStart.slice(0, endIdx).trim();
}
function parseGeneratedProblem(content) {
    const title = extractBetween(content, 'Title:', 'Content:');
    const problemContent = extractBetween(content, 'Content:', 'Answer:');
    const answer = extractBetween(content, 'Answer:', 'Tags:');
    const tagsRaw = extractBetween(content, 'Tags:', 'Difficulty:');
    const difficultyRaw = extractBetween(content, 'Difficulty:', '');
    if (!title || !problemContent || !answer)
        return null;
    const tags = tagsRaw
        .split(/[,،]/)
        .map(t => t.trim())
        .filter(Boolean);
    const difficulty = parseInt(difficultyRaw) || 75000;
    return { title, content: problemContent, answer, tags, difficulty };
}
async function generateNimProblems(apiKey, count = 5) {
    const tagsList = ['일차방정식', '연립방정식', '부등식', '일차함수', '식의계산', '도형', '지수법칙', '확률', '통계'];
    const systemPrompt = `You are a Korean math problem generator. Generate math problems in Korean.
Each problem must follow this exact format:

Title: [problem title in Korean]
Content: [problem with LaTeX math using $...$ or $$...$$]
Answer: [numeric answer only]
Tags: [tag1, tag2, ...]
Difficulty: [number between 50000 and 150000]

Available tags: ${tagsList.join(', ')}
Difficulty guidelines: 50000-80000 easy, 80000-110000 medium, 110000-150000 hard.
Ensure the answer is a single integer or simple fraction.
Content must use LaTeX delimiters $...$ for inline and $$...$$ for display math.`;
    const userPrompt = `Generate ${count} different Korean math problems. Each with a unique topic.
For each problem, output the format exactly as specified.
Separate problems with --- on a new line.`;
    try {
        const response = await fetch(NIM_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'meta/llama-3.1-8b-instruct',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                temperature: 0.7,
                max_tokens: 4096,
            }),
        });
        if (!response.ok) {
            throw new Error(`NVIDIA NIM API error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        const generatedText = data.choices?.[0]?.message?.content || '';
        const blocks = generatedText.split(/---/);
        const problems = [];
        for (const block of blocks) {
            const parsed = parseGeneratedProblem(block.trim());
            if (parsed) {
                problems.push(parsed);
            }
        }
        if (problems.length === 0) {
            throw new Error('Failed to parse any problems from NIM response');
        }
        return problems;
    }
    catch (err) {
        console.error('NVIDIA NIM generation error:', err);
        throw err;
    }
}
