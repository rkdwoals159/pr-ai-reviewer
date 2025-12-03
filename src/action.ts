import { Octokit } from "@octokit/rest";
import fs from "fs";
import path from "path";
import { getDrsImprovementAdvice, getDrsRiskReport } from "./drs/client";
import { buildSummaryComment } from "./review/engine";

async function main() {
  const token = process.env.GITHUB_TOKEN;
  const eventPath = process.env.GITHUB_EVENT_PATH;
  const repoEnv = process.env.GITHUB_REPOSITORY;

  // GitHub Action inputs 지원 (action.yml 의 inputs → INPUT_* 환경변수로 들어옴)
  if (!process.env.DRS_API_BASE_URL && process.env.INPUT_DRS_API_BASE_URL) {
    process.env.DRS_API_BASE_URL = process.env.INPUT_DRS_API_BASE_URL;
  }
  if (!process.env.DRS_API_TOKEN && process.env.INPUT_DRS_API_TOKEN) {
    process.env.DRS_API_TOKEN = process.env.INPUT_DRS_API_TOKEN;
  }

  if (!token) {
    throw new Error("GITHUB_TOKEN 이 설정되어 있지 않습니다.");
  }
  if (!eventPath) {
    throw new Error("GITHUB_EVENT_PATH 가 설정되어 있지 않습니다.");
  }

  const eventJson = fs.readFileSync(path.resolve(eventPath), "utf8");
  const event = JSON.parse(eventJson);

  if (!event.pull_request) {
    console.log("pull_request 이벤트가 아니므로 아무 작업도 수행하지 않습니다.");
    return;
  }

  const octokit = new Octokit({ auth: token });

  const [fallbackOwner, fallbackRepo] = (repoEnv ?? "").split("/");

  const owner =
    event.repository?.owner?.login ??
    fallbackOwner ??
    (() => {
      throw new Error("owner 를 결정할 수 없습니다.");
    })();

  const repo =
    event.repository?.name ??
    fallbackRepo ??
    (() => {
      throw new Error("repo 를 결정할 수 없습니다.");
    })();

  const pull_number = event.pull_request.number;

  console.log(`분석 대상 PR: ${owner}/${repo} #${pull_number}`);

  const filesRes = await octokit.pulls.listFiles({
    owner,
    repo,
    pull_number,
    per_page: 100,
  });

  const filesForAnalysis = filesRes.data.map((f) => ({
    filename: f.filename,
    status: f.status ?? "",
    additions: f.additions ?? 0,
    deletions: f.deletions ?? 0,
    patch: f.patch ?? "",
  }));

  const prTitle: string = event.pull_request.title ?? "";

  const drsReport = await getDrsRiskReport({
    repo: `${owner}/${repo}`,
    pullNumber: pull_number,
    files: filesForAnalysis,
    prTitle,
  });

  const improvementAdvice = await getDrsImprovementAdvice({
    prTitle,
    files: filesForAnalysis,
  });

  const body = buildSummaryComment(drsReport, improvementAdvice);

  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: pull_number,
    body,
  });

  console.log("PR 에 DRS 기반 위험도 요약 코멘트를 남겼습니다.");
}

main().catch((err) => {
  console.error("DRS PR 리뷰 실행 중 오류 발생:", err);
  process.exit(1);
});


