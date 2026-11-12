# tiny-memo

메모 한 개를 UTF-8 로컬 파일에 저장하는 작은 웹 메모장 프로젝트다.

## 기본 구성

- Java 21, Gradle Wrapper 9.3.0, Groovy DSL
- `memo-core`: 메모 저장 로직 모듈
- `memo-web`: core에 의존하는 HTTP 및 화면 모듈
- JUnit 6.0.3, 표준 `test` 태스크와 기본 XML 결과 경로

초기 기준 커밋은 모듈 구성과 dev-cycle 설치만 포함한다. 메모 기능과 테스트는 기능 브랜치에서 구현한다.

```powershell
.\gradlew.bat build
```

기본 구성 단계의 `NO-SOURCE`는 기능 테스트 통과가 아니다. 기능 구현 후 실행 명령은
`.\gradlew.bat :memo-web:run`이며 브라우저 주소와 저장 위치를 이 문서에 추가한다.

## dev-cycle CLI

Node.js 22.17.0 이상 22 계열과 npm 10 이상이 필요하다. 이 환경의 빌드된 CLI는
`C:\Users\wneh2\Desktop\tiny-memo-tools\dev-cycle\dist\cli.js`다.

```powershell
node "C:\Users\wneh2\Desktop\tiny-memo-tools\dev-cycle\dist\cli.js" test "C:\Users\wneh2\Desktop\tiny-memo" --dry-run --json
node "C:\Users\wneh2\Desktop\tiny-memo-tools\dev-cycle\dist\cli.js" test "C:\Users\wneh2\Desktop\tiny-memo" --json
node "C:\Users\wneh2\Desktop\tiny-memo-tools\dev-cycle\dist\cli.js" report "C:\Users\wneh2\Desktop\tiny-memo" --json
```

비교 기준은 실제 로컬 `main`이다. `memo-core` 변경은 전체 테스트로 확대된다.
`--rerun-tasks`로 새 테스트 실행을 확보한다. 실행 기록은 Git에서 제외되는 `.dev-cycle/`에 남는다.
최종 커밋 후 test와 report를 실행하고 `succeeded`, 실제 XML 테스트 수, `freshness: current`를 함께 확인한다.

이 저장소의 작업은 **Codex에서 dev-cycle CLI를 적용한 사례**다. Claude Code 전용 명령이나
에이전트 실행, dev-cycle 이슈 #13 전체 검증을 의미하지 않는다.
