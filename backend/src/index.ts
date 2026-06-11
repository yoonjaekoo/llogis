import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { processSubmission, getTier } from './rating/ratingService';
import { checkAndRepairStreak, handleDailyReset } from './rating/gameSystemService';
import { generateProblem } from './problemGenerator';
import { generateNimProblems } from './nimGenerator';
import path from 'path';
import fs from 'fs';
import multer from 'multer';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (
    _req: Request,
    _file: Express.Multer.File,
    cb: (err: Error | null, destination: string) => void
  ) => {
    cb(null, uploadsDir);
  },
  filename: (
    _req: Request,
    file: Express.Multer.File,
    cb: (err: Error | null, filename: string) => void
  ) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback
  ) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only images are allowed (jpeg, jpg, png, gif)'));
  },
});

const pool = new Pool({
  user: process.env.DB_USER || 'mathuser',
  host: process.env.DB_HOST || 'db',
  database: process.env.DB_NAME || 'math_solved',
  password: process.env.DB_PASSWORD || 'mathpass',
  port: parseInt(process.env.DB_PORT || '5432'),
});

app.use(cors());
app.use(express.json());
app.disable('x-powered-by');
app.use('/uploads', express.static(uploadsDir, {
  maxAge: '30d',
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, immutable, max-age=2592000');
  }
}));

const ensureSchema = async () => {
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_url TEXT');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS nim_api_key TEXT');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS streak INTEGER DEFAULT 0');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS tokens INTEGER DEFAULT 0');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0');
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_date VARCHAR(10) DEFAULT ''");
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS streak_repaired BOOLEAN DEFAULT FALSE');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS can_generate_problems BOOLEAN DEFAULT FALSE');
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS quests JSONB DEFAULT '[]'");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS equipped_title VARCHAR(50) DEFAULT ''");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS has_firework_effect BOOLEAN DEFAULT FALSE");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS has_developer_chango BOOLEAN DEFAULT FALSE");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS longest_streak INTEGER DEFAULT 0");
  await pool.query('ALTER TABLE problems ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT FALSE');
  await pool.query('ALTER TABLE problems ADD COLUMN IF NOT EXISTS custom_reward_rating FLOAT DEFAULT 0.0');
  await pool.query("ALTER TABLE submissions ADD COLUMN IF NOT EXISTS is_streak_repair BOOLEAN DEFAULT FALSE");
  await pool.query("UPDATE users SET can_generate_problems = TRUE WHERE username = 'admin'");
  await pool.query("INSERT INTO tags (name) VALUES ('이차방정식') ON CONFLICT (name) DO NOTHING");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_title VARCHAR(100) DEFAULT ''");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_notifications (
      id SERIAL PRIMARY KEY,
      type VARCHAR(50) NOT NULL DEFAULT 'info',
      message TEXT NOT NULL,
      from_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      from_username VARCHAR(50),
      related_id INTEGER,
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS titles (
      id SERIAL PRIMARY KEY,
      title_id VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      description VARCHAR(255) NOT NULL,
      condition_type VARCHAR(50) NOT NULL,
      condition_value INTEGER NOT NULL DEFAULT 0
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_titles (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      title_id VARCHAR(50) NOT NULL,
      unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, title_id)
    )
  `);
  await pool.query(`
    INSERT INTO titles (title_id, name, description, condition_type, condition_value) VALUES
      ('goose_room', '꽥?', '거위의 방에 방문하세요', 'goose_room', 1),
      ('cat_room', '개냥이', '개냥이의 방에 방문하세요', 'cat_room', 1),
      ('dark_mode', '어둠의 Logis', '다크 모드를 1회 활성화하세요', 'dark_mode', 1),
      ('solve_10', '수학 새싹', '문제 10개를 해결하세요', 'solve_count', 10),
      ('solve_50', '문제 해결사', '문제 50개를 해결하세요', 'solve_count', 50),
      ('solve_100', '수학 마스터', '문제 100개를 해결하세요', 'solve_count', 100),
      ('solve_500', '문제 정복자', '문제 500개를 해결하세요', 'solve_count', 500),
      ('solve_1000', '지식의 전당', '문제 1000개를 해결하세요', 'solve_count', 1000),
      ('streak_7', '꾸준함의 시작', '7일 연속 스트릭을 달성하세요', 'streak', 7),
      ('streak_30', '불굴의 의지', '30일 연속 스트릭을 달성하세요', 'streak', 30),
      ('streak_100', '열정의 소유자', '100일 연속 스트릭을 달성하세요', 'streak', 100),
      ('streak_365', '전설의 꾸준함', '365일 연속 스트릭을 달성하세요', 'streak', 365),
      ('rank_1', '최강자', '랭킹 1위를 달성하세요', 'ranking', 1),
      ('rank_2', '강호', '랭킹 2위를 달성하세요', 'ranking', 2),
      ('rank_3', '도전자', '랭킹 3위를 달성하세요', 'ranking', 3)
    ON CONFLICT (title_id) DO UPDATE SET condition_value = EXCLUDED.condition_value, description = EXCLUDED.description
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS groups (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      creator_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS group_members (
      group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (group_id, user_id)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS group_join_requests (
      id SERIAL PRIMARY KEY,
      group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(group_id, user_id)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS group_competitions (
      id SERIAL PRIMARY KEY,
      group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
      title VARCHAR(100) NOT NULL,
      description TEXT,
      duration_hours INTEGER NOT NULL,
      start_time TIMESTAMP WITH TIME ZONE NOT NULL,
      end_time TIMESTAMP WITH TIME ZONE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS group_competition_participants (
      competition_id INTEGER REFERENCES group_competitions(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      initial_rating FLOAT NOT NULL,
      PRIMARY KEY (competition_id, user_id)
    )
  `);
};

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

const canGenerateProblems = async (userId: number) => {
  const result = await pool.query('SELECT username, can_generate_problems FROM users WHERE id = $1', [userId]);
  const user = result.rows[0];
  return !!user && (user.username === 'admin' || user.can_generate_problems === true);
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
  const client = await pool.connect();
  try {
    // Try to find user by email or username
    const userResult = await client.query('SELECT * FROM users WHERE email = $1 OR username = $1', [email]);
    const user = userResult.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      client.release();
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // 트랜잭션 내에서 리셋 및 복구 수행
    await client.query('BEGIN');
    await handleDailyReset(user.id, client);
    const repairResult = await checkAndRepairStreak(user.id, client);
    await client.query('COMMIT');

    // 최신 정보로 유저 재조회
    const updatedUserResult = await client.query('SELECT * FROM users WHERE id = $1', [user.id]);
    const updatedUser = updatedUserResult.rows[0];

    // Look up equipped title display name
    let equippedTitleName = '';
    if (updatedUser.equipped_title) {
      const titleRes = await client.query('SELECT name FROM titles WHERE title_id = $1', [updatedUser.equipped_title]);
      if (titleRes.rows.length > 0) equippedTitleName = titleRes.rows[0].name;
    }

    const token = jwt.sign({ id: updatedUser.id, username: updatedUser.username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ 
      token, 
      user: { 
        id: updatedUser.id, 
        username: updatedUser.username, 
        rating: updatedUser.rating,
        profile_image_url: updatedUser.profile_image_url,
        bio: updatedUser.bio,
        tier: getTier(updatedUser.rating),
        streak: updatedUser.streak,
        tokens: updatedUser.tokens,
        xp: updatedUser.xp,
        quests: updatedUser.quests,
        can_generate_problems: updatedUser.can_generate_problems,
        equipped_title: equippedTitleName || updatedUser.equipped_title,
        streakRepaired: repairResult.repaired,
        streakRepairedFlag: updatedUser.streak_repaired,
        has_firework_effect: updatedUser.has_firework_effect,
        has_developer_chango: updatedUser.has_developer_chango,
        custom_title: updatedUser.custom_title || ''
      } 
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  } finally {
    client.release();
  }
});

app.get('/api/users/profile', authenticateToken, async (req: any, res: Response) => {
  const client = await pool.connect();
  try {
    const userId = req.user.id;

    // 데일리 리셋 및 스트릭 자동 복구 수행
    await client.query('BEGIN');
    await handleDailyReset(userId, client);
    const repairResult = await checkAndRepairStreak(userId, client);
    await client.query('COMMIT');

    const userResult = await client.query(
      'SELECT id, username, email, rating, profile_image_url, bio, streak, tokens, xp, quests, streak_repaired, can_generate_problems, equipped_title, created_at, has_firework_effect, has_developer_chango, last_active_date, longest_streak, custom_title FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Look up equipped title display name
    let equippedTitleName = '';
    if (user.equipped_title) {
      const titleRes = await client.query('SELECT name FROM titles WHERE title_id = $1', [user.equipped_title]);
      if (titleRes.rows.length > 0) equippedTitleName = titleRes.rows[0].name;
    }

    // Get submission statistics
    const statsResult = await client.query(
      'SELECT COUNT(*) as total, SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct FROM submissions WHERE user_id = $1',
      [userId]
    );
    const stats = statsResult.rows[0];

    res.json({
      user: {
        ...user,
        equipped_title: equippedTitleName,
        tier: getTier(parseFloat(user.rating)),
        streakRepaired: repairResult.repaired,
        streakRepairedFlag: user.streak_repaired
      },
      stats: {
        totalSubmissions: parseInt(stats.total),
        correctSubmissions: parseInt(stats.correct || 0),
        accuracy: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0
      }
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Failed to fetch profile:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  } finally {
    client.release();
  }
});

app.post('/api/users/profile-image', authenticateToken, (req: any, res: Response) => {
  upload.single('profileImage')(req, res, async (uploadErr: any) => {
    if (uploadErr) {
      return res.status(400).json({ error: uploadErr.message || 'Failed to upload profile image' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Profile image file is required' });
    }

    const profileImageUrl = `/uploads/${req.file.filename}`;
    const userId = req.user.id;

    try {
      await pool.query('UPDATE users SET profile_image_url = $1 WHERE id = $2', [profileImageUrl, userId]);
      res.json({ message: 'Profile image updated successfully', profileImageUrl });
    } catch (err) {
      res.status(500).json({ error: 'Failed to update profile image' });
    }
  });
});

app.patch('/api/users/profile', authenticateToken, async (req: any, res: Response) => {
  const { username, bio } = req.body;
  const userId = req.user.id;

  try {
    if (username) {
      // Check if username already exists for another user
      const existingUser = await pool.query('SELECT id FROM users WHERE username = $1 AND id != $2', [username, userId]);
      if (existingUser.rows.length > 0) {
        return res.status(400).json({ error: 'Username already exists' });
      }
      await pool.query('UPDATE users SET username = $1, bio = $2 WHERE id = $3', [username, bio, userId]);
    } else {
      await pool.query('UPDATE users SET bio = $1 WHERE id = $2', [bio, userId]);
    }
    
    res.json({ message: 'Profile updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

app.get('/api/users/search', async (req: Request, res: Response) => {
  const { q } = req.query;
  if (!q) return res.json([]);

  try {
    const result = await pool.query(
      'SELECT id, username, rating, profile_image_url, bio, equipped_title FROM users WHERE username ILIKE $1 ORDER BY rating DESC LIMIT 10',
      [`%${q}%`]
    );
    // Resolve equipped title display names
    const titleIds = [...new Set(result.rows.filter((r: any) => r.equipped_title).map((r: any) => r.equipped_title))];
    const titleMap: Record<string, string> = {};
    if (titleIds.length > 0) {
      const titleRes = await pool.query('SELECT title_id, name FROM titles WHERE title_id = ANY($1)', [titleIds]);
      for (const row of titleRes.rows) {
        titleMap[row.title_id] = row.name;
      }
    }
    const users = result.rows.map((u: any) => ({
      ...u,
      equipped_title: u.equipped_title ? (titleMap[u.equipped_title] || u.equipped_title) : '',
      tier: getTier(u.rating)
    }));
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Search failed' });
  }
});

app.get('/api/users/:id/profile', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const userResult = await pool.query(
      'SELECT id, username, rating, profile_image_url, bio, equipped_title, streak, tokens, xp, created_at FROM users WHERE id = $1',
      [id]
    );

    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const user = userResult.rows[0];

    // Look up equipped title display name
    let equippedTitleName = '';
    if (user.equipped_title) {
      const titleRes = await pool.query('SELECT name FROM titles WHERE title_id = $1', [user.equipped_title]);
      if (titleRes.rows.length > 0) equippedTitleName = titleRes.rows[0].name;
    }

    // Get submission statistics
    const statsResult = await pool.query(
      'SELECT COUNT(*) as total, SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct FROM submissions WHERE user_id = $1',
      [id]
    );
    const stats = statsResult.rows[0];

    res.json({
      user: {
        ...user,
        equipped_title: equippedTitleName,
        tier: getTier(user.rating)
      },
      stats: {
        totalSubmissions: parseInt(stats.total),
        correctSubmissions: parseInt(stats.correct || 0),
        accuracy: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// --- Store API ---
// --- Store API Endpoints ---
// List available store items
app.get('/api/store/items', authenticateToken, async (req: any, res: Response) => {
  const items = [
    {
      id: 'streak_repair',
      name: '스트릭 리페어',
      cost: 30,
      description: '스트릭을 복구하고 연속 일수를 초기화합니다.'
    },
    {
      id: 'firework_effect',
      name: '폭죽 이펙트',
      cost: 100,
      description: '정답 시 화면 중앙에서 폭죽 파티클 이펙트가 재생됩니다.'
    },
    {
      id: 'developer_love',
      name: '💕 개발자의 사랑',
      cost: 1000,
      description: '개발자에게 사랑을 전하면 맞춤형 칭호를 전합니다!'
    },
    {
      id: 'developer_chango',
      name: '🎫 개발자의 창호',
      cost: 500,
      description: '구매 후 프로필에서 원하는 맞춤형 칭호 문구를 관리자에게 전송하세요!'
    }
  ];
  res.json({ items });
});

// Purchase streak repair item
app.post('/api/store/buy-streak-repair', authenticateToken, async (req: any, res: Response) => {
  const userId = req.user.id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const userRes = await client.query('SELECT tokens, streak FROM users WHERE id = $1 FOR UPDATE', [userId]);
    if (userRes.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'User not found' });
    }
    const user = userRes.rows[0];
    if (user.tokens < 30) {
      client.release();
      return res.status(400).json({ error: '토큰이 부족합니다. (필요: 30 토큰)' });
    }
    // Deduct tokens and set streak_repaired flag (streak 유지, 초기화하지 않음)
    await client.query(
      'UPDATE users SET tokens = tokens - 30, streak_repaired = TRUE WHERE id = $1',
      [userId]
    );
    await client.query('COMMIT');
    res.json({ message: '스트릭 복구 아이템을 구매했습니다.' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: '상점 구매 중 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
});

// Purchase firework effect item
app.post('/api/store/buy-firework-effect', authenticateToken, async (req: any, res: Response) => {
  const userId = req.user.id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const userRes = await client.query('SELECT tokens, has_firework_effect FROM users WHERE id = $1 FOR UPDATE', [userId]);
    if (userRes.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'User not found' });
    }
    const user = userRes.rows[0];
    if (user.has_firework_effect) {
      client.release();
      return res.status(400).json({ error: '이미 보유 중인 아이템입니다.' });
    }
    if (user.tokens < 100) {
      client.release();
      return res.status(400).json({ error: '토큰이 부족합니다. (필요: 100 토큰)' });
    }
    await client.query(
      'UPDATE users SET tokens = tokens - 100, has_firework_effect = TRUE WHERE id = $1',
      [userId]
    );
    await client.query('COMMIT');
    res.json({ message: '폭죽 이펙트를 구매했습니다.' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: '상점 구매 중 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
});

// Purchase developer love item
app.post('/api/store/buy-developer-love', authenticateToken, async (req: any, res: Response) => {
  const userId = req.user.id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const userRes = await client.query('SELECT tokens, username FROM users WHERE id = $1 FOR UPDATE', [userId]);
    if (userRes.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'User not found' });
    }
    const user = userRes.rows[0];
    if (user.tokens < 1000) {
      client.release();
      return res.status(400).json({ error: '토큰이 부족합니다. (필요: 1000 토큰)' });
    }
    // Deduct tokens
    await client.query('UPDATE users SET tokens = tokens - 1000 WHERE id = $1', [userId]);
    // Create admin notification
    await client.query(
      `INSERT INTO admin_notifications (type, message, from_user_id, from_username) VALUES ($1, $2, $3, $4)`,
      ['developer_love', `💕 ${user.username}님이 개발자의 사랑을 구매했습니다!`, userId, user.username]
    );
    await client.query('COMMIT');
    res.json({ message: '💕 개발자의 사랑을 전달했습니다! 어드민에게 알림이 전송되었습니다.' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: '상점 구매 중 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
});

// Purchase developer chango item
app.post('/api/store/buy-developer-chango', authenticateToken, async (req: any, res: Response) => {
  const userId = req.user.id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const userRes = await client.query('SELECT tokens, has_developer_chango FROM users WHERE id = $1 FOR UPDATE', [userId]);
    if (userRes.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'User not found' });
    }
    const user = userRes.rows[0];
    if (user.has_developer_chango) {
      client.release();
      return res.status(400).json({ error: '이미 보유 중인 아이템입니다.' });
    }
    if (user.tokens < 500) {
      client.release();
      return res.status(400).json({ error: '토큰이 부족합니다. (필요: 500 토큰)' });
    }
    await client.query(
      'UPDATE users SET tokens = tokens - 500, has_developer_chango = TRUE WHERE id = $1',
      [userId]
    );
    await client.query('COMMIT');
    res.json({ message: '🎫 개발자의 창호를 구매했습니다! 프로필에서 맞춤형 칭호를 입력하세요.' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: '상점 구매 중 오류가 발생했습니다.' });
  } finally {
    client.release();
  }
});

// Submit custom title from developer chango
app.post('/api/store/submit-custom-title', authenticateToken, async (req: any, res: Response) => {
  const userId = req.user.id;
  const { customTitle } = req.body;
  if (!customTitle || typeof customTitle !== 'string' || customTitle.trim().length === 0) {
    return res.status(400).json({ error: '칭호 문구를 입력해주세요.' });
  }
  if (customTitle.trim().length > 50) {
    return res.status(400).json({ error: '칭호는 50자 이내로 입력해주세요.' });
  }
  try {
    const userRes = await pool.query('SELECT username, has_developer_chango FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = userRes.rows[0];
    if (!user.has_developer_chango) {
      return res.status(403).json({ error: '개발자의 창호 아이템을 보유하고 있어야 합니다.' });
    }
    await pool.query(
      `INSERT INTO admin_notifications (type, message, from_user_id, from_username) VALUES ($1, $2, $3, $4)`,
      ['custom_title_request', `🎫 ${user.username}님이 맞춤형 칭호를 요청했습니다: "${customTitle.trim()}"`, userId, user.username]
    );
    res.json({ message: '맞춤형 칭호 요청이 전송되었습니다.' });
  } catch (err) {
    res.status(500).json({ error: '칭호 전송 중 오류가 발생했습니다.' });
  }
});

// Public user profile (others can view streak, tokens, xp)
app.get('/api/users/:id/profile', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const userResult = await pool.query(
      'SELECT id, username, rating, profile_image_url, bio, streak, tokens, xp, equipped_title, has_firework_effect, has_developer_chango, last_active_date, longest_streak, custom_title FROM users WHERE id = $1',
      [id]
    );
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = userResult.rows[0];
    // Resolve equipped title name
    let equippedTitleName = '';
    if (user.equipped_title) {
      const titleRes = await pool.query('SELECT name FROM titles WHERE title_id = $1', [user.equipped_title]);
      if (titleRes.rows.length > 0) equippedTitleName = titleRes.rows[0].name;
    }
    // Fetch earned titles
    const titlesRes = await pool.query(
      'SELECT t.title_id, t.name, t.description FROM user_titles ut JOIN titles t ON t.title_id = ut.title_id WHERE ut.user_id = $1 ORDER BY ut.unlocked_at',
      [id]
    );
    res.json({
      user: {
        ...user,
        equipped_title: equippedTitleName || user.equipped_title,
        tier: getTier(parseFloat(user.rating))
      },
      titles: titlesRes.rows
    });
  } catch (err) {
    console.error('Failed to fetch public profile:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Custom problem list (admin only view)
app.get('/api/problems/custom', authenticateToken, async (req: any, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;
  // Only admin can view custom problems
  if (req.user.username !== 'admin') return res.status(403).json({ error: '관리자 전용입니다.' });
  try {
    const result = await pool.query(
      'SELECT id, title, content, current_difficulty, tags, custom_reward_rating FROM problems WHERE is_custom = TRUE ORDER BY id LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    const countRes = await pool.query('SELECT COUNT(*) FROM problems WHERE is_custom = TRUE');
    const total = parseInt(countRes.rows[0].count);
    res.json({ problems: result.rows, pagination: { page, limit, total } });
  } catch (err) {
    console.error('Failed to fetch custom problems:', err);
    res.status(500).json({ error: 'Failed to fetch custom problems' });
  }
});

// Admin creates a custom problem with rating reward
// User streak history (daily solved count) with offset support
app.get('/api/users/:id/streak-history', async (req: Request, res: Response) => {
  const { id } = req.params;
  const offset = parseInt(req.query.offset as string) || 0;
  try {
    // Calculate 6-month window, shifted by `offset` (0 = current, 1 = previous, etc.)
    const now = new Date();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1 - offset * 6, 0, 23, 59, 59, 999);
    const monthStart = new Date(monthEnd);
    monthStart.setMonth(monthStart.getMonth() - 5);
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const result = await pool.query(
      `SELECT to_char(submitted_at::date, 'YYYY-MM-DD') as date, COUNT(*) as solved,
              bool_or(is_streak_repair) as has_repair
       FROM submissions WHERE user_id = $1 AND is_correct = true
       AND submitted_at >= $2 AND submitted_at <= $3
       GROUP BY date ORDER BY date`,
      [id, monthStart.toISOString(), monthEnd.toISOString()]
    );
    res.json({ history: result.rows, fromDate: monthStart.toISOString(), toDate: monthEnd.toISOString() });
  } catch (err) {
    console.error('Failed to fetch streak history:', err);
    res.status(500).json({ error: 'Failed to fetch streak history' });
  }
});

// --- Title Endpoints ---

app.get('/api/titles', authenticateToken, async (req: any, res: Response) => {
  const userId = req.user.id;
  try {
    const titlesResult = await pool.query('SELECT * FROM titles ORDER BY id');
    const userTitlesResult = await pool.query('SELECT title_id FROM user_titles WHERE user_id = $1', [userId]);
    const userTitleIds = new Set(userTitlesResult.rows.map((r: any) => r.title_id));
    const titleStatResult = await pool.query(
      'SELECT COUNT(*) as correct_count FROM submissions WHERE user_id = $1 AND is_correct = true',
      [userId]
    );
    const correctCount = parseInt(titleStatResult.rows[0].correct_count);
    const userResult = await pool.query('SELECT streak, equipped_title FROM users WHERE id = $1', [userId]);
    const user = userResult.rows[0];
    const equippedTitle = user?.equipped_title || '';

    const titles = titlesResult.rows.map((t: any) => ({
      ...t,
      unlocked: userTitleIds.has(t.title_id),
      equipped: equippedTitle === t.title_id,
      progress: correctCount
    }));

    res.json({ titles, equippedTitle, correctCount, streak: user?.streak || 0 });
  } catch (err) {
    console.error('Failed to fetch titles:', err);
    res.status(500).json({ error: 'Failed to fetch titles' });
  }
});

app.post('/api/titles/check', authenticateToken, async (req: any, res: Response) => {
  const userId = req.user.id;
  const { action, value } = req.body;
  const client = await pool.connect();
  try {
    // Get user info for checks
    const userRes = await client.query(
      'SELECT streak, equipped_title FROM users WHERE id = $1',
      [userId]
    );
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = userRes.rows[0];

    // Get correct submission count
    const statsRes = await client.query(
      'SELECT COUNT(*) as count FROM submissions WHERE user_id = $1 AND is_correct = true',
      [userId]
    );
    const correctCount = parseInt(statsRes.rows[0].count);

    // Get ranking position (exclude admin)
    const rankRes = await client.query(
      "SELECT id FROM users WHERE username != 'admin' ORDER BY rating DESC"
    );
    let userRank = -1;
    for (let i = 0; i < rankRes.rows.length; i++) {
      if (rankRes.rows[i].id === userId) { userRank = i + 1; break; }
    }

    // Get all titles
    const titlesRes = await client.query('SELECT * FROM titles');
    const titles = titlesRes.rows;

    // Get already unlocked titles
    const userTitlesRes = await client.query('SELECT title_id FROM user_titles WHERE user_id = $1', [userId]);
    const unlockedSet = new Set(userTitlesRes.rows.map((r: any) => r.title_id));

    const newlyUnlocked: any[] = [];

    for (const title of titles) {
      if (unlockedSet.has(title.title_id)) continue;
      let shouldUnlock = false;

      switch (title.condition_type) {
        case 'goose_room':
          if (action === 'goose_room') shouldUnlock = true;
          break;
        case 'cat_room':
          if (action === 'cat_room') shouldUnlock = true;
          break;
        case 'dark_mode':
          if (action === 'dark_mode' && value >= title.condition_value) shouldUnlock = true;
          break;
        case 'solve_count':
          if (correctCount >= title.condition_value) shouldUnlock = true;
          break;
        case 'streak':
          if ((user.streak || 0) >= title.condition_value) shouldUnlock = true;
          break;
        case 'ranking':
          if (userRank > 0 && userRank <= title.condition_value) shouldUnlock = true;
          break;
      }

      if (shouldUnlock) {
        await client.query(
          'INSERT INTO user_titles (user_id, title_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [userId, title.title_id]
        );
        newlyUnlocked.push({ title_id: title.title_id, name: title.name, description: title.description });
      }
    }

    res.json({ newlyUnlocked, correctCount, streak: user.streak, rank: userRank });
  } catch (err) {
    console.error('Failed to check titles:', err);
    res.status(500).json({ error: 'Failed to check titles' });
  } finally {
    client.release();
  }
});

app.post('/api/titles/equip', authenticateToken, async (req: any, res: Response) => {
  const userId = req.user.id;
  const { titleId } = req.body;

  if (!titleId) {
    return res.status(400).json({ error: 'titleId is required' });
  }

  try {
    if (titleId === 'none') {
      await pool.query("UPDATE users SET equipped_title = '' WHERE id = $1", [userId]);
      return res.json({ message: '칭호를 해제했습니다.', equippedTitle: '' });
    }

    // Check if user owns this title
    const ownedRes = await pool.query(
      'SELECT 1 FROM user_titles WHERE user_id = $1 AND title_id = $2',
      [userId, titleId]
    );
    if (ownedRes.rows.length === 0) {
      return res.status(403).json({ error: '보유하지 않은 칭호입니다.' });
    }

    await pool.query('UPDATE users SET equipped_title = $1 WHERE id = $2', [titleId, userId]);
    const titleRes = await pool.query('SELECT name FROM titles WHERE title_id = $1', [titleId]);
    const equippedTitleName = titleRes.rows.length > 0 ? titleRes.rows[0].name : titleId;
    res.json({ message: '칭호를 장착했습니다.', equippedTitle: titleId, equippedTitleName });
  } catch (err) {
    console.error('Failed to equip title:', err);
    res.status(500).json({ error: 'Failed to equip title' });
  }
});

// Group Endpoints
app.get('/api/groups', async (req: Request, res: Response) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  let userId: number | null = null;

  if (token) {
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      userId = decoded.id;
    } catch (err) { }
  }

  try {
    const query = `
      SELECT g.*, u.username as creator_name, COUNT(gm.user_id) as member_count,
             EXISTS(SELECT 1 FROM group_members WHERE group_id = g.id AND user_id = $1) as is_member,
             EXISTS(SELECT 1 FROM group_join_requests WHERE group_id = g.id AND user_id = $1 AND status = 'pending') as is_pending
      FROM groups g
      LEFT JOIN users u ON g.creator_id = u.id
      LEFT JOIN group_members gm ON g.id = gm.group_id
      GROUP BY g.id, u.username
      ORDER BY g.created_at DESC
    `;
    const result = await pool.query(query, [userId || null]);
    res.json(result.rows);
  } catch (err) {
    console.error('Failed to fetch groups:', err);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

app.post('/api/groups', authenticateToken, async (req: any, res: Response) => {
  const { name, description } = req.body;
  const userId = req.user.id;

  try {
    // Check if user is Silver or higher (Rating >= 100,000)
    const userRes = await pool.query('SELECT rating FROM users WHERE id = $1', [userId]);
    const rating = parseFloat(userRes.rows[0].rating);

    if (rating < 100000) {
      return res.status(403).json({ error: 'Only Silver tier (Rating 100,000+) can create groups' });
    }

    // Check group creation limit (Max 2)
    const countRes = await pool.query('SELECT COUNT(*) FROM groups WHERE creator_id = $1', [userId]);
    if (parseInt(countRes.rows[0].count) >= 2) {
      return res.status(403).json({ error: 'You can only create up to 2 groups' });
    }

    const groupResult = await pool.query(
      'INSERT INTO groups (name, description, creator_id) VALUES ($1, $2, $3) RETURNING id',
      [name, description, userId]
    );
    const groupId = groupResult.rows[0].id;

    // Creator automatically joins the group
    await pool.query('INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)', [groupId, userId]);

    res.status(201).json({ message: 'Group created successfully', groupId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create group' });
  }
});

app.get('/api/groups/:id', async (req: Request, res: Response) => {
  const groupId = req.params.id;
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  let userId: number | null = null;

  if (token) {
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      userId = decoded.id;
    } catch (err) { }
  }

  try {
    const groupResult = await pool.query(`
      SELECT g.*, u.username as creator_name,
             EXISTS(SELECT 1 FROM group_members WHERE group_id = g.id AND user_id = $1) as is_member,
             EXISTS(SELECT 1 FROM group_join_requests WHERE group_id = g.id AND user_id = $1 AND status = 'pending') as is_pending
      FROM groups g
      JOIN users u ON g.creator_id = u.id
      WHERE g.id = $2
    `, [userId || null, groupId]);

    if (groupResult.rows.length === 0) return res.status(404).json({ error: 'Group not found' });

    const membersResult = await pool.query(`
      SELECT u.id, u.username, u.rating, u.profile_image_url
      FROM group_members gm
      JOIN users u ON gm.user_id = u.id
      WHERE gm.group_id = $1
    `, [groupId]);

    res.json({
      ...groupResult.rows[0],
      members: membersResult.rows.map(m => ({ ...m, tier: getTier(m.rating) }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch group details' });
  }
});

app.post('/api/groups/:id/join', authenticateToken, async (req: any, res: Response) => {
  const groupId = req.params.id;
  const userId = req.user.id;

  try {
    // Check if already a member
    const memberCheck = await pool.query('SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2', [groupId, userId]);
    if (memberCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Already a member of this group' });
    }

    // Check if already has a pending request
    const requestCheck = await pool.query('SELECT 1 FROM group_join_requests WHERE group_id = $1 AND user_id = $2 AND status = \'pending\'', [groupId, userId]);
    if (requestCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Join request already sent and pending' });
    }

    await pool.query('INSERT INTO group_join_requests (group_id, user_id) VALUES ($1, $2)', [groupId, userId]);
    res.json({ message: 'Join request sent successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send join request' });
  }
});

app.post('/api/groups/:id/leave', authenticateToken, async (req: any, res: Response) => {
  const groupId = req.params.id;
  const userId = req.user.id;

  try {
    await pool.query('DELETE FROM group_members WHERE group_id = $1 AND user_id = $2', [groupId, userId]);
    res.json({ message: 'Left group successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to leave group' });
  }
});

// Group Competition Endpoints
app.post('/api/groups/:id/competitions', authenticateToken, async (req: any, res: Response) => {
  const groupId = req.params.id;
  const { title, description, durationHours } = req.body;
  const userId = req.user.id;

  if (!title || !durationHours) {
    return res.status(400).json({ error: 'Title and duration are required' });
  }

  const hours = parseInt(durationHours);
  if (isNaN(hours) || hours <= 0) {
    return res.status(400).json({ error: 'Duration must be a positive integer' });
  }

  try {
    // Check if user is a member of the group
    const memberCheck = await pool.query('SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2', [groupId, userId]);
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Only group members can create competitions' });
    }

    await pool.query('BEGIN');

    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + hours * 60 * 60 * 1000);
    
    const compResult = await pool.query(
      'INSERT INTO group_competitions (group_id, title, description, duration_hours, start_time, end_time) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [groupId, title, description || null, hours, startTime, endTime]
    );
    const competition = compResult.rows[0];

    // Fetch all current group members and their ratings
    const membersRes = await pool.query(`
      SELECT gm.user_id, u.rating 
      FROM group_members gm
      JOIN users u ON gm.user_id = u.id
      WHERE gm.group_id = $1
    `, [groupId]);

    // Insert participants with current ratings
    for (const member of membersRes.rows) {
      await pool.query(
        'INSERT INTO group_competition_participants (competition_id, user_id, initial_rating) VALUES ($1, $2, $3)',
        [competition.id, member.user_id, member.rating]
      );
    }

    await pool.query('COMMIT');
    res.status(201).json({ message: 'Competition created successfully', competition });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Failed to create competition:', err);
    res.status(500).json({ error: 'Failed to create competition' });
  }
});

app.get('/api/groups/:id/competitions', authenticateToken, async (req: any, res: Response) => {
  const groupId = req.params.id;
  const userId = req.user.id;

  try {
    // Check if user is a member of the group
    const memberCheck = await pool.query('SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2', [groupId, userId]);
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Only group members can view competitions' });
    }

    const compsRes = await pool.query(`
      SELECT 
        gc.*,
        CASE 
          WHEN NOW() < gc.start_time THEN 'pending'
          WHEN NOW() BETWEEN gc.start_time AND gc.end_time THEN 'ongoing'
          ELSE 'ended'
        END as status,
        (SELECT COUNT(*) FROM group_competition_participants WHERE competition_id = gc.id) as participant_count
      FROM group_competitions gc
      WHERE gc.group_id = $1
      ORDER BY gc.created_at DESC
    `, [groupId]);

    res.json(compsRes.rows);
  } catch (err) {
    console.error('Failed to fetch competitions:', err);
    res.status(500).json({ error: 'Failed to fetch competitions' });
  }
});

app.get('/api/groups/:id/competitions/:compId', authenticateToken, async (req: any, res: Response) => {
  const groupId = req.params.id;
  const compId = req.params.compId;
  const userId = req.user.id;

  try {
    // Check if user is a member of the group
    const memberCheck = await pool.query('SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2', [groupId, userId]);
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Only group members can access this competition' });
    }

    // Check if competition exists
    const compRes = await pool.query('SELECT * FROM group_competitions WHERE id = $1 AND group_id = $2', [compId, groupId]);
    if (compRes.rows.length === 0) {
      return res.status(404).json({ error: 'Competition not found' });
    }
    const competition = compRes.rows[0];

    // Check if current user is registered as a participant, if not, auto-register
    const participantCheck = await pool.query(
      'SELECT 1 FROM group_competition_participants WHERE competition_id = $1 AND user_id = $2',
      [compId, userId]
    );
    if (participantCheck.rows.length === 0) {
      const userRatingRes = await pool.query('SELECT rating FROM users WHERE id = $1', [userId]);
      const currentRating = parseFloat(userRatingRes.rows[0].rating);
      await pool.query(
        'INSERT INTO group_competition_participants (competition_id, user_id, initial_rating) VALUES ($1, $2, $3)',
        [compId, userId, currentRating]
      );
    }

    // Fetch leaderboard
    const leaderboardRes = await pool.query(`
      SELECT 
        u.id as user_id,
        u.username,
        u.profile_image_url,
        gcp.initial_rating,
        u.rating as current_rating,
        (u.rating - gcp.initial_rating) as rating_gain
      FROM group_competition_participants gcp
      JOIN users u ON gcp.user_id = u.id
      WHERE gcp.competition_id = $1
      ORDER BY rating_gain DESC, u.rating DESC
    `, [compId]);

    const leaderboard = leaderboardRes.rows.map((row: any) => ({
      ...row,
      tier: getTier(parseFloat(row.current_rating))
    }));

    const now = new Date();
    const start = new Date(competition.start_time);
    const end = new Date(competition.end_time);
    let status = 'ended';
    if (now < start) status = 'pending';
    else if (now >= start && now <= end) status = 'ongoing';

    res.json({
      competition: {
        ...competition,
        status
      },
      leaderboard
    });
  } catch (err) {
    console.error('Failed to fetch competition leaderboard:', err);
    res.status(500).json({ error: 'Failed to fetch competition leaderboard' });
  }
});

// Group Join Requests Management
app.get('/api/groups/:id/requests', authenticateToken, async (req: any, res: Response) => {
  const groupId = req.params.id;
  const userId = req.user.id;

  try {
    // Check ownership
    const groupRes = await pool.query('SELECT creator_id FROM groups WHERE id = $1', [groupId]);
    if (groupRes.rows.length === 0) return res.status(404).json({ error: 'Group not found' });
    if (groupRes.rows[0].creator_id !== userId) return res.status(403).json({ error: 'Only group creator can view requests' });

    const requestsRes = await pool.query(`
      SELECT r.id, r.user_id, r.created_at, u.username, u.rating, u.profile_image_url
      FROM group_join_requests r
      JOIN users u ON r.user_id = u.id
      WHERE r.group_id = $1 AND r.status = 'pending'
      ORDER BY r.created_at ASC
    `, [groupId]);

    res.json(requestsRes.rows.map(r => ({ ...r, tier: getTier(r.rating) })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

app.post('/api/groups/:id/requests/:requestId/approve', authenticateToken, async (req: any, res: Response) => {
  const groupId = req.params.id;
  const requestId = req.params.requestId;
  const userId = req.user.id;

  try {
    // Check ownership
    const groupRes = await pool.query('SELECT creator_id FROM groups WHERE id = $1', [groupId]);
    if (groupRes.rows[0].creator_id !== userId) return res.status(403).json({ error: 'Only group creator can approve requests' });

    // Get request details
    const requestRes = await pool.query('SELECT user_id FROM group_join_requests WHERE id = $1 AND group_id = $2', [requestId, groupId]);
    if (requestRes.rows.length === 0) return res.status(404).json({ error: 'Request not found' });

    const targetUserId = requestRes.rows[0].user_id;

    // Add to members and remove from requests
    await pool.query('BEGIN');
    await pool.query('INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)', [groupId, targetUserId]);
    await pool.query('DELETE FROM group_join_requests WHERE id = $1', [requestId]);
    await pool.query('COMMIT');

    res.json({ message: 'Request approved successfully' });
  } catch (err) {
    await pool.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to approve request' });
  }
});

app.post('/api/groups/:id/requests/:requestId/reject', authenticateToken, async (req: any, res: Response) => {
  const groupId = req.params.id;
  const requestId = req.params.requestId;
  const userId = req.user.id;

  try {
    // Check ownership
    const groupRes = await pool.query('SELECT creator_id FROM groups WHERE id = $1', [groupId]);
    if (groupRes.rows[0].creator_id !== userId) return res.status(403).json({ error: 'Only group creator can reject requests' });

    await pool.query('DELETE FROM group_join_requests WHERE id = $1 AND group_id = $2', [requestId, groupId]);
    res.json({ message: 'Request rejected successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject request' });
  }
});


app.patch('/api/users/nim-key', authenticateToken, async (req: any, res: Response) => {
  const { nimApiKey } = req.body;
  const userId = req.user.id;

  if (!nimApiKey || typeof nimApiKey !== 'string') {
    return res.status(400).json({ error: 'NVIDIA NIM API 키를 입력해주세요.' });
  }

  try {
    await pool.query('UPDATE users SET nim_api_key = $1 WHERE id = $2', [nimApiKey, userId]);
    res.json({ message: 'NVIDIA NIM API 키가 저장되었습니다.' });
  } catch (err) {
    res.status(500).json({ error: 'API 키 저장에 실패했습니다.' });
  }
});

app.get('/api/users/nim-key/status', authenticateToken, async (req: any, res: Response) => {
  const userId = req.user.id;
  try {
    const result = await pool.query('SELECT nim_api_key FROM users WHERE id = $1', [userId]);
    const hasKey = !!(result.rows[0]?.nim_api_key);
    res.json({ hasKey });
  } catch (err) {
    res.status(500).json({ error: 'Failed to check API key status' });
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
      "SELECT id, username, rating FROM users WHERE username != 'admin' ORDER BY rating DESC LIMIT 50"
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

// --- Problems Endpoint (Pagination & is_custom filter) ---
app.get('/api/problems', async (req: Request, res: Response) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  let userId: number | null = null;

  if (token) {
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      userId = decoded.id;
    } catch (err) { }
  }

  const { page = '1', limit = '10', type = 'normal' } = req.query;
  const pageNum = Math.max(1, parseInt(page as string) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 10));
  const offset = (pageNum - 1) * limitNum;
  const isCustomFilter = type === 'custom';

  try {
    let countQuery = `
      SELECT COUNT(DISTINCT p.id)
      FROM problems p
      WHERE p.is_custom = $1
    `;
    let countParams: any[] = [isCustomFilter];
    
    if (userId) {
      countQuery = `
        SELECT COUNT(DISTINCT p.id)
        FROM problems p
        WHERE p.is_custom = $1 AND p.id NOT IN (
          SELECT problem_id FROM submissions WHERE user_id = $2 AND is_correct = true
        )
      `;
      countParams.push(userId);
    }
    
    const countRes = await pool.query(countQuery, countParams);
    const total = parseInt(countRes.rows[0].count);

    let query = `
      SELECT p.id, p.title, p.content, p.current_difficulty, p.is_custom, p.custom_reward_rating,
             COALESCE(NULLIF(array_agg(t.name), '{NULL}'), '{}') as tags
      FROM problems p
      LEFT JOIN problem_tags pt ON p.id = pt.problem_id
      LEFT JOIN tags t ON pt.tag_id = t.id
      WHERE p.is_custom = $1
    `;
    
    let queryParams: any[] = [isCustomFilter];
    let nextIdx = 2;
    
    if (userId) {
      query += ` AND p.id NOT IN (
        SELECT problem_id FROM submissions WHERE user_id = $${nextIdx++} AND is_correct = true
      )`;
      queryParams.push(userId);
    }
    
    query += `
      GROUP BY p.id
      ORDER BY p.id ASC
      LIMIT $${nextIdx++} OFFSET $${nextIdx++}
    `;
    queryParams.push(limitNum, offset);

    const result = await pool.query(query, queryParams);
    
    res.json({
      problems: result.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    console.error('Error fetching problems:', err);
    res.status(500).json({ error: 'Failed to fetch problems' });
  }
});

// Admin Custom Problem Creation API
app.post('/api/problems/custom', authenticateToken, async (req: any, res: Response) => {
  if (req.user.username !== 'admin') {
    return res.status(403).json({ error: '관리자만 커스텀 문제를 생성할 수 있습니다.' });
  }
  const { title, content, answer, ratingReward, tags = [] } = req.body;
  if (!title || !content || !answer || ratingReward === undefined) {
    return res.status(400).json({ error: '필수 필드가 누락되었습니다.' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO problems (title, content, answer, initial_difficulty, current_difficulty, type, is_custom, custom_reward_rating) VALUES ($1, $2, $3, $4, $4, $5, $6, $7) RETURNING id',
      [title, content, answer, ratingReward, 'Calculation', true, parseFloat(ratingReward)]
    );
    const problemId = result.rows[0].id;
    for (const tagName of tags) {
      let tagRes = await pool.query('SELECT id FROM tags WHERE name = $1', [tagName]);
      let tagId;
      if (tagRes.rows.length === 0) {
        const insertTagRes = await pool.query('INSERT INTO tags (name) VALUES ($1) RETURNING id', [tagName]);
        tagId = insertTagRes.rows[0].id;
      } else {
        tagId = tagRes.rows[0].id;
      }
      await pool.query('INSERT INTO problem_tags (problem_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [problemId, tagId]);
    }
    res.status(201).json({ message: '커스텀 문제가 생성되었습니다.', problemId });
  } catch (err) {
    console.error('Failed to create custom problem:', err);
    res.status(500).json({ error: '커스텀 문제 생성을 실패했습니다.' });
  }
});

// Streak History API for Calendar representation
app.get('/api/users/:id/streak-history', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT DATE(submitted_at) as date, COUNT(*) as count 
       FROM submissions 
       WHERE user_id = $1 AND is_correct = true 
       GROUP BY DATE(submitted_at) 
       ORDER BY DATE(submitted_at) ASC`,
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Failed to fetch streak history:', err);
    res.status(500).json({ error: '스트릭 세부 내역 조회에 실패했습니다.' });
  }
});

app.get('/api/problems/tags', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT name FROM tags ORDER BY name');
    res.json(result.rows.map(r => r.name));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

app.get('/api/problems/public', async (req: Request, res: Response) => {
  const { difficulty, concept, page = '1', limit = '20' } = req.query;
  const pageNum = Math.max(1, parseInt(page as string) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20));
  const offset = (pageNum - 1) * limitNum;

  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  // Difficulty filter (tier name -> rating range)
  const difficultyRanges: Record<string, [number, number]> = {
    'bronze': [0, 100000],
    'silver': [100000, 300000],
    'gold': [300000, 800000],
    'platinum': [800000, 2000000],
    'diamond': [2000000, 5000000],
    'ruby': [5000000, 12000000],
    'master': [12000000, 30000000],
    'god': [30000000, 70000000],
    'hacker': [70000000, Infinity],
  };

  if (difficulty && typeof difficulty === 'string') {
    const key = difficulty.toLowerCase();
    const range = difficultyRanges[key];
    if (range) {
      conditions.push(`p.current_difficulty >= $${paramIndex}`);
      params.push(range[0]);
      paramIndex++;
      if (range[1] !== Infinity) {
        conditions.push(`p.current_difficulty < $${paramIndex}`);
        params.push(range[1]);
        paramIndex++;
      }
    }
  }

  // Concept filter (tag name)
  if (concept && typeof concept === 'string') {
    conditions.push(`t.name = $${paramIndex}`);
    params.push(concept);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  try {
    // Get total count
    const countQuery = `
      SELECT COUNT(DISTINCT p.id)
      FROM problems p
      LEFT JOIN problem_tags pt ON p.id = pt.problem_id
      LEFT JOIN tags t ON pt.tag_id = t.id
      ${whereClause}
    `;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    // Get paginated problems
    const query = `
      SELECT p.id, p.title, p.content, p.current_difficulty, p.created_at,
             COALESCE(NULLIF(array_agg(t.name ORDER BY t.name), '{NULL}'), '{}') as tags
      FROM problems p
      LEFT JOIN problem_tags pt ON p.id = pt.problem_id
      LEFT JOIN tags t ON pt.tag_id = t.id
      ${whereClause}
      GROUP BY p.id
      ORDER BY p.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    const result = await pool.query(query, [...params, limitNum, offset]);

    res.json({
      problems: result.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error('Error fetching public problems:', err);
    res.status(500).json({ error: 'Failed to fetch problems' });
  }
});

app.post('/api/problems/generate-nim', authenticateToken, async (req: any, res: Response) => {
  if (!(await canGenerateProblems(req.user.id))) return res.status(403).json({ error: '문제 생성 권한이 없습니다.' });
  const userId = req.user.id;
  const { category, count = 5 } = req.body;

  try {
    const userRes = await pool.query('SELECT nim_api_key FROM users WHERE id = $1', [userId]);
    const apiKey = userRes.rows[0]?.nim_api_key;

    if (!apiKey) {
      return res.status(400).json({ error: 'NVIDIA NIM API 키가 설정되어 있지 않습니다. 프로필에서 API 키를 먼저 등록해주세요.' });
    }

    const generationCount = Math.min(10, Math.max(1, parseInt(count) || 5));
    const generatedProblems = await generateNimProblems(apiKey, generationCount, category);
    const newProblems = [];

    for (const p of generatedProblems) {
      const result = await pool.query(
        'INSERT INTO problems (title, content, answer, initial_difficulty, current_difficulty, type) VALUES ($1, $2, $3, $4, $4, $5) RETURNING id',
        [p.title, p.content, p.answer, p.difficulty, 'Calculation']
      );
      const problemId = result.rows[0].id;

      for (const tagName of p.tags) {
        const tagRes = await pool.query('SELECT id FROM tags WHERE name = $1', [tagName]);
        if (tagRes.rows.length > 0) {
          await pool.query('INSERT INTO problem_tags (problem_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [problemId, tagRes.rows[0].id]);
        }
      }

      newProblems.push({ id: problemId, title: p.title, content: p.content, tags: p.tags, difficulty: p.difficulty });
    }

    res.json({ message: `${newProblems.length}개의 문제가 AI로 생성되었습니다!`, problems: newProblems });
  } catch (err: any) {
    console.error('NIM generation error:', err);
    res.status(500).json({ error: err.message || 'AI 문제 생성에 실패했습니다.' });
  }
});

app.post('/api/problems/generate', authenticateToken, async (req: any, res: Response) => {
  if (!(await canGenerateProblems(req.user.id))) return res.status(403).json({ error: '문제 생성 권한이 없습니다.' });
  try {
    const { tags, count = 5 } = req.body;
    const generationCount = Math.min(50, Math.max(1, parseInt(count) || 5));
    const newProblems = [];
    for (let i = 0; i < generationCount; i++) {
      const p = generateProblem(tags);
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
    res.json({ message: `${generationCount}개의 문제가 생성되었습니다!`, problems: newProblems });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate problems' });
  }
});
app.post('/api/submissions', authenticateToken, async (req: any, res: any) => {
  const { problemId, userAnswer } = req.body;
  const userId = req.user.id;

  try {
    // 이미 맞춘 문제인지 확인
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
    // 공백 전체 제거 및 소문자 변환 비교
    const normalizedUserAnswer = userAnswer.replace(/\s+/g, '').toLowerCase();
    const normalizedCorrectAnswer = correctAnswer.replace(/\s+/g, '').toLowerCase();
    const isCorrect = normalizedUserAnswer === normalizedCorrectAnswer;

    const updateResult = await processSubmission(userId, problemId, isCorrect);
    res.json({ 
      message: isCorrect ? 'Correct answer!' : 'Wrong answer.',
      isCorrect,
      correctAnswer: isCorrect ? undefined : correctAnswer,
      ...updateResult 
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process submission' });
  }
});

app.post('/api/admin/cleanup-tags', authenticateToken, async (req: any, res: Response) => {
  if (req.user.username !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { tags } = req.body;
  if (!Array.isArray(tags) || tags.length === 0) {
    return res.status(400).json({ error: 'Tag names array required' });
  }

  try {
    let deletedCount = 0;
    for (const tagName of tags) {
      const tagRes = await pool.query('SELECT id FROM tags WHERE name = $1', [tagName]);
      if (tagRes.rows.length === 0) continue;
      const tagId = tagRes.rows[0].id;

      const problemIds = await pool.query('SELECT problem_id FROM problem_tags WHERE tag_id = $1', [tagId]);
      for (const row of problemIds.rows) {
        await pool.query('DELETE FROM submissions WHERE problem_id = $1', [row.problem_id]);
        await pool.query('DELETE FROM problems WHERE id = $1', [row.problem_id]);
        deletedCount++;
      }
    }
    res.json({ message: `${deletedCount}개의 문제가 삭제되었습니다.`, deletedCount });
  } catch (err) {
    console.error('Cleanup error:', err);
    res.status(500).json({ error: 'Cleanup failed' });
  }
});

app.get('/api/admin/problems', authenticateToken, async (req: any, res: Response) => {
  if (req.user.username !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { page = '1', limit = '50' } = req.query;
  const pageNum = Math.max(1, parseInt(page as string) || 1);
  const limitNum = Math.min(200, Math.max(1, parseInt(limit as string) || 50));
  const offset = (pageNum - 1) * limitNum;

  try {
    const countRes = await pool.query('SELECT COUNT(*) FROM problems');
    const total = parseInt(countRes.rows[0].count);

    const result = await pool.query(`
      SELECT p.id, p.title, p.content, p.answer, p.current_difficulty, p.created_at,
             COALESCE(NULLIF(array_agg(t.name ORDER BY t.name), '{NULL}'), '{}') as tags
      FROM problems p
      LEFT JOIN problem_tags pt ON p.id = pt.problem_id
      LEFT JOIN tags t ON pt.tag_id = t.id
      GROUP BY p.id
      ORDER BY p.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limitNum, offset]);

    res.json({
      problems: result.rows,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    console.error('Failed to fetch admin problems:', err);
    res.status(500).json({ error: 'Failed to fetch problems' });
  }
});

app.patch('/api/admin/problems/:id', authenticateToken, async (req: any, res: Response) => {
  if (req.user.username !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { id } = req.params;
  const { title, content, answer, current_difficulty, tags } = req.body;

  try {
    const fields: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (title !== undefined) { fields.push(`title = $${idx++}`); params.push(title); }
    if (content !== undefined) { fields.push(`content = $${idx++}`); params.push(content); }
    if (answer !== undefined) { fields.push(`answer = $${idx++}`); params.push(answer); }
    if (current_difficulty !== undefined) { fields.push(`current_difficulty = $${idx++}`); params.push(current_difficulty); }

    if (fields.length > 0) {
      params.push(id);
      await pool.query(`UPDATE problems SET ${fields.join(', ')} WHERE id = $${idx}`, params);
    }

    if (Array.isArray(tags)) {
      await pool.query('DELETE FROM problem_tags WHERE problem_id = $1', [id]);
      for (const tagName of tags) {
        const tagRes = await pool.query('SELECT id FROM tags WHERE name = $1', [tagName]);
        if (tagRes.rows.length > 0) {
          await pool.query('INSERT INTO problem_tags (problem_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, tagRes.rows[0].id]);
        }
      }
    }

    res.json({ message: '문제가 수정되었습니다.' });
  } catch (err) {
    console.error('Failed to update problem:', err);
    res.status(500).json({ error: 'Failed to update problem' });
  }
});

app.delete('/api/admin/problems/:id', authenticateToken, async (req: any, res: Response) => {
  if (req.user.username !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { id } = req.params;

  try {
    await pool.query('DELETE FROM submissions WHERE problem_id = $1', [id]);
    await pool.query('DELETE FROM problems WHERE id = $1', [id]);
    res.json({ message: '문제가 삭제되었습니다.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete problem' });
  }
});

app.post('/api/admin/seed', authenticateToken, async (req: any, res: Response) => {
  if (req.user.username !== 'admin') return res.status(403).json({ error: 'Admin only' });
  
  try {
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
      SELECT u.id, u.username, u.email, u.rating, u.tokens, u.created_at, u.can_generate_problems, u.custom_title,
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
      correct_submissions: parseInt(u.correct_submissions || 0),
      can_generate_problems: u.can_generate_problems === true
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

app.patch('/api/admin/users/:id/problem-generation', authenticateToken, async (req: any, res: Response) => {
  if (req.user.username !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { id } = req.params;
  const { canGenerateProblems: canGenerate } = req.body;

  try {
    const result = await pool.query(
      'UPDATE users SET can_generate_problems = $1 WHERE id = $2 RETURNING id, username, can_generate_problems',
      [!!canGenerate, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ message: '문제 생성 권한이 업데이트되었습니다.', user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update problem generation permission' });
  }
});

app.patch('/api/admin/users/:id/tokens', authenticateToken, async (req: any, res: Response) => {
  if (req.user.username !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { id } = req.params;
  const { tokens } = req.body;

  try {
    const result = await pool.query(
      'UPDATE users SET tokens = $1 WHERE id = $2 RETURNING id, username, tokens',
      [tokens, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ message: '토큰이 업데이트되었습니다.', user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: '토큰 업데이트에 실패했습니다.' });
  }
});

app.patch('/api/admin/users/:id/custom-title', authenticateToken, async (req: any, res: Response) => {
  if (req.user.username !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { id } = req.params;
  const { customTitle } = req.body;

  try {
    const result = await pool.query(
      "UPDATE users SET custom_title = $1 WHERE id = $2 RETURNING id, username, custom_title",
      [customTitle || '', id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ message: '커스텀 칭호가 설정되었습니다.', user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: '커스텀 칭호 설정에 실패했습니다.' });
  }
});

app.get('/api/admin/notifications', authenticateToken, async (req: any, res: Response) => {
  if (req.user.username !== 'admin') return res.status(403).json({ error: 'Admin only' });

  try {
    const result = await pool.query(
      'SELECT * FROM admin_notifications ORDER BY created_at DESC LIMIT 100'
    );
    const unreadCount = await pool.query(
      "SELECT COUNT(*) FROM admin_notifications WHERE is_read = FALSE"
    );
    res.json({
      notifications: result.rows,
      unreadCount: parseInt(unreadCount.rows[0].count)
    });
  } catch (err) {
    res.status(500).json({ error: '알림 조회에 실패했습니다.' });
  }
});

app.post('/api/admin/notifications/:id/read', authenticateToken, async (req: any, res: Response) => {
  if (req.user.username !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { id } = req.params;

  try {
    await pool.query('UPDATE admin_notifications SET is_read = TRUE WHERE id = $1', [id]);
    res.json({ message: '알림이 읽음 처리되었습니다.' });
  } catch (err) {
    res.status(500).json({ error: '알림 읽음 처리에 실패했습니다.' });
  }
});

app.get('/api/users/problem-type-stats', authenticateToken, async (req: any, res: Response) => {
  const userId = req.user.id;
  try {
    const result = await pool.query(`
      SELECT t.name as tag_name, COUNT(*) as solved_count
      FROM submissions s
      JOIN problem_tags pt ON s.problem_id = pt.problem_id
      JOIN tags t ON pt.tag_id = t.id
      WHERE s.user_id = $1 AND s.is_correct = true
      GROUP BY t.name
      ORDER BY t.name
    `, [userId]);
    res.json(result.rows);
  } catch (err) {
    console.error('Failed to fetch problem type stats:', err);
    res.status(500).json({ error: '통계 조회에 실패했습니다.' });
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

// --- 404 Handler for API routes ---
app.use('/api/*', (req: Request, res: Response) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// --- Sitemap ---
app.get('/api/sitemap.xml', async (req: Request, res: Response) => {
  const SITE_URL = 'https://llogis.xyz';

  try {
    const usersResult = await pool.query(
      "SELECT id, updated_at FROM users WHERE username != 'admin' ORDER BY id"
    );

    const groupsResult = await pool.query('SELECT id, created_at FROM groups ORDER BY id');

    const now = new Date().toISOString();

    let urls = `
  <url>
    <loc>${SITE_URL}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
    <lastmod>${now}</lastmod>
  </url>
  <url>
    <loc>${SITE_URL}/ranking</loc>
    <changefreq>hourly</changefreq>
    <priority>0.9</priority>
    <lastmod>${now}</lastmod>
  </url>
  <url>
    <loc>${SITE_URL}/about</loc>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
    <lastmod>${now}</lastmod>
  </url>
  <url>
    <loc>${SITE_URL}/groups</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
    <lastmod>${now}</lastmod>
  </url>`;

    for (const user of usersResult.rows) {
      urls += `
  <url>
    <loc>${SITE_URL}/users/${user.id}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.5</priority>
    <lastmod>${user.updated_at ? new Date(user.updated_at).toISOString() : now}</lastmod>
  </url>`;
    }

    for (const group of groupsResult.rows) {
      urls += `
  <url>
    <loc>${SITE_URL}/groups/${group.id}</loc>
    <changefreq>daily</changefreq>
    <priority>0.6</priority>
    <lastmod>${group.created_at ? new Date(group.created_at).toISOString() : now}</lastmod>
  </url>`;
    }

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls}
</urlset>`;

    res.header('Content-Type', 'application/xml; charset=utf-8');
    res.send(sitemap);
  } catch (err) {
    console.error('Failed to generate sitemap:', err);
    res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><error>Failed to generate sitemap</error>');
  }
});

ensureSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database schema:', err);
    process.exit(1);
  });
