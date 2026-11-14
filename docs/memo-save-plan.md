# 메모 한 개 저장: 조사와 계획

## 조사

- tiny-memo의 초기 기준 커밋은 `ab69c016962019bf1b599671d154e99d951fe1b1`이다.
  이 커밋에는 모듈 구성과 dev-cycle 설치가 있고 Java 기능 코드와 테스트는 없다.
- dev-cycle 소스 기준은 `f6e1e1232976c9bd6f8cda6dd09862fd18aa7a2b`다.
- 설치된 [워크플로](dev-cycle-workflow.md), `.claude/commands/dev-cycle.md`와
  `.claude/commands/test.md`의 조사, 계획, 구현, 테스트, 리뷰 순서를 Codex에서 적용한다.
  Claude Code slash command나 에이전트를 실행하는 것은 아니다.
- [Gradle 9.3.0](https://docs.gradle.org/9.3.0/release-notes.html)과
  [Java 호환성](https://docs.gradle.org/current/userguide/compatibility.html)을 확인했다.
- [JUnit 6.0.3](https://docs.junit.org/6.0.3/_exports/junit-user-guide-6.0.3.pdf)의
  Jupiter와 launcher를 사용하며 `useJUnitPlatform()`과 기본 XML 경로를 유지한다.
- [JDK 21 HttpServer](https://docs.oracle.com/en/java/javase/21/docs/api/jdk.httpserver/com/sun/net/httpserver/HttpServer.html)는
  별도 런타임 라이브러리 없이 HTTP를 제공한다. 경로 prefix 매칭에 의존하지 않고 정확한 경로를 검사한다.

## 구현 계획

1. `memo-core/.../MemoStore.java`: 지정한 파일의 UTF-8 읽기와 전체 덮어쓰기.
   파일이 없을 때만 빈 문자열을 반환하고 다른 I/O 오류는 호출자에게 전달한다.
2. `memo-web/.../MemoServer.java`, `MemoApplication.java`: loopback에 바인딩한다.
   `GET /`은 HTML, `GET /api/memo`는 원문, `PUT /api/memo`는 저장 후 204를 반환한다.
   브라우저 캐시를 막고 파일 오류는 500으로 표시한다.
3. `memo-web/src/main/resources/index.html`: 텍스트 입력창 하나와 저장 버튼 하나.
   초기 불러오기가 끝나기 전 저장을 막고, 저장 성공과 실패를 구분해 표시한다.
4. 각 모듈의 표준 `src/test/java`에 JUnit 테스트를 작성한다. `@TempDir`의 실제 파일과
   임의 loopback 포트를 사용해 사용자 메모와 다른 실행에 영향을 주지 않는다.
5. CLI dry-run, test, report를 실행하고 새 XML 수치와 실제 Gradle task 결과를 대조한다.
   브라우저에서 저장, 새로고침, 실제 Java 프로세스 종료와 재시작 후 복원을 별도로 확인한다.
6. Codex의 독립 코드 리뷰를 반영하고 실행 문서와 검증 기록을 정리한다.
   로컬 커밋을 끝낸 다음 최종 CLI dry-run, test, report를 순서대로 재실행한다.

## 경계와 위험

로그인, 메모 목록, 검색, 삭제 API, DB, 배포를 추가하지 않는다. 단일 로컬 사용자를 위한 MVP다.
동시에 저장하면 마지막 요청이 덮어쓴다. 디스크 오류와 실패한 HTTP 응답을 성공으로 표시하지 않는다.
직접 덮어쓰기는 프로세스 강제 종료나 전원 장애 중 원자성을 보장하지 않는다.
롤백은 기능 브랜치의 변경을 되돌리는 방식으로 하며 실제 메모 데이터는 Git에 넣지 않는다.
