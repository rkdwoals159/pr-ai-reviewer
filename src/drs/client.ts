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
  // PR 제목 등을 커밋 메시지 대용으로 전달 (DRS API 스펙상 선택)
  prTitle?: string;
}

function buildMockReport(
  payload: DrsRequestPayload,
  messageSuffix?: string
): DrsRiskReport {
  const totalAdditions = payload.files.reduce(
    (sum, f) => sum + f.additions,
    0
  );
  const totalDeletions = payload.files.reduce(
    (sum, f) => sum + f.deletions,
    0
  );
  const sizeFactor = Math.min((totalAdditions + totalDeletions) / 200, 1);

  const baseMessage =
    "모의 위험도 점수입니다. 실제 DRS-LLM API 엔드포인트를 설정하면 더 정교한 분석이 가능합니다.";

  return {
    overallRisk: sizeFactor,
    items: payload.files.map((f) => ({
      filename: f.filename,
      riskScore: Math.min(
        (f.additions + f.deletions) / 100 || sizeFactor * 0.5 || 0.1,
        1
      ),
      summary: messageSuffix ? `${baseMessage} (${messageSuffix})` : baseMessage,
    })),
    raw: { mock: true },
  };
}

export async function getDrsRiskReport(
  payload: DrsRequestPayload
): Promise<DrsRiskReport> {
  const baseURL = process.env.DRS_API_BASE_URL
    ? process.env.DRS_API_BASE_URL.replace(/\/+$/, "")
    : "";
  const token = process.env.DRS_API_TOKEN;

  if (!baseURL) {
    console.warn(
      "DRS_API_BASE_URL is not set. Falling back to mock risk scoring."
    );
    return buildMockReport(payload);
  }

  try {
    // worldofcode DRS-LLM seq-cls API:
    // POST {baseURL}/seq-cls/predict_batch
    // body: [{ diff: string, commit_message: string }, ...]
    const batchRequest = payload.files.map((f) => ({
      diff: f.patch,
      commit_message: payload.prTitle ?? "",
    }));

    const res = await axios.post(
      `${baseURL}/seq-cls/predict_batch`,
      batchRequest,
      token
        ? {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
        : undefined
    );

    const data = res.data as any;

    // 예상 형태: 배열 [{ score: number, label?: string, ... }, ...]
    if (!Array.isArray(data)) {
      console.warn(
        "[DRS] 예기치 않은 응답 형식입니다. mock 위험도 점수로 대체합니다."
      );
      return buildMockReport(payload, "DRS 응답 형식이 예상과 다름");
    }

    const items: DrsRiskItem[] = payload.files.map((f, idx) => {
      const item = data[idx] ?? {};
      const rawScore =
        typeof item.score === "number"
          ? item.score
          : typeof item.risk === "number"
            ? item.risk
            : typeof item.prob === "number"
              ? item.prob
              : 0.5;
      const riskScore = Math.min(Math.max(rawScore, 0), 1);

      const label =
        typeof item.label === "string"
          ? item.label
          : typeof item.class === "string"
            ? item.class
            : undefined;

      const summaryParts: string[] = [];
      if (label) {
        summaryParts.push(`DRS-LLM 분류 레이블: ${label}`);
      }
      summaryParts.push(
        "DRS-LLM 시퀀스 분류 결과를 기반으로 한 위험도 추정입니다."
      );

      return {
        filename: f.filename,
        riskScore,
        summary: summaryParts.join(" "),
      };
    });

    const overallRisk =
      items.length > 0
        ? items.reduce((sum, it) => sum + it.riskScore, 0) / items.length
        : 0;

    return {
      overallRisk,
      items,
      raw: data,
    };
  } catch (error: any) {
    const statusPart =
      (error?.response && `HTTP ${error.response.status}`) || "";
    const messagePart = error?.message || "unknown error";
    const msg =
      statusPart && messagePart ? `${statusPart} - ${messagePart}` : statusPart || messagePart;

    console.warn(
      `[DRS] API 호출 실패, mock 위험도 점수로 대체합니다: ${msg}`
    );

    if (error?.response?.data) {
      try {
        console.warn(
          "[DRS] API error response body:",
          typeof error.response.data === "string"
            ? error.response.data
            : JSON.stringify(error.response.data, null, 2)
        );
      } catch {
        // stringify 실패 시는 조용히 무시
      }
    }

    return buildMockReport(payload, `DRS API 호출 실패: ${msg}`);
  }
}

