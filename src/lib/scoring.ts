/**
 * Logic THUẦN CODE (Không gọi AI).
 * Mô-đun tính toán và cân đối điểm số cho đề kiểm tra:
 * - Chia điểm nguyên đơn vị theo bước làm tròn (tránh lỗi sai số dấu phẩy động 0.1 + 0.2).
 * - Cân đối phần dư chia dồn cho các câu cuối để tổng điểm tuyệt đối chính xác.
 * - Hỗ trợ chia điểm theo phần (Trắc nghiệm / Tự luận) hoặc chia đều toàn đề.
 * - Cho phép giáo viên sửa điểm từng câu và kiểm tra chênh lệch với thang điểm quy định.
 */

import { BlueprintSlot, ExamConfig, QuestionType } from '../types';

/**
 * Phân bổ điểm cho một tập hợp câu hỏi dựa trên thang điểm và bước làm tròn
 * Bắt buộc tính bằng số NGUYÊN theo đơn vị nhỏ nhất để không dính sai số dấu phẩy động.
 * Ví dụ bắt buộc: 10 điểm, 13 câu, bước 0.25 -> 12 câu 0.75 điểm và 1 câu 1.0 điểm, tổng đúng 10.0.
 */
export function allocateIntegerScores(
  targetScore: number,
  questionCount: number,
  roundingStep: number = 0.25
): number[] {
  if (questionCount <= 0 || targetScore <= 0) {
    return [];
  }

  // 1. Chuyển đổi điểm mục tiêu thành số đơn vị nguyên (units)
  // Ví dụ: 10 điểm với bước 0.25 = Math.round(10 / 0.25) = 40 đơn vị
  const stepFactor = Math.round(1 / roundingStep); // với 0.25 là 4, với 0.1 là 10, với 0.05 là 20
  const totalUnits = Math.round(targetScore * stepFactor);

  // 2. Tính số đơn vị cơ bản cho mỗi câu và phần dư
  const baseUnits = Math.floor(totalUnits / questionCount);
  const remainderUnits = totalUnits % questionCount;

  // 3. Phân bổ: Các câu đầu nhận baseUnits, phần dư còn lại được chia dồn cho các câu cuối (+1 unit mỗi câu)
  const scores: number[] = [];
  const normalCount = questionCount - remainderUnits;

  for (let i = 0; i < normalCount; i++) {
    // Làm tròn 4 chữ số thập phân để triệt tiêu sai số JS float
    scores.push(Number((baseUnits / stepFactor).toFixed(4)));
  }

  for (let i = 0; i < remainderUnits; i++) {
    scores.push(Number(((baseUnits + 1) / stepFactor).toFixed(4)));
  }

  return scores;
}

/**
 * Tính toán điểm số tự động cho danh sách BlueprintSlot theo cấu hình của ExamConfig
 */
export function calculateExamSlotScores(
  slots: BlueprintSlot[],
  config: ExamConfig
): Record<string, number> {
  const result: Record<string, number> = {};
  if (slots.length === 0) return result;

  const targetScale = config.scale || 10;
  const roundingStep = config.roundingStep || 0.25;

  // Kiểm tra nếu có chia điểm theo phần (Trắc nghiệm vs Tự luận)
  if (config.sectionScoringEnabled && config.sectionScores) {
    const objectiveSlots = slots.filter((s) => s.questionType !== 'ESSAY');
    const essaySlots = slots.filter((s) => s.questionType === 'ESSAY');

    const objTarget = config.sectionScores.objectiveScore ?? 7;
    const essayTarget = config.sectionScores.essayScore ?? 3;

    // Phân bổ phần trắc nghiệm
    if (objectiveSlots.length > 0) {
      const objScores = allocateIntegerScores(objTarget, objectiveSlots.length, roundingStep);
      objectiveSlots.forEach((slot, idx) => {
        result[slot.id] = objScores[idx];
      });
    }

    // Phân bổ phần tự luận
    if (essaySlots.length > 0) {
      const essayScores = allocateIntegerScores(essayTarget, essaySlots.length, roundingStep);
      essaySlots.forEach((slot, idx) => {
        result[slot.id] = essayScores[idx];
      });
    }
  } else {
    // Chia đều theo số câu toàn đề
    const allocated = allocateIntegerScores(targetScale, slots.length, roundingStep);
    slots.forEach((slot, idx) => {
      result[slot.id] = allocated[idx];
    });
  }

  // Nếu có điểm sửa tay (customSlotScores) của giáo viên, ưu tiên giữ nguyên
  if (config.customSlotScores) {
    Object.keys(config.customSlotScores).forEach((slotId) => {
      const customVal = config.customSlotScores![slotId];
      if (typeof customVal === 'number' && !isNaN(customVal)) {
        result[slotId] = customVal;
      }
    });
  }

  return result;
}

/**
 * Kiểm tra tính hợp lệ của tổng điểm các câu hỏi so với thang điểm
 */
export function validateTotalExamScore(
  slots: BlueprintSlot[],
  customScores: Record<string, number> | undefined,
  targetScale: number = 10,
  roundingStep: number = 0.25
): {
  isValid: boolean;
  totalScore: number;
  diff: number;
  message?: string;
} {
  const stepFactor = Math.round(1 / roundingStep);

  // Tính tổng điểm bằng số nguyên đơn vị để triệt tiêu sai số
  let totalUnits = 0;
  slots.forEach((slot) => {
    const score = customScores?.[slot.id] !== undefined ? customScores[slot.id] : slot.score;
    totalUnits += Math.round(score * stepFactor);
  });

  const totalScore = Number((totalUnits / stepFactor).toFixed(2));
  const targetUnits = Math.round(targetScale * stepFactor);
  const diffUnits = totalUnits - targetUnits;
  const diff = Number((diffUnits / stepFactor).toFixed(2));

  const isValid = diffUnits === 0;

  let message = '';
  if (!isValid) {
    if (diff > 0) {
      message = `Tổng điểm hiện tại (${totalScore}) đang thừa +${diff} điểm so với thang điểm ${targetScale}.`;
    } else {
      message = `Tổng điểm hiện tại (${totalScore}) đang thiếu ${Math.abs(diff)} điểm so với thang điểm ${targetScale}.`;
    }
  }

  return {
    isValid,
    totalScore,
    diff,
    message,
  };
}

/**
 * Tỷ lệ điểm chấm lũy tiến cho dạng câu hỏi CLUSTER4 (Đúng / Sai 4 ý a, b, c, d)
 * Theo chuẩn thi tốt nghiệp THPT mới của Bộ GD&ĐT:
 * - Đúng 1 ý: 10% điểm của câu
 * - Đúng 2 ý: 25% điểm của câu
 * - Đúng 3 ý: 50% điểm của câu
 * - Đúng 4 ý: 100% điểm của câu
 */
export function calculateCluster4ProgressiveScore(
  correctCount: number,
  questionMaxScore: number
): number {
  if (correctCount <= 0) return 0;
  if (correctCount === 1) return Number((questionMaxScore * 0.1).toFixed(3));
  if (correctCount === 2) return Number((questionMaxScore * 0.25).toFixed(3));
  if (correctCount === 3) return Number((questionMaxScore * 0.5).toFixed(3));
  return questionMaxScore;
}
