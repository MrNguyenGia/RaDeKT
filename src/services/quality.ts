import { BlueprintSlot, Exam, ExamConfig, Question, QuestionType } from '../types';
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

import { compile } from 'mathjs';

/**
 * Trích xuất và tính giá trị số học từ chuỗi đáp án (hỗ trợ phân số \frac{a}{b}, căn \sqrt{a}, số thập phân, số âm)
 */
export function parseMathNumber(str?: string): number | null {
  if (!str) return null;
  let s = String(str).trim();

  // Bỏ các tiền tố như "m =", "x =", "y =", "k =", "S =", "đáp số:", "kết quả:"
  s = s.replace(/^(?:đáp số|kết quả|[a-z]\s*=)\s*:?\s*/i, '');
  // Bỏ ký hiệu LaTeX $, \(, \)
  s = s.replace(/[\$\(\)]/g, ' ');
  // Đổi dấu trừ unicode thành dấu trừ ASCII
  s = s.replace(/[−–]/g, '-');
  // Đổi dấu phẩy giữa các chữ số thành dấu chấm thập phân (ví dụ "2,5" -> "2.5")
  s = s.replace(/(\d+),(\d+)/g, '$1.$2');

  // Chuẩn hóa phân số LaTeX \frac{a}{b} hoặc \dfrac{a}{b}
  s = s.replace(/\\(?:d?frac)\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, '(($1)/($2))');
  // Chuẩn hóa căn bậc hai \sqrt{a} hoặc \sqrt a
  s = s.replace(/\\sqrt\s*\{([^{}]+)\}/g, 'sqrt($1)');
  s = s.replace(/\\sqrt\s*(\d+)/g, 'sqrt($1)');
  // Chuẩn hóa \pi
  s = s.replace(/\\pi/g, 'pi');

  s = s.trim();

  // Thử parse số trực tiếp
  const directNum = Number(s);
  if (!isNaN(directNum) && isFinite(directNum)) {
    return directNum;
  }

  // Thử tính toán biểu thức bằng mathjs (compile/evaluate)
  try {
    const fn = compile(s);
    const val = fn.evaluate();
    if (typeof val === 'number' && isFinite(val)) {
      return val;
    }
  } catch {
    // Không tính toán trực tiếp được biểu thức phức tạp
  }

  // Nếu chứa từ ngữ kèm số (ví dụ: "3 giá trị nguyên", "có 4 nghiệm", "m = 5")
  const extractedNumberMatch = s.match(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/);
  if (extractedNumberMatch) {
    const cand = Number(extractedNumberMatch[0]);
    if (!isNaN(cand) && isFinite(cand)) {
      return cand;
    }
  }

  return null;
}

/**
 * So sánh bằng CODE giữa đáp án đề thi và kết quả AI tự giải độc lập (Tiêu chí 8)
 * Áp dụng cho CẢ trắc nghiệm (MCQ4, MCQ_MULTI, TRUE_FALSE) và trả lời ngắn (SHORT_ANSWER, FILL_BLANK, tính số giá trị nguyên của tham số)
 * Dung sai so sánh số: |num1 - num2| < 1e-4
 */
export function compareAnswersWithCode(
  origAnswer: string,
  aiAnswer: string,
  type: QuestionType
): { isMatch: boolean; reason?: string } {
  if (!origAnswer || !aiAnswer) {
    return { isMatch: false, reason: 'Đáp án bị rỗng' };
  }

  // 1. Trắc nghiệm 4 lựa chọn (MCQ4)
  if (type === 'MCQ4') {
    const origLetter = origAnswer.match(/([A-D])/i)?.[1]?.toUpperCase();
    const aiLetter = aiAnswer.match(/([A-D])/i)?.[1]?.toUpperCase();
    if (origLetter && aiLetter) {
      const match = origLetter === aiLetter;
      return {
        isMatch: match,
        reason: match
          ? undefined
          : `Đề bài chọn phương án [${origLetter}], nhưng AI giải ra phương án [${aiLetter}]`,
      };
    }
  }

  // 2. Đúng / Sai (TRUE_FALSE)
  if (type === 'TRUE_FALSE') {
    const normAi = aiAnswer.toLowerCase();
    const normOrig = origAnswer.toLowerCase();
    const aiTrueCount = (normAi.match(/đúng/g) || []).length;
    const origTrueCount = (normOrig.match(/đúng/g) || []).length;
    const aiFalseCount = (normAi.match(/sai/g) || []).length;
    const origFalseCount = (normOrig.match(/sai/g) || []).length;

    if (aiTrueCount > 0 && origTrueCount > 0) {
      const match = aiTrueCount === origTrueCount && aiFalseCount === origFalseCount;
      return {
        isMatch: match,
        reason: match
          ? undefined
          : `Số lượng mệnh đề Đúng/Sai AI giải ra (${aiTrueCount}Đ/${aiFalseCount}S) lệch với đề (${origTrueCount}Đ/${origFalseCount}S)`,
      };
    }
  }

  // 3. Trả lời ngắn / Điền khuyết / Tính số giá trị nguyên (SHORT_ANSWER, FILL_BLANK)
  const numOrig = parseMathNumber(origAnswer);
  const numAi = parseMathNumber(aiAnswer);

  if (numOrig !== null && numAi !== null) {
    const diff = Math.abs(numOrig - numAi);
    const isNumMatch = diff < 1e-4;
    return {
      isMatch: isNumMatch,
      reason: isNumMatch
        ? undefined
        : `AI giải ra số ${numAi}, lệch so với đáp án đề là ${numOrig} (chênh lệch: ${diff.toFixed(5)})`,
    };
  }

  // So sánh dạng chuỗi văn bản nếu không parse được thành số
  const cleanOrig = origAnswer.toLowerCase().trim().replace(/[,\s]+/g, ' ').replace(/^[\(\[]|[\)\]]$/g, '');
  const cleanAi = aiAnswer.toLowerCase().trim().replace(/[,\s]+/g, ' ').replace(/^[\(\[]|[\)\]]$/g, '');

  if (cleanOrig === cleanAi || cleanOrig.includes(cleanAi) || cleanAi.includes(cleanOrig)) {
    return { isMatch: true };
  }

  return {
    isMatch: false,
    reason: `AI giải ra "${aiAnswer}", khác với đáp án đề "${origAnswer}"`,
  };
}

/**
 * LƯỢT AI A – GIẢI ĐỘC LẬP (Tiêu chí 8)
 * Gửi các câu trắc nghiệm, điền khuyết, trả lời ngắn, đúng/sai KHÔNG kèm đáp án;
 * yêu cầu Gemini giải độc lập và trả về kết quả để CODE so sánh đối chiếu.
 * Áp dụng cho CẢ trắc nghiệm và trả lời ngắn (kể cả câu tính số giá trị nguyên của tham số).
 */
export async function runIndependentSolverPass(
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
- Với Điền khuyết / Trả lời ngắn (bao gồm câu tính số lượng giá trị nguyên, nghiệm, tọa độ): Ghi đáp số số học chuẩn xác nhất (dưới dạng số nguyên, phân số a/b, căn thức hoặc số thập phân) hoặc từ ngữ ngắn gọn.
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

    // So sánh đáp án AI giải với đáp án gốc của đề bằng CODE
    targetQuestions.forEach((q, idx) => {
      const qNum = idx + 1;
      const solved = solutionMap.get(q.id);
      if (!solved || !solved.answer) return;

      q.aiSolvedAnswer = solved.answer;
      const comparison = compareAnswersWithCode(q.correctAnswer, solved.answer, q.type);
      q.isSolverMatch = comparison.isMatch;

      if (!comparison.isMatch) {
        issues.push({
          questionId: q.id,
          criterion: 8,
          severity: 'ERROR',
          message: `Nghi vấn sai đáp án Câu ${qNum} (${q.type}): ${comparison.reason || `Đề ghi [${q.correctAnswer}], AI giải ra [${solved.answer}]`}. Lời giải AI: ${solved.explanation || 'Không có'}`,
          suggestedFix: `Giải trọn vẹn đúng đề đã cho, kết luận cuối cùng phải trùng correctAnswer hoặc sửa lại đáp án đúng.`,
        });
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
  let passAIssues = await runIndependentSolverPass(currentQuestions, abortSignal);

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
    const repairedQIds: string[] = [];
    repairResults.forEach((res) => {
      if (res && res.repairedQ) {
        currentQuestions = currentQuestions.map((q) =>
          q.id === res.originalId ? res.repairedQ : q
        );
        repairedQIds.push(res.originalId);
        repairedCount++;
      }
    });

    // Chạy lại kiểm tra CODE nhanh sau khi sửa
    const postRepairCodeIssues = runCodeQualityCheck({
      ...exam,
      questions: currentQuestions,
    });

    // Nếu có câu hỏi sửa liên quan đến Tiêu chí 8, tự giải độc lập lại câu đó
    const repairedTargetQs = currentQuestions.filter((q) => repairedQIds.includes(q.id));
    if (repairedTargetQs.length > 0) {
      try {
        const reSolverIssues = await runIndependentSolverPass(repairedTargetQs, abortSignal);
        passAIssues = [
          ...passAIssues.filter((i) => !repairedQIds.includes(i.questionId || '')),
          ...reSolverIssues,
        ];
      } catch {
        // Giữ nguyên passAIssues nếu gọi giải lại lỗi mạng
      }
    }

    // Cập nhật lại danh sách lỗi
    allCollectedIssues = [
      ...postRepairCodeIssues,
      ...passAIssues,
      ...passBIssues.filter((i) => !faultyQuestionMap.has(i.questionId || '')),
    ];
  }

  // Nếu vẫn còn câu có lỗi ERROR sau 2 vòng thử lại:
  // Đánh dấu needsReview = true kèm reviewNote mô tả lỗi
  allCollectedIssues.forEach((issue) => {
    if (issue.severity === 'ERROR' && issue.questionId) {
      currentQuestions = currentQuestions.map((q) => {
        if (q.id === issue.questionId) {
          const isMissingFigure = issue.criterion === 10 && (issue.message.includes('thiếu dữ liệu hình') || issue.message.includes('figure') || issue.message.includes('bảng'));
          const isInvalidOptions = issue.criterion === 5 && (issue.message.includes('phương án') || issue.message.includes('MCQ4'));
          const isSolverMismatch = issue.criterion === 8;
          const noteText = isInvalidOptions
            ? 'Câu này chưa có phương án hợp lệ'
            : isMissingFigure
            ? 'Câu này đang thiếu hình'
            : isSolverMismatch
            ? `AI giải ra đáp số khác: ${q.aiSolvedAnswer || 'khác đáp án'}`
            : q.reviewNote
            ? `${q.reviewNote} | ${issue.message}`
            : `Lỗi chất lượng: ${issue.message}`;

          return {
            ...q,
            needsReview: true,
            reviewNote: noteText,
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
