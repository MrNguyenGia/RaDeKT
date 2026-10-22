/**
 * Kiểm thử tự động toàn bộ logic toán học và thuật toán phân bổ trong src/lib
 * Chạy các trường hợp kiểm thử bắt buộc từ yêu cầu kỹ thuật:
 * 1. Phương pháp phần dư lớn nhất: 12 câu với 40/30/20/10 -> 5/4/2/1.
 * 2. Phân bổ điểm nguyên đơn vị: 10 điểm, 13 câu, bước 0.25 -> 12 câu 0.75 và 1 câu 1.0, tổng đúng 10.0.
 * 3. Chấm lũy tiến Đúng/Sai CLUSTER4: 1 ý = 10%, 2 ý = 25%, 3 ý = 50%, 4 ý = 100%.
 * 4. Thuật toán tự điền ma trận câu hỏi x mức độ.
 */

import { convertPercentagesToCounts, autoFillBlueprintMatrix, validateBlueprintMatrix } from './blueprint';
import { allocateIntegerScores, calculateCluster4ProgressiveScore, validateTotalExamScore } from './scoring';

export interface TestCaseResult {
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  details?: string;
}

export interface SelfTestReport {
  overallPassed: boolean;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  results: TestCaseResult[];
  timestamp: string;
}

/**
 * Chạy kiểm thử tự động toàn bộ logic thuần code
 */
export function selfTest(): SelfTestReport {
  const results: TestCaseResult[] = [];

  // =========================================================================
  // TEST 1: Quy đổi % sang số câu bằng phương pháp phần dư lớn nhất
  // Ví dụ bắt buộc: 12 câu với 40/30/20/10 -> cho ra 5/4/2/1
  // =========================================================================
  const test1Counts = convertPercentagesToCounts(12, {
    nbPercent: 40,
    thPercent: 30,
    vdPercent: 20,
    vdcPercent: 10,
  });

  const test1Passed =
    test1Counts.NB === 5 &&
    test1Counts.TH === 4 &&
    test1Counts.VD === 2 &&
    test1Counts.VDC === 1;

  results.push({
    name: 'Quy đổi phần dư lớn nhất (12 câu, 40/30/20/10)',
    passed: test1Passed,
    expected: 'NB: 5, TH: 4, VD: 2, VDC: 1 (Tổng = 12)',
    actual: `NB: ${test1Counts.NB}, TH: ${test1Counts.TH}, VD: ${test1Counts.VD}, VDC: ${test1Counts.VDC} (Tổng = ${
      test1Counts.NB + test1Counts.TH + test1Counts.VD + test1Counts.VDC
    })`,
    details: 'Đúng theo thuật toán Hare-Niemeyer / Largest Remainder',
  });

  // =========================================================================
  // TEST 2: Chia điểm nguyên đơn vị (Integer Unit Scoring)
  // Ví dụ bắt buộc: 10 điểm, 13 câu, bước 0.25 -> 12 câu 0.75 điểm và 1 câu 1.0 điểm, tổng đúng 10.0
  // =========================================================================
  const test2Scores = allocateIntegerScores(10, 13, 0.25);
  const count075 = test2Scores.filter((s) => Math.abs(s - 0.75) < 1e-4).length;
  const count100 = test2Scores.filter((s) => Math.abs(s - 1.0) < 1e-4).length;
  const sumScores = Number(test2Scores.reduce((acc, s) => acc + s, 0).toFixed(2));

  const test2Passed =
    test2Scores.length === 13 &&
    count075 === 12 &&
    count100 === 1 &&
    sumScores === 10;

  results.push({
    name: 'Chia điểm nguyên đơn vị (10 điểm, 13 câu, bước 0.25)',
    passed: test2Passed,
    expected: '12 câu 0.75đ, 1 câu 1.0đ, Tổng = 10.0đ',
    actual: `${count075} câu 0.75đ, ${count100} câu 1.0đ, Tổng = ${sumScores.toFixed(2)}đ`,
    details: 'Không dính sai số dấu phẩy động; phần dư chia dồn cho câu cuối',
  });

  // =========================================================================
  // TEST 3: Tùy chọn 3 mức cho Tiểu học (Mức 1 = NB, Mức 2 = TH, Mức 3 = VD, ẩn VDC)
  // 10 câu, tỷ lệ 50/30/20 -> 5/3/2/0
  // =========================================================================
  const test3Counts = convertPercentagesToCounts(
    10,
    { nbPercent: 50, thPercent: 30, vdPercent: 20, vdcPercent: 0 },
    true // use3Levels
  );

  const test3Passed =
    test3Counts.NB === 5 &&
    test3Counts.TH === 3 &&
    test3Counts.VD === 2 &&
    test3Counts.VDC === 0;

  results.push({
    name: 'Tiểu học 3 mức nhận thức (10 câu, 50/30/20)',
    passed: test3Passed,
    expected: 'NB: 5, TH: 3, VD: 2, VDC: 0 (Tổng = 10)',
    actual: `NB: ${test3Counts.NB}, TH: ${test3Counts.TH}, VD: ${test3Counts.VD}, VDC: ${test3Counts.VDC}`,
    details: 'Ánh xạ Mức 1=NB, Mức 2=TH, Mức 3=VD; VDC = 0',
  });

  // =========================================================================
  // TEST 4: Tự động phân bổ bảng ma trận Dạng câu x Mức độ
  // Sắp xếp từ dễ đến khó và lấp đầy NB -> VDC
  // =========================================================================
  const test4Matrix = autoFillBlueprintMatrix(
    { MCQ4: 10, SHORT_ANSWER: 4 },
    { NB: 6, TH: 4, VD: 3, VDC: 1 }
  );

  const test4Validation = validateBlueprintMatrix(
    test4Matrix,
    { MCQ4: 10, SHORT_ANSWER: 4 },
    { NB: 6, TH: 4, VD: 3, VDC: 1 }
  );

  results.push({
    name: 'Tự động phân bổ ma trận Dạng câu x Mức độ',
    passed: test4Validation.isValid,
    expected: 'Tổng các hàng và cột khớp 100% với số câu và mức độ',
    actual: test4Validation.isValid ? 'Ma trận hợp lệ hoàn hảo' : 'Bị lệch hàng/cột',
    details: 'Sắp xếp dạng câu từ dễ đến khó và lấp đầy tuần tự',
  });

  // =========================================================================
  // TEST 5: Chấm lũy tiến câu hỏi Đúng/Sai CLUSTER4 (1đ)
  // Đúng 1 ý: 0.1, Đúng 2 ý: 0.25, Đúng 3 ý: 0.5, Đúng 4 ý: 1.0
  // =========================================================================
  const p1 = calculateCluster4ProgressiveScore(1, 1.0);
  const p2 = calculateCluster4ProgressiveScore(2, 1.0);
  const p3 = calculateCluster4ProgressiveScore(3, 1.0);
  const p4 = calculateCluster4ProgressiveScore(4, 1.0);

  const test5Passed = p1 === 0.1 && p2 === 0.25 && p3 === 0.5 && p4 === 1.0;

  results.push({
    name: 'Chấm lũy tiến Đúng/Sai CLUSTER4 (chuẩn THPT)',
    passed: test5Passed,
    expected: '1 ý = 0.1đ; 2 ý = 0.25đ; 3 ý = 0.5đ; 4 ý = 1.0đ',
    actual: `1 ý = ${p1}đ; 2 ý = ${p2}đ; 3 ý = ${p3}đ; 4 ý = ${p4}đ`,
    details: 'Đúng chuẩn cấu trúc thi tốt nghiệp THPT 2025',
  });

  const passedTests = results.filter((r) => r.passed).length;
  const failedTests = results.length - passedTests;

  return {
    overallPassed: failedTests === 0,
    totalTests: results.length,
    passedTests,
    failedTests,
    results,
    timestamp: new Date().toLocaleTimeString('vi-VN'),
  };
}
