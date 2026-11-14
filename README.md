# tiny-memo

메모 한 개를 UTF-8 로컬 파일에 저장하는 작은 웹 메모장 프로젝트다.

## 실행

Java 21을 설치한 뒤 저장소 루트에서 실행한다. Gradle은 루트 Wrapper로 준비된다.

```powershell
.\gradlew.bat :memo-web:run
```

브라우저에서 **http://127.0.0.1:8080** 을 연다. 입력창에 내용을 쓰고 **저장**을 누르면
저장소 루트의 `data/memo.txt` 한 파일을 UTF-8로 덮어쓴다. 저장 파일이 없으면 빈 입력창이
표시되고, 저장한 내용은 새로고침하거나 서버를 종료한 뒤 같은 명령으로 다시 실행해도 유지된다.
빈 내용도 저장할 수 있다. 입력만 하고 저장하지 않은 내용은 유지되지 않는다.

종료는 터미널에서 `Ctrl+C`를 누른다. 포트와 저장 파일은 필요할 때 지정할 수 있다.

```powershell
.\gradlew.bat :memo-web:run --args="8081 data/other-memo.txt"
```

상대 파일 경로는 Gradle run 명령에서 저장소 루트를 기준으로 한다. 서버는 `127.0.0.1`에만
바인딩한다. 로그인, 메모 목록, 검색, 별도 삭제 기능, DB와 배포는 포함하지 않는다.

## 구성과 테스트

- Java 21, Gradle Wrapper 9.3.0, Groovy DSL
- `memo-core`: 메모 저장 로직 모듈
- `memo-web`: core에 의존하는 HTTP 및 화면 모듈
- JUnit 6.0.3, 표준 `test` 태스크와 기본 XML 결과 경로

초기 `main` 기준 커밋 `ab69c01`은 모듈 구성과 dev-cycle 설치만 포함한다.
메모 기능은 그 커밋에서 만든 `feature/memo-save` 브랜치에서 구현했다.

```powershell
.\gradlew.bat build --no-daemon --rerun-tasks
```

Java 컴파일 시 `-Xlint:all -Werror`를 적용한다. JUnit 테스트 9개는 임시 디렉터리의 실제
파일과 loopback HTTP를 사용하며, 사용자 메모를 건드리지 않는다. 결과는 각 모듈의
`build/test-results/test/*.xml`에 생성된다. 기본 구성 단계의 `NO-SOURCE`는 테스트 통과로 집계하지 않는다.

별도 브라우저 검증은 저장, 새로고침과 실제 Java 프로세스 재시작을 포함한다.
Node.js와 브라우저, 외부 Playwright 패키지가 필요하다. 이 환경에서는 다음 명령으로 재현한다.
Playwright는 앱의 런타임 의존성이 아니다.

```powershell
npm install --prefix "C:\Users\wneh2\Desktop\tiny-memo-tools\browser-check" --no-audit --no-fund playwright@1.65.0
node memo-web/src/test/browser/smoke.cjs "C:\Users\wneh2\Desktop\tiny-memo-tools\browser-check\node_modules\playwright" msedge
```

마지막 인자는 `chrome`, `msedge`, `firefox`, `webkit`이다. 생략하면 Chrome을 사용한다.
Firefox와 WebKit 엔진은 다음처럼 저장소 밖에 설치하고 실행한다.

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = 'C:\Users\wneh2\Desktop\tiny-memo-tools\playwright-browsers-1.65.0'
node 'C:\Users\wneh2\Desktop\tiny-memo-tools\browser-check\node_modules\playwright\cli.js' install firefox webkit
node memo-web/src/test/browser/smoke.cjs 'C:\Users\wneh2\Desktop\tiny-memo-tools\browser-check\node_modules\playwright' firefox
node memo-web/src/test/browser/smoke.cjs 'C:\Users\wneh2\Desktop\tiny-memo-tools\browser-check\node_modules\playwright' webkit
```

Windows의 Playwright WebKit 결과는 실제 Safari나 macOS 검증을 뜻하지 않는다.
이 스크립트는 임시 메모 파일을 만들고 검증 후 서버와 파일을 정리한다. JSON 결과와 데스크톱 및
모바일 크기의 스크린샷은 `.dev-cycle/verification/browser-<대상>/<실행 ID>/`에 남는다.
실행별 경로를 분리하고 성공 및 실패를 기록한다. 브라우저 검증은 Gradle test 및 CLI report의
JUnit 개수에 포함되지 않는다. 다른 컴퓨터에서는 위 외부 경로를 실제 위치로 바꾼다.

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

[설치 기록](docs/setup.md), [조사와 계획](docs/memo-save-plan.md),
[검증 기록과 제한](docs/verification.md), [추가 검증 결과](docs/additional-verification.md)에 순서와 근거를 남겼다.

## 추가 검증

`scripts/verify-dev-cycle.cjs`는 위의 CLI 세 명령을 실행하고 실제 테스트, XML 증거 사본과
report가 일치하는지 검사한다. 준비한 CI도 같은 스크립트를 사용한다.

```powershell
node scripts/verify-dev-cycle.cjs 'C:\Users\wneh2\Desktop\tiny-memo-tools\dev-cycle\dist\cli.js'
node scripts/storage-crash-probe.cjs
```

두 번째 명령은 임시 파일에 64 MiB 저장을 시작한 뒤 해당 Java 프로세스만 강제 종료하는 장애 시험이다.
종료 코드 1은 관찰된 데이터 손실, 2는 결론을 낼 수 없는 실행이다. 일반 테스트 통과 수에 포함하지 않는다.
현재 구현에서는 저장 중 강제 종료하면 이전 메모와 새 메모 모두 온전히 남지 않을 수 있음이 실제로 확인됐다.

`.github/workflows/verify.yml`은 Ubuntu, Windows, macOS에서 실제 Gradle 및 dev-cycle을 검증한다.
사용자의 후속 push 승인으로 `main`과 `feature/memo-save`를 게시했고,
[첫 원격 CI](https://github.com/50h33/tiny-memo/actions/runs/43628868487)에서 세 OS가 각각
테스트 9개, 실패 0개와 report `current`를 확인했다. 새 커밋의 상태는 해당 HEAD의 Actions 결과를 확인한다.
macOS의 Java 및 HTTP 테스트 통과는 실제 Safari 검증을 뜻하지 않는다.
