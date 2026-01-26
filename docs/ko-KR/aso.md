# ASO 툴

앱 스토어 최적화(ASO) 데이터 관리 툴.

## 툴 목록

### aso-to-public (pull)

`.aso/pullData/`의 ASO 데이터를 `public/products/[slug]/` 형식으로 변환.

**입력:**
- `slug` (필수): 제품 슬러그
- `locale` (선택): 대상 로케일 (기본값: 모든 로케일)

**출력:**
- 로케일별 변환 프롬프트
- 웹 사용을 위한 구조화된 데이터

---

### public-to-aso (push)

`public/products/[slug]/` 데이터를 `.aso/pushData/` ASO 형식으로 변환.

**입력:**
- `slug` (필수): 제품 슬러그
- `dryRun` (선택): 파일 쓰기 없이 미리보기
- `locales` (선택): 처리할 특정 로케일

**출력:**
- 스토어 업로드용 ASO 데이터
- 업로드용 스크린샷 경로

---

### improve-public

기존 퍼블릭 데이터에 대한 ASO 최적화 프롬프트 생성.

**입력:**
- `slug` (필수): 제품 슬러그
- `locale` (선택): 최적화 대상 로케일
- `mode` (선택): `primary` (키워드 최적화) 또는 `localize` (번역)

**출력:**
- 키워드 분석
- 최적화 제안
- 현지화 프롬프트

---

### validate-aso

스토어 필드 제한 및 규칙에 대한 ASO 데이터 검증.

**입력:**
- `slug` (필수): 제품 슬러그
- `store` (선택): `appStore`, `googlePlay`, 또는 `both`

**출력:**
- 필드 길이 검증
- 키워드 고유성 검사
- 정책 준수 경고

---

### keyword-research

ASO 최적화를 위한 키워드 리서치 데이터 관리.

**입력:**
- `slug` (필수): 제품 슬러그
- `locale` (필수): 대상 로케일
- `platform` (선택): `ios` 또는 `android`

**출력:**
- 키워드 리서치 파일 경로
- 분석용 리서치 프롬프트

---

### localize-screenshots

Gemini API (gemini-3-pro-image-preview)를 사용하여 앱 스크린샷을 여러 언어로 번역.

**요구사항:**
- Gemini API 키 설정 필요 ([설정 방법](#gemini-api-설정) 참조)
- 스크린샷이 `public/products/{slug}/screenshots/{locale}/phone/` 및/또는 `tablet/`에 있어야 함

**입력:**
- `appName` (필수): 앱 이름, 슬러그, bundleId 또는 packageName
- `targetLocales` (선택): 번역할 특정 로케일 (기본값: 지원하는 모든 로케일)
- `deviceTypes` (선택): `phone`, `tablet` 또는 둘 다 (기본값: 둘 다)
- `dryRun` (선택): 실제 번역 없이 미리보기 모드
- `skipExisting` (선택): 번역된 파일이 있으면 건너뛰기 (기본값: true)

**출력:**
- 번역된 스크린샷을 `screenshots/{targetLocale}/phone/` 및 `tablet/`에 저장
- 이미지를 소스 크기에 맞게 자동 리사이징

**예시:**
```
screenshots/
├── en-US/           # 소스 (기본 로케일)
│   ├── phone/
│   │   ├── 1.png
│   │   └── 2.png
│   └── tablet/
│       └── 1.png
├── ko-KR/           # 생성됨
│   ├── phone/
│   │   ├── 1.png
│   │   └── 2.png
│   └── tablet/
│       └── 1.png
└── ja-JP/           # 생성됨
    └── ...
```

---

## Gemini API 설정

`localize-screenshots` 툴은 Gemini API 키가 필요합니다.

### Gemini API 키 발급

1. [Google AI Studio](https://aistudio.google.com/apikey)에 접속
2. Google 계정으로 로그인
3. "Create API Key" 클릭
4. 생성된 API 키 복사
5. **중요**: [Google Cloud Console](https://console.cloud.google.com/billing)에서 결제 계정을 연결해야 Imagen API 사용 가능

### 설정 방법

`~/.config/pabal-mcp/config.json`에 추가:

```json
{
  "dataDir": "/path/to/your/project",
  "gemini": {
    "apiKey": "your-gemini-api-key"
  }
}
```

또는 `GEMINI_API_KEY` 환경변수를 설정해도 됩니다.

---

## 필드 제한 참조

### Apple App Store
| 필드 | 제한 |
|------|------|
| 앱 이름 | ≤30자 |
| 부제목 | ≤30자 |
| 키워드 | ≤100자 |
| 프로모션 텍스트 | ≤170자 |
| 설명 | ≤4000자 |
| 새로운 기능 | ≤4000자 |

### Google Play
| 필드 | 제한 |
|------|------|
| 제목 | ≤50자 (≤30자 권장) |
| 간단한 설명 | ≤80자 |
| 전체 설명 | ≤4000자 |
| 출시 노트 | ≤500자 |
