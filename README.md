한국어 | [English](./README.en.md)

### [주의] dss-oss 는 2025-11년도에 나온 논문으로, confidence와 LLM의 개선 권고 내용을 받을 수 있습니다.
### 현재 confidence는 java를 기준으로 학습된걸 그대로 가져왔으며, 
### 코드 변경 내용이 많으면 점수가 정상적으로 잘 안 나오는듯 합니다...

### 또한 기능중 'PR 개선 제안'부분은 정상적으로 동작하지 않습니다. 같이 기다려 보아요
<예시>
<img width="838" height="586" alt="image" src="https://github.com/user-attachments/assets/c2315c3b-197f-48d5-a5e5-b9b0db475cff" />



## gh-PR-reviewerAI

**DRS-OSS / DRS-LLM 아이디어를 활용해 GitHub Pull Request의 위험도를 점수화하고, 자동 리뷰 코멘트를 남겨주는 GitHub Actions 기반 오픈소스 프로젝트**입니다.

- 참고 논문 및 레포:
  - DRS-LLM: [`https://github.com/Ali-Sayed-Salehi/drs-llm`](https://github.com/Ali-Sayed-Salehi/drs-llm)
  - DRS 소개: [`https://worldofcode.org/drs/about`](https://worldofcode.org/drs/about)

### 아키텍처 개요

- GitHub App (본 레포 `server`):

  - PR Webhook(`pull_request.opened`, `pull_request.synchronize`) 수신
  - 변경 파일 목록 및 diff(`patch`) 조회
  - DRS-LLM 기반 API(이미 학습된 모델을 제공하는 HTTP 엔드포인트)에 분석 요청
  - 위험도 점수 및 설명을 받아 PR에 요약 코멘트 작성

- DRS-LLM API:
  - [`drs-llm`](https://github.com/Ali-Sayed-Salehi/drs-llm) 레포의 `drs-gateway-api` / `drs-seq-cls-api` 등을 이용해
    PR diff 수준의 위험도 점수를 계산하고, 필요하다면 LLM을 통해 자연어 설명을 생성
  - 이 프로젝트에서는 **GPU 없이도 사용할 수 있는, 이미 학습된 모델을 HTTP API로 제공**한다고 가정하고,
    실제 엔드포인트는 `DRS_API_BASE_URL` 환경 변수로 주입합니다.

### 기술 스택

- Node.js + TypeScript
- Express (Webhook 서버)
- GitHub App / Webhooks: `@octokit/app`, `@octokit/webhooks`
- HTTP 클라이언트: `axios`

### 환경 변수

다음 환경 변수를 `.env` 등에 설정해야 합니다.

- **기본**

  - `PORT` (선택, 기본: `3000`)

- **GitHub App**

  - `GITHUB_APP_ID`
  - `GITHUB_PRIVATE_KEY` (멀티라인 키는 `\n` 치환 문자열을 사용하거나, 런타임에서 변환)
  - `GITHUB_WEBHOOK_SECRET`

- **DRS-LLM API (이미 학습된 모델 활용)**
  - `DRS_API_BASE_URL` (예: `https://your-drs-server/drs-api`)
  - `DRS_API_TOKEN` (선택, 필요 시 Bearer 토큰)

`DRS_API_BASE_URL`가 설정되지 않은 경우에는, `src/drs/client.ts`에서 **단순한 mock 위험도 점수**를 계산해
MVP 수준으로 동작하도록 되어 있습니다.

### 로컬 개발 (옵션)

```bash
npm install
npm run dev
```

서버는 기본적으로 `PORT`(기본: `3000`)에서 기동됩니다.  
하지만 일반 사용자는 별도 서버 없이, 아래 **GitHub Actions 워크플로우 방식**으로 사용하는 것을 권장합니다.

### GitHub Actions로 사용하는 방법 (권장)

이 레포를 **GitHub Action처럼 바로 가져다 쓰는** 것을 목표로 합니다.  
레포를 포크하거나, 이 레포를 GitHub에 공개로 올린 뒤, 다른 프로젝트에서는 단순히 `uses: OWNER/gh-PR-reviewerAI@버전` 만 추가하면 됩니다.

#### 1) 기존 프로젝트에서 워크플로우만 추가해서 쓰는 방법

기존 프로젝트 레포에 `.github/workflows/drs-pr-review.yml` 파일을 새로 만들고, 다음과 같이 작성합니다.

```yaml
name: DRS PR Review

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  drs-pr-review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write

    steps:
      - name: Run DRS PR Reviewer AI
        uses: YOUR_GH_ID/gh-PR-reviewerAI@v1
        with:
          drs-api-base-url: ${{ secrets.DRS_API_BASE_URL }}
          drs-api-token: ${{ secrets.DRS_API_TOKEN }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

여기서 `YOUR_GH_ID/gh-PR-reviewerAI@v1` 부분만, 실제로 이 액션이 올라가 있는 GitHub 사용자/조직과 태그로 바꿔주면 됩니다.

#### 2) 이 레포 자체에서 워크플로우 실행 (개발용)

이 레포 안에 포함된 예시처럼, 직접 빌드 후 `npm run drs:review` 를 실행하는 형태로도 사용할 수 있습니다.

```yaml
name: DRS PR Review (local)

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  drs-pr-review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Run DRS PR review
        run: npm run drs:review
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          DRS_API_BASE_URL: ${{ secrets.DRS_API_BASE_URL }}
          DRS_API_TOKEN: ${{ secrets.DRS_API_TOKEN }}
```

2. 레포의 GitHub Secrets에 다음 값을 등록합니다.

   - `DRS_API_BASE_URL`: 이미 학습된 DRS-LLM 모델을 제공하는 HTTP API 엔드포인트
   - `DRS_API_TOKEN`: 필요하다면 인증용 토큰

3. PR이 열리거나 업데이트될 때마다, GitHub가 자동으로 워크플로우를 실행하여:

   - PR diff를 읽고
   - DRS-LLM API (또는 설정이 없다면 내부 mock 로직)를 호출해서 위험도/설명을 계산하고
   - 해당 PR에 요약 코멘트를 자동으로 남깁니다.

### PR 이벤트 처리 흐름

1. GitHub → `pull_request.opened` / `pull_request.synchronize` 이벤트 발생
2. GitHub Actions 워크플로우(`.github/workflows/drs-pr-review.yml`)가 자동으로 실행
3. GitHub API로 변경 파일 목록 및 `patch` 추출
4. `DRS-LLM API` (`DRS_API_BASE_URL`)에 diff 기반 위험도 분석 요청
5. 응답으로 받은 `overallRisk` 및 파일별 `riskScore` / 설명을 바탕으로
   `src/review/engine.ts`에서 요약 코멘트 텍스트를 생성
6. GitHub API를 통해 해당 PR에 댓글로 게시

---

### License

This project is licensed under the [MIT License](./LICENSE).


