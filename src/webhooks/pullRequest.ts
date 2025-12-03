import type { App as OctokitApp } from "@octokit/app";
import type { PullRequestEvent } from "@octokit/webhooks-types";
import { getDrsRiskReport } from "../drs/client";
import { buildSummaryComment } from "../review/engine";

export async function handlePullRequestEvent(
  octokitApp: OctokitApp,
  payload: PullRequestEvent
) {
  const action = payload.action;

  if (action !== "opened" && action !== "synchronize") {
    return;
  }

  const installationId = payload.installation?.id;
  if (!installationId) {
    console.warn("No installation id on PR event");
    return;
  }

  const octokit = await octokitApp.getInstallationOctokit(installationId);

  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  const pull_number = payload.pull_request.number;

  // 전체 diff 텍스트를 GitHub API로 가져오기
  const prFiles = await octokit.rest.pulls.listFiles({
    owner,
    repo,
    pull_number,
    per_page: 100,
  });

  const filesForAnalysis = prFiles.data.map((f) => ({
    filename: f.filename,
    status: f.status,
    additions: f.additions,
    deletions: f.deletions,
    patch: f.patch ?? "",
  }));

  // DRS-LLM 기반 위험도 리포트 (이미 학습된 모델을 HTTP로 호출)
  const drsReport = await getDrsRiskReport({
    repo: `${owner}/${repo}`,
    pullNumber: pull_number,
    files: filesForAnalysis,
  });

  const body = buildSummaryComment(drsReport);

  // PR에 요약 코멘트 남기기
  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: pull_number,
    body,
  });
}


