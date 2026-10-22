import { BlueprintSlot, ExamConfig, Question } from '../types';

export interface QuestionAuditInfo {
  needsReview: boolean;
  notes: string[];
}

export interface ExamAuditResult {
  totalQuestions: number;
  reviewQuestionsCount: number;
  questionAudits: Map<string, QuestionAuditInfo>;
  generalWarnings: string[];
  noSourceWarning: string | null;
  totalScore: number;
  expectedScale: number;
}

/**
 * Tách từ để tính độ tương đồng văn bản (loại bỏ ký tự đặc biệt, dấu câu, chữ thường)
 */
function extractWordSet(text: string): Set<string> {
  const clean = text
    .toLowerCase()
    .replace(/[\$+\-*\/=\\\{\}\(\)\[\]_.,;:?!~`"'<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = clean.split(' ').filter((w) => w.length > 1);
  return new Set(words);
}

/**
 * Tính hệ số tương đồng Jaccard giữa hai tập từ (0 đến 1)
 */
function calculateSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersectionCount = 0;
  setA.forEach((w) => {
    if (setB.has(w)) intersectionCount++;
  });
  const unionCount = setA.size + setB.size - intersectionCount;
  return unionCount === 0 ? 0 : intersectionCount / unionCount;
}

/**
 * Kiểm tra đề tự động hoàn toàn bằng mã CODE (không gọi AI):
 * 1. Kiểm tra tính đầy đủ: thiếu câu, thiếu đáp án, tổng điểm lệch thang điểm.
 * 2. Kiểm tra trùng lặp: các câu hỏi có độ tương đồng văn bản cao (> 70% từ trùng).
 * 3. Kiểm tra độ dài: câu hỏi hoặc đáp án quá dài/quá ngắn bất thường.
 * 4. Cảnh báo "Đề tự tạo hoàn toàn, cần GV kiểm tra kỹ trước khi sử dụng" nếu không có tài liệu nguồn.
 */
export function auditExamQuality(
  questions: Question[],
  config: ExamConfig,
  blueprint: BlueprintSlot[]
): ExamAuditResult {
  const questionAudits = new Map<string, QuestionAuditInfo>();
  const generalWarnings: string[] = [];

  const expectedScale = config.scale || 10;
  const totalScore = questions.reduce((sum, q) => sum + (Number(q.score) || 0), 0);

  // 1. Kiểm tra tổng điểm
  if (Math.abs(totalScore - expectedScale) > 0.05) {
    generalWarnings.push(
      `Tổng điểm của đề (${totalScore.toFixed(2)}đ) lệch so với thang điểm thiết lập (${expectedScale}đ).`
    );
  }

  // 2. Kiểm tra số lượng câu so với blueprint
  if (blueprint.length > 0 && questions.length < blueprint.length) {
    generalWarnings.push(
      `Đề hiện có ${questions.length} câu, thiếu ${blueprint.length - questions.length} câu so với ma trận ${blueprint.length} câu.`
    );
  }

  // 3. Chuẩn bị tập từ để kiểm tra trùng lặp
  const wordSets = questions.map((q) => extractWordSet(q.question || ''));

  // Duyệt từng câu hỏi để kiểm tra chi tiết
  questions.forEach((q, idx) => {
    const notes: string[] = [];

    // Giữ lại ghi chú từ trước nếu có
    if (q.reviewNote && !notes.includes(q.reviewNote)) {
      notes.push(q.reviewNote);
    }

    // A. Kiểm tra độ dài nội dung câu hỏi
    const questionText = (q.question || '').trim();
    const wordCount = questionText.split(/\s+/).filter(Boolean).length;
    if (wordCount < 4) {
      notes.push('Nội dung câu hỏi quá ngắn (dưới 4 từ), có thể chưa đầy đủ dữ kiện.');
    } else if (wordCount > 350 && q.type !== 'ESSAY') {
      notes.push('Nội dung câu hỏi quá dài (>350 từ), có thể gây quá tải đọc hiểu cho trắc nghiệm.');
    }

    // B. Kiểm tra đáp án theo từng dạng câu
    if (q.type === 'MCQ4' || q.type === 'MCQ_MULTI') {
      if (!q.options || q.options.length < 2) {
        notes.push('Thiếu các phương án lựa chọn (cần ít nhất 2 phương án).');
      } else {
        const hasEmptyOpt = q.options.some((opt) => !opt || opt.trim().length <= 2);
        if (hasEmptyOpt) {
          notes.push('Có phương án lựa chọn để trống hoặc quá ngắn.');
        }
      }
      if (!q.correctAnswer || q.correctAnswer.trim() === '') {
        notes.push('Chưa xác định đáp án đúng.');
      }
    } else if (q.type === 'TRUE_FALSE') {
      if (!q.statements || q.statements.length === 0) {
        notes.push('Thiếu danh sách các mệnh đề a, b, c, d.');
      } else {
        const emptyStmt = q.statements.some((st) => !st.statement || st.statement.trim() === '');
        if (emptyStmt) {
          notes.push('Có ý khẳng định để trống nội dung.');
        }
      }
    } else if (q.type === 'MATCHING') {
      if (!q.pairs || q.pairs.length === 0) {
        notes.push('Thiếu các cặp ghép nối ở Cột A và Cột B.');
      }
    } else if (q.type === 'FILL_BLANK' || q.type === 'SHORT_ANSWER') {
      if (!q.correctAnswer || q.correctAnswer.trim() === '') {
        notes.push('Thiếu đáp án chuẩn/từ khóa điền khuyết.');
      }
      if (q.type === 'FILL_BLANK' && !questionText.includes('___') && !questionText.includes('...')) {
        notes.push('Câu điền khuyết nên có dấu gạch ngang (______) làm vị trí cần điền.');
      }
    } else if (q.type === 'ESSAY') {
      if (!q.explanation && !q.scoringGuide) {
        notes.push('Thiếu gợi ý giải hoặc tiêu chí biểu điểm hướng dẫn chấm.');
      }
    }

    // C. Kiểm tra trùng lặp với các câu hỏi khác (> 70% từ trùng)
    for (let j = 0; j < idx; j++) {
      const sim = calculateSimilarity(wordSets[idx], wordSets[j]);
      if (sim >= 0.7) {
        const percent = Math.round(sim * 100);
        notes.push(`Độ tương đồng từ ngữ cao (${percent}%) với Câu ${j + 1}, nghi ngờ trùng lặp nội dung.`);
      }
    }

    const needsReview = notes.length > 0 || Boolean(q.needsReview);

    questionAudits.set(q.id, {
      needsReview,
      notes,
    });
  });

  // 4. Kiểm tra nguồn tài liệu
  const hasFiles = Boolean(config.referenceDocs && config.referenceDocs.length > 0);
  const hasSnippets = Boolean(config.referenceSnippets && config.referenceSnippets.length > 0);
  const hasRawContent = Boolean(config.rawLessonContent && config.rawLessonContent.trim().length > 0);

  let noSourceWarning: string | null = null;
  if (!hasFiles && !hasSnippets && !hasRawContent) {
    noSourceWarning = 'Đề tự tạo hoàn toàn, cần GV kiểm tra kỹ trước khi sử dụng';
  }

  // Đếm tổng số câu cần rà soát
  let reviewQuestionsCount = 0;
  questionAudits.forEach((audit) => {
    if (audit.needsReview) reviewQuestionsCount++;
  });

  return {
    totalQuestions: questions.length,
    reviewQuestionsCount,
    questionAudits,
    generalWarnings,
    noSourceWarning,
    totalScore,
    expectedScale,
  };
}
