
export interface ProblemTemplate {
  title: string;
  template: string;
  answerFormula: (vars: { [key: string]: number }) => string;
  vars: { [key: string]: { min: number; max: number } };
  difficulty: number;
  tags: string[];
}

export const templates: ProblemTemplate[] = [
  {
    title: '일차방정식 연습',
    template: '$ax + b = c$ 의 해는?',
    answerFormula: (v) => ((v.c - v.b) / v.a).toString(),
    vars: {
      a: { min: 2, max: 10 },
      b: { min: 1, max: 20 },
      c: { min: 21, max: 50 }
    },
    difficulty: 700,
    tags: ['일차방정식', '계산']
  },
  {
    title: '연립방정식 연습',
    template: '$$\\begin{cases} x + y = a \\\\ x - y = b \\end{cases}$$ 일 때, $x$의 값은?',
    answerFormula: (v) => ((v.a + v.b) / 2).toString(),
    vars: {
      a: { min: 10, max: 50 },
      b: { min: 2, max: 10 }
    },
    difficulty: 900,
    tags: ['연립방정식', '계산']
  },
  {
    title: '지수법칙 곱셈',
    template: '$a^b \\times a^x = a^c$ 일 때, $x$는?',
    answerFormula: (v) => (v.c - v.b).toString(),
    vars: {
      a: { min: 2, max: 5 },
      b: { min: 2, max: 5 },
      c: { min: 6, max: 12 }
    },
    difficulty: 800,
    tags: ['지수법칙', '계산']
  },
  {
    title: '삼각형의 내각',
    template: '삼각형의 세 내각 중 두 각이 $a^\\circ, b^\\circ$ 일 때, 나머지 한 각은 몇 도인가?',
    answerFormula: (v) => (180 - v.a - v.b).toString(),
    vars: {
      a: { min: 30, max: 80 },
      b: { min: 30, max: 80 }
    },
    difficulty: 650,
    tags: ['도형', '계산']
  },
  {
      title: '일차함수 함숫값',
      template: '$y = ax + b$ 에서 $x = c$ 일 때, $y$의 값은?',
      answerFormula: (v) => (v.a * v.c + v.b).toString(),
      vars: {
          a: { min: -5, max: 5 },
          b: { min: -10, max: 10 },
          c: { min: -5, max: 5 }
      },
      difficulty: 850,
      tags: ['일차함수', '계산']
  },
  {
      title: '식의 값 계산',
      template: '$x = a, y = b$ 일 때, $3x - 2y + 5$의 값은?',
      answerFormula: (v) => (3 * v.a - 2 * v.b + 5).toString(),
      vars: {
          a: { min: -10, max: 10 },
          b: { min: -10, max: 10 }
      },
      difficulty: 750,
      tags: ['식의계산', '계산']
  }
];

export function generateProblem() {
  const template = templates[Math.floor(Math.random() * templates.length)];
  const variables: { [key: string]: number } = {};
  
  // For linear equation, ensure (c-b) is divisible by a for integer answers
  if (template.title === '일차방정식 연습') {
      const a = Math.floor(Math.random() * (template.vars.a.max - template.vars.a.min + 1)) + template.vars.a.min;
      const x = Math.floor(Math.random() * 10) + 1; // target answer
      const b = Math.floor(Math.random() * (template.vars.b.max - template.vars.b.min + 1)) + template.vars.b.min;
      const c = a * x + b;
      variables['a'] = a;
      variables['b'] = b;
      variables['c'] = c;
  } else if (template.title === '연립방정식 연습') {
      // Ensure a+b is even for integer answer
      const x = Math.floor(Math.random() * 20) + 5;
      const y = Math.floor(Math.random() * (x - 1)) + 1;
      variables['a'] = x + y;
      variables['b'] = x - y;
  } else {
      for (const [name, range] of Object.entries(template.vars)) {
        let val = 0;
        // 0이 되지 않도록 반복 생성 (범위가 0을 포함하는 경우 대비)
        do {
            val = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
        } while (val === 0);
        variables[name] = val;
      }
  }

  let content = template.template;
  for (const [name, val] of Object.entries(variables)) {
    // Replace variable names. We use a regex that looks for the variable name with a word boundary before it,
    // and ensuring it's not part of another word (except for 'x' which is the math unknown).
    const regex = new RegExp(`\\b${name}(?![a-wy-z가-힣])`, 'g');
    content = content.replace(regex, val.toString());
  }

  return {
    title: template.title,
    content,
    answer: template.answerFormula(variables),
    difficulty: template.difficulty,
    tags: template.tags
  };
}
