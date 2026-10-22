import katex from 'katex';
import { mml2omml } from 'mathml2omml';
import { Exam, ExamConfig, Question } from '../../types';
import { ResolvedVersionData } from './types';

/**
 * Loại bỏ dấu tiếng Việt và chuyển sang tên file chuẩn không dấu
 * Ví dụ: De_Toan_Lop10_GiuaKy_Ma101.docx
 */
export function removeVietnameseTones(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

export function generateExportFileName(
  exam: Exam,
  config: ExamConfig,
  versionCode: string = 'ALL',
  extension: string = 'docx'
): string {
  const subjectName = config.customSubject?.trim() || config.subject || 'MonHoc';
  const gradeStr = config.grade ? `Lop${config.grade}` : '';
  
  // Rút gọn loại đề
  let typeStr = 'KiemTra';
  if (config.examType === '15_MIN') typeStr = '15Phut';
  else if (config.examType === 'MID_TERM') typeStr = 'GiuaKy';
  else if (config.examType === 'FINAL_TERM') typeStr = 'CuoiKy';
  else if (config.examType === 'THUONG_XUYEN') typeStr = 'ThuongXuyen';
  else if (config.examType === 'REVIEW') typeStr = 'OnTap';

  const versionStr = versionCode === 'ALL' ? 'TatCaMaDe' : `Ma${versionCode}`;

  const rawName = `De_${subjectName}_${gradeStr}_${typeStr}_${versionStr}`;
  const cleanName = removeVietnameseTones(rawName)
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');

  return extension ? `${cleanName}.${extension}` : cleanName;
}

/**
 * Lấy danh sách các phiên bản đề thi cần xuất (từng mã hoặc tất cả)
 */
export function resolveTargetVersions(exam: Exam, selectedVersionCode: string): ResolvedVersionData[] {
  if (!exam.versions || exam.versions.length === 0) {
    return [{ code: '101', questions: exam.questions }];
  }

  if (selectedVersionCode !== 'ALL') {
    const target = exam.versions.find((v) => v.code === selectedVersionCode);
    if (target) {
      return [{ code: target.code, questions: target.questions }];
    }
  }

  return exam.versions.map((v) => ({
    code: v.code,
    questions: v.questions,
  }));
}

/**
 * Phân tích chuỗi văn bản thành các đoạn text thường và công thức toán học KaTeX
 */
export interface MathToken {
  type: 'text' | 'formula';
  content: string;
  displayMode: boolean;
}

export function parseMathTokens(text: string): MathToken[] {
  if (!text) return [];

  const tokens: MathToken[] = [];
  // Regex khớp công thức $$...$$ (khối) hoặc $...$ (nội dòng)
  const regex = /(\$\$[\s\S]*?\$\$|\$[^\$\n]+?\$)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({
        type: 'text',
        content: text.slice(lastIndex, match.index),
        displayMode: false,
      });
    }

    const rawMatch = match[0];
    const isDisplay = rawMatch.startsWith('$$');
    const formula = isDisplay ? rawMatch.slice(2, -2).trim() : rawMatch.slice(1, -1).trim();

    tokens.push({
      type: 'formula',
      content: formula,
      displayMode: isDisplay,
    });

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push({
      type: 'text',
      content: text.slice(lastIndex),
      displayMode: false,
    });
  }

  return tokens;
}

// Bộ nhớ đệm (Cache) giúp tăng tốc độ xuất file Word lên gấp 10-20 lần
const ommlCache = new Map<string, { omml: string; error?: string }>();

/**
 * Chuyển công thức LaTeX sang OMML cho Microsoft Word bằng KaTeX và mathml2omml
 */
export function convertLatexToOmml(
  latex: string,
  displayMode: boolean = false
): { omml: string; error?: string } {
  const cacheKey = `${displayMode ? 'D:' : 'I:'}${latex.trim()}`;
  const cached = ommlCache.get(cacheKey);
  if (cached) return cached;

  try {
    const mathmlHtml = katex.renderToString(latex, {
      output: 'mathml',
      throwOnError: false,
      strict: 'ignore',
      displayMode,
    });

    // Lọc phần tử <math> và bỏ thẻ <annotation> để mathml2omml parse sạch
    const mathMatch = mathmlHtml.match(/<math[\s\S]*?<\/math>/);
    if (!mathMatch) {
      return { omml: '', error: 'Không thể trích xuất MathML từ KaTeX' };
    }

    const cleanMathml = mathMatch[0].replace(/<annotation[\s\S]*?<\/annotation>/g, '');
    const omml = mml2omml(cleanMathml);

    if (!omml || omml.trim().length === 0) {
      const res = { omml: '', error: 'Kết quả chuyển đổi OMML rỗng' };
      ommlCache.set(cacheKey, res);
      return res;
    }

    const res = { omml };
    ommlCache.set(cacheKey, res);
    return res;
  } catch (err: any) {
    const res = { omml: '', error: err?.message || 'Lỗi chuyển đổi công thức sang OMML' };
    ommlCache.set(cacheKey, res);
    return res;
  }
}

/**
 * Chuyển đổi ký hiệu LaTeX phổ biến sang Unicode để vẽ canvas an toàn, không bị tainted
 */
export function latexToUnicode(latex: string): string {
  if (!latex) return '';
  return latex
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)')
    .replace(/\\sqrt\[(\d+)\]\{([^}]+)\}/g, '√[$1]($2)')
    .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
    .replace(/\\vec\{([^}]+)\}/g, '$1→')
    .replace(/\\lim_\{([^}]+)\}/g, 'lim($1)')
    .replace(/\\int_\{([^}]+)\}\^\{([^}]+)\}/g, '∫[$1→$2]')
    .replace(/\\int/g, '∫')
    .replace(/\\sum/g, '∑')
    .replace(/\\prod/g, '∏')
    .replace(/\\infty/g, '∞')
    .replace(/\\pm/g, '±')
    .replace(/\\mp/g, '∓')
    .replace(/\\times/g, '×')
    .replace(/\\div/g, '÷')
    .replace(/\\cdot/g, '·')
    .replace(/\\leq/g, '≤')
    .replace(/\\geq/g, '≥')
    .replace(/\\neq/g, '≠')
    .replace(/\\approx/g, '≈')
    .replace(/\\equiv/g, '≡')
    .replace(/\\in/g, '∈')
    .replace(/\\notin/g, '∉')
    .replace(/\\subset/g, '⊂')
    .replace(/\\subseteq/g, '⊆')
    .replace(/\\cap/g, '∩')
    .replace(/\\cup/g, '∪')
    .replace(/\\emptyset/g, '∅')
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\gamma/g, 'γ')
    .replace(/\\delta/g, 'δ')
    .replace(/\\pi/g, 'π')
    .replace(/\\theta/g, 'θ')
    .replace(/\\lambda/g, 'λ')
    .replace(/\\mu/g, 'μ')
    .replace(/\\sigma/g, 'σ')
    .replace(/\\omega/g, 'ω')
    .replace(/\\Delta/g, 'Δ')
    .replace(/\\Omega/g, 'Ω')
    .replace(/\\to|\\rightarrow/g, '→')
    .replace(/\\Rightarrow/g, '⇒')
    .replace(/\\Leftrightarrow/g, '⇔')
    .replace(/\\mathbb\{R\}/g, 'ℝ')
    .replace(/\\mathbb\{N\}/g, 'ℕ')
    .replace(/\\mathbb\{Z\}/g, 'ℤ')
    .replace(/\\mathbb\{Q\}/g, 'ℚ')
    .replace(/\\mathbb\{C\}/g, 'ℂ')
    .replace(/\\{/g, '{')
    .replace(/\\}/g, '}')
    .replace(/\\,/g, ' ')
    .replace(/\\;/g, ' ')
    .replace(/\\!/g, '')
    .replace(/\\left|\\right/g, '')
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .replace(/\\mathbf\{([^}]+)\}/g, '$1')
    .replace(/\\mathit\{([^}]+)\}/g, '$1')
    .replace(/\\mathrm\{([^}]+)\}/g, '$1')
    .replace(/\^\{?(\d+)\}?/g, (_m, d) => {
      const supMap: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻', 'n': 'ⁿ', 'x': 'ˣ' };
      return d.split('').map((c: string) => supMap[c] || c).join('');
    })
    .replace(/_\{?(\d+)\}?/g, (_m, d) => {
      const subMap: Record<string, string> = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };
      return d.split('').map((c: string) => subMap[c] || c).join('');
    })
    .replace(/\\([a-zA-Z]+)/g, '$1')
    .trim();
}

const pngBlobCache = new Map<string, { blob: Blob; width: number; height: number } | null>();

/**
 * Chuyển công thức LaTeX sang ảnh PNG qua canvas trực tiếp, đảm bảo 100% không bị SecurityError / Tainted canvas
 */
export async function convertLatexToPngBlob(
  latex: string,
  displayMode: boolean = false
): Promise<{ blob: Blob; width: number; height: number } | null> {
  if (typeof document === 'undefined') return null;

  const cacheKey = `${displayMode ? 'D:' : 'I:'}${latex.trim()}`;
  if (pngBlobCache.has(cacheKey)) {
    return pngBlobCache.get(cacheKey)!;
  }

  try {
    const text = latexToUnicode(latex);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const fontSize = displayMode ? 18 : 15;
    ctx.font = `italic ${fontSize}px "Times New Roman", Cambria, serif`;
    const textMetrics = ctx.measureText(text || '$' + latex + '$');
    const textWidth = Math.ceil(textMetrics.width);
    const width = Math.max(textWidth + 10, 24);
    const height = Math.max(fontSize + 10, 22);

    const scale = 2; // Hiển thị sắc nét (Retina 2x)
    canvas.width = width * scale;
    canvas.height = height * scale;

    const scaledCtx = canvas.getContext('2d');
    if (!scaledCtx) return null;

    scaledCtx.scale(scale, scale);
    scaledCtx.font = `italic ${fontSize}px "Times New Roman", Cambria, serif`;
    scaledCtx.fillStyle = '#000000';
    scaledCtx.textBaseline = 'middle';
    scaledCtx.fillText(text || '$' + latex + '$', 4, height / 2);

    return new Promise((resolve) => {
      try {
        canvas.toBlob((blob) => {
          if (blob) {
            const res = { blob, width, height };
            pngBlobCache.set(cacheKey, res);
            resolve(res);
          } else {
            pngBlobCache.set(cacheKey, null);
            resolve(null);
          }
        }, 'image/png');
      } catch {
        pngBlobCache.set(cacheKey, null);
        resolve(null);
      }
    });
  } catch {
    pngBlobCache.set(cacheKey, null);
    return null;
  }
}
