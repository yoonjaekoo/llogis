"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processSubmission = exports.calculateDifficultyFromSolveRate = exports.getTier = void 0;
const pg_1 = require("pg");
const gameSystemService_1 = require("./gameSystemService");
const pool = new pg_1.Pool({
    user: process.env.DB_USER || 'mathuser',
    host: process.env.DB_HOST || 'db',
    database: process.env.DB_NAME || 'math_solved',
    password: process.env.DB_PASSWORD || 'mathpass',
    port: parseInt(process.env.DB_PORT || '5432'),
});
const MIN_REWARD = 5000;
const MAX_REWARD = 150000;
const getDefaultDifficulty = (isCustom) => isCustom ? 60000 : 10000;
const getTier = (rating) => {
    if (rating < 100000)
        return 'Bronze';
    if (rating < 300000)
        return 'Silver';
    if (rating < 800000)
        return 'Gold';
    if (rating < 2000000)
        return 'Platinum';
    if (rating < 5000000)
        return 'Diamond';
    if (rating < 12000000)
        return 'Ruby';
    if (rating < 30000000)
        return 'Master';
    if (rating < 70000000)
        return 'God';
    if (rating < 150000000)
        return 'Hacker';
    if (rating < 300000000)
        return '치피치피차파차파';
    if (rating < 600000000)
        return 'ChatGPT';
    if (rating < 1200000000)
        return '출제자';
    if (rating < 2500000000)
        return '주인장';
    return '정답';
};
exports.getTier = getTier;
const getWrongAnswerPenalty = (rating) => {
    const tier = (0, exports.getTier)(rating);
    if (tier === 'Bronze')
        return 500;
    if (tier === 'Silver')
        return 1000;
    if (tier === 'Gold')
        return 2000;
    return 3000;
};
const calculateDifficultyFromSolveRate = (solveRate) => {
    if (solveRate < 0 || solveRate > 1 || isNaN(solveRate))
        return 10000;
    return Math.round(MAX_REWARD - (MAX_REWARD - MIN_REWARD) * solveRate);
};
exports.calculateDifficultyFromSolveRate = calculateDifficultyFromSolveRate;
const processSubmission = async (userId, problemId, isCorrect) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // 1. 일일 초기화 및 새 퀘스트 배정 검사
        await (0, gameSystemService_1.handleDailyReset)(userId, client);
        // 2. 스트릭 만료 검사 및 자동 스트릭 복구 시도
        const repairResult = await (0, gameSystemService_1.checkAndRepairStreak)(userId, client);
        // 3. 문제 정보 조회 (is_custom에 따라 기본 보상 10000/60000)
        const problemRes = await client.query('SELECT is_custom, current_difficulty FROM problems WHERE id = $1', [problemId]);
        if (problemRes.rows.length === 0) {
            throw new Error('Problem not found');
        }
        const { is_custom, current_difficulty } = problemRes.rows[0];
        const defaultDifficulty = getDefaultDifficulty(is_custom);
        const rewardRating = current_difficulty != null ? parseFloat(current_difficulty) : defaultDifficulty;
        // 4. 피버타임 확인 및 적용
        const feverRes = await client.query('SELECT fever_multiplier, fever_expires_at FROM users WHERE id = $1', [userId]);
        let feverMultiplier = 1;
        let feverActive = false;
        if (feverRes.rows.length > 0) {
            const fm = feverRes.rows[0].fever_multiplier;
            const expiresAt = feverRes.rows[0].fever_expires_at;
            if (expiresAt && new Date(expiresAt) > new Date() && fm && fm > 1) {
                feverMultiplier = fm;
                feverActive = true;
            }
            else if (expiresAt && new Date(expiresAt) <= new Date()) {
                // 만료된 피버타임 초기화
                await client.query('UPDATE users SET fever_multiplier = 1.0, fever_expires_at = NULL WHERE id = $1', [userId]);
            }
        }
        const feverDescription = feverActive ? ` (🔥${feverMultiplier}배 피버타임 적용)` : '';
        // 5. 레이팅 계산 (정답률 기반 current_difficulty를 보상으로 사용)
        const userRes = await client.query('SELECT rating FROM users WHERE id = $1 FOR UPDATE', [userId]);
        if (userRes.rows.length === 0) {
            throw new Error('User not found');
        }
        const currentRating = parseFloat(userRes.rows[0].rating);
        const baseDelta = isCorrect ? rewardRating : -getWrongAnswerPenalty(currentRating);
        const ratingDelta = isCorrect ? Math.round(baseDelta * feverMultiplier) : baseDelta;
        const finalRating = Math.max(0, currentRating + ratingDelta);
        await client.query('UPDATE users SET rating = $1 WHERE id = $2', [finalRating, userId]);
        const activityType = isCorrect ? 'correct_reward' : 'wrong_penalty';
        const activityDescription = isCorrect
            ? `정답 제출 보상 +${Math.round(rewardRating).toLocaleString()} RP${feverDescription}`
            : `오답 패널티 -${Math.abs(Math.round(ratingDelta)).toLocaleString()} RP`;
        await client.query(`INSERT INTO rating_activity_logs (
        user_id, problem_id, activity_type, change_amount, before_rating, after_rating, description
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
            userId,
            problemId,
            activityType,
            Math.round(ratingDelta),
            currentRating,
            finalRating,
            activityDescription,
        ]);
        // 6. 스트릭 및 토큰 지급 로직 실행
        let streakResult = { newStreak: 0, bonusTokens: 0 };
        let finalTokens = 0;
        if (isCorrect) {
            streakResult = await (0, gameSystemService_1.updateStreak)(userId, client);
            finalTokens = await (0, gameSystemService_1.updateTokens)(userId, client, isCorrect);
            await (0, gameSystemService_1.updateQuests)(userId, client, 'solve');
            await (0, gameSystemService_1.updateQuests)(userId, client, 'streak');
            await client.query('UPDATE users SET problems_solved = problems_solved + 1 WHERE id = $1', [userId]);
        }
        else {
            await (0, gameSystemService_1.updateQuests)(userId, client, 'attempt');
        }
        // 7. 제출 기록 저장
        await client.query('INSERT INTO submissions (user_id, problem_id, is_correct) VALUES ($1, $2, $3)', [userId, problemId, isCorrect]);
        // 8. 문제 정답률 업데이트 및 난이도 재계산
        await client.query(`UPDATE problems SET 
        total_attempts = total_attempts + 1,
        correct_attempts = correct_attempts + $1
      WHERE id = $2`, [isCorrect ? 1 : 0, problemId]);
        const counterRes = await client.query('SELECT total_attempts, correct_attempts FROM problems WHERE id = $1', [problemId]);
        if (counterRes.rows.length > 0) {
            const { total_attempts, correct_attempts } = counterRes.rows[0];
            const solveRate = total_attempts > 0 ? correct_attempts / total_attempts : 0.5;
            const newDifficulty = (0, exports.calculateDifficultyFromSolveRate)(solveRate);
            await client.query('UPDATE problems SET current_difficulty = $1 WHERE id = $2', [newDifficulty, problemId]);
        }
        // 9. 업데이트 완료된 최신 유저 정보 조회
        const finalUserRes = await client.query('SELECT streak, tokens, xp, quests, last_active_date, streak_repaired, longest_streak, problems_solved FROM users WHERE id = $1', [userId]);
        const finalUser = finalUserRes.rows[0];
        await client.query('COMMIT');
        return {
            newUserRating: finalRating,
            tier: (0, exports.getTier)(finalRating),
            streak: finalUser.streak,
            tokens: finalUser.tokens,
            xp: finalUser.xp,
            quests: finalUser.quests,
            streakRepaired: repairResult.repaired,
            streakRepairedFlag: finalUser.streak_repaired,
            problems_solved: finalUser.problems_solved,
            feverActive,
            feverMultiplier
        };
    }
    catch (err) {
        await client.query('ROLLBACK');
        throw err;
    }
    finally {
        client.release();
    }
};
exports.processSubmission = processSubmission;
