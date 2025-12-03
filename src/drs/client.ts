import axios from "axios";

export interface DrsFileInput {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch: string;
}

export interface DrsRiskItem {
  filename: string;
  riskScore: number; // 0.0 ~ 1.0
  summary: string;
}

export interface DrsRiskReport {
  overallRisk: number; // 0.0 ~ 1.0
  items: DrsRiskItem[];
  raw?: unknown;
}

export interface DrsRequestPayload {
  repo: string;
  pullNumber: number;
  files: DrsFileInput[];
}

const baseURL = process.env.DRS_API_BASE_URL;
const token = process.env.DRS_API_TOKEN;

if (!baseURL) {
  console.warn(
    "DRS_API_BASE_URL is not set. getDrsRiskReport will fall back to a mock response."
  );
}

export async function getDrsRiskReport(
  payload: DrsRequestPayload
): Promise<DrsRiskReport> {
  if (!baseURL) {
    // GPU 없이도 이미 학습된 모델을 사용할 수 있다고 가정하지만,
    // 아직 실제 엔드포인트가 없다면 간단한 mock 로직으로 대체
    const totalAdditions = payload.files.reduce(
      (sum, f) => sum + f.additions,
      0
    );
    const totalDeletions = payload.files.reduce(
      (sum, f) => sum + f.deletions,
      0
    );
    const sizeFactor = Math.min((totalAdditions + totalDeletions) / 200, 1);

    return {
      overallRisk: sizeFactor,
      items: payload.files.map((f) => ({
        filename: f.filename,
        riskScore: Math.min(
          (f.additions + f.deletions) / 100 ||
            sizeFactor * 0.5 ||
            0.1,
          1
        ),
        summary:
          "모의 위험도 점수입니다. 실제 DRS-LLM API 엔드포인트를 설정하면 더 정교한 분석이 가능합니다.",
      })),
      raw: { mock: true },
    };
  }

  const res = await axios.post(
    `${baseURL}/seq-cls/pr-risk`,
    payload,
    token
      ? {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      : undefined
  );

  return res.data as DrsRiskReport;
}


