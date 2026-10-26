/**
 * Kiểm thử tự động toàn bộ logic toán học và thuật toán phân bổ trong src/lib
 * Chạy các trường hợp kiểm thử bắt buộc từ yêu cầu kỹ thuật:
 * 1. Phương pháp phần dư lớn nhất: 12 câu với 40/30/20/10 -> 5/4/2/1.
 * 2. Phân bổ điểm nguyên đơn vị: 10 điểm, 13 câu, bước 0.25 -> 12 câu 0.75 và 1 câu 1.0, tổng đúng 10.0.
 * 3. Chấm lũy tiến Đúng/Sai CLUSTER4: 1 ý = 10%, 2 ý = 25%, 3 ý = 50%, 4 ý = 100%.
 * 4. Thuật toán tự điền ma trận câu hỏi x mức độ.
 */

import {
  convertPercentagesToCounts,
  autoFillBlueprintMatrix,
  validateBlueprintMatrix,
  inferSlotFigureNeed,
} from './blueprint';
import { getDynamicFigureSample } from '../services/gemini';
import { allocateIntegerScores, calculateCluster4ProgressiveScore, validateTotalExamScore } from './scoring';
import { figureToSvg, formatMathSymbolsForSvg } from './figureRenderer';
import {
  runCodeQualityCheck,
  getFaultyQuestions,
  hasPlainTextTablePattern,
  detectSelfContradictoryExplanation,
} from './validate';
import { getDefaultAcademicYear, formatSchoolNameForHeader } from '../config';
import { compareAnswersWithCode, parseMathNumber } from '../services/quality';
import { Question, QuestionFigure } from '../types';
import { testMathFigureTemplates } from './mathFigureTemplates';

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

  // =========================================================================
  // TEST 6: Đồng bộ vẽ hình figureToSvg() cho toàn bộ các kiểu figure
  // (function-graph, geometry, variation-table, sign-table, data-chart)
  // =========================================================================
  const sampleFunctionGraph: QuestionFigure = {
    kind: 'function-graph',
    functions: [{ expr: 'x^3 - 3*x' }],
    xRange: [-3, 3],
    yRange: [-4, 4],
    studentVisibleLabels: ['A'],
  };

  const sampleGeometry: QuestionFigure = {
    kind: 'geometry',
    points: [
      { id: 'A', x: 0, y: 0, label: 'A' },
      { id: 'B', x: 4, y: 0, label: 'B' },
      { id: 'C', x: 0, y: 3, label: 'C' },
    ],
    segments: [['A', 'B'], ['B', 'C'], ['C', 'A']],
  };

  const sampleVariationTable: QuestionFigure = {
    kind: 'variation-table',
    xValues: ['-\\infty', '-1', '1', '+\\infty'],
    yValues: ['-\\infty', '2', '-2', '+\\infty'],
    trends: ['up', 'down', 'up'],
    derivativeSigns: ['+', '-', '+'],
  };

  const sampleSignTable: QuestionFigure = {
    kind: 'sign-table',
    rowLabel: "f'(x)",
    xValues: ['-\\infty', '-2', '1', '+\\infty'],
    intervalSigns: ['+', '-', '+'],
    pointMarks: ['0', '||'],
  };

  const sampleDataChart: QuestionFigure = {
    kind: 'data-chart',
    chartType: 'bar',
    labels: ['Lớp 10', 'Lớp 11', 'Lớp 12'],
    series: [{ name: 'Học sinh giỏi', values: [25, 30, 42] }],
  };

  const svgGraph = figureToSvg(sampleFunctionGraph);
  const svgGeom = figureToSvg(sampleGeometry);
  const svgVar = figureToSvg(sampleVariationTable);
  const svgSign = figureToSvg(sampleSignTable);
  const svgChart = figureToSvg(sampleDataChart);

  const test6Passed =
    svgGraph.startsWith('<svg') && !svgGraph.includes('Hình vẽ gặp lỗi') &&
    svgGeom.startsWith('<svg') && !svgGeom.includes('Hình vẽ gặp lỗi') &&
    svgVar.startsWith('<svg') && !svgVar.includes('Hình vẽ gặp lỗi') &&
    svgSign.startsWith('<svg') && !svgSign.includes('Hình vẽ gặp lỗi') &&
    svgChart.startsWith('<svg') && !svgChart.includes('Hình vẽ gặp lỗi');

  results.push({
    name: 'Đồng bộ vẽ hình (function-graph, geometry, variation-table, sign-table, data-chart)',
    passed: test6Passed,
    expected: 'Tất cả 5 kiểu figure đều render thành SVG hợp lệ không lỗi',
    actual: test6Passed
      ? 'Đủ 5/5 kiểu figure vẽ thành công chuẩn sư phạm'
      : 'Có ít nhất 1 kiểu figure bị lỗi render',
    details: 'Được dùng chung qua hàm figureToSvg() cho tab Đề, Đáp án, In, Sao chép, Xuất Word',
  });

  // =========================================================================
  // TEST 7: Hiện khung đỏ cảnh báo khi figure bị lỗi thay vì bỏ trống
  // =========================================================================
  const invalidFigure = {
    kind: 'function-graph',
    functions: [{ expr: 'invalid??syntax***' }],
    xRange: [1, -1], // minX >= maxX
  } as any;

  const svgError = figureToSvg(invalidFigure);
  const test7Passed =
    svgError.includes('<svg') &&
    (svgError.includes('Hình vẽ gặp lỗi') || svgError.includes('#fff1f2') || svgError.includes('#e11d48'));

  results.push({
    name: 'Xử lý lỗi hình vẽ: Hiện khung đỏ thay vì bỏ trống',
    passed: test7Passed,
    expected: 'SVG chứa khung đỏ cảnh báo lỗi (#fff1f2, #e11d48)',
    actual: test7Passed
      ? 'Đã hiển thị khung đỏ cảnh báo trực quan'
      : 'Không tạo khung đỏ khi lỗi',
    details: 'Giúp giáo viên nhận biết lỗi đồ thị/hình vẽ ngay lập tức',
  });

  // =========================================================================
  // TEST 8: Kiểm tra phát hiện lỗi phương án MCQ4 trong Tiêu chí 5
  // =========================================================================
  const dummyPlaceholderMCQ: Question = {
    id: 'q_test_placeholder',
    slotId: 's1',
    subject: 'Toán',
    topic: 'Khảo sát hàm số',
    type: 'MCQ4',
    level: 'NB',
    question: 'Nghiệm của phương trình $x^2 - 4 = 0$ là:',
    options: ['A. Phương án A', 'B. Phương án B', 'C. Phương án C', 'D. Phương án D'],
    correctAnswer: 'A',
    explanation: 'Giải phương trình được nghiệm x = ±2.',
    score: 0.25,
    needsReview: false,
    isTeacherWritten: false,
  };

  const issuesTest8 = runCodeQualityCheck({
    id: 'exam_test_8',
    title: 'Kiểm thử MCQ4',
    config: {} as any,
    blueprint: [],
    questions: [dummyPlaceholderMCQ],
    versions: [],
    createdAt: '',
    updatedAt: '',
  });

  const test8HasPlaceholderError = issuesTest8.some(
    (iss) => iss.criterion === 5 && iss.severity === 'ERROR' && iss.message.includes('phương án giữ chỗ')
  );

  results.push({
    name: 'Tiêu chí 5: Phát hiện và bắt lỗi phương án giữ chỗ MCQ4',
    passed: test8HasPlaceholderError,
    expected: 'Báo lỗi ERROR khi options chứa "Phương án A/B/C/D"',
    actual: test8HasPlaceholderError
      ? 'Đã phát hiện và gán cờ ERROR chính xác'
      : 'Không phát hiện được phương án giữ chỗ',
    details: 'Đảm bảo không bao giờ xuất đề có chứa chữ "Phương án A/B/C/D"',
  });

  // =========================================================================
  // TEST 9: Cấm bảng xét dấu / bảng biến thiên viết bằng chữ thường trong câu dẫn
  // =========================================================================
  const textWithPlainTable = 'Cho hàm số có bảng xét dấu: x −∞ −2 1 +∞ f′(x) − 0 + 0 −. Khẳng định nào đúng?';
  const detectedPlainTable = hasPlainTextTablePattern(textWithPlainTable);

  const dummyQuestionWithTextTable: Question = {
    id: 'q_test_text_table',
    slotId: 's2',
    subject: 'Toán',
    topic: 'Khảo sát hàm số',
    type: 'MCQ4',
    level: 'NB',
    question: textWithPlainTable,
    options: ['A. Hàm số nghịch biến', 'B. Hàm số đồng biến', 'C. Cực đại tại 1', 'D. Cực tiểu tại -2'],
    correctAnswer: 'A',
    explanation: 'Dựa vào bảng xét dấu...',
    score: 0.25,
    needsReview: false,
    isTeacherWritten: false,
  };

  const issuesTest9 = runCodeQualityCheck({
    id: 'exam_test_9',
    title: 'Kiểm thử bảng chữ thường',
    config: {} as any,
    blueprint: [],
    questions: [dummyQuestionWithTextTable],
    versions: [],
    createdAt: '',
    updatedAt: '',
  });

  const test9HasTableError =
    detectedPlainTable &&
    issuesTest9.some(
      (iss) => iss.criterion === 10 && iss.severity === 'ERROR' && iss.message.includes('chữ thường')
    );

  results.push({
    name: 'Cấm bảng xét dấu/biến thiên viết chữ thường trong câu dẫn',
    passed: test9HasTableError,
    expected: 'Nhận diện chuỗi từ 2 ký hiệu ∞ kèm f′(x)/y′ là ERROR và yêu cầu dùng figure',
    actual: test9HasTableError
      ? 'Đã phát hiện và yêu cầu chuyển sang figureKind="sign-table"'
      : 'Không bắt được lỗi bảng chữ thường',
    details: 'Tránh tình trạng AI lười vẽ hình mà viết bảng x, f′(x) xộc xệch trong câu dẫn',
  });

  // =========================================================================
  // TEST 10: Chặn xuất khi còn lỗi (getFaultyQuestions)
  // =========================================================================
  const faultyList = getFaultyQuestions([dummyPlaceholderMCQ, dummyQuestionWithTextTable]);
  const test10Passed = faultyList.length === 2 && faultyList[0].index === 1 && faultyList[1].index === 2;

  results.push({
    name: 'Thu thập câu lỗi và chặn xuất (getFaultyQuestions)',
    passed: test10Passed,
    expected: 'Liệt kê đúng 2 câu lỗi với vị trí và lý do đầy đủ',
    actual: test10Passed
      ? `Đã thu thập đủ ${faultyList.length} câu lỗi sẵn sàng cho hộp thoại chặn xuất`
      : 'Thu thập câu lỗi thất bại',
    details: 'Dùng cho dòng đỏ đầu tab Đề và hộp xác nhận 3 lựa chọn khi bấm In, Sao chép, Xuất Word/PDF',
  });

  // =========================================================================
  // TEST 11: Năm học và tên trường mặc định
  // - Ô Tên trường trống -> "TRƯỜNG: ........................................"
  // - Ô Tên trường có chữ -> in hoa chữ đó
  // - Năm học: tháng 8 trở đi là năm nay - năm sau, trước tháng 8 là năm trước - năm nay
  // =========================================================================
  const schoolBlank = formatSchoolNameForHeader('');
  const schoolCustom = formatSchoolNameForHeader('Trường THPT Chu Văn An');
  const yearAug = getDefaultAcademicYear(new Date(2025, 7, 15)); // Tháng 8 (index 7) -> 2025 - 2026
  const yearMar = getDefaultAcademicYear(new Date(2025, 2, 15)); // Tháng 3 (index 2) -> 2024 - 2025

  const test11Passed =
    schoolBlank === 'TRƯỜNG: ........................................' &&
    schoolCustom === 'TRƯỜNG THPT CHU VĂN AN' &&
    yearAug === '2025 - 2026' &&
    yearMar === '2024 - 2025';

  results.push({
    name: 'Tiêu đề mặc định: Tên trường dòng chấm và Năm học theo tháng hiện tại',
    passed: test11Passed,
    expected: 'Trường trống -> dòng chấm; Tháng 8/2025 -> 2025 - 2026; Tháng 3/2025 -> 2024 - 2025',
    actual: test11Passed
      ? `Chuẩn: "${schoolBlank}", Tháng 8: "${yearAug}", Tháng 3: "${yearMar}"`
      : `Lỗi: Blank="${schoolBlank}", Aug="${yearAug}", Mar="${yearMar}"`,
    details: 'Bỏ mặc định "THPT / THCS / TIỂU HỌC" và không cố định cứng "2024 - 2025"',
  });

  // =========================================================================
  // TEST 12: Phát hiện lời giải tự mâu thuẫn / đổi đề (Tiêu chí 6)
  // Các cụm: "Tuy nhiên, nếu đề bài", "giả sử đề bài", "như bản gốc",
  // "kiểm tra lại tính toán", "không có giá trị nào", "không thỏa mãn"
  // =========================================================================
  const qContra1 = detectSelfContradictoryExplanation({
    explanation: 'Ta có đạo hàm f\'(x). Tuy nhiên, nếu đề bài như bản gốc thì chọn A.',
    correctAnswer: 'A',
  });
  const qContra2 = detectSelfContradictoryExplanation({
    explanation: 'Giải phương trình suy ra không có giá trị nào của m.',
    correctAnswer: '1',
  });
  const qContra3 = detectSelfContradictoryExplanation({
    explanation: 'Do đó không thỏa mãn yêu cầu bài toán.',
    correctAnswer: '2',
  });
  const qContra4 = detectSelfContradictoryExplanation({
    explanation: 'Cần kiểm tra lại tính toán đề bài.',
    correctAnswer: 'B',
  });
  const qValidSol = detectSelfContradictoryExplanation({
    explanation: 'Phương trình có 2 nghiệm x = 2 (thỏa mãn điều kiện x > 0) và x = -1 (loại do không thỏa mãn điều kiện x > 0). Vậy có 1 giá trị.',
    correctAnswer: '1',
  });

  const test12Passed =
    qContra1.isContradictory &&
    qContra2.isContradictory &&
    qContra3.isContradictory &&
    qContra4.isContradictory &&
    !qValidSol.isContradictory;

  results.push({
    name: 'Tiêu chí 6: Phát hiện lời giải tự mâu thuẫn và đổi đề giữa chừng',
    passed: test12Passed,
    expected: 'Bắt lỗi ERROR khi có cụm đổi đề / không có giá trị nào nhưng đáp án có giá trị',
    actual: test12Passed
      ? 'Bắt chính xác cả 4 trường hợp mâu thuẫn và cho qua lời giải toán chuẩn'
      : 'Kiểm tra mâu thuẫn lời giải chưa chuẩn',
    details: 'Cảnh báo và tự sinh lại khi AI lúng túng đổi đề hoặc kết luận ngược đáp án',
  });

  // =========================================================================
  // TEST 13: Tự giải độc lập (Tiêu chí 8) so sánh số học bằng code (sai số 10^-4)
  // - Phân số \frac{1}{2} vs 0.5 -> khớp
  // - Căn thức \sqrt{3} vs 1.732 -> khớp
  // - Số giá trị nguyên: "3" vs "3" -> khớp
  // - Lệch: "1" vs "0" -> ERROR
  // - MCQ: "A" vs "B" -> ERROR
  // =========================================================================
  const compFraction = compareAnswersWithCode('\\frac{1}{2}', '0.5', 'SHORT_ANSWER');
  const compRadical = compareAnswersWithCode('\\sqrt{3}', '1.732', 'SHORT_ANSWER');
  const compIntCount = compareAnswersWithCode('Có 3 giá trị nguyên', '3', 'SHORT_ANSWER');
  const compMismatchNum = compareAnswersWithCode('1', '0', 'SHORT_ANSWER');
  const compMismatchMcq = compareAnswersWithCode('A', 'B', 'MCQ4');

  const test13Passed =
    compFraction.isMatch &&
    compRadical.isMatch &&
    compIntCount.isMatch &&
    !compMismatchNum.isMatch &&
    !compMismatchMcq.isMatch;

  results.push({
    name: 'Tiêu chí 8: Tự giải độc lập so sánh số học bằng code (|Δ| < 10^-4)',
    passed: test13Passed,
    expected: 'Khớp phân số, căn thức, số nguyên; bắt lỗi ERROR khi lệch đáp số hoặc khác phương án',
    actual: test13Passed
      ? 'So sánh số học chính xác tuyệt đối cho cả trắc nghiệm và trả lời ngắn'
      : 'Lỗi so sánh số học Tiêu chí 8',
    details: 'Chuẩn hóa phân số, số thập phân, căn thức bằng mathjs và đánh dấu needsReview khi lệch',
  });

  // =========================================================================
  // TEST 14: Kiểm thử nâng cấp figureRenderer
  // (a) SVG bảng biến thiên chứa định nghĩa marker của chính nó (fig-arrow-v)
  // (b) Đồ thị không yRange tự đo và nằm trọn trong khung (clipPath fig-plot-clip)
  // (c) Nhãn chứa chữ < và & được thoát XML an toàn
  // (d) \frac{1}{2} hiển thị 1/2
  // =========================================================================
  // (a) Bảng biến thiên có marker riêng
  const vtTestFig: QuestionFigure = {
    kind: 'variation-table',
    xValues: ['-\\infty', '0', '+\\infty'],
    yValues: ['-\\infty', '1', '-\\infty'],
    trends: ['up', 'down'],
    derivativeSigns: ['+', '-'],
  };
  const vtSvg = figureToSvg(vtTestFig);
  const test14aPassed = vtSvg.includes('<defs>') && vtSvg.includes('id="fig-arrow-v"');

  // (b) Đồ thị không yRange tự đo và có clipPath
  const graphTestNoY: QuestionFigure = {
    kind: 'function-graph',
    functions: [{ expr: 'x^2 - 1' }],
    xRange: [-3, 3],
  };
  const graphSvg = figureToSvg(graphTestNoY);
  const test14bPassed =
    graphSvg.includes('clip-path="url(#fig-plot-clip)"') &&
    graphSvg.includes('id="fig-arrow-g"') &&
    !graphSvg.includes('Hình vẽ gặp lỗi');

  // (c) Nhãn chứa chữ < và & không làm SVG lỗi
  const geomTestXml: QuestionFigure = {
    kind: 'geometry',
    points: [
      { id: 'p1', x: 0, y: 0, label: 'A & B' },
      { id: 'p2', x: 3, y: 3, label: 'x < 3' },
    ],
  };
  const geomSvg = figureToSvg(geomTestXml);
  const test14cPassed =
    geomSvg.includes('A &amp; B') &&
    geomSvg.includes('x &lt; 3') &&
    !geomSvg.includes('A & B') &&
    !geomSvg.includes('x < 3');

  // (d) \frac{1}{2} hiển thị 1/2
  const fracResult = formatMathSymbolsForSvg('\\frac{1}{2}');
  const test14dPassed = fracResult === '1/2';

  const test14Passed = test14aPassed && test14bPassed && test14cPassed && test14dPassed;

  results.push({
    name: 'Nâng cấp figureRenderer: Marker riêng, auto yRange & clipPath, thoát XML, định dạng phân số',
    passed: test14Passed,
    expected: '(a) Marker fig-arrow-v riêng, (b) Tự đo yRange & clipPath, (c) Thoát & và < an toàn, (d) \\frac{1}{2} thành 1/2',
    actual: test14Passed
      ? `Đạt cả 4 yêu cầu: Marker riêng=${test14aPassed}, Auto yRange=${test14bPassed}, XML safe=${test14cPassed}, Phân số=${fracResult}`
      : `Chưa đạt: Marker=${test14aPassed}, NoYRange=${test14bPassed}, XmlSafe=${test14cPassed}, Frac="${fracResult}"`,
    details: 'Đảm bảo mỗi SVG tự chứa marker, không tràn ra ngoài khung và hiển thị ký hiệu toán học chính xác',
  });

  // =========================================================================
  // TEST 15: Tự động phát hiện slot cần hình và sinh mẫu dynamic figure
  // =========================================================================
  const slotGraph = inferSlotFigureNeed({ topic: 'Khảo sát sự biến thiên và vẽ đồ thị hàm số bậc 3' });
  const slotVariation = inferSlotFigureNeed({ topic: 'Đọc bảng biến thiên của hàm số' });
  const slotSign = inferSlotFigureNeed({ topic: 'Xét dấu tam thức bậc hai và bảng xét dấu' });
  const slotGeometry = inferSlotFigureNeed({ topic: 'Thể tích khối chóp và hình lăng trụ đứng' });
  const slotChart = inferSlotFigureNeed({ topic: 'Đọc biểu đồ tần số và bảng phân bố' });
  const slotPureMath = inferSlotFigureNeed({ topic: 'Giải phương trình vô tỉ chứa căn thức' });

  const dynamicFigSampleNeedsFig = getDynamicFigureSample({
    id: 's1',
    orderNumber: 1,
    questionType: 'MCQ4',
    level: 'NB',
    topic: 'Đồ thị',
    score: 0.25,
    needsFigure: true,
    figureKinds: ['function-graph'],
  });

  const dynamicFigSampleNoFig = getDynamicFigureSample({
    id: 's2',
    orderNumber: 2,
    questionType: 'MCQ4',
    level: 'NB',
    topic: 'Tính toán',
    score: 0.25,
    needsFigure: false,
  });

  const test15Passed =
    slotGraph.needsFigure &&
    slotGraph.figureKinds?.includes('function-graph') &&
    slotVariation.needsFigure &&
    slotVariation.figureKinds?.includes('variation-table') &&
    slotSign.needsFigure &&
    slotSign.figureKinds?.includes('sign-table') &&
    slotGeometry.needsFigure &&
    slotGeometry.figureKinds?.includes('geometry') &&
    slotChart.needsFigure &&
    slotChart.figureKinds?.includes('data-chart') &&
    !slotPureMath.needsFigure &&
    dynamicFigSampleNeedsFig.includes('"figure"') &&
    dynamicFigSampleNoFig === '';

  results.push({
    name: 'Suy luận nhu cầu hình vẽ từ từ khóa (inferSlotFigureNeed) và Dynamic Figure JSON Prompt',
    passed: Boolean(test15Passed),
    expected: 'Suy ra đúng 5 loại hình từ từ khóa; không có từ khóa -> false; prompt mẫu figure động',
    actual: test15Passed
      ? 'Đạt: Nhận diện chính xác 5/5 loại hình và loại trừ câu không hình; dynamic prompt chuẩn'
      : `Chưa đạt: Graph=${slotGraph.needsFigure}, Geom=${slotGeometry.needsFigure}, Pure=${slotPureMath.needsFigure}`,
    details: 'Đảm bảo tự động đánh dấu needsFigure và phân loại figureKinds chính xác từ chủ đề',
  });

  // =========================================================================
  // TEST 16: Dựng câu hỏi Toán có hình bằng Code thuần (mathFigureTemplates)
  // 3 mẫu chạy 30 lần với seed khác nhau:
  // (a) đúng 1 phương án trùng khớp;
  // (b) hệ số nguyên;
  // (c) vượt qua validateFigure;
  // (d) đáp số khớp bảng biến thiên / đồ thị;
  // (e) số ý đúng khớp với target (1 đến 4).
  // =========================================================================
  const templateTestReport = testMathFigureTemplates();
  results.push({
    name: 'Dựng câu hỏi Toán có hình bằng Code thuần (Mẫu 1, 2, 3 - 90 lần chạy seeded)',
    passed: templateTestReport.allPassed,
    expected: '90/90 lượt kiểm tra đạt: 1 phương án đúng, hệ số nguyên, validateFigure hợp lệ, 1-4 ý đúng cho True/False',
    actual: templateTestReport.allPassed
      ? `Đạt: ${templateTestReport.passedChecks}/${templateTestReport.totalChecks} lượt kiểm thử hoàn toàn chuẩn xác`
      : `Thất bại ${templateTestReport.failures.length} trường hợp: ${templateTestReport.failures.slice(0, 3).join('; ')}`,
    details: 'Kiểm thử 3 mẫu câu hỏi Toán (nhận dạng đồ thị, đọc bảng biến thiên, đúng/sai) với 30 seed khác nhau mỗi mẫu',
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
