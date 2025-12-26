# Apps 툴

앱 및 프로젝트 관리 툴.

## 툴 목록

### init-project

프로젝트 초기 설정 워크플로우 가이드.

**입력:**
- `slug` (선택): 집중할 제품 슬러그

**출력:**
- 설정 체크리스트
- 초기화에 필요한 단계
- 변환 워크플로우 가이드

**워크플로우:**
1. `pabal-mcp init` 실행 확인
2. `.aso/pullData/products/[slug]/` 존재 확인
3. ASO 데이터를 퍼블릭 형식으로 변환
4. 출력 검증

---

### search-app

설정에서 등록된 앱 검색.

**입력:**
- `query` (선택): 검색어 (slug, bundleId, packageName, name)
- `store` (선택): `appStore`, `googlePlay`, 또는 `all`로 필터링

**출력:**
- 일치하는 앱 목록 및 상세 정보
- Bundle ID 및 패키지 이름
- 지원 로케일

**사용법:**
- 쿼리 없이: 등록된 모든 앱 반환
- 쿼리 있음: slug, bundleId, packageName, name으로 필터링
