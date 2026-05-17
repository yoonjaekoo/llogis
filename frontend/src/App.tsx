import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useParams } from 'react-router-dom';
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
  profile_image_url?: string;
  bio?: string;
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
  <header>
    <div className="container">
      <h1 style={{ margin: 0 }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', color: 'white', textDecoration: 'none' }}>
          <img src="/logo.png" alt="Logis Logo" style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover' }} />
          <span style={{ letterSpacing: '-1px' }}>Logis</span>
        </Link>
      </h1>
      <nav>
        <ul>
          <li><Link to="/">문제</Link></li>
          <li><Link to="/ranking">랭킹</Link></li>
          <li><Link to="/groups">그룹</Link></li>
          <li><Link to="/about">소개</Link></li>
          {user ? (
            <>
              {user.username === 'admin' && <li><Link to="/admin" style={{ color: '#fab1a0', fontWeight: 800 }}>관리</Link></li>}
              <li>
                <Link to="/profile" style={{ color: 'var(--color-3)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {user.profile_image_url ? (
                    <img src={user.profile_image_url} alt="Profile" style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--color-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: 'white' }}>
                      {user.username[0].toUpperCase()}
                    </div>
                  )}
                  {user.username} <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>({user.tier})</span> <b style={{ color: 'white' }}>{Math.round(user.rating).toLocaleString()}</b>
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
      <div className="problem-card" style={{ textAlign: 'center' }}>
        <img src="/logo.png" alt="Logis Logo" style={{ width: '80px', height: '80px', borderRadius: '1.5rem', marginBottom: '1.5rem', boxShadow: 'var(--card-shadow)' }} />
        <h2 style={{ color: 'var(--color-4)', marginBottom: '1.5rem' }}>About Logis</h2>
        <p style={{ marginBottom: '2rem' }}>수학 문제를 풀고 레이팅을 올리는 재미있는 수학 학습 플랫폼입니다.</p>
        
        <div style={{ marginBottom: '2rem' }}>
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
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '0.5rem' }}>Contributors</h3>
          <p>yoonjaekoo, 13ksh</p>
        </div>

        {user && (
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
            <h3 style={{ marginBottom: '0.5rem' }}>내 랭크 및 레이팅</h3>
            <p style={{ fontSize: '1.2rem', fontWeight: 800 }}>{user.tier} Rank, {Math.round(user.rating).toLocaleString()}</p>
          </div>
        )}
      </div>
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
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
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
        </div>

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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
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
        </div>
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

  useEffect(() => {
    fetchGroupDetail();
  }, [fetchGroupDetail]);

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

  if (loading) return <div className="container" style={{ padding: '4rem', textAlign: 'center' }}>로딩 중...</div>;
  if (!group || group.error) return <div className="container" style={{ padding: '4rem', textAlign: 'center' }}>그룹을 찾을 수 없습니다.</div>;

  const members = Array.isArray(group.members) ? group.members : [];
  const isMember = group.is_member;
  const isPending = group.is_pending;
  const isOwner = user && group.creator_id === user.id;

  return (
    <main className="container" style={{ padding: '4rem 0' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <button onClick={() => navigate('/groups')} style={{ background: 'none', border: 'none', color: 'var(--color-3)', cursor: 'pointer', marginBottom: '1rem', fontWeight: 800 }}>← 목록으로 돌아가기</button>
        
        <div className="problem-card" style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
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
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'rgba(0,0,0,0.02)', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
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
    </main>
  );
};

const Ranking: React.FC = () => {
  const [ranks, setRanks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const navigate = useNavigate();

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
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <button onClick={() => navigate('/ranking')} style={{ background: 'none', border: 'none', color: 'var(--color-3)', cursor: 'pointer', marginBottom: '1rem', fontWeight: 800 }}>← 랭킹으로 돌아가기</button>
        
        <div className="problem-card" style={{ textAlign: 'center' }}>
          <div style={{ position: 'relative', width: '120px', height: '120px', margin: '0 auto 2rem' }}>
            {u.profile_image_url ? (
              <img src={u.profile_image_url} alt="Profile" style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', boxShadow: '0 0 20px rgba(0,0,0,0.2)' }} />
            ) : (
              <div style={{ 
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '3rem' }}>
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
          </div>

          <div style={{ textAlign: 'center', opacity: 0.6, fontSize: '0.9rem' }}>
            가입일: {new Date(u.created_at).toLocaleDateString()}
          </div>
        </div>
      </div>
    </main>
  );
};

const Admin: React.FC<{ user: User | null }> = ({ user }) => {
  const [message, setMessage] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const navigate = useNavigate();

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

  return (
    <main className="container" style={{ padding: '4rem 0' }}>
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
      </div>
    </main>
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

  const navigate = useNavigate();

  const fetchProfile = useCallback(() => {
    if (!user) return;
    const token = localStorage.getItem('token');
    fetch('/api/users/profile', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      setProfileData(data);
      setEditedUsername(data.user.username);
      setEditedBio(data.user.bio || '');
    });
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
        <div style={{ position: 'relative', width: '120px', height: '120px', margin: '0 auto 2rem' }}>
          {u.profile_image_url ? (
            <img src={u.profile_image_url} alt="Profile" style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', boxShadow: '0 0 20px rgba(0,0,0,0.2)' }} />
          ) : (
            <div style={{ 
              width: '120px', height: '120px', borderRadius: '50%', 
              background: tierColors[u.tier] || 'var(--color-3)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              fontSize: '3rem', boxShadow: '0 0 20px rgba(0,0,0,0.2)', color: 'white', fontWeight: 800
            }}>
              {u.username[0].toUpperCase()}
            </div>
          )}
          <button 
            onClick={() => setIsUpdatingImage(!isUpdatingImage)}
            style={{ position: 'absolute', bottom: 0, right: 0, background: 'var(--color-4)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}
          >
            📷
          </button>
        </div>

        {isUpdatingImage && (
          <form onSubmit={handleUpdateProfileImage} style={{ marginBottom: '2rem', maxWidth: '400px', margin: '0 auto 2rem' }}>
            <input 
              type="file" 
              accept="image/jpeg,image/png,image/gif"
              onChange={e => setNewProfileImageFile(e.target.files?.[0] ?? null)} 
              style={{ width: '100%', padding: '0.8rem', borderRadius: '0.5rem', border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text-main)', marginBottom: '0.5rem' }}
              required 
            />
            <button type="submit" className="btn" style={{ background: 'var(--color-2)', color: 'white', fontSize: '0.9rem', padding: '0.5rem' }}>변경 적용</button>
          </form>
        )}

        {isEditingProfile ? (
          <form onSubmit={handleUpdateProfile} style={{ maxWidth: '500px', margin: '0 auto 2rem' }}>
            <div style={{ marginBottom: '1rem', textAlign: 'left' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', opacity: 0.7 }}>사용자 이름</label>
              <input 
                type="text" 
                value={editedUsername}
                onChange={e => setEditedUsername(e.target.value)}
                style={{ width: '100%', padding: '0.8rem', borderRadius: '0.5rem', border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text-main)' }}
                required
              />
            </div>
            <div style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', opacity: 0.7 }}>자기소개</label>
              <textarea 
                value={editedBio}
                onChange={e => setEditedBio(e.target.value)}
                placeholder="자신을 소개해주세요..."
                style={{ width: '100%', padding: '0.8rem', borderRadius: '0.5rem', border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text-main)', minHeight: '100px', resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn" style={{ background: 'var(--color-3)', color: 'white' }}>저장하기</button>
              <button type="button" onClick={() => setIsEditingProfile(false)} className="btn" style={{ background: 'var(--border)', color: 'var(--text-main)' }}>취소</button>
            </div>
          </form>
        ) : (
          <>
            <h2 style={{ fontSize: '2.5rem', marginBottom: '0.5rem', color: 'var(--color-4)' }}>{u.username}</h2>
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
              {u.bio || "자기소개가 없습니다. 프로필을 수정하여 추가해보세요!"}
            </div>
            <button 
              onClick={() => setIsEditingProfile(true)}
              className="btn" 
              style={{ width: 'auto', marginBottom: '3rem', padding: '0.6rem 2rem', background: 'var(--color-3)', color: 'white' }}
            >
              프로필 수정하기
            </button>
          </>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '3rem' }}>
          <div style={{ padding: '1.5rem', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '1rem' }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>현재 레이팅</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{Math.round(u.rating).toLocaleString()}</div>
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

        <div style={{ textAlign: 'left', opacity: 0.6, fontSize: '0.9rem', marginBottom: '3rem' }}>
          가입일: {new Date(u.created_at).toLocaleDateString()}
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '2rem' }}>
          <button 
            onClick={() => setIsChangingPassword(!isChangingPassword)}
            style={{ background: 'none', border: 'none', color: 'var(--color-3)', cursor: 'pointer', fontWeight: 800, fontSize: '1rem' }}
          >
            {isChangingPassword ? '취소' : '비밀번호 변경하기'}
          </button>

          {isChangingPassword && (
            <form onSubmit={handleChangePassword} style={{ marginTop: '1.5rem', maxWidth: '400px', margin: '1.5rem auto 0' }}>
              <input type="password" placeholder="현재 비밀번호" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} style={{ width: '100%', padding: '0.8rem', borderRadius: '0.5rem', border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text-main)', marginBottom: '0.75rem' }} required />
              <input type="password" placeholder="새 비밀번호" value={newPassword} onChange={e => setNewPassword(e.target.value)} style={{ width: '100%', padding: '0.8rem', borderRadius: '0.5rem', border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text-main)', marginBottom: '1rem' }} required />
              <button type="submit" className="btn" style={{ background: 'var(--color-4)', color: 'white' }}>변경 확인</button>
            </form>
          )}
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

  const selectedProblem = problems.find(p => p.id === selectedProblemId);

  return (
    <main className="container" style={{ display: 'flex', gap: '2rem', padding: '2rem 0', maxWidth: '1400px' }}>
      <div style={{ width: '300px', flexShrink: 0 }}>
        <h3 style={{ marginBottom: '1rem', color: 'var(--color-4)' }}>문제 목록 ({problems.length})</h3>
        <div style={{ maxHeight: '70vh', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '1rem', background: 'var(--card-bg)' }}>
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
              <button 
                onClick={() => {
                  const token = localStorage.getItem('token');
                  fetch('/api/problems/generate', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } })
                  .then(res => res.json())
                  .then(data => {
                    setProblems(data.problems);
                    if (data.problems.length > 0) setSelectedProblemId(data.problems[0].id);
                  });
                }}
                className="btn" style={{ background: 'var(--color-2)', color: 'white' }}
              >
                새 문제 생성
              </button>
            </div>
          )}
        </div>
      </div>

      <div style={{ flexGrow: 1 }}>
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
    } else alert(data.error);
  };

  return (
    <main className="container">
      <div className="auth-form">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img src="/logo.png" alt="Logis Logo" style={{ width: '80px', height: '80px', borderRadius: '1.5rem', boxShadow: 'var(--card-shadow)' }} />
        </div>
        <h2 style={{ color: 'var(--color-4)' }}>로그인</h2>
        <form onSubmit={handleSubmit}>
          <input type="text" placeholder="아이디/이메일" value={email} onChange={e => setEmail(e.target.value)} required />
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
      alert('가입 환영!');
      navigate('/login');
    } else {
      const data = await res.json();
      alert(data.error);
    }
  };

  return (
    <main className="container">
      <div className="auth-form">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img src="/logo.png" alt="Logis Logo" style={{ width: '80px', height: '80px', borderRadius: '1.5rem', boxShadow: 'var(--card-shadow)' }} />
        </div>
        <h2 style={{ color: 'var(--color-4)' }}>가입하기</h2>
        <form onSubmit={handleSubmit}>
          <input type="text" placeholder="이름" value={username} onChange={e => setUsername(e.target.value)} required />
          <input type="email" placeholder="이메일" value={email} onChange={e => setEmail(e.target.value)} required />
          <input type="password" placeholder="비밀번호" value={password} onChange={e => setPassword(e.target.value)} required />
          <button type="submit">가입</button>
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
        <Route path="/ranking" element={<Ranking />} />
        <Route path="/users/:id" element={<UserProfile />} />
        <Route path="/groups" element={<Groups user={user} />} />
        <Route path="/groups/:id" element={<GroupDetail user={user} />} />
        <Route path="/about" element={<About user={user} />} />
        <Route path="/login" element={<Login onLogin={handleLogin} />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/profile" element={<Profile user={user} setUser={setUser} />} />
        <Route path="/admin" element={<Admin user={user} />} />
      </Routes>
    </Router>
  );
};

export default App;
