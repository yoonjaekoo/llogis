"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processSubmission = exports.getTier = void 0;
const pg_1 = require("pg");
const glicko2_1 = require("./glicko2");
const gameSystemService_1 = require("./gameSystemService");
const pool = new pg_1.Pool({
    user: process.env.DB_USER || 'mathuser',
    host: process.env.DB_HOST || 'db',
    database: process.env.DB_NAME || 'math_solved',
    password: process.env.DB_PASSWORD || 'mathpass',
    port: parseInt(process.env.DB_PORT || '5432'),
});
const engine = new glicko2_1.Glicko2Engine();
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
const processSubmission = async (userId, problemId, isCorrect) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // 1. 일일 초기화 및 새 퀘스트 배정 검사
        await (0, gameSystemService_1.handleDailyReset)(userId, client);
        // 2. 스트릭 만료 검사 및 자동 스트릭 복구 시도
        const repairResult = await (0, gameSystemService_1.checkAndRepairStreak)(userId, client);
        // 3. 문제 정보 조회 (커스텀 보상 레이팅 확인)
        const problemRes = await client.query('SELECT is_custom, custom_reward_rating FROM problems WHERE id = $1', [problemId]);
        if (problemRes.rows.length === 0) {
            throw new Error('Problem not found');
        }
        const problem = problemRes.rows[0];
        const rewardRating = problem.is_custom && problem.custom_reward_rating > 0
            ? parseFloat(problem.custom_reward_rating)
            : 10000;
        // 4. 기존 레이팅 계산 로직 실행
        const userRes = await client.query('SELECT rating FROM users WHERE id = $1 FOR UPDATE', [userId]);
        if (userRes.rows.length === 0) {
            throw new Error('User not found');
        }
        const currentRating = parseFloat(userRes.rows[0].rating);
        const finalRating = isCorrect ? currentRating + rewardRating : currentRating;
        await client.query('UPDATE users SET rating = $1 WHERE id = $2', [finalRating, userId]);
        // 5. 스트릭 및 토큰 지급 로직 실행
        let streakResult = { newStreak: 0, bonusTokens: 0 };
        let finalTokens = 0;
        if (isCorrect) {
            // 스트릭 업데이트 및 보너스 토큰
            streakResult = await (0, gameSystemService_1.updateStreak)(userId, client);
            // 기본 토큰 지급 (+1)
            finalTokens = await (0, gameSystemService_1.updateTokens)(userId, client, isCorrect);
            // 퀘스트 업데이트 ('solve' 및 최초 일일 스트릭 보상 액션 체크)
            await (0, gameSystemService_1.updateQuests)(userId, client, 'solve');
            await (0, gameSystemService_1.updateQuests)(userId, client, 'streak');
        }
        else {
            // 오답인 경우 시도(attempt)만 기록하여 정확도 퀘스트 갱신
            await (0, gameSystemService_1.updateQuests)(userId, client, 'attempt');
        }
        // 6. 제출 기록 저장
        await client.query('INSERT INTO submissions (user_id, problem_id, is_correct) VALUES ($1, $2, $3)', [userId, problemId, isCorrect]);
        // 7. 업데이트 완료된 최신 유저 정보 조회
        const finalUserRes = await client.query('SELECT streak, tokens, xp, quests, last_active_date, streak_repaired, longest_streak FROM users WHERE id = $1', [userId]);
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
            streakRepairedFlag: finalUser.streak_repaired
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
