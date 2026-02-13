# 앱 아이콘 도구

하나의 기본 아이콘으로 플랫폼별 앱 아이콘을 생성하는 도구입니다.

## 개요

**generate-app-icons** 도구는 단일 기본 아이콘(`icon.png`)으로부터 필요한 모든 아이콘 변형을 생성합니다:

1. **iOS 앱 아이콘** (1024x1024) - 로고가 890px 원 안에 위치
2. **Android 적응형 아이콘** (1024x1024) - 로고가 475px 원 안에 위치
3. **스플래시 화면 아이콘** (1024x1024) - 로고가 614px 원 안에 위치
4. **Android 알림 아이콘** (500x500) - 투명 배경의 흰색 로고

## 워크플로우

```
1. 기본 아이콘을 {app-slug}/icons/icon.png에 배치
2. generate-app-icons 실행 → 모든 플랫폼별 아이콘 생성
```

### 디렉토리 구조

```
public/products/{app-slug}/icons/
├── icon.png                          # 기본 소스 아이콘
├── ios-light.png                     # iOS 앱 아이콘 (1024x1024)
├── adaptive-icon.png                 # Android 적응형 아이콘 (1024x1024)
├── splash-icon-light.png             # 스플래시 화면 아이콘 (1024x1024)
└── android-notification-icon.png     # 알림 아이콘 (500x500, 흰색)
```

## generate-app-icons

기본 아이콘으로부터 플랫폼별 앱 아이콘을 생성합니다.

### 요구사항

- 기본 아이콘: `public/products/{slug}/icons/icon.png`
- **알림 아이콘 생성 시**: `GEMINI_API_KEY` 또는 `GOOGLE_API_KEY` 환경 변수 필요

### 입력 파라미터

| 파라미터        | 타입                                                                                | 필수 | 기본값        | 설명                                |
| --------------- | ----------------------------------------------------------------------------------- | ---- | ------------- | ----------------------------------- |
| appName         | string                                                                              | 예   | -             | 앱 이름, slug, bundleId, packageName |
| iconTypes       | ("ios-light" \| "adaptive-icon" \| "splash-icon-light" \| "android-notification")[] | 아니오 | 모든 타입     | 생성할 특정 아이콘 타입              |
| backgroundColor | string                                                                              | 아니오 | "transparent" | 배경색 (hex 또는 "transparent")      |
| logoPosition    | string                                                                              | 아니오 | -             | Gemini API용 위치 힌트               |
| skipExisting    | boolean                                                                             | 아니오 | false         | 출력 파일이 이미 있으면 건너뛰기     |
| dryRun          | boolean                                                                             | 아니오 | false         | 실제 생성 없이 미리보기              |

### 아이콘 사양

#### 1. iOS 라이트 아이콘 (`ios-light.png`)

- **크기**: 1024x1024px
- **세이프 존**: 로고가 890px 직경 원(445px 반지름) 안에 위치
- **배경**: 설정 가능 (투명 또는 커스텀 색상)
- **사용처**: iOS App Store 아이콘

#### 2. Android 적응형 아이콘 (`adaptive-icon.png`)

- **크기**: 1024x1024px
- **세이프 존**: 로고가 475px 직경 원(237.5px 반지름) 안에 위치
- **배경**: 설정 가능 (투명 또는 커스텀 색상)
- **사용처**: Android 런처 아이콘(적응형)

#### 3. 스플래시 아이콘 라이트 (`splash-icon-light.png`)

- **크기**: 1024x1024px
- **세이프 존**: 로고가 614px 직경 원(307px 반지름) 안에 위치
- **배경**: 설정 가능 (투명 또는 커스텀 색상)
- **사용처**: 앱 스플래시 화면 아이콘

#### 4. Android 알림 아이콘 (`android-notification-icon.png`)

- **크기**: 500x500px
- **스타일**: 투명 배경의 흰색 로고
- **배경**: 항상 투명
- **사용처**: Android 상태바 알림 아이콘
- **참고**: Gemini API를 사용하여 지능적으로 흰색 마스킹 처리

### 사용 예제

#### 투명 배경으로 모든 아이콘 생성

```json
{
  "appName": "my-app"
}
```

#### 흰색 배경으로 특정 아이콘만 생성

```json
{
  "appName": "my-app",
  "iconTypes": ["ios-light", "adaptive-icon"],
  "backgroundColor": "#FFFFFF"
}
```

#### 알림 아이콘의 커스텀 로고 위치 지정

```json
{
  "appName": "my-app",
  "iconTypes": ["android-notification-icon"],
  "logoPosition": "중앙에 위치하되 상단을 약간 강조"
}
```

## 세이프 존 가이드라인

세이프 존은 다양한 플랫폼 아이콘 처리에서 로고가 보이도록 보장합니다:

| 아이콘 타입     | 세이프 존 직경 | 이유                              |
| --------------- | -------------- | --------------------------------- |
| iOS 라이트      | 890px (87%)    | iOS는 모서리를 둥글게 하고 마스크 적용 |
| 적응형 아이콘   | 475px (46%)    | Android는 다양한 모양으로 클리핑   |
| 스플래시 아이콘 | 614px (60%)    | 스플래시 화면에 균형잡힌 가시성    |

**권장사항**: 기본 `icon.png`를 디자인할 때 중요한 로고 요소가 가장 작은 세이프 존(적응형 아이콘의 475px) 안에 들어가도록 합니다.

## 배경색

### 투명 배경 사용 (기본값)

```json
{
  "appName": "my-app",
  "backgroundColor": "transparent"
}
```

### 커스텀 색상 사용

```json
{
  "appName": "my-app",
  "backgroundColor": "#000000"
}
```

**참고**: `android-notification-icon`은 이 설정과 관계없이 항상 투명 배경을 사용합니다.

## AI 기반 흰색 마스킹

알림 아이콘 생성은 Gemini API를 사용하여 로고의 모양과 디테일을 유지하면서 지능적으로 흰색으로 변환합니다:

- 정확한 로고 모양과 윤곽 유지
- 모든 로고 픽셀을 순수 흰색(#FFFFFF)으로 변환
- 배경을 완전히 투명하게 만듦
- 로고 위치 힌트 반영

### 로고 위치 힌트

AI를 가이드할 자연어 힌트 제공:

- `"중앙"` - 로고를 완벽하게 중앙에 배치
- `"중앙보다 약간 위"` - 로고를 더 높게 배치
- `"브랜드 텍스트 강조"` - 텍스트 요소에 초점

## 팁 및 모범 사례

### 기본 아이콘 디자인

1. **단순성**: 작은 크기에서 인식 가능한 단순한 디자인
2. **대비**: 로고와 배경 간 좋은 대비 확보
3. **세이프 존**: 중요한 요소를 475px 원 안에 배치
4. **고해상도**: 벡터 그래픽 또는 고해상도 PNG(2048x2048+) 사용

### 색상 선택

- **투명**: 뚜렷한 형태의 로고에 가장 적합
- **브랜드 색상**: 앱의 브랜드 아이덴티티와 일치
- **흰색/검은색**: 클래식하며 대부분의 디자인과 잘 어울림

### 파일 구조

```
icons/
├── icon.png              # 소스 (고품질)
├── ios-light.png         # 생성됨
├── adaptive-icon.png     # 생성됨
├── splash-icon-light.png # 생성됨
└── android-notification-icon.png # 생성됨
```

`icon.png`는 버전 관리에 포함하되, 자주 재생성하는 경우 생성된 파일은 `.gitignore`를 고려하세요.

## 일반적인 문제

### 문제: 적응형 아이콘에서 로고가 너무 작게 보임

**해결**: 적응형 아이콘은 가장 작은 세이프 존(475px)을 가집니다. 로고가 이 크기에서 읽을 수 있는지 확인하세요.

### 문제: 알림 아이콘에 원치 않는 요소가 포함됨

**해결**: `logoPosition` 파라미터를 사용하여 AI를 가이드하거나, 생성 전에 `icon.png`를 편집하여 디자인을 단순화하세요.

### 문제: 배경색이 적용되지 않음

**해결**: `backgroundColor`가 유효한 hex 색상(예: `"#FFFFFF"`) 또는 `"transparent"`인지 확인하세요. 알림 아이콘은 항상 투명 배경을 사용합니다.
