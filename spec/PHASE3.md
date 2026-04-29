# Phase 3 구현 지시서 — AI SVG 생성 파이프라인

> 전체 설계는 SPEC.md, 이전 구현은 PHASE1.md / PHASE2.md 참고.
> **Phase 1~2에서 구현한 공통 후처리 로직을 최대한 재사용할 것.**

---

## 구현 범위

- 주제어 입력 → OpenAI SVG 생성 → SVG path 파싱 → Stroke[] 변환
- 화이트박스 UI (각 단계 시각화)
- 방법 1(이미지 파이프라인)과 결과 비교

---

## 백엔드 API 명세

### `POST /pipeline/svg`

주제어를 받아 SVG를 생성하고 파이프라인 전 단계를 실행한다.

**Request:** `application/json`

```json
{
  "keyword": "사과",
  "simplify_epsilon": 2.0,
  "min_stroke_length": 3
}
```

| 필드              | 타입   | 기본값 | 설명                |
| ----------------- | ------ | ------ | ------------------- |
| keyword           | string | 필수   | 그림 주제어         |
| simplify_epsilon  | float  | 2.0    | path 단순화 강도    |
| min_stroke_length | int    | 3      | 최소 stroke 점 개수 |

**Response:** `application/json`

```json
{
  "steps": {
    "svg_raw": "<svg>...</svg>",
    "strokes_per_path": [
      {
        "path_index": 0,
        "color": [239, 68, 68],
        "raw_points": [[x1, x2, ...], [y1, y2, ...]]
      }
    ]
  },
  "drawing": [
    {
      "points": [[x1, x2, ...], [y1, y2, ...]],
      "color": [r, g, b]
    }
  ],
  "metrics": {
    "strokeCount": 7,
    "totalPointCount": 180,
    "averagePointPerStroke": 25.7,
    "colorCount": 3
  }
}
```

---

## SVG 생성 프롬프트

OpenAI에게 아래 형식으로 요청한다.

**system:**

```
You are an SVG illustrator. Draw simple, recognizable stroke-based illustrations.
Rules:
- viewBox must be "0 0 400 400"
- Use only <path> or <polyline> elements. No <rect>, <circle>, <ellipse>, <text>, or <image>.
- No fill. Only strokes. Every element must have fill="none".
- stroke color must be one of: #000000, #EF4444, #3B82F6, #22C55E, #EAB308
- stroke-width: 3
- Minimum 3 strokes, maximum 25 strokes.
- Draw only the essential shape. Keep it simple enough to recognize at a glance.
- Output only the raw SVG string. No explanation, no markdown, no code block.
```

**user:**

```
Draw a simple stroke illustration of: {keyword}
```

---

## SVG 파싱 및 변환 로직

### SVG path → 점 배열 변환

- `svgpathtools` 또는 `svg.path` 라이브러리 사용
- 각 `<path>`의 d 속성을 파싱
- 베지어 커브는 일정 간격으로 샘플링해 점 배열로 변환 (샘플링 간격: 5px)
- `<polyline>`은 points 속성을 직접 파싱

### 색상 추출

- 각 path의 `stroke` 속성에서 hex 색상 추출
- PALETTE_COLORS hex값과 정확히 매칭 → RGB로 변환
- 매칭 실패 시 LAB 색공간 기준 가장 가까운 팔레트 색으로 fallback (Phase 1과 동일 로직)

### 공통 후처리 적용

Phase 1~2에서 구현한 아래 로직을 그대로 재사용한다:

- 좌표 정규화 (400x400, padding 10px, 중앙 정렬)
- min_stroke_length 미만 stroke 제거
- simplify_epsilon 적용 (`cv2.approxPolyDP` 또는 Ramer-Douglas-Peucker)
- metrics 계산

---

## 프론트엔드 UI 명세

### AiSvgPipelinePage 레이아웃

```
[ AiSvgPipelinePanel ]   ← 주제어 입력, 파라미터, 실행 버튼

[ PipelineStepViewer ]   ← 각 Step 결과를 순서대로 나열
  Step 1. 주제어
  Step 2. AI 생성 SVG 원문 (코드 표시)
  Step 3. SVG 렌더링 (브라우저에서 SVG 직접 렌더링)
  Step 4. path별 stroke 추출 결과 (path 인덱스, 색상, 점 개수 목록)
  Step 5. points 변환 결과 (정규화 후 좌표)
  Step 6. 최종 canvas 렌더링 (StrokePreviewCanvas)
  Step 7. JSON 출력 + 복사/다운로드 버튼

[ metrics 표시 ]

[ StrokeEditor ]         ← Phase 2와 동일하게 재사용
```

### 재사용 컴포넌트

Phase 1~2에서 만든 아래 컴포넌트를 그대로 재사용한다:

- `StrokePreviewCanvas`
- `StrokeEditor`
- metrics 표시 컴포넌트
- 실험 저장 (zip export) — params.json의 method를 `"svg"`로, keyword 필드 추가

---

## 방법 1과 결과 비교 UI

두 방법의 결과를 나란히 비교할 수 있는 페이지를 추가한다.

### 비교 페이지 레이아웃

```
[ 비교 페이지 ]

주제어 입력: [ 사과      ] [비교 실행]

┌─────────────────┬─────────────────┐
│  방법 1 (이미지) │  방법 2 (AI SVG) │
│  이미지 업로드   │                  │
│  [ canvas ]     │  [ canvas ]      │
│                 │                  │
│ strokeCount: 5  │ strokeCount: 8   │
│ pointCount: 120 │ pointCount: 200  │
│ colorCount: 2   │ colorCount: 3    │
└─────────────────┴─────────────────┘
```

- 방법 1은 이미지를 업로드해야 하므로 파일 업로드 UI 포함
- 각 방법의 최종 canvas와 metrics를 나란히 표시
- 두 결과를 동시에 JSON export할 수 있는 버튼 추가

---

## 파일 구조 추가/변경

```
frontend/
  src/
    pages/
      AiSvgPipelinePage.tsx     ← 신규
      ComparisonPage.tsx         ← 신규
    components/
      AiSvgPipelinePanel.tsx    ← 신규

backend/
  app/
    routes/
      ai_svg_pipeline.py        ← 신규 (Phase 1에서 빈 파일로 생성됨)
    services/
      svg_parser.py             ← 신규 (Phase 1에서 빈 파일로 생성됨)
```

---

## 환경변수

```
OPENAI_API_KEY=sk-...
```

이미 백엔드 `.env`에 명시되어 있음. `python-dotenv`로 로드.

---

## 구현 시 주의사항

- SVG 생성 실패(API 오류, 파싱 실패) 시 에러 메시지를 프론트에 명확히 표시할 것
- OpenAI가 규칙을 어기는 SVG를 반환할 수 있음 (fill 있음, 허용되지 않는 요소 등). 파싱 시 방어적으로 처리할 것
  - fill이 있는 path는 무시하거나 fill 제거 후 처리
  - 지원하지 않는 요소(`<circle>` 등)는 skip
- 공통 후처리 로직(정규화, metrics)은 Phase 1 서비스 코드를 import해서 재사용할 것. 중복 구현 금지
