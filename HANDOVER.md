# 🎯 TargetScan AI - 프로젝트 인수인계 & 현황 개발 문서 (HANDOVER.md)

> **문서 버전:** v1.1.0  
> **최종 갱신일:** 2026-10-21  
> **작성자:** AI 개발부장 코다리 & 디자인 실장 영자  
> **대상:** 차기 개발자, 터미널 환경 작업자, 후속 AI 에이전트(Claude, GPT, Cursor 등)  
> **라이브 서비스:** [https://target-scanner-xi.vercel.app](https://target-scanner-xi.vercel.app)  
> **GitHub 저장소:** [https://github.com/lulu-tt/Target-Scanner.git](https://github.com/lulu-tt/Target-Scanner.git) (main 브랜치)

---

## 1. 프로젝트 개요 & 비전 (Executive Summary)

### 1.1 배경 및 목적
- **고가 전자표적(Sius 등) 대체:** 수백만~수천만 원대 전자표적을 설치하기 힘든 학교, 개인 사수, 사격 동호인을 위해 스마트폰 카메라 한 번으로 종이 표적을 분석하는 솔루션.
- **ISSF 10m 공기소총(Air Rifle) 전문:** 4.5mm 연탄(Pellet) 전용 표적(170mm x 170mm 규격, 흑점 직경 30.5mm)을 10.9 만점 소수점 단위로 자동 채점.
- **인프라 비용 0원 지향:** 사용자 브라우저 온디바이스(HTML5 Canvas/OpenCV 로직) 및 사용자의 무료 Google AI Studio Gemini API 키를 연동하는 린(Lean) 아키텍처.

### 1.2 핵심 UX 흐름
1. **[STEP 1] 표적지 사진 등록:** 스마트폰 카메라로 정면 촬영하거나 앨범에서 사진 선택 (즉시 800x800 표준 캔버스 프리뷰 로드).
2. **[STEP 2] 사격 발수 / 유형 선택:** 10발 / 15발 / 20발 / 30발 / 백지 표적 / 자유 사격 중 원하는 카드를 터치.
3. **[STEP 3] 정밀 분석 & 결과 표시:** Gemini AI 멀티모달 비전(또는 온디바이스 v3.0 엔진)이 탄흔 및 표적 중심을 자동 감지하고 ISSF 점수, 집탄군(MPI, Extreme Spread, CEP50), 조준기 클릭 가이드를 즉시 도출.
4. **[STEP 4] 사수 2중 미세조정:** 드래그 앤 드롭으로 탄흔 위치 이동, 탭으로 탄흔 추가, 우클릭/더블탭으로 삭제, 표적 중심 및 링 반경 미세조정.

---

## 2. 기술 스택 & 시스템 구성 (Tech Stack)

| 구분 | 기술 / 라이브러리 | 버전 / 비고 |
| :--- | :--- | :--- |
| **Frontend** | React, TypeScript, Vite | React 18.3, TypeScript 5.6, Vite 5.4 |
| **Styling** | Tailwind CSS, Lucide React | 모던 다크/라이트 테마, 모바일 엄지 존(Thumb-zone) 최적화 |
| **Vision AI** | Google Gemini Multimodal Vision API | `gemini-3.8-flash` ➔ `gemini-flash-latest` ➔ `gemini-2.5-flash` 체인 |
| **On-Device CV** | HTML5 Canvas 2D + Custom Pure CV v3.0 | BFS 연결 성분 분석, K-Means++ 클러스터링, 공간 그리드 |
| **Storage** | LocalStorage (Supabase Ready) | API 키, 세션 히스토리 로컬 영구 저장 (`supabase_schema.sql` 완비) |
| **Hosting** | Vercel (Production) | GitHub main 브랜치 Push 시 자동 CI/CD 배포 |

---

## 3. 디렉토리 & 파일 구조 (Project Structure)

```text
Target Scanner/
├── HANDOVER.md                 # 본 인수인계 문서
├── PRD.md                      # 제품 요구사항 정의서 (v1.0)
├── SYSTEM_DESIGN.md            # 시스템 아키텍처 설계서 (v1.0)
├── index.html                  # 싱글 페이지 엔트리포인트 (Noto Sans KR, 모바일 뷰포트)
├── package.json                # 의존성 및 실행 스크립트 정의
├── vite.config.ts              # Vite 설정
├── tailwind.config.js          # Tailwind 설정
├── supabase_schema.sql         # 향후 클라우드 DB 동기화용 Supabase 스키마
└── src/
    ├── main.tsx                # React Root 마운트
    ├── App.tsx                 # 메인 통합 오케스트레이터 (상태, 이벤트, 분석 트리거)
    ├── index.css               # 전역 스타일 및 유틸리티 클래스
    ├── types/
    │   └── target.ts           # ShotPoint, TargetCalibration, GroupingStats, TargetMode 등
    ├── utils/
    │   ├── issfSpecs.ts        # ISSF 공식 소수점 점수 계산기, 탄착군 통계, 클릭 추천기
    │   ├── geminiVision.ts     # Gemini 멀티모달 비전 분석 엔진 (API 통신, ROI 필터링, Infill)
    │   ├── visionProcessor.ts  # 온디바이스 CV v3.0 엔진 (BFS 흑점 검출, 모폴로지, K-Means)
    │   └── targetSamples.ts    # 오프라인 테스트용 모의 표적지 생성기 (10발/20발/백지)
    ├── components/
    │   ├── Header.tsx          # 상단 글로벌 네비게이션, 모드 배지, API 설정 모달 트리거
    │   ├── ScannerPanel.tsx    # 2단계 워크플로우 패널 ([1] 사진등록 -> [2] 발수선택)
    │   ├── TargetCanvas.tsx    # 인터랙티브 캔버스 (줌/팬, 돋보기, 드래그, 라벨 토글, 흑점 보정)
    │   ├── ScoreBoard.tsx      # ISSF 점수판, 탄흔 리스트, 집탄도 지표(MPI, CEP50), 조준 가이드
    │   ├── SettingsModal.tsx   # Google AI Studio API 키 등록/관리 모달 (15 RPM 무료)
    │   └── HistoryModal.tsx    # 과거 사격 세션 기록 조회/불러오기/삭제 모달
    └── lib/
        └── supabase.ts         # Supabase 클라이언트 초기화 코드 (선택적)
```

---

## 4. ISSF 공식 규격 & 계산 수식 (ISSF Domain Specs)

### 4.1 10m 공기소총 표적지 규격
- **종이 표적지 카드:** $170\text{mm} \times 170\text{mm}$ (정사각형)
- **흑점(Black Circle, 4점~10점 링):** 직경 $30.5\text{mm}$ (반경 $15.25\text{mm}$)
- **1점 링 외곽 직경:** $45.5\text{mm}$ (반경 $22.75\text{mm}$)
- **10점 링 직경:** $0.5\text{mm}$ (중심점 크기)
- **링 간격 (Ring Step):** 반경 $2.5\text{mm}$ 증가마다 1점씩 감소
- **탄환(Pellet) 규격:** $4.5\text{mm}$ (.177 구경), 반경 $2.25\text{mm}$

### 4.2 소수점 점수 계산 공식
중심점 $(cx, cy)$으로부터 탄흔 중심까지의 거리 $d$ (mm):
$$Score = \max\left(0, 10.9 - \frac{d}{0.25} \times 0.1\right)$$
- 중심 $d = 0.0\text{mm} \implies 10.9$점
- 중심 $d \le 0.25\text{mm} \implies 10.8$점
- 10.0점 경계: $d = 2.25\text{mm}$
- 계산 함수: `calculateShotScore()` in `src/utils/issfSpecs.ts`

### 4.3 물리적 ROI 절대 제한 규칙 (Zero-Tolerance Clamping)
- 1점 링 외곽 반경($22.75\text{mm}$)에 탄환 반경($2.25\text{mm}$)을 더한 최대 유효 반경은 **$25.0\text{mm}$**입니다.
- 시스템은 안전 마진을 적용하여 **$d > 24.5\text{mm}$**인 모든 검출 결과(상단의 "2011년", "10/18", 모서리 채점표, 코치 손글씨 피드백 등)를 **100% 원천 배제**합니다.

### 4.4 집탄군 지표
- **MPI (Mean Point of Impact):** 전체 탄흔의 중심 편차 평균 ($(\bar{X}, \bar{Y})$ mm)
- **Extreme Spread (최대 분산):** 탄흔 집합 중 가장 먼 두 탄흔 사이의 유클리드 거리 (mm)
- **CEP50 (Circular Error Probable 50%):** MPI를 기준으로 탄환의 50%가 모인 반경 (중앙값)
- **Sight Adjustment Guide:** $\text{클릭수} = |\text{MPI}| / 0.5\text{mm}$ (우탄 $\implies$ 좌측 L 클릭, 하탄 $\implies$ 상단 UP 클릭)

---

## 5. 핵심 엔진 아키텍처 상세

### 5.1 Gemini 멀티모달 비전 엔진 (`src/utils/geminiVision.ts`)
1. **정규화 좌표계 변환:**
   - Google 비전 표준인 $[0, 1000]$ 정규화 좌표계를 캔버스 표준인 $800 \times 800\text{px}$로 스케일 변환.
   - $\text{pixelX} = (\text{val} / 1000) \times 800$
2. **동적 스케일링 ($pxPerMm$):**
   - AI가 감지한 흑점 픽셀 반경(`blackRadiusPx`)을 기반으로 $pxPerMm = blackRadiusPx / 15.25$ 산출.
3. **ROI 필터 & Torn Cluster Infill:**
   - $d > 24.5\text{mm}$ 필터링 후 탄흔 수가 사용자가 지정한 발수(`targetCount`)보다 부족할 경우(중앙에 다발성 탄환이 찢어져 뭉친 경우), 중앙 찢어진 틈새(Cluster Center) 내부에서 $0.6\text{mm} \sim 1.8\text{mm}$ 미세 오프셋을 주어 누락된 탄흔을 지능적으로 분배.
4. **타임아웃 및 폴백:**
   - 18초 `AbortController` 적용으로 무한 대기 방지. 네트워크 지연 또는 API 오류 시 즉시 온디바이스 엔진으로 폴백.

### 5.2 온디바이스 비전 엔진 v3.0 (`src/utils/visionProcessor.ts`)
1. **BFS 단일 연결 흑점 검출:**
   - $400 \times 400$ 2px 다운샘플 그리드에서 무채색 저명도($lum < 58$) 픽셀 마스크 생성.
   - 중앙에서 가장 가까운 시드(Seed)를 찾아 BFS 플러드필로 표적지 중심 $(cx, cy)$ 및 반경 완벽 피팅.
2. **모폴로지 5x5 오프닝 연산:**
   - $1 \sim 2\text{px}$ 굵기의 볼펜 손글씨 및 메모 노이즈 제거.
3. **K-Means++ 탄착군 클러스터링:**
   - 찢어진 단일 탄흔 영역을 면적 기반으로 분할하여 목표 발수만큼 정밀 좌표 추출.
4. **백지 표적지(Blank Target) 지원:**
   - 흑점이 없는 흰색 표적지의 경우, 탄흔 픽셀 집합의 무게중심(Centroid)을 자동으로 표적 중심으로 지정.

---

## 6. 작업 히스토리 & 주요 해결 과제 (Changelog)

| 커밋 / 버전 | 내용 | 상세 설명 |
| :--- | :--- | :--- |
| `b4a06f0` | **프로세스 2단계 개편 & 18초 타임아웃** | 사진 등록 먼저 ➔ 사격 발수/유형 선택 순서로 개편. 불필요한 10발 기본 분석 방지. Step 2 유도 배너 추가. Gemini API 18초 AbortController 적용. |
| `f9f6a94` | **물리적 ROI 클램핑 & 찢어진 탄흔 보정** | 거리 $> 24.5\text{mm}$ 외곽 손글씨("2011년", "10/18", 점수표) 원천 제거. 부족한 발수는 중앙 찢어진 홀 내부 클러스터 분배. 캔버스 툴바 점수 배지 토글(`[🏷️]`) 추가. |
| `1758af0` | **Gemini 0-1000 좌표계 100px 오프셋 수정** | Gemini 비전 좌표를 캔버스 $800 \times 800$에 정확히 매핑하여 우하단 100px 밀림 현상 완벽 제거. |
| `91880fa` | **BFS 단일 연결 흑점 피팅 알고리즘** | 카메라 실사 촬영 시 흑점 중심과 가상 링이 어긋나는 포커스 미스 매칭 해결. |
| `9a4102b` | **동적 픽셀 스케일링 & 수동 미세조정 패널** | 흑점 반경 동적 산출 및 캔버스 상단 과녁 중심/반경 수동 미세조정 컨트롤러 탑재. |
| `4b711bb` | **Gemini Multimodal Vision 도입** | Google AI Studio 키(무료 15 RPM) 연동 및 Zero-Dependency fetch 기반 비전 파이프라인 탑재. |

---

## 7. 로컬 개발 & 빌드 가이드 (Getting Started)

### 7.1 요구 사항
- **Node.js:** v18.0.0 이상 (권장: Node v20+ / 현재 개발 환경 v26.8.2)
- **패키지 매니저:** npm

### 7.2 설치 및 실행 명령어
```bash
# 1. 의존성 설치
npm install

# 2. 로컬 개발 서버 실행 (기본 포트: 5173)
npm run dev

# 3. TypeScript 타입 검사 및 프로덕션 빌드
npm run build

# 4. 빌드 결과물 로컬 미리보기
npm run preview
```

### 7.3 환경 변수 설정 (선택적)
- 루트 디렉토리의 `.env.example`을 복사하여 `.env` 생성 가능:
  ```env
  VITE_SUPABASE_URL=https://your-project.supabase.co
  VITE_SUPABASE_ANON_KEY=your-anon-key
  ```
- *참고:* Gemini API 키는 보안 및 사용자 편의를 위해 환경 변수가 아닌 브라우저 UI의 **설정(⚙️) 모달**을 통해 `localStorage`(`targetscan_gemini_api_key`)에 저장됩니다.

---

## 8. 차기 작업자를 위한 권장 백로그 (Next Roadmap)

1. **원격 클라우드 세션 동기화 (Supabase):**
   - 이미 `supabase_schema.sql`과 `src/lib/supabase.ts`가 구성되어 있습니다.
   - 로그인 기능(사수 계정) 추가 시 로컬 스토리지의 세션 히스토리를 Supabase DB로 백업/동기화할 수 있습니다.
2. **복합 5구 / 10구 표적지 지원:**
   - 1장에 5개 또는 10개의 작은 흑점이 인쇄된 복합 표적지 자동 분할 스캔 기능.
3. **PWA (Progressive Web App) 오프라인 지원:**
   - `vite-plugin-pwa`를 도입하여 지하 실내 사격장(통신 음영 구역)에서도 홈 화면에 설치하고 100% 온디바이스 엔진으로 동작하도록 캐싱.
4. **선수별 일자별 탄착군 추이 차트:**
   - Recharts 라이브러리를 활용하여 MPI의 분산 추이, 일자별 평균 점수 변동 그래프 시각화.

---

> **안내:** 추가 질의나 수정 요청이 필요할 경우 본 문서와 함께 `src/App.tsx`, `src/utils/geminiVision.ts`, `src/utils/visionProcessor.ts`를 열어 작업을 시작하시면 됩니다.
