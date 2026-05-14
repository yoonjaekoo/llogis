"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const pg_1 = require("pg");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const ratingService_1 = require("./rating/ratingService");
const problemGenerator_1 = require("./problemGenerator");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const multer_1 = __importDefault(require("multer"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
// Ensure uploads directory exists
const uploadsDir = path_1.default.join(__dirname, '../uploads');
if (!fs_1.default.existsSync(uploadsDir)) {
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
}
// Multer storage configuration
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path_1.default.extname(file.originalname));
    },
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (_req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const extname = allowedTypes.test(path_1.default.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Only images are allowed (jpeg, jpg, png, gif)'));
    },
});
const pool = new pg_1.Pool({
    user: process.env.DB_USER || 'mathuser',
    host: process.env.DB_HOST || 'db',
    database: process.env.DB_NAME || 'math_solved',
    password: process.env.DB_PASSWORD || 'mathpass',
    port: parseInt(process.env.DB_PORT || '5432'),
});
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use('/uploads', express_1.default.static(uploadsDir));
const ensureSchema = async () => {
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_url TEXT');
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
};
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token)
        return res.status(401).json({ error: 'Access token required' });
    jsonwebtoken_1.default.verify(token, JWT_SECRET, (err, user) => {
        if (err)
            return res.status(403).json({ error: 'Invalid or expired token' });
        req.user = user;
        next();
    });
};
app.post('/api/auth/signup', async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password)
        return res.status(400).json({ error: 'All fields are required' });
    try {
        const hashedPassword = await bcrypt_1.default.hash(password, 10);
        const result = await pool.query('INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, rating', [username, email, hashedPassword]);
        const user = result.rows[0];
        res.status(201).json({
            message: 'User created successfully',
            user: { ...user, tier: (0, ratingService_1.getTier)(user.rating) }
        });
    }
    catch (err) {
        if (err.code === '23505')
            return res.status(400).json({ error: 'Username already exists' });
        res.status(500).json({ error: 'Failed to create user' });
    }
});
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        // Try to find user by email or username
        const userResult = await pool.query('SELECT * FROM users WHERE email = $1 OR username = $1', [email]);
        const user = userResult.rows[0];
        if (!user || !(await bcrypt_1.default.compare(password, user.password_hash)))
            return res.status(401).json({ error: 'Invalid credentials' });
        const token = jsonwebtoken_1.default.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                rating: user.rating,
                profile_image_url: user.profile_image_url,
                tier: (0, ratingService_1.getTier)(user.rating)
            }
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Login failed' });
    }
});
app.get('/api/users/profile', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const userResult = await pool.query('SELECT id, username, email, rating, profile_image_url, created_at FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0)
            return res.status(404).json({ error: 'User not found' });
        const user = userResult.rows[0];
        // Get submission statistics
        const statsResult = await pool.query('SELECT COUNT(*) as total, SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct FROM submissions WHERE user_id = $1', [userId]);
        const stats = statsResult.rows[0];
        res.json({
            user: {
                ...user,
                tier: (0, ratingService_1.getTier)(user.rating)
            },
            stats: {
                totalSubmissions: parseInt(stats.total),
                correctSubmissions: parseInt(stats.correct || 0),
                accuracy: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0
            }
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});
app.post('/api/users/profile-image', authenticateToken, (req, res) => {
    upload.single('profileImage')(req, res, async (uploadErr) => {
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
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to update profile image' });
        }
    });
});
// Group Endpoints
app.get('/api/groups', async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    let userId = null;
    if (token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
            userId = decoded.id;
        }
        catch (err) { }
    }
    try {
        const query = `
      SELECT g.*, u.username as creator_name, COUNT(gm.user_id) as member_count,
             EXISTS(SELECT 1 FROM group_members WHERE group_id = g.id AND user_id = $1) as is_member
      FROM groups g
      LEFT JOIN users u ON g.creator_id = u.id
      LEFT JOIN group_members gm ON g.id = gm.group_id
      GROUP BY g.id, u.username
      ORDER BY g.created_at DESC
    `;
        const result = await pool.query(query, [userId || null]);
        res.json(result.rows);
    }
    catch (err) {
        console.error('Failed to fetch groups:', err);
        res.status(500).json({ error: 'Failed to fetch groups' });
    }
});
app.post('/api/groups', authenticateToken, async (req, res) => {
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
        const groupResult = await pool.query('INSERT INTO groups (name, description, creator_id) VALUES ($1, $2, $3) RETURNING id', [name, description, userId]);
        const groupId = groupResult.rows[0].id;
        // Creator automatically joins the group
        await pool.query('INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)', [groupId, userId]);
        res.status(201).json({ message: 'Group created successfully', groupId });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to create group' });
    }
});
app.get('/api/groups/:id', async (req, res) => {
    const groupId = req.params.id;
    try {
        const groupResult = await pool.query(`
      SELECT g.*, u.username as creator_name
      FROM groups g
      JOIN users u ON g.creator_id = u.id
      WHERE g.id = $1
    `, [groupId]);
        if (groupResult.rows.length === 0)
            return res.status(404).json({ error: 'Group not found' });
        const membersResult = await pool.query(`
      SELECT u.id, u.username, u.rating, u.profile_image_url
      FROM group_members gm
      JOIN users u ON gm.user_id = u.id
      WHERE gm.group_id = $1
    `, [groupId]);
        res.json({
            ...groupResult.rows[0],
            members: membersResult.rows.map(m => ({ ...m, tier: (0, ratingService_1.getTier)(m.rating) }))
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch group details' });
    }
});
app.post('/api/groups/:id/join', authenticateToken, async (req, res) => {
    const groupId = req.params.id;
    const userId = req.user.id;
    try {
        await pool.query('INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)', [groupId, userId]);
        res.json({ message: 'Joined group successfully' });
    }
    catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ error: 'Already a member of this group' });
        }
        res.status(500).json({ error: 'Failed to join group' });
    }
});
app.post('/api/groups/:id/leave', authenticateToken, async (req, res) => {
    const groupId = req.params.id;
    const userId = req.user.id;
    try {
        await pool.query('DELETE FROM group_members WHERE group_id = $1 AND user_id = $2', [groupId, userId]);
        res.json({ message: 'Left group successfully' });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to leave group' });
    }
});
app.post('/api/users/change-password', authenticateToken, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Both current and new passwords are required' });
    }
    try {
        const userResult = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
        const user = userResult.rows[0];
        if (!user || !(await bcrypt_1.default.compare(currentPassword, user.password_hash))) {
            return res.status(401).json({ error: 'Invalid current password' });
        }
        const hashedNewPassword = await bcrypt_1.default.hash(newPassword, 10);
        await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashedNewPassword, userId]);
        res.json({ message: 'Password changed successfully' });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to change password' });
    }
});
app.get('/api/users/ranking', async (req, res) => {
    try {
        const result = await pool.query('SELECT username, rating FROM users ORDER BY rating DESC LIMIT 50');
        const users = result.rows.map(u => ({
            ...u,
            tier: (0, ratingService_1.getTier)(u.rating)
        }));
        res.json(users);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch ranking' });
    }
});
app.get('/api/problems', async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    let userId = null;
    if (token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
            userId = decoded.id;
        }
        catch (err) {
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
    }
    catch (err) {
        console.error('Error fetching problems:', err);
        res.status(500).json({ error: 'Failed to fetch problems' });
    }
});
app.post('/api/problems/generate', authenticateToken, async (req, res) => {
    try {
        const newProblems = [];
        for (let i = 0; i < 5; i++) {
            const p = (0, problemGenerator_1.generateProblem)();
            const result = await pool.query('INSERT INTO problems (title, content, answer, initial_difficulty, current_difficulty, type) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id', [p.title, p.content, p.answer, p.difficulty, p.difficulty, 'Calculation']);
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
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to generate problems' });
    }
});
app.post('/api/submissions', authenticateToken, async (req, res) => {
    const { problemId, userAnswer } = req.body;
    const userId = req.user.id;
    try {
        // 이미 맞힌 문제인지 확인
        const existingSubmission = await pool.query('SELECT id FROM submissions WHERE user_id = $1 AND problem_id = $2 AND is_correct = true', [userId, problemId]);
        if (existingSubmission.rows.length > 0) {
            return res.status(400).json({ error: 'Already solved this problem correctly!' });
        }
        // DB에서 실제 정답 가져오기
        const problemRes = await pool.query('SELECT answer FROM problems WHERE id = $1', [problemId]);
        if (problemRes.rows.length === 0)
            return res.status(404).json({ error: 'Problem not found' });
        const correctAnswer = problemRes.rows[0].answer;
        // 공백 전체 제거 및 소문자 변환 후 비교 (더 견고한 체크)
        const normalizedUserAnswer = userAnswer.replace(/\s+/g, '').toLowerCase();
        const normalizedCorrectAnswer = correctAnswer.replace(/\s+/g, '').toLowerCase();
        const isCorrect = normalizedUserAnswer === normalizedCorrectAnswer;
        const updateResult = await (0, ratingService_1.processSubmission)(userId, problemId, isCorrect);
        res.json({
            message: isCorrect ? 'Correct answer!' : 'Wrong answer.',
            isCorrect,
            correctAnswer: isCorrect ? undefined : correctAnswer, // 틀렸을 때만 정답 공개 (선택 사항)
            ...updateResult
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to process submission' });
    }
});
app.post('/api/admin/seed', authenticateToken, async (req, res) => {
    // Simple check if user is 'admin'
    if (req.user.username !== 'admin')
        return res.status(403).json({ error: 'Admin only' });
    try {
        // Trigger generation of 10 problems
        const generated = [];
        for (let i = 0; i < 10; i++) {
            const p = (0, problemGenerator_1.generateProblem)();
            const result = await pool.query('INSERT INTO problems (title, content, answer, initial_difficulty, current_difficulty, type) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id', [p.title, p.content, p.answer, p.difficulty, p.difficulty, 'Calculation']);
            generated.push(result.rows[0].id);
        }
        res.json({ message: '10 problems added successfully', ids: generated });
    }
    catch (err) {
        res.status(500).json({ error: 'Seeding failed' });
    }
});
app.post('/api/admin/reset', authenticateToken, async (req, res) => {
    // Simple check if user is 'admin'
    if (req.user.username !== 'admin')
        return res.status(403).json({ error: 'Admin only' });
    try {
        await pool.query('TRUNCATE problems, submissions RESTART IDENTITY CASCADE');
        res.json({ message: 'Database reset successfully (all problems and submissions cleared)' });
    }
    catch (err) {
        res.status(500).json({ error: 'Database reset failed' });
    }
});
// --- User Management Admin APIs ---
app.get('/api/admin/users', authenticateToken, async (req, res) => {
    if (req.user.username !== 'admin')
        return res.status(403).json({ error: 'Admin only' });
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
            tier: (0, ratingService_1.getTier)(parseFloat(u.rating)),
            total_submissions: parseInt(u.total_submissions),
            correct_submissions: parseInt(u.correct_submissions || 0)
        }));
        res.json(users);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});
app.patch('/api/admin/users/:id/rating', authenticateToken, async (req, res) => {
    if (req.user.username !== 'admin')
        return res.status(403).json({ error: 'Admin only' });
    const { id } = req.params;
    const { rating } = req.body;
    try {
        const result = await pool.query('UPDATE users SET rating = $1 WHERE id = $2 RETURNING id, username, rating', [rating, id]);
        if (result.rows.length === 0)
            return res.status(404).json({ error: 'User not found' });
        res.json({ message: 'Rating updated successfully', user: result.rows[0] });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to update rating' });
    }
});
app.delete('/api/admin/users/:id', authenticateToken, async (req, res) => {
    if (req.user.username !== 'admin')
        return res.status(403).json({ error: 'Admin only' });
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id, username', [id]);
        if (result.rows.length === 0)
            return res.status(404).json({ error: 'User not found' });
        res.json({ message: `User ${result.rows[0].username} deleted successfully` });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to delete user' });
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
