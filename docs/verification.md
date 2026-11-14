# Codex에서 dev-cycle CLI를 적용한 사례

2026-11-12에 기본 구성, 설치, 구현과 첫 검증을 수행했고 2026-11-15에 작업을 재개해
문서와 커밋을 정리했다. Claude Code 전용 `/dev-cycle`이나 에이전트 실행 결과가 아니다.

## 기준과 환경

| 항목 | 값 |
| --- | --- |
| tiny-memo 초기 `main` | `ab69c016962019bf1b599671d154e99d951fe1b1` |
| 기능 브랜치 | `feature/memo-save` |
| dev-cycle 소스 및 빌드 복사본 | `f6e1e1232976c9bd6f8cda6dd09862fd18aa7a2b` (`docs/12`) |
| OS | Windows NT 10.0.26300, PowerShell |
| 도구 | Java 21.0.6, Gradle 9.3.0, Node.js 22.17.0, npm 10.9.2 |
| 브라우저 검증 | Playwright 1.65.0, Chrome 157.0.8103.50 및 Edge 157.0.4341.46, headless |

초기 `main`에는 Java 소스와 기능 테스트가 없다. 기본 구성과 dev-cycle 설치가 먼저 커밋됐고
기능 코드와 테스트는 이후 브랜치에 추가했다. `git ls-tree -r main`과 `git log main..HEAD`로
이 순서를 확인할 수 있다. 설치 충돌과 해결 과정은 [setup.md](setup.md)에 기록했다.
원본 dev-cycle 작업 트리는 보존했으며 별도 복사본에서 CLI를 빌드했다.

## 실제 파일 및 HTTP 테스트

`MemoStoreTest`의 4개 테스트는 파일이 없는 상태, 저장 후 새 인스턴스로 재읽기,
긴 내용에서 짧은 내용 및 빈 내용으로 덮어쓰기, 한글과 이모지, LF와 CRLF, 공백의 UTF-8 바이트 보존을 확인한다.

`MemoServerTest`의 5개 테스트는 화면과 초기 빈 응답, 저장과 서버 재생성 후 복원 및 덮어쓰기,
지원하지 않는 메서드와 경로, 읽기와 쓰기 I/O 실패의 500 응답, 외부 Host의 403 응답과 원본 파일 보존을 확인한다.
모두 JUnit `@TempDir`의 실제 파일을 사용한다. HTTP 테스트는 임의 loopback 포트에 실제 서버를 띄운다.

`gradlew.bat build --no-daemon --rerun-tasks`가 종료 코드 0으로 끝났으며,
core 4개와 web 5개, 총 9개가 실패 0, 오류 0, 생략 0이었다. 컴파일은 `-Xlint:all -Werror`를 통과했다.
별도 정적 분석 플러그인이나 JavaScript lint 도구는 추가하지 않았다.

## 브라우저에서 확인한 동작

`memo-web/src/test/browser/smoke.cjs`가 실제 브라우저 화면을 조작해 다음 6개 시나리오를 통과했다.

1. 파일이 없는 첫 화면에 빈 입력창 하나와 저장 버튼 하나가 표시된다.
2. 한글, 이모지와 여러 줄 내용을 저장한 뒤 실제 파일의 UTF-8 바이트가 일치한다.
3. 브라우저 새로고침 후 저장한 값이 다시 표시된다.
4. 더 짧은 값으로 덮어쓰며 임시 저장 디렉터리에 메모 파일 하나만 존재한다.
5. Java 프로세스를 종료하고 같은 포트와 파일로 새 프로세스를 띄운 뒤 새로고침해도 내용이 유지된다.
6. 빈 내용을 저장하고 새로고침하면 빈 입력창이 표시된다.

2026-11-12 Chrome 실행에서는 Java PID가 `32584`에서 `21700`으로 바뀌었고 같은 포트 `60675`를 사용했다.
2026-11-15 한국 시간의 Edge 재실행에서는 PID `15932`와 `12372`, 포트 `52574`로 6개 시나리오가
다시 통과했다. Chrome은 재개 후 자동화 시작 직후 종료돼 그 재실행을 실패로 구분하고 Edge를 사용했다.
페이지 JavaScript 오류는 없었다. 1100px 데스크톱 및 390px 모바일 크기의 스크린샷을 확인했고
모바일 가로 넘침도 없었다. 당시 `.dev-cycle/browser/result.json`, `after-restart.png`, `mobile.png`는
Git에서 제외되는 로컬 증거다. 이후 추가 검증부터는 실행별 고유 디렉터리를 사용해 이전 증거도 보존한다.

연결된 브라우저 도구가 응답하지 않아 외부 디렉터리에 Playwright를 준비하고 설치된 Chrome으로
검증했다. 재개 후에는 같은 Playwright로 설치된 Edge도 검증했다.
제품의 Node 의존성이나 별도 브라우저 다운로드는 추가하지 않았다.
브라우저 스크립트는 임시 파일만 쓰며 사용자 데이터 `data/memo.txt`를 만들거나 덮어쓰지 않는다.

## CLI test와 report의 일치 확인

실제 CLI는 `C:\Users\wneh2\Desktop\tiny-memo-tools\dev-cycle\dist\cli.js`다.
[README](../README.md)의 dry-run, test, report 세 명령을 순서대로 실행한다.

첫 구현 검증 run `ff0b52e7-6085-4efd-9e3f-52842bfad6c0`은 다음 결과를 남겼다.

- 비교 ref는 실제 `main`, base commit과 merge-base는 `ab69c016962019bf1b599671d154e99d951fe1b1`이었다.
- `commonModules: ["memo-core"]`에 따라 core 소스와 테스트 변경을 이유로 `all` 모드를 선택했다.
- 선택 모듈은 `memo-core`, `memo-web`, 태스크는 `test`였다.
- 실제 명령은 루트 `gradlew.bat test --console=plain --no-daemon --rerun-tasks`였다.
  CLI가 Windows `cmd.exe /d /s /v:off /c`를 통해 실행했다.
- test CLI와 Gradle 프로세스가 종료 코드 0으로 끝났고 두 모듈의 `test`가 `EXECUTED`였다.
- 두 XML이 `fresh`, 당시 테스트 8개, 실패 0, 오류 0, 생략 0이었다.
- report는 같은 run ID와 수치, `freshness: current`를 반환했다.

그 뒤 리뷰에서 Host 검사를 추가해 테스트가 9개가 됐다. 첫 run은 수정 전의 역사적 기록이며
최종 코드의 검증으로 대신하지 않는다. 코드와 문서를 커밋한 뒤 최종 dry-run, test, report를
다시 실행한다. 최종 결과는 Git에서 제외되는 다음 위치에 보관한다.

- `.dev-cycle/reports/final-dry-run.json`
- `.dev-cycle/reports/final-test.json`
- `.dev-cycle/reports/final-report.json`
- `.dev-cycle/reports/final-report.md`
- `.dev-cycle/runs/<runId>/record.json`, stdout, stderr와 XML 증거 복사본

최종 report의 `run.comparison.head`를 `git rev-parse HEAD`와 대조하고, 두 `test` 태스크의
`EXECUTED`, XML 2개의 `fresh`, 테스트 9개, 실패/오류/생략 0, `freshness.status: current`를
함께 확인한다. 이 기록을 만든 뒤 수정하거나 커밋하면 다시 실행한다. 캐시, 테스트 0개,
report 자체의 종료 코드 0만으로 통과라고 판단하지 않는다.

## 리뷰와 제한

Codex의 독립 읽기 전용 리뷰를 수행했다. 최초 리뷰에는 Must 지적이 없었고,
Host 검증을 추가하자는 Should 1건을 반영했다. 외부 도메인 Host 요청을 거부하는 검사를
추가하고 실제 소켓의 GET과 PUT 요청으로 기존 파일이 보존되는지 확인했다.
후속 리뷰는 Host 지적의 해결을 확인했다. 브라우저 검증이 실패하면 예전 성공 파일이 남을 수 있다는
추가 Should도 반영해, 스크립트 시작 시 자신이 생성하는 결과 JSON과 스크린샷 2개만 지우도록 했다.
잘못된 Playwright 경로로 종료 코드 1을 유도해 이전 성공 증거 세 파일이 남지 않는지 확인했다.
그 뒤 정상 경로와 Edge 채널로 실행해 새 성공 증거를 만들었다.

첫 완료 시점에는 Windows와 Chrome 및 Edge를 검증했다. 사용자의 추가 요청으로
Linux, Firefox, WebKit 엔진, 강제 종료와 ENOSPC 오류를 확인한 결과는
[추가 검증 기록](additional-verification.md)에 구분해 남겼다. macOS, 실제 Safari와 원격 CI는
실행 환경 또는 원격 push 승인 없이는 통과했다고 표시하지 않는다. 직접 파일 덮어쓰기는 원자성을
보장하지 않으며, 실제 강제 종료 시험에서 불완전한 파일이 남았다.

로그인, 목록, 검색, 삭제 API, DB, 배포는 구현 범위 밖이다. 원격 push, PR 게시와 배포는
수행하지 않았다. **dev-cycle 이슈 #13 전체 검증 또는 Claude Code 에이전트 검증을 완료한 사례가 아니다.**
