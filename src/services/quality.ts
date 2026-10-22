import { BlueprintSlot, Exam, ExamConfig, Question } from '../types';
import { QualityIssue, runCodeQualityCheck } from '../lib/validate';
import { QUALITY_CRITERIA_LIST, QualityCriterionInfo } from '../config';
import {
  buildReferenceParts,
  callGeminiJsonApi,
  repairQuestionWithFeedback,
} from './gemini';

export interface CriterionSummary {
  id: number;
  name: string;
  category: 'CODE' | 'AI';
  shortDesc: string;
  description: string;
  status: 'PASS' | 'WARN' | 'ERROR';
  issues: QualityIssue[];
}

export interface QualityCheckReport {
  timestamp: string;
  totalIssues: number;
  errorCount: number;
  warnCount: number;
  repairedCount: number;
  criteriaSummaries: CriterionSummary[];
  allIssues: QualityIssue[];
  exam: Exam;
}

/**
 * Chuẩn hóa chuỗi đáp án ngắn để so khớp
 */
function normalizeAnswerString(str?: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .replace(/[,\s]+/g, ' ')
    .replace(/^[\(\[]|[\)\]]$/g, '');
}

/**
 * LƯỢT AI A – GIẢI ĐỘC LẬP (Tiêu chí 8)
 * Gửi các câu trắc nghiệm, điền khuyết, trả lời ngắn, đúng/sai KHÔNG kèm đáp án;
 * yêu cầu Gemini giải độc lập và trả về kết quả để CODE so sánh đối chiếu.
 */
async function runIndependentSolverPass(
  questions: Question[],
  abortSignal?: AbortSignal
): Promise<QualityIssue[]> {
  const issues: QualityIssue[] = [];

  // Lọc các câu hỏi có thể giải độc lập và tự động đối chiếu
  const targetQuestions = questions.filter((q) =>
    ['MCQ4', 'MCQ_MULTI', 'TRUE_FALSE', 'FILL_BLANK', 'SHORT_ANSWER'].includes(q.type)
  );

  if (targetQuestions.length === 0) return [];

  const solverSystemInstruction = `Bạn là chuyên gia thẩm định và giải đề thi.
Nhiệm vụ: Giải độc lập từng câu hỏi dưới đây một cách tuyệt đối chính xác (không có đáp án mẫu, bạn phải tự giải).
Quy tắc:
- Với trắc nghiệm 4 lựa chọn (MCQ4): Chỉ trả về chữ cái A, B, C hoặc D.
- Với Đúng/Sai (TRUE_FALSE): Ghi kết quả từng ý, ví dụ "a: Đúng, b: Sai, c: Đúng, d: Sai".
- Với Điền khuyết / Trả lời ngắn: Ghi đáp số số học hoặc từ ngữ ngắn gọn chính xác nhất.
- Trả về JSON:
{
  "solutions": [
    {
      "questionId": "id_của_câu",
      "answer": "đáp_án_giải_ra",
      "explanation": "tóm tắt ngắn gọn các bước giải"
    }
  ]
}`;

  // Chuẩn bị payload câu hỏi KHÔNG có đáp án
  const questionsPayload = targetQuestions.map((q) => ({
    questionId: q.id,
    type: q.type,
    question: q.question,
    options: q.options,
    statements: q.statements?.map((s) => ({ id: s.id, statement: s.statement })),
    pairs: q.pairs,
  }));

  const contents = [
    {
      text:
        `HÃY TỰ GIẢI ĐỘC LẬP ${targetQuestions.length} CÂU HỎI SAU:\n` +
        JSON.stringify(questionsPayload, null, 2),
    },
  ];

  try {
    const rawData = await callGeminiJsonApi(solverSystemInstruction, contents, abortSignal);
    const solutionsList: any[] = Array.isArray(rawData?.solutions)
      ? rawData.solutions
      : Array.isArray(rawData)
      ? rawData
      : [];

    const solutionMap = new Map<string, { answer: string; explanation?: string }>();
    solutionsList.forEach((item) => {
      if (item && item.questionId) {
        solutionMap.set(String(item.questionId), {
          answer: String(item.answer || '').trim(),
          explanation: item.explanation ? String(item.explanation) : undefined,
        });
      }
    });

    // So sánh đáp án AI giải với đáp án gốc của đề
    targetQuestions.forEach((q, idx) => {
      const qNum = idx + 1;
      const solved = solutionMap.get(q.id);
      if (!solved || !solved.answer) return;

      if (q.type === 'MCQ4') {
        const aiLetter = solved.answer.match(/([A-D])/i)?.[1]?.toUpperCase();
        const origLetter = q.correctAnswer.match(/([A-D])/i)?.[1]?.toUpperCase();

        if (aiLetter && origLetter && aiLetter !== origLetter) {
          issues.push({
            questionId: q.id,
            criterion: 8,
            severity: 'ERROR',
            message: `Nghi vấn sai đáp án Câu ${qNum}: Đề bài ghi nhận [${origLetter}], nhưng AI giải độc lập ra [${aiLetter}]. Lời giải AI: ${solved.explanation || 'Không có'}`,
            suggestedFix: `Kiểm tra lại đáp án đúng giữa phương án ${origLetter} và ${aiLetter}.`,
          });
        }
      } else if (q.type === 'TRUE_FALSE') {
        const normAi = solved.answer.toLowerCase();
        const normOrig = q.correctAnswer.toLowerCase();
        // Kiểm tra số lượng ý đúng/sai có chênh lệch rõ ràng
        const aiTrueCount = (normAi.match(/đúng/g) || []).length;
        const origTrueCount = (normOrig.match(/đúng/g) || []).length;
        if (aiTrueCount > 0 && origTrueCount > 0 && aiTrueCount !== origTrueCount) {
          issues.push({
            questionId: q.id,
            criterion: 8,
            severity: 'WARN',
            message: `Câu Đúng/Sai ${qNum}: AI giải độc lập có sự khác biệt về số lượng mệnh đề Đúng/Sai so với đề bài.`,
            suggestedFix: `Rà soát lại tính đúng sai của từng mệnh đề a, b, c, d.`,
          });
        }
      } else if (q.type === 'SHORT_ANSWER' || q.type === 'FILL_BLANK') {
        const normAi = normalizeAnswerString(solved.answer);
        const normOrig = normalizeAnswerString(q.correctAnswer);
        if (normAi && normOrig && !normOrig.includes(normAi) && !normAi.includes(normOrig)) {
          issues.push({
            questionId: q.id,
            criterion: 8,
            severity: 'WARN',
            message: `Câu ${qNum} (${q.type}): Kết quả AI giải ("${solved.answer}") khác biệt với đáp án đề ("${q.correctAnswer}").`,
            suggestedFix: `Kiểm tra lại phép tính và độ chính xác của đáp số.`,
          });
        }
      }
    });
  } catch (err: any) {
    console.warn('Lượt AI A (Giải độc lập) gặp lỗi hoặc tạm thời không phản hồi:', err?.message);
  }

  return issues;
}

/**
 * LƯỢT AI B – RÀ SOÁT NỘI DUNG (Tiêu chí 9 đến 12)
 * Gửi toàn bộ đề kèm đáp án và tài liệu tham chiếu;
 * yêu cầu Gemini rà soát theo lô tối đa 10 câu.
 */
async function runContentReviewPass(
  exam: Exam,
  onProgressMsg?: (msg: string) => void,
  abortSignal?: AbortSignal
): Promise<QualityIssue[]> {
  const issues: QualityIssue[] = [];
  const questions = exam.questions || [];
  const config = exam.config;
  const refParts = buildReferenceParts(config);

  const BATCH_SIZE = 10;
  const totalBatches = Math.ceil(questions.length / BATCH_SIZE);

  const reviewerSystemInstruction = `Bạn là Hội đồng Thẩm định Đề kiểm tra Giáo dục Quốc gia theo Chương trình GDPT 2018.
Nhiệm vụ: Rà soát nội dung các câu hỏi kiểm tra dưới đây theo 4 TIÊU CHÍ CHẤT LƯỢNG:
- TIÊU CHÍ 9: Phương án nhiễu hợp lý, cùng kiểu dữ liệu (trắc nghiệm: các phương án sai phải có tính sư phạm, cùng loại đơn vị hoặc dạng thức với đáp án đúng, không đưa phương án quá phi lý hoặc lộ liễu).
- TIÊU CHÍ 10: Đủ dữ kiện, không vô nghiệm, không mơ hồ (đề bài đầy đủ giả thiết, số liệu tính toán chính xác, không mâu thuẫn, bài toán không bị vô nghiệm hoặc thiếu dữ kiện giải).
- TIÊU CHÍ 11: Đúng phạm vi kiến thức, lớp, môn, nguồn tài liệu (kiến thức bám sát lớp ${config.grade}, môn ${config.subject}, phù hợp yêu cầu cần đạt và tài liệu cung cấp).
- TIÊU CHÍ 12: Chính tả, ngữ pháp, thuật ngữ khoa học (không lỗi chính tả, câu văn sáng sủa, công thức toán/lý/hóa viết bằng LaTeX chuẩn, thuật ngữ chuyên môn chính xác).

CHỈ BÁO CÁO CÁC VẤN ĐỀ THỰC SỰ RÕ RÀNG.
Trả về JSON:
{
  "issues": [
    {
      "questionId": "id_của_câu",
      "criterion": 9, // Chọn 9, 10, 11 hoặc 12
      "severity": "ERROR", // 'ERROR' (lỗi sai nghiêm trọng) hoặc 'WARN' (nhắc nhở cải thiện)
      "message": "Mô tả cụ thể vấn đề",
      "suggestedFix": "Gợi ý cách khắc phục hoặc sửa lại câu hỏi"
    }
  ]
}
Nếu tất cả câu hỏi đều đạt chất lượng tốt, trả về { "issues": [] }.`;

  for (let b = 0; b < totalBatches; b++) {
    if (abortSignal?.aborted) break;

    const startIdx = b * BATCH_SIZE;
    const endIdx = Math.min(startIdx + BATCH_SIZE, questions.length);
    const batchQuestions = questions.slice(startIdx, endIdx);

    onProgressMsg?.(
      `Đang rà soát nội dung AI (lô ${b + 1}/${totalBatches}: câu ${startIdx + 1}–${endIdx})...`
    );

    const questionsData = batchQuestions.map((q, idx) => ({
      questionId: q.id,
      orderNumber: startIdx + idx + 1,
      type: q.type,
      level: q.level,
      question: q.question,
      options: q.options,
      statements: q.statements,
      pairs: q.pairs,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      scoringGuide: q.scoringGuide,
    }));

    const contents = [
      ...refParts,
      {
        text:
          `RÀ SOÁT NỘI DUNG LÔ CÂU HỎI ${startIdx + 1}–${endIdx} (Môn: ${config.subject}, Lớp: ${config.grade}):\n` +
          JSON.stringify(questionsData, null, 2),
      },
    ];

    try {
      const rawData = await callGeminiJsonApi(reviewerSystemInstruction, contents, abortSignal);
      const batchIssues: any[] = Array.isArray(rawData?.issues)
        ? rawData.issues
        : Array.isArray(rawData)
        ? rawData
        : [];

      batchIssues.forEach((item) => {
        const critNum = Number(item.criterion);
        if ([9, 10, 11, 12].includes(critNum) && item.message) {
          issues.push({
            questionId: item.questionId ? String(item.questionId) : undefined,
            criterion: critNum,
            severity: item.severity === 'ERROR' ? 'ERROR' : 'WARN',
            message: String(item.message),
            suggestedFix: item.suggestedFix ? String(item.suggestedFix) : undefined,
          });
        }
      });
    } catch (err: any) {
      console.warn(`Lỗi rà soát AI lô ${b + 1}:`, err?.message);
    }
  }

  return issues;
}

/**
 * QUY TRÌNH KIỂM TRA CHẤT LƯỢNG TOÀN DIỆN 12 TIÊU CHÍ (runQualityCheck)
 * 1. Chạy phần CODE (tiêu chí 1–7)
 * 2. Lượt AI A – Giải độc lập (tiêu chí 8)
 * 3. Lượt AI B – Rà soát nội dung (tiêu chí 9–12)
 * 4. Tự sửa: Tối đa 2 vòng với các câu có lỗi ERROR (trừ câu do giáo viên tự viết isTeacherWritten)
 */
export async function runQualityCheck(
  exam: Exam,
  onProgressMsg?: (msg: string) => void,
  abortSignal?: AbortSignal
): Promise<QualityCheckReport> {
  const blueprint = exam.blueprint || [];
  const config = exam.config;
  let currentQuestions: Question[] = [...exam.questions];
  let repairedCount = 0;

  onProgressMsg?.('Đang kiểm tra chất lượng bằng bộ quy tắc CODE (tiêu chí 1–7)...');
  // 1. Chạy phần CODE ban đầu
  const initialCodeIssues = runCodeQualityCheck({
    ...exam,
    questions: currentQuestions,
  });

  // 2. Lượt AI A – Giải độc lập (tiêu chí 8)
  onProgressMsg?.('Đang thẩm định đáp án: AI giải độc lập (tiêu chí 8)...');
  const passAIssues = await runIndependentSolverPass(currentQuestions, abortSignal);

  // 3. Lượt AI B – Rà soát nội dung (tiêu chí 9–12)
  onProgressMsg?.('Đang rà soát nội dung chuyên sâu (tiêu chí 9–12)...');
  const passBIssues = await runContentReviewPass(
    { ...exam, questions: currentQuestions },
    onProgressMsg,
    abortSignal
  );

  let allCollectedIssues: QualityIssue[] = [
    ...initialCodeIssues,
    ...passAIssues,
    ...passBIssues,
  ];

  // 4. QUY TRÌNH TỰ SỬA (Tối đa 2 vòng)
  // Chỉ tự sửa các câu có lỗi ERROR và KHÔNG phải do giáo viên viết (isTeacherWritten !== true)
  const MAX_REPAIR_ROUNDS = 2;

  for (let round = 1; round <= MAX_REPAIR_ROUNDS; round++) {
    if (abortSignal?.aborted) break;

    // Tìm các câu hỏi bị lỗi ERROR cần sửa
    const faultyQuestionMap = new Map<string, QualityIssue[]>();
    allCollectedIssues.forEach((issue) => {
      if (issue.severity === 'ERROR' && issue.questionId) {
        const q = currentQuestions.find((item) => item.id === issue.questionId);
        // Tuyệt đối không tự sửa câu giáo viên tự viết hoặc câu do giáo viên đã chèn hình ảnh
        if (q && !q.isTeacherWritten && !q.imageData?.dataUrl) {
          const existing = faultyQuestionMap.get(q.id) || [];
          existing.push(issue);
          faultyQuestionMap.set(q.id, existing);
        }
      }
    });

    if (faultyQuestionMap.size === 0) {
      // Không còn câu lỗi ERROR nào cần sửa
      break;
    }

    onProgressMsg?.(
      `Đang tự động sửa ${faultyQuestionMap.size} câu lỗi (vòng ${round}/${MAX_REPAIR_ROUNDS})...`
    );

    // Sửa từng câu lỗi
    const repairPromises = Array.from(faultyQuestionMap.entries()).map(
      async ([qId, issuesForQ]) => {
        const targetQ = currentQuestions.find((q) => q.id === qId);
        if (!targetQ) return null;

        const targetSlot =
          blueprint.find((s) => s.id === targetQ.slotId) ||
          ({
            id: targetQ.slotId,
            questionType: targetQ.type,
            level: targetQ.level,
            topic: targetQ.topic,
            score: targetQ.score,
            orderNumber: 1,
          } as BlueprintSlot);

        const errorMsgs = issuesForQ.map((i) => i.message);
        const fixes = issuesForQ
          .map((i) => i.suggestedFix)
          .filter(Boolean) as string[];

        const repairedQ = await repairQuestionWithFeedback(
          targetSlot,
          config,
          targetQ,
          errorMsgs,
          fixes,
          abortSignal
        );

        return { originalId: qId, repairedQ };
      }
    );

    const repairResults = await Promise.all(repairPromises);

    // Cập nhật câu hỏi đã sửa vào đề
    repairResults.forEach((res) => {
      if (res && res.repairedQ) {
        currentQuestions = currentQuestions.map((q) =>
          q.id === res.originalId ? res.repairedQ : q
        );
        repairedCount++;
      }
    });

    // Chạy lại kiểm tra CODE nhanh sau khi sửa
    const postRepairCodeIssues = runCodeQualityCheck({
      ...exam,
      questions: currentQuestions,
    });

    // Cập nhật lại danh sách lỗi
    allCollectedIssues = [
      ...postRepairCodeIssues,
      ...passAIssues.filter((i) => !faultyQuestionMap.has(i.questionId || '')),
      ...passBIssues.filter((i) => !faultyQuestionMap.has(i.questionId || '')),
    ];
  }

  // Nếu vẫn còn câu có lỗi ERROR sau 2 vòng thử lại:
  // Đánh dấu needsReview = true kèm reviewNote mô tả lỗi
  allCollectedIssues.forEach((issue) => {
    if (issue.severity === 'ERROR' && issue.questionId) {
      currentQuestions = currentQuestions.map((q) => {
        if (q.id === issue.questionId) {
          return {
            ...q,
            needsReview: true,
            reviewNote: q.reviewNote
              ? `${q.reviewNote} | ${issue.message}`
              : `Lỗi chất lượng: ${issue.message}`,
          };
        }
        return q;
      });
    }
  });

  // TỔNG HỢP BÁO CÁO 12 TIÊU CHÍ
  const criteriaSummaries: CriterionSummary[] = QUALITY_CRITERIA_LIST.map((crit) => {
    const matchingIssues = allCollectedIssues.filter((i) => i.criterion === crit.id);
    const hasError = matchingIssues.some((i) => i.severity === 'ERROR');
    const hasWarn = matchingIssues.some((i) => i.severity === 'WARN');

    let status: 'PASS' | 'WARN' | 'ERROR' = 'PASS';
    if (hasError) status = 'ERROR';
    else if (hasWarn) status = 'WARN';

    return {
      id: crit.id,
      name: crit.name,
      category: crit.category,
      shortDesc: crit.shortDesc,
      description: crit.description,
      status,
      issues: matchingIssues,
    };
  });

  const errorCount = allCollectedIssues.filter((i) => i.severity === 'ERROR').length;
  const warnCount = allCollectedIssues.filter((i) => i.severity === 'WARN').length;

  const updatedExam: Exam = {
    ...exam,
    questions: currentQuestions,
    updatedAt: new Date().toISOString(),
  };

  return {
    timestamp: new Date().toISOString(),
    totalIssues: allCollectedIssues.length,
    errorCount,
    warnCount,
    repairedCount,
    criteriaSummaries,
    allIssues: allCollectedIssues,
    exam: updatedExam,
  };
}
