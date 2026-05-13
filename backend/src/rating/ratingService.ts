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
  // 레이팅 100배 인플레이션에 맞춰 티어 구간 조정
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

const MAX_RATING = 100000000; // 오버플로우 방지를 위한 최대 레이팅 캡 (1억)

export const processSubmission = async (userId: number, problemId: number, isCorrect: boolean) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userRes = await client.query(
      'SELECT rating FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    );
    
    if (userRes.rows.length === 0) {
      throw new Error('User not found');
    }

    const currentRating = parseFloat(userRes.rows[0].rating);
    const finalRating = isCorrect ? Math.min(MAX_RATING, currentRating + 10000) : currentRating;

    await client.query(
      'UPDATE users SET rating = $1 WHERE id = $2',
      [finalRating, userId]
    );

    await client.query(
      'INSERT INTO submissions (user_id, problem_id, is_correct) VALUES ($1, $2, $3)',
      [userId, problemId, isCorrect]
    );

    await client.query('COMMIT');
    return { 
      newUserRating: finalRating,
      tier: getTier(finalRating)
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
