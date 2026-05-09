import { Pool } from 'pg';
import { Glicko2Engine, Rating } from './glicko2';

const pool = new Pool({
  user: process.env.DB_USER || 'mathuser',
  host: process.env.DB_HOST || 'db',
  database: process.env.DB_NAME || 'math_solved',
  password: process.env.DB_PASSWORD || 'mathpass',
  port: parseInt(process.env.DB_PORT || '5432'),
});

const engine = new Glicko2Engine();

export const getTier = (rating: number): string => {
  // 티어 구간을 기하급수적으로 늘려 승급에 필요한 문제 수를 대폭 상향
  if (rating < 100000) return 'Bronze';     // 시작 ~ 10만
  if (rating < 300000) return 'Silver';     // +20만 (약 20문제)
  if (rating < 800000) return 'Gold';       // +50만 (약 50문제)
  if (rating < 2000000) return 'Platinum';  // +120만 (약 120문제+)
  if (rating < 5000000) return 'Diamond';   // +300만
  if (rating < 12000000) return 'Ruby';     // +700만
  if (rating < 30000000) return 'Master';   // +1800만
  if (rating < 70000000) return 'God';      // +4000만
  return 'Hacker';
};

export const processSubmission = async (userId: number, problemId: number, isCorrect: boolean) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userRes = await client.query(
      'SELECT rating, rating_deviation as rd, volatility FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    );
    
    const problemRes = await client.query(
      'SELECT current_difficulty as rating FROM problems WHERE id = $1 FOR UPDATE',
      [problemId]
    );

    if (userRes.rows.length === 0 || problemRes.rows.length === 0) {
      throw new Error('User or Problem not found');
    }

    const currentRating = parseFloat(userRes.rows[0].rating);
    
    const userData: Rating = {
      rating: currentRating / 100,
      rd: parseFloat(userRes.rows[0].rd),
      volatility: parseFloat(userRes.rows[0].volatility),
    };

    const problemData: Rating = {
      rating: parseFloat(problemRes.rows[0].rating) / 100,
      rd: 100,
      volatility: 0.06,
    };

    const result = isCorrect ? 1.0 : 0.0;
    const newUserRatingRaw = engine.updateRating(userData, problemData, result);
    
    const newUserRatingScaled = newUserRatingRaw.rating * 100;
    const newProblemRatingScaled = engine.updateRating(problemData, userData, 1.0 - result).rating * 100;

    // 고레벨일수록 성장이 훨씬 더디게 느껴지도록 보정치 강화
    let ratingDiff = newUserRatingScaled - currentRating;
    if (ratingDiff > 0) {
        // 50만점까지는 거의 그대로 상승, 그 이후부터는 상승폭이 급격히 감소
        const scale = 1.0 / (1.0 + Math.pow(Math.max(0, currentRating - 500000) / 1000000, 2));
        ratingDiff *= scale;
    }
    
    const finalRating = currentRating + ratingDiff;

    await client.query(
      'UPDATE users SET rating = $1, rating_deviation = $2, volatility = $3 WHERE id = $4',
      [finalRating, newUserRatingRaw.rd, newUserRatingRaw.volatility, userId]
    );

    await client.query(
      'UPDATE problems SET current_difficulty = $1 WHERE id = $2',
      [newProblemRatingScaled, problemId]
    );

    await client.query(
      'INSERT INTO submissions (user_id, problem_id, is_correct) VALUES ($1, $2, $3)',
      [userId, problemId, isCorrect]
    );

    await client.query('COMMIT');
    return { 
      newUserRating: {
        ...newUserRatingRaw,
        rating: finalRating
      }, 
      newProblemDifficulty: newProblemRatingScaled,
      tier: getTier(finalRating)
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
