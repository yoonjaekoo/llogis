import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import './styles/globals.css';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

// --- Types ---
interface Problem {
  id: number;
  title: string;
  content: string;
  current_difficulty: number;
  tags: string[];
}

interface User {
  id: number;
  username: string;
  rating: number;
  tier: string;
}

// LaTeX Helper
const renderMath = (content: any) => {
  if (typeof content !== 'string') return null;
  // Replace escaped backslashes if any and ensure proper LaTeX format
  const sanitizedContent = content.replace(/\\\\/g, '\\');
  const parts = sanitizedContent.split(/(\$\$.*?\$\$|\$.*?\$)/gs);

  return parts.map((part, index) => {
    if (part.startsWith('$$') && part.endsWith('$$')) {
      const math = part.slice(2, -2).trim();
      return (
        <div key={index} className="block-math-wrapper">
          <BlockMath math={`\\displaystyle ${math}`} />
        </div>
      );
    }
    if (part.startsWith('$') && part.endsWith('$')) {
      const math = part.slice(1, -1).trim();
      return <InlineMath key={index} math={math} />;
    }
    return part.split('\n').map((line, i) => (
      <React.Fragment key={`${index}-${i}`}>
        {line}
        {i < part.split('\n').length - 1 && <br />}
      </React.Fragment>
    ));
  });
};

// --- Components ---

const Navbar: React.FC<{ 
  user: User | null; 
  onLogout: () => void; 
  theme: string; 
  toggleTheme: () => void 
}> = ({ user, onLogout, theme, toggleTheme }) => (
  <header>
    <div className="container">
      <h1 style={{ margin: 0 }}>
        <Link to="/" style={{ color: 'white', textDecoration: 'none', letterSpacing: '-1px' }}>Logis</Link>
      </h1>
      <nav>
        <ul>
          <li><Link to="/">문제</Link></li>
          {user ? (
            <>
              {user.username === 'admin' && <li><Link to="/admin" style={{ color: '#fab1a0', fontWeight: 800 }}>관리</Link></li>}
              <li>
                <Link to="/profile" style={{ color: 'var(--color-3)', textDecoration: 'none' }}>
                  {user.username} <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>({user.tier})</span> <b style={{ color: 'white' }}>{Math.round(user.rating)}</b>
                </Link>
              </li>
              <li><button onClick={onLogout} style={{ background: 'none', border: 'none', color: '#ff7675', cursor: 'pointer', fontWeight: 800 }}>로그아웃</button></li>
            </>
          ) : (
            <>
              <li><Link to="/login">로그인</Link></li>
              <li><Link to="/signup">가입</Link></li>
            </>
          )}
          <li>
            <button onClick={toggleTheme} className="theme-toggle">
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
          </li>
        </ul>
      </nav>
    </div>
  </header>
);

const Admin: React.FC<{ user: User | null }> = ({ user }) => {
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || user.username !== 'admin') {
      navigate('/');
    }
  }, [user, navigate]);

  const handleSeed = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/admin/seed', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    setMessage(data.message || data.error);
  };

  const handleReset = async () => {
    if (!window.confirm('정말로 모든 문제와 제출 기록을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return;
    }

    const token = localStorage.getItem('token');
    const res = await fetch('/api/admin/reset', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    setMessage(data.message || data.error);
  };

  return (
    <main className="container" style={{ padding: '4rem 0' }}>
      <div className="problem-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
        <h2 style={{ color: 'var(--color-4)', marginBottom: '2rem' }}>관리자 패널</h2>
        
        <div style={{ marginBottom: '3rem', padding: '1.5rem', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '1rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>데이터 관리</h3>
          <p style={{ marginBottom: '1.5rem', opacity: 0.8 }}>데이터베이스에 새로운 문제 10개를 생성하여 추가합니다.</p>
          <button onClick={handleSeed} className="btn" style={{ background: 'var(--color-2)', color: 'white', width: '100%' }}>
            문제 10개 추가 생성
          </button>
        </div>

        <div style={{ marginBottom: '2rem', padding: '1.5rem', background: 'rgba(255, 118, 117, 0.1)', border: '1px solid #ff7675', borderRadius: '1rem' }}>
          <h3 style={{ marginBottom: '1rem', color: '#ff7675' }}>위험 구역</h3>
          <p style={{ marginBottom: '1.5rem', opacity: 0.8 }}>모든 문제와 사용자의 제출 기록을 삭제하고 초기화합니다.</p>
          <button onClick={handleReset} className="btn" style={{ background: '#ff7675', color: 'white', width: '100%' }}>
            데이터베이스 초기화
          </button>
        </div>

        {message && (
          <div style={{ 
            padding: '1rem', 
            background: 'var(--card-bg)', 
            border: '1px solid var(--border)', 
            borderRadius: '0.5rem',
            color: 'var(--color-3)',
            fontWeight: 600,
            textAlign: 'center'
          }}>
            {message}
          </div>
        )}
      </div>
    </main>
  );
};

const Profile: React.FC<{ user: User | null }> = ({ user }) => {
  const [profileData, setProfileData] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const token = localStorage.getItem('token');
    fetch('/api/users/profile', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => setProfileData(data));
  }, [user, navigate]);

  if (!profileData) return <div className="container" style={{ padding: '4rem', textAlign: 'center' }}>로딩 중...</div>;

  const { user: u, stats } = profileData;

  const tierColors: { [key: string]: string } = {
    'Bronze': '#cd7f32',
    'Silver': '#c0c0c0',
    'Gold': '#ffd700',
    'Platinum': '#e5e4e2',
    'Diamond': '#b9f2ff',
    'Ruby': '#e0115f',
    'Master': '#800080',
    'God': '#ff4500',
    'Hacker': '#00ff00'
  };

  return (
    <main className="container" style={{ padding: '4rem 0' }}>
      <div className="problem-card" style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
        <div style={{ 
          width: '120px', 
          height: '120px', 
          borderRadius: '50%', 
          background: tierColors[u.tier] || 'var(--color-3)', 
          margin: '0 auto 2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '3rem',
          boxShadow: '0 0 20px rgba(0,0,0,0.2)',
          color: 'white',
          fontWeight: 800
        }}>
          {u.username[0].toUpperCase()}
        </div>
        <h2 style={{ fontSize: '2.5rem', marginBottom: '0.5rem', color: 'var(--color-4)' }}>{u.username}</h2>
        <div style={{ 
          fontSize: '1.5rem', 
          fontWeight: 800, 
          color: tierColors[u.tier],
          textTransform: 'uppercase',
          letterSpacing: '2px',
          marginBottom: '2rem'
        }}>
          {u.tier} Rank
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '3rem' }}>
          <div style={{ padding: '1.5rem', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '1rem' }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>현재 레이팅</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{Math.round(u.rating)}</div>
          </div>
          <div style={{ padding: '1.5rem', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '1rem' }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>해결한 문제</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{stats.correctSubmissions}</div>
          </div>
          <div style={{ padding: '1.5rem', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '1rem' }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>정답률</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{Math.round(stats.accuracy)}%</div>
          </div>
        </div>

        <div style={{ textAlign: 'left', opacity: 0.6, fontSize: '0.9rem' }}>
          가입일: {new Date(u.created_at).toLocaleDateString()}
        </div>
      </div>
    </main>
  );
};

const ProblemList: React.FC<{ user: User | null; setUser: (u: User) => void }> = ({ user, setUser }) => {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [selectedProblemId, setSelectedProblemId] = useState<number | null>(null);
  const [answers, setAnswers] = useState<{[key: number]: string}>({});
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const headers: any = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    fetch('/api/problems', { headers })
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch problems');
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
          setProblems(data);
          if (data.length > 0) setSelectedProblemId(data[0].id);
        } else {
          console.error('Invalid data format:', data);
          setProblems([]);
        }
      })
      .catch(err => {
        console.error(err);
        setProblems([]);
      });
  }, []);

  const handleInputChange = (id: number, val: string) => {
    setAnswers(prev => ({ ...prev, [id]: val }));
  };

  const handleSubmit = (problemId: number) => {
    if (!user) {
      alert('로그인이 필요합니다!');
      navigate('/login');
      return;
    }

    const userAnswer = answers[problemId];
    if (!userAnswer || userAnswer.trim() === '') {
      alert('정답을 입력해주세요!');
      return;
    }

    const token = localStorage.getItem('token');
    fetch('/api/submissions', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ problemId, userAnswer })
    })
    .then(res => res.json())
    .then(data => {
      if (data.isCorrect) {
        alert(`정답입니다! 🎉\n레이팅 변화: ${Math.round(user.rating)} → ${Math.round(data.newUserRating.rating)}`);
        
        // Remove the solved problem
        const remainingProblems = problems.filter(p => p.id !== problemId);
        
        // Automatically generate a new one to keep the list full
        fetch('/api/problems/generate', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(genData => {
          const updatedProblems = [...remainingProblems, ...genData.problems];
          setProblems(updatedProblems);
          if (updatedProblems.length > 0) {
            // Select the next problem in the list or the newly generated one
            const nextIndex = problems.findIndex(p => p.id === problemId);
            if (nextIndex < updatedProblems.length) {
                setSelectedProblemId(updatedProblems[nextIndex].id);
            } else {
                setSelectedProblemId(updatedProblems[0].id);
            }
          } else {
            setSelectedProblemId(null);
          }
        });
      } else {
        alert(`아쉽네요, 틀렸습니다. 🧐\n레이팅 변화: ${Math.round(user.rating)} → ${Math.round(data.newUserRating.rating)}`);
      }
      
      const updatedUser = { 
        ...user, 
        rating: data.newUserRating.rating,
        tier: data.tier
      };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      setAnswers(prev => ({ ...prev, [problemId]: '' }));
    });
  };

  const selectedProblem = problems.find(p => p.id === selectedProblemId);

  return (
    <main className="container" style={{ display: 'flex', gap: '2rem', padding: '2rem 0', maxWidth: '1400px' }}>
      {/* Sidebar List */}
      <div style={{ width: '300px', flexShrink: 0 }}>
        <h3 style={{ marginBottom: '1rem', color: 'var(--color-4)' }}>문제 목록 ({problems.length})</h3>
        <div style={{ maxHeight: '70vh', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '1rem', background: 'var(--card-bg)' }}>
          {problems.map(p => (
            <div 
              key={p.id} 
              onClick={() => setSelectedProblemId(p.id)}
              style={{ 
                padding: '1rem', 
                cursor: 'pointer', 
                borderBottom: '1px solid var(--border)',
                background: selectedProblemId === p.id ? 'var(--color-3)' : 'transparent',
                color: selectedProblemId === p.id ? 'var(--color-4)' : 'inherit',
                fontWeight: selectedProblemId === p.id ? 800 : 400,
                transition: 'all 0.2s'
              }}
            >
              {p.title}
              <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Lv.{Math.round(p.current_difficulty)}</div>
            </div>
          ))}
          {problems.length === 0 && (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>모든 문제를 풀었습니다!</p>
              <button 
                onClick={() => {
                  const token = localStorage.getItem('token');
                  fetch('/api/problems/generate', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                  })
                  .then(res => res.json())
                  .then(data => {
                    setProblems(prev => [...prev, ...data.problems]);
                    if (data.problems.length > 0) setSelectedProblemId(data.problems[0].id);
                  });
                }}
                className="btn"
                style={{ background: 'var(--color-2)', color: 'white' }}
              >
                새 문제 생성하기
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Problem View */}
      <div style={{ flexGrow: 1 }}>
        {selectedProblem ? (
          <div className="problem-card" style={{ margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--color-4)' }}>{selectedProblem.title}</h3>
              <span className="difficulty-badge">{Math.round(selectedProblem.current_difficulty)}</span>
            </div>
            <div className="math-content" style={{ fontSize: '1.8rem' }}>
              {renderMath(selectedProblem.content)}
            </div>
            <div style={{ marginTop: '2rem' }}>
              <input 
                type="text" 
                placeholder="정답을 입력하세요" 
                className="answer-input"
                autoFocus
                value={answers[selectedProblem.id] || ''}
                onChange={(e) => handleInputChange(selectedProblem.id, e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSubmit(selectedProblem.id)}
              />
              <button onClick={() => handleSubmit(selectedProblem.id)} className="btn btn-solve">
                정답 제출하기
              </button>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
            문제를 선택해주세요.
          </div>
        )}
      </div>
    </main>
  );
};

const Login: React.FC<{ onLogin: (token: string, user: User) => void }> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (res.ok) {
      onLogin(data.token, data.user);
      navigate('/');
    } else {
      alert(data.error);
    }
  };

  return (
    <main className="container">
      <div className="auth-form">
        <h2 style={{ color: 'var(--color-4)' }}>환영합니다</h2>
        <form onSubmit={handleSubmit}>
          <input type="text" placeholder="아이디 또는 이메일" value={email} onChange={e => setEmail(e.target.value)} required />
          <input type="password" placeholder="비밀번호" value={password} onChange={e => setPassword(e.target.value)} required />
          <button type="submit">로그인</button>
        </form>
      </div>
    </main>
  );
};

const Signup: React.FC = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });
    if (res.ok) {
      alert('가입을 환영합니다!');
      navigate('/login');
    } else {
      const data = await res.json();
      alert(data.error);
    }
  };

  return (
    <main className="container">
      <div className="auth-form">
        <h2 style={{ color: 'var(--color-4)' }}>가입하기</h2>
        <form onSubmit={handleSubmit}>
          <input type="text" placeholder="이름" value={username} onChange={e => setUsername(e.target.value)} required />
          <input type="email" placeholder="이메일" value={email} onChange={e => setEmail(e.target.value)} required />
          <input type="password" placeholder="비밀번호" value={password} onChange={e => setPassword(e.target.value)} required />
          <button type="submit">Logis 시작하기</button>
        </form>
      </div>
    </main>
  );
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) setUser(JSON.parse(savedUser));
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const handleLogin = (token: string, user: User) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setUser(user);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <Router>
      <Navbar user={user} onLogout={handleLogout} theme={theme} toggleTheme={toggleTheme} />
      <Routes>
        <Route path="/" element={<ProblemList user={user} setUser={setUser} />} />
        <Route path="/login" element={<Login onLogin={handleLogin} />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/profile" element={<Profile user={user} />} />
        <Route path="/admin" element={<Admin user={user} />} />
      </Routes>
    </Router>
  );
};

export default App;
