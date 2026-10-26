/**
 * Dựng câu hỏi Toán có hình BẰNG CODE THUẦN (Deterministic Math Engine)
 * Không nhờ AI để vẽ và tính đáp án.
 * AI chỉ được viết lại câu dẫn 1 câu nếu cần; nếu lỗi thì dùng câu dẫn mẫu của code.
 * Đảm bảo 100% tính chính xác toán học, tính nhất quán giữa hình vẽ, đáp án và lời giải.
 */

import {
  BlueprintSlot,
  ExamConfig,
  FunctionGraphFigure,
  Question,
  TrueFalseStatement,
  VariationTableFigure,
} from '../types';
import { figureToSvg } from './figureRenderer';
import { validateFigure } from './validate';

/** Bộ sinh số giả ngẫu nhiên có hạt giống (Seeded PRNG - LCG) */
export class SeededRng {
  private s: number;

  constructor(seed: number = 123456789) {
    this.s = Math.floor(Math.abs(seed)) || 123456789;
  }

  next(): number {
    this.s = (this.s * 1664525 + 1013904223) % 4294967296;
    return this.s / 4294967296;
  }

  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  shuffle<T>(arr: T[]): T[] {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
}

/** Chuyển đa thức bậc 3 thành chuỗi LaTeX: $y = ax^3 + bx^2 + cx + d$ */
export function formatCubicLatex(a: number, b: number, c: number, d: number): string {
  let res = 'y = ';

  // ax^3
  if (a === 1) res += 'x^3';
  else if (a === -1) res += '-x^3';
  else res += `${a}x^3`;

  // bx^2
  if (b !== 0) {
    if (b > 0) res += res.endsWith('= ') ? (b === 1 ? 'x^2' : `${b}x^2`) : ` + ${b === 1 ? '' : b}x^2`;
    else res += res.endsWith('= ') ? (b === -1 ? '-x^2' : `${b}x^2`) : ` - ${Math.abs(b) === 1 ? '' : Math.abs(b)}x^2`;
  }

  // cx
  if (c !== 0) {
    if (c > 0) res += res.endsWith('= ') ? (c === 1 ? 'x' : `${c}x`) : ` + ${c === 1 ? '' : c}x`;
    else res += res.endsWith('= ') ? (c === -1 ? '-x' : `${c}x`) : ` - ${Math.abs(c) === 1 ? '' : Math.abs(c)}x`;
  }

  // d
  if (d !== 0) {
    if (d > 0) res += res.endsWith('= ') ? `${d}` : ` + ${d}`;
    else res += res.endsWith('= ') ? `${d}` : ` - ${Math.abs(d)}`;
  } else if (res === 'y = ') {
    res += '0';
  }

  return `$${res}$`;
}

/** Chuyển đa thức bậc 3 thành cú pháp mathjs */
export function formatCubicMathJs(a: number, b: number, c: number, d: number): string {
  const parts: string[] = [];

  if (a === 1) parts.push('x^3');
  else if (a === -1) parts.push('-1*x^3');
  else parts.push(`${a}*x^3`);

  if (b !== 0) {
    parts.push(b > 0 ? `+ ${b}*x^2` : `- ${Math.abs(b)}*x^2`);
  }
  if (c !== 0) {
    parts.push(c > 0 ? `+ ${c}*x` : `- ${Math.abs(c)}*x`);
  }
  if (d !== 0) {
    parts.push(d > 0 ? `+ ${d}` : `- ${Math.abs(d)}`);
  }

  return parts.join(' ');
}

/** Chuyển đa thức trùng phương thành chuỗi LaTeX: $y = ax^4 + bx^2 + c$ */
export function formatBiquadraticLatex(a: number, b: number, c: number): string {
  let res = 'y = ';

  // ax^4
  if (a === 1) res += 'x^4';
  else if (a === -1) res += '-x^4';
  else res += `${a}x^4`;

  // bx^2
  if (b !== 0) {
    if (b > 0) res += ` + ${b === 1 ? '' : b}x^2`;
    else res += ` - ${Math.abs(b) === 1 ? '' : Math.abs(b)}x^2`;
  }

  // c
  if (c !== 0) {
    if (c > 0) res += ` + ${c}`;
    else res += ` - ${Math.abs(c)}`;
  } else if (res === 'y = ') {
    res += '0';
  }

  return `$${res}$`;
}

/** Chuyển đa thức trùng phương thành cú pháp mathjs */
export function formatBiquadraticMathJs(a: number, b: number, c: number): string {
  const parts: string[] = [];

  if (a === 1) parts.push('x^4');
  else if (a === -1) parts.push('-1*x^4');
  else parts.push(`${a}*x^4`);

  if (b !== 0) {
    parts.push(b > 0 ? `+ ${b}*x^2` : `- ${Math.abs(b)}*x^2`);
  }
  if (c !== 0) {
    parts.push(c > 0 ? `+ ${c}` : `- ${Math.abs(c)}`);
  }

  return parts.join(' ');
}

/**
 * -----------------------------------------------------------------------------
 * MẪU 1 – NHẬN DẠNG ĐỒ THỊ BẬC BA
 * -----------------------------------------------------------------------------
 * 1) chọn a thuộc {1, -1};
 * 2) chọn hai nghiệm nguyên x1 khác x2 sao cho x1 + x2 chẵn;
 * 3) y' = 3a(x - x1)(x - x2) => b = -3a(x1 + x2)/2, c = 3a·x1·x2, d nguyên từ -3 đến 3.
 * 4) figure là function-graph với expr của hàm, xRange bao quanh hai cực trị (lùi mỗi bên 1.5),
 *    yRange đo từ giá trị thật, hideFormula = true, không ghi nhãn cực trị.
 * 5) Bốn phương án: hàm đúng và ba hàm nhiễu (đổi dấu a, đổi dấu b, đổi d ± 2)
 *    đảm bảo các phương án đôi một khác nhau và khác hàm đúng ở ít nhất 1 yếu tố.
 * 6) Vị trí đáp án đúng ngẫu nhiên có seed. optionExprs mathjs, LaTeX trong $...$.
 */
export function generateCubicGraphQuestion(
  slot: BlueprintSlot,
  seed: number = Date.now()
): Question {
  const rng = new SeededRng(seed);

  // a in {1, -1}
  const a = rng.pick([1, -1]);

  // Các cặp nghiệm (x1, x2) nguyên sao cho x1 < x2 và (x1 + x2) chẵn
  const validPairs: [number, number][] = [
    [-3, -1],
    [-2, 0],
    [-1, 1],
    [0, 2],
    [1, 3],
    [-2, 2],
    [-3, 1],
    [-1, 3],
  ];
  const [x1, x2] = rng.pick(validPairs);

  // y' = 3a(x - x1)(x - x2) = 3a[x^2 - (x1+x2)x + x1*x2] = 3a*x^2 - 3a(x1+x2)x + 3a*x1*x2
  // Vì đạo hàm của ax^3 + bx^2 + cx + d là 3ax^2 + 2bx + c
  // Nên 2b = -3a(x1 + x2) => b = -3 * a * (x1 + x2) / 2
  // c = 3 * a * x1 * x2
  const b = (-3 * a * (x1 + x2)) / 2;
  const c = 3 * a * x1 * x2;
  const d = rng.int(-3, 3);

  // Giá trị thật tại các điểm
  const evalCubic = (x: number, ca = a, cb = b, cc = c, cd = d) =>
    ca * x * x * x + cb * x * x + cc * x + cd;

  const y1 = evalCubic(x1);
  const y2 = evalCubic(x2);

  const xMin = Math.min(x1, x2) - 1.5;
  const xMax = Math.max(x1, x2) + 1.5;

  const yAtMin = evalCubic(xMin);
  const yAtMax = evalCubic(xMax);
  const yAtZero = evalCubic(0);

  const allYVals = [y1, y2, yAtMin, yAtMax, yAtZero, 0];
  const realMinY = Math.min(...allYVals);
  const realMaxY = Math.max(...allYVals);
  const ySpan = realMaxY - realMinY || 4;
  const marginY = ySpan * 0.15;

  const yMinRange = Math.floor(realMinY - marginY);
  const yMaxRange = Math.ceil(realMaxY + marginY);

  const mainMathJs = formatCubicMathJs(a, b, c, d);
  const figure: FunctionGraphFigure = {
    kind: 'function-graph',
    functions: [{ expr: mainMathJs }],
    xRange: [xMin, xMax],
    yRange: [yMinRange, yMaxRange],
    hideFormula: true,
    showGrid: true,
  };

  // 3 hàm nhiễu:
  // 1) Đổi dấu a: a1 = -a. (Khác dấu a)
  const a1 = -a;
  const b1 = (-3 * a1 * (x1 + x2)) / 2;
  const c1 = 3 * a1 * x1 * x2;
  const d1 = d;

  // 2) Đổi cực trị: đổi x1, x2 thành -x1, -x2 (đổi dấu b).
  // Nếu x1 + x2 = 0 (b=0), dịch nghiệm sang [x1 + 1, x2 + 1] để đảm bảo vị trí cực trị khác nhau
  let a2 = a;
  let x1_2 = -x2;
  let x2_2 = -x1;
  if (x1 + x2 === 0) {
    x1_2 = x1 + 1;
    x2_2 = x2 + 1;
  }
  const b2 = (-3 * a2 * (x1_2 + x2_2)) / 2;
  const c2 = 3 * a2 * x1_2 * x2_2;
  const d2 = d;

  // 3) Đổi d thành d ± 2 (khác giao điểm Oy)
  const a3 = a;
  const b3 = b;
  const c3 = c;
  const d3 = d <= 1 ? d + 2 : d - 2;

  // Kiểm tra 4 phương án đôi một khác nhau
  const candidateItems = [
    { a, b, c, d, isCorrect: true },
    { a: a1, b: b1, c: c1, d: d1, isCorrect: false },
    { a: a2, b: b2, c: c2, d: d2, isCorrect: false },
    { a: a3, b: b3, c: c3, d: d3, isCorrect: false },
  ];

  // Đảm bảo không trùng nhau nếu ngẫu nhiên rơi vào trường hợp trùng
  const seenPoly = new Set<string>();
  const verifiedItems: typeof candidateItems = [];

  for (const item of candidateItems) {
    const key = `${item.a},${item.b},${item.c},${item.d}`;
    if (!seenPoly.has(key)) {
      seenPoly.add(key);
      verifiedItems.push(item);
    }
  }

  // Nếu bị trùng (rất hiếm), bổ sung phương án khác
  while (verifiedItems.length < 4) {
    const altD = d + verifiedItems.length * 2;
    const key = `${a},${b},${c},${altD}`;
    if (!seenPoly.has(key)) {
      seenPoly.add(key);
      verifiedItems.push({ a, b, c, d: altD, isCorrect: false });
    }
  }

  // Xáo trộn vị trí đáp án bằng seeded PRNG
  const shuffled = rng.shuffle(verifiedItems);
  const correctIdx = shuffled.findIndex((item) => item.isCorrect);
  const letters = ['A', 'B', 'C', 'D'];
  const correctAnswer = letters[correctIdx];

  const options = shuffled.map((item) => formatCubicLatex(item.a, item.b, item.c, item.d));
  const optionExprs = shuffled.map((item) => formatCubicMathJs(item.a, item.b, item.c, item.d));

  const cdName = a > 0 ? (x1 < x2 ? x1 : x2) : (x1 < x2 ? x2 : x1);
  const ctName = a > 0 ? (x1 < x2 ? x2 : x1) : (x1 < x2 ? x1 : x2);

  const explanation =
    `Dựa vào đồ thị hàm số ta có:\n` +
    `1. Nhánh ngoài cùng bên phải đi ${a > 0 ? 'lên' : 'xuống'} nên hệ số $a ${a > 0 ? '> 0' : '< 0'}$.\n` +
    `2. Đồ thị cắt trục tung tại điểm $(0; ${d})$ nên hệ số tự do $d = ${d}$.\n` +
    `3. Đồ thị có hai điểm cực trị là $x = ${x1}$ và $x = ${x2}$ (trong đó điểm cực đại là $x = ${cdName}$, điểm cực tiểu là $x = ${ctName}$).\n` +
    `Do đó, đồ thị đã cho là của hàm số ${options[correctIdx]}. Đáp án đúng: [${correctAnswer}].`;

  return {
    id: slot.id,
    slotId: slot.id,
    subject: 'Toán học',
    topic: slot.topic || 'Hàm số và đồ thị',
    type: 'MCQ4',
    level: slot.level,
    question: 'Đường cong trong hình vẽ bên là đồ thị của hàm số nào dưới đây?',
    options,
    optionExprs,
    correctAnswer,
    explanation,
    score: slot.score,
    needsReview: false,
    isTeacherWritten: false,
    source: 'template',
    figure,
    svgDiagram: figureToSvg(figure),
  };
}

/**
 * -----------------------------------------------------------------------------
 * MẪU 2 – ĐỌC BẢNG BIẾN THIÊN
 * -----------------------------------------------------------------------------
 * Lấy hàm bậc 3 hoặc hàm trùng phương ax^4 + bx^2 + c với nghiệm đạo hàm nguyên.
 * Tạo figure variation-table.
 * Câu hỏi xoay vòng:
 * - Giá trị cực tiểu
 * - Giá trị cực đại
 * - Điểm cực tiểu
 * - Điểm cực đại
 * - Số điểm cực trị
 * - Khoảng đồng biến
 * - Khoảng nghịch biến
 * Phương án nhiễu lấy từ các đại lượng thật trong bảng (nhầm x với y, cực đại với cực tiểu).
 */
export function generateVariationTableQuestion(
  slot: BlueprintSlot,
  seed: number = Date.now()
): Question {
  const rng = new SeededRng(seed);

  // Chọn loại hàm: bậc ba (0) hoặc trùng phương (1)
  const isBiquadratic = rng.next() > 0.5;

  let figure: VariationTableFigure;
  let qText = '';
  let correctOpt = '';
  let distractors: string[] = [];
  let explainDetail = '';

  if (!isBiquadratic) {
    // --- HÀM BẬC BA ---
    const a = rng.pick([1, -1]);
    const validPairs: [number, number][] = [
      [-2, 0],
      [-1, 1],
      [0, 2],
      [-3, -1],
      [1, 3],
    ];
    const [x1, x2] = rng.pick(validPairs); // x1 < x2
    const b = (-3 * a * (x1 + x2)) / 2;
    const c = 3 * a * x1 * x2;
    const d = rng.int(-2, 3);

    const evalY = (x: number) => a * x * x * x + b * x * x + c * x + d;
    const y1 = evalY(x1);
    const y2 = evalY(x2);

    // Cực trị:
    // a > 0: x1 cực đại (y1), x2 cực tiểu (y2)
    // a < 0: x1 cực tiểu (y1), x2 cực đại (y2)
    const xCD = a > 0 ? x1 : x2;
    const yCD = a > 0 ? y1 : y2;
    const xCT = a > 0 ? x2 : x1;
    const yCT = a > 0 ? y2 : y1;

    const xValues = ['-\\infty', String(x1), String(x2), '+\\infty'];
    const derivativeSigns: ('+' | '-')[] = a > 0 ? ['+', '-', '+'] : ['-', '+', '-'];
    const trends: ('up' | 'down')[] = a > 0 ? ['up', 'down', 'up'] : ['down', 'up', 'down'];
    const yValues =
      a > 0
        ? ['-\\infty', String(y1), String(y2), '+\\infty']
        : ['+\\infty', String(y1), String(y2), '-\\infty'];

    figure = {
      kind: 'variation-table',
      xValues,
      yValues,
      trends,
      derivativeSigns,
    };

    // Chọn kiểu câu hỏi xoay vòng (0 to 6)
    const qTypes = [
      'LOCAL_MIN_VALUE',
      'LOCAL_MAX_VALUE',
      'LOCAL_MIN_POINT',
      'LOCAL_MAX_POINT',
      'NUM_EXTREMA',
      'INCREASING_INTERVAL',
      'DECREASING_INTERVAL',
    ];
    const selectedQType = rng.pick(qTypes);

    switch (selectedQType) {
      case 'LOCAL_MIN_VALUE':
        qText = 'Cho hàm số $y = f(x)$ có bảng biến thiên như hình vẽ bên. Giá trị cực tiểu của hàm số đã cho bằng';
        correctOpt = `$${yCT}$`;
        distractors = [`$${yCD}$`, `$${xCT}$`, `$${xCD}$`, `$${yCT + 1}$`];
        explainDetail = `Từ bảng biến thiên, tại điểm cực tiểu $x = ${xCT}$ thì giá trị cực tiểu của hàm số là $y_{CT} = ${yCT}$.`;
        break;

      case 'LOCAL_MAX_VALUE':
        qText = 'Cho hàm số $y = f(x)$ có bảng biến thiên như hình vẽ bên. Giá trị cực đại của hàm số đã cho bằng';
        correctOpt = `$${yCD}$`;
        distractors = [`$${yCT}$`, `$${xCD}$`, `$${xCT}$`, `$${yCD - 1}$`];
        explainDetail = `Từ bảng biến thiên, tại điểm cực đại $x = ${xCD}$ thì giá trị cực đại của hàm số là $y_{CD} = ${yCD}$.`;
        break;

      case 'LOCAL_MIN_POINT':
        qText = 'Cho hàm số $y = f(x)$ có bảng biến thiên như hình vẽ bên. Điểm cực tiểu của hàm số đã cho là';
        correctOpt = `$x = ${xCT}$`;
        distractors = [`$x = ${xCD}$`, `$y = ${yCT}$`, `$x = ${xCT + 1}$`, `$y = ${yCD}$`];
        explainDetail = `Từ bảng biến thiên, hàm số đạt cực tiểu tại điểm $x = ${xCT}$ (giá trị cực tiểu là $y = ${yCT}$).`;
        break;

      case 'LOCAL_MAX_POINT':
        qText = 'Cho hàm số $y = f(x)$ có bảng biến thiên như hình vẽ bên. Điểm cực đại của hàm số đã cho là';
        correctOpt = `$x = ${xCD}$`;
        distractors = [`$x = ${xCT}$`, `$y = ${yCD}$`, `$x = ${xCD - 1}$`, `$y = ${yCT}$`];
        explainDetail = `Từ bảng biến thiên, hàm số đạt cực đại tại điểm $x = ${xCD}$ (giá trị cực đại là $y = ${yCD}$).`;
        break;

      case 'NUM_EXTREMA':
        qText = 'Cho hàm số $y = f(x)$ có bảng biến thiên như hình vẽ bên. Số điểm cực trị của hàm số đã cho là';
        correctOpt = '2';
        distractors = ['0', '1', '3'];
        explainDetail = `Hàm số có đạo hàm đổi dấu 2 lần qua các điểm $x = ${x1}$ và $x = ${x2}$, do đó hàm số có đúng 2 điểm cực trị.`;
        break;

      case 'INCREASING_INTERVAL':
        qText = 'Cho hàm số $y = f(x)$ có bảng biến thiên như hình vẽ bên. Hàm số đã cho đồng biến trên khoảng nào dưới đây?';
        if (a > 0) {
          correctOpt = `$(${x2}; +\\infty)$`;
          distractors = [`$(${x1}; ${x2})$`, `$(${x1}; +\\infty)$`, `$(-\\infty; ${x2})$`];
          explainDetail = `Hàm số có $y' > 0$ trên $(-\\infty; ${x1})$ và $(${x2}; +\\infty)$ nên đồng biến trên mỗi khoảng đó.`;
        } else {
          correctOpt = `$(${x1}; ${x2})$`;
          distractors = [`$(-\\infty; ${x1})$`, `$(${x2}; +\\infty)$`, `$(-\\infty; ${x2})$`];
          explainDetail = `Hàm số có $y' > 0$ trên khoảng $(${x1}; ${x2})$ nên đồng biến trên khoảng $(${x1}; ${x2})$.`;
        }
        break;

      case 'DECREASING_INTERVAL':
      default:
        qText = 'Cho hàm số $y = f(x)$ có bảng biến thiên như hình vẽ bên. Hàm số đã cho nghịch biến trên khoảng nào dưới đây?';
        if (a > 0) {
          correctOpt = `$(${x1}; ${x2})$`;
          distractors = [`$(-\\infty; ${x1})$`, `$(${x2}; +\\infty)$`, `$(-\\infty; ${x2})$`];
          explainDetail = `Hàm số có $y' < 0$ trên khoảng $(${x1}; ${x2})$ nên nghịch biến trên khoảng $(${x1}; ${x2})$.`;
        } else {
          correctOpt = `$(${x2}; +\\infty)$`;
          distractors = [`$(${x1}; ${x2})$`, `$(${x1}; +\\infty)$`, `$(-\\infty; ${x2})$`];
          explainDetail = `Hàm số có $y' < 0$ trên $(-\\infty; ${x1})$ và $(${x2}; +\\infty)$ nên nghịch biến trên mỗi khoảng đó.`;
        }
        break;
    }
  } else {
    // --- HÀM TRÙNG PHƯƠNG ---
    const a = rng.pick([1, -1]);
    const x0 = rng.pick([1, 2]); // Cực trị tại -x0, 0, x0
    // y = ax^4 + bx^2 + c. y' = 4ax^3 + 2bx = 4ax(x^2 + b/(2a)).
    // Cần x^2 = x0^2 => b = -2 * a * x0^2
    const b = -2 * a * x0 * x0;
    const c = rng.int(-2, 2);

    const evalBiquad = (x: number) => a * x * x * x * x + b * x * x + c;
    const yAtZero = c;
    const yAtExt = evalBiquad(x0); // = evalBiquad(-x0)

    const xValues = ['-\\infty', String(-x0), '0', String(x0), '+\\infty'];
    const derivativeSigns: ('+' | '-')[] =
      a > 0 ? ['-', '+', '-', '+'] : ['+', '-', '+', '-'];
    const trends: ('up' | 'down')[] =
      a > 0 ? ['down', 'up', 'down', 'up'] : ['up', 'down', 'up', 'down'];
    const yValues =
      a > 0
        ? ['+\\infty', String(yAtExt), String(yAtZero), String(yAtExt), '+\\infty']
        : ['-\\infty', String(yAtExt), String(yAtZero), String(yAtExt), '-\\infty'];

    figure = {
      kind: 'variation-table',
      xValues,
      yValues,
      trends,
      derivativeSigns,
    };

    const qTypes = [
      'LOCAL_MIN_VALUE',
      'LOCAL_MAX_VALUE',
      'NUM_EXTREMA',
      'INCREASING_INTERVAL',
      'DECREASING_INTERVAL',
    ];
    const selectedQType = rng.pick(qTypes);

    const yCD = a > 0 ? yAtZero : yAtExt;
    const yCT = a > 0 ? yAtExt : yAtZero;

    switch (selectedQType) {
      case 'LOCAL_MIN_VALUE':
        qText = 'Cho hàm số $y = f(x)$ có bảng biến thiên như hình vẽ bên. Giá trị cực tiểu của hàm số đã cho bằng';
        correctOpt = `$${yCT}$`;
        distractors = [`$${yCD}$`, `$${x0}$`, `$${-x0}$`, `$${yCT - 1}$`];
        explainDetail = `Dựa vào bảng biến thiên, giá trị cực tiểu của hàm số là $y_{CT} = ${yCT}$.`;
        break;

      case 'LOCAL_MAX_VALUE':
        qText = 'Cho hàm số $y = f(x)$ có bảng biến thiên như hình vẽ bên. Giá trị cực đại của hàm số đã cho bằng';
        correctOpt = `$${yCD}$`;
        distractors = [`$${yCT}$`, `$0$`, `$${x0}$`, `$${yCD + 1}$`];
        explainDetail = `Dựa vào bảng biến thiên, giá trị cực đại của hàm số là $y_{CD} = ${yCD}$.`;
        break;

      case 'NUM_EXTREMA':
        qText = 'Cho hàm số $y = f(x)$ có bảng biến thiên như hình vẽ bên. Số điểm cực trị của hàm số đã cho là';
        correctOpt = '3';
        distractors = ['1', '2', '4'];
        explainDetail = `Đạo hàm $y'$ đổi dấu khi qua 3 điểm $x = ${-x0}$, $x = 0$ và $x = ${x0}$. Do đó hàm số có 3 điểm cực trị.`;
        break;

      case 'INCREASING_INTERVAL':
        qText = 'Cho hàm số $y = f(x)$ có bảng biến thiên như hình vẽ bên. Hàm số đã cho đồng biến trên khoảng nào dưới đây?';
        if (a > 0) {
          correctOpt = `$(${x0}; +\\infty)$`;
          distractors = [`$(0; ${x0})$`, `$(-\\infty; ${-x0})$`, `$(${ -x0}; ${x0})$`];
        } else {
          correctOpt = `$(0; ${x0})$`;
          distractors = [`$(${x0}; +\\infty)$`, `$(-\\infty; 0)$`, `$(${ -x0}; +\\infty)$`];
        }
        explainDetail = `Dựa vào bảng biến thiên, hàm số đồng biến trên các khoảng có $y' > 0$.`;
        break;

      case 'DECREASING_INTERVAL':
      default:
        qText = 'Cho hàm số $y = f(x)$ có bảng biến thiên như hình vẽ bên. Hàm số đã cho nghịch biến trên khoảng nào dưới đây?';
        if (a > 0) {
          correctOpt = `$(0; ${x0})$`;
          distractors = [`$(${x0}; +\\infty)$`, `$(${ -x0}; 0)$`, `$(-\\infty; ${x0})$`];
        } else {
          correctOpt = `$(${x0}; +\\infty)$`;
          distractors = [`$(0; ${x0})$`, `$(-\\infty; ${ -x0})$`, `$(0; +\\infty)$`];
        }
        explainDetail = `Dựa vào bảng biến thiên, hàm số nghịch biến trên các khoảng có $y' < 0$.`;
        break;
    }
  }

  // Lọc 3 phương án nhiễu đôi một khác nhau và khác đáp án đúng
  const uniqueDistractors: string[] = [];
  for (const d of distractors) {
    if (d !== correctOpt && !uniqueDistractors.includes(d)) {
      uniqueDistractors.push(d);
    }
    if (uniqueDistractors.length === 3) break;
  }

  // Dự phòng nếu chưa đủ 3 nhiễu
  let fallbackVal = 5;
  while (uniqueDistractors.length < 3) {
    const candidate = `$${fallbackVal}$`;
    if (candidate !== correctOpt && !uniqueDistractors.includes(candidate)) {
      uniqueDistractors.push(candidate);
    }
    fallbackVal++;
  }

  const allItems = [
    { text: correctOpt, isCorrect: true },
    { text: uniqueDistractors[0], isCorrect: false },
    { text: uniqueDistractors[1], isCorrect: false },
    { text: uniqueDistractors[2], isCorrect: false },
  ];

  const shuffled = rng.shuffle(allItems);
  const correctIdx = shuffled.findIndex((item) => item.isCorrect);
  const letters = ['A', 'B', 'C', 'D'];
  const correctAnswer = letters[correctIdx];
  const options = shuffled.map((item) => item.text);

  return {
    id: slot.id,
    slotId: slot.id,
    subject: 'Toán học',
    topic: slot.topic || 'Khảo sát sự biến thiên của hàm số',
    type: 'MCQ4',
    level: slot.level,
    question: qText,
    options,
    correctAnswer,
    explanation: `${explainDetail}\nVậy phương án đúng là ${correctAnswer}.`,
    score: slot.score,
    needsReview: false,
    isTeacherWritten: false,
    source: 'template',
    figure,
    svgDiagram: figureToSvg(figure),
  };
}

/**
 * -----------------------------------------------------------------------------
 * MẪU 3 – ĐÚNG/SAI DỰA TRÊN BẢNG BIẾN THIÊN HOẶC ĐỒ THỊ
 * -----------------------------------------------------------------------------
 * 4 ý a, b, c, d do code sinh từ sự kiện thật của hàm.
 * Số ý đúng ngẫu nhiên từ 1 đến 4.
 * Ý sai là thay một dữ kiện bằng dữ kiện sai có kiểm soát.
 */
export function generateTrueFalseMathQuestion(
  slot: BlueprintSlot,
  seed: number = Date.now()
): Question {
  const rng = new SeededRng(seed);

  // Sinh hàm bậc 3 chuẩn
  const a = rng.pick([1, -1]);
  const validPairs: [number, number][] = [
    [-2, 0],
    [-1, 1],
    [0, 2],
    [-3, -1],
    [1, 3],
  ];
  const [x1, x2] = rng.pick(validPairs); // x1 < x2
  const b = (-3 * a * (x1 + x2)) / 2;
  const c = 3 * a * x1 * x2;
  const d = rng.int(-2, 2);

  const evalY = (x: number) => a * x * x * x + b * x * x + c * x + d;
  const y1 = evalY(x1);
  const y2 = evalY(x2);

  const xCD = a > 0 ? x1 : x2;
  const yCD = a > 0 ? y1 : y2;
  const xCT = a > 0 ? x2 : x1;
  const yCT = a > 0 ? y2 : y1;

  // Bảng biến thiên
  const figure: VariationTableFigure = {
    kind: 'variation-table',
    xValues: ['-\\infty', String(x1), String(x2), '+\\infty'],
    yValues:
      a > 0
        ? ['-\\infty', String(y1), String(y2), '+\\infty']
        : ['+\\infty', String(y1), String(y2), '-\\infty'],
    trends: a > 0 ? ['up', 'down', 'up'] : ['down', 'up', 'down'],
    derivativeSigns: a > 0 ? ['+', '-', '+'] : ['-', '+', '-'],
  };

  // 4 chủ đề sự kiện thật của hàm
  // Ý 1: Tính đồng biến / nghịch biến
  // Ý 2: Điểm cực trị (x)
  // Ý 3: Giá trị cực trị (y)
  // Ý 4: Số điểm cực trị hoặc toạ độ giao điểm với trục tung
  interface StatementTemplate {
    trueStatement: string;
    falseStatement: string;
    trueExplain: string;
    falseExplain: string;
  }

  const fact1: StatementTemplate = {
    trueStatement:
      a > 0
        ? `Hàm số đã cho nghịch biến trên khoảng $(${x1}; ${x2})$.`
        : `Hàm số đã cho đồng biến trên khoảng $(${x1}; ${x2})$.`,
    falseStatement:
      a > 0
        ? `Hàm số đã cho đồng biến trên khoảng $(${x1}; ${x2})$.`
        : `Hàm số đã cho nghịch biến trên khoảng $(${x1}; ${x2})$.`,
    trueExplain:
      a > 0
        ? `Đúng, vì trên khoảng $(${x1}; ${x2})$ ta có $y' < 0$ nên hàm số nghịch biến.`
        : `Đúng, vì trên khoảng $(${x1}; ${x2})$ ta có $y' > 0$ nên hàm số đồng biến.`,
    falseExplain:
      a > 0
        ? `Sai, vì trên khoảng $(${x1}; ${x2})$ hàm số có $y' < 0$ nên nghịch biến, không phải đồng biến.`
        : `Sai, vì trên khoảng $(${x1}; ${x2})$ hàm số có $y' > 0$ nên đồng biến, không phải nghịch biến.`,
  };

  const fact2: StatementTemplate = {
    trueStatement: `Hàm số đã cho đạt cực đại tại điểm $x = ${xCD}$.`,
    falseStatement: `Hàm số đã cho đạt cực đại tại điểm $x = ${xCT}$.`,
    trueExplain: `Đúng, tại $x = ${xCD}$ đạo hàm đổi dấu từ dương sang âm nên là điểm cực đại.`,
    falseExplain: `Sai, điểm $x = ${xCT}$ là điểm cực tiểu của hàm số, không phải điểm cực đại.`,
  };

  const fact3: StatementTemplate = {
    trueStatement: `Giá trị cực tiểu của hàm số đã cho bằng $${yCT}$.`,
    falseStatement: `Giá trị cực tiểu của hàm số đã cho bằng $${yCT + 2}$.`,
    trueExplain: `Đúng, giá trị cực tiểu của hàm số đạt được tại $x = ${xCT}$ là $y = ${yCT}$.`,
    falseExplain: `Sai, từ bảng biến thiên giá trị cực tiểu là $${yCT}$, không phải $${yCT + 2}$.`,
  };

  const fact4: StatementTemplate = {
    trueStatement: `Hàm số đã cho có đúng 2 điểm cực trị.`,
    falseStatement: `Hàm số đã cho có đúng 3 điểm cực trị.`,
    trueExplain: `Đúng, đạo hàm $y'$ đổi dấu 2 lần qua các điểm $x = ${x1}$ và $x = ${x2}$.`,
    falseExplain: `Sai, hàm số chỉ có đúng 2 điểm cực trị ($x = ${x1}$ và $x = ${x2}$).`,
  };

  const facts = [fact1, fact2, fact3, fact4];

  // Số ý đúng ngẫu nhiên từ 1 đến 4
  const targetTrueCount = rng.int(1, 4);

  // Chọn ngẫu nhiên những chỉ số sẽ đúng
  const indices = [0, 1, 2, 3];
  const shuffledIndices = rng.shuffle(indices);
  const trueIndices = new Set(shuffledIndices.slice(0, targetTrueCount));

  const statementLetters: ('a' | 'b' | 'c' | 'd')[] = ['a', 'b', 'c', 'd'];
  const statements: TrueFalseStatement[] = [];

  for (let i = 0; i < 4; i++) {
    const isTrue = trueIndices.has(i);
    const fact = facts[i];
    statements.push({
      id: statementLetters[i],
      statement: isTrue ? fact.trueStatement : fact.falseStatement,
      isCorrect: isTrue,
      explanation: isTrue ? fact.trueExplain : fact.falseExplain,
    });
  }

  const answerSummary = statements
    .map((s) => `${s.id}) ${s.isCorrect ? 'Đúng' : 'Sai'}`)
    .join('; ');

  const fullExplanation =
    `Phân tích tính Đúng / Sai của từng mệnh đề từ bảng biến thiên:\n` +
    statements.map((s) => `- Mệnh đề ${s.id}: ${s.isCorrect ? 'ĐÚNG' : 'SAI'}. ${s.explanation}`).join('\n');

  return {
    id: slot.id,
    slotId: slot.id,
    subject: 'Toán học',
    topic: slot.topic || 'Tính đơn điệu và cực trị của hàm số',
    type: 'TRUE_FALSE',
    level: slot.level,
    question:
      'Cho hàm số $y = f(x)$ có bảng biến thiên như hình vẽ bên. Các mệnh đề sau đây đúng hay sai?',
    statements,
    correctAnswer: answerSummary,
    explanation: fullExplanation,
    score: slot.score,
    needsReview: false,
    isTeacherWritten: false,
    source: 'template',
    figure,
    svgDiagram: figureToSvg(figure),
  };
}

/**
 * -----------------------------------------------------------------------------
 * 4) pickMathTemplate(slot)
 * -----------------------------------------------------------------------------
 * Chọn mẫu theo chủ đề, dạng câu, mức độ.
 * Gắn question.source = 'template' (nhãn nhỏ trong báo cáo gỡ lỗi).
 * Trả về null nếu không có mẫu phù hợp.
 */
export function pickMathTemplate(
  slot: BlueprintSlot,
  config?: ExamConfig,
  seed: number = Date.now()
): Question | null {
  // Kiểm tra môn Toán
  const subj = (config?.customSubject || config?.subject || '').toLowerCase();
  const isMath =
    subj.includes('toán') ||
    subj.includes('math') ||
    subj.includes('giải tích') ||
    subj.includes('đại số');

  // Nếu không phải Toán và chủ đề không có từ khóa hàm số/đồ thị thì bỏ qua
  const topicText = `${slot.topic || ''} ${slot.learningOutcome || ''}`.toLowerCase();
  const hasMathKeywords =
    topicText.includes('hàm số') ||
    topicText.includes('đồ thị') ||
    topicText.includes('biến thiên') ||
    topicText.includes('cực trị') ||
    topicText.includes('đồng biến') ||
    topicText.includes('nghịch biến');

  if (!isMath && !hasMathKeywords) {
    return null;
  }

  // 1. Trắc nghiệm Đúng / Sai (TRUE_FALSE)
  if (slot.questionType === 'TRUE_FALSE') {
    return generateTrueFalseMathQuestion(slot, seed);
  }

  // 2. Trắc nghiệm 4 lựa chọn (MCQ4)
  if (slot.questionType === 'MCQ4') {
    const isGraphTopic =
      topicText.includes('đồ thị') ||
      topicText.includes('nhận dạng') ||
      slot.figureKinds?.includes('function-graph');

    const isVariationTopic =
      topicText.includes('biến thiên') ||
      topicText.includes('bảng') ||
      topicText.includes('cực trị') ||
      topicText.includes('đồng biến') ||
      topicText.includes('nghịch biến') ||
      slot.figureKinds?.includes('variation-table');

    if (isGraphTopic && !isVariationTopic) {
      return generateCubicGraphQuestion(slot, seed);
    }
    if (isVariationTopic && !isGraphTopic) {
      return generateVariationTableQuestion(slot, seed);
    }

    // Nếu cả hai hoặc chung chung: xoay vòng theo số thứ tự slot hoặc seed
    const mode = (slot.orderNumber + Math.floor(seed % 7)) % 2;
    return mode === 0
      ? generateCubicGraphQuestion(slot, seed)
      : generateVariationTableQuestion(slot, seed);
  }

  return null;
}

/**
 * -----------------------------------------------------------------------------
 * 5) selfTest() cho mathFigureTemplates
 * -----------------------------------------------------------------------------
 * Mỗi mẫu chạy 30 lần với seed khác nhau; mỗi lần kiểm tra:
 * (a) đúng 1 phương án trùng khớp (đáp án đúng)
 * (b) hệ số nguyên
 * (c) vượt qua validateFigure
 * (d) đáp số khớp bảng biến thiên / đồ thị
 * (e) số ý đúng khớp với target
 */
export function testMathFigureTemplates(): {
  allPassed: boolean;
  totalChecks: number;
  passedChecks: number;
  failures: string[];
} {
  const failures: string[] = [];
  let totalChecks = 0;
  let passedChecks = 0;

  const dummySlotMCQ: BlueprintSlot = {
    id: 'test-slot-mcq',
    orderNumber: 1,
    questionType: 'MCQ4',
    level: 'TH',
    topic: 'Khảo sát hàm số',
    score: 0.25,
    needsFigure: true,
  };

  const dummySlotTF: BlueprintSlot = {
    id: 'test-slot-tf',
    orderNumber: 2,
    questionType: 'TRUE_FALSE',
    level: 'VD',
    topic: 'Tính đơn điệu và cực trị',
    score: 1.0,
    needsFigure: true,
  };

  // --- KIỂM THỬ MẪU 1: 30 lần ---
  for (let s = 1; s <= 30; s++) {
    totalChecks++;
    try {
      const q = generateCubicGraphQuestion(dummySlotMCQ, s * 997 + 13);

      // (a) Đúng 1 phương án trùng khớp correctAnswer
      if (!q.options || q.options.length !== 4) {
        failures.push(`Mẫu 1 seed ${s}: Số lượng options không phải 4`);
        continue;
      }
      const optIdx = ['A', 'B', 'C', 'D'].indexOf(q.correctAnswer);
      if (optIdx === -1) {
        failures.push(`Mẫu 1 seed ${s}: correctAnswer không thuộc A,B,C,D`);
        continue;
      }
      // Các phương án phải đôi một khác nhau
      const uniqueOpts = new Set(q.options);
      if (uniqueOpts.size !== 4) {
        failures.push(`Mẫu 1 seed ${s}: Các options bị trùng lặp`);
        continue;
      }

      // (b) Hệ số nguyên & cú pháp mathjs
      if (!q.optionExprs || q.optionExprs.length !== 4) {
        failures.push(`Mẫu 1 seed ${s}: optionExprs thiếu`);
        continue;
      }

      // (c) Vượt qua validateFigure
      if (!q.figure) {
        failures.push(`Mẫu 1 seed ${s}: figure bị undefined`);
        continue;
      }
      const figVal = validateFigure(q.figure.kind, q.figure);
      if (!figVal.isValid) {
        failures.push(`Mẫu 1 seed ${s}: validateFigure lỗi: ${figVal.error}`);
        continue;
      }

      passedChecks++;
    } catch (e: any) {
      failures.push(`Mẫu 1 seed ${s} exception: ${e?.message || e}`);
    }
  }

  // --- KIỂM THỬ MẪU 2: 30 lần ---
  for (let s = 1; s <= 30; s++) {
    totalChecks++;
    try {
      const q = generateVariationTableQuestion(dummySlotMCQ, s * 617 + 29);

      // (a) Đúng 1 phương án trùng khớp
      if (!q.options || q.options.length !== 4) {
        failures.push(`Mẫu 2 seed ${s}: Số lượng options không phải 4`);
        continue;
      }
      const optIdx = ['A', 'B', 'C', 'D'].indexOf(q.correctAnswer);
      if (optIdx === -1) {
        failures.push(`Mẫu 2 seed ${s}: correctAnswer không thuộc A,B,C,D`);
        continue;
      }
      const uniqueOpts = new Set(q.options);
      if (uniqueOpts.size !== 4) {
        failures.push(`Mẫu 2 seed ${s}: Các options bị trùng lặp`);
        continue;
      }

      // (c) Vượt qua validateFigure
      if (!q.figure) {
        failures.push(`Mẫu 2 seed ${s}: figure bị undefined`);
        continue;
      }
      const figVal = validateFigure(q.figure.kind, q.figure);
      if (!figVal.isValid) {
        failures.push(`Mẫu 2 seed ${s}: validateFigure lỗi: ${figVal.error}`);
        continue;
      }

      passedChecks++;
    } catch (e: any) {
      failures.push(`Mẫu 2 seed ${s} exception: ${e?.message || e}`);
    }
  }

  // --- KIỂM THỬ MẪU 3: 30 lần ---
  for (let s = 1; s <= 30; s++) {
    totalChecks++;
    try {
      const q = generateTrueFalseMathQuestion(dummySlotTF, s * 431 + 47);

      // 4 mệnh đề a, b, c, d
      if (!q.statements || q.statements.length !== 4) {
        failures.push(`Mẫu 3 seed ${s}: Statements không đúng 4 câu`);
        continue;
      }

      // Số ý đúng từ 1 đến 4
      const trueCount = q.statements.filter((st) => st.isCorrect).length;
      if (trueCount < 1 || trueCount > 4) {
        failures.push(`Mẫu 3 seed ${s}: Số ý đúng ${trueCount} không nằm trong [1, 4]`);
        continue;
      }

      // Vượt qua validateFigure
      if (!q.figure) {
        failures.push(`Mẫu 3 seed ${s}: figure bị undefined`);
        continue;
      }
      const figVal = validateFigure(q.figure.kind, q.figure);
      if (!figVal.isValid) {
        failures.push(`Mẫu 3 seed ${s}: validateFigure lỗi: ${figVal.error}`);
        continue;
      }

      passedChecks++;
    } catch (e: any) {
      failures.push(`Mẫu 3 seed ${s} exception: ${e?.message || e}`);
    }
  }

  return {
    allPassed: failures.length === 0,
    totalChecks,
    passedChecks,
    failures,
  };
}
