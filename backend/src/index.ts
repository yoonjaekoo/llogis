import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { processSubmission, getTier } from './rating/ratingService';
import { generateProblem } from './problemGenerator';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

const pool = new Pool({
  user: process.env.DB_USER || 'mathuser',
  host: process.env.DB_HOST || 'db',
  database: process.env.DB_NAME || 'math_solved',
  password: process.env.DB_PASSWORD || 'mathpass',
  port: parseInt(process.env.DB_PORT || '5432'),
});

app.use(cors());
app.use(express.json());

const authenticateToken = (req: any, res: any, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });
  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

app.post('/api/auth/signup', async (req: Request, res: Response) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: 'All fields are required' });
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, rating',
      [username, email, hashedPassword]
    );
    const user = result.rows[0];
    res.status(201).json({ 
      message: 'User created successfully', 
      user: { ...user, tier: getTier(user.rating) } 
    });
  } catch (err: any) {
    if (err.code === '23505') return res.status(400).json({ error: 'Username already exists' });
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  try {
    // Try to find user by email or username
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1 OR username = $1', [email]);
    const user = userResult.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ 
      token, 
      user: { 
        id: user.id, 
        username: user.username, 
        rating: user.rating,
        tier: getTier(user.rating)
      } 
    });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/users/profile', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const userResult = await pool.query(
      'SELECT id, username, email, rating, created_at FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    
    const user = userResult.rows[0];
    
    // Get submission statistics
    const statsResult = await pool.query(
      'SELECT COUNT(*) as total, SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct FROM submissions WHERE user_id = $1',
      [userId]
    );
    
    const stats = statsResult.rows[0];
    
    res.json({
      user: {
        ...user,
        tier: getTier(user.rating)
      },
      stats: {
        totalSubmissions: parseInt(stats.total),
        correctSubmissions: parseInt(stats.correct || 0),
        accuracy: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

app.post('/api/users/change-password', authenticateToken, async (req: any, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Both current and new passwords are required' });
  }

  try {
    const userResult = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    const user = userResult.rows[0];

    if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid current password' });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashedNewPassword, userId]);

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to change password' });
  }
});

app.get('/api/users/ranking', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT username, rating FROM users ORDER BY rating DESC LIMIT 50'
    );
    const users = result.rows.map(u => ({
      ...u,
      tier: getTier(u.rating)
    }));
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch ranking' });
  }
});

app.get('/api/problems', async (req: Request, res: Response) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  let userId: number | null = null;

  if (token) {
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      userId = decoded.id;
    } catch (err) {
      // Ignore token errors for this endpoint
    }
  }

  try {
    let query = `
      SELECT p.id, p.title, p.content, p.current_difficulty, 
             COALESCE(NULLIF(array_agg(t.name), '{NULL}'), '{}') as tags
      FROM problems p
      LEFT JOIN problem_tags pt ON p.id = pt.problem_id
      LEFT JOIN tags t ON pt.tag_id = t.id
    `;

    if (userId) {
      query += `
        WHERE p.id NOT IN (
          SELECT problem_id FROM submissions WHERE user_id = $1 AND is_correct = true
        )
      `;
    }

    query += `
      GROUP BY p.id
      ORDER BY p.id ASC
    `;

    let result = await (userId 
      ? pool.query(query, [userId]) 
      : pool.query(query));

    // If no problems exist in the database at all, generate some!
    if (result.rows.length === 0 && !userId) {
       console.log("No problems found in database. Generating initial batch...");
       // This is a simplified fallback
       const countRes = await pool.query('SELECT COUNT(*) FROM problems');
       if (parseInt(countRes.rows[0].count) === 0) {
           // If DB is literally empty, we could trigger generation here or just return []
           // For now, let's just log it.
       }
    }

    console.log(`Fetched ${result.rows.length} problems for user ${userId}`);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching problems:', err);
    res.status(500).json({ error: 'Failed to fetch problems' });
  }
});

app.post('/api/problems/generate', authenticateToken, async (req: Request, res: Response) => {
  try {
    const newProblems = [];
    for (let i = 0; i < 5; i++) {
      const p = generateProblem();
      const result = await pool.query(
        'INSERT INTO problems (title, content, answer, initial_difficulty, current_difficulty, type) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        [p.title, p.content, p.answer, p.difficulty, p.difficulty, 'Calculation']
      );
      const problemId = result.rows[0].id;
      
      // Add tags
      for (const tagName of p.tags) {
        const tagRes = await pool.query('SELECT id FROM tags WHERE name = $1', [tagName]);
        if (tagRes.rows.length > 0) {
          await pool.query('INSERT INTO problem_tags (problem_id, tag_id) VALUES ($1, $2)', [problemId, tagRes.rows[0].id]);
        }
      }
      const { answer, ...problemWithoutAnswer } = p;
      newProblems.push({ id: problemId, ...problemWithoutAnswer });
    }
    res.json({ message: '5 new problems generated!', problems: newProblems });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate problems' });
  }
});

app.post('/api/submissions', authenticateToken, async (req: any, res: any) => {
  const { problemId, userAnswer } = req.body;
  const userId = req.user.id;

  try {
    // 이미 맞힌 문제인지 확인
    const existingSubmission = await pool.query(
      'SELECT id FROM submissions WHERE user_id = $1 AND problem_id = $2 AND is_correct = true',
      [userId, problemId]
    );

    if (existingSubmission.rows.length > 0) {
      return res.status(400).json({ error: 'Already solved this problem correctly!' });
    }

    // DB에서 실제 정답 가져오기
    const problemRes = await pool.query('SELECT answer FROM problems WHERE id = $1', [problemId]);
    if (problemRes.rows.length === 0) return res.status(404).json({ error: 'Problem not found' });

    const correctAnswer = problemRes.rows[0].answer;
    // 공백 전체 제거 및 소문자 변환 후 비교 (더 견고한 체크)
    const normalizedUserAnswer = userAnswer.replace(/\s+/g, '').toLowerCase();
    const normalizedCorrectAnswer = correctAnswer.replace(/\s+/g, '').toLowerCase();
    const isCorrect = normalizedUserAnswer === normalizedCorrectAnswer;

    const updateResult = await processSubmission(userId, problemId, isCorrect);
    res.json({ 
      message: isCorrect ? 'Correct answer!' : 'Wrong answer.',
      isCorrect,
      correctAnswer: isCorrect ? undefined : correctAnswer, // 틀렸을 때만 정답 공개 (선택 사항)
      ...updateResult 
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process submission' });
  }
});

app.post('/api/admin/seed', authenticateToken, async (req: any, res: Response) => {
  // Simple check if user is 'admin'
  if (req.user.username !== 'admin') return res.status(403).json({ error: 'Admin only' });
  
  try {
    // Trigger generation of 10 problems
    const generated = [];
    for (let i = 0; i < 10; i++) {
        const p = generateProblem();
        const result = await pool.query(
            'INSERT INTO problems (title, content, answer, initial_difficulty, current_difficulty, type) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
            [p.title, p.content, p.answer, p.difficulty, p.difficulty, 'Calculation']
        );
        generated.push(result.rows[0].id);
    }
    res.json({ message: '10 problems added successfully', ids: generated });
  } catch (err) {
    res.status(500).json({ error: 'Seeding failed' });
  }
});

app.post('/api/admin/reset', authenticateToken, async (req: any, res: Response) => {
  // Simple check if user is 'admin'
  if (req.user.username !== 'admin') return res.status(403).json({ error: 'Admin only' });
  
  try {
    await pool.query('TRUNCATE problems, submissions RESTART IDENTITY CASCADE');
    res.json({ message: 'Database reset successfully (all problems and submissions cleared)' });
  } catch (err) {
    res.status(500).json({ error: 'Database reset failed' });
  }
});

// --- User Management Admin APIs ---

app.get('/api/admin/users', authenticateToken, async (req: any, res: Response) => {
  if (req.user.username !== 'admin') return res.status(403).json({ error: 'Admin only' });
  
  try {
    const result = await pool.query(`
      SELECT u.id, u.username, u.email, u.rating, u.created_at,
             COUNT(s.id) as total_submissions,
             SUM(CASE WHEN s.is_correct THEN 1 ELSE 0 END) as correct_submissions
      FROM users u
      LEFT JOIN submissions s ON u.id = s.user_id
      GROUP BY u.id
      ORDER BY u.rating DESC
    `);
    const users = result.rows.map(u => ({
      ...u,
      tier: getTier(parseFloat(u.rating)),
      total_submissions: parseInt(u.total_submissions),
      correct_submissions: parseInt(u.correct_submissions || 0)
    }));
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.patch('/api/admin/users/:id/rating', authenticateToken, async (req: any, res: Response) => {
  if (req.user.username !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { id } = req.params;
  const { rating } = req.body;
  
  try {
    const result = await pool.query(
      'UPDATE users SET rating = $1 WHERE id = $2 RETURNING id, username, rating',
      [rating, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'Rating updated successfully', user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update rating' });
  }
});

app.delete('/api/admin/users/:id', authenticateToken, async (req: any, res: Response) => {
  if (req.user.username !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { id } = req.params;
  
  try {
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id, username', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ message: `User ${result.rows[0].username} deleted successfully` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
