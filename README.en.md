[한국어](./README.md) | English

## gh-PR-reviewerAI

**An open-source GitHub Actions project that leverages DRS-OSS / DRS-LLM ideas to score the bug risk of a Pull Request and automatically post review comments.**

- References:
  - DRS-LLM: [`https://github.com/Ali-Sayed-Salehi/drs-llm`](https://github.com/Ali-Sayed-Salehi/drs-llm)
  - DRS overview: [`https://worldofcode.org/drs/about`](https://worldofcode.org/drs/about)

### What this project does

- **PR risk scoring**: Uses a DRS-LLM-based HTTP API (pre-trained model, no extra training required) to estimate the bug risk of a PR based on its diff.
- **Automatic summary comments**: Posts a summary comment to the PR with overall risk level (High / Medium / Low) and per-file notes.
- **No always-on server**: Runs entirely on GitHub-hosted runners via GitHub Actions; you don't need to maintain your own server.
- **Pluggable DRS backend**: You can connect it to a real DRS-LLM API or use the built‑in mock logic for experimentation.

---

### Architecture overview

- **GitHub Actions (recommended usage)**  
  - Triggered on PR events: `pull_request.opened`, `synchronize`, `reopened`
  - Fetches changed files and their `patch` (diff) via the GitHub API
  - Sends the diff to a DRS-LLM HTTP API for risk scoring (and optional explanation)
  - Generates a human-readable summary comment and posts it back to the PR

- **DRS-LLM API**
  - Designed to integrate with services similar to `drs-gateway-api` / `drs-seq-cls-api` from [`drs-llm`](https://github.com/Ali-Sayed-Salehi/drs-llm)
  - Assumes the model is already trained and exposed via HTTP, potentially without requiring a GPU from the consumer of this Action
  - The actual endpoint is injected via the `DRS_API_BASE_URL` environment variable or Action inputs

---

### Tech stack

- Node.js + TypeScript
- GitHub Actions / JavaScript Action (`action.yml`)
- GitHub API client: `@octokit/rest`
- HTTP client: `axios`

---

### How to use in an existing repository

The goal is to make this project behave like a drop‑in GitHub Action.  
Once this repository is public on GitHub, you can use it from any other repo with a simple `uses:` line.

#### 1) Add a workflow file

In your existing repository, create `.github/workflows/drs-pr-review.yml`:

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

- Replace `YOUR_GH_ID/gh-PR-reviewerAI@v1` with your actual GitHub user/organization and tag.

#### 2) Configure GitHub Secrets

In **Settings → Secrets and variables → Actions** of the target repository, add:

- `DRS_API_BASE_URL`: HTTP endpoint of your pre‑trained DRS-LLM service (e.g. `https://your-drs-server/drs-api`)
- `DRS_API_TOKEN`: Optional bearer token or API key, if required by your DRS service
- `GITHUB_TOKEN`: Provided automatically by GitHub; referenced as `${{ secrets.GITHUB_TOKEN }}`

If `DRS_API_BASE_URL` is not set, the Action falls back to a simple mock implementation that estimates risk based on the size of the diff. This is useful for quick trials and CI wire‑up.

---

### Local development (optional)

You only need this if you want to modify or extend the Action itself.

```bash
npm install
npm run build
```

Then you can run:

```bash
node dist/action.js
```

with appropriate environment variables (`GITHUB_EVENT_PATH`, `GITHUB_TOKEN`, etc.) to simulate a GitHub Actions run.

---

### PR event flow (detailed)

1. A PR event is fired: `pull_request.opened`, `pull_request.synchronize`, or `reopened`.
2. GitHub Actions starts the `DRS PR Review` workflow.
3. The Action:
   - Reads the event payload (`GITHUB_EVENT_PATH`)
   - Fetches changed files and `patch` data via `pulls.listFiles`
4. The diff is sent to the DRS-LLM API (`DRS_API_BASE_URL`) for risk analysis.
5. The response (overall risk + per‑file scores and explanations) is converted to a Markdown summary in `src/review/engine.ts`.
6. The summary is posted back to the PR using the GitHub API (`issues.createComment`).

---

### License

This project is licensed under the [MIT License](./LICENSE).


