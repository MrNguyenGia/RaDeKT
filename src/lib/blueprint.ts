/**
 * Logic THUẦN CODE (Không gọi AI).
 * Mô-đun phân bổ ma trận đề kiểm tra (Blueprint Matrix) và quy đổi mức độ nhận thức.
 */

import { QUESTION_TYPES_ORDER } from '../config';
import { BlueprintSlot, ExamConfig, Level, QuestionType, QuestionTypeCounts } from '../types';

/**
 * Quy đổi tỷ lệ phần trăm các mức độ sang số lượng câu hỏi
 * Áp dụng phương pháp phần dư lớn nhất (Largest Remainder Method / Hare-Niemeyer).
 * Đảm bảo:
 * - Tổng số câu sau khi quy đổi luôn bằng đúng totalQuestions.
 * - Ví dụ bắt buộc: 12 câu với tỷ lệ 40/30/20/10 cho ra chính xác 5/4/2/1.
 */
export function convertPercentagesToCounts(
  totalQuestions: number,
  percentages: { nbPercent: number; thPercent: number; vdPercent: number; vdcPercent: number },
  use3Levels: boolean = false
): Record<Level, number> {
  if (totalQuestions <= 0) {
    return { NB: 0, TH: 0, VD: 0, VDC: 0 };
  }

  const levels: Level[] = use3Levels ? ['NB', 'TH', 'VD'] : ['NB', 'TH', 'VD', 'VDC'];

  const pctMap: Record<Level, number> = {
    NB: percentages.nbPercent,
    TH: percentages.thPercent,
    VD: percentages.vdPercent,
    VDC: use3Levels ? 0 : percentages.vdcPercent,
  };

  const exact: Record<Level, number> = {
    NB: (totalQuestions * pctMap.NB) / 100,
    TH: (totalQuestions * pctMap.TH) / 100,
    VD: (totalQuestions * pctMap.VD) / 100,
    VDC: use3Levels ? 0 : (totalQuestions * pctMap.VDC) / 100,
  };

  const integerParts: Record<Level, number> = {
    NB: Math.floor(exact.NB),
    TH: Math.floor(exact.TH),
    VD: Math.floor(exact.VD),
    VDC: Math.floor(exact.VDC),
  };

  let sumIntegers = levels.reduce((acc, lvl) => acc + integerParts[lvl], 0);
  let remainderNeeded = totalQuestions - sumIntegers;

  // Sắp xếp các mức độ theo phần dư giảm dần, nếu bằng nhau thì ưu tiên thứ tự NB -> TH -> VD -> VDC
  const remainders = levels.map((lvl) => ({
    level: lvl,
    rem: exact[lvl] - integerParts[lvl],
  }));

  remainders.sort((a, b) => {
    if (Math.abs(b.rem - a.rem) > 1e-7) {
      return b.rem - a.rem;
    }
    const order: Record<Level, number> = { NB: 1, TH: 2, VD: 3, VDC: 4 };
    return order[a.level] - order[b.level];
  });

  // Phân phối phần dư cho các mức có phần dư lớn nhất
  let i = 0;
  while (remainderNeeded > 0 && i < remainders.length) {
    integerParts[remainders[i].level] += 1;
    remainderNeeded -= 1;
    i++;
  }

  // Trường hợp hiếm khi sumIntegers > totalQuestions (do tổng % > 100%)
  while (remainderNeeded < 0 && i > 0) {
    i--;
    if (integerParts[remainders[i].level] > 0) {
      integerParts[remainders[i].level] -= 1;
      remainderNeeded += 1;
    }
  }

  return {
    NB: integerParts.NB,
    TH: integerParts.TH,
    VD: integerParts.VD,
    VDC: use3Levels ? 0 : integerParts.VDC,
  };
}

/**
 * Quy đổi ngược lại từ số câu của từng mức sang tỷ lệ phần trăm
 */
export function convertCountsToPercentages(
  levelCounts: Record<Level, number>,
  totalQuestions: number,
  use3Levels: boolean = false
): { nbPercent: number; thPercent: number; vdPercent: number; vdcPercent: number } {
  if (totalQuestions <= 0) {
    return use3Levels
      ? { nbPercent: 50, thPercent: 30, vdPercent: 20, vdcPercent: 0 }
      : { nbPercent: 40, thPercent: 30, vdPercent: 20, vdcPercent: 10 };
  }

  const raw = {
    NB: Math.round((levelCounts.NB / totalQuestions) * 100),
    TH: Math.round((levelCounts.TH / totalQuestions) * 100),
    VD: Math.round((levelCounts.VD / totalQuestions) * 100),
    VDC: use3Levels ? 0 : Math.round((levelCounts.VDC / totalQuestions) * 100),
  };

  return {
    nbPercent: raw.NB,
    thPercent: raw.TH,
    vdPercent: raw.VD,
    vdcPercent: raw.VDC,
  };
}

/**
 * Tự động phân bổ bảng Ma trận Dạng câu x Mức độ bằng thuật toán xác định:
 * - Sắp xếp dạng câu từ dễ đến khó: Điền khuyết -> 4 lựa chọn -> Đúng/Sai -> Nhiều đáp án -> Ghép nối -> Trả lời ngắn -> Tự luận.
 * - Lấp đầy lần lượt từ mức NB lên VDC.
 */
export function autoFillBlueprintMatrix(
  questionCounts: QuestionTypeCounts,
  levelCounts: Record<Level, number>,
  use3Levels: boolean = false
): Partial<Record<QuestionType, Record<Level, number>>> {
  const matrix: Partial<Record<QuestionType, Record<Level, number>>> = {};

  const levels: Level[] = use3Levels ? ['NB', 'TH', 'VD'] : ['NB', 'TH', 'VD', 'VDC'];

  // Khởi tạo ma trận trống
  QUESTION_TYPES_ORDER.forEach((type) => {
    matrix[type] = { NB: 0, TH: 0, VD: 0, VDC: 0 };
  });

  // Hạn ngạch còn lại cho mỗi hàng (dạng câu)
  const remainingRows: Partial<Record<QuestionType, number>> = {};
  QUESTION_TYPES_ORDER.forEach((type) => {
    remainingRows[type] = questionCounts[type] || 0;
  });

  // Hạn ngạch còn lại cho mỗi cột (mức độ)
  const remainingCols: Record<Level, number> = {
    NB: levelCounts.NB || 0,
    TH: levelCounts.TH || 0,
    VD: levelCounts.VD || 0,
    VDC: use3Levels ? 0 : levelCounts.VDC || 0,
  };

  // Thuật toán: Lần lượt duyệt từ mức dễ (NB) đến khó (VDC)
  // Trong mỗi mức, phân bổ cho dạng câu từ dễ đến khó
  for (const lvl of levels) {
    for (const type of QUESTION_TYPES_ORDER) {
      const rowAvail = remainingRows[type] || 0;
      const colAvail = remainingCols[lvl] || 0;

      if (rowAvail > 0 && colAvail > 0) {
        const allocate = Math.min(rowAvail, colAvail);
        matrix[type]![lvl] = allocate;
        remainingRows[type] = rowAvail - allocate;
        remainingCols[lvl] = colAvail - allocate;
      }
    }
  }

  return matrix;
}

/**
 * Kết quả kiểm tra tính hợp lệ của bảng ma trận
 */
export interface MatrixValidationResult {
  isValid: boolean;
  rowDiscrepancies: Partial<Record<QuestionType, { expected: number; actual: number; diff: number }>>;
  colDiscrepancies: Record<Level, { expected: number; actual: number; diff: number }>;
}

/**
 * Kiểm tra tính hợp lệ của bảng ma trận phân bổ do giáo viên chỉnh sửa:
 * - Tổng mỗi hàng phải bằng số câu của dạng đó.
 * - Tổng mỗi cột phải bằng số câu của mức đó.
 */
export function validateBlueprintMatrix(
  matrix: Partial<Record<QuestionType, Record<Level, number>>>,
  questionCounts: QuestionTypeCounts,
  levelCounts: Record<Level, number>,
  use3Levels: boolean = false
): MatrixValidationResult {
  const rowDiscrepancies: Partial<Record<QuestionType, { expected: number; actual: number; diff: number }>> = {};
  const colDiscrepancies: Record<Level, { expected: number; actual: number; diff: number }> = {
    NB: { expected: levelCounts.NB || 0, actual: 0, diff: 0 },
    TH: { expected: levelCounts.TH || 0, actual: 0, diff: 0 },
    VD: { expected: levelCounts.VD || 0, actual: 0, diff: 0 },
    VDC: { expected: use3Levels ? 0 : levelCounts.VDC || 0, actual: 0, diff: 0 },
  };

  let isValid = true;
  const levels: Level[] = use3Levels ? ['NB', 'TH', 'VD'] : ['NB', 'TH', 'VD', 'VDC'];

  // 1. Kiểm tra từng hàng
  QUESTION_TYPES_ORDER.forEach((type) => {
    const expected = questionCounts[type] || 0;
    const row = matrix[type] || { NB: 0, TH: 0, VD: 0, VDC: 0 };
    const actual = levels.reduce((sum, lvl) => sum + (row[lvl] || 0), 0);
    const diff = actual - expected;

    if (diff !== 0) {
      rowDiscrepancies[type] = { expected, actual, diff };
      isValid = false;
    }

    // Cộng dồn vào cột
    levels.forEach((lvl) => {
      colDiscrepancies[lvl].actual += row[lvl] || 0;
    });
  });

  // 2. Kiểm tra từng cột
  levels.forEach((lvl) => {
    const expected = colDiscrepancies[lvl].expected;
    const actual = colDiscrepancies[lvl].actual;
    const diff = actual - expected;
    colDiscrepancies[lvl].diff = diff;
    if (diff !== 0) {
      isValid = false;
    }
  });

  return {
    isValid,
    rowDiscrepancies,
    colDiscrepancies,
  };
}

import { calculateExamSlotScores } from './scoring';

/**
 * Thuật toán Vòng tròn có trọng số mượt (Smooth Weighted Round-Robin - SWRR)
 * Phân bổ đều đặn các chủ đề qua các ô câu hỏi theo trọng số mà không bị tụ cụm.
 */
export function smoothWeightedRoundRobin<T extends { weight: number }>(
  items: T[],
  count: number
): T[] {
  if (items.length === 0 || count <= 0) return [];
  if (items.length === 1) return Array(count).fill(items[0]);

  const totalWeight = items.reduce(
    (acc, it) => acc + (it.weight > 0 ? it.weight : 1),
    0
  );
  const currentWeights = new Array(items.length).fill(0);
  const result: T[] = [];

  for (let c = 0; c < count; c++) {
    for (let i = 0; i < items.length; i++) {
      const w = items[i].weight > 0 ? items[i].weight : 1;
      currentWeights[i] += w;
    }

    let maxIdx = 0;
    for (let i = 1; i < items.length; i++) {
      if (currentWeights[i] > currentWeights[maxIdx]) {
        maxIdx = i;
      }
    }

    currentWeights[maxIdx] -= totalWeight;
    result.push(items[maxIdx]);
  }

  return result;
}

/**
 * Xây dựng danh sách ô câu hỏi (BlueprintSlot) hoàn chỉnh theo cấu hình:
 * 1. Sắp xếp: Trắc nghiệm trước, Tự luận sau; trong mỗi dạng, mức từ thấp lên cao (NB -> TH -> VD -> VDC).
 * 2. Đánh số câu tuần tự 1, 2, 3...
 * 3. Gán chủ đề theo vòng tròn có trọng số (smooth weighted round-robin) để trải đều các mức độ.
 * 4. Gán điểm chuẩn xác từ scoring.ts.
 */
/**
 * Xây dựng danh sách ô câu hỏi trực tiếp từ Ma trận có sẵn (Tính năng Tạo từ ma trận có sẵn)
 * Dựng đúng từng ô (chủ đề × mức × dạng) theo ma trận, KHÔNG dùng thuật toán tự điền ở Bước 3.
 * Điểm từng ô: dùng điểm trong ma trận nếu có, nếu không có thì chia đều bằng scoring.ts.
 */
export function buildBlueprintFromImportedMatrix(config: ExamConfig): BlueprintSlot[] {
  const matrix = config.importedMatrix!;
  const preliminarySlots: {
    questionType: QuestionType;
    level: Level;
    topic: string;
    learningOutcome?: string;
    unitScore?: number;
  }[] = [];

  // Duyệt qua từng chủ đề và từng ô của ma trận nhập sẵn
  (matrix.topics || []).forEach((topic) => {
    (topic.cells || []).forEach((cell) => {
      const count = Number(cell.count) || 0;
      if (count > 0) {
        // Điểm của từng câu trong ô nếu ô có điểm
        const unitScore =
          cell.points !== undefined && cell.points > 0
            ? Number((cell.points / count).toFixed(2))
            : undefined;

        for (let k = 0; k < count; k++) {
          preliminarySlots.push({
            questionType: cell.questionType || 'MCQ4',
            level: cell.level || 'NB',
            topic: topic.name || config.topicName || 'Kiến thức trọng tâm',
            learningOutcome: topic.requirement || config.learningOutcomes,
            unitScore,
          });
        }
      }
    });
  });

  if (preliminarySlots.length === 0) return [];

  // Sắp xếp dạng câu: Trắc nghiệm trước, Tự luận (ESSAY) sau; trong mỗi dạng theo mức độ NB -> TH -> VD -> VDC
  const LEVEL_ORDER: Record<Level, number> = { NB: 1, TH: 2, VD: 3, VDC: 4 };
  const TYPE_ORDER: Record<QuestionType, number> = {
    MCQ4: 1,
    MCQ_MULTI: 2,
    TRUE_FALSE: 3,
    MATCHING: 4,
    FILL_BLANK: 5,
    SHORT_ANSWER: 6,
    ESSAY: 7,
  };

  preliminarySlots.sort((a, b) => {
    const typeDiff = (TYPE_ORDER[a.questionType] || 99) - (TYPE_ORDER[b.questionType] || 99);
    if (typeDiff !== 0) return typeDiff;
    const levelDiff = (LEVEL_ORDER[a.level] || 99) - (LEVEL_ORDER[b.level] || 99);
    return levelDiff;
  });

  // Lắp ráp các BlueprintSlot sơ bộ
  const unScoredSlots: BlueprintSlot[] = preliminarySlots.map((item, idx) => {
    const orderNumber = idx + 1;
    const slotId = `slot_${item.questionType}_${item.level}_${orderNumber}`;
    const customFig = config.customSlotFigures?.[slotId];
    const inferred = inferSlotFigureNeed(
      { topic: item.topic, learningOutcome: item.learningOutcome },
      config
    );
    const needsFigure = customFig !== undefined ? customFig : inferred.needsFigure;
    const figureKinds = inferred.figureKinds && inferred.figureKinds.length > 0
      ? inferred.figureKinds
      : needsFigure
      ? ['function-graph', 'variation-table', 'sign-table', 'geometry', 'data-chart']
      : [];

    return {
      id: slotId,
      orderNumber,
      questionType: item.questionType,
      level: item.level,
      topic: item.topic,
      learningOutcome: item.learningOutcome || config.learningOutcomes,
      score: item.unitScore !== undefined ? item.unitScore : 0,
      needsFigure,
      figureKinds,
    };
  });

  // Kiểm tra xem ma trận có điểm từng ô không
  const hasCellPoints = preliminarySlots.some((s) => s.unitScore !== undefined && s.unitScore > 0);

  if (!hasCellPoints) {
    // Nếu không có điểm trong ma trận, chia đều bằng scoring.ts
    const scoreMap = calculateExamSlotScores(unScoredSlots, config);
    return unScoredSlots.map((slot) => ({
      ...slot,
      score: scoreMap[slot.id] !== undefined ? scoreMap[slot.id] : slot.score,
    }));
  }

  // Nếu có điểm từng ô, đảm bảo ô nào chưa có điểm thì lấy điểm còn lại chia đều
  const totalScoreAllocated = unScoredSlots.reduce((sum, s) => sum + (s.score || 0), 0);
  const targetScale = config.scale || matrix.totalPoints || 10;
  const remaining = Math.max(0, targetScale - totalScoreAllocated);
  const unassigned = unScoredSlots.filter((s) => s.score === 0);

  if (unassigned.length > 0 && remaining > 0) {
    const fallbackEach = Number((remaining / unassigned.length).toFixed(2));
    return unScoredSlots.map((slot) => ({
      ...slot,
      score: slot.score > 0 ? Number(slot.score.toFixed(2)) : fallbackEach,
    }));
  }

  return unScoredSlots.map((slot) => ({
    ...slot,
    score: Number(slot.score.toFixed(2)),
  }));
}

export function buildBlueprint(config: ExamConfig): BlueprintSlot[] {
  // Khi có ma trận nạp vào, buildBlueprint dựng đúng từng ô (chủ đề × mức × dạng) theo ma trận, KHÔNG dùng thuật toán tự điền ở Bước 3
  if (config.importedMatrix && config.importedMatrix.topics && config.importedMatrix.topics.length > 0) {
    return buildBlueprintFromImportedMatrix(config);
  }

  const use3Levels = Boolean(config.schoolLevel === 'TIEU_HOC' && config.use3LevelsPrimary);
  const levels: Level[] = use3Levels ? ['NB', 'TH', 'VD'] : ['NB', 'TH', 'VD', 'VDC'];

  const matrix = config.blueprintMatrix || autoFillBlueprintMatrix(
    config.questionCountsByType || {},
    config.levelCounts || { NB: 0, TH: 0, VD: 0, VDC: 0 },
    use3Levels
  );

  // Thứ tự dạng câu: Trắc nghiệm trước, Tự luận (ESSAY) sau
  const orderedTypes: QuestionType[] = [
    ...QUESTION_TYPES_ORDER.filter((t) => t !== 'ESSAY'),
    'ESSAY',
  ];

  // 1. Tạo khung danh sách slots sơ bộ
  const preliminarySlots: {
    questionType: QuestionType;
    level: Level;
  }[] = [];

  orderedTypes.forEach((type) => {
    const row = matrix[type];
    if (!row) return;

    levels.forEach((lvl) => {
      const count = row[lvl] || 0;
      for (let k = 0; k < count; k++) {
        preliminarySlots.push({
          questionType: type,
          level: lvl,
        });
      }
    });
  });

  if (preliminarySlots.length === 0) {
    return [];
  }

  // 2. Chuẩn bị danh sách chủ đề kiến thức (nếu rỗng thì dùng Tên bài / Phạm vi kiến thức ở Bước 1)
  const validTopics = (config.topics || []).filter(
    (t) => t.name && t.name.trim().length > 0
  );

  const topicsList =
    validTopics.length > 0
      ? validTopics
      : [
          {
            id: 'topic_default',
            name: config.topicName?.trim() || config.knowledgeScope?.trim() || 'Kiến thức trọng tâm',
            learningOutcome: config.learningOutcomes?.trim(),
            weight: 1,
          },
        ];

  // 3. Phân bổ chủ đề cho các slot theo Smooth Weighted Round-Robin
  const assignedTopics = smoothWeightedRoundRobin(topicsList, preliminarySlots.length);

  // 4. Lắp ráp các BlueprintSlot với ID và số thứ tự
  const unScoredSlots: BlueprintSlot[] = preliminarySlots.map((item, idx) => {
    const orderNumber = idx + 1;
    const topicItem = assignedTopics[idx];
    const slotId = `slot_${item.questionType}_${item.level}_${orderNumber}`;
    const customFig = config.customSlotFigures?.[slotId];
    const inferred = inferSlotFigureNeed(
      { topic: topicItem.name, learningOutcome: topicItem.learningOutcome || config.learningOutcomes },
      config
    );
    const needsFigure = customFig !== undefined ? customFig : inferred.needsFigure;
    const figureKinds = inferred.figureKinds && inferred.figureKinds.length > 0
      ? inferred.figureKinds
      : needsFigure
      ? ['function-graph', 'variation-table', 'sign-table', 'geometry', 'data-chart']
      : [];

    return {
      id: slotId,
      orderNumber,
      questionType: item.questionType,
      level: item.level,
      topic: topicItem.name,
      learningOutcome: topicItem.learningOutcome || config.learningOutcomes,
      score: 0,
      needsFigure,
      figureKinds,
    };
  });

  // 5. Gán điểm từ scoring.ts (hỗ trợ chia theo phần hoặc chia đều, tính nguyên đơn vị)
  const scoreMap = calculateExamSlotScores(unScoredSlots, config);

  return unScoredSlots.map((slot) => ({
    ...slot,
    score: scoreMap[slot.id] !== undefined ? scoreMap[slot.id] : slot.score,
  }));
}

/**
 * Tương thích ngược với generateBlueprintSlots
 */
export function generateBlueprintSlots(config: ExamConfig): BlueprintSlot[] {
  return buildBlueprint(config);
}

/**
 * Suy luận tự động xem một ô câu hỏi (BlueprintSlot) có cần hình vẽ/đồ thị/bảng không
 * Dựa trên từ khóa trong topic, learningOutcome hoặc cấu hình bài học:
 * - đồ thị -> function-graph
 * - bảng biến thiên -> variation-table
 * - bảng xét dấu -> sign-table
 * - hình chóp, lăng trụ, hình hộp, tam giác, đường tròn, mạch điện, thí nghiệm -> geometry
 * - biểu đồ, bảng tần số -> data-chart
 */
export function inferSlotFigureNeed(
  slot: Partial<BlueprintSlot>,
  config?: ExamConfig
): { needsFigure: boolean; figureKinds?: string[] } {
  const text = [
    slot.topic || '',
    slot.learningOutcome || '',
    config?.topicName || '',
    config?.knowledgeScope || '',
    config?.testContent || '',
  ]
    .join(' ')
    .toLowerCase();

  const kinds: string[] = [];

  // 1. Đồ thị -> function-graph
  if (text.includes('đồ thị')) {
    kinds.push('function-graph');
  }

  // 2. Bảng biến thiên -> variation-table
  if (text.includes('bảng biến thiên')) {
    kinds.push('variation-table');
  }

  // 3. Bảng xét dấu -> sign-table
  if (text.includes('bảng xét dấu') || text.includes('xét dấu')) {
    kinds.push('sign-table');
  }

  // 4. Hình học & không gian: hình chóp, lăng trụ, hình hộp, tam giác, đường tròn, mạch điện, thí nghiệm
  if (
    text.includes('hình chóp') ||
    text.includes('lăng trụ') ||
    text.includes('hình hộp') ||
    text.includes('tam giác') ||
    text.includes('đường tròn') ||
    text.includes('mạch điện') ||
    text.includes('thí nghiệm')
  ) {
    kinds.push('geometry');
  }

  // 5. Biểu đồ, bảng tần số -> data-chart
  if (text.includes('biểu đồ') || text.includes('bảng tần số') || text.includes('tần số')) {
    kinds.push('data-chart');
  }

  const uniqueKinds = Array.from(new Set(kinds));
  if (uniqueKinds.length > 0) {
    return {
      needsFigure: true,
      figureKinds: uniqueKinds,
    };
  }

  return {
    needsFigure: false,
    figureKinds: [],
  };
}
