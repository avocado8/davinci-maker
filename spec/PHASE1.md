# Phase 1 구현 지시서 — 이미지 기반 파이프라인 MVP

> 전체 설계는 SPEC.md 참고. 본 문서는 Phase 1에서 구현할 범위만 다룬다.
> **Phase 2~4는 구현하지 말 것. 단, 폴더 구조는 SPEC.md 기준을 따를 것.**

---

## 구현 범위

- React + Vite + TS 프론트엔드 세팅
- FastAPI 백엔드 세팅
- Docker Compose로 로컬 실행 환경 구성 (배포는 이후 단계)
- 이미지 업로드 → 배경 제거 → 마스크 → contour 추출 → Stroke[] 변환 → 캔버스 미리보기 → JSON export
- 각 파이프라인 단계의 결과를 시각적으로 확인할 수 있는 화이트박스 UI

---

## 타입 정의

아래 타입을 프론트/백 공통 기준으로 사용한다.

```ts
type Stroke = {
  points: [number[], number[]]; // [x좌표 배열, y좌표 배열]
  color: [number, number, number]; // RGB
};

type Drawing = Stroke[];
```

사용 팔레트 (이 색상만 사용됨):

```ts
export const PALETTE_COLORS = [
  { name: "검정", rgb: [0, 0, 0] },
  { name: "빨강", rgb: [239, 68, 68] },
  { name: "파랑", rgb: [59, 130, 246] },
  { name: "초록", rgb: [34, 197, 94] },
  { name: "노랑", rgb: [234, 179, 8] },
] as const;
```

캔버스 사양:

```
크기: 400 x 400
패딩: 10px (오브젝트가 가장자리에 닿지 않도록)
정렬: 중앙
좌표 정규화: 추출된 contour를 400x400 기준으로 scale
```

---

## 프로젝트 구조

SPEC.md의 구조를 따른다. Phase 1에서 실제로 생성할 파일 목록:

```
frontend/
  src/
    pages/
      ImagePipelinePage.tsx       ← 방법 1 전체 UI
    components/
      ImagePipelinePanel.tsx      ← 업로드 + 파라미터 입력 + 실행 버튼
      PipelineStepViewer.tsx      ← 각 Step 결과 시각화
      StrokePreviewCanvas.tsx     ← Stroke[] → canvas 렌더링
      StrokeEditor.tsx            ← stroke 삭제/색상 변경 (Phase 1 최소 구현)
  Dockerfile
  nginx.conf (또는 vite preview 사용)

backend/
  app/
    main.py
    routes/
      image_pipeline.py
    services/
      background_remover.py
      contour_extractor.py
      stroke_processor.py         ← normalize, color mapping, noise filter
    schemas/
      stroke.py
  Dockerfile
  requirements.txt

docker-compose.yml
```

---

## 백엔드 API 명세

### `GET /health`

연결 상태 확인용.

```json
{ "status": "ok" }
```

---

### `POST /pipeline/image`

이미지를 받아 파이프라인 전 단계를 실행하고, 각 단계 결과를 한 번에 반환한다.

**Request:** `multipart/form-data`

| 필드              | 타입  | 설명                            |
| ----------------- | ----- | ------------------------------- |
| image             | File  | 업로드 이미지                   |
| remove_bg         | bool  | 배경 제거 on/off (기본 true)    |
| extract_internal  | bool  | 내부선 추출 여부 (기본 false)   |
| alpha_threshold   | int   | 0~255, 기본 128                 |
| canny_low         | int   | Canny threshold low, 기본 50    |
| canny_high        | int   | Canny threshold high, 기본 150  |
| min_contour_area  | int   | 최소 contour 면적 px², 기본 100 |
| simplify_epsilon  | float | contour 단순화 강도, 기본 2.0   |
| max_stroke_count  | int   | 최대 stroke 수 제한, 기본 30    |
| min_stroke_length | int   | 최소 stroke 점 개수, 기본 3     |

**Response:** `application/json`

```json
{
  "steps": {
    "original": "<base64 PNG>",
    "removed_bg": "<base64 PNG>",
    "mask": "<base64 PNG>",
    "contour_overlay": "<base64 PNG>",
    "simplified_overlay": "<base64 PNG>"
  },
  "drawing": [
    {
      "points": [[x1, x2, ...], [y1, y2, ...]],
      "color": [r, g, b]
    }
  ],
  "metrics": {
    "strokeCount": 5,
    "totalPointCount": 120,
    "averagePointPerStroke": 24.0,
    "colorCount": 2
  }
}
```

- `steps`의 이미지는 base64 인코딩된 PNG 문자열로 반환한다. (`data:image/png;base64,...` prefix 없이 순수 base64만)
- `drawing`은 후처리까지 완료된 최종 Stroke[] 데이터다.

---

## 파이프라인 처리 로직

### Step 1. 이미지 수신 및 원본 저장

- 수신한 이미지를 RGB로 변환
- 원본 base64 PNG 저장 (steps.original)

### Step 2. 배경 제거 (remove_bg=true인 경우)

- `rembg`로 배경 제거 → RGBA 이미지 반환
- base64 PNG 저장 (steps.removed_bg)
- remove_bg=false이면 원본을 그대로 사용

### Step 3. Alpha 마스크 생성

- RGBA 이미지의 alpha 채널 추출
- alpha_threshold 기준으로 이진화 (threshold 이상이면 전경)
- 마스크 이미지 base64 저장 (steps.mask)

### Step 4. Contour 추출

- extract_internal=false (기본): alpha 마스크에서 외곽 contour만 추출
  - `cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)`
- extract_internal=true: Canny edge detection 후 내부선 포함 추출
  - grayscale 변환 → `cv2.Canny(canny_low, canny_high)` → `cv2.findContours(cv2.RETR_LIST, ...)`
- min_contour_area 미만 contour 제거
- contour를 원본 이미지에 overlay한 시각화 저장 (steps.contour_overlay)

### Step 5. Contour 단순화

- 각 contour에 `cv2.approxPolyDP(contour, epsilon=simplify_epsilon, closed=True)` 적용
- min_stroke_length 미만인 contour 제거
- max_stroke_count 초과 시 면적 기준 상위 N개만 유지
- 단순화 결과 overlay 저장 (steps.simplified_overlay)

### Step 6. Stroke 변환 및 후처리

**좌표 정규화:**

- 모든 contour의 bounding box를 구함
- 오브젝트 전체를 padding=10 기준으로 400x400에 중앙 정렬되도록 scale/translate
- 비율 유지 (가로 또는 세로 중 긴 쪽 기준으로 맞춤)

**색상 매핑:**

- 각 contour의 중심점 픽셀 색상을 원본(배경제거 전) 이미지에서 샘플링
- PALETTE_COLORS 중 **LAB 색공간 기준** 유클리드 거리가 가장 가까운 색으로 매핑
  - `cv2.cvtColor`로 RGB → LAB 변환 후 거리 계산
- alpha가 낮은 영역(배경)에서 샘플링된 경우 검정으로 fallback

**Stroke[] 변환:**

- contour의 점 배열을 `[x좌표 배열, y좌표 배열]` 형태로 분리

---

## 프론트엔드 UI 명세

### ImagePipelinePage 레이아웃

```
[ ImagePipelinePanel ]   ← 좌측 or 상단: 이미지 업로드, 파라미터, 실행 버튼

[ PipelineStepViewer ]   ← 각 Step 결과를 순서대로 나열
  Step 1. 원본
  Step 2. 배경 제거 결과
  Step 3. 마스크
  Step 4. contour overlay
  Step 5. 단순화 overlay
  Step 6. 최종 stroke 렌더링 (StrokePreviewCanvas)
  Step 7. JSON 출력 + 복사/다운로드 버튼

[ metrics 표시 ]
  strokeCount / totalPointCount / averagePointPerStroke / colorCount

[ StrokeEditor ]         ← stroke 목록, 삭제/색상 변경
```

### StrokePreviewCanvas

- props: `drawing: Drawing`
- 400x400 canvas에 Stroke[] 렌더링
- 각 stroke의 color를 `rgb(r,g,b)`로 적용
- lineWidth: 2, lineJoin/lineCap: round

### StrokeEditor (Phase 1 최소 구현)

- stroke 목록을 리스트로 표시 (색상 표시, 점 개수 표시)
- 각 stroke에 삭제 버튼
- 각 stroke에 색상 변경 (PALETTE_COLORS 중 선택)
- 수정 시 StrokePreviewCanvas 실시간 반영

### JSON export

- 복사 버튼: `Drawing` JSON을 클립보드에 복사
- 다운로드 버튼: `drawing.json` 파일로 저장

---

## Docker Compose 구성

```yaml
# docker-compose.yml 구성 방향
services:
  frontend:
    build: ./frontend
    ports: ["5173:80"] # nginx로 빌드 결과 서빙
    depends_on: [backend]

  backend:
    build: ./backend
    ports: ["8000:8000"]
    environment:
      - PYTHONUNBUFFERED=1
```

- 프론트에서 백엔드 호출 시 URL은 환경변수로 주입 (`VITE_API_URL`)
- 로컬: `VITE_API_URL=http://localhost:8000`

---

## 구현 시 주의사항

- Phase 2~4 기능(AI SVG, 실험 기록, 외부 배포 설정)은 구현하지 말 것
- 단, 라우터/서비스 파일 구조는 SPEC.md 기준으로 만들어 둘 것 (빈 파일도 무방)
- rembg 최초 실행 시 모델 파일 다운로드가 발생함. Docker 빌드 시 모델을 미리 다운받도록 Dockerfile에 워밍업 커맨드 추가 권장
- contour 하나 = stroke 하나로 변환
