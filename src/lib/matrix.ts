/**
 * Logic THUẦN CODE (Không gọi AI).
 * Mô-đun tạo bảng Ma trận đề kiểm tra 2 chiều (Chủ đề / Dạng câu) và Bản đặc tả chi tiết.
 */

import { QUESTION_TYPE_LABELS, QUESTION_TYPES_ORDER } from '../config';
import {
  BlueprintSlot,
  ExamConfig,
  Level,
  MatrixCell,
  MatrixTopic,
  ParsedMatrix,
  Question,
  QuestionType,
} from '../types';

/** Chi tiết của từng ô trong bảng ma trận */
export interface MatrixCellDetail {
  count: number; // Số câu
  score: number; // Tổng số điểm
  percentage: number; // Tỷ lệ % trên tổng điểm (làm tròn 1 chữ số thập phân)
  questionNumbers: number[]; // Danh sách số thứ tự câu (vd: [1, 2, 5])
}

/** Một hàng trong bảng ma trận */
export interface MatrixTableRow {
  id: string;
  name: string; // Tên chủ đề hoặc Tên dạng câu
  cells: Record<Level, MatrixCellDetail>;
  total: MatrixCellDetail;
}

/** Bảng ma trận tổng hợp hoàn chỉnh */
export interface MatrixSummaryTable {
  viewMode: 'TOPIC' | 'QUESTION_TYPE';
  levels: Level[];
  rows: MatrixTableRow[];
  grandTotal: MatrixCellDetail;
}

/** Một dòng đã gộp trong Bản đặc tả đề kiểm tra */
export interface SpecificationRow {
  id: string;
  questionNumbersText: string; // vd: "Câu 1–3" hoặc "Câu 4"
  rawNumbers: number[];
  topic: string;
  learningOutcome: string;
  level: Level;
  questionType: QuestionType;
  questionTypeLabel: string;
  totalScore: number;
  count: number;
}

/**
 * Tạo chi tiết ô trống
 */
function createEmptyCell(): MatrixCellDetail {
  return {
    count: 0,
    score: 0,
    percentage: 0,
    questionNumbers: [],
  };
}

/**
 * Xây dựng bảng ma trận tổng hợp theo CHỦ ĐỀ hoặc DẠNG CÂU
 */
export function buildMatrixSummary(
  slots: BlueprintSlot[],
  config: ExamConfig,
  viewMode: 'TOPIC' | 'QUESTION_TYPE' = 'TOPIC'
): MatrixSummaryTable {
  const use3Levels = Boolean(config.schoolLevel === 'TIEU_HOC' && config.use3LevelsPrimary);
  const levels: Level[] = use3Levels ? ['NB', 'TH', 'VD'] : ['NB', 'TH', 'VD', 'VDC'];
  const targetScale = config.scale || 10;

  // Lấy danh sách hàng theo viewMode
  let rowKeys: { id: string; name: string }[] = [];

  if (viewMode === 'TOPIC') {
    // Thu thập tất cả các chủ đề xuất hiện trong slots (giữ đúng thứ tự)
    const seenTopics = new Set<string>();
    slots.forEach((s) => {
      const topicName = s.topic || 'Kiến thức trọng tâm';
      if (!seenTopics.has(topicName)) {
        seenTopics.add(topicName);
        rowKeys.push({ id: topicName, name: topicName });
      }
    });

    if (rowKeys.length === 0) {
      rowKeys = [{ id: 'default', name: config.topicName || 'Kiến thức trọng tâm' }];
    }
  } else {
    // Theo dạng câu hỏi (chỉ lấy những dạng có câu hỏi)
    const activeTypes = QUESTION_TYPES_ORDER.filter(
      (t) => (config.questionCountsByType?.[t] || 0) > 0 || slots.some((s) => s.questionType === t)
    );
    rowKeys = activeTypes.map((t) => ({
      id: t,
      name: QUESTION_TYPE_LABELS[t]?.label || t,
    }));
  }

  // Khởi tạo các hàng
  const rows: MatrixTableRow[] = rowKeys.map((rk) => {
    const cells: Record<Level, MatrixCellDetail> = {
      NB: createEmptyCell(),
      TH: createEmptyCell(),
      VD: createEmptyCell(),
      VDC: createEmptyCell(),
    };

    return {
      id: rk.id,
      name: rk.name,
      cells,
      total: createEmptyCell(),
    };
  });

  // Điền dữ liệu từ các slots vào các ô
  slots.forEach((slot) => {
    const row = rows.find((r) =>
      viewMode === 'TOPIC'
        ? r.id === (slot.topic || 'Kiến thức trọng tâm')
        : r.id === slot.questionType
    );

    if (row && levels.includes(slot.level)) {
      const cell = row.cells[slot.level];
      cell.count += 1;
      cell.score += slot.score;
      cell.questionNumbers.push(slot.orderNumber);

      row.total.count += 1;
      row.total.score += slot.score;
      row.total.questionNumbers.push(slot.orderNumber);
    }
  });

  // Tính tỷ lệ % cho từng ô của từng hàng
  rows.forEach((row) => {
    levels.forEach((lvl) => {
      const cell = row.cells[lvl];
      cell.score = Number(cell.score.toFixed(2));
      cell.percentage = targetScale > 0
        ? Number(((cell.score / targetScale) * 100).toFixed(1))
        : 0;
    });

    row.total.score = Number(row.total.score.toFixed(2));
    row.total.percentage = targetScale > 0
      ? Number(((row.total.score / targetScale) * 100).toFixed(1))
      : 0;
  });

  // Tính dòng TỔNG (grandTotal) ở cuối
  const grandTotalCells: Record<Level, MatrixCellDetail> = {
    NB: createEmptyCell(),
    TH: createEmptyCell(),
    VD: createEmptyCell(),
    VDC: createEmptyCell(),
  };

  const grandTotal: MatrixCellDetail = {
    count: slots.length,
    score: Number(slots.reduce((s, slot) => s + slot.score, 0).toFixed(2)),
    percentage: 100.0, // Dòng tổng luôn là 100%
    questionNumbers: slots.map((s) => s.orderNumber),
  };

  levels.forEach((lvl) => {
    const lvlSlots = slots.filter((s) => s.level === lvl);
    const lvlScore = Number(lvlSlots.reduce((s, slot) => s + slot.score, 0).toFixed(2));
    const lvlPct = targetScale > 0
      ? Number(((lvlScore / targetScale) * 100).toFixed(1))
      : 0;

    grandTotalCells[lvl] = {
      count: lvlSlots.length,
      score: lvlScore,
      percentage: lvlPct,
      questionNumbers: lvlSlots.map((s) => s.orderNumber),
    };
  });

  return {
    viewMode,
    levels,
    rows,
    grandTotal,
  };
}

/**
 * Định dạng danh sách số câu thành chuỗi gọn gàng:
 * Ví dụ: [1, 2, 3] -> "Câu 1–3"
 * Ví dụ: [4] -> "Câu 4"
 * Ví dụ: [1, 3, 5] -> "Câu 1, 3, 5"
 */
export function formatQuestionRange(numbers: number[]): string {
  if (numbers.length === 0) return '';
  if (numbers.length === 1) return `Câu ${numbers[0]}`;

  const sorted = [...numbers].sort((a, b) => a - b);
  const isConsecutive = sorted.every((num, idx) => idx === 0 || num === sorted[idx - 1] + 1);

  if (isConsecutive) {
    return `Câu ${sorted[0]}–${sorted[sorted.length - 1]}`;
  }

  return `Câu ${sorted.join(', ')}`;
}

/**
 * Xây dựng danh sách các dòng trong Bản đặc tả đề kiểm tra:
 * Tự động gộp các câu hỏi liên tiếp cùng chủ đề, cùng mức độ và cùng dạng câu thành một dòng.
 * Ví dụ: Câu 1, 2, 3 cùng chủ đề "Hàm số", mức NB, dạng MCQ4 -> "Câu 1–3, 1.5 điểm".
 */
export function buildSpecificationRows(
  slots: BlueprintSlot[],
  _config?: ExamConfig
): SpecificationRow[] {
  if (slots.length === 0) return [];

  const rows: SpecificationRow[] = [];
  let currentGroup: BlueprintSlot[] = [];

  const shouldMerge = (a: BlueprintSlot, b: BlueprintSlot): boolean => {
    return (
      a.topic === b.topic &&
      a.level === b.level &&
      a.questionType === b.questionType &&
      (a.learningOutcome || '') === (b.learningOutcome || '')
    );
  };

  const pushGroup = (group: BlueprintSlot[]) => {
    if (group.length === 0) return;
    const first = group[0];
    const rawNumbers = group.map((s) => s.orderNumber);
    const totalScore = Number(group.reduce((acc, s) => acc + s.score, 0).toFixed(2));

    rows.push({
      id: `spec_${first.id}_${group.length}`,
      questionNumbersText: formatQuestionRange(rawNumbers),
      rawNumbers,
      topic: first.topic,
      learningOutcome: first.learningOutcome || 'Chuẩn kiến thức, kỹ năng theo chương trình.',
      level: first.level,
      questionType: first.questionType,
      questionTypeLabel: QUESTION_TYPE_LABELS[first.questionType]?.label || first.questionType,
      totalScore,
      count: group.length,
    });
  };

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (currentGroup.length === 0) {
      currentGroup.push(slot);
    } else {
      const prev = currentGroup[currentGroup.length - 1];
      if (shouldMerge(prev, slot)) {
        currentGroup.push(slot);
      } else {
        pushGroup(currentGroup);
        currentGroup = [slot];
      }
    }
  }

  if (currentGroup.length > 0) {
    pushGroup(currentGroup);
  }

  return rows;
}

/**
 * Kết quả kiểm tra tính hợp lệ của ma trận đọc từ tài liệu / bảng
 */
export interface MatrixValidationAnalysis {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  cellErrors: Record<string, string>; // key: `${topicIdx}_${cellIdx}` -> error message
  cellWarnings: Record<string, string>; // key: `${topicIdx}_${cellIdx}` -> warning message
  rowTotals: Array<{ count: number; points: number }>;
  colTotals: Record<Level, { count: number; points: number; percent: number }>;
  grandTotal: { count: number; points: number };
}

/**
 * Kiểm tra tính hợp lệ của Ma trận có sẵn (XÁC NHẬN BẰNG CODE):
 * - Tổng hàng, tổng cột, tổng câu, tổng điểm, tổng % phải khớp
 * - Ô sai hoặc nghi ngờ tô màu vàng/đỏ kèm lý do
 */
export function validateParsedMatrix(matrix: ParsedMatrix): MatrixValidationAnalysis {
  const errors: string[] = [];
  const warnings: string[] = [...(matrix.warnings || [])];
  const cellErrors: Record<string, string> = {};
  const cellWarnings: Record<string, string> = {};

  const levels: Level[] = ['NB', 'TH', 'VD', 'VDC'];
  const colTotals: Record<Level, { count: number; points: number; percent: number }> = {
    NB: { count: 0, points: 0, percent: 0 },
    TH: { count: 0, points: 0, percent: 0 },
    VD: { count: 0, points: 0, percent: 0 },
    VDC: { count: 0, points: 0, percent: 0 },
  };

  const rowTotals: Array<{ count: number; points: number }> = [];

  if (!matrix.topics || matrix.topics.length === 0) {
    errors.push('Ma trận chưa có chủ đề hoặc nội dung nào.');
    return {
      isValid: false,
      errors,
      warnings,
      cellErrors,
      cellWarnings,
      rowTotals: [],
      colTotals,
      grandTotal: { count: 0, points: 0 },
    };
  }

  let totalActualQuestions = 0;
  let totalActualPoints = 0;
  let anyCellHasPoints = false;

  matrix.topics.forEach((topic, tIdx) => {
    let rowCount = 0;
    let rowPoints = 0;

    if (!topic.name || topic.name.trim().length === 0) {
      errors.push(`Hàng số ${tIdx + 1} chưa có tên chủ đề kiến thức.`);
    }

    (topic.cells || []).forEach((cell, cIdx) => {
      const cellKey = `${tIdx}_${cIdx}`;
      const count = Number(cell.count) || 0;
      const points = cell.points !== undefined ? Number(cell.points) : undefined;

      if (count < 0) {
        cellErrors[cellKey] = 'Số câu không được âm';
        errors.push(`Chủ đề "${topic.name}": Ô mức ${cell.level} có số câu âm (${count}).`);
      } else if (!Number.isInteger(count)) {
        cellErrors[cellKey] = 'Số câu phải là số nguyên';
        errors.push(`Chủ đề "${topic.name}": Ô mức ${cell.level} số câu không phải số nguyên (${count}).`);
      }

      if (points !== undefined) {
        anyCellHasPoints = true;
        if (points < 0) {
          cellErrors[cellKey] = 'Điểm không được âm';
          errors.push(`Chủ đề "${topic.name}": Ô mức ${cell.level} có điểm âm (${points}).`);
        }
      }

      rowCount += count;
      if (points !== undefined) {
        rowPoints += points;
      }

      if (cell.level in colTotals) {
        colTotals[cell.level].count += count;
        if (points !== undefined) {
          colTotals[cell.level].points += points;
        }
      }
    });

    rowTotals.push({ count: rowCount, points: Number(rowPoints.toFixed(2)) });
    totalActualQuestions += rowCount;
    totalActualPoints += rowPoints;
  });

  totalActualPoints = Number(totalActualPoints.toFixed(2));

  // Tính phần trăm theo cột
  if (totalActualQuestions > 0) {
    levels.forEach((lvl) => {
      const pct = Math.round((colTotals[lvl].count / totalActualQuestions) * 100);
      colTotals[lvl].percent = pct;
    });
  }

  // 1. Kiểm tra tổng số câu
  if (totalActualQuestions <= 0) {
    errors.push('Tổng số câu hỏi trong ma trận phải lớn hơn 0.');
  }

  if (matrix.totalQuestions !== undefined && matrix.totalQuestions > 0) {
    if (matrix.totalQuestions !== totalActualQuestions) {
      const diff = totalActualQuestions - matrix.totalQuestions;
      const msg = `Tổng số câu thực tế (${totalActualQuestions} câu) không khớp với tổng số câu ghi trên ma trận gốc (${matrix.totalQuestions} câu, ${diff > 0 ? `thừa ${diff}` : `thiếu ${Math.abs(diff)}`} câu).`;
      errors.push(msg);
    }
  }

  // 2. Kiểm tra tổng điểm nếu có
  if (matrix.totalPoints !== undefined && matrix.totalPoints > 0) {
    if (anyCellHasPoints) {
      const pointDiff = Math.abs(totalActualPoints - matrix.totalPoints);
      if (pointDiff > 0.05) {
        const msg = `Tổng điểm các ô (${totalActualPoints}đ) không khớp với tổng điểm ghi trên ma trận gốc (${matrix.totalPoints}đ).`;
        errors.push(msg);
      }
    }
  }

  const isValid = errors.length === 0 && Object.keys(cellErrors).length === 0;

  return {
    isValid,
    errors,
    warnings,
    cellErrors,
    cellWarnings,
    rowTotals,
    colTotals,
    grandTotal: { count: totalActualQuestions, points: totalActualPoints },
  };
}

/**
 * Chi tiết một ô lệch giữa đề thi đã sinh và ma trận gốc
 */
export interface MatrixDiscrepancy {
  topic: string;
  level: Level;
  questionType: QuestionType;
  expectedCount: number;
  actualCount: number;
  expectedPoints?: number;
  actualPoints?: number;
  diffCount: number;
  description: string;
}

/**
 * So sánh ma trận của đề với ma trận gốc từng ô một
 * Trả về { isMatch100: boolean, discrepancies: MatrixDiscrepancy[], totalMatchedCells: number, totalExpectedCells: number }
 */
export function compareExamWithImportedMatrix(
  questions: Question[],
  matrix: ParsedMatrix
): {
  isMatch100: boolean;
  matchPercentage: number;
  discrepancies: MatrixDiscrepancy[];
  totalExpectedCells: number;
  totalMatchedCells: number;
} {
  const discrepancies: MatrixDiscrepancy[] = [];
  let totalExpectedCells = 0;
  let totalMatchedCells = 0;

  // Gom các câu hỏi trong đề theo key: `${normalizedTopic}__${level}__${type}`
  const actualBuckets: Record<string, { count: number; points: number }> = {};
  questions.forEach((q) => {
    const key = `${(q.topic || '').trim().toLowerCase()}__${q.level}__${q.type}`;
    if (!actualBuckets[key]) {
      actualBuckets[key] = { count: 0, points: 0 };
    }
    actualBuckets[key].count += 1;
    actualBuckets[key].points += q.score || 0;
  });

  // Duyệt từng ô trong ma trận gốc
  (matrix.topics || []).forEach((topic) => {
    const normTopic = (topic.name || '').trim().toLowerCase();
    (topic.cells || []).forEach((cell) => {
      if (cell.count > 0) {
        totalExpectedCells += 1;
        const key = `${normTopic}__${cell.level}__${cell.questionType}`;
        const actual = actualBuckets[key] || { count: 0, points: 0 };

        const diffCount = actual.count - cell.count;
        if (diffCount !== 0) {
          discrepancies.push({
            topic: topic.name,
            level: cell.level,
            questionType: cell.questionType,
            expectedCount: cell.count,
            actualCount: actual.count,
            expectedPoints: cell.points,
            actualPoints: Number(actual.points.toFixed(2)),
            diffCount,
            description: `Chủ đề "${topic.name}" [${cell.level} - ${cell.questionType}]: gốc yêu cầu ${cell.count} câu, đề thực tế có ${actual.count} câu (${diffCount > 0 ? `+${diffCount}` : diffCount}).`,
          });
        } else {
          totalMatchedCells += 1;
        }
      }
    });
  });

  const isMatch100 = discrepancies.length === 0 && totalExpectedCells > 0;
  const matchPercentage =
    totalExpectedCells > 0
      ? Math.max(0, Math.round((totalMatchedCells / totalExpectedCells) * 100))
      : 100;

  return {
    isMatch100,
    matchPercentage,
    discrepancies,
    totalExpectedCells,
    totalMatchedCells,
  };
}
