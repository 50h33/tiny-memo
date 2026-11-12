# 초기 구성과 dev-cycle 설치 기록

2026-11-12, Codex App의 Windows PowerShell 환경에서 수행했다.

## 환경과 소스

- Windows NT 10.0.26300, Java 21.0.6, Gradle 9.3.0
- Node.js 22.17.0, npm 10.9.2, Git 2.47.1.windows.1
- tiny-memo 원격: `https://github.com/50h33/tiny-memo`
- 시작 상태: 파일과 커밋이 없는 로컬 `main`, 원격 heads 없음
- 디스크의 기존 AGENTS.md 없음. 세션에서 제공된 작업 지침을 적용했다.
- dev-cycle 원본: `C:\Users\wneh2\Desktop\repo_group\dev-cycle`
- dev-cycle 기준: `f6e1e1232976c9bd6f8cda6dd09862fd18aa7a2b` (`docs/12`), 시작 시 작업 트리 깨끗함
- 빌드 복사본: `C:\Users\wneh2\Desktop\tiny-memo-tools\dev-cycle`, 동일 커밋

dev-cycle의 README, `docs/quickstart.md`, `docs/init.md`, `docs/test.md`,
`docs/report.md`를 읽은 뒤 설치했다. 원본 작업 트리와 Git 설정을 보존하기 위해 로컬 clone을
별도 경로에 만들었다. `npm ci`의 prepare가 hooksPath를 설정하는 대상도 이 복사본뿐이다.

## 설치 순서와 확인

1. 정적 `settings.gradle`, 두 모듈, Java 21과 JUnit 테스트 설정, 기본 문서와 ignore 규칙을 작성했다.
2. 로컬 Gradle 9.3.0으로 루트 Wrapper를 생성했다. Wrapper의 `build --no-daemon`이 종료 코드 0으로 끝났다.
   이때 Java 기능 코드와 테스트는 없었고 test 태스크는 `NO-SOURCE`였다. 기능 테스트 통과로 집계하지 않았다.
3. 외부 빌드 복사본에서 `npm ci`, `npm run build`가 각각 종료 코드 0으로 끝났다.
   npm은 개발 도구 의존성의 moderate 취약점 10건을 보고했다. 의존성 변경이나 audit fix는 이 작업 범위에 넣지 않았다.
4. `examples/dev-cycle.config.json`에서 설정을 만들고 외부의 `tiny-memo-tools/tiny-memo.config.json`에 보관했다.
   repository는 `50h33/tiny-memo`, defaultBranch와 baseRef는 `main`, commonModules는 `memo-core`다.
   문서 경로는 실제 AGENTS와 GitHub 템플릿을 가리킨다. 양쪽 OS의 test 인자에 `--rerun-tasks`를 설정했다.
5. `init --dry-run --json`은 기존 `.gitignore` 충돌로 `blocked`, 종료 코드 1을 반환했다.
   `docs/init.md`에 따라 기존 규칙을 유지하고 렌더링한 gitignore 템플릿 전체를 끝에 추가했다.
6. 두 번째 dry-run은 `ready`, 실제 init은 `completed`, 재실행은 19개 대상 모두 `unchanged`였다. 모두 종료 코드 0이었다.
7. 기능 구현 전에 기본 구성과 설치를 `main`의 초기 커밋으로 기록한다. 이후 `feature/memo-save`에서만 기능을 개발한다.

init의 네 JSON 출력은 외부 `tiny-memo-tools/init-first.json`, `init-ready.json`,
`init-completed.json`, `init-repeat.json`에 보관했다. 설치된 패키지 문서는
[dev-cycle-workflow.md](dev-cycle-workflow.md)이며 템플릿 버전은 0.1.6이다.

초기 `main` 커밋을 만든 뒤에만 CLI test를 실행한다. 비교 ref를 `HEAD`로 대체하지 않는다.
최종 기능 검증 기록에는 `git rev-parse main`으로 확인한 tiny-memo 기준 커밋을 남긴다.

## 적용 범위

**Codex에서 dev-cycle CLI를 적용한 사례**다. 설치된 Claude Code 명령과 역할은 문서로
참고하며 실행됐다고 가정하지 않는다. 원격 push, PR 게시, 배포, dev-cycle 이슈 #13 전체 검증은 수행하지 않는다.
