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
  if (rating < 800) return 'Bronze';
  if (rating < 1200) return 'Silver';
  if (rating < 1600) return 'Gold';
  if (rating < 2000) return 'Platinum';
  if (rating < 2400) return 'Diamond';
  if (rating < 2800) return 'Ruby';
  if (rating < 3200) return 'Master';
  if (rating < 3600) return 'God';
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

    const userData: Rating = {
      rating: parseFloat(userRes.rows[0].rating),
      rd: parseFloat(userRes.rows[0].rd),
      volatility: parseFloat(userRes.rows[0].volatility),
    };

    const problemData: Rating = {
      rating: parseFloat(problemRes.rows[0].rating),
      rd: 100,
      volatility: 0.06,
    };

    const result = isCorrect ? 1.0 : 0.0;
    const newUserRating = engine.updateRating(userData, problemData, result);
    const newProblemRating = engine.updateRating(problemData, userData, 1.0 - result);

    await client.query(
      'UPDATE users SET rating = $1, rating_deviation = $2, volatility = $3 WHERE id = $4',
      [newUserRating.rating, newUserRating.rd, newUserRating.volatility, userId]
    );

    await client.query(
      'UPDATE problems SET current_difficulty = $1 WHERE id = $2',
      [newProblemRating.rating, problemId]
    );

    await client.query(
      'INSERT INTO submissions (user_id, problem_id, is_correct) VALUES ($1, $2, $3)',
      [userId, problemId, isCorrect]
    );

    await client.query('COMMIT');
    return { 
      newUserRating, 
      newProblemDifficulty: newProblemRating.rating,
      tier: getTier(newUserRating.rating)
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
