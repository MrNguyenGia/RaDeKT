/**
 * Logic THUẦN CODE (Không gọi AI).
 * Mục đích:
 * - Kiểm tra tính hợp lệ của cấu hình đề thi (ExamConfig) trước khi sinh đề.
 * - Kiểm tra tổng tỷ lệ phần trăm các mức độ: NB + TH + VD + VDC = 100%.
 * - Kiểm tra số câu hỏi tối thiểu, thời gian làm bài, tính tương thích giữa cấp học và định dạng câu hỏi.
 * - Sẽ trả về danh sách cảnh báo hoặc lỗi nếu cấu hình chưa chuẩn.
 */

import { BlueprintSlot, Exam, ExamConfig, Question, QuestionType } from '../types';
import {
  ESTIMATED_MINUTES_PER_QUESTION,
  QUESTION_TYPE_LABELS,
  QUESTION_TYPES_ORDER,
} from '../config';
import { compile } from 'mathjs';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface QualityIssue {
  questionId?: string;
  criterion: number; // 1 đến 12
  severity: 'ERROR' | 'WARN';
  message: string;
  suggestedFix?: string;
}

/**
 * Kiểm tra tính hợp lệ của cấu hình đề
 */
export function validateExamConfig(config: ExamConfig): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Kiểm tra cấp học bắt buộc
  if (!config.schoolLevel) {
    errors.push('Chưa chọn cấp học (Tiểu học, THCS hoặc THPT).');
  }

  // Kiểm tra khối lớp bắt buộc
  if (!config.grade) {
    errors.push('Chưa chọn khối lớp học.');
  }

  // Kiểm tra môn học bắt buộc (ưu tiên customSubject nếu có)
  const effectiveSubj = config.customSubject?.trim() || config.subject?.trim();
  if (!effectiveSubj) {
    errors.push('Chưa chọn môn học hoặc nhập môn học khác.');
  }

  // Kiểm tra chế độ UPLOAD_ONLY yêu cầu có tài liệu tải lên hoặc đoạn dán
  if (config.knowledgeSource === 'UPLOAD_ONLY') {
    const hasFiles = Boolean(config.referenceDocs && config.referenceDocs.length > 0);
    const hasSnippets = Boolean(config.referenceSnippets && config.referenceSnippets.length > 0);
    const hasRawText = Boolean(config.rawLessonContent && config.rawLessonContent.trim().length > 0);

    if (!hasFiles && !hasSnippets && !hasRawText) {
      errors.push("Chế độ 'Chỉ sử dụng tài liệu tải lên' yêu cầu phải có ít nhất một file tải lên hoặc đoạn văn bản được dán.");
    }
  }

  const totalQuestions = Object.values(config.questionCountsByType || {}).reduce(
    (sum, count) => sum + (count || 0),
    0
  );

  if (totalQuestions <= 0) {
    errors.push('Tổng số lượng câu hỏi phải lớn hơn 0.');
  }

  // Kiểm tra phân bổ mức độ nhận thức
  if (config.levelMode === 'COUNT' && config.levelCounts) {
    const totalLevelCount =
      (config.levelCounts.NB || 0) +
      (config.levelCounts.TH || 0) +
      (config.levelCounts.VD || 0) +
      (config.use3LevelsPrimary ? 0 : (config.levelCounts.VDC || 0));

    if (totalLevelCount !== totalQuestions) {
      errors.push(`Tổng số câu theo 4 mức độ (${totalLevelCount} câu) không khớp với tổng số câu của đề (${totalQuestions} câu).`);
    }
  } else if (config.levelDistribution) {
    const totalPercent =
      config.levelDistribution.nbPercent +
      config.levelDistribution.thPercent +
      config.levelDistribution.vdPercent +
      (config.use3LevelsPrimary ? 0 : config.levelDistribution.vdcPercent);

    if (Math.abs(totalPercent - 100) > 0.01) {
      errors.push(`Tổng tỷ lệ phân bổ mức độ nhận thức phải bằng 100% (hiện tại: ${totalPercent}%).`);
    }
  }

  // Kiểm tra thời gian làm bài
  if (config.durationMinutes <= 0) {
    errors.push('Thời gian làm bài phải lớn hơn 0 phút.');
  }

  // Kiểm tra thang điểm
  if ((config.scale || 10) <= 0) {
    errors.push('Thang điểm của đề phải lớn hơn 0.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

export interface BlueprintCheckDiscrepancy {
  slotId: string;
  reason: string;
}

export interface BlueprintCheckResult {
  isValid: boolean;
  discrepancies: BlueprintCheckDiscrepancy[];
}

/**
 * So sánh bộ câu hỏi đã sinh với danh sách BlueprintSlot:
 * - So sánh số câu theo dạng, theo mức, theo chủ đề và điểm từng câu
 * - Trả về danh sách ô bị lệch (slotId, lý do)
 */
export function checkAgainstBlueprint(
  questions: Question[],
  blueprint: BlueprintSlot[]
): BlueprintCheckResult {
  const discrepancies: BlueprintCheckDiscrepancy[] = [];

  const questionMap = new Map<string, Question>();
  questions.forEach((q) => {
    questionMap.set(q.slotId, q);
  });

  blueprint.forEach((slot) => {
    const q = questionMap.get(slot.id);
    if (!q) {
      discrepancies.push({
        slotId: slot.id,
        reason: `Thiếu câu hỏi cho ô Câu ${slot.orderNumber} (Dạng: ${slot.questionType}, Mức: ${slot.level}, Chủ đề: ${slot.topic}).`,
      });
      return;
    }

    if (q.type !== slot.questionType) {
      discrepancies.push({
        slotId: slot.id,
        reason: `Sai dạng câu: Kỳ vọng ${slot.questionType}, thực tế là ${q.type}.`,
      });
    }

    if (q.level !== slot.level) {
      discrepancies.push({
        slotId: slot.id,
        reason: `Sai mức độ nhận thức: Kỳ vọng ${slot.level}, thực tế là ${q.level}.`,
      });
    }

    if (slot.topic && q.topic && slot.topic !== q.topic) {
      discrepancies.push({
        slotId: slot.id,
        reason: `Lệch chủ đề kiến thức: Kỳ vọng "${slot.topic}", thực tế là "${q.topic}".`,
      });
    }

    if (Math.abs(q.score - slot.score) > 0.001) {
      discrepancies.push({
        slotId: slot.id,
        reason: `Lệch điểm số: Kỳ vọng ${slot.score}đ, thực tế là ${q.score}đ.`,
      });
    }
  });

  return {
    isValid: discrepancies.length === 0,
    discrepancies,
  };
}

/**
 * Chuẩn hóa văn bản câu hỏi phục vụ so sánh độ tương đồng (Tiêu chí 4)
 */
function normalizeTextForComparison(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Khử dấu tiếng Việt để so sánh ngữ nghĩa cốt lõi
    .replace(/\$[^\$]+\$/g, ' MATH ') // Thay thế biểu thức LaTeX nội dòng
    .replace(/\$\$[^\$]+\$\$/g, ' MATH ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tính toán độ tương đồng giữa hai chuỗi văn bản (Jaccard similarity trên tập từ)
 */
function calculateTextSimilarity(a: string, b: string): number {
  const normA = normalizeTextForComparison(a);
  const normB = normalizeTextForComparison(b);
  if (!normA || !normB) return 0;
  if (normA === normB) return 1.0;

  const wordsA = new Set(normA.split(' ').filter((w) => w.length > 1));
  const wordsB = new Set(normB.split(' ').filter((w) => w.length > 1));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersection = 0;
  wordsA.forEach((w) => {
    if (wordsB.has(w)) intersection++;
  });
  const union = new Set([...wordsA, ...wordsB]).size;
  return union > 0 ? intersection / union : 0;
}

/**
 * HỆ THỐNG KIỂM TRA CHẤT LƯỢNG BẰNG CODE (Tiêu chí 1 đến 7)
 * Chạy trực tiếp trên trình duyệt hoặc máy chủ, tốc độ tức thời (< 50ms)
 */
export function runCodeQualityCheck(exam: Exam): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const questions = exam.questions || [];
  const config = exam.config;
  const blueprint = exam.blueprint || [];

  // =========================================================================
  // TIÊU CHÍ 1: Đúng số câu theo từng dạng (CODE)
  // =========================================================================
  const configCounts = config.questionCountsByType || {};
  const actualCountsByType: Partial<Record<QuestionType, number>> = {};
  questions.forEach((q) => {
    actualCountsByType[q.type] = (actualCountsByType[q.type] || 0) + 1;
  });

  QUESTION_TYPES_ORDER.forEach((type) => {
    const expected = configCounts[type] || 0;
    const actual = actualCountsByType[type] || 0;
    if (expected > 0 || actual > 0) {
      if (actual !== expected) {
        issues.push({
          criterion: 1,
          severity: 'ERROR',
          message: `Dạng ${QUESTION_TYPE_LABELS[type]?.short || type}: Đề có ${actual} câu, nhưng thiết lập yêu cầu ${expected} câu.`,
          suggestedFix: `Bổ sung hoặc giảm bớt câu hỏi dạng ${QUESTION_TYPE_LABELS[type]?.short || type} để khớp ${expected} câu.`,
        });
      }
    }
  });

  // =========================================================================
  // TIÊU CHÍ 2: Đúng phân bổ mức độ (CODE)
  // =========================================================================
  if (blueprint.length > 0) {
    const expectedLevels: Record<string, number> = { NB: 0, TH: 0, VD: 0, VDC: 0 };
    blueprint.forEach((s) => {
      if (expectedLevels[s.level] !== undefined) expectedLevels[s.level]++;
    });

    const actualLevels: Record<string, number> = { NB: 0, TH: 0, VD: 0, VDC: 0 };
    questions.forEach((q) => {
      if (actualLevels[q.level] !== undefined) actualLevels[q.level]++;
    });

    (['NB', 'TH', 'VD', 'VDC'] as const).forEach((lvl) => {
      const exp = expectedLevels[lvl] || 0;
      const act = actualLevels[lvl] || 0;
      if (act !== exp) {
        const lvlName = lvl === 'NB' ? 'Nhận biết' : lvl === 'TH' ? 'Thông hiểu' : lvl === 'VD' ? 'Vận dụng' : 'Vận dụng cao';
        issues.push({
          criterion: 2,
          severity: 'ERROR',
          message: `Mức độ ${lvlName} (${lvl}): Đề có ${act} câu, ma trận yêu cầu ${exp} câu.`,
          suggestedFix: `Điều chỉnh mức độ nhận thức của các câu hỏi cho đúng phân bổ ma trận.`,
        });
      }
    });
  }

  // =========================================================================
  // TIÊU CHÍ 3: Đúng tổng điểm và điểm từng câu (CODE)
  // =========================================================================
  let totalScore = 0;
  const targetScale = config.scale || 10;
  const slotMap = new Map<string, BlueprintSlot>();
  blueprint.forEach((s) => slotMap.set(s.id, s));

  questions.forEach((q, idx) => {
    const qNum = idx + 1;
    totalScore += q.score || 0;

    if (!q.score || q.score <= 0) {
      issues.push({
        questionId: q.id,
        criterion: 3,
        severity: 'ERROR',
        message: `Câu ${qNum} có điểm số không hợp lệ (${q.score}đ). Điểm câu hỏi phải > 0.`,
        suggestedFix: `Gán lại điểm số hợp lệ cho Câu ${qNum}.`,
      });
    }

    const matchedSlot = slotMap.get(q.slotId);
    if (matchedSlot && Math.abs(q.score - matchedSlot.score) > 0.005) {
      issues.push({
        questionId: q.id,
        criterion: 3,
        severity: 'ERROR',
        message: `Câu ${qNum} có điểm (${q.score}đ) lệch với ma trận thiết kế (${matchedSlot.score}đ).`,
        suggestedFix: `Đặt lại điểm câu hỏi thành ${matchedSlot.score}đ theo đúng ma trận.`,
      });
    }
  });

  if (Math.abs(totalScore - targetScale) > 0.02) {
    issues.push({
      criterion: 3,
      severity: 'ERROR',
      message: `Tổng điểm toàn bài thi (${totalScore.toFixed(2)}đ) không khớp thang điểm yêu cầu (${targetScale}đ). Lệch ${(totalScore - targetScale).toFixed(2)}đ.`,
      suggestedFix: `Cân đối lại điểm số các câu hỏi để tổng điểm đạt chính xác ${targetScale}đ.`,
    });
  }

  // =========================================================================
  // TIÊU CHÍ 4: Không trùng lặp câu hỏi (CODE: chuẩn hóa văn bản rồi so độ giống)
  // =========================================================================
  for (let i = 0; i < questions.length; i++) {
    for (let j = i + 1; j < questions.length; j++) {
      const qA = questions[i];
      const qB = questions[j];
      const sim = calculateTextSimilarity(qA.question, qB.question);

      if (sim >= 0.70) {
        issues.push({
          questionId: qB.id,
          criterion: 4,
          severity: 'ERROR',
          message: `Câu ${j + 1} có nội dung tương đồng ${(sim * 100).toFixed(0)}% với Câu ${i + 1}. Nghi vấn trùng lặp.`,
          suggestedFix: `Biên soạn lại nội dung Câu ${j + 1} với ngữ cảnh, dữ liệu hoặc đại lượng khác.`,
        });
      }
    }

    // Kiểm tra trùng lặp trong các phương án của câu trắc nghiệm
    const q = questions[i];
    if (q.type === 'MCQ4' && Array.isArray(q.options) && q.options.length >= 2) {
      const optionTexts = q.options.map((opt) =>
        opt.replace(/^[A-D]\.\s*/i, '').trim().toLowerCase()
      );
      const uniqueOptions = new Set(optionTexts);
      if (uniqueOptions.size < optionTexts.length) {
        issues.push({
          questionId: q.id,
          criterion: 4,
          severity: 'ERROR',
          message: `Câu ${i + 1} có các phương án lựa chọn trùng lặp nội dung với nhau.`,
          suggestedFix: `Đổi các phương án trùng lặp thành các giá trị nhiễu khác.`,
        });
      }
    }
  }

  // =========================================================================
  // TIÊU CHÍ 5: Cấu trúc câu hợp lệ (CODE)
  // =========================================================================
  questions.forEach((q, idx) => {
    const qNum = idx + 1;

    // Kiểm tra nội dung câu hỏi
    if (!q.question || q.question.trim().length < 8) {
      issues.push({
        questionId: q.id,
        criterion: 5,
        severity: 'ERROR',
        message: `Câu ${qNum} để trống hoặc nội dung quá ngắn (${(q.question || '').length} ký tự).`,
        suggestedFix: `Bổ sung đề bài đầy đủ cho Câu ${qNum}.`,
      });
    }

    // Kiểm tra trắc nghiệm 4 lựa chọn (MCQ4)
    if (q.type === 'MCQ4') {
      if (!Array.isArray(q.options) || q.options.length < 4) {
        issues.push({
          questionId: q.id,
          criterion: 5,
          severity: 'ERROR',
          message: `Câu ${qNum} (MCQ4) không đủ 4 phương án lựa chọn (hiện có ${q.options?.length || 0}/4).`,
          suggestedFix: `Bổ sung đủ 4 phương án A, B, C, D cho Câu ${qNum}.`,
        });
      } else {
        const hasEmptyOpt = q.options.some((opt) => !opt || opt.replace(/^[A-D]\.\s*/i, '').trim().length === 0);
        if (hasEmptyOpt) {
          issues.push({
            questionId: q.id,
            criterion: 5,
            severity: 'ERROR',
            message: `Câu ${qNum} có phương án lựa chọn bị để trống.`,
            suggestedFix: `Điền đầy đủ nội dung cho tất cả phương án của Câu ${qNum}.`,
          });
        }
      }
    }

    // Kiểm tra Đúng/Sai (TRUE_FALSE)
    if (q.type === 'TRUE_FALSE') {
      if (!Array.isArray(q.statements) || q.statements.length < 2) {
        issues.push({
          questionId: q.id,
          criterion: 5,
          severity: 'ERROR',
          message: `Câu Đúng/Sai ${qNum} thiếu các mệnh đề (cần từ 2 đến 4 ý).`,
          suggestedFix: `Bổ sung các ý a), b), c), d) cho Câu ${qNum}.`,
        });
      }
    }

    // Kiểm tra Ghép nối (MATCHING)
    if (q.type === 'MATCHING') {
      if (!Array.isArray(q.pairs) || q.pairs.length < 2) {
        issues.push({
          questionId: q.id,
          criterion: 5,
          severity: 'ERROR',
          message: `Câu Ghép nối ${qNum} không đủ tối thiểu 2 cặp ghép.`,
          suggestedFix: `Thêm các cặp ghép nối cho Câu ${qNum}.`,
        });
      }
    }

    // Kiểm tra Điền khuyết (FILL_BLANK)
    if (q.type === 'FILL_BLANK') {
      const hasBlank = /\[\d+\]|___|\.\.\.|\(\.\.\.\)/.test(q.question);
      if (!hasBlank) {
        issues.push({
          questionId: q.id,
          criterion: 5,
          severity: 'WARN',
          message: `Câu Điền khuyết ${qNum} chưa có ký hiệu ô trống như [1], [2] hoặc ______.`,
          suggestedFix: `Thêm vị trí điền khuyết [1], [2] vào nội dung câu hỏi.`,
        });
      }
    }
  });

  // =========================================================================
  // TIÊU CHÍ 6: Đủ đáp án, lời giải, hướng dẫn chấm có tổng điểm đúng (CODE)
  // =========================================================================
  questions.forEach((q, idx) => {
    const qNum = idx + 1;

    // Kiểm tra đáp án
    if (!q.correctAnswer || !q.correctAnswer.trim()) {
      issues.push({
        questionId: q.id,
        criterion: 6,
        severity: 'ERROR',
        message: `Câu ${qNum} chưa có đáp án đúng.`,
        suggestedFix: `Bổ sung đáp án đúng cho Câu ${qNum}.`,
      });
    }

    // Kiểm tra lời giải
    if (!q.explanation || q.explanation.trim().length < 5) {
      issues.push({
        questionId: q.id,
        criterion: 6,
        severity: 'WARN',
        message: `Câu ${qNum} thiếu lời giải chi tiết hoặc hướng dẫn giải.`,
        suggestedFix: `Thêm lời giải từng bước để học sinh và giáo viên đối chiếu.`,
      });
    }

    // Kiểm tra hướng dẫn chấm câu tự luận (ESSAY)
    if (q.type === 'ESSAY') {
      if (!q.scoringGuide || q.scoringGuide.trim().length < 10) {
        issues.push({
          questionId: q.id,
          criterion: 6,
          severity: 'ERROR',
          message: `Câu tự luận ${qNum} (${q.score}đ) thiếu hướng dẫn chấm hoặc barem điểm chi tiết.`,
          suggestedFix: `Bổ sung barem điểm chi tiết cho từng ý đạt điểm của Câu ${qNum}.`,
        });
      }
    }
  });

  // =========================================================================
  // TIÊU CHÍ 7: Thời lượng làm bài hợp lý (CODE, chỉ cảnh báo WARN)
  // =========================================================================
  let totalEstimatedMinutes = 0;
  questions.forEach((q) => {
    const typeMinutes = ESTIMATED_MINUTES_PER_QUESTION[q.type]?.[q.level] || 2;
    totalEstimatedMinutes += typeMinutes;
  });

  const durationMinutes = config.durationMinutes || 45;
  if (totalEstimatedMinutes > durationMinutes * 1.3) {
    issues.push({
      criterion: 7,
      severity: 'WARN',
      message: `Thời lượng giải đề ước tính (~${Math.round(totalEstimatedMinutes)} phút) vượt quá thời gian làm bài (${durationMinutes} phút). Học sinh có thể không kịp làm hết đề.`,
      suggestedFix: `Cân nhắc giảm bớt số câu Vận dụng / Vận dụng cao hoặc tăng thời gian làm bài lên.`,
    });
  } else if (totalEstimatedMinutes < durationMinutes * 0.55 && questions.length > 0) {
    issues.push({
      criterion: 7,
      severity: 'WARN',
      message: `Thời lượng giải đề ước tính (~${Math.round(totalEstimatedMinutes)} phút) ngắn hơn đáng kể so với thời gian làm bài (${durationMinutes} phút).`,
      suggestedFix: `Có thể bổ sung thêm câu hỏi hoặc nâng độ khó để phù hợp thời lượng ${durationMinutes} phút.`,
    });
  }

  // =========================================================================
  // TIÊU CHÍ 10: Kiểm tra hình vẽ, đồ thị và tính khớp của hàm số
  // =========================================================================
  const FIGURE_KEYWORDS = ['hình vẽ', 'hình bên', 'đồ thị', 'bảng biến thiên', 'biểu đồ'];

  questions.forEach((q, idx) => {
    const qNum = idx + 1;
    const qLower = (q.question || '').toLowerCase();
    const hasFigureKeyword = FIGURE_KEYWORDS.some((kw) => qLower.includes(kw));
    const hasFigureData = Boolean(
      q.imageData?.dataUrl || q.figure || (q.svgDiagram && q.svgDiagram.trim().startsWith('<svg'))
    );

    // 1. Nhắc tới hình nhưng không có figure
    if (hasFigureKeyword && !hasFigureData) {
      issues.push({
        questionId: q.id,
        criterion: 10,
        severity: 'ERROR',
        message: `Câu ${qNum} có nhắc tới hình ảnh/đồ thị nhưng thiếu dữ liệu hình vẽ (figure).`,
        suggestedFix: 'phải kèm figure hoặc bỏ phụ thuộc hình',
      });
    }

    // 2. Câu đồ thị có optionExprs: tính giá trị hàm trong figure và hàm phương án đúng tại 10 điểm
    if (
      q.figure &&
      q.figure.kind === 'function-graph' &&
      Array.isArray(q.figure.functions) &&
      q.figure.functions.length > 0 &&
      Array.isArray(q.optionExprs) &&
      q.optionExprs.length === 4
    ) {
      const letters = ['A', 'B', 'C', 'D'];
      const correctIdx = letters.indexOf((q.correctAnswer || '').trim().toUpperCase());
      if (correctIdx >= 0 && correctIdx < q.optionExprs.length) {
        const correctExpr = q.optionExprs[correctIdx];
        const figureExpr = q.figure.functions[0].expr;

        try {
          const fnFigure = compile(figureExpr);
          const fnCorrect = compile(correctExpr);
          const [minX, maxX] = q.figure.xRange || [-3, 3];

          let mismatchCount = 0;
          let validComparisons = 0;
          for (let step = 0; step < 10; step++) {
            const testX = minX + (step + 0.5) * ((maxX - minX) / 10);
            try {
              const yFig = fnFigure.evaluate({ x: testX });
              const yCorr = fnCorrect.evaluate({ x: testX });
              if (
                typeof yFig === 'number' &&
                typeof yCorr === 'number' &&
                isFinite(yFig) &&
                isFinite(yCorr)
              ) {
                validComparisons++;
                if (Math.abs(yFig - yCorr) > 0.05) {
                  mismatchCount++;
                }
              }
            } catch {
              // Điểm gián đoạn không tính
            }
          }

          if (validComparisons >= 3 && mismatchCount > 0) {
            issues.push({
              questionId: q.id,
              criterion: 10,
              severity: 'ERROR',
              message: `Câu ${qNum}: Hàm số trong hình (${figureExpr}) không khớp với hàm số của đáp án đúng ${letters[correctIdx]} (${correctExpr}).`,
              suggestedFix: `Đồng bộ biểu thức của đáp án đúng với đồ thị trong hình.`,
            });
          }
        } catch (compileErr: any) {
          issues.push({
            questionId: q.id,
            criterion: 10,
            severity: 'ERROR',
            message: `Câu ${qNum}: Lỗi biểu thức toán trong figure hoặc optionExprs: ${compileErr?.message}`,
            suggestedFix: `Kiểm tra cú pháp mathjs của biểu thức hàm số.`,
          });
        }
      }
    }
  });

  return issues;
}
