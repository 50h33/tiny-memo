# 미검증 항목의 추가 확인

2026-11-15 한국 시간, 사용자의 추가 검증 요청에 따라 수행했다. 제품 저장 로직은 변경하지 않고
검증 환경과 재현 스크립트, 실행 증거를 추가했다. 정상 동작 테스트 통과와 장애 시 내구성 실패를 구분한다.

## 결과

| 대상 | 실제 결과 | 범위 |
| --- | --- | --- |
| Linux | 통과 | Ubuntu 24.04.3 LTS, WSL2 실제 Linux JVM과 파일 시스템 |
| Firefox | 통과 | Windows의 Playwright Firefox 159.0, 브라우저 시나리오 6개 |
| WebKit | 통과 | Windows의 Playwright WebKit 27.2 엔진, 시나리오 6개. 실제 Safari는 아님 |
| Chrome, Edge | 재검증 통과 | Chrome 157.0.8103.78, Edge 157.0.4341.46, 각각 시나리오 6개 |
| 공간 부족 오류 응답 | 통과 | Linux `/dev/full`에 유한한 PUT, 실제 ENOSPC 쓰기 실패를 HTTP 500으로 반환 |
| 저장 중 프로세스 강제 종료 | 내구성 실패 확인 | 기존 파일이 사라지고 새 내용의 일부만 남음 |
| 실제 전원 차단 | 미검증 | 호스트 전원을 끄거나 사용자 VM을 종료하지 않음. 프로세스 종료와 다른 시험 |
| macOS, 실제 Safari | 미검증 | 연결된 Apple 실행 환경 없음 |
| 원격 GitHub Actions | 미실행 | 원격 브랜치와 workflow 0개. 앞선 원격 push 제외 지시 유지 |

## Linux 실행

Windows와 빌드 파일이 섞이지 않도록 Git bundle을 별도 Linux 파일 시스템의
`/home/wneh2/tiny-memo-linux-verification-20261115/tiny-memo`에 복제했다.
`main`은 `ab69c016962019bf1b599671d154e99d951fe1b1`, 초기 기능 HEAD는
`50d96626b73fb6b553efb3075a73ce70062c01f8`이다. dev-cycle은 동일한
`f6e1e1232976c9bd6f8cda6dd09862fd18aa7a2b`의 별도 Linux 복사본에서 `npm ci`와 빌드를 수행했다.

- Ubuntu 24.04.3, WSL2 kernel `6.6.87.2-microsoft-standard-WSL2`, Git 2.43.0
- Temurin Java 21.0.13, Gradle 9.3.0, Node.js 22.17.0, npm 10.9.2
- `./gradlew build --no-daemon --rerun-tasks --console=plain`: 종료 코드 0, 12개 task 실행
- 실제 CLI dry-run, test, report 순서 실행. 비교 ref `main`, 공통 모듈 변경으로 전체 선택
- Run ID `ad288231-5dfb-45f6-9410-bf646b7f85a1`: 두 test 태스크 `EXECUTED`, XML 2개 `fresh`
- JUnit 테스트 9개, 실패 0, 오류 0, 생략 0, report의 동일 run ID와 수치, `freshness: current`

환경, 전체 로그, JSON과 XML 사본은 `.dev-cycle/verification/linux-20261115-initial/`에 남겼다.
WSL은 실제 Linux 커널 환경이지만 독립 물리 Ubuntu 장비와 동일한 검증이라고 표현하지 않는다.
추가 검증 코드를 커밋한 뒤 Windows와 Linux 모두 `scripts/verify-dev-cycle.cjs`로 최종 커밋을 재검증한다.
이 스크립트는 실제 CLI 실행, 종료 코드, 현재 HEAD와 main, 테스트 수, XML 사본 해시와 report 일치를 검사한다.

## 브라우저 증거

Playwright 1.65.0과 브라우저 바이너리는 저장소 밖에 준비했다. 브라우저 실행별 고유 폴더와
`result.json`, `after-restart.png`, `mobile.png`를 남긴다. 성공 파일은 정리 작업까지 끝난 뒤 쓰며
실패 시에는 해당 실행 폴더에 실패 상태를 남긴다. 테스트 대상은 사용자 메모가 아닌 임시 파일이다.

- Firefox 최종 증거: `.dev-cycle/verification/browser-firefox/2026-11-14T18-40-11-046Z-18936/`
- WebKit 최종 증거: `.dev-cycle/verification/browser-webkit/2026-11-14T18-40-11-046Z-4060/`
- 각각 최초 빈 상태, UTF-8 저장, 새로고침, 덮어쓰기, 다른 Java PID 재시작 후 유지, 빈 저장이 통과했다.
- 페이지 JavaScript 오류는 0개였고, 테스트가 생성한 Java 프로세스는 종료됐다.

[Playwright 문서](https://playwright.dev/docs/browsers)에 따라 WebKit 엔진과 실제 Safari를 구분한다.
Windows WebKit 통과를 macOS나 Safari 통과로 바꾸지 않는다.

## 강제 종료와 공간 부족

`node scripts/storage-crash-probe.cjs`는 빌드된 실제 `MemoStore`를 별도 Java 프로세스에서 호출한다.
64 MiB 새 내용을 저장하는 중 파일 크기 변화를 확인한 뒤 해당 프로세스만 SIGKILL로 종료한다.
사용자 메모나 다른 프로세스는 건드리지 않으며 시험용 파일을 정리한다.

실행 증거는 `.dev-cycle/verification/storage-084b622d-8593-4337-8218-83baf4211242/result.json`이다.

- 기존 파일: 저장이 완료된 한글 메모 34 bytes
- 새 저장 목표: 67,108,864 bytes
- 3,637,248 bytes에서 쓰기 진행을 관찰한 뒤 강제 종료
- 종료 후 3,842,048 bytes만 남음. 이전 메모도 새 메모 전체도 아님
- 새 Java 프로세스의 `MemoStore.read()`가 이 불완전한 내용 3,842,048자를 읽음
- 상태 `observed-data-loss`, `durabilityPassed: false`, probe 종료 코드 1

이는 저장 중 프로세스 중단에 대한 내구성 실패를 확인한 결과다. 일반 JUnit의 9개 통과에 합치지 않는다.
저장 로직을 바꾸지 않은 진단이며, 장애 시에도 이전 또는 새 메모 전체를 보장하려면 별도 수정과 재검증이 필요하다.
실제 전원 장애는 OS 및 디스크 캐시까지 포함하므로 이 시험으로 검증했다고 주장하지 않는다.
[JDK FileChannel 문서](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/nio/channels/FileChannel.html)의
`force`도 전제가 있으며 현재 구현은 해당 내구성 보장을 구현하지 않는다.

Linux에서는 서버의 저장 파일 경로를 `/dev/full`로 지정해 유한한 문자열 PUT을 보냈다.
`GET /dev/full`이나 무한 읽기는 수행하지 않았다. HTTP 500과 `메모를 저장하지 못했습니다.` 응답을
확인했고 서버는 계속 살아 있었다. 증거는 Linux 기록의 `dev-full-result.txt`와 `dev-full-body.txt`다.
이것은 커널의 실제 ENOSPC 오류 처리 검증이며 실제 사용자 디스크를 가득 채우거나 기존 파일 보존을 검증한 결과는 아니다.

## 원격 CI 준비와 남은 승인

`.github/workflows/verify.yml`은 Ubuntu, Windows, macOS 매트릭스와 Java 21, Node 22.17.0,
고정된 dev-cycle 소스를 준비한다. 각 OS에서 같은 실제 CLI 검증 스크립트를 실행하고 증거를 보관한다.
Actions 버전은 GitHub에서 확인한 commit SHA로 고정했으며 권한은 `contents: read`다.
YAML 파싱과 매트릭스 및 권한 설정을 로컬에서 확인했다. 원격 실행 성공을 뜻하지 않는다.

원격에는 `main`도 기능 브랜치도 없고 Actions workflow도 0개다.
[GitHub Actions 문서](https://docs.github.com/en/actions/concepts/workflows-and-actions/workflows)에 따라
원격 ref에 workflow가 있어야 실제 실행이 가능하다. 준비한 변경의 실행에는
`git push origin main feature/memo-save`가 필요하지만, 앞선 사용자 요청에서 push가 제외돼 있어 수행하지 않았다.
PR 게시나 배포는 필요하지 않다. macOS의 Java 테스트가 통과해도 실제 Safari 검증과는 별개다.

이번 기록도 **Codex에서 dev-cycle CLI를 적용한 사례**다. Claude Code 에이전트 실행과
dev-cycle 이슈 #13 전체 검증으로 표현하지 않는다.
