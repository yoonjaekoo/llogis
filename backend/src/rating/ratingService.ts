import { Pool } from 'pg';
import { Glicko2Engine } from './glicko2';
import { 
  checkAndRepairStreak, 
  handleDailyReset, 
  updateStreak, 
  updateTokens, 
  updateQuests 
} from './gameSystemService';

const pool = new Pool({
  user: process.env.DB_USER || 'mathuser',
  host: process.env.DB_HOST || 'db',
  database: process.env.DB_NAME || 'math_solved',
  password: process.env.DB_PASSWORD || 'mathpass',
  port: parseInt(process.env.DB_PORT || '5432'),
});

const engine = new Glicko2Engine();

export const getTier = (rating: number): string => {
  if (rating < 100000) return 'Bronze';
  if (rating < 300000) return 'Silver';
  if (rating < 800000) return 'Gold';
  if (rating < 2000000) return 'Platinum';
  if (rating < 5000000) return 'Diamond';
  if (rating < 12000000) return 'Ruby';
  if (rating < 30000000) return 'Master';
  if (rating < 70000000) return 'God';
  if (rating < 150000000) return 'Hacker';
  if (rating < 300000000) return '치피치피차파차파';
  if (rating < 600000000) return 'ChatGPT';
  if (rating < 1200000000) return '출제자';
  if (rating < 2500000000) return '주인장';
  return '정답';
};

const getWrongAnswerPenalty = (rating: number): number => {
  const tier = getTier(rating);
  if (tier === 'Bronze') return 500;
  if (tier === 'Silver') return 1000;
  if (tier === 'Gold') return 2000;
  return 3000;
};

export const processSubmission = async (userId: number, problemId: number, isCorrect: boolean) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. 일일 초기화 및 새 퀘스트 배정 검사
    await handleDailyReset(userId, client);

    // 2. 스트릭 만료 검사 및 자동 스트릭 복구 시도
    const repairResult = await checkAndRepairStreak(userId, client);

    // 3. 문제 정보 조회 (커스텀 보상 레이팅 확인)
    const problemRes = await client.query(
      'SELECT is_custom, custom_reward_rating, reward_rating FROM problems WHERE id = $1',
      [problemId]
    );
    if (problemRes.rows.length === 0) {
      throw new Error('Problem not found');
    }
    const problem = problemRes.rows[0];
    const rewardRating =
      problem.reward_rating !== null && problem.reward_rating !== undefined
        ? parseFloat(problem.reward_rating)
        : problem.is_custom && problem.custom_reward_rating > 0
          ? parseFloat(problem.custom_reward_rating)
          : 10000;

    // 4. 기존 레이팅 계산 로직 실행
    const userRes = await client.query(
      'SELECT rating FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    );
    
    if (userRes.rows.length === 0) {
      throw new Error('User not found');
    }

    const currentRating = parseFloat(userRes.rows[0].rating);
    const ratingDelta = isCorrect ? rewardRating : -getWrongAnswerPenalty(currentRating);
    const finalRating = Math.max(0, currentRating + ratingDelta);

    await client.query(
      'UPDATE users SET rating = $1 WHERE id = $2',
      [finalRating, userId]
    );

    const activityType = isCorrect ? 'correct_reward' : 'wrong_penalty';
    const activityDescription = isCorrect
      ? `정답 제출 보상 +${Math.round(rewardRating).toLocaleString()} RP`
      : `오답 패널티 -${Math.abs(Math.round(ratingDelta)).toLocaleString()} RP`;
    await client.query(
      `INSERT INTO rating_activity_logs (
        user_id, problem_id, activity_type, change_amount, before_rating, after_rating, description
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        userId,
        problemId,
        activityType,
        Math.round(ratingDelta),
        currentRating,
        finalRating,
        activityDescription,
      ]
    );

    // 5. 스트릭 및 토큰 지급 로직 실행
    let streakResult = { newStreak: 0, bonusTokens: 0 };
    let finalTokens = 0;

    if (isCorrect) {
      // 스트릭 업데이트 및 보너스 토큰
      streakResult = await updateStreak(userId, client);
      // 기본 토큰 지급 (+1)
      finalTokens = await updateTokens(userId, client, isCorrect);
      // 퀘스트 업데이트 ('solve' 및 최초 일일 스트릭 보상 액션 체크)
      await updateQuests(userId, client, 'solve');
      await updateQuests(userId, client, 'streak');
      // problems_solved 증가 (데이터베이스에 저장되어 문제 초기화 시에도 유지)
      await client.query('UPDATE users SET problems_solved = problems_solved + 1 WHERE id = $1', [userId]);
    } else {
      // 오답인 경우 시도(attempt)만 기록하여 정확도 퀘스트 갱신
      await updateQuests(userId, client, 'attempt');
    }

    // 6. 제출 기록 저장
    await client.query(
      'INSERT INTO submissions (user_id, problem_id, is_correct) VALUES ($1, $2, $3)',
      [userId, problemId, isCorrect]
    );

    // 7. 업데이트 완료된 최신 유저 정보 조회
    const finalUserRes = await client.query(
      'SELECT streak, tokens, xp, quests, last_active_date, streak_repaired, longest_streak, problems_solved FROM users WHERE id = $1',
      [userId]
    );
    const finalUser = finalUserRes.rows[0];

    await client.query('COMMIT');

    return { 
      newUserRating: finalRating,
      tier: getTier(finalRating),
      streak: finalUser.streak,
      tokens: finalUser.tokens,
      xp: finalUser.xp,
      quests: finalUser.quests,
      streakRepaired: repairResult.repaired,
      streakRepairedFlag: finalUser.streak_repaired,
      problems_solved: finalUser.problems_solved
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
