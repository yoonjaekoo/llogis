# Math Solved (수학 문제 풀이 플랫폼)

수학 문제 풀이를 통해 유저의 레이팅과 문제의 난이도를 동적으로 추정하는 플랫폼입니다.

## 🚀 실행 방법 (Docker 사용 권장)

라즈베리파이나 로컬 PC에서 Docker가 설치되어 있다면 가장 간단하게 실행할 수 있습니다.

```bash
# 전체 서비스 빌드 및 실행 (백엔드, 프론트엔드, DB)
docker-compose up --build
```

실행 후 다음 주소로 접속 가능합니다:
- **Frontend**: `http://localhost` (80번 포트)
- **Backend API**: `http://localhost:5000`
- **PostgreSQL**: `localhost:5432`

### 4. 기능 테스트 방법 (레이팅 시스템)

초기 데이터가 포함되어 있어 바로 테스트가 가능합니다.

1.  **문제 목록 확인**: `GET http://localhost:5000/api/problems`
2.  **정답 제출 및 레이팅 업데이트**:
    ```bash
    # 사용자가 1번 문제를 맞혔을 때 (isCorrect: true)
    curl -X POST http://localhost:5000/api/submissions \
         -H "Content-Type: application/json" \
         -d '{"userId": 1, "problemId": 1, "isCorrect": true}'
    ```
3.  **결과 확인**: 제출 후 반환되는 JSON에서 `newUserRating`과 `newProblemDifficulty`가 변한 것을 확인할 수 있습니다.


## 🛠 기술 스택
- **Frontend**: React, TypeScript, Vite, KaTeX (수식 렌더링)
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL
- **Algorithm**: Glicko-2 (레이팅 시스템 예정)

## 📂 폴더 구조
- `backend/`: Express 서버 코드 및 API 정의
- `frontend/`: React 클라이언트 코드 (Vite 기반)
- `database/`: SQL 스키마 및 마이그레이션 파일
- `plans/`: 프로젝트 설계 및 단계별 구현 계획
