### 프로젝트 목적

게임 서비스에서 사용할 제시 그림 stroke 데이터를 자동/반자동으로 생성하는 실험용 파이프라인 구현

### 프로젝트 계획

- 두 가지 방법을 사용한 스트로크 생성 파이프라인을 구현하고, 결과물 비교
  - 방법 1: 이미지를 input으로 사용해, 해당 이미지를 단순화+포맷팅한 스트로크 데이터 생성
    - 사용할 이미지 업로드 → 배경 제거 및 단순화 → 색상 및 스트로크 데이터 추출 → 후처리
  - 방법 2: AI에게 그림 주제를 주면 알아서 스트로크 데이터를 생성 → 검수
    - AI가 svg 생성 → 스트로크 데이터 추출 → 후처리
- 실험 환경
  - React+vite+ts를 사용한 웹 프로젝트: 웹 인터페이스를 사용해 실험자뿐만 아니라 팀원들도 파이프라인을 이해하고 피드백할 수 있어야 함. 화이트박스로 실험 과정을 시각적으로 보여줄 것
    - 즉 배포까지 이루어져야 함
  - 단, 파이프라인 내 연산은 Python을 사용할 것. 웹은 보여주기/요청 용도
  - FastAPI로 파이썬 서버 띄우고 react에서 fetch하는 방식
- 핵심로직 기술
  - 이미지 배경 제거: rembg
  - 이미지 외곽선 추출: opencv
  - svg 생성 ai: openai

### 공통 사항

프로젝트에서 정의하는 스트로크, 그림 타입 정의

```tsx
type Stroke = {
  points: [number[], number[]];
  color: [number, number, number];
};

type Drawing = Stroke[];
```

- 그림 예시는 promptStrokes.json을 참고.

사용 팔레트 (이 안의 색상만 사용됨)

```tsx
export const PALETTE_COLORS = [
  { name: "검정", hex: "#000000" },
  { name: "빨강", hex: "#EF4444" },
  { name: "파랑", hex: "#3B82F6" },
  { name: "초록", hex: "#22C55E" },
  { name: "노랑", hex: "#EAB308" },
] as const;
```

캔버스 기본 사양

```tsx
canvas: 400 x 400 (단, 스트로크 좌표 데이터는 0~256)
object padding: 10px
center align
scale normalize
```

### 전체 구조

```tsx
입력
├─ 방법 1: 이미지 업로드
│  └─ rembg → OpenCV contour
│
└─ 방법 2: 주제어 입력
   └─ AI SVG 생성 → SVG path parsing

공통 처리
↓
stroke normalize
↓
stroke simplify
↓
color quantization
↓
noise filtering
↓
preview render
↓
manual edit
↓
export JSON
```

프로젝트 구조

```tsx
frontend / src / pages / components / ImagePipelinePanel.tsx;
AiSvgPipelinePanel.tsx;
StrokePreviewCanvas.tsx;
StrokeEditor.tsx;
PipelineStepViewer.tsx;

backend / app / main.py;
routes / image_pipeline.py;
ai_svg_pipeline.py;
services / background_remover.py;
contour_extractor.py;
svg_parser.py;
stroke_simplifier.py;
color_extractor.py;
schemas / stroke.py;
```

### 방법 1. 이미지 기반

- 이미지 업로드 시 전처리: resize, 배경 제거, alpha mask 생성, 색상 단순화
  - 각 stroke 색상은 PALETTE_COLORS 중 가장 가까운(유클리드 거리) 색으로 매핑
- 전처리 이미지에서 edge/contour 추출 → contour simplify → stroke 변환
  - 외곽선 추출 시: 기본 옵션으로는 grayscale/edge detection 결과에서 내부 edge contour도 함께 추출한다.
- 연산 파라미터 옵션
  - 배경 제거 on/off
  - 외곽선만 추출
  - 내부선도 추출
  - 최소 stroke 길이
  - 단순화 강도
  - 색상 수 제한
  - alpha threshold
  - canny threshold low/high
  - min contour area
  - max stroke count
  - simplify epsilon

### 방법 2. AI 생성

- AI는 제시어의 SVG를 생성한다. 직접 스트로크 데이터를 생성하지 않는다.
- fill 미사용. 선으로만 그림. 선은 최소 3개에서 최대 25개

### 관리자 수정

- 생성된 스트로크 후처리를 위한 관리자 수정 페이지가 존재해야 한다.
- 지원하는 기능
  - 스트로크를 캔버스에 렌더링
  - stroke 삭제
  - stroke 색상 변경
  - JSON 복사/다운로드

### 실험 환경

- 화이트박스 테스트처럼, 파이프라인의 각 단계를 `시각적으로 확인`할 수 있어야 한다.
- 아래 Step들을 수행했을 때의 결과를 시각적으로 확인할 수 있도록 하는 화이트박스 실험 UI를 반드시 포함한다.

```tsx
방법 1의 경우:
[입력 이미지 / 주제어]

Step 1. 원본
Step 2. 배경 제거 결과
Step 3. 마스크
Step 4. contour 결과
Step 5. 단순화 결과
Step 6. 최종 stroke 렌더링
Step 7. JSON 출력

방법 2의 경우:
Step 1. 주제어
Step 2. AI 생성 SVG 원문
Step 3. SVG 렌더링
Step 4. path별 stroke 추출
Step 5. points 변환 결과
Step 6. 최종 canvas 렌더링
Step 7. JSON 출력
```

- 두 방법의 결과물 비교를 위한 정량 지표를 아래와 같이 정의한다.

```tsx
{
  strokeCount: number; // 그림의 스트로크 개수
  totalPointCount: number; // 그림의 점 개수
  averagePointPerStroke: number; // 스트로크 당 점 개수 평균
  colorCount: number; // 사용된 색상 개수
}
```

- 방법에 무관하게, 실험을 돌렸다면 기록을 남겨야 한다.
  - 인풋 이미지 또는 키워드, 파라미터, output, 등등 실험에서 생성된 입/출력물들
  - DB는 사용하지 않는다.
    export zip
    - input image
    - params.json
    - output.json
    - preview.png

### 배포

- Docker Compose로 frontend/backend를 함께 실행할 수 있게 구성한다.
- 외부 배포는 Railway를 사용한다.

### 구현 순서

1. 프로젝트 세팅

```tsx
React + Vite + TS frontend, FastAPI backend, Docker Compose 구성.
프론트에서 백엔드 health check를 호출해 연결 상태를 확인할 수 있게 구현.
```

1. 스트로크 미리보기용 캔버스 구현

```tsx
StrokePreviewCanvas 구현:
Stroke[] JSON을 받아 400x400 canvas에 렌더링.
샘플 stroke 데이터로 미리보기 확인.
JSON 복사/다운로드 기능 포함.
```

1. 이미지 업로드 API 개발

```tsx
FastAPI에서 이미지 파일을 받고, 원본/resize 결과를 반환.
프론트에서 업로드 이미지와 결과를 표시.
```

1. 배경 제거, 알파 마스크 기능 개발

```tsx
배경 제거 on/off 옵션.
원본, 배경 제거 결과, alpha mask를 프론트에서 확인 가능하게 반환.
```

1. opencv 외곽선 추출 기능 개발

```tsx
alpha mask 기반 외곽 contour 추출.
min contour area, simplify epsilon 옵션 제공.
contour 결과를 Stroke[]로 변환.
```

1. 공통 후처리

```tsx
normalize, center align, palette color mapping, noise filtering, metrics 계산.
```

1. 간단한 관리자 수정 기능 개발

```tsx
stroke 삭제, stroke 색상 변경, JSON export.
```

1. 방법 2 추가

## 구현 우선순위

본 프로젝트는 한 번에 전체 기능을 구현하지 않고, 단계적으로 구현한다.

### Phase 1. 이미지 기반 파이프라인 MVP

- React + Vite + TS / FastAPI 프로젝트 세팅
- 이미지 업로드
- rembg 배경 제거
- alpha mask 생성
- OpenCV contour 추출
- Stroke[] 변환
- 400x400 canvas preview
- JSON 복사/다운로드
- 각 단계 결과 시각화

### Phase 2. 후처리 및 관리자 수정

- stroke 삭제
- stroke 색상 변경
- simplify 강도 조절
- noise filtering
- metrics 표시

### Phase 3. AI SVG 생성 파이프라인

- 주제어 입력
- OpenAI SVG 생성
- SVG path parsing
- Stroke[] 변환
- 방법 1과 결과 비교

### Phase 4. 실험 기록 및 배포 고도화

- 실험 결과 저장
- 파라미터/output 기록
- Docker 기반 배포
