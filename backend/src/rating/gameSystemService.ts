import { PoolClient } from 'pg';

export interface Quest {
  id: string;
  title: string;
  type: 'solve' | 'streak' | 'accuracy';
  target: number;
  current: number;
  completed: boolean;
  xpReward: number;
  tokenReward: number;
  // accuracy 퀘스트용 추가 메타데이터
  totalAttempts?: number;
  correctCount?: number;
}

// 날짜 차이 계산 함수 (KST 기준 YYYY-MM-DD 지원)
export const getDaysDifference = (dateStr1: string, dateStr2: string): number => {
  if (!dateStr1 || !dateStr2) return 999;
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// 현재 날짜 문자열 반환 (KST YYYY-MM-DD)
export const getTodayString = (): string => {
  const now = new Date();
  // 한국 시간대로 변환
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstDate = new Date(now.getTime() + kstOffset);
  return kstDate.toISOString().split('T')[0];
};

// 일일 퀘스트 생성기
export const generateDailyQuests = (): Quest[] => {
  return [
    {
      id: 'solve_problems',
      title: '수학 문제 3개 해결하기',
      type: 'solve',
      target: 3,
      current: 0,
      completed: false,
      xpReward: 150,
      tokenReward: 1
    },
    {
      id: 'maintain_streak',
      title: '오늘의 스트릭 시작/유지하기',
      type: 'streak',
      target: 1,
      current: 0,
      completed: false,
      xpReward: 100,
      tokenReward: 1
    },
    {
      id: 'accuracy_threshold',
      title: '정확도 80% 이상 달성하기 (최소 3문제 시도)',
      type: 'accuracy',
      target: 80,
      current: 0,
      completed: false,
      xpReward: 200,
      tokenReward: 2,
      totalAttempts: 0,
      correctCount: 0
    }
  ];
};

/**
 * 1. 스트릭 복구 메커니즘
 * 로그인 시 혹은 문제 풀이 시도 시 호출됩니다.
 * 하루를 건너뛰어 스트릭이 끊겼는지 확인하고, streak_repaired 보호막을 소비하여 복구합니다.
 * 복구 시 submissions 테이블에 is_streak_repair = true 행을 추가합니다.
 */
export const checkAndRepairStreak = async (userId: number, client: PoolClient): Promise<{ repaired: boolean; newStreak: number; newTokens: number; consumedRepair: boolean }> => {
  const today = getTodayString();

  const userRes = await client.query(
    'SELECT streak, tokens, last_active_date, streak_repaired FROM users WHERE id = $1 FOR UPDATE',
    [userId]
  );
  if (userRes.rows.length === 0) {
    throw new Error('User not found');
  }

  const user = userRes.rows[0];
  let streak = user.streak || 0;
  let tokens = user.tokens || 0;
  const lastActive = user.last_active_date;
  let repaired = false;
  let consumedRepair = false;

  if (!lastActive) {
    return { repaired: false, newStreak: streak, newTokens: tokens, consumedRepair: false };
  }

  const diff = getDaysDifference(lastActive, today);

  if (diff >= 2) {
    if (user.streak_repaired) {
      // 보호막 소비: 스트릭 유지, 어제 날짜로 last_active_date 설정
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const kstOffset = 9 * 60 * 60 * 1000;
      const yesterdayKst = new Date(yesterday.getTime() + kstOffset);
      const yesterdayStr = yesterdayKst.toISOString().split('T')[0];

      await client.query(
        'INSERT INTO submissions (user_id, problem_id, is_correct, is_streak_repair, user_answer) VALUES ($1, NULL, TRUE, TRUE, $2)',
        [userId, '스트릭 리페어 사용']
      );
      await client.query(
        'UPDATE users SET streak_repaired = FALSE, last_active_date = $1 WHERE id = $2',
        [yesterdayStr, userId]
      );
      repaired = true;
      consumedRepair = true;
    } else {
      // 보호막 없음 → 스트릭 초기화
      streak = 0;
      await client.query(
        'UPDATE users SET streak = $1, last_active_date = $2 WHERE id = $3',
        [streak, today, userId]
      );
    }
  }

  return { repaired, newStreak: streak, newTokens: tokens, consumedRepair };
};

/**
 * 2. 일일 리셋 로직
 * 날짜가 바뀌었을 때 퀘스트를 리셋하고 streak_repaired 플래그를 원복합니다.
 */
export const handleDailyReset = async (userId: number, client: PoolClient, todayStr?: string): Promise<any> => {
  const today = todayStr || getTodayString();
  
  const userRes = await client.query(
    'SELECT last_active_date, streak_repaired, quests FROM users WHERE id = $1 FOR UPDATE',
    [userId]
  );
  if (userRes.rows.length === 0) return;

  const user = userRes.rows[0];
  const lastActive = user.last_active_date;

  if (lastActive !== today) {
    // 날짜가 바뀜 → 퀘스트 새로 생성 (streak_repaired는 유지, 보호막은 소비될 때까지 유지)
    const freshQuests = generateDailyQuests();
    await client.query(
      'UPDATE users SET quests = $1 WHERE id = $2',
      [JSON.stringify(freshQuests), userId]
    );
  }
};

/**
 * 3. 스트릭 업데이트
 * 당일 첫 문제 해결 시 호출됩니다.
 */
export const updateStreak = async (userId: number, client: PoolClient): Promise<{ newStreak: number; bonusTokens: number }> => {
  const today = getTodayString();

  const userRes = await client.query(
    'SELECT streak, last_active_date, tokens FROM users WHERE id = $1 FOR UPDATE',
    [userId]
  );
  if (userRes.rows.length === 0) throw new Error('User not found');

  const user = userRes.rows[0];
  let streak = user.streak || 0;
  const lastActive = user.last_active_date;
  let bonusTokens = 0;

  if (lastActive !== today) {
    const diff = getDaysDifference(lastActive, today);
    if (diff === 1 || lastActive === '') {
      // 정상적으로 다음 날 풀었거나 최초 풀이
      streak += 1;
    } else {
      // 끊긴 경우 (이전 checkAndRepair가 수행되지 않았거나 실패한 상태)
      streak = 1;
    }

    // 스트릭 보너스 토큰 계산 (하루에 최초 1회만 지급)
    if (streak >= 10) {
      bonusTokens = 2;
    } else if (streak >= 5) {
      bonusTokens = 1;
    }

    await client.query(
      'UPDATE users SET streak = $1, last_active_date = $2, tokens = tokens + $3 WHERE id = $4',
      [streak, today, bonusTokens, userId]
    );
  }

  return { newStreak: streak, bonusTokens };
};

/**
 * 4. 토큰 지급
 * 문제 정답 시 1 토큰 기본 지급
 */
export const updateTokens = async (userId: number, client: PoolClient, isCorrect: boolean): Promise<number> => {
  if (!isCorrect) {
    const userRes = await client.query('SELECT tokens FROM users WHERE id = $1', [userId]);
    return userRes.rows[0]?.tokens || 0;
  }

  const result = await client.query(
    'UPDATE users SET tokens = tokens + 1 WHERE id = $1 RETURNING tokens',
    [userId]
  );
  return result.rows[0]?.tokens || 0;
};

/**
 * 5. 퀘스트 업데이트 및 보상
 * 문제 풀이 시도/정답/스트릭 관련 활동이 발생할 때마다 퀘스트 달성 여부를 검사하고 즉시 보상 지급
 */
export const updateQuests = async (
  userId: number,
  client: PoolClient,
  action: 'attempt' | 'solve' | 'streak',
  data?: { isCorrect?: boolean }
): Promise<{ quests: Quest[]; xpGained: number; tokensGained: number }> => {
  const userRes = await client.query(
    'SELECT quests, xp, tokens FROM users WHERE id = $1 FOR UPDATE',
    [userId]
  );
  if (userRes.rows.length === 0) throw new Error('User not found');

  const user = userRes.rows[0];
  let quests: Quest[] = Array.isArray(user.quests) ? user.quests : [];
  if (quests.length === 0) {
    quests = generateDailyQuests();
  }

  let xpGained = 0;
  let tokensGained = 0;

  quests = quests.map((q) => {
    if (q.completed) return q;

    let updatedQ = { ...q };

    if (q.type === 'solve' && action === 'solve') {
      updatedQ.current += 1;
      if (updatedQ.current >= updatedQ.target) {
        updatedQ.completed = true;
        xpGained += updatedQ.xpReward;
        tokensGained += updatedQ.tokenReward;
      }
    }

    else if (q.type === 'streak' && action === 'streak') {
      updatedQ.current = 1;
      updatedQ.completed = true;
      xpGained += updatedQ.xpReward;
      tokensGained += updatedQ.tokenReward;
    }

    else if (q.type === 'accuracy' && (action === 'attempt' || action === 'solve')) {
      const total = (q.totalAttempts || 0) + 1;
      const corrects = (q.correctCount || 0) + (action === 'solve' ? 1 : 0);
      updatedQ.totalAttempts = total;
      updatedQ.correctCount = corrects;

      const accuracy = total >= 3 ? Math.round((corrects / total) * 100) : 0;
      updatedQ.current = accuracy;

      if (total >= 3 && accuracy >= q.target) {
        updatedQ.completed = true;
        xpGained += updatedQ.xpReward;
        tokensGained += updatedQ.tokenReward;
      }
    }

    return updatedQ;
  });

  if (xpGained > 0 || tokensGained > 0) {
    await client.query(
      'UPDATE users SET xp = xp + $1, tokens = tokens + $2, quests = $3 WHERE id = $4',
      [xpGained, tokensGained, JSON.stringify(quests), userId]
    );
  } else {
    await client.query(
      'UPDATE users SET quests = $1 WHERE id = $2',
      [JSON.stringify(quests), userId]
    );
  }

  return { quests, xpGained, tokensGained };
};
