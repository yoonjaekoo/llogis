import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import './styles/globals.css';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
import GooseRoom from './GooseRoom';

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
  profile_image_url?: string;
  bio?: string;
  streak?: number;
  tokens?: number;
  xp?: number;
  quests?: any[];
  streak_repaired?: boolean;
  can_generate_problems?: boolean;
  equipped_title?: string;
  created_at?: string;
}

// LaTeX Helper
const renderMath = (content: any) => {
  if (typeof content !== 'string') return null;
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
  <header role="banner">
    <div className="container">
      <h1 style={{ margin: 0 }}>
        <Link to="/" aria-label="Logis 홈으로 이동" style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', color: 'white', textDecoration: 'none' }}>
          <img src="/logo.png" alt="Logis 로고" width="40" height="40" style={{ borderRadius: '8px', objectFit: 'cover' }} />
          <span style={{ letterSpacing: '-1px' }}>Logis</span>
        </Link>
      </h1>
      <nav aria-label="주 메뉴">
        <ul>
          <li><Link to="/">문제</Link></li>
          <li><Link to="/ranking">랭킹</Link></li>
          <li><Link to="/groups">그룹</Link></li>
          <li><Link to="/about">소개</Link></li>
          {user ? (
            <>
              {user.username === 'admin' && <li><Link to="/admin" style={{ color: '#fab1a0', fontWeight: 800 }}>관리</Link></li>}
              <li>
                <Link to="/profile" aria-label={`${user.username} 프로필`} style={{ color: 'var(--color-3)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {user.profile_image_url ? (
                    <img src={user.profile_image_url} alt={`${user.username} 프로필`} width="24" height="24" loading="lazy" style={{ borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div aria-hidden="true" style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--color-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: 'white' }}>
                      {user.username[0].toUpperCase()}
                    </div>
                  )}
                  {user.username} <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>({user.tier})</span> <b style={{ color: 'white' }}>{Math.round(user.rating).toLocaleString()}</b>
                </Link>
              </li>
              <li><button onClick={onLogout} aria-label="로그아웃" style={{ background: 'none', border: 'none', color: '#ff7675', cursor: 'pointer', fontWeight: 800 }}>로그아웃</button></li>
            </>
          ) : (
            <>
              <li><Link to="/login">로그인</Link></li>
              <li><Link to="/signup">가입</Link></li>
            </>
          )}
          <li>
            <button onClick={toggleTheme} className="theme-toggle" aria-label={theme === 'light' ? '다크 모드로 전환' : '라이트 모드로 전환'}>
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
          </li>
        </ul>
      </nav>
    </div>
  </header>
);

const About: React.FC<{ user: User | null }> = ({ user }) => {
  const tiers = [
    { name: 'Bronze', threshold: '0' },
    { name: 'Silver', threshold: '100,000' },
    { name: 'Gold', threshold: '300,000' },
    { name: 'Platinum', threshold: '800,000' },
    { name: 'Diamond', threshold: '2,000,000' },
    { name: 'Ruby', threshold: '5,000,000' },
    { name: 'Master', threshold: '12,000,000' },
    { name: 'God', threshold: '30,000,000' },
    { name: 'Hacker', threshold: '70,000,000' }
  ];

  return (
    <main className="container" style={{ padding: '4rem 0', maxWidth: '800px' }}>
      <Helmet>
        <title>소개 | Logis - 수학 문제 풀이 플랫폼</title>
        <meta name="description" content="Logis는 수학 문제를 풀고 레이팅을 올리는 재미있는 수학 학습 플랫폼입니다. 다양한 난이도의 문제를 도전하고 글로벌 랭킹에 도전하세요." />
        <meta property="og:title" content="소개 | Logis - 수학 문제 풀이 플랫폼" />
        <link rel="canonical" href="https://llogis.xyz/about" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [{
            "@type": "ListItem",
            "position": 1,
            "name": "Logis",
            "item": "https://llogis.xyz"
          }, {
            "@type": "ListItem",
            "position": 2,
            "name": "소개",
            "item": "https://llogis.xyz/about"
          }]
        })}</script>
      </Helmet>
      <article className="problem-card" style={{ textAlign: 'center' }}>
        <img src="/logo.png" alt="Logis 로고" loading="lazy" style={{ width: '80px', height: '80px', borderRadius: '1.5rem', marginBottom: '1.5rem', boxShadow: 'var(--card-shadow)' }} />
        <h2 style={{ color: 'var(--color-4)', marginBottom: '1.5rem' }}>About Logis</h2>
        <p style={{ marginBottom: '2rem' }}>수학 문제를 풀고 레이팅을 올리는 재미있는 수학 학습 플랫폼입니다.</p>
        
        <section aria-label="랭크 기준">
          <h3 style={{ marginBottom: '1rem' }}>랭크 기준</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem', textAlign: 'center' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={{ padding: '0.8rem' }}>랭크</th>
                <th style={{ padding: '0.8rem' }}>레이팅 기준</th>
              </tr>
            </thead>
            <tbody>
              {tiers.map(t => (
                <tr key={t.name} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.8rem', fontWeight: 800 }}>{t.name}</td>
                  <td style={{ padding: '0.8rem' }}>{t.threshold}+</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section aria-label="기여자">
          <h3 style={{ marginBottom: '0.5rem' }}>Contributors</h3>
          <p>yoonjaekoo, 13ksh</p>
        </section>

        {user && (
          <section aria-label="내 정보" style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
            <h3 style={{ marginBottom: '0.5rem' }}>내 랭크 및 레이팅</h3>
            <p style={{ fontSize: '1.2rem', fontWeight: 800 }}>{user.tier} Rank, {Math.round(user.rating).toLocaleString()}</p>
          </section>
        )}
      </article>
    </main>
  );
};
const Landing: React.FC<{ user: User | null }> = ({ user }) => {
  const navigate = useNavigate();
  const tierColors: { [key: string]: string } = {
    'Bronze': '#cd7f32', 'Silver': '#a8b8c8', 'Gold': '#ffd700',
    'Platinum': '#8eb4cf', 'Diamond': '#5bcefa', 'Ruby': '#e0115f',
    'Master': '#9b59b6', 'God': '#ff6b35', 'Hacker': '#00e676'
  };
  const tier = user ? (user as any).tier || 'Bronze' : null;

  return (
    <main>
      <Helmet>
        <title>홈 | Logis - 수학 문제 풀이 플랫폼</title>
        <meta name="description" content="Logis에서 수학 실력을 키우세요. Glicko-2 레이팅, 스트릭, 일일 퀘스트, 토큰 시스템으로 매일 성장합니다." />
      </Helmet>

      {/* ── Hero ── */}
      <section className="landing-hero">
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '720px' }}>
          {user ? (
            <div style={{ marginBottom: '1.5rem' }}>
              <div className="stats-chip-row">
                <span className="stats-chip" style={{ borderColor: tierColors[tier] || 'var(--border)', color: tierColors[tier] || 'var(--text-main)' }}>
                  🏅 {tier}
                </span>
                <span className="stats-chip">✨ {Math.round(user.rating).toLocaleString()} RP</span>
                <span className="stats-chip">🔥 {(user as any).streak ?? 0}일 연속</span>
                <span className="stats-chip">🪙 {(user as any).tokens ?? 0} 토큰</span>
              </div>
            </div>
          ) : null}

          <h1 className="landing-hero-title">
            {user ? `어서 오세요,\n${user.username}!` : '수학 실력을\n레이팅으로 증명하세요'}
          </h1>
          <p className="landing-hero-sub">
            {user
              ? '오늘의 퀘스트를 완료하고 스트릭을 이어가세요. 매일 문제를 풀면 레이팅이 오릅니다.'
              : 'Glicko-2 레이팅으로 나의 수준을 객관적으로 파악하고, 매일 문제를 풀어 성장하세요.'}
          </p>

          <div className="landing-cta-group">
            <button
              onClick={() => navigate('/solve')}
              className="btn-hero btn-hero-primary"
            >
              🧮 문제 풀기
            </button>
            {!user && (
              <button
                onClick={() => navigate('/signup')}
                className="btn-hero btn-hero-secondary"
              >
                무료로 시작하기
              </button>
            )}
            {user && (
              <button
                onClick={() => navigate('/profile')}
                className="btn-hero btn-hero-secondary"
              >
                내 대시보드
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ── Stats strip ── */}
      <div className="landing-stats-strip">
        <div className="landing-stats-grid">
          <div className="landing-stat-item">
            <div className="landing-stat-number">100+</div>
            <div className="landing-stat-label">수학 문제</div>
          </div>
          <div className="landing-stat-item">
            <div className="landing-stat-number">9개</div>
            <div className="landing-stat-label">티어 등급</div>
          </div>
          <div className="landing-stat-item">
            <div className="landing-stat-number">AI</div>
            <div className="landing-stat-label">문제 자동 생성</div>
          </div>
          <div className="landing-stat-item">
            <div className="landing-stat-number">∞</div>
            <div className="landing-stat-label">성장의 가능성</div>
          </div>
        </div>
      </div>

      {/* ── Features ── */}
      <section className="landing-features">
        <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            왜 Logis인가?
          </span>
        </div>
        <h2 style={{ textAlign: 'center', fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 900, margin: '0.5rem 0 0', letterSpacing: '-1px', color: 'var(--text-main)' }}>
          게임처럼 수학을 즐기세요
        </h2>

        <div className="landing-features-grid">
          {[
            { icon: '📈', title: 'Glicko-2 레이팅', desc: '체스 세계에서 검증된 Glicko-2 알고리즘으로 나의 수학 실력을 정밀하게 측정합니다.' },
            { icon: '🔥', title: '연속 스트릭', desc: '매일 1문제 이상 풀면 스트릭이 쌓입니다. 토큰으로 긴급 수리도 가능해요!' },
            { icon: '🪙', title: '토큰 경제', desc: '정답을 맞힐 때마다 토큰을 획득하세요. 스트릭 수리, 혜택 등에 활용할 수 있습니다.' },
            { icon: '📅', title: '일일 퀘스트', desc: '매일 새로운 퀘스트가 갱신됩니다. 완료하면 XP와 토큰을 대량으로 획득할 수 있어요.' },
            { icon: '🏆', title: '티어 시스템', desc: 'Bronze부터 Hacker까지 — 레이팅이 오를수록 더 높은 티어를 달성하세요.' },
            { icon: '🤖', title: 'AI 문제 생성', desc: 'NVIDIA NIM 기반 AI가 원하는 단원의 문제를 즉시 만들어 드립니다.' },
          ].map(f => (
            <div key={f.title} className="feature-card">
              <span className="feature-icon">{f.icon}</span>
              <h3 className="feature-title">{f.title}</h3>
              <p className="feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      {!user && (
        <section style={{ textAlign: 'center', padding: '5rem 1.5rem', background: 'var(--card-bg)', borderTop: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '1rem', color: 'var(--color-4)' }}>
            지금 바로 시작하세요
          </h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '1.05rem' }}>
            무료로 가입하고 수학 문제 풀이를 시작하세요.
          </p>
          <div className="landing-cta-group">
            <button onClick={() => navigate('/signup')} className="btn-hero btn-hero-primary">🚀 무료 가입</button>
            <button onClick={() => navigate('/login')} className="btn-hero btn-hero-secondary">로그인</button>
          </div>
        </section>
      )}
    </main>
  );
};


const Groups: React.FC<{ user: User | null }> = ({ user }) => {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  const fetchGroups = useCallback(() => {
    const token = localStorage.getItem('token');
    const headers: any = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    fetch('/api/groups', { headers })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch groups');
        return data;
      })
      .then(data => {
        setGroups(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        setGroups([]);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return navigate('/login');
    
    const token = localStorage.getItem('token');
    const res = await fetch('/api/groups', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name, description })
    });
    
    const data = await res.json();
    if (res.ok) {
      alert('그룹이 생성되었습니다!');
      setName('');
      setDescription('');
      setShowCreate(false);
      fetchGroups();
    } else {
      alert(data.error);
    }
  };

  const handleJoin = async (e: React.MouseEvent, groupId: number) => {
    e.stopPropagation();
    if (!user) return navigate('/login');
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/groups/${groupId}/join`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (res.ok) {
      alert('그룹에 가입되었습니다!');
      fetchGroups();
    } else {
      alert(data.error);
    }
  };

  if (loading) return <div className="container" style={{ padding: '4rem', textAlign: 'center' }}>로딩 중...</div>;

  const isSilverPlus = user && user.rating >= 100000;

  return (
    <main className="container" style={{ padding: '4rem 0' }}>
      <Helmet>
        <title>그룹 | Logis - 수학 문제 풀이 플랫폼</title>
        <meta name="description" content="Logis에서 다른 유저들과 그룹을 만들어 함께 수학 문제를 풀고 경쟁해보세요. 그룹 레이팅 경쟁에 참여하세요!" />
        <meta property="og:title" content="그룹 | Logis - 수학 문제 풀이 플랫폼" />
        <link rel="canonical" href={`https://llogis.xyz${location.pathname}`} />
      </Helmet>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <section aria-label="그룹 헤더" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h2 style={{ color: 'var(--color-4)', fontSize: '2.5rem', marginBottom: '0.5rem' }}>유저 그룹</h2>
            <p style={{ opacity: 0.7 }}>다른 유저들과 함께 학습하고 경쟁해보세요.</p>
          </div>
          {isSilverPlus ? (
            <button 
              onClick={() => setShowCreate(!showCreate)} 
              className="btn" 
              style={{ background: 'var(--color-3)', color: 'white', width: 'auto' }}
            >
              {showCreate ? '취소' : '그룹 만들기'}
            </button>
          ) : (
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textAlign: 'right' }}>
              그룹 생성은 <b>Silver</b> 티어 이상부터 가능합니다.
            </div>
          )}
        </section>
        {showCreate && (
            <div className="problem-card" style={{ marginBottom: '2rem' }}>
              <h3 style={{ marginBottom: '1.5rem' }}>새 그룹 생성</h3>
              <form onSubmit={handleCreate}>
              <input 
                type="text" 
                placeholder="그룹 이름" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                style={{ width: '100%', padding: '0.8rem', borderRadius: '0.5rem', border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text-main)', marginBottom: '1rem' }}
                required 
              />
              <textarea 
                placeholder="그룹 설명" 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                style={{ width: '100%', padding: '0.8rem', borderRadius: '0.5rem', border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text-main)', marginBottom: '1rem', minHeight: '100px' }}
              />
              <button type="submit" className="btn" style={{ background: 'var(--color-4)', color: 'white' }}>만들기</button>
            </form>
          </div>
        )}

        <section aria-label="그룹 목록" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {groups.map(g => (
            <div 
              key={g.id} 
              className="problem-card" 
              onClick={() => navigate(`/groups/${g.id}`)}
              style={{ margin: 0, display: 'flex', flexDirection: 'column', cursor: 'pointer', border: g.is_member ? '2px solid var(--color-3)' : g.is_pending ? '2px solid var(--color-2)' : '1px solid var(--border)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <h3 style={{ color: 'var(--color-3)', margin: 0 }}>{g.name}</h3>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {g.is_member && <span style={{ background: 'var(--color-3)', color: 'white', fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '1rem', fontWeight: 800 }}>참여 중</span>}
                  {g.is_pending && <span style={{ background: 'var(--color-2)', color: 'white', fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '1rem', fontWeight: 800 }}>가입 대기 중</span>}
                </div>
              </div>
              <p style={{ fontSize: '0.9rem', opacity: 0.8, marginBottom: '1.5rem', flexGrow: 1, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {g.description || '설명이 없습니다.'}
              </p>
              <div style={{ fontSize: '0.8rem', marginBottom: '1rem' }}>
                <div>방장: <b>{g.creator_name}</b></div>
                <div>멤버: <b>{g.member_count}명</b></div>
              </div>
              {!g.is_member && !g.is_pending && (
                <button onClick={(e) => handleJoin(e, g.id)} className="btn" style={{ background: 'var(--color-1)', color: 'white', width: '100%' }}>
                  가입 신청하기
                </button>
              )}
              {g.is_pending && (
                <button disabled className="btn" style={{ background: 'var(--color-2)', color: 'white', width: '100%', opacity: 0.7, cursor: 'not-allowed' }}>
                  승인 대기 중...
                </button>
              )}
            </div>
          ))}
          {groups.length === 0 && <p style={{ textAlign: 'center', gridColumn: '1 / -1', opacity: 0.5 }}>아직 생성된 그룹이 없습니다.</p>}
        </section>
      </div>
    </main>
  );
};

const GroupDetail: React.FC<{ user: User | null }> = ({ user }) => {
  const { id } = useParams<{ id: string }>();
  const [group, setGroup] = useState<any>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  // Competitions state
  const [competitions, setCompetitions] = useState<any[]>([]);
  const [activeCompId, setActiveCompId] = useState<number | null>(null);
  const [compDetail, setCompDetail] = useState<any>(null);
  const [showCreateComp, setShowCreateComp] = useState(false);
  const [compTitle, setCompTitle] = useState('');
  const [compDesc, setCompDesc] = useState('');
  const [compDuration, setCompDuration] = useState('24'); // default 24 hours
  const [activeTab, setActiveTab] = useState<'members' | 'competitions'>('members');

  const fetchGroupDetail = useCallback(() => {
    const token = localStorage.getItem('token');
    const headers: any = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    fetch(`/api/groups/${id}`, { headers })
      .then(res => res.json())
      .then(data => {
        setGroup(data);
        setLoading(false);
        
        // If owner, fetch join requests
        if (user && data.creator_id === user.id) {
          fetch(`/api/groups/${id}/requests`, { headers })
            .then(res => res.json())
            .then(reqs => {
              if (Array.isArray(reqs)) setRequests(reqs);
            });
        }
      });
  }, [id, user]);

  const fetchCompetitions = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    fetch(`/api/groups/${id}/competitions`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setCompetitions(data);
      })
      .catch(err => console.error(err));
  }, [id]);

  const fetchCompetitionDetail = useCallback((compId: number) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    fetch(`/api/groups/${id}/competitions/${compId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (!data.error) setCompDetail(data);
      })
      .catch(err => console.error(err));
  }, [id]);

  useEffect(() => {
    fetchGroupDetail();
  }, [fetchGroupDetail]);

  useEffect(() => {
    if (group && group.is_member) {
      fetchCompetitions();
    }
  }, [group, fetchCompetitions]);

  useEffect(() => {
    let interval: any;
    if (activeCompId) {
      fetchCompetitionDetail(activeCompId);
      // Auto refresh leaderboard every 10 seconds
      interval = setInterval(() => {
        fetchCompetitionDetail(activeCompId);
      }, 10000);
    }
    return () => clearInterval(interval);
  }, [activeCompId, fetchCompetitionDetail]);

  const handleJoin = async () => {
    if (!user) return navigate('/login');
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/groups/${id}/join`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (res.ok) {
      alert(data.message || '가입 신청이 완료되었습니다!');
      fetchGroupDetail();
    } else {
      alert(data.error);
    }
  };

  const handleLeave = async () => {
    if (!window.confirm('정말로 그룹을 탈퇴하시겠습니까?')) return;
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/groups/${id}/leave`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      alert('그룹에서 탈퇴하였습니다.');
      navigate('/groups');
    } else {
      alert('탈퇴 실패');
    }
  };

  const handleApprove = async (requestId: number) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/groups/${id}/requests/${requestId}/approve`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      alert('가입 신청을 승인했습니다.');
      fetchGroupDetail();
    } else {
      const data = await res.json();
      alert(data.error);
    }
  };

  const handleReject = async (requestId: number) => {
    if (!window.confirm('가입 신청을 거절하시겠습니까?')) return;
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/groups/${id}/requests/${requestId}/reject`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      alert('가입 신청을 거절했습니다.');
      fetchGroupDetail();
    } else {
      const data = await res.json();
      alert(data.error);
    }
  };

  const handleCreateCompetition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return navigate('/login');
    const token = localStorage.getItem('token');

    const res = await fetch(`/api/groups/${id}/competitions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        title: compTitle,
        description: compDesc,
        durationHours: compDuration
      })
    });

    const data = await res.json();
    if (res.ok) {
      alert('경쟁이 시작되었습니다! 다른 멤버들과 경쟁해보세요.');
      setCompTitle('');
      setCompDesc('');
      setCompDuration('24');
      setShowCreateComp(false);
      fetchCompetitions();
    } else {
      alert(data.error);
    }
  };

  const handleCloseCompDetail = () => {
    setActiveCompId(null);
    setCompDetail(null);
  };

  if (loading) return <div className="container" style={{ padding: '4rem', textAlign: 'center' }}>로딩 중...</div>;
  if (!group || group.error) return <div className="container" style={{ padding: '4rem', textAlign: 'center' }}>그룹을 찾을 수 없습니다.</div>;

  const members = Array.isArray(group.members) ? group.members : [];
  const isMember = group.is_member;
  const isPending = group.is_pending;
  const isOwner = user && group.creator_id === user.id;

  return (
    <main className="container" style={{ padding: '4rem 0' }}>
      <Helmet>
        <title>{group.name} | Logis - 수학 문제 풀이 플랫폼</title>
        <meta name="description" content={`${group.name} 그룹 - ${group.description || '설명이 없습니다.'} Logis에서 그룹 멤버들과 함께 수학을 학습하세요.`} />
        <meta property="og:title" content={`${group.name} | Logis`} />
        <link rel="canonical" href={`https://llogis.xyz/groups/${id}`} />
      </Helmet>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <button onClick={() => navigate('/groups')} style={{ background: 'none', border: 'none', color: 'var(--color-3)', cursor: 'pointer', marginBottom: '1rem', fontWeight: 800 }}>← 목록으로 돌아가기</button>
        
        <div className="problem-card" style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h2 style={{ color: 'var(--color-4)', fontSize: '2.5rem', margin: 0 }}>{group.name}</h2>
            {isMember ? (
              <button onClick={handleLeave} className="btn" style={{ background: '#ff7675', color: 'white', width: 'auto' }}>그룹 탈퇴</button>
            ) : isPending ? (
              <button disabled className="btn" style={{ background: 'var(--color-2)', color: 'white', width: 'auto', opacity: 0.7 }}>가입 대기 중</button>
            ) : (
              <button onClick={handleJoin} className="btn" style={{ background: 'var(--color-1)', color: 'white', width: 'auto' }}>가입 신청하기</button>
            )}
          </div>
          <p style={{ fontSize: '1.1rem', opacity: 0.9, marginBottom: '2rem', lineHeight: 1.6 }}>{group.description || '설명이 없습니다.'}</p>
          <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.05)', borderRadius: '0.5rem', fontSize: '0.9rem' }}>
             방장: <b>{group.creator_name}</b> | 생성일: {new Date(group.created_at).toLocaleDateString()}
          </div>
        </div>

        {isOwner && requests.length > 0 && (
          <div className="problem-card" style={{ marginBottom: '2rem', border: '2px solid var(--color-4)' }}>
            <h3 style={{ marginBottom: '1.5rem', color: 'var(--color-4)' }}>가입 신청 관리 ({requests.length})</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {requests.map((r: any) => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'rgba(0,0,0,0.02)', borderRadius: '0.5rem', border: '1px solid var(--border)', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--color-3)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                      {r.profile_image_url ? <img src={r.profile_image_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : r.username[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 800 }}>{r.username}</div>
                      <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>{r.tier} | {Math.round(r.rating).toLocaleString()}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => handleApprove(r.id)} className="btn" style={{ padding: '0.5rem 1rem', width: 'auto', background: 'var(--color-3)', color: 'white', fontSize: '0.9rem' }}>승인</button>
                    <button onClick={() => handleReject(r.id)} className="btn" style={{ padding: '0.5rem 1rem', width: 'auto', background: '#ff7675', color: 'white', fontSize: '0.9rem' }}>거절</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab Selection */}
        <div style={{ display: 'flex', gap: '1rem', borderBottom: '2px solid var(--border)', marginBottom: '1.5rem', paddingBottom: '0.5rem' }}>
          <button 
            onClick={() => setActiveTab('members')} 
            style={{ 
              background: 'none', border: 'none', 
              color: activeTab === 'members' ? 'var(--color-4)' : 'var(--text-muted)', 
              fontWeight: 800, fontSize: '1.1rem', cursor: 'pointer',
              borderBottom: activeTab === 'members' ? '3px solid var(--color-4)' : 'none',
              paddingBottom: '0.5rem', marginBottom: '-0.7rem'
            }}
          >
            그룹 멤버 ({members.length})
          </button>
          {isMember && (
            <button 
              onClick={() => setActiveTab('competitions')} 
              style={{ 
                background: 'none', border: 'none', 
                color: activeTab === 'competitions' ? 'var(--color-4)' : 'var(--text-muted)', 
                fontWeight: 800, fontSize: '1.1rem', cursor: 'pointer',
                borderBottom: activeTab === 'competitions' ? '3px solid var(--color-4)' : 'none',
                paddingBottom: '0.5rem', marginBottom: '-0.7rem'
              }}
            >
              레이팅 경쟁 ({competitions.length})
            </button>
          )}
        </div>

        {/* Tab Contents: Members */}
        {activeTab === 'members' && (
          <div>
            <h3 style={{ marginBottom: '1.5rem', color: 'var(--color-4)' }}>그룹 멤버 ({members.length})</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
              {members.map((m: any) => (
                <div key={m.id} onClick={() => navigate(`/users/${m.id}`)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '1rem' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--color-3)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>
                    {m.profile_image_url ? (
                      <img src={m.profile_image_url} alt={m.username} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : m.username[0].toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.username}</div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>{m.tier} | {Math.round(m.rating).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab Contents: Competitions */}
        {activeTab === 'competitions' && isMember && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, color: 'var(--color-4)' }}>진행 중인 레이팅 경쟁</h3>
              <button 
                onClick={() => setShowCreateComp(!showCreateComp)} 
                className="btn" 
                style={{ background: 'var(--color-3)', color: 'var(--color-4)', width: 'auto', padding: '0.5rem 1.5rem', fontSize: '0.9rem' }}
              >
                {showCreateComp ? '생성 취소' : '경쟁 주최하기'}
              </button>
            </div>

            {showCreateComp && (
              <form onSubmit={handleCreateCompetition} className="problem-card" style={{ marginBottom: '2rem', border: '1px solid var(--color-3)' }}>
                <h4 style={{ margin: '0 0 1rem 0', color: 'var(--color-4)' }}>새 경쟁 열기</h4>
                <div style={{ marginBottom: '1rem' }}>
                  <input 
                    type="text" 
                    placeholder="경쟁 제목 (예: 주말 레이팅 대격돌!)" 
                    value={compTitle} 
                    onChange={e => setCompTitle(e.target.value)} 
                    style={{ width: '100%', padding: '0.8rem', borderRadius: '0.5rem', border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text-main)' }}
                    required 
                  />
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <textarea 
                    placeholder="경쟁 설명 또는 규칙" 
                    value={compDesc} 
                    onChange={e => setCompDesc(e.target.value)} 
                    style={{ width: '100%', padding: '0.8rem', borderRadius: '0.5rem', border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text-main)', minHeight: '80px' }}
                  />
                </div>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', opacity: 0.8 }}>경쟁 제한 시간 (시간 단위)</label>
                  <select 
                    value={compDuration} 
                    onChange={e => setCompDuration(e.target.value)} 
                    style={{ width: '100%', padding: '0.8rem', borderRadius: '0.5rem', border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text-main)' }}
                  >
                    <option value="1">1시간</option>
                    <option value="3">3시간</option>
                    <option value="6">6시간</option>
                    <option value="12">12시간</option>
                    <option value="24">24시간 (하루)</option>
                    <option value="48">48시간 (이틀)</option>
                    <option value="72">72시간 (사흘)</option>
                    <option value="168">168시간 (일주일)</option>
                  </select>
                </div>
                <button type="submit" className="btn" style={{ background: 'var(--color-4)', color: 'white' }}>대회 시작하기 🚀</button>
              </form>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
              {competitions.map((comp: any) => {
                const isOngoing = comp.status === 'ongoing';
                const isPending = comp.status === 'pending';
                const isEnded = comp.status === 'ended';

                // Calculate time left
                const endTime = new Date(comp.end_time).getTime();
                const nowTime = new Date().getTime();
                const diffMs = endTime - nowTime;
                let timeLeftStr = '';

                if (isOngoing && diffMs > 0) {
                  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                  timeLeftStr = `종료까지 ${diffHours}시간 ${diffMins}분 남음`;
                } else if (isEnded) {
                  timeLeftStr = '경쟁 종료됨';
                } else if (isPending) {
                  timeLeftStr = '시작 대기 중';
                }

                return (
                  <div 
                    key={comp.id} 
                    className="problem-card" 
                    onClick={() => setActiveCompId(comp.id)}
                    style={{ margin: 0, cursor: 'pointer', border: isOngoing ? '2px solid var(--color-4)' : '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <h4 style={{ margin: 0, color: 'var(--color-4)' }}>{comp.title}</h4>
                      <span style={{ 
                        fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '1rem', fontWeight: 800, color: 'white',
                        background: isOngoing ? 'var(--color-1)' : isEnded ? 'var(--text-muted)' : 'var(--color-3)'
                      }}>
                        {isOngoing ? '진행 중' : isEnded ? '종료됨' : '대기 중'}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.9rem', opacity: 0.8, marginBottom: '1.5rem', flexGrow: 1 }}>
                      {comp.description || '설명이 없습니다.'}
                    </p>
                    <div style={{ fontSize: '0.8rem', borderTop: '1px solid var(--border)', paddingTop: '0.8rem', opacity: 0.9 }}>
                      <div>⏱️ <b>{timeLeftStr}</b></div>
                      <div>👥 참가자: <b>{comp.participant_count}명</b></div>
                    </div>
                  </div>
                );
              })}
              {competitions.length === 0 && (
                <p style={{ opacity: 0.5, textAlign: 'center', gridColumn: '1 / -1', padding: '2rem 0' }}>아직 주최된 경쟁이 없습니다. 첫 경쟁을 주최해보세요!</p>
              )}
            </div>
          </div>
        )}

        {/* Realtime Leaderboard Modal */}
        {activeCompId && compDetail && (
          <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 1000, padding: '1rem', boxSizing: 'border-box'
          }}>
            <div className="problem-card" style={{
              width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto',
              margin: 0, position: 'relative', border: '2px solid var(--color-4)', boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
              background: 'var(--card-bg)'
            }}>
              <button 
                onClick={handleCloseCompDetail}
                style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>

              <h3 style={{ color: 'var(--color-4)', fontSize: '1.8rem', marginBottom: '0.5rem', paddingRight: '2rem' }}>
                {compDetail.competition.title}
              </h3>
              <p style={{ opacity: 0.8, fontSize: '0.95rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                {compDetail.competition.description || '규칙 설명이 없습니다.'}
              </p>

              <div style={{ padding: '0.8rem', background: 'rgba(0,0,0,0.03)', borderRadius: '0.5rem', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                상태: <b>{compDetail.competition.status === 'ongoing' ? '🔴 실시간 진행 중 (10초마다 자동 갱신)' : '🏁 대회 종료됨'}</b><br />
                대회 기간: {new Date(compDetail.competition.start_time).toLocaleString()} ~ {new Date(compDetail.competition.end_time).toLocaleString()} ({compDetail.competition.duration_hours}시간)
              </div>

              <h4 style={{ color: 'var(--color-4)', marginBottom: '1rem' }}>실시간 순위표 (Leaderboard)</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {compDetail.leaderboard.map((player: any, idx: number) => {
                  const rank = idx + 1;
                  const isTop3 = rank <= 3;
                  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}`;
                  const isGainPositive = player.rating_gain > 0;
                  const isGainNegative = player.rating_gain < 0;

                  return (
                    <div 
                      key={player.user_id}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '0.8rem 1rem', background: 'var(--card-bg)', border: '1px solid var(--border)',
                        borderRadius: '0.8rem', boxShadow: isTop3 ? '0 4px 10px rgba(92, 149, 255, 0.15)' : 'none',
                        borderColor: rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? '#cd7f32' : 'var(--border)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: 0 }}>
                        <span style={{ fontSize: isTop3 ? '1.5rem' : '1rem', fontWeight: 900, width: '30px', textAlign: 'center' }}>
                          {medal}
                        </span>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--color-3)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>
                          {player.profile_image_url ? (
                            <img src={player.profile_image_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                          ) : player.username[0].toUpperCase()}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {player.username}
                          </div>
                          <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                            {player.tier} | 현재 {Math.round(player.current_rating).toLocaleString()}점
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ 
                          fontWeight: 900, fontSize: '1.1rem',
                          color: isGainPositive ? '#2ecc71' : isGainNegative ? '#e74c3c' : 'var(--text-main)'
                        }}>
                          {isGainPositive ? `+${Math.round(player.rating_gain).toLocaleString()}` : Math.round(player.rating_gain).toLocaleString()} UP
                        </div>
                        <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                          시작: {Math.round(player.initial_rating).toLocaleString()}점
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button 
                onClick={handleCloseCompDetail}
                className="btn"
                style={{ background: 'var(--color-4)', color: 'white', marginTop: '2rem' }}
              >
                닫기
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
};


const Ranking: React.FC = () => {
  const [ranks, setRanks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    fetch('/api/users/ranking')
      .then(res => res.json())
      .then(data => {
        setRanks(data);
        setLoading(false);
      });
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`);
    const data = await res.json();
    setSearchResults(data);
  };

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

  if (loading) return <div className="container" style={{ padding: '4rem', textAlign: 'center' }}>로딩 중...</div>;

  return (
    <main className="container" style={{ padding: '4rem 0' }}>
      <Helmet>
        <title>랭킹 | Logis - 수학 문제 풀이 플랫폼</title>
        <meta name="description" content="Logis 사용자 랭킹을 확인하고 검색하세요. Bronze부터 Hacker까지 다양한 티어의 유저들을 만나보세요." />
        <meta property="og:title" content="랭킹 | Logis - 수학 문제 풀이 플랫폼" />
        <link rel="canonical" href={`https://llogis.xyz${location.pathname}`} />
      </Helmet>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '2.5rem', marginBottom: '2rem', textAlign: 'center', color: 'var(--color-4)' }}>사용자 랭킹 및 검색</h2>
        
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', marginBottom: '3rem' }}>
          <input 
            type="text" 
            placeholder="사용자 이름 검색..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ flexGrow: 1, padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text-main)', fontSize: '1.1rem' }}
          />
          <button type="submit" className="btn" style={{ width: 'auto', padding: '0 2rem', background: 'var(--color-3)', color: 'white' }}>검색</button>
        </form>

        {searchResults !== null && (
          <div className="problem-card" style={{ marginBottom: '3rem' }}>
            <h3 style={{ marginBottom: '1.5rem' }}>검색 결과 ({searchResults.length})</h3>
            {searchResults.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                {searchResults.map(u => (
                  <div 
                    key={u.id} 
                    onClick={() => navigate(`/users/${u.id}`)}
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: 'rgba(0,0,0,0.05)', borderRadius: '1rem', border: '1px solid var(--border)' }}
                  >
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--color-3)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                      {u.profile_image_url ? <img src={u.profile_image_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : u.username[0].toUpperCase()}
                    </div>
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.username}</div>
                      <div style={{ fontSize: '0.8rem', color: tierColors[u.tier] }}>{u.tier}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p style={{ opacity: 0.5, textAlign: 'center' }}>검색 결과가 없습니다.</p>}
            <button onClick={() => { setSearchResults(null); setSearchQuery(''); }} style={{ background: 'none', border: 'none', color: 'var(--color-4)', cursor: 'pointer', marginTop: '1.5rem', fontWeight: 800 }}>← 전체 랭킹 보기</button>
          </div>
        )}

        {searchResults === null && (
          <div className="problem-card" style={{ margin: 0 }}>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '2rem', textAlign: 'center', color: 'var(--color-4)' }}>Top 50 랭킹</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '1rem' }}>순위</th>
                    <th style={{ padding: '1rem' }}>사용자</th>
                    <th style={{ padding: '1rem' }}>티어</th>
                    <th style={{ padding: '1rem' }}>레이팅</th>
                  </tr>
                </thead>
                <tbody>
                  {ranks.map((u, i) => (
                    <tr 
                      key={i} 
                      onClick={() => navigate(`/users/${u.id || 0}`)}
                      style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s', cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.02)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '1.2rem 1rem', fontWeight: 800 }}>
                        {i + 1 === 1 ? '🥇' : i + 1 === 2 ? '🥈' : i + 1 === 3 ? '🥉' : i + 1}
                      </td>
                      <td style={{ padding: '1.2rem 1rem', fontWeight: 600 }}>{u.username}</td>
                      <td style={{ padding: '1.2rem 1rem' }}>
                        <span style={{ 
                          color: tierColors[u.tier], 
                          fontWeight: 800, 
                          fontSize: '0.9rem',
                          textTransform: 'uppercase' 
                        }}>
                          {u.tier}
                        </span>
                      </td>
                      <td style={{ padding: '1.2rem 1rem', fontWeight: 800 }}>{Math.round(u.rating).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
};

const UserProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    fetch(`/api/users/${id}/profile`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          alert(data.error);
          navigate('/ranking');
          return;
        }
        setProfileData(data);
        setLoading(false);
      })
      .catch(() => {
        alert('사용자 정보를 불러올 수 없습니다.');
        navigate('/ranking');
      });
  }, [id, navigate]);

  if (loading) return <div className="container" style={{ padding: '4rem', textAlign: 'center' }}>로딩 중...</div>;

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
      <Helmet>
        <title>{u.username} 프로필 | Logis - 수학 문제 풀이 플랫폼</title>
        <meta name="description" content={`${u.username}님의 Logis 프로필 - ${u.tier} Rank, ${Math.round(u.rating).toLocaleString()}점, 정답률 ${Math.round(stats.accuracy)}%`} />
        <meta property="og:title" content={`${u.username} | Logis`} />
        <link rel="canonical" href={`https://llogis.xyz${location.pathname}`} />
      </Helmet>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <button onClick={() => navigate('/ranking')} style={{ background: 'none', border: 'none', color: 'var(--color-3)', cursor: 'pointer', marginBottom: '1rem', fontWeight: 800 }}>← 랭킹으로 돌아가기</button>
        
        <article className="problem-card" style={{ textAlign: 'center' }}>
          <div style={{ position: 'relative', width: '120px', height: '120px', margin: '0 auto 2rem' }}>
            {u.profile_image_url ? (
              <img src={u.profile_image_url} alt={`${u.username} 프로필 사진`} loading="lazy" style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', boxShadow: '0 0 20px rgba(0,0,0,0.2)' }} />
            ) : (
              <div role="img" aria-label={`${u.username} 프로필 이미지`} style={{ 
                width: '120px', height: '120px', borderRadius: '50%', 
                background: tierColors[u.tier] || 'var(--color-3)', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                fontSize: '3rem', boxShadow: '0 0 20px rgba(0,0,0,0.2)', color: 'white', fontWeight: 800
              }}>
                {u.username[0].toUpperCase()}
              </div>
            )}
          </div>

          <h2 style={{ fontSize: '2.5rem', marginBottom: '0.5rem', color: 'var(--color-4)' }}>{u.username}</h2>
          {u.equipped_title && (
            <div style={{ marginBottom: '0.5rem', fontWeight: 700, color: 'var(--color-4)', fontSize: '1rem' }}>
              [{u.equipped_title}]
            </div>
          )}
          <div style={{ 
            fontSize: '1.5rem', fontWeight: 800, color: tierColors[u.tier], textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '1.5rem'
          }}>
            {u.tier} Rank
          </div>

          <div style={{ 
            maxWidth: '500px', margin: '0 auto 2.5rem', padding: '1.5rem', 
            background: 'rgba(0,0,0,0.03)', borderRadius: '1rem', fontSize: '1.1rem', 
            lineHeight: 1.6, whiteSpace: 'pre-wrap', fontStyle: u.bio ? 'normal' : 'italic', opacity: u.bio ? 1 : 0.5 
          }}>
            {u.bio || "자기소개가 없습니다."}
          </div>

          <section aria-label="통계" className="profile-stats-grid">
            <div style={{ padding: '1.5rem', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '1rem' }}>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>레이팅</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{Math.round(u.rating).toLocaleString()}</div>
            </div>
            <div style={{ padding: '1.5rem', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '1rem' }}>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>해결 문제</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{stats.correctSubmissions}</div>
            </div>
            <div style={{ padding: '1.5rem', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '1rem' }}>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>정답률</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{Math.round(stats.accuracy)}%</div>
            </div>
          </section>

          <div style={{ textAlign: 'center', opacity: 0.6, fontSize: '0.9rem' }}>
            가입일: {new Date(u.created_at).toLocaleDateString()}
          </div>
        </article>
      </div>
    </main>
  );
};

const Admin: React.FC<{ user: User | null }> = ({ user }) => {
  const [message, setMessage] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [category, setCategory] = useState('');
  const [nimGenerationCount, setNimGenerationCount] = useState(5);
  const [cleaning, setCleaning] = useState(false);
  const [problems, setProblems] = useState<any[]>([]);
  const [problemsPage, setProblemsPage] = useState(1);
  const [problemsTotalPages, setProblemsTotalPages] = useState(1);
  const [loadingProblems, setLoadingProblems] = useState(false);
  const [editingProblem, setEditingProblem] = useState<any>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const fetchUsers = useCallback(() => {
    setLoadingUsers(true);
    const token = localStorage.getItem('token');
    fetch('/api/admin/users', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => {
      if (!res.ok) throw new Error('Unauthorized');
      return res.json();
    })
    .then(data => {
      setUsers(data);
      setLoadingUsers(false);
    })
    .catch(() => {
      navigate('/');
    });
  }, [navigate]);

  useEffect(() => {
    if (!user || user.username !== 'admin') {
      navigate('/');
      return;
    }
    fetchUsers();
  }, [user, navigate, fetchUsers]);

  const handleSeed = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/admin/seed', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    setMessage(data.message || data.error);
    if (res.ok) fetchUsers();
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
    if (res.ok) fetchUsers();
  };

  const fetchProblems = useCallback(async () => {
    setLoadingProblems(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/admin/problems?page=${problemsPage}&limit=50`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.problems) {
        setProblems(data.problems);
        setProblemsTotalPages(data.pagination.totalPages);
      }
    } catch {}
    setLoadingProblems(false);
  }, [problemsPage]);

  const handleDeleteProblem = async (problemId: number) => {
    if (!window.confirm('이 문제를 삭제하시겠습니까? 관련 제출 기록도 함께 삭제됩니다.')) return;
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/admin/problems/${problemId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    setMessage(data.message || data.error);
    if (res.ok) fetchProblems();
  };

  const handleSaveProblem = async () => {
    if (!editingProblem) return;
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/admin/problems/${editingProblem.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        title: editingProblem.title,
        content: editingProblem.content,
        answer: editingProblem.answer,
        current_difficulty: editingProblem.current_difficulty,
      })
    });
    const data = await res.json();
    setMessage(data.message || data.error);
    if (res.ok) {
      setEditingProblem(null);
      fetchProblems();
    }
  };

  const handleGenerateNim = async () => {
    setGenerating(true);
    setMessage('');
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/problems/generate-nim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ count: nimGenerationCount, category: category.trim() || undefined })
      });
      const data = await res.json();
      setMessage(data.message || data.error);
      if (res.ok) fetchUsers();
    } catch {
      setMessage('AI 문제 생성에 실패했습니다.');
    }
    setGenerating(false);
  };

  const handleCleanup = async (tags: string[]) => {
    if (!window.confirm(`"${tags.join(', ')}" 태그가 달린 모든 문제를 삭제하시겠습니까?`)) return;
    setCleaning(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/admin/cleanup-tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ tags })
      });
      const data = await res.json();
      setMessage(data.message || data.error);
      if (res.ok) fetchUsers();
    } catch {
      setMessage('삭제에 실패했습니다.');
    }
    setCleaning(false);
  };

  const handleUpdateRating = async (userId: number, currentRating: number) => {
    const newRatingStr = window.prompt('새로운 레이팅을 입력하세요:', currentRating.toString());
    if (newRatingStr === null) return;
    const newRating = parseFloat(newRatingStr);
    if (isNaN(newRating)) return alert('올바른 숫자를 입력해주세요.');
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/admin/users/${userId}/rating`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ rating: newRating })
    });
    const data = await res.json();
    if (res.ok) {
      alert(data.message);
      fetchUsers();
    } else {
      alert(data.error);
    }
  };

  const handleToggleProblemGeneration = async (userId: number, currentValue: boolean) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/admin/users/${userId}/problem-generation`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ canGenerateProblems: !currentValue })
    });
    const data = await res.json();
    if (res.ok) {
      alert(data.message);
      fetchUsers();
    } else {
      alert(data.error);
    }
  };

  const handleDeleteUser = async (userId: number, username: string) => {
    if (!window.confirm(`정말로 ${username} 계정을 삭제하시겠습니까?`)) return;
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (res.ok) {
      alert(data.message);
      fetchUsers();
    } else {
      alert(data.error);
    }
  };

  return (
    <main className="container" style={{ padding: '4rem 0' }}>
      <Helmet>
        <title>관리자 패널 | Logis</title>
        <meta name="robots" content="noindex, nofollow" />
        <link rel="canonical" href={`https://llogis.xyz${location.pathname}`} />
      </Helmet>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <h2 style={{ color: 'var(--color-4)', marginBottom: '2rem', fontSize: '2.5rem' }}>관리자 패널</h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '3rem' }}>
          <div style={{ padding: '1.5rem', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '1rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>데이터 관리</h3>
            <p style={{ marginBottom: '1.5rem', opacity: 0.8 }}>데이터베이스에 새로운 문제 10개를 생성하여 추가합니다.</p>
            <button onClick={handleSeed} className="btn" style={{ background: 'var(--color-2)', color: 'white' }}>
              문제 10개 추가 생성
            </button>
          </div>
          <div style={{ padding: '1.5rem', background: 'var(--card-bg)', border: '1px solid var(--color-4)', borderRadius: '1rem' }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--color-4)' }}>AI 문제 생성 (NVIDIA NIM)</h3>
            <p style={{ marginBottom: '1rem', opacity: 0.8 }}>NVIDIA NIM API로 AI 문제를 생성합니다. 프로필에서 API 키를 먼저 등록하세요.</p>
            <input
              type="text"
              placeholder="카테고리 (자연어 입력, 예: 중학교 2학년 연립방정식)"
              value={category}
              onChange={e => setCategory(e.target.value)}
              style={{ width: '100%', padding: '0.7rem', borderRadius: '0.5rem', border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text-main)', marginBottom: '1rem', boxSizing: 'border-box' }}
            />
            <input
              type="number"
              min={1}
              max={10}
              value={nimGenerationCount}
              onChange={e => setNimGenerationCount(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
              style={{ width: '100%', padding: '0.7rem', borderRadius: '0.5rem', border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text-main)', marginBottom: '1rem', boxSizing: 'border-box' }}
            />
            <button onClick={handleGenerateNim} disabled={generating} className="btn" style={{ background: 'var(--color-4)', color: 'white', opacity: generating ? 0.6 : 1 }}>
              {generating ? '생성 중...' : `🤖 AI 문제 ${nimGenerationCount}개 생성`}
            </button>
          </div>

          <div style={{ padding: '1.5rem', background: 'rgba(255, 200, 100, 0.1)', border: '1px solid #f0ad4e', borderRadius: '1rem' }}>
            <h3 style={{ marginBottom: '1rem', color: '#f0ad4e' }}>태그별 문제 정리</h3>
            <p style={{ marginBottom: '1.5rem', opacity: 0.8 }}>특정 태그가 달린 문제를 일괄 삭제합니다.</p>
            <button onClick={() => handleCleanup(['확률'])} disabled={cleaning} className="btn" style={{ background: '#f0ad4e', color: 'white', opacity: cleaning ? 0.6 : 1, marginRight: '0.5rem', marginBottom: '0.5rem' }}>
              {cleaning ? '삭제 중...' : '확률 문제 삭제'}
            </button>
            <button onClick={() => handleCleanup(['통계'])} disabled={cleaning} className="btn" style={{ background: '#f0ad4e', color: 'white', opacity: cleaning ? 0.6 : 1 }}>
              통계 문제 삭제
            </button>
          </div>

          <div style={{ padding: '1.5rem', background: 'rgba(255, 118, 117, 0.1)', border: '1px solid #ff7675', borderRadius: '1rem' }}>
            <h3 style={{ marginBottom: '1rem', color: '#ff7675' }}>위험 구역</h3>
            <p style={{ marginBottom: '1.5rem', opacity: 0.8 }}>모든 문제와 사용자의 제출 기록을 삭제하고 초기화합니다.</p>
            <button onClick={handleReset} className="btn" style={{ background: '#ff7675', color: 'white' }}>
              데이터베이스 초기화
            </button>
          </div>
        </div>

        {message && (
          <div style={{ 
            padding: '1rem', background: 'var(--card-bg)', border: '1px solid var(--border)', 
            borderRadius: '0.5rem', color: 'var(--color-3)', fontWeight: 600, textAlign: 'center', marginBottom: '2rem'
          }}>
            {message}
          </div>
        )}

        <div className="problem-card" style={{ margin: 0 }}>
          <h3 style={{ marginBottom: '1.5rem' }}>사용자 관리 ({users.length})</h3>
          {loadingUsers ? <p>사용자 목록 로딩 중...</p> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '1rem' }}>순위</th>
                    <th style={{ padding: '1rem' }}>사용자</th>
                    <th style={{ padding: '1rem' }}>레이팅</th>
                    <th style={{ padding: '1rem' }}>정답수</th>
                    <th style={{ padding: '1rem' }}>문제 생성 권한</th>
                    <th style={{ padding: '1rem' }}>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, i) => (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '1rem', fontWeight: 800 }}>{i + 1}</td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ fontWeight: 800 }}>{u.username}</div>
                        <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>{u.email}</div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ fontWeight: 800 }}>{Math.round(u.rating).toLocaleString()}</div>
                        <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>{u.tier}</div>
                      </td>
                      <td style={{ padding: '1rem' }}>{u.correct_submissions} / {u.total_submissions}</td>
                      <td style={{ padding: '1rem' }}>
                        <button
                          onClick={() => handleToggleProblemGeneration(u.id, !!u.can_generate_problems)}
                          className="btn"
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', width: 'auto', background: u.can_generate_problems ? '#00b894' : 'var(--border)', color: u.can_generate_problems ? 'white' : 'var(--text-main)' }}
                        >
                          {u.can_generate_problems ? '허용 중' : '권한 부여'}
                        </button>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button 
                            onClick={() => handleUpdateRating(u.id, u.rating)}
                            className="btn" 
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', width: 'auto', background: 'var(--color-3)', color: 'white' }}
                          >
                            수정
                          </button>
                          {u.username !== 'admin' && (
                            <button 
                              onClick={() => handleDeleteUser(u.id, u.username)}
                              className="btn" 
                              style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', width: 'auto', background: '#ff7675', color: 'white' }}
                            >
                              삭제
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Problem Management */}
        <div className="problem-card" style={{ margin: 0, marginTop: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0 }}>문제 관리 ({problems.length})</h3>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button onClick={() => { setProblemsPage(p => Math.max(1, p - 1)); fetchProblems(); }} disabled={problemsPage <= 1} className="btn" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', width: 'auto', background: 'var(--color-3)', color: 'white', opacity: problemsPage <= 1 ? 0.5 : 1 }}>←</button>
              <span style={{ fontSize: '0.85rem' }}>{problemsPage} / {problemsTotalPages}</span>
              <button onClick={() => { setProblemsPage(p => Math.min(problemsTotalPages, p + 1)); fetchProblems(); }} disabled={problemsPage >= problemsTotalPages} className="btn" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', width: 'auto', background: 'var(--color-3)', color: 'white', opacity: problemsPage >= problemsTotalPages ? 0.5 : 1 }}>→</button>
              <button onClick={() => fetchProblems()} className="btn" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', width: 'auto', background: 'var(--color-2)', color: 'white' }}>새로고침</button>
            </div>
          </div>

          {loadingProblems ? <p>로딩 중...</p> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.6rem' }}>ID</th>
                    <th style={{ padding: '0.6rem' }}>제목</th>
                    <th style={{ padding: '0.6rem' }}>정답</th>
                    <th style={{ padding: '0.6rem' }}>난이도</th>
                    <th style={{ padding: '0.6rem' }}>태그</th>
                    <th style={{ padding: '0.6rem' }}>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {problems.map((p: any) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.6rem', fontWeight: 800 }}>{p.id}</td>
                      <td style={{ padding: '0.6rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</td>
                      <td style={{ padding: '0.6rem', fontWeight: 600, color: 'var(--color-3)' }}>{p.answer}</td>
                      <td style={{ padding: '0.6rem' }}>{Math.round(p.current_difficulty).toLocaleString()}</td>
                      <td style={{ padding: '0.6rem' }}>
                        {Array.isArray(p.tags) && p.tags.map((t: string) => (
                          <span key={t} style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', borderRadius: '0.5rem', background: 'var(--color-3)', color: 'white', marginRight: '0.3rem', fontWeight: 600 }}>{t}</span>
                        ))}
                      </td>
                      <td style={{ padding: '0.6rem' }}>
                        <div style={{ display: 'flex', gap: '0.3rem' }}>
                          <button onClick={() => setEditingProblem({ ...p, _origContent: p.content })} className="btn" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', width: 'auto', background: 'var(--color-2)', color: 'white' }}>수정</button>
                          <button onClick={() => handleDeleteProblem(p.id)} className="btn" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', width: 'auto', background: '#ff7675', color: 'white' }}>삭제</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Edit Problem Modal */}
        {editingProblem && (
          <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 1000, padding: '1rem', boxSizing: 'border-box'
          }}>
            <div className="problem-card" style={{ width: '100%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto', margin: 0, position: 'relative' }}>
              <button onClick={() => setEditingProblem(null)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
              <h3 style={{ color: 'var(--color-4)', marginBottom: '1.5rem' }}>문제 수정 (ID: {editingProblem.id})</h3>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', opacity: 0.7 }}>제목</label>
                <input type="text" value={editingProblem.title} onChange={e => setEditingProblem({ ...editingProblem, title: e.target.value })} style={{ width: '100%', padding: '0.7rem', borderRadius: '0.5rem', border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text-main)', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', opacity: 0.7 }}>내용 (LaTeX)</label>
                <textarea value={editingProblem.content} onChange={e => setEditingProblem({ ...editingProblem, content: e.target.value })} rows={5} style={{ width: '100%', padding: '0.7rem', borderRadius: '0.5rem', border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text-main)', boxSizing: 'border-box', resize: 'vertical' }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', opacity: 0.7 }}>정답</label>
                <input type="text" value={editingProblem.answer} onChange={e => setEditingProblem({ ...editingProblem, answer: e.target.value })} style={{ width: '100%', padding: '0.7rem', borderRadius: '0.5rem', border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text-main)', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', opacity: 0.7 }}>난이도</label>
                <input type="number" value={editingProblem.current_difficulty} onChange={e => setEditingProblem({ ...editingProblem, current_difficulty: parseFloat(e.target.value) || 0 })} style={{ width: '100%', padding: '0.7rem', borderRadius: '0.5rem', border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text-main)', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={handleSaveProblem} className="btn" style={{ background: 'var(--color-4)', color: 'white' }}>저장</button>
                <button onClick={() => setEditingProblem(null)} className="btn" style={{ background: 'var(--border)', color: 'var(--text-main)' }}>취소</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
};

const TitleSection: React.FC<{ user: User | null; setUser: (u: User) => void; refreshKey?: number }> = ({ user, setUser, refreshKey }) => {
  const [titles, setTitles] = useState<any[]>([]);
  const [equippedTitle, setEquippedTitle] = useState('');
  const [equippedTitleName, setEquippedTitleName] = useState('');
  const [loadingTitles, setLoadingTitles] = useState(true);
  const token = localStorage.getItem('token');

  const fetchTitles = useCallback(() => {
    setLoadingTitles(true);
    fetch('/api/titles', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.titles) {
          setTitles(data.titles);
          setEquippedTitle(data.equippedTitle || '');
          const found = data.titles.find((t: any) => t.title_id === data.equippedTitle);
          setEquippedTitleName(found ? found.name : '');
        }
        setLoadingTitles(false);
      })
      .catch(() => setLoadingTitles(false));
  }, [token]);

  useEffect(() => { fetchTitles(); }, [fetchTitles, refreshKey]);

  const handleEquip = async (titleId: string) => {
    const res = await fetch('/api/titles/equip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ titleId })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setEquippedTitle(data.equippedTitle);
      setEquippedTitleName(data.equippedTitleName || '');
      const updatedUser = { ...user!, equipped_title: data.equippedTitleName || data.equippedTitle };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      fetchTitles();
    } else {
      alert(data.error || '칭호 장착에 실패했습니다.');
    }
  };

  if (loadingTitles) return null;

  return (
    <div className="problem-card" style={{ marginBottom: '1.5rem' }}>
      <h3 style={{ margin: '0 0 1.2rem', color: 'var(--text-main)', fontSize: '1.05rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        🏆 내 칭호
      </h3>
      {equippedTitle && (
        <div style={{ marginBottom: '1rem', padding: '0.6rem 1rem', background: 'rgba(92, 149, 255, 0.1)', borderRadius: '0.5rem', border: '1px solid var(--color-4)', textAlign: 'center' }}>
          <span style={{ fontWeight: 800, color: 'var(--color-4)' }}>장착 중: </span>
          <span style={{ fontWeight: 800 }}>{titles.find((t: any) => t.title_id === equippedTitle)?.name || equippedTitle}</span>
          <button onClick={() => handleEquip('none')} style={{ marginLeft: '0.5rem', background: 'none', border: 'none', color: '#ff7675', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline' }}>해제</button>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}>
        {titles.map((t: any) => {
          const isEquipped = equippedTitle === t.title_id;
          return (
            <div
              key={t.title_id}
              onClick={() => t.unlocked && !isEquipped && handleEquip(t.title_id)}
              style={{
                padding: '0.8rem', borderRadius: '0.75rem', textAlign: 'center', cursor: t.unlocked && !isEquipped ? 'pointer' : 'default',
                border: isEquipped ? '2px solid var(--color-4)' : t.unlocked ? '1px solid var(--color-3)' : '1px solid var(--border)',
                background: isEquipped ? 'rgba(92, 149, 255, 0.1)' : t.unlocked ? 'rgba(92, 149, 255, 0.04)' : 'transparent',
                opacity: t.unlocked ? 1 : 0.4, transition: 'all 0.2s'
              }}
              title={t.description}
            >
              <div style={{ fontSize: '1.2rem', fontWeight: 900, color: t.unlocked ? 'var(--color-4)' : 'var(--text-muted)', marginBottom: '0.25rem' }}>
                {t.name}
              </div>
              <div style={{ fontSize: '0.7rem', opacity: 0.7, color: 'var(--text-muted)' }}>
                {t.unlocked ? (isEquipped ? '장착 중' : '클릭하여 장착') : '🔒 잠김'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Profile: React.FC<{ user: User | null; setUser: (u: User) => void }> = ({ user, setUser }) => {
  const [profileData, setProfileData] = useState<any>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newProfileImageFile, setNewProfileImageFile] = useState<File | null>(null);
  const [isUpdatingImage, setIsUpdatingImage] = useState(false);
  
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editedUsername, setEditedUsername] = useState('');
  const [editedBio, setEditedBio] = useState('');

  // NVIDIA NIM API key state
  const [nimApiKey, setNimApiKey] = useState('');
  const [isEditingNimKey, setIsEditingNimKey] = useState(false);
  const [hasNimKey, setHasNimKey] = useState(false);
  const [titleRefreshKey, setTitleRefreshKey] = useState(0);

  const navigate = useNavigate();
  const location = useLocation();

  const fetchProfile = useCallback(() => {
    if (!user) return;
    const token = localStorage.getItem('token');
    fetch('/api/users/profile', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      if (data.error) return;
      setProfileData(data);
      setEditedUsername(data.user.username);
      setEditedBio(data.user.bio || '');
      if (data.user) {
        setUser({ ...user!, ...data.user });
      }
    })
    .catch(() => {});

    fetch('/api/users/nim-key/status', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      if (data.hasKey !== undefined) setHasNimKey(data.hasKey);
    })
    .catch(() => {});

    fetch('/api/titles/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({})
    }).then(r => r.json()).then(data => {
      if (data.newlyUnlocked && data.newlyUnlocked.length > 0) {
        setTitleRefreshKey(k => k + 1);
        setTimeout(() => alert(`🎉 새 칭호 획득: ${data.newlyUnlocked.map((t: any) => t.name).join(', ')}`), 1000);
      }
    }).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchProfile();
  }, [user, navigate, fetchProfile]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    const res = await fetch('/api/users/profile', {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ username: editedUsername, bio: editedBio })
    });
    const data = await res.json();
    if (res.ok) {
      alert('프로필이 업데이트되었습니다.');
      setIsEditingProfile(false);
      const updatedUser = { ...user!, username: editedUsername, bio: editedBio };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      fetchProfile();
    } else {
      alert(data.error);
    }
  };

  const handleSaveNimKey = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    const res = await fetch('/api/users/nim-key', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ nimApiKey })
    });
    const data = await res.json();
    if (res.ok) {
      alert('NVIDIA NIM API 키가 저장되었습니다.');
      setHasNimKey(true);
      setIsEditingNimKey(false);
    } else {
      alert(data.error);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    const res = await fetch('/api/users/change-password', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ currentPassword, newPassword })
    });
    const data = await res.json();
    if (res.ok) {
      alert('비밀번호가 성공적으로 변경되었습니다.');
      setCurrentPassword('');
      setNewPassword('');
      setIsChangingPassword(false);
    } else {
      alert(data.error);
    }
  };

  const handleUpdateProfileImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProfileImageFile) return;

    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('profileImage', newProfileImageFile);

    const res = await fetch('/api/users/profile-image', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      alert('프로필 사진이 변경되었습니다.');
      setIsUpdatingImage(false);
      setNewProfileImageFile(null);
      const updatedUser = { ...user!, profile_image_url: data.profileImageUrl };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      fetchProfile();
    } else {
      alert(data.error || '이미지 변경에 실패했습니다.');
    }
  };

  if (!profileData) return <div className="container" style={{ padding: '4rem', textAlign: 'center' }}>로딩 중...</div>;

  const { user: u, stats } = profileData;

  const tierColors: { [key: string]: string } = {
    'Bronze': '#cd7f32', 'Silver': '#a8b8c8', 'Gold': '#ffd700',
    'Platinum': '#8eb4cf', 'Diamond': '#5bcefa', 'Ruby': '#e0115f',
    'Master': '#9b59b6', 'God': '#ff6b35', 'Hacker': '#00e676'
  };
  const streak = u.streak || 0;
  const streakGridSize = Math.min(140, Math.max(28, Math.ceil(Math.max(streak, 1) / 7) * 7));
  const streakDots = Array.from({ length: streakGridSize }, (_, index) => index >= streakGridSize - Math.min(streak, streakGridSize));

  return (
    <main className="container" style={{ padding: '3rem 0 5rem', maxWidth: '860px', margin: '0 auto' }}>
      <Helmet>
        <title>내 프로필 | Logis - 수학 문제 풀이 플랫폼</title>
        <meta name="robots" content="noindex, nofollow" />
        <link rel="canonical" href={`https://llogis.xyz${location.pathname}`} />
      </Helmet>

      {/* ─── 프로필 헤더 카드 ─── */}
      <div className="problem-card" style={{ textAlign: 'center', marginBottom: '1.5rem', position: 'relative', overflow: 'hidden' }}>
        {/* 배경 그라데이션 accent */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '6px',
          background: `linear-gradient(90deg, ${tierColors[u.tier] || 'var(--color-4)'}, var(--color-4))`
        }} />

        {/* 아바타 */}
        <div style={{ position: 'relative', width: '100px', height: '100px', margin: '1rem auto 1.5rem' }}>
          {u.profile_image_url ? (
            <img src={u.profile_image_url} alt="프로필" style={{ width: '100px', height: '100px', borderRadius: '1.5rem', objectFit: 'cover', boxShadow: '0 6px 20px rgba(0,0,0,0.18)' }} />
          ) : (
            <div style={{
              width: '100px', height: '100px', borderRadius: '1.5rem',
              background: `linear-gradient(135deg, ${tierColors[u.tier] || 'var(--color-3)'}, var(--color-4))`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '2.5rem', color: 'white', fontWeight: 900,
              boxShadow: '0 6px 20px rgba(0,0,0,0.2)'
            }}>
              {u.username[0].toUpperCase()}
            </div>
          )}
          <button
            onClick={() => setIsUpdatingImage(!isUpdatingImage)}
            style={{ position: 'absolute', bottom: -4, right: -4, background: 'var(--color-4)', border: '2px solid var(--card-bg)', borderRadius: '0.6rem', width: '30px', height: '30px', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}
            title="프로필 사진 변경"
          >
            📷
          </button>
        </div>

        {isUpdatingImage && (
          <form onSubmit={handleUpdateProfileImage} style={{ marginBottom: '1.5rem', maxWidth: '380px', margin: '0 auto 1.5rem' }}>
            <input
              type="file" accept="image/jpeg,image/png,image/gif"
              onChange={e => setNewProfileImageFile(e.target.files?.[0] ?? null)}
              style={{ width: '100%', padding: '0.7rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text-main)', marginBottom: '0.5rem', boxSizing: 'border-box' }}
              required
            />
            <button type="submit" className="btn" style={{ background: 'var(--color-4)', color: 'white', padding: '0.6rem', fontSize: '0.9rem' }}>변경 적용</button>
          </form>
        )}

        {isEditingProfile ? (
          <form onSubmit={handleUpdateProfile} style={{ maxWidth: '480px', margin: '0 auto 1.5rem' }}>
            <div style={{ marginBottom: '1rem', textAlign: 'left' }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>사용자 이름</label>
              <input type="text" value={editedUsername} onChange={e => setEditedUsername(e.target.value)}
                style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--border)', background: 'var(--bg-color)', color: 'var(--text-main)', boxSizing: 'border-box', fontSize: '1rem' }} required />
            </div>
            <div style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>자기소개</label>
              <textarea value={editedBio} onChange={e => setEditedBio(e.target.value)}
                placeholder="자신을 소개해주세요..."
                style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--border)', background: 'var(--bg-color)', color: 'var(--text-main)', minHeight: '90px', resize: 'vertical', boxSizing: 'border-box', fontSize: '1rem' }} />
            </div>
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button type="submit" className="btn" style={{ background: 'var(--color-4)', color: 'white' }}>저장</button>
              <button type="button" onClick={() => setIsEditingProfile(false)} className="btn" style={{ background: 'var(--border)', color: 'var(--text-main)' }}>취소</button>
            </div>
          </form>
        ) : (
          <>
            <h2 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '0.3rem', color: 'var(--text-main)' }}>{u.username}</h2>
            {u.equipped_title && (
              <div style={{ marginBottom: '0.3rem', fontWeight: 700, color: 'var(--color-4)', fontSize: '0.95rem' }}>
                [{u.equipped_title}]
              </div>
            )}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.9rem', borderRadius: '99px', background: `${tierColors[u.tier] || '#888'}22`, border: `1.5px solid ${tierColors[u.tier] || '#888'}`, color: tierColors[u.tier] || '#888', fontWeight: 800, fontSize: '0.9rem', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              🏅 {u.tier}
            </div>
            {u.can_generate_problems && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.75rem', borderRadius: '999px', background: 'rgba(122, 209, 81, 0.16)', border: '1px solid rgba(122, 209, 81, 0.4)', color: '#5fae35', fontWeight: 800, fontSize: '0.82rem', marginBottom: '1rem' }}>
                문제 생성 권한 보유
              </div>
            )}
            {u.bio && (
              <p style={{ maxWidth: '480px', margin: '0 auto 1rem', fontSize: '0.95rem', lineHeight: 1.65, color: 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>{u.bio}</p>
            )}
            <div>
              <button
                onClick={() => setIsEditingProfile(true)}
                className="btn"
                style={{ width: 'auto', padding: '0.5rem 1.6rem', background: 'transparent', border: '1.5px solid var(--color-4)', color: 'var(--color-4)', fontSize: '0.9rem' }}
              >
                ✏️ 프로필 수정
              </button>
            </div>
          </>
        )}
      </div>

      {/* ─── 스탯 카드 그리드 ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>

        <div className="stat-card">
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, var(--color-4), #7b5ff5)' }} />
          <span className="stat-card-icon">✨</span>
          <div className="stat-card-label">레이팅</div>
          <div className="stat-card-value" style={{ color: 'var(--color-4)' }}>{Math.round(u.rating).toLocaleString()}</div>
          <div className="stat-card-sub">{u.tier} 등급</div>
        </div>

        <div className="stat-card">
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #f87575, #ffa9a3)' }} />
          <span className="stat-card-icon">🔥</span>
          <div className="stat-card-label">연속 스트릭</div>
          <div className="stat-card-value" style={{ color: '#f87575' }}>{u.streak || 0}일</div>
          <div className="stat-card-sub">{u.streak_repaired ? '🩹 토큰으로 수리됨' : '스트릭 유지 중'}</div>
        </div>

        <div className="stat-card">
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #ffd700, #ffb347)' }} />
          <span className="stat-card-icon">🪙</span>
          <div className="stat-card-label">보유 토큰</div>
          <div className="stat-card-value" style={{ color: '#e6a800' }}>{u.tokens || 0}</div>
          <div className="stat-card-sub">수리 1회에 15토큰</div>
        </div>

        <div className="stat-card">
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #00e676, #00bcd4)' }} />
          <span className="stat-card-icon">⚡</span>
          <div className="stat-card-label">총 XP</div>
          <div className="stat-card-value" style={{ color: '#00b360', fontSize: '1.6rem' }}>{(u.xp || 0).toLocaleString()}</div>
          <div className="stat-card-sub">퀘스트 완료 시 획득</div>
        </div>

        <div className="stat-card">
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, var(--color-3), var(--color-4))' }} />
          <span className="stat-card-icon">✅</span>
          <div className="stat-card-label">정답 문제</div>
          <div className="stat-card-value">{stats.correctSubmissions}</div>
          <div className="stat-card-sub">정답률 {Math.round(stats.accuracy)}%</div>
        </div>
      </div>

      <div className="problem-card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ margin: '0 0 0.75rem', color: '#5fae35', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.05rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          스트릭 달력
        </h3>
        <p style={{ margin: '0 0 1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          연속 {streak}일을 연두/초록 점으로 표시합니다.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '0.45rem' }}>
          {streakDots.map((active, index) => (
            <div
              key={index}
              title={`${index + 1}일차`}
              style={{
                aspectRatio: '1 / 1',
                borderRadius: '999px',
                border: active ? '1px solid rgba(95, 174, 53, 0.45)' : '1px solid var(--border)',
                background: active ? 'linear-gradient(135deg, #dff7a6, #7ad151)' : 'transparent',
                boxShadow: active ? '0 0 10px rgba(122, 209, 81, 0.28)' : 'none',
                opacity: active ? 1 : 0.45
              }}
            />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          <span>시작</span>
          <span>오늘</span>
        </div>
      </div>

      {/* ─── 일일 퀘스트 ─── */}
      <div className="problem-card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ margin: '0 0 1.2rem', color: 'var(--color-4)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          📅 오늘의 퀘스트
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {Array.isArray(u.quests) && u.quests.length > 0 ? (
            u.quests.map((quest: any) => {
              const pct = Math.min(100, Math.round((quest.current / quest.target) * 100)) || 0;
              return (
                <div key={quest.id} className={`quest-card${quest.completed ? ' completed' : ''}`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.95rem', textDecoration: quest.completed ? 'line-through' : 'none', color: quest.completed ? 'var(--text-muted)' : 'var(--text-main)' }}>
                      {quest.completed ? '✅' : '🎯'} {quest.title}
                    </span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                      {quest.current} / {quest.target}{quest.type === 'accuracy' ? '%' : ''}
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${pct}%`, background: quest.completed ? 'var(--color-4)' : 'var(--color-1)' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.8rem', fontSize: '0.78rem', opacity: 0.75 }}>
                    <span>✨ +{quest.xpReward} XP</span>
                    {quest.tokenReward > 0 && <span>🪙 +{quest.tokenReward} 토큰</span>}
                  </div>
                </div>
              );
            })
          ) : (
            <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', margin: 0, fontSize: '0.95rem' }}>
              오늘의 퀘스트가 아직 생성되지 않았습니다. 문제를 풀면 퀘스트가 자동으로 시작됩니다!
            </p>
          )}
        </div>
      </div>

      {/* ─── 계정 설정 ─── */}
      <div className="problem-card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ margin: '0 0 1.2rem', color: 'var(--text-main)', fontSize: '1.05rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          🔐 계정 설정
        </h3>

        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          가입일: {new Date(u.created_at).toLocaleDateString()}
        </div>

        <button
          onClick={() => setIsChangingPassword(!isChangingPassword)}
          style={{ background: 'none', border: 'none', color: 'var(--color-4)', cursor: 'pointer', fontWeight: 800, fontSize: '0.95rem', padding: 0, textDecoration: 'underline' }}
        >
          {isChangingPassword ? '취소' : '비밀번호 변경'}
        </button>

        {isChangingPassword && (
          <form onSubmit={handleChangePassword} style={{ marginTop: '1.2rem', maxWidth: '380px' }}>
            <input type="password" placeholder="현재 비밀번호" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
              style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--border)', background: 'var(--bg-color)', color: 'var(--text-main)', marginBottom: '0.6rem', boxSizing: 'border-box' }} required />
            <input type="password" placeholder="새 비밀번호" value={newPassword} onChange={e => setNewPassword(e.target.value)}
              style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--border)', background: 'var(--bg-color)', color: 'var(--text-main)', marginBottom: '0.8rem', boxSizing: 'border-box' }} required />
            <button type="submit" className="btn" style={{ background: 'var(--color-4)', color: 'white', padding: '0.7rem' }}>변경 확인</button>
          </form>
        )}
      </div>

      <TitleSection user={user} setUser={setUser} refreshKey={titleRefreshKey} />

      {/* ─── NVIDIA NIM API 키 ─── */}
      <div className="problem-card">
        <h3 style={{ margin: '0 0 0.5rem', color: 'var(--text-main)', fontSize: '1.05rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          🤖 NVIDIA NIM API 키
        </h3>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', margin: '0 0 1rem' }}>
          {hasNimKey ? '✅ API 키가 등록되어 있습니다. AI 문제 생성 기능을 사용할 수 있습니다.' : 'AI 문제 생성 기능을 사용하려면 NVIDIA NIM API 키를 등록하세요.'}
        </p>
        <button
          onClick={() => setIsEditingNimKey(!isEditingNimKey)}
          className="btn"
          style={{ background: 'var(--card-bg)', border: '1.5px solid var(--color-3)', color: 'var(--color-4)', width: 'auto', padding: '0.55rem 1.4rem', fontSize: '0.9rem' }}
        >
          {isEditingNimKey ? '취소' : hasNimKey ? 'API 키 변경' : 'API 키 등록'}
        </button>
        {isEditingNimKey && (
          <form onSubmit={handleSaveNimKey} style={{ marginTop: '1.2rem', maxWidth: '480px' }}>
            <input
              type="password" placeholder="NVIDIA NIM API 키 (nvapi-...)"
              value={nimApiKey} onChange={e => setNimApiKey(e.target.value)}
              style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--border)', background: 'var(--bg-color)', color: 'var(--text-main)', marginBottom: '0.8rem', boxSizing: 'border-box' }}
              required
            />
            <button type="submit" className="btn" style={{ background: 'var(--color-4)', color: 'white', padding: '0.7rem' }}>저장</button>
          </form>
        )}
      </div>
    </main>
  );
};

const ProblemList: React.FC<{ user: User | null; setUser: (u: User) => void }> = ({ user, setUser }) => {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [selectedProblemId, setSelectedProblemId] = useState<number | null>(null);
  const [answers, setAnswers] = useState<{[key: number]: string}>({});
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generationCount, setGenerationCount] = useState(5);
  const navigate = useNavigate();
  const location = useLocation();

  // Fetch all available tags
  useEffect(() => {
    fetch('/api/problems/tags')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setAllTags(data);
        }
      });
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const headers: any = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    fetch('/api/problems', { headers })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setProblems(data);
          if (data.length > 0) setSelectedProblemId(data[0].id);
        }
      });
  }, []);

  const handleInputChange = (id: number, val: string) => {
    setAnswers(prev => ({ ...prev, [id]: val }));
  };

  const handleSubmit = (problemId: number) => {
    if (!user) return navigate('/login');

    const userAnswer = answers[problemId];
    if (!userAnswer || userAnswer.trim() === '') return alert('정답을 입력해주세요!');

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
        alert('정답입니다! 🎉');
        const remainingProblems = problems.filter(p => p.id !== problemId);
        setProblems(remainingProblems);
        if (remainingProblems.length > 0) setSelectedProblemId(remainingProblems[0].id);
        else setSelectedProblemId(null);
      } else {
        alert('틀렸습니다. 🧐');
      }
      
      const updatedUser = { 
        ...user, 
        rating: data.newUserRating,
        tier: data.tier
      };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      setAnswers(prev => ({ ...prev, [problemId]: '' }));
    });
  };

  const handleGenerate = () => {
    setShowGenerateModal(true);
  };

  const confirmGenerate = () => {
    const token = localStorage.getItem('token');
    fetch('/api/problems/generate', { 
      method: 'POST', 
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ tags: selectedTags, count: generationCount })
    })
    .then(res => res.json())
    .then(data => {
      setProblems(data.problems);
      if (data.problems.length > 0) setSelectedProblemId(data.problems[0].id);
      setShowGenerateModal(false);
    });
  };

  const selectedProblem = problems.find(p => p.id === selectedProblemId);

  return (
    <main className="container problem-layout">
      <Helmet>
        <title>문제 풀기 | Logis - 수학 문제 풀이 플랫폼</title>
        <meta name="description" content="Logis에서 다양한 수학 문제를 풀고 레이팅을 올리세요. 선형방정식, 연립방정식, 부등식, 함수 등 다양한 문제를 도전하세요." />
        <meta property="og:title" content="문제 풀기 | Logis - 수학 문제 풀이 플랫폼" />
        <link rel="canonical" href={`https://llogis.xyz${location.pathname}`} />
      </Helmet>
      <nav className="problem-sidebar" aria-label="문제 목록" style={{ width: '300px', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ color: 'var(--color-4)', margin: 0 }}>문제 목록 ({problems.length})</h3>
          {(user?.username === 'admin' || user?.can_generate_problems) && (
            <button onClick={handleGenerate} className="btn" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', width: 'auto', background: 'var(--color-2)', color: 'white' }}>
              생성하기
            </button>
          )}
        </div>
        
        <div role="listbox" aria-label="문제 선택" style={{ maxHeight: '60vh', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '1rem', background: 'var(--card-bg)' }}>
          {problems.map(p => (
            <div 
              key={p.id} 
              onClick={() => setSelectedProblemId(p.id)}
              style={{ 
                padding: '1rem', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                background: selectedProblemId === p.id ? 'var(--color-3)' : 'transparent',
                color: selectedProblemId === p.id ? 'var(--color-4)' : 'inherit',
                fontWeight: selectedProblemId === p.id ? 800 : 400
              }}
            >
              {p.title}
            </div>
          ))}
          {problems.length === 0 && (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>모든 문제를 풀었습니다!</p>
            </div>
          )}
        </div>
      </nav>

      <section aria-label="선택된 문제" style={{ flexGrow: 1 }}>
        {selectedProblem ? (
          <div className="problem-card" style={{ margin: 0 }}>
            <h3 style={{ marginBottom: '1.5rem', color: 'var(--color-4)' }}>{selectedProblem.title}</h3>
            <div className="math-content" style={{ fontSize: '1.8rem' }}>{renderMath(selectedProblem.content)}</div>
            <div style={{ marginTop: '2rem' }}>
              <input type="text" placeholder="정답" className="answer-input" value={answers[selectedProblem.id] || ''} onChange={(e) => handleInputChange(selectedProblem.id, e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSubmit(selectedProblem.id)} />
              <button onClick={() => handleSubmit(selectedProblem.id)} className="btn btn-solve">제출</button>
            </div>
          </div>
        ) : <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>문제를 선택해주세요.</div>}
      </section>

      {/* 생성 모달 */}
      {showGenerateModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 1000, padding: '1rem', boxSizing: 'border-box'
        }}>
          <div className="problem-card" style={{
            width: '100%', maxWidth: '450px', margin: 0, position: 'relative',
            background: 'var(--card-bg)'
          }}>
            <h3 style={{ marginBottom: '1.5rem', color: 'var(--color-4)' }}>문제 생성</h3>
            <p style={{ marginBottom: '1rem', opacity: 0.8, fontSize: '0.9rem' }}>생성할 문제 유형을 선택하세요. (선택하지 않으면 전체 유형)</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '1.5rem' }}>
              {allTags.map(tag => (
                <label key={tag} style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.5rem 0.8rem', borderRadius: '0.5rem',
                  background: selectedTags.includes(tag) ? 'var(--color-3)' : 'var(--card-bg)',
                  border: '1px solid var(--border)', cursor: 'pointer', fontSize: '0.85rem'
                }}>
                  <input
                    type="checkbox"
                    checked={selectedTags.includes(tag)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedTags([...selectedTags, tag]);
                      } else {
                        setSelectedTags(selectedTags.filter(t => t !== tag));
                      }
                    }}
                    style={{ accentColor: 'var(--color-4)' }}
                  />
                  <span>{tag}</span>
                </label>
              ))}
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', opacity: 0.75 }}>생성할 문제 수</label>
              <input
                type="number"
                min={1}
                max={50}
                value={generationCount}
                onChange={e => setGenerationCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                style={{ width: '100%', padding: '0.7rem', borderRadius: '0.5rem', border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text-main)', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowGenerateModal(false); setSelectedTags([]); setGenerationCount(5); }}
                className="btn" style={{ background: 'var(--text-muted)', color: 'white', width: 'auto' }}
              >
                취소
              </button>
              <button onClick={confirmGenerate} className="btn" style={{ background: 'var(--color-2)', color: 'white', width: 'auto' }}>
                {generationCount}개 생성
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

const Login: React.FC<{ onLogin: (token: string, user: User) => void }> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

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
    } else alert(data.error);
  };

  return (
    <main className="container">
      <Helmet>
        <title>로그인 | Logis - 수학 문제 풀이 플랫폼</title>
        <meta name="description" content="Logis에 로그인하여 수학 문제를 풀고 레이팅을 올려보세요." />
        <meta name="robots" content="noindex, nofollow" />
        <link rel="canonical" href={`https://llogis.xyz${location.pathname}`} />
      </Helmet>
      <section aria-label="로그인" className="auth-form">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img src="/logo.png" alt="Logis 로고" loading="lazy" style={{ width: '80px', height: '80px', borderRadius: '1.5rem', boxShadow: 'var(--card-shadow)' }} />
        </div>
        <h2 style={{ color: 'var(--color-4)' }}>로그인</h2>
        <form onSubmit={handleSubmit}>
          <input type="text" placeholder="아이디/이메일" value={email} onChange={e => setEmail(e.target.value)} required aria-label="아이디 또는 이메일" />
          <input type="password" placeholder="비밀번호" value={password} onChange={e => setPassword(e.target.value)} required aria-label="비밀번호" />
          <button type="submit" aria-label="로그인 제출">로그인</button>
        </form>
      </section>
    </main>
  );
};

const Signup: React.FC = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });
    if (res.ok) {
      alert('가입 환영!');
      navigate('/login');
    } else {
      const data = await res.json();
      alert(data.error);
    }
  };

  return (
    <main className="container">
      <Helmet>
        <title>회원가입 | Logis - 수학 문제 풀이 플랫폼</title>
        <meta name="description" content="Logis에 가입하여 수학 문제 풀이를 시작하고 레이팅을 올려보세요." />
        <meta name="robots" content="noindex, nofollow" />
        <link rel="canonical" href={`https://llogis.xyz${location.pathname}`} />
      </Helmet>
      <section aria-label="회원가입" className="auth-form">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img src="/logo.png" alt="Logis 로고" loading="lazy" style={{ width: '80px', height: '80px', borderRadius: '1.5rem', boxShadow: 'var(--card-shadow)' }} />
        </div>
        <h2 style={{ color: 'var(--color-4)' }}>가입하기</h2>
        <form onSubmit={handleSubmit}>
          <input type="text" placeholder="이름" value={username} onChange={e => setUsername(e.target.value)} required aria-label="사용자 이름" />
          <input type="email" placeholder="이메일" value={email} onChange={e => setEmail(e.target.value)} required aria-label="이메일 주소" />
          <input type="password" placeholder="비밀번호" value={password} onChange={e => setPassword(e.target.value)} required aria-label="비밀번호" />
          <button type="submit" aria-label="회원가입 제출">가입</button>
        </form>
      </section>
    </main>
  );
};

const AppContent: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [themeToggleCount, setThemeToggleCount] = useState(() => Number(localStorage.getItem('theme-toggle-count') || '0'));
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) setUser(JSON.parse(savedUser));
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    const nextCount = themeToggleCount + 1;

    setTheme(newTheme);
    setThemeToggleCount(nextCount >= 20 ? 0 : nextCount);
    localStorage.setItem('theme', newTheme);
    localStorage.setItem('theme-toggle-count', String(nextCount >= 20 ? 0 : nextCount));

    if (nextCount >= 20) {
      const token = localStorage.getItem('token');
      if (token) {
        fetch('/api/titles/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ action: 'dark_mode', value: 20 })
        }).then(r => r.json()).then(data => {
          if (data.newlyUnlocked && data.newlyUnlocked.length > 0) {
            alert(`🎉 새 칭호 획득: ${data.newlyUnlocked.map((t: any) => t.name).join(', ')}`);
          }
        }).catch(() => {});
      }
      navigate('/goose-room');
    }
  };

  const handleLogin = (token: string, nextUser: User) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(nextUser));
    setUser(nextUser);
    fetch('/api/titles/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ action: 'login' })
    }).then(r => r.json()).then(data => {
      if (data.newlyUnlocked && data.newlyUnlocked.length > 0) {
        setTimeout(() => alert(`🎉 새 칭호 획득: ${data.newlyUnlocked.map((t: any) => t.name).join(', ')}`), 500);
      }
    }).catch(() => {});
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <>
      <a href="#main-content" className="skip-link" style={{ position: 'absolute', left: '-9999px', top: 0, zIndex: 9999, padding: '1rem', background: '#5c95ff', color: 'white' }} onFocus={e => e.currentTarget.style.left = '0'} onBlur={e => e.currentTarget.style.left = '-9999px'}>본문으로 바로가기</a>
      <Navbar user={user} onLogout={handleLogout} theme={theme} toggleTheme={toggleTheme} />
      <div id="main-content" role="main">
        <Routes>
          <Route path="/" element={<Landing user={user} />} />
          <Route path="/solve" element={<ProblemList user={user} setUser={setUser} />} />
          <Route path="/ranking" element={<Ranking />} />
          <Route path="/users/:id" element={<UserProfile />} />
          <Route path="/groups" element={<Groups user={user} />} />
          <Route path="/groups/:id" element={<GroupDetail user={user} />} />
          <Route path="/about" element={<About user={user} />} />
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/profile" element={<Profile user={user} setUser={setUser} />} />
          <Route path="/admin" element={<Admin user={user} />} />
          <Route path="/goose-room" element={<GooseRoom />} />
        </Routes>
      </div>
      <footer role="contentinfo" style={{ textAlign: 'center', padding: '2rem 1rem', fontSize: '0.85rem', opacity: 0.6, borderTop: '1px solid var(--border)', marginTop: '2rem' }}>
        <p>&copy; {new Date().getFullYear()} Logis. All rights reserved. | <Link to="/about" style={{ color: 'var(--color-4)', textDecoration: 'none' }}>소개</Link> | <Link to="/ranking" style={{ color: 'var(--color-4)', textDecoration: 'none' }}>랭킹</Link></p>
      </footer>
    </>
  );
};

const App: React.FC = () => (
  <Router>
    <AppContent />
  </Router>
);

export default App;
