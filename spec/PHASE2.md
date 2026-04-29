# Phase 2 구현 지시서 — 후처리 및 관리자 수정

> 전체 설계는 SPEC.md, Phase 1 구현은 PHASE1.md 참고.
> **Phase 3~4는 구현하지 말 것. Phase 1에서 구현한 코드를 최대한 재사용할 것.**

---

## 구현 범위

- 파이프라인 후처리 고도화: simplify 강도 조절, noise filtering
- 관리자 수정 페이지 고도화: stroke 삭제/색상 변경 (Phase 1에서 최소 구현된 것을 완성)
- metrics 표시
- 실험 기록 export (zip)

---

## 후처리 고도화

Phase 1에서 구현된 `/pipeline/image` API에 아래 처리를 추가한다.

### Noise filtering

기존 `min_contour_area`, `min_stroke_length` 파라미터 외에 추가:

| 파라미터         | 타입  | 기본값 | 설명                               |
| ---------------- | ----- | ------ | ---------------------------------- |
| max_stroke_count | int   | 30     | 이미 있음. 면적 기준 상위 N개 유지 |
| simplify_epsilon | float | 2.0    | 이미 있음. 단순화 강도             |

파라미터는 Phase 1과 동일하게 유지하되, 프론트엔드에서 **슬라이더 UI**로 실시간 조절할 수 있게 한다. 파라미터 변경 시 자동으로 재요청하지 않고, 명시적인 "재실행" 버튼으로 요청한다.

### Simplify 강도 조절

Phase 1에서 `simplify_epsilon`은 입력받고 있었지만 프론트에서 고정값이었을 수 있음. Phase 2에서는 슬라이더로 0.5~10.0 범위를 조절할 수 있게 한다.

---

## 관리자 수정 기능 완성

Phase 1에서 최소 구현된 `StrokeEditor`를 완성한다.

### 기능 목록

- 전체 초기화 (원본 pipeline 결과로 되돌리기) 버튼

---

## Metrics 표시

Phase 1 API 응답의 `metrics` 필드를 활용해 프론트에서 표시한다.

```ts
{
  strokeCount: number;
  totalPointCount: number;
  averagePointPerStroke: number;
  colorCount: number;
}
```

StrokeEditor에서 stroke를 삭제/수정하면 metrics를 프론트에서 실시간으로 재계산해 표시한다. (API 재호출 없이 클라이언트에서 계산)

---

## 실험 기록 Export (zip)

"실험 저장" 버튼을 누르면 아래 구성의 zip 파일을 다운로드한다.

```
experiment_<timestamp>/
  input_image.png       ← 업로드한 원본 이미지
  params.json           ← 사용한 파라미터 전체
  output.json           ← 최종 Drawing (관리자 수정 반영)
  preview.png           ← StrokePreviewCanvas 렌더링 결과
```

### 구현 방식

- zip 생성은 **프론트엔드**에서 처리한다. (`JSZip` 라이브러리 사용)
- `preview.png`는 canvas의 `toDataURL()`로 추출
- 백엔드 API 추가 없이 클라이언트에서 완결

### params.json 형식

```json
{
  "timestamp": "2024-01-01T00:00:00Z",
  "method": "image",
  "input_filename": "apple.png",
  "params": {
    "remove_bg": true,
    "extract_internal": false,
    "alpha_threshold": 128,
    "canny_low": 50,
    "canny_high": 150,
    "min_contour_area": 100,
    "simplify_epsilon": 2.0,
    "max_stroke_count": 30,
    "min_stroke_length": 3
  }
}
```

---

## 프론트엔드 변경 사항 요약

| 컴포넌트              | Phase 1 상태                    | Phase 2 변경                   |
| --------------------- | ------------------------------- | ------------------------------ |
| `ImagePipelinePanel`  | 파라미터 입력 (텍스트/체크박스) | simplify_epsilon 슬라이더 추가 |
| `StrokeEditor`        | 삭제/색상 변경 최소 구현        | 초기화 버튼                    |
| `PipelineStepViewer`  | Step별 이미지 표시              | 변경 없음                      |
| `StrokePreviewCanvas` | 렌더링                          | 변경 없음                      |
| metrics 표시          | 없음                            | 신규 추가                      |
| 실험 저장 버튼        | 없음                            | 신규 추가 (zip export)         |

---

## 구현 시 주의사항

- zip export는 백엔드 없이 프론트에서 완결할 것 (`JSZip` 사용)
- metrics는 API 재호출 없이 클라이언트에서 실시간 계산
- Phase 1 API(`/pipeline/image`) 스펙은 변경하지 않음. 파라미터 추가만 허용
- Phase 3(AI SVG 파이프라인)은 구현하지 말 것
