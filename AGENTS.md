# tiny-memo 작업 지침

- Java 21, Groovy Gradle과 루트 Wrapper를 사용한다.
- `memo-core`는 파일 저장, `memo-web`은 HTTP와 화면을 담당한다. 웹 모듈만 core에 의존한다.
- 기능 범위는 로컬 파일에 메모 하나 저장하기다. 로그인, 목록, 검색, 삭제 API, DB, 배포는 추가하지 않는다.
- 기존 변경을 보존하고 조사, 계획, 구현, 테스트, 리뷰 순서로 작업한다.
- 초기 기본 구성과 dev-cycle 설치만 `main`에 커밋한다. 기능은 `main`에서 만든 `feature/memo-save`에서 개발한다.
- 커밋 메시지는 `Chore:`, `Feat:`, `Fix:`, `Docs:` 중 해당 접두사를 쓴다.
- 명확한 로컬 변경과 커밋은 진행한다. 원격 push, 이슈나 PR 게시, 배포는 이번 작업 범위 밖이다.
- `./gradlew.bat build`로 컴파일 경고 검사와 테스트를 실행한다. Unix에서는 `./gradlew`를 사용한다.
- 표준 `test` 태스크와 기본 `build/test-results/test/*.xml` 경로를 유지한다. 테스트는 임시 디렉터리의 실제 파일을 사용한다.
- dev-cycle 명령과 실제 CLI 경로는 `README.md`를 따른다. 최종 커밋 후 CLI test와 report를 다시 실행한다.
- 캐시, 테스트 0개, report 생성 성공을 테스트 통과로 표현하지 않는다.
- Codex에서는 설치된 Claude Code 명령이나 에이전트가 실행됐다고 주장하지 않는다.
