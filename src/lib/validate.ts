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

export const FIGURE_TRIGGER_PHRASES = [
  'hình vẽ',
  'hình bên',
  'hình dưới',
  'như hình',
  'bảng biến thiên',
  'bảng xét dấu',
  'đồ thị như',
  'đường cong trong hình',
  'biểu đồ sau',
];

/**
 * Phát hiện mẫu bảng xét dấu / bảng biến thiên viết thành chữ thường trong câu dẫn:
 * Từ 2 ký hiệu vô cực (∞, -\infty, +\infty) trở lên kèm chữ f'(x) hoặc y'
 */
export function hasPlainTextTablePattern(text?: string): boolean {
  if (!text) return false;
  // Đếm số ký hiệu vô cực: ∞, -\infty, +\infty, \infty
  const infMatches = text.match(/(?:-\\infty|\+\\infty|\\infty|[-−]?\s*∞)/gi) || [];
  const infCount = infMatches.length;

  // Kiểm tra đạo hàm f'(x), f′(x), y', y′
  const hasDeriv = /(?:f['′`]\s*\(\s*x\s*\)|y['′`]|f\^\(?1\)?\s*\(x\))/i.test(text);

  return infCount >= 2 && hasDeriv;
}

/**
 * Trả về true nếu câu dẫn chứa một trong các cụm từ yêu cầu hình minh họa/bảng
 * hoặc chứa chuỗi bảng xét dấu/biến thiên dạng chữ thường
 */
export function questionNeedsFigure(q: { question?: string }): boolean {
  const text = (q.question || '').toLowerCase();
  const hasTrigger = FIGURE_TRIGGER_PHRASES.some((phrase) => text.includes(phrase));
  if (hasTrigger) return true;
  return hasPlainTextTablePattern(q.question);
}

/**
 * Dự đoán loại figure cần có dựa vào nội dung câu hỏi
 */
export function detectRequiredFigureKind(
  qText?: string
): 'sign-table' | 'variation-table' | 'function-graph' | 'data-chart' | 'geometry' {
  const text = (qText || '').toLowerCase();
  if (hasPlainTextTablePattern(qText)) {
    if (text.includes('biến thiên') || text.includes('mũi tên') || text.includes('y =')) return 'variation-table';
    return 'sign-table';
  }
  if (text.includes('bảng xét dấu')) return 'sign-table';
  if (text.includes('bảng biến thiên')) return 'variation-table';
  if (text.includes('đồ thị') || text.includes('đường cong')) return 'function-graph';
  if (text.includes('biểu đồ')) return 'data-chart';
  if (text.includes('hàm số') || text.includes('f(x)') || text.includes('y =')) return 'function-graph';
  return 'geometry';
}

/**
 * Kiểm tra tính hợp lệ của đối tượng QuestionFigure
 */
export function validateFigure(kind: string, obj: any): { isValid: boolean; error?: string } {
  if (!obj || typeof obj !== 'object') {
    return { isValid: false, error: 'Dữ liệu figure không phải là đối tượng hợp lệ.' };
  }

  const effectiveKind = obj.kind || kind;
  if (!effectiveKind) {
    return { isValid: false, error: 'Thiếu trường "kind" trong figure.' };
  }

  switch (effectiveKind) {
    case 'function-graph': {
      if (!Array.isArray(obj.functions) || obj.functions.length === 0) {
        return { isValid: false, error: 'function-graph cần ít nhất một hàm số trong mảng functions.' };
      }
      for (let i = 0; i < obj.functions.length; i++) {
        const fn = obj.functions[i];
        if (!fn || typeof fn.expr !== 'string' || !fn.expr.trim()) {
          return { isValid: false, error: `Hàm số thứ ${i + 1} thiếu biểu thức expr.` };
        }
        try {
          compile(fn.expr);
        } catch (e: any) {
          return {
            isValid: false,
            error: `Biểu thức hàm số "${fn.expr}" không parse được: ${e?.message || 'Lỗi cú pháp mathjs'}`,
          };
        }
      }
      if (!Array.isArray(obj.xRange) || obj.xRange.length !== 2) {
        return { isValid: false, error: 'xRange phải là mảng gồm 2 số [minX, maxX].' };
      }
      if (
        typeof obj.xRange[0] !== 'number' ||
        typeof obj.xRange[1] !== 'number' ||
        obj.xRange[0] >= obj.xRange[1]
      ) {
        return { isValid: false, error: 'xRange không hợp lệ (minX phải nhỏ hơn maxX).' };
      }
      return { isValid: true };
    }

    case 'variation-table': {
      if (!Array.isArray(obj.xValues) || obj.xValues.length < 2) {
        return { isValid: false, error: 'variation-table cần xValues gồm ít nhất 2 mốc.' };
      }
      if (!Array.isArray(obj.yValues) || obj.yValues.length < 2) {
        return { isValid: false, error: 'variation-table cần yValues gồm ít nhất 2 giá trị.' };
      }
      if (!Array.isArray(obj.trends) || obj.trends.length < 1) {
        return { isValid: false, error: 'variation-table cần mảng trends chỉ hướng mũi tên (up/down).' };
      }
      for (const t of obj.trends) {
        if (t !== 'up' && t !== 'down') {
          return { isValid: false, error: `Giá trị trend "${t}" không hợp lệ, phải là "up" hoặc "down".` };
        }
      }
      return { isValid: true };
    }

    case 'sign-table': {
      if (!obj.rowLabel || typeof obj.rowLabel !== 'string') {
        return { isValid: false, error: 'sign-table cần có nhãn rowLabel (ví dụ "f\'(x)" hoặc "y\'").' };
      }
      if (!Array.isArray(obj.xValues) || obj.xValues.length < 2) {
        return { isValid: false, error: 'sign-table cần xValues có ít nhất 2 mốc giá trị.' };
      }
      const expectedIntervals = obj.xValues.length - 1;
      if (!Array.isArray(obj.intervalSigns) || obj.intervalSigns.length !== expectedIntervals) {
        return {
          isValid: false,
          error: `sign-table có ${obj.xValues.length} mốc x thì intervalSigns phải có độ dài là ${expectedIntervals} (hiện có ${obj.intervalSigns?.length || 0}).`,
        };
      }
      for (const s of obj.intervalSigns) {
        if (s !== '+' && s !== '-') {
          return { isValid: false, error: `Dấu "${s}" trong intervalSigns không hợp lệ, phải là "+" hoặc "-".` };
        }
      }
      const expectedPoints = obj.xValues.length - 2;
      if (!Array.isArray(obj.pointMarks) || obj.pointMarks.length !== expectedPoints) {
        return {
          isValid: false,
          error: `sign-table có ${obj.xValues.length} mốc x thì pointMarks phải có độ dài là ${expectedPoints} (hiện có ${obj.pointMarks?.length || 0}).`,
        };
      }
      for (const pm of obj.pointMarks) {
        if (pm !== '0' && pm !== '||' && pm !== '') {
          return { isValid: false, error: `Ký hiệu "${pm}" trong pointMarks không hợp lệ, phải là '0', '||' hoặc ''.` };
        }
      }
      return { isValid: true };
    }

    case 'geometry': {
      if (!Array.isArray(obj.points) || obj.points.length < 2) {
        return { isValid: false, error: 'geometry cần ít nhất 2 điểm trong mảng points.' };
      }
      return { isValid: true };
    }

    case 'data-chart': {
      if (!Array.isArray(obj.labels) || obj.labels.length === 0) {
        return { isValid: false, error: 'data-chart cần ít nhất một nhãn trong mảng labels.' };
      }
      if (!Array.isArray(obj.series) || obj.series.length === 0) {
        return { isValid: false, error: 'data-chart cần ít nhất một chuỗi số liệu trong mảng series.' };
      }
      return { isValid: true };
    }

    case 'none':
      return { isValid: true };

    default:
      return { isValid: false, error: `Loại hình vẽ "${effectiveKind}" không được hỗ trợ.` };
  }
}

/**
 * Kiểm tra lời giải tự mâu thuẫn với đáp án hoặc tự ý đổi đề (Tiêu chí 6):
 * - explanation hoặc scoringGuide chứa: "Tuy nhiên, nếu đề bài", "giả sử đề bài", "như bản gốc",
 *   "kiểm tra lại tính toán", "không có giá trị nào", "không thỏa mãn" -> ERROR
 */
export function detectSelfContradictoryExplanation(q: {
  explanation?: string;
  scoringGuide?: string;
  correctAnswer?: string;
  type?: QuestionType;
  options?: string[];
}): { isContradictory: boolean; reason?: string; phrase?: string } {
  const text = `${q.explanation || ''} ${q.scoringGuide || ''}`.toLowerCase();
  if (!text.trim()) return { isContradictory: false };

  // 1. Nhóm đổi đề hoặc tự ý giả thiết
  if (/tuy nhiên,?\s*nếu đề bài/i.test(text)) {
    return {
      isContradictory: true,
      phrase: 'Tuy nhiên, nếu đề bài',
      reason: 'Lời giải tự mâu thuẫn: chứa cụm "Tuy nhiên, nếu đề bài" (đổi đề giữa chừng).',
    };
  }

  if (/giả sử đề bài/i.test(text)) {
    return {
      isContradictory: true,
      phrase: 'giả sử đề bài',
      reason: 'Lời giải tự mâu thuẫn: chứa cụm "giả sử đề bài" (tự ý thay đổi giả thiết đề thi).',
    };
  }

  if (/như bản gốc/i.test(text)) {
    return {
      isContradictory: true,
      phrase: 'như bản gốc',
      reason: 'Lời giải tự mâu thuẫn: chứa cụm "như bản gốc".',
    };
  }

  if (/kiểm tra lại tính toán/i.test(text)) {
    return {
      isContradictory: true,
      phrase: 'kiểm tra lại tính toán',
      reason: 'Lời giải tự mâu thuẫn: chứa cụm "kiểm tra lại tính toán" (nghi vấn sai đề).',
    };
  }

  // 2. Nhóm "không có giá trị nào"
  if (/không có giá trị nào/i.test(text)) {
    return {
      isContradictory: true,
      phrase: 'không có giá trị nào',
      reason: 'Lời giải tự mâu thuẫn: kết luận "không có giá trị nào" nhưng đề bài vẫn có đáp án.',
    };
  }

  // 3. Nhóm "không thỏa mãn"
  if (
    /không có\s+.*thỏa mãn/i.test(text) ||
    /không thỏa mãn\s+(?:đề bài|yêu cầu|bài toán)/i.test(text) ||
    /(?:vậy|kết luận|do đó|suy ra)\s+.*không thỏa mãn/i.test(text) ||
    /đều không thỏa mãn/i.test(text) ||
    /tất cả\s+.*không thỏa mãn/i.test(text)
  ) {
    return {
      isContradictory: true,
      phrase: 'không thỏa mãn',
      reason: 'Lời giải tự mâu thuẫn: kết luận không thỏa mãn yêu cầu bài toán.',
    };
  }

  // Kiểm tra trực tiếp cụm "không thỏa mãn"
  const corr = (q.correctAnswer || '').trim().toLowerCase();
  const corrIsZero = corr === '0' || corr === 'không' || corr === 'vô nghiệm';
  if (
    text.includes('không thỏa mãn') &&
    !corrIsZero &&
    !text.includes('thỏa mãn điều kiện') &&
    !text.includes('loại do không thỏa mãn')
  ) {
    return {
      isContradictory: true,
      phrase: 'không thỏa mãn',
      reason: 'Lời giải tự mâu thuẫn: chứa cụm "không thỏa mãn" mâu thuẫn với đáp án đề thi.',
    };
  }

  return { isContradictory: false };
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
      const letters = ['A', 'B', 'C', 'D'];
      if (!Array.isArray(q.options) || q.options.length !== 4) {
        issues.push({
          questionId: q.id,
          criterion: 5,
          severity: 'ERROR',
          message: `Câu ${qNum} (MCQ4) không đủ 4 phương án lựa chọn (hiện có ${q.options?.length || 0}/4).`,
          suggestedFix: `Bổ sung đủ 4 phương án A, B, C, D cho Câu ${qNum}.`,
        });
      } else {
        const cleanOpts = q.options.map((opt) => (opt ? String(opt).replace(/^[A-D]\.\s*/i, '').trim() : ''));

        // 1. Có phương án rỗng hoặc chỉ gồm khoảng trắng
        const hasEmptyOpt = cleanOpts.some((txt) => txt.length === 0);
        if (hasEmptyOpt) {
          issues.push({
            questionId: q.id,
            criterion: 5,
            severity: 'ERROR',
            message: `Câu ${qNum} có phương án rỗng hoặc chỉ gồm khoảng trắng.`,
            suggestedFix: `Điền đầy đủ nội dung cho tất cả 4 phương án của Câu ${qNum}.`,
          });
        }

        // 2. Có phương án trùng nhau
        const lowerTexts = cleanOpts.map((t) => t.toLowerCase());
        const hasDuplicates = new Set(lowerTexts).size < lowerTexts.length;
        if (hasDuplicates) {
          issues.push({
            questionId: q.id,
            criterion: 5,
            severity: 'ERROR',
            message: `Câu ${qNum} có các phương án lựa chọn trùng nhau.`,
            suggestedFix: `Thay đổi các phương án bị trùng lặp thành các giá trị phân biệt.`,
          });
        }

        // 3. Phương án khớp mẫu “Phương án [A-D]”
        const hasPlaceholderOpt = cleanOpts.some((txt) => /^phương án\s+[a-d]$/i.test(txt));
        if (hasPlaceholderOpt) {
          issues.push({
            questionId: q.id,
            criterion: 5,
            severity: 'ERROR',
            message: `Câu ${qNum} chứa phương án giữ chỗ ("Phương án A/B/C/D").`,
            suggestedFix: `Biên soạn nội dung phương án thực tế thay vì để phương án giữ chỗ.`,
          });
        }

        // 4. Đáp án đúng không nằm trong các phương án
        const corr = (q.correctAnswer || '').trim().toUpperCase();
        const isLetterMatch = letters.includes(corr);
        const isTextMatch = cleanOpts.some((t) => t.length > 0 && t.toLowerCase() === corr.toLowerCase());
        if (!isLetterMatch && !isTextMatch) {
          issues.push({
            questionId: q.id,
            criterion: 5,
            severity: 'ERROR',
            message: `Câu ${qNum} có đáp án đúng ("${q.correctAnswer || 'trống'}") không nằm trong các phương án A, B, C, D.`,
            suggestedFix: `Chọn đáp án đúng nằm trong 4 phương án A, B, C, D đã biên soạn.`,
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

    // Kiểm tra lời giải tự mâu thuẫn hoặc tự ý đổi đề (Tiêu chí 6 -> ERROR)
    const contra = detectSelfContradictoryExplanation(q);
    if (contra.isContradictory) {
      issues.push({
        questionId: q.id,
        criterion: 6,
        severity: 'ERROR',
        message: `Câu ${qNum}: ${contra.reason}`,
        suggestedFix: 'Giải trọn vẹn đúng đề đã cho, không đổi đề trong lời giải, kết luận cuối cùng phải trùng correctAnswer.',
      });
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
  // TIÊU CHÍ 10: Kiểm tra hình vẽ, đồ thị và bảng biến thiên / bảng xét dấu
  // =========================================================================
  questions.forEach((q, idx) => {
    const qNum = idx + 1;
    const needsFig = questionNeedsFigure(q);

    // 1. Nếu câu KHÔNG nhắc hình mà lại có figure -> bỏ figure đó (không vẽ hình thừa)
    if (!needsFig && !q.imageData?.dataUrl && (q.figure || q.svgDiagram)) {
      q.figure = undefined;
      q.svgDiagram = undefined;
    }

    // 2. Kiểm tra tính hợp lệ của figure nếu có
    let isFigureDataValid = false;
    if (q.imageData?.dataUrl) {
      isFigureDataValid = true;
    } else if (q.figure) {
      const figValidation = validateFigure(q.figure.kind, q.figure);
      if (figValidation.isValid) {
        isFigureDataValid = true;
      } else {
        // Figure lỗi cú pháp -> coi như thiếu hình theo mục 1
        q.figure = undefined;
        issues.push({
          questionId: q.id,
          criterion: 10,
          severity: 'ERROR',
          message: `Câu ${qNum}: Dữ liệu hình vẽ không hợp lệ: ${figValidation.error}`,
          suggestedFix: `Sửa lại cấu trúc figure chuẩn hoặc dùng câu hỏi không phụ thuộc hình.`,
        });
      }
    } else if (q.svgDiagram && q.svgDiagram.trim().startsWith('<svg')) {
      isFigureDataValid = true;
    }

    // 3. Câu CẦN hình mà thiếu figure (hoặc imageData) -> lỗi ERROR
    if (needsFig && !isFigureDataValid) {
      const neededKind = detectRequiredFigureKind(q.question);
      const kindHint =
        neededKind === 'variation-table'
          ? 'bảng biến thiên → variation-table'
          : neededKind === 'sign-table'
          ? 'bảng xét dấu → sign-table'
          : neededKind === 'function-graph'
          ? 'đồ thị → function-graph'
          : 'hình vẽ → geometry / data-chart';

      issues.push({
        questionId: q.id,
        criterion: 10,
        severity: 'ERROR',
        message: `Câu ${qNum} có nhắc tới hình ảnh/bảng/đồ thị nhưng thiếu dữ liệu hình vẽ (figure).`,
        suggestedFix: `Bổ sung figureKind="${neededKind}" (${kindHint}).`,
      });
    }

    // 4. CẤM viết bảng xét dấu hoặc bảng biến thiên bằng chữ thường trong câu dẫn
    const textTablePattern = /(\bx\s*\|\s*.*(-\\infty|\\infty|\+\\infty).*\||(\bf'\(x\)|\by'\b|\bf\(x\))\s*\|\s*[\+\-0\s\|]{3,}|x\s+[\-−]\s*∞)/i;
    const hasPlainTable = textTablePattern.test(q.question || '') || hasPlainTextTablePattern(q.question);
    if (hasPlainTable) {
      issues.push({
        questionId: q.id,
        criterion: 10,
        severity: 'ERROR',
        message: `Câu ${qNum}: Cấm viết bảng xét dấu hoặc bảng biến thiên bằng chữ thường trong câu dẫn (ví dụ: chuỗi chứa từ 2 ký hiệu ∞ kèm f'(x) hoặc y'). Bắt buộc dùng figure kiểu sign-table hoặc variation-table.`,
        suggestedFix: `Xóa đoạn bảng text trong đề bài và chuyển vào figureKind="sign-table" hoặc "variation-table".`,
      });
    }

    // 5. Câu đồ thị có optionExprs: tính giá trị hàm trong figure và hàm phương án đúng tại 10 điểm
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

export interface FaultyQuestionInfo {
  index: number;
  question: Question;
  reasons: string[];
}

/**
 * Thu thập toàn bộ câu hỏi đang có lỗi ERROR hoặc needsReview = true
 */
export function getFaultyQuestions(
  questions: Question[],
  config?: ExamConfig,
  currentExam?: Exam
): FaultyQuestionInfo[] {
  const issues = runCodeQualityCheck({
    id: currentExam?.id || 'exam-check',
    title: currentExam?.title || 'Đề kiểm tra',
    config: config || ({} as any),
    blueprint: currentExam?.blueprint || [],
    questions,
    versions: currentExam?.versions || [],
    createdAt: '',
    updatedAt: '',
  });

  const issuesByQId = new Map<string, string[]>();
  issues.forEach((iss) => {
    if (iss.severity === 'ERROR' && iss.questionId) {
      const arr = issuesByQId.get(iss.questionId) || [];
      if (!arr.includes(iss.message)) arr.push(iss.message);
      issuesByQId.set(iss.questionId, arr);
    }
  });

  const result: FaultyQuestionInfo[] = [];

  questions.forEach((q, idx) => {
    const errorReasons = issuesByQId.get(q.id) || [];
    const isFaulty = Boolean(q.needsReview || errorReasons.length > 0);

    if (isFaulty) {
      const reasons: string[] = [];
      if (q.reviewNote) {
        reasons.push(q.reviewNote);
      }
      errorReasons.forEach((r) => {
        if (!reasons.includes(r)) reasons.push(r);
      });
      if (reasons.length === 0) {
        reasons.push('Cần giáo viên kiểm tra nội dung');
      }
      result.push({
        index: idx + 1,
        question: q,
        reasons,
      });
    }
  });

  return result;
}

/**
 * Trả về lý do lỗi ngắn gọn của câu hỏi để chèn chú thích [CẦN KIỂM TRA: lý do]
 */
export function getQuestionErrorNote(q: Question): string | null {
  if (q.reviewNote) return q.reviewNote;
  if (q.type === 'MCQ4') {
    if (!Array.isArray(q.options) || q.options.length !== 4) return 'Không đủ 4 phương án A, B, C, D';
    const cleanOpts = q.options.map((opt) => (opt ? String(opt).replace(/^[A-D]\.\s*/i, '').trim() : ''));
    if (cleanOpts.some((t) => t.length === 0)) return 'Có phương án rỗng hoặc chỉ khoảng trắng';
    if (new Set(cleanOpts.map((t) => t.toLowerCase())).size < cleanOpts.length) return 'Các phương án trùng nhau';
    if (cleanOpts.some((t) => /^phương án\s+[a-d]$/i.test(t))) return 'Chứa phương án giữ chỗ ("Phương án A/B/C/D")';
    const letters = ['A', 'B', 'C', 'D'];
    const corr = (q.correctAnswer || '').trim().toUpperCase();
    if (!letters.includes(corr) && !cleanOpts.some((t) => t.length > 0 && t.toLowerCase() === corr.toLowerCase())) {
      return 'Đáp án đúng không nằm trong các phương án';
    }
  }
  if (questionNeedsFigure(q) && !q.figure && !q.imageData?.dataUrl) {
    return 'Thiếu hình minh họa';
  }
  const contra = detectSelfContradictoryExplanation(q);
  if (contra.isContradictory) {
    return contra.reason || 'Lời giải tự mâu thuẫn với đáp án';
  }
  if (q.needsReview) return 'Cần giáo viên kiểm tra';
  return null;
}
