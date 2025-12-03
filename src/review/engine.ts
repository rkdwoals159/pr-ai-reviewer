import type { DrsRiskReport } from "../drs/client";

function formatRiskLevel(score: number): "Low" | "Medium" | "High" {
  if (score >= 0.7) return "High";
  if (score >= 0.4) return "Medium";
  return "Low";
}

export function buildSummaryComment(
  report: DrsRiskReport,
  improvementAdvice?: string
): string {
  const level = formatRiskLevel(report.overallRisk);
  const percent = Math.round(report.overallRisk * 100);

  const lines: string[] = [];

  // 헤더
  lines.push("## 🔍 PR 위험도 분석 (DRS-LLM 기반)", "");
  lines.push(`- **전체 위험도**: **${level} (${percent}%)**`, "");

  // 파일별 위험도
  if (!report.items.length) {
    lines.push(
      "- **분석 대상 파일이 없습니다.** (변경 라인이 거의 없거나 GitHub API 응답이 비어 있음)"
    );
  } else {
    for (const item of report.items) {
      const itemLevel = formatRiskLevel(item.riskScore);
      const itemPercent = Math.round(item.riskScore * 100);
      lines.push(
        `- **파일**: \`${item.filename}\``,
        `  - 위험도: **${itemLevel} (${itemPercent}%)**`,
        `  - 설명: ${item.summary}`
      );
    }
  }

  // CLM 기반 개선 제안 섹션 (있을 때만 추가)
  if (improvementAdvice && improvementAdvice.trim().length > 0) {
    lines.push("", "### 💡 위험도 낮추기 위한 개선 제안 (DRS-LLM 기반)", "");
    lines.push(improvementAdvice.trim(), "");
  }

  // 푸터
  lines.push(
    "> 이 평가는 DRS-OSS / DRS-LLM 아이디어를 바탕으로 한 자동 분석 결과이며,",
    "> 최종 결정은 리뷰어의 판단과 팀의 코드 기준을 따르시길 권장합니다."
  );

  return lines.join("\n");
}

