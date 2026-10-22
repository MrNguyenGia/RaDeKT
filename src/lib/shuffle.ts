/**
 * Logic THUẦN CODE (Không gọi AI).
 * Mô-đun xáo trộn đề thi và tạo các mã đề hoán vị:
 * - Xáo trộn thứ tự các câu hỏi trắc nghiệm trong từng phần thi.
 * - Xáo trộn các phương án lựa chọn A, B, C, D của câu hỏi MCQ4 và tự động cập nhật lại đáp án đúng tương ứng.
 * - Đảm bảo tính tương đương giữa các mã đề (Mã 101, 102, 103, 104...).
 * - Giữ nguyên thứ tự các câu tự luận ở cuối đề.
 */

import { ExamVersion, Question } from '../types';

/**
 * Thuật toán xáo trộn Fisher-Yates ngẫu nhiên thuần túy
 */
export function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Xáo trộn 4 phương án A, B, C, D của một câu MCQ4 và cập nhật correctAnswer
 */
export function shuffleMcqOptions(question: Question): Question {
  if (question.type !== 'MCQ4' || !question.options || question.options.length !== 4) {
    return { ...question };
  }

  // Bóc tách nội dung thuần của các phương án (bỏ tiền tố A., B., C., D.)
  const rawOptions = question.options.map((opt) => opt.replace(/^[A-D]\.\s*/i, '').trim());

  // Xác định chỉ số phương án đúng ban đầu (0: A, 1: B, 2: C, 3: D)
  const letters = ['A', 'B', 'C', 'D'];
  const originalCorrectLetter = question.correctAnswer.trim().toUpperCase();
  let originalCorrectIdx = letters.indexOf(originalCorrectLetter);
  if (originalCorrectIdx === -1) {
    // Thử tìm theo nội dung
    originalCorrectIdx = rawOptions.findIndex((opt) =>
      question.correctAnswer.toLowerCase().includes(opt.toLowerCase())
    );
    if (originalCorrectIdx === -1) originalCorrectIdx = 0;
  }

  // Tạo mảng chỉ số [0, 1, 2, 3] và xáo trộn
  const indices = [0, 1, 2, 3];
  const shuffledIndices = shuffleArray(indices);

  // Tạo danh sách phương án mới với nhãn A, B, C, D
  const newOptions = shuffledIndices.map((origIdx, newIdx) => {
    return `${letters[newIdx]}. ${rawOptions[origIdx]}`;
  });

  // Tìm vị trí mới của phương án đúng
  const newCorrectIdx = shuffledIndices.indexOf(originalCorrectIdx);
  const newCorrectAnswer = letters[newCorrectIdx] || 'A';

  // Đồng bộ optionExprs đi theo thứ tự xáo trộn phương án
  let newOptionExprs: string[] | undefined = undefined;
  if (question.optionExprs && question.optionExprs.length === 4) {
    newOptionExprs = shuffledIndices.map((origIdx) => question.optionExprs![origIdx]);
  }

  return {
    ...question,
    options: newOptions,
    optionExprs: newOptionExprs ?? question.optionExprs,
    correctAnswer: newCorrectAnswer,
  };
}

/**
 * Sinh danh sách các mã đề từ bộ câu hỏi gốc
 * @param questions Danh sách câu hỏi gốc (Mã đề chuẩn/Đề gốc)
 * @param numberOfVersions Số lượng mã đề cần sinh (vd: 2, 4)
 * @param baseCodes Danh sách tên mã đề (mặc định ['101', '102', '103', '104'])
 */
export function generateExamVersions(
  questions: Question[],
  numberOfVersions: number = 2,
  baseCodes: string[] = ['101', '102', '103', '104']
): ExamVersion[] {
  if (!questions || questions.length === 0) {
    return [];
  }

  const versions: ExamVersion[] = [];

  // Tách câu hỏi trắc nghiệm và câu hỏi tự luận (giữ tự luận ở cuối đề)
  const objectiveQuestions = questions.filter((q) => q.type !== 'ESSAY');
  const essayQuestions = questions.filter((q) => q.type === 'ESSAY');

  for (let v = 0; v < numberOfVersions; v++) {
    const code = baseCodes[v] || `${101 + v}`;

    if (v === 0) {
      // Mã đề đầu tiên chính là đề gốc (Mã 101)
      versions.push({
        code,
        questions: questions.map((q, idx) => ({ ...q, orderNumber: idx + 1 })),
      });
      continue;
    }

    // Các mã đề tiếp theo: xáo trộn câu trắc nghiệm và xáo trộn các phương án lựa chọn
    const shuffledObjective = shuffleArray(objectiveQuestions).map((q) => {
      if (q.type === 'MCQ4') {
        return shuffleMcqOptions(q);
      }
      return { ...q };
    });

    // Ghép câu trắc nghiệm và tự luận lại
    const fullShuffled = [...shuffledObjective, ...essayQuestions].map((q, idx) => ({
      ...q,
      orderNumber: idx + 1,
    }));

    versions.push({
      code,
      questions: fullShuffled,
    });
  }

  return versions;
}
