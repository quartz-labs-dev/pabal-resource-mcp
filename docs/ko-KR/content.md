# Content 툴

콘텐츠 생성 툴.

## 툴 목록

### create-blog-html

`BLOG_META` 블록이 포함된 정적 HTML 블로그 포스트를 생성합니다.

**입력:**
- `appSlug` (선택): 블로그 카테고리/앱 슬러그. 기본값은 `developer-journal`.
  - 일상/저널 글은 `developer-journal`
  - 기술 글은 `developer-tech`
- `topic` (필수): 글의 주제/각도
- `locale` (필수): 대상 로케일 (예: `en-US`, `ko-KR`)
- `content` (필수): HTML 본문
- `description` (필수): 메타 설명
- `title` (선택): 슬러그 생성용 영어 제목
- `locales` (선택): 다중 로케일 동시 생성
- `coverImage` (선택): 상대 경로는 `/blogs/<app>/<slug>/...`로 재작성
- `publishedAt`, `modifiedAt` (선택): `YYYY-MM-DD`
- `overwrite` (선택): 기존 파일 덮어쓰기 여부

**출력:**
- 생성된 HTML 파일 경로 목록
- 최종 슬러그
- 로케일별 BLOG_META

**참고:**
- 출력 경로: `public/blogs/<appSlug>/<slug>/<locale>.html`
- 기본 커버 이미지:
  - `developer-journal`, `developer-tech` -> `/og-image.png`
  - 그 외 앱 슬러그 -> `/products/<appSlug>/og-image.png`
