/**
 * Dịch vụ tích hợp Gemini AI cho RA ĐỀ KIỂM TRA AI – 3 CẤP
 * Toàn bộ các tương tác với Gemini AI được tập trung duy nhất tại file này.
 */

import { GoogleGenAI } from '@google/genai';
import { DEFAULT_GEMINI_MODEL } from '../config';
import {
  BlueprintSlot,
  ExamConfig,
  Level,
  MatrixCell,
  MatrixTopic,
  ParsedMatrix,
  Question,
  QuestionFigure,
  QuestionType,
  SchoolLevel,
} from '../types';
import { robustJsonParse } from '../lib/jsonParser';
import { isValidSvg, sanitizeSvg, generateFallbackSvgDiagram } from '../lib/diagrams';
import { figureToSvg, renderFigureToSvg } from '../lib/figureRenderer';
import { questionNeedsFigure, validateFigure, detectRequiredFigureKind } from '../lib/validate';
import { compile } from 'mathjs';
import { pickMathTemplate } from '../lib/mathFigureTemplates';

/**
 * Tên model chính và model dự phòng
 */
export const CURRENT_MODEL_NAME = DEFAULT_GEMINI_MODEL;
export const FALLBACK_MODEL_NAME = 'gemini-3.1-flash-lite';

/**
 * Khởi tạo client Gemini trực tiếp (dùng khi chạy trực tiếp hoặc môi trường dev)
 */
let directAiClient: GoogleGenAI | null = null;
function getDirectClient(): GoogleGenAI {
  if (!directAiClient) {
    const apiKey =
      (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) ||
      (typeof window !== 'undefined' && (window as any).__GEMINI_API_KEY__) ||
      '';
    directAiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return directAiClient;
}

/**
 * Chuyển đổi mã lỗi và thông điệp lỗi API thành thông báo tiếng Việt thân thiện, rõ ràng
 * Xử lý: hết hạn mức (429), quá tải (503), mất mạng / offline, JSON hỏng, phản hồi rỗng
 */
export function formatAiErrorMessage(err: any): string {
  if (!err) return 'Lỗi không xác định khi gọi AI. Vui lòng bấm Thử lại.';
  if (err?.name === 'AbortError' || err?.message?.includes('hủy') || err?.message?.includes('aborted')) {
    return 'Quá trình tạo đề đã được dừng lại theo yêu cầu của bạn.';
  }

  const msg = String(err?.message || err || '').toLowerCase();
  const status = err?.status || err?.code || 0;

  if (status === 429 || msg.includes('429') || msg.includes('quota') || msg.includes('resource_exhausted')) {
    return 'Hạn mức API Gemini hiện tại đã vượt giới hạn tạm thời (Quota Exceeded). Vui lòng đợi trong giây lát rồi bấm Thử lại.';
  }

  if (
    status === 503 ||
    msg.includes('503') ||
    msg.includes('overloaded') ||
    msg.includes('unavailable') ||
    msg.includes('high demand') ||
    msg.includes('spikes in demand') ||
    msg.includes('high load')
  ) {
    return 'Hệ thống AI Gemini đang quá tải tạm thời. Vui lòng bấm Thử lại để hệ thống chuyển sang máy chủ dự phòng.';
  }

  if (
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('econnrefused') ||
    msg.includes('offline') ||
    msg.includes('mất kết nối')
  ) {
    return 'Mất kết nối mạng hoặc không thể kết nối tới máy chủ AI. Vui lòng kiểm tra lại đường truyền internet và bấm Thử lại.';
  }

  if (msg.includes('json') || msg.includes('parse') || msg.includes('syntax') || msg.includes('bị rỗng')) {
    return 'Dữ liệu phản hồi từ AI không đúng định dạng JSON hoặc bị rỗng. Vui lòng bấm Thử lại để hệ thống tự tái cấu trúc.';
  }

  return `Lỗi kết nối AI: ${err?.message || 'Không có phản hồi từ máy chủ'}. Vui lòng bấm Thử lại.`;
}

/**
 * Định dạng Part theo chuẩn @google/genai
 */
export interface GenAIPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

/**
 * Chuyển đổi toàn bộ tài liệu tham chiếu (File đã tải + Đoạn dán) thành mảng GenAIPart
 * để chuẩn bị gửi sang Gemini AI:
 * - inlineData cho PDF và Ảnh (giữ nguyên mimeType và base64)
 * - text cho DOCX, TXT và các đoạn văn bản dán (kèm nhãn tên file và loại tài liệu)
 */
export function buildReferenceParts(config: ExamConfig): GenAIPart[] {
  const parts: GenAIPart[] = [];

  // 1. Chỉ dẫn về nguồn kiến thức
  let sourceDirective = '';
  if (config.knowledgeSource === 'UPLOAD_ONLY') {
    sourceDirective =
      'NGUYÊN TẮC BẮT BUỘC: Chỉ sử dụng các tài liệu và văn bản đính kèm dưới đây để tạo câu hỏi và đáp án. Tuyệt đối không tự suy diễn hoặc đưa vào dữ kiện nằm ngoài tài liệu.';
  } else if (config.knowledgeSource === 'UPLOAD_PLUS_CURRICULUM') {
    sourceDirective =
      'NGUYÊN TẮC: Ưu tiên tuyệt đối nội dung tài liệu tải lên để ra đề; có thể kết hợp với kiến thức chuẩn trong chương trình phổ thông khi cần mở rộng câu hỏi.';
  } else {
    sourceDirective =
      'NGUYÊN TẮC: Sử dụng nội dung kiến thức và yêu cầu cần đạt do giáo viên cung cấp ở thiết lập đề.';
  }

  parts.push({
    text: `=== CHỈ DẪN NGUỒN TÀI LIỆU (Chế độ: ${config.knowledgeSource}) ===\n${sourceDirective}\n`,
  });

  // 2. Chuyển đổi các file đã tải lên (PDF, Ảnh, DOCX, TXT)
  if (config.referenceDocs && config.referenceDocs.length > 0) {
    for (const doc of config.referenceDocs) {
      if ((doc.kind === 'PDF' || doc.kind === 'IMAGE') && doc.base64) {
        parts.push({
          text: `\n[Tài liệu đính kèm: ${doc.name} - Định dạng: ${doc.kind} - Kích thước: ${(doc.sizeBytes / 1024).toFixed(1)} KB]:`,
        });
        parts.push({
          inlineData: {
            mimeType: doc.mimeType,
            data: doc.base64,
          },
        });
      } else if ((doc.kind === 'DOCX' || doc.kind === 'TXT') && doc.text) {
        parts.push({
          text: `\n[Tài liệu văn bản: ${doc.name} (${doc.kind})]:\n${doc.text}\n`,
        });
      }
    }
  }

  // 3. Chuyển đổi các đoạn văn bản dán (SGK, Giáo án, Ma trận cũ, Ngữ liệu, Khác)
  if (config.referenceSnippets && config.referenceSnippets.length > 0) {
    const SNIPPET_LABELS: Record<string, string> = {
      SGK: 'Sách giáo khoa',
      GIAO_AN: 'Giáo án / Kế hoạch bài dạy',
      MA_TRAN_CU: 'Ma trận / Đề cũ tham khảo',
      NGU_LIEU: 'Ngữ liệu đọc hiểu / Văn bản nguồn',
      OTHER: 'Tài liệu tham khảo khác',
    };

    for (let i = 0; i < config.referenceSnippets.length; i++) {
      const snip = config.referenceSnippets[i];
      const typeLabel = SNIPPET_LABELS[snip.type] || snip.type;
      parts.push({
        text: `\n[Đoạn trích ${i + 1} - Phân loại: ${typeLabel}${snip.title ? ` - Tiêu đề: ${snip.title}` : ''}]:\n${snip.content}\n`,
      });
    }
  }

  // 4. Nội dung bài học dán ở Bước 4 (nếu có)
  if (config.rawLessonContent && config.rawLessonContent.trim().length > 0) {
    parts.push({
      text: `\n[Nội dung bài học dán trực tiếp]:\n${config.rawLessonContent.trim()}\n`,
    });
  }

  return parts;
}

/**
 * Xây dựng systemInstruction chi tiết theo từng cấp học (Tiểu học / THCS / THPT)
 */
export function buildSystemInstruction(config: ExamConfig): string {
  const level: SchoolLevel = config.schoolLevel || 'THCS';

  let pedagogyInstruction = '';
  if (level === 'TIEU_HOC') {
    pedagogyInstruction = `
1. NGUYÊN TẮC SƯ PHẠM CẤP TIỂU HỌC (Lớp 1 - 5):
- Ngôn ngữ trong sáng, thân thiện, gần gũi với lứa tuổi thiếu nhi, câu từ ngắn gọn, rõ ràng.
- TUYỆT ĐỐI KHÔNG dùng từ ngữ Hán - Việt khó hiểu, phức tạp hoặc văn phong hàn lâm.
- Câu hỏi cần phù hợp tâm lý lứa tuổi tiểu học, tạo hứng thú học tập, gắn liền với đồ vật, con vật, hiện tượng đời sống quen thuộc.
- Đối với câu trắc nghiệm: các phương án lựa chọn cần rõ ràng, dễ phân biệt, không đánh đố tinh vi.`;
  } else if (level === 'THCS') {
    pedagogyInstruction = `
1. NGUYÊN TẮC SƯ PHẠM CẤP THCS (Lớp 6 - 9):
- Diễn đạt chính xác, chuẩn mực khoa học, bám sát Chương trình GDPT 2018.
- Các câu hỏi mức độ Vận dụng (VD) và Vận dụng cao (VDC) cần gắn với tình huống thực tiễn đời sống, thí nghiệm khoa học, đời sống thường ngày.
- Đảm bảo độ khó phân hóa rõ rệt theo 4 mức độ nhận thức (Nhận biết, Thông hiểu, Vận dụng, Vận dụng cao).`;
  } else {
    pedagogyInstruction = `
1. NGUYÊN TẮC SƯ PHẠM CẤP THPT (Lớp 10 - 12):
- Ngôn ngữ học thuật, tính chính xác khoa học cao, tư duy phản biện, lập luận logic chặt chẽ.
- Bám sát định dạng đề thi tốt nghiệp THPT từ năm 2025 của Bộ Giáo dục và Đào tạo:
  + Dạng Đúng/Sai (TRUE_FALSE dạng CLUSTER4): Cần có một ngữ cảnh/dữ liệu chung và 4 nhận định/mệnh đề độc lập a), b), c), d) có tính đúng/sai rành mạch.
  + Dạng Vận dụng cao (VDC): Có tính liên môn, ứng dụng thực nghiệm, mô hình hóa toán học/khoa học hoặc giải quyết vấn đề mới mẻ trong đời sống, kinh tế, xã hội.`;
  }

  return `Bạn là chuyên gia khảo thí và biên soạn đề kiểm tra giáo dục hàng đầu tại Việt Nam theo Chương trình GDPT 2018.

NHIỆM VỤ:
Biên soạn các câu hỏi kiểm tra đánh giá tương ứng chính xác theo danh sách các ô chỉ mục (BlueprintSlot) được cung cấp.

${pedagogyInstruction}

2. QUY CHUẨN CÔNG THỨC TOÁN HỌC & KHOA HỌC:
- BẮT BUỘC viết tất cả công thức toán, lý, hóa, biểu thức số, số mũ, phân số, căn thức bằng cú pháp LaTeX chuẩn, đặt trong cặp dấu $...$ (nội dòng) hoặc $$...$$ (dòng riêng).
- Ví dụ: viết $\\frac{a}{b}$, $\\sqrt{x^2 + 1}$, $x_1 + x_2$, $\\Delta = b^2 - 4ac$, $H_2SO_4$, $v = \\frac{s}{t}$.
- TUYỆT ĐỐI KHÔNG dùng ký tự Unicode cho căn (√), số mũ (², ³), phân số (½).

3. ĐỊNH DẠNG CÁC LOẠI CÂU HỎI:
- MCQ4 (Trắc nghiệm 4 lựa chọn):
  + 'options': Mảng 4 phần tử theo định dạng ["A. Nội dung", "B. Nội dung", "C. Nội dung", "D. Nội dung"].
  + 'correctAnswer': Chỉ ghi chữ cái "A", "B", "C" hoặc "D".
- MCQ_MULTI (Nhiều đáp án đúng):
  + 'options': Mảng các phương án lựa chọn.
  + 'correctAnswer': Ghi rõ các phương án đúng, ví dụ "A, C".
- TRUE_FALSE (Đúng / Sai):
  + Với format CLUSTER4: Phần 'question' là câu dẫn chung. Mảng 'statements' gồm 4 ý với id: "a", "b", "c", "d", mỗi ý có 'statement', 'isCorrect' (true/false) và 'explanation'.
  + 'correctAnswer': Tóm tắt, ví dụ "a: Đúng, b: Sai, c: Đúng, d: Sai".
- MATCHING (Ghép nối):
  + 'pairs': Mảng các cặp ghép { id, left, right }.
  + 'correctAnswer': Tóm tắt cách ghép.
- FILL_BLANK (Điền từ/khuyết):
  + Dùng [1], [2] trong 'question'.
  + 'correctAnswer': Từ hoặc cụm từ cần điền vào các vị trí.
- SHORT_ANSWER (Trả lời ngắn):
  + 'correctAnswer': Đáp số hoặc từ khóa súc tích.
- ESSAY (Tự luận):
  + 'question': Đề bài tự luận chi tiết.
  + 'scoringGuide': Hướng dẫn chấm điểm từng bước và tiêu chí đạt điểm.

4. QUY ĐỊNH BẮT BUỘC VỀ HÌNH VẼ, ĐỒ THỊ, BẢNG XÉT DẤU & BIẾN THIÊN:
- Sử dụng đối tượng 'figure' trực tiếp (hỗ trợ cả cặp 'figureKind' và 'figureJson' dự phòng). Ưu tiên trả về đối tượng 'figure' trực tiếp.
- BẠN KHÔNG VẼ HÌNH, CHỈ ĐƯA DỮ LIỆU. Mọi dữ kiện trong đề, đáp án và lời giải phải suy ra được từ chính dữ liệu hình.
- CẤM viết bảng xét dấu hoặc bảng biến thiên bằng chữ thường trong câu dẫn 'question'. Bắt buộc dùng đối tượng 'figure'.
- Nếu slot có needsFigure=true, hoặc câu dẫn chứa một trong các cụm: "hình vẽ", "hình bên", "hình dưới", "như hình", "bảng biến thiên", "bảng xét dấu", "đồ thị như", "đường cong trong hình", "biểu đồ sau" thì BẮT BUỘC phải có đối tượng 'figure' hợp lệ thuộc một trong 5 loại:
  a) Đồ thị hàm số (function-graph):
     "figure": {
       "kind": "function-graph",
       "functions": [{"expr": "x^3 - 3*x", "label": "y = f(x)"}],
       "xRange": [-3, 3],
       "yRange": [-4, 4],
       "points": [{"x": -1, "y": 2, "label": "A", "isExtremum": true}, {"x": 1, "y": -2, "label": "B", "isExtremum": true}],
       "studentVisibleLabels": ["A", "B"]
     }
  b) Bảng biến thiên (variation-table):
     "figure": {
       "kind": "variation-table",
       "xValues": ["-\\infty", "-1", "1", "+\\infty"],
       "yValues": ["-\\infty", "2", "-2", "+\\infty"],
       "trends": ["up", "down", "up"],
       "derivativeSigns": ["+", "-", "+"]
     }
  c) Bảng xét dấu (sign-table):
     "figure": {
       "kind": "sign-table",
       "rowLabel": "f'(x)",
       "xValues": ["-\\infty", "-1", "2", "+\\infty"],
       "intervalSigns": ["+", "-", "+"],
       "pointMarks": ["0", "0"]
     }
  d) Hình học không gian & phẳng (geometry) - ví dụ hình chóp S.ABC:
     "figure": {
       "kind": "geometry",
       "points": [
         {"id": "S", "x": 160, "y": 30, "label": "S"},
         {"id": "A", "x": 70, "y": 150, "label": "A"},
         {"id": "B", "x": 150, "y": 180, "label": "B"},
         {"id": "C", "x": 250, "y": 170, "label": "C"}
       ],
       "segments": [["S","A"], ["S","B"], ["S","C"], ["A","B"], ["B","C"]],
       "dashed": [["A","C"]],
       "rightAngles": [["S","A","B"]]
     }
  e) Biểu đồ thống kê (data-chart):
     "figure": {
       "kind": "data-chart",
       "chartType": "bar",
       "title": "Số lượng học sinh giỏi các lớp",
       "labels": ["Lớp 10A", "Lớp 10B", "Lớp 10C"],
       "series": [{"name": "Số học sinh Giỏi", "values": [12, 15, 10]}],
       "unit": "học sinh"
     }
- KHÔNG LỘ ĐÁP ÁN: Tuyệt đối không đặt nhãn Max(...), Min(...), tọa độ cực trị lên hình. Không in công thức hàm số lên hình khi câu hỏi yêu cầu tìm công thức hoặc khi đây là "hàm ẩn".
- Với câu hỏi đồ thị hàm ẩn (ví dụ: cho đồ thị hàm số f(x) rồi hỏi số cực trị của f(x^2 - 2x)): figure.functions chứa biểu thức để vẽ hình, câu dẫn KHÔNG in công thức; lời giải BẮT BUỘC phải dựa đúng trên tính chất hình vẽ của hàm ẩn đó.
- Slot có needsFigure=false TUYỆT ĐỐI không nhắc tới hình trong câu dẫn và không đưa trường 'figure' vào.

5. BẮT BUỘC VỀ LỜI GIẢI:
- Mọi câu hỏi đều phải có 'explanation' giải thích chi tiết, sư phạm, bước giải cụ thể, lý do vì sao đáp án đúng và vì sao các phương án khác sai.

6. ĐỊNH DẠNG ĐẦU RA JSON BẮT BUỘC:
- Trả về duy nhất 1 JSON object hợp lệ chuẩn RFC 8259.
- Mọi dấu gạch chéo ngược '\' của các công thức LaTeX (như \frac, \sqrt, \alpha, \times, \pm, \Delta...) khi đặt trong chuỗi JSON BẮT BUỘC phải được escape thành hai dấu gạch chéo ngược '\\' (ví dụ "\\frac{a}{b}", "\\sqrt{x}").
- Cấu trúc mẫu:
{
  "questions": [
    {
      "slotId": "ID_của_slot",
      "question": "Nội dung câu hỏi...",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "optionExprs": ["x^3 - 3*x", "x^4 - 2*x^2", "-x^3 + 3*x", "x^2 - 1"],
      "statements": [
        {"id": "a", "statement": "...", "isCorrect": true, "explanation": "..."},
        {"id": "b", "statement": "...", "isCorrect": false, "explanation": "..."}
      ],
      "pairs": [
        {"id": "1", "left": "...", "right": "..."}
      ],
      "correctAnswer": "A",
      "explanation": "Lời giải chi tiết...",
      "scoringGuide": "Hướng dẫn chấm...",
      "figure": {
        "kind": "function-graph",
        "functions": [{"expr": "x^3 - 3*x"}],
        "xRange": [-3, 3],
        "yRange": [-4, 4]
      }
    }
  ]
}`;
}

/**
 * Sinh câu hỏi dự phòng khẩn cấp nếu Gemini gặp lỗi vĩnh viễn với một slot
 * Đảm bảo đề thi không bao giờ bị hủy bỏ giữa chừng
 */
function createFallbackDraftQuestion(slot: BlueprintSlot, config: ExamConfig, errorReason: string): Question {
  const isMcq = slot.questionType === 'MCQ4';
  const isTf = slot.questionType === 'TRUE_FALSE';
  const isEssay = slot.questionType === 'ESSAY';

  return {
    id: `q_${slot.id}_fallback_${Date.now()}`,
    slotId: slot.id,
    subject: config.customSubject?.trim() || config.subject || 'Môn học',
    topic: slot.topic,
    type: slot.questionType,
    level: slot.level,
    question: `[Bản thảo câu hỏi - Chủ đề: ${slot.topic} - Mức độ: ${slot.level}]\nGiáo viên vui lòng chỉnh sửa nội dung câu hỏi này cho phù hợp với bài học.`,
    options: isMcq
      ? ['A. Lựa chọn 1', 'B. Lựa chọn 2', 'C. Lựa chọn 3', 'D. Lựa chọn 4']
      : undefined,
    statements: isTf
      ? [
          { id: 'a', statement: 'Mệnh đề a (Mẫu)', isCorrect: true, explanation: 'Giáo viên chỉnh sửa' },
          { id: 'b', statement: 'Mệnh đề b (Mẫu)', isCorrect: false, explanation: 'Giáo viên chỉnh sửa' },
          { id: 'c', statement: 'Mệnh đề c (Mẫu)', isCorrect: true, explanation: 'Giáo viên chỉnh sửa' },
          { id: 'd', statement: 'Mệnh đề d (Mẫu)', isCorrect: false, explanation: 'Giáo viên chỉnh sửa' },
        ]
      : undefined,
    correctAnswer: isMcq ? 'A' : isTf ? 'a: Đúng, b: Sai, c: Đúng, d: Sai' : 'Đáp án đang cập nhật',
    explanation: 'Giáo viên vui lòng bổ sung lời giải chi tiết cho câu hỏi này.',
    score: slot.score,
    needsReview: true,
    reviewNote: `AI gặp trục trặc khi tạo tự động: ${errorReason}. Vui lòng tự hoàn thiện nội dung.`,
    isTeacherWritten: false,
    rawAiResponse: null,
    rawParseError: errorReason,
    regenerationCount: 0,
  };
}

/**
 * Chuẩn hóa một câu hỏi từ phản hồi của Gemini
 */
export function normalizeQuestionFromAi(
  rawItem: any,
  slot: BlueprintSlot,
  config: ExamConfig
): Question {
  const isMcq = slot.questionType === 'MCQ4';
  const isTf = slot.questionType === 'TRUE_FALSE';

  let options: string[] | undefined = undefined;
  if (isMcq) {
    if (Array.isArray(rawItem.options)) {
      options = rawItem.options.map((opt: any, idx: number) => {
        const letters = ['A', 'B', 'C', 'D'];
        const text = String(opt ?? '').replace(/^[A-D]\.\s*/i, '').trim();
        return idx < 4 ? `${letters[idx]}. ${text}` : text;
      });
    } else {
      options = undefined;
    }
  } else if (rawItem.options && Array.isArray(rawItem.options)) {
    options = rawItem.options.map((o: any) => String(o));
  }

  let statements = undefined;
  if (isTf && Array.isArray(rawItem.statements)) {
    statements = rawItem.statements.map((st: any, idx: number) => {
      const defaultId = ['a', 'b', 'c', 'd'][idx] || `s_${idx + 1}`;
      return {
        id: String(st.id || defaultId),
        statement: String(st.statement || ''),
        isCorrect: Boolean(st.isCorrect),
        explanation: st.explanation ? String(st.explanation) : undefined,
      };
    });
  }

  let pairs = undefined;
  if (Array.isArray(rawItem.pairs)) {
    pairs = rawItem.pairs.map((p: any, idx: number) => ({
      id: String(p.id || idx + 1),
      left: String(p.left || ''),
      right: String(p.right || ''),
    }));
  }

  // Luôn lấy điểm từ blueprint slot, tuyệt đối KHÔNG lấy điểm do AI tự bịa
  const score = slot.score;

  // Chuẩn hóa cấu trúc figure nếu AI trả về (ưu tiên object figure trước, rồi mới tới figureJson)
  let figure: QuestionFigure | undefined = undefined;
  let rawParseError: string | undefined = undefined;
  let rawFigObj: any = null;

  if (rawItem.figure && typeof rawItem.figure === 'object' && Object.keys(rawItem.figure).length > 0) {
    rawFigObj = rawItem.figure;
  } else if (typeof rawItem.figureJson === 'string' && rawItem.figureJson.trim().length > 0) {
    try {
      rawFigObj = JSON.parse(rawItem.figureJson.trim());
    } catch (parseErr: any) {
      const errMsg = `Lỗi JSON.parse figureJson: ${parseErr?.message || String(parseErr)}`;
      rawParseError = errMsg;
      console.warn(`[normalizeQuestionFromAi] ${errMsg} slot ${slot.id}`);
    }
  }

  const rawKind = (rawFigObj?.kind || rawItem.figureKind || 'none').trim();

  if (rawFigObj && rawKind && rawKind !== 'none') {
    if (!rawFigObj.kind) rawFigObj.kind = rawKind;
    const figValidation = validateFigure(rawKind, rawFigObj);
    if (figValidation.isValid) {
      figure = rawFigObj as QuestionFigure;
    } else {
      const errMsg = `Figure không hợp lệ: ${figValidation.error}`;
      rawParseError = rawParseError ? `${rawParseError}; ${errMsg}` : errMsg;
      console.warn(`[normalizeQuestionFromAi] Figure không hợp lệ slot ${slot.id}: ${figValidation.error}`);
      figure = undefined;
    }
  }

  // Áp dụng quy tắc kiểm tra của validate.ts:
  // - questionNeedsFigure(q) hoặc slot.needsFigure
  // - Câu không nhắc hình và slot không cần hình mà lại có figure -> bỏ figure đó (không vẽ hình thừa)
  const questionContent = String(rawItem.question || `Câu hỏi cho chủ đề ${slot.topic}`);
  const mentionsFigure = questionNeedsFigure({ question: questionContent });
  const isFigureNeeded = Boolean(slot.needsFigure || mentionsFigure);
  if (!isFigureNeeded) {
    figure = undefined;
  }

  // Chuẩn hóa optionExprs
  let optionExprs: string[] | undefined = undefined;
  if (Array.isArray(rawItem.optionExprs) && rawItem.optionExprs.length === 4) {
    optionExprs = rawItem.optionExprs.map((expr: any) => String(expr).trim());
  }

  let svgDiagram: string | undefined = undefined;
  if (figure) {
    // Tự sinh SVG trực tiếp bằng code từ figure
    svgDiagram = figureToSvg(figure);
  } else if (typeof rawItem.svgDiagram === 'string' && rawItem.svgDiagram.trim().length > 0 && isFigureNeeded) {
    const rawSvg = rawItem.svgDiagram.trim();
    if (isValidSvg(rawSvg)) {
      svgDiagram = sanitizeSvg(rawSvg);
    }
  }

  return {
    id: `q_${slot.id}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    slotId: slot.id,
    subject: config.customSubject?.trim() || config.subject || 'Môn học',
    topic: slot.topic,
    type: slot.questionType,
    level: slot.level,
    question: String(rawItem.question || `Câu hỏi cho chủ đề ${slot.topic}`),
    options,
    optionExprs,
    statements,
    pairs,
    correctAnswer: String(rawItem.correctAnswer || (isMcq ? 'A' : '')),
    explanation: String(rawItem.explanation || 'Xem lại kiến thức trong sách giáo khoa.'),
    scoringGuide: rawItem.scoringGuide ? String(rawItem.scoringGuide) : undefined,
    score,
    needsReview: Boolean(rawItem.needsReview || !rawItem.question),
    reviewNote: rawItem.reviewNote,
    isTeacherWritten: false,
    figure,
    svgDiagram,
    rawAiResponse: rawItem,
    rawParseError,
    regenerationCount: typeof rawItem?.regenerationCount === 'number' ? rawItem.regenerationCount : 0,
  };
}

/**
 * Gọi API Gemini (qua server endpoint hoặc direct fallback), trả về JSON đã parse và chống lỗi LaTeX
 */
export async function callGeminiJsonApi(
  systemInstruction: string,
  contents: any[],
  abortSignal?: AbortSignal,
  responseSchema?: any
): Promise<any> {
  let serverCallSuccess = false;
  let rawData: any = null;
  let lastError: any = null;

  // 1. Thử gọi qua backend Express endpoint /api/generate-exam-batch (tối đa 2 lần)
  const payload: any = {
    modelName: CURRENT_MODEL_NAME,
    systemInstruction,
    contents,
  };
  if (responseSchema) {
    payload.responseSchema = responseSchema;
  }

  for (let attempt = 0; attempt < 2 && !serverCallSuccess; attempt++) {
    try {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 1500));
        if (abortSignal?.aborted) break;
      }

      const response = await fetch('/api/generate-exam-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: abortSignal,
      });

      if (response.ok) {
        const resJson = await response.json();
        if (resJson.success && resJson.data) {
          rawData = resJson.data;
          serverCallSuccess = true;
          break;
        } else {
          throw new Error(resJson?.error || 'Máy chủ không trả về dữ liệu câu hỏi hợp lệ.');
        }
      } else {
        const errorPayload = await response.json().catch(() => null);
        const serverErrorMsg = errorPayload?.error || `Mã phản hồi HTTP ${response.status}`;
        throw new Error(serverErrorMsg);
      }
    } catch (srvErr: any) {
      if (srvErr?.name === 'AbortError') throw srvErr;
      lastError = srvErr;
      if (attempt === 1) {
        console.warn('Lỗi khi gọi qua /api/generate-exam-batch:', srvErr?.message);
      }
    }
  }

  // 2. Dự phòng trực tiếp bằng @google/genai SDK nếu proxy không phản hồi
  if (!serverCallSuccess) {
    try {
      const client = getDirectClient();
      const configObj: any = {
        systemInstruction,
        responseMimeType: 'application/json',
      };
      if (responseSchema) {
        configObj.responseSchema = responseSchema;
      }

      let directRes;
      try {
        directRes = await client.models.generateContent({
          model: CURRENT_MODEL_NAME,
          contents,
          config: configObj,
        });
      } catch {
        // Thử sang FALLBACK_MODEL_NAME nếu gặp lỗi quá tải
        directRes = await client.models.generateContent({
          model: FALLBACK_MODEL_NAME,
          contents,
          config: configObj,
        });
      }

      const text = directRes.text || '';
      rawData = robustJsonParse(text);
    } catch (directErr: any) {
      throw new Error(formatAiErrorMessage(lastError || directErr));
    }
  }

  return rawData;
}

/**
 * Cấu trúc figure dạng OBJECT trực tiếp (không lồng JSON trong chuỗi)
 */
export const FIGURE_OBJECT_SCHEMA = {
  type: 'OBJECT',
  description: 'Dữ liệu hình vẽ chuẩn (Object trực tiếp, không lồng chuỗi JSON)',
  properties: {
    kind: {
      type: 'STRING',
      enum: ['function-graph', 'variation-table', 'sign-table', 'geometry', 'data-chart'],
      description: 'Loại hình vẽ: function-graph, variation-table, sign-table, geometry, data-chart',
    },
    // Cho function-graph
    functions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          expr: { type: 'STRING', description: 'Biểu thức mathjs, ví dụ x^3 - 3*x' },
          label: { type: 'STRING' },
        },
        required: ['expr'],
      },
    },
    xRange: {
      type: 'ARRAY',
      items: { type: 'NUMBER' },
      description: 'Khoảng [minX, maxX]',
    },
    yRange: {
      type: 'ARRAY',
      items: { type: 'NUMBER' },
      description: 'Khoảng [minY, maxY]',
    },
    points: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING' },
          x: { type: 'NUMBER' },
          y: { type: 'NUMBER' },
          label: { type: 'STRING' },
          isExtremum: { type: 'BOOLEAN' },
        },
      },
    },
    studentVisibleLabels: {
      type: 'ARRAY',
      items: { type: 'STRING' },
    },
    // Cho variation-table
    xValues: {
      type: 'ARRAY',
      items: { type: 'STRING' },
    },
    yValues: {
      type: 'ARRAY',
      items: { type: 'STRING' },
    },
    trends: {
      type: 'ARRAY',
      items: { type: 'STRING', enum: ['up', 'down'] },
    },
    derivativeSigns: {
      type: 'ARRAY',
      items: { type: 'STRING' },
    },
    // Cho sign-table
    rowLabel: {
      type: 'STRING',
    },
    intervalSigns: {
      type: 'ARRAY',
      items: { type: 'STRING' },
    },
    pointMarks: {
      type: 'ARRAY',
      items: { type: 'STRING' },
    },
    // Cho geometry
    segments: {
      type: 'ARRAY',
      items: {
        type: 'ARRAY',
        items: { type: 'STRING' },
      },
    },
    dashed: {
      type: 'ARRAY',
      items: {
        type: 'ARRAY',
        items: { type: 'STRING' },
      },
    },
    polygons: {
      type: 'ARRAY',
      items: {
        type: 'ARRAY',
        items: { type: 'STRING' },
      },
    },
    rightAngles: {
      type: 'ARRAY',
      items: {
        type: 'ARRAY',
        items: { type: 'STRING' },
      },
    },
    // Cho data-chart
    chartType: {
      type: 'STRING',
      enum: ['bar', 'line', 'pie'],
    },
    title: { type: 'STRING' },
    labels: {
      type: 'ARRAY',
      items: { type: 'STRING' },
    },
    series: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          values: {
            type: 'ARRAY',
            items: { type: 'NUMBER' },
          },
        },
        required: ['name', 'values'],
      },
    },
    unit: { type: 'STRING' },
  },
  required: ['kind'],
};

/**
 * responseSchema cho Gemini sinh lô câu hỏi, hỗ trợ đầy đủ các trường figure và optionExprs
 */
export const EXAM_BATCH_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    questions: {
      type: 'ARRAY',
      description: 'Danh sách các câu hỏi trong lô',
      items: {
        type: 'OBJECT',
        properties: {
          slotId: { type: 'STRING', description: 'ID của ô chỉ mục trong ma trận' },
          orderNumber: { type: 'INTEGER', description: 'Số thứ tự câu hỏi' },
          question: { type: 'STRING', description: 'Nội dung câu hỏi, chứa công thức LaTeX $...$ nếu có' },
          options: {
            type: 'ARRAY',
            items: { type: 'STRING' },
            description: '4 lựa chọn ["A. ...", "B. ...", "C. ...", "D. ..."] cho MCQ4/MCQ_MULTI',
          },
          optionExprs: {
            type: 'ARRAY',
            items: { type: 'STRING' },
            description: 'Biểu thức của từng phương án theo cú pháp mathjs cho câu hỏi nhận dạng đồ thị hàm số',
          },
          statements: {
            type: 'ARRAY',
            description: 'Các mệnh đề a, b, c, d cho câu Đúng/Sai',
            items: {
              type: 'OBJECT',
              properties: {
                id: { type: 'STRING' },
                statement: { type: 'STRING' },
                isCorrect: { type: 'BOOLEAN' },
                explanation: { type: 'STRING' },
              },
              required: ['id', 'statement', 'isCorrect'],
            },
          },
          pairs: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                id: { type: 'STRING' },
                left: { type: 'STRING' },
                right: { type: 'STRING' },
              },
              required: ['id', 'left', 'right'],
            },
          },
          correctAnswer: { type: 'STRING', description: 'Đáp án đúng (A, B, C, D hoặc từ điền, tóm tắt)' },
          explanation: { type: 'STRING', description: 'Lời giải chi tiết từng bước' },
          scoringGuide: { type: 'STRING', description: 'Hướng dẫn chấm điểm và barem điểm' },
          figure: FIGURE_OBJECT_SCHEMA,
          figureKind: {
            type: 'STRING',
            enum: ['function-graph', 'variation-table', 'sign-table', 'geometry', 'data-chart', 'none'],
            description: 'Loại hình vẽ: function-graph, variation-table, sign-table, geometry, data-chart hoặc none (tương thích cũ)',
          },
          figureJson: {
            type: 'STRING',
            description: 'Chuỗi JSON chứa đối tượng dữ liệu hình vẽ chuẩn tương ứng với figureKind, hoặc chuỗi rỗng nếu none (tương thích cũ)',
          },
        },
        required: ['slotId', 'question', 'correctAnswer', 'explanation'],
      },
    },
  },
  required: ['questions'],
};

/**
 * Gọi sinh một lô ô chỉ mục (tối đa 8 ô), có hỗ trợ retry tối đa 2 lần
 */
export async function generateExamBatch(
  batchSlots: BlueprintSlot[],
  config: ExamConfig,
  abortSignal?: AbortSignal,
  avoidQuestions?: Question[]
): Promise<Question[]> {
  if (batchSlots.length === 0) return [];

  const systemInstruction = buildSystemInstruction(config);
  const refParts = buildReferenceParts(config);

  const avoidQuestionsText =
    avoidQuestions && avoidQuestions.length > 0
      ? `\nCÁC CÂU HỎI ĐÃ CÓ TRONG ĐỀ THI (TUYỆT ĐỐI KHÔNG SINH TRÙNG LẶP NỘI DUNG VỚI CÁC CÂU NÀY):\n` +
        avoidQuestions
          .slice(-25)
          .map((q, idx) => `[Câu ${idx + 1} - ${q.type} - ${q.level}]: ${q.question.slice(0, 150)}`)
          .join('\n') +
        '\n'
      : '';

  // Chuẩn bị danh sách ô cần sinh
  const slotsPrompt = `DANH SÁCH ${batchSlots.length} CÂU HỎI CẦN TẠO TRONG LÔ NÀY:\n` +
    JSON.stringify(
      batchSlots.map((s) => ({
        slotId: s.id,
        orderNumber: s.orderNumber,
        questionType: s.questionType,
        level: s.level,
        topic: s.topic,
        learningOutcome: s.learningOutcome,
        score: s.score,
        needsFigure: Boolean(s.needsFigure),
        figureKinds: s.figureKinds || [],
      })),
      null,
      2
    ) +
    avoidQuestionsText +
    `\n\nQUY ĐỊNH BẮT BUỘC:\n` +
    `Slot có needsFigure=true BẮT BUỘC trả về dữ liệu hình hợp lệ thuộc figureKinds; slot needsFigure=false TUYỆT ĐỐI không nhắc tới hình trong câu dẫn.\n` +
    `Hãy tạo đầy đủ ${batchSlots.length} câu hỏi theo đúng từng slotId trên và trả về JSON { "questions": [...] }.`;

  const contents: any[] = [...refParts, { text: slotsPrompt }];

  // Thử lại tối đa 2 lần nếu Gemini trả về JSON sai hoặc thiếu câu
  const maxRetries = 2;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (abortSignal?.aborted) {
      throw new Error('Quá trình tạo đề đã được người dùng hủy.');
    }

    try {
      const rawData = await callGeminiJsonApi(
        systemInstruction,
        contents,
        abortSignal,
        EXAM_BATCH_RESPONSE_SCHEMA
      );

      const isArrayQuestions = Array.isArray(rawData?.questions);
      const generatedList: any[] = isArrayQuestions
        ? rawData.questions
        : Array.isArray(rawData)
        ? rawData
        : [];

      const slotsSent = batchSlots.length;
      const itemsReceived = generatedList.length;

      // Đếm số ô bị thiếu hoặc lỗi parse
      let missingOrParseErrorCount = 0;
      if (!isArrayQuestions && !Array.isArray(rawData)) {
        missingOrParseErrorCount = slotsSent;
      } else {
        const matchedSlotIds = new Set(
          generatedList.map((q) => q?.slotId || '').filter(Boolean)
        );
        const matchedOrderNums = new Set(
          generatedList.map((q) => q?.orderNumber).filter((n) => typeof n === 'number')
        );
        missingOrParseErrorCount = batchSlots.filter(
          (s) => !matchedSlotIds.has(s.id) && !matchedOrderNums.has(s.orderNumber)
        ).length;
      }

      console.log(
        `[Gemini Batch] Số ô gửi đi: ${slotsSent}, Số phần tử nhận về: ${itemsReceived}, Số ô bị thiếu hoặc lỗi parse: ${missingOrParseErrorCount}`
      );

      // Khớp từng slot với kết quả AI trả về
      const resultQuestions: Question[] = [];
      for (const slot of batchSlots) {
        const matched = generatedList.find(
          (q) => q.slotId === slot.id || q.orderNumber === slot.orderNumber
        );

        if (matched && matched.question) {
          resultQuestions.push(normalizeQuestionFromAi(matched, slot, config));
        } else {
          // Nếu thiếu trong lô này và còn lần thử lại, đánh dấu lỗi để retry
          if (attempt < maxRetries) {
            throw new Error(`Lô thiếu câu hỏi cho slot ${slot.id}`);
          } else {
            // Hết lượt thử lại: gán cờ needsReview, không làm hỏng cả đề
            resultQuestions.push(
              createFallbackDraftQuestion(slot, config, 'Gemini bỏ sót câu hỏi này trong phản hồi')
            );
          }
        }
      }

      return resultQuestions;
    } catch (err: any) {
      console.log(
        `[Gemini Batch] Lỗi gọi/parse lô: ${err?.message || err}. Số ô gửi đi: ${batchSlots.length}, Số phần tử nhận về: 0, Số ô bị thiếu hoặc lỗi parse: ${batchSlots.length}`
      );
      if (err?.name === 'AbortError' || abortSignal?.aborted) {
        throw new Error('Quá trình tạo đề đã được người dùng hủy.');
      }
      lastError = err;
      const isRateLimit =
        err?.status === 429 ||
        err?.code === 429 ||
        String(err?.message || '').includes('429') ||
        String(err?.message || '').toLowerCase().includes('quota');

      // Chờ nhẹ trước khi thử lại (kéo dài hơn nếu chạm giới hạn tần suất)
      if (attempt < maxRetries) {
        const waitMs = isRateLimit ? 2500 : 1000;
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }
  }

  // Nếu tất cả các lần thử đều thất bại, trả về danh sách câu hỏi dự phòng đánh dấu needsReview
  return batchSlots.map((slot) =>
    createFallbackDraftQuestion(slot, config, lastError?.message || 'Không thể kết nối dịch vụ AI')
  );
}

/**
 * Sinh toàn bộ đề thi theo danh sách BlueprintSlots:
 * - Chia thành các lô tối đa 8 ô
 * - Gọi Gemini lần lượt từng lô (tuần tự)
 * - Cập nhật tiến trình qua callback onProgress
 * - Hỗ trợ hủy bỏ bằng abortSignal
 */
export async function generateCompleteExam(
  config: ExamConfig,
  blueprint: BlueprintSlot[],
  onProgress?: (info: {
    batchIndex: number;
    totalBatches: number;
    currentSlotRange: string;
    percent: number;
  }) => void,
  abortSignal?: AbortSignal,
  existingQuestionsToAvoid?: Question[]
): Promise<Question[]> {
  if (!blueprint || blueprint.length === 0) {
    throw new Error('Danh sách ma trận (Blueprint) rỗng. Vui lòng thiết lập cấu trúc đề trước.');
  }

  // Xử lý giữ nguyên câu hỏi giáo viên tự nhập nếu được bật
  const lockedTeacherQuestions: Question[] =
    config.lockTeacherQuestions && config.teacherQuestions && config.teacherQuestions.length > 0
      ? config.teacherQuestions.map((q) => ({
          ...q,
          isTeacherWritten: true,
          needsReview: false,
        }))
      : [];

  // Ghép các câu giáo viên nhập vào các slot tương ứng trong blueprint
  const assignedSlots = new Map<string, Question>();
  const unassignedSlots: BlueprintSlot[] = [];
  const remainingTeacherQuestions = [...lockedTeacherQuestions];

  for (const slot of blueprint) {
    // Ưu tiên 1: Khớp cả Chủ đề + Dạng câu + Mức độ nhận thức
    let matchIdx = remainingTeacherQuestions.findIndex(
      (tq) =>
        tq.type === slot.questionType &&
        tq.level === slot.level &&
        tq.topic &&
        slot.topic &&
        tq.topic.trim().toLowerCase() === slot.topic.trim().toLowerCase()
    );

    // Ưu tiên 2: Khớp Dạng câu + Mức độ nhận thức
    if (matchIdx === -1) {
      matchIdx = remainingTeacherQuestions.findIndex(
        (tq) => tq.type === slot.questionType && tq.level === slot.level
      );
    }

    // Dự phòng: Khớp Dạng câu
    if (matchIdx === -1) {
      matchIdx = remainingTeacherQuestions.findIndex((tq) => tq.type === slot.questionType);
    }

    if (matchIdx !== -1) {
      const [matchedQ] = remainingTeacherQuestions.splice(matchIdx, 1);
      const assignedQ: Question = {
        ...matchedQ,
        slotId: slot.id,
        score: slot.score || matchedQ.score,
        isTeacherWritten: true,
        needsReview: false,
      };
      assignedSlots.set(slot.id, assignedQ);
    } else {
      unassignedSlots.push(slot);
    }
  }

  // Nếu bật ưu tiên mẫu của code cho câu có hình (mặc định BẬT cho môn Toán):
  // Tự động dựng câu hỏi Toán có hình bằng code thuần cho các slot khớp mẫu
  const slotsToGenerateWithAi: BlueprintSlot[] = [];
  if (config.preferCodeTemplatesForFigures !== false) {
    for (const slot of unassignedSlots) {
      if (slot.needsFigure) {
        const templateQ = pickMathTemplate(slot, config, slot.orderNumber * 1013 + 37);
        if (templateQ) {
          assignedSlots.set(slot.id, templateQ);
          continue;
        }
      }
      slotsToGenerateWithAi.push(slot);
    }
  } else {
    slotsToGenerateWithAi.push(...unassignedSlots);
  }

  // Danh sách các câu hỏi hiện đã có (để tránh trùng lặp)
  const existingQuestions: Question[] = [
    ...Array.from(assignedSlots.values()),
    ...(existingQuestionsToAvoid || []),
  ];

  // Tách riêng: slot needsFigure = true gửi theo lô tối đa 3 câu; slot không hình gửi theo lô tối đa 8 câu
  const figureSlots = slotsToGenerateWithAi.filter((s) => Boolean(s.needsFigure));
  const noFigureSlots = slotsToGenerateWithAi.filter((s) => !s.needsFigure);

  const batches: BlueprintSlot[][] = [];
  const FIGURE_BATCH_SIZE = 3;
  for (let i = 0; i < figureSlots.length; i += FIGURE_BATCH_SIZE) {
    batches.push(figureSlots.slice(i, i + FIGURE_BATCH_SIZE));
  }

  const NO_FIGURE_BATCH_SIZE = 8;
  for (let i = 0; i < noFigureSlots.length; i += NO_FIGURE_BATCH_SIZE) {
    batches.push(noFigureSlots.slice(i, i + NO_FIGURE_BATCH_SIZE));
  }

  const totalBatches = Math.max(1, batches.length);
  const generatedMap = new Map<string, Question>();

  if (batches.length > 0) {
    for (let b = 0; b < batches.length; b++) {
      if (abortSignal?.aborted) {
        throw new Error('Quá trình tạo đề đã được người dùng hủy.');
      }

      if (b > 0) {
        // Nghỉ ngắn giữa các lô để bảo vệ hạn mức gọi API (Rate Limit)
        await new Promise((resolve) => setTimeout(resolve, 400));
      }

      const batchSlots = batches[b];
      const rangeText = `câu ${batchSlots[0].orderNumber}–${batchSlots[batchSlots.length - 1].orderNumber}`;

      const percent = Math.round((b / totalBatches) * 100);
      onProgress?.({
        batchIndex: b + 1,
        totalBatches,
        currentSlotRange: rangeText,
        percent,
      });

      const allAvoidQuestions = [...existingQuestions, ...Array.from(generatedMap.values())];
      const batchQuestions = await generateExamBatch(
        batchSlots,
        config,
        abortSignal,
        allAvoidQuestions
      );
      batchQuestions.forEach((q) => {
        generatedMap.set(q.slotId, q);
      });
    }
  }

  // Tập hợp toàn bộ câu hỏi theo đúng thứ tự blueprint
  const finalQuestions: Question[] = [];
  for (const slot of blueprint) {
    if (assignedSlots.has(slot.id)) {
      finalQuestions.push(assignedSlots.get(slot.id)!);
    } else if (generatedMap.has(slot.id)) {
      finalQuestions.push(generatedMap.get(slot.id)!);
    } else {
      finalQuestions.push(createFallbackDraftQuestion(slot, config, 'Chưa sinh được câu hỏi'));
    }
  }

  // Nếu còn câu hỏi giáo viên dư ra mà blueprint chưa có slot, thêm vào cuối đề
  if (remainingTeacherQuestions.length > 0) {
    remainingTeacherQuestions.forEach((extraQ) => {
      finalQuestions.push({
        ...extraQ,
        isTeacherWritten: true,
        needsReview: false,
      });
    });
  }

  // Hoàn tất 100%
  onProgress?.({
    batchIndex: totalBatches,
    totalBatches,
    currentSlotRange: 'Hoàn tất',
    percent: 100,
  });

  return finalQuestions;
}

/**
 * Tạo mẫu đối tượng figure động cho prompt JSON:
 * Nếu slot needsFigure=true: đưa vào cấu trúc figure đầy đủ theo figureKinds
 * Nếu slot needsFigure=false: trả về chuỗi rỗng (không đưa trường figure vào mẫu)
 */
export function getDynamicFigureSample(slot: BlueprintSlot): string {
  if (!slot.needsFigure) {
    return '';
  }
  const preferredKind = slot.figureKinds?.[0] || 'function-graph';
  if (preferredKind === 'variation-table') {
    return `,\n      "figure": {\n        "kind": "variation-table",\n        "xValues": ["-\\infty", "-1", "1", "+\\infty"],\n        "yValues": ["-\\infty", "2", "-2", "+\\infty"],\n        "trends": ["up", "down", "up"],\n        "derivativeSigns": ["+", "-", "+"]\n      }`;
  }
  if (preferredKind === 'sign-table') {
    return `,\n      "figure": {\n        "kind": "sign-table",\n        "rowLabel": "f'(x)",\n        "xValues": ["-\\infty", "-1", "2", "+\\infty"],\n        "intervalSigns": ["+", "-", "+"],\n        "pointMarks": ["0", "0"]\n      }`;
  }
  if (preferredKind === 'geometry') {
    return `,\n      "figure": {\n        "kind": "geometry",\n        "points": [\n          {"id": "S", "x": 160, "y": 30, "label": "S"},\n          {"id": "A", "x": 70, "y": 150, "label": "A"},\n          {"id": "B", "x": 150, "y": 180, "label": "B"},\n          {"id": "C", "x": 250, "y": 170, "label": "C"}\n        ],\n        "segments": [["S","A"], ["S","B"], ["S","C"], ["A","B"], ["B","C"]],\n        "dashed": [["A","C"]]\n      }`;
  }
  if (preferredKind === 'data-chart') {
    return `,\n      "figure": {\n        "kind": "data-chart",\n        "chartType": "bar",\n        "title": "Biểu đồ",\n        "labels": ["Nhóm 1", "Nhóm 2", "Nhóm 3"],\n        "series": [{"name": "Giá trị", "values": [12, 18, 15]}],\n        "unit": "đơn vị"\n      }`;
  }
  return `,\n      "figure": {\n        "kind": "function-graph",\n        "functions": [{"expr": "x^3 - 3*x", "label": "y = f(x)"}],\n        "xRange": [-3, 3],\n        "yRange": [-4, 4]\n      }`;
}

/**
 * Sinh lại duy nhất một câu hỏi theo slot (khi giáo viên bấm nút "Tạo lại"):
 * - Giữ nguyên ô (dạng, mức, chủ đề, điểm)
 * - Gửi kèm danh sách các câu còn lại để AI tránh trùng
 * - Hỗ trợ "Yêu cầu riêng cho câu này" (hint)
 */
export async function regenerateSlotWithContext(
  slot: BlueprintSlot,
  config: ExamConfig,
  otherQuestions: Question[] = [],
  customHint?: string,
  abortSignal?: AbortSignal
): Promise<Question> {
  const systemInstruction = buildSystemInstruction(config);
  const refParts = buildReferenceParts(config);

  const avoidQuestionsText =
    otherQuestions.length > 0
      ? `\nCÁC CÂU HỎI ĐÃ CÓ TRONG ĐỀ THI (TUYỆT ĐỐI KHÔNG SINH TRÙNG LẶP NỘI DUNG VỚI CÁC CÂU NÀY):\n` +
        otherQuestions
          .slice(-25)
          .map((q, idx) => `[Câu ${idx + 1} - ${q.type} - ${q.level}]: ${q.question.slice(0, 140)}`)
          .join('\n') +
        '\n'
      : '';

  const hintText = customHint?.trim()
    ? `\n\nYÊU CẦU RIÊNG CỦA GIÁO VIÊN CHO CÂU NÀY:\n${customHint.trim()}\n`
    : '';

  const figureDirective = slot.needsFigure
    ? `\nBẮT BUỘC VỀ HÌNH VẼ: Ô này có needsFigure=true, BẮT BUỘC trả về dữ liệu hình vẽ hợp lệ trong trường 'figure' (thuộc ${slot.figureKinds?.join(', ') || 'các dạng hình chuẩn'}). Bạn không vẽ hình, chỉ đưa dữ liệu. Mọi dữ kiện trong đề, đáp án và lời giải phải suy ra từ chính dữ liệu hình.`
    : `\nLƯU Ý: Ô này needsFigure=false, TUYỆT ĐỐI không nhắc đến hình ảnh, đồ thị hoặc bảng trong câu dẫn và KHÔNG đưa trường 'figure' vào JSON.`;

  const promptText = `HÃY SINH DUY NHẤT 1 CÂU HỎI MỚI CHO Ô MA TRẬN SAU:
- Mã ô: ${slot.id} (Câu số ${slot.orderNumber})
- Dạng câu: ${slot.questionType}
- Mức độ nhận thức: ${slot.level}
- Chủ đề: ${slot.topic}
- Điểm: ${slot.score}đ
- Cần hình vẽ: ${Boolean(slot.needsFigure)}${slot.figureKinds ? ` (${slot.figureKinds.join(', ')})` : ''}
${avoidQuestionsText}${hintText}
YÊU CẦU:
1. Đúng chuẩn GDPT 2018 môn ${config.subject} lớp ${config.grade || ''}.
2. Nội dung hoàn toàn mới, sáng tạo, không trùng lặp các câu trên.
3. Đúng cấu trúc định dạng (${slot.questionType}): đủ lựa chọn, đáp án, lời giải chi tiết.${figureDirective}
4. Trả về đúng định dạng JSON:
{
  "questions": [
    {
      "slotId": "${slot.id}",
      "question": "Nội dung câu hỏi...",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "optionExprs": ["..."],
      "statements": [...],
      "pairs": [...],
      "correctAnswer": "...",
      "explanation": "...",
      "scoringGuide": "..."${getDynamicFigureSample(slot)}
    }
  ]
}`;

  const contents = [...refParts, { text: promptText }];
  const rawData = await callGeminiJsonApi(
    systemInstruction,
    contents,
    abortSignal,
    EXAM_BATCH_RESPONSE_SCHEMA
  );
  const isArrayQuestions = Array.isArray(rawData?.questions);
  const generatedList: any[] = isArrayQuestions
    ? rawData.questions
    : Array.isArray(rawData)
    ? rawData
    : [];

  const matched = generatedList.find((q) => q.slotId === slot.id) || generatedList[0];
  const missingCount = matched && matched.question ? 0 : 1;
  console.log(
    `[Gemini Batch (Đơn)] Số ô gửi đi: 1, Số phần tử nhận về: ${generatedList.length}, Số ô bị thiếu hoặc lỗi parse: ${missingCount}`
  );

  if (matched && matched.question) {
    const q = normalizeQuestionFromAi(matched, slot, config);
    q.score = slot.score;
    q.needsReview = false;
    q.reviewNote = undefined;
    return q;
  }

  throw new Error('AI không trả về câu hỏi hợp lệ cho ô này.');
}

/**
 * Sinh lại duy nhất một câu hỏi (tương thích ngược)
 */
export async function regenerateSingleQuestion(
  slot: BlueprintSlot,
  config: ExamConfig,
  otherQuestions: Question[] = [],
  customHint?: string
): Promise<Question> {
  return regenerateSlotWithContext(slot, config, otherQuestions, customHint);
}

/**
 * Phân tích và tách văn bản thô (giáo viên dán) thành danh sách Question JSON
 * Phục vụ chế độ "Câu hỏi giáo viên tự nhập"
 */
export async function parseQuestionsFromRawText(
  rawText: string,
  config: ExamConfig,
  abortSignal?: AbortSignal
): Promise<Question[]> {
  if (!rawText || rawText.trim().length === 0) return [];

  const prompt = `Bạn là chuyên gia thẩm định và cấu trúc đề thi chuẩn Bộ GD&ĐT Việt Nam.
Hãy phân tích đoạn văn bản chứa một hoặc nhiều câu hỏi do giáo viên cung cấp dưới đây, và chuyển đổi thành danh sách câu hỏi dạng JSON chuẩn:

VĂN BẢN CÂU HỎI CỦA GIÁO VIÊN:
${rawText}

Môn học: ${config.customSubject?.trim() || config.subject || 'Môn học'}, Lớp: ${config.grade || ''}.

YÊU CẦU CHUYỂN ĐỔI:
1. Nhận diện chính xác từng câu hỏi riêng biệt.
2. Xác định dạng câu hỏi (type):
   - 'MCQ4': Trắc nghiệm 4 lựa chọn (A, B, C, D)
   - 'TRUE_FALSE': Đúng / Sai (các ý a, b, c, d)
   - 'MATCHING': Nối cột / Ghép cặp
   - 'FILL_BLANK': Điền từ / Điền khuyết
   - 'SHORT_ANSWER': Trả lời ngắn
   - 'ESSAY': Tự luận
3. Xác định mức độ nhận thức (level): 'NB' | 'TH' | 'VD' | 'VDC'.
4. Trích xuất nội dung câu hỏi (giữ nguyên công thức $...$), các phương án A, B, C, D (nếu có), đáp án đúng (correctAnswer), lời giải chi tiết (explanation), và điểm số gợi ý (score: ví dụ 0.25 hoặc 0.5 hoặc 1.0).
5. Trả về đúng định dạng JSON:
{
  "questions": [
    {
      "type": "MCQ4",
      "level": "NB",
      "topic": "Chủ đề câu hỏi",
      "question": "Nội dung câu hỏi...",
      "options": ["A. Lựa chọn A", "B. Lựa chọn B", "C. Lựa chọn C", "D. Lựa chọn D"],
      "statements": [{"id": "a", "statement": "...", "isCorrect": true}],
      "pairs": [{"id": "1", "left": "...", "right": "..."}],
      "correctAnswer": "A",
      "explanation": "Lời giải chi tiết...",
      "scoringGuide": "Hướng dẫn chấm nếu có...",
      "score": 0.25
    }
  ]
}`;

  const response = await fetch('/api/generate-exam-batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      modelName: CURRENT_MODEL_NAME,
      contents: [{ text: prompt }],
    }),
    signal: abortSignal,
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData?.error || `Lỗi máy chủ (${response.status}) khi tách câu hỏi`);
  }

  const data = await response.json();
  const rawData = data?.data;
  const list: any[] = Array.isArray(rawData?.questions)
    ? rawData.questions
    : Array.isArray(rawData)
    ? rawData
    : [];

  return list.map((item, idx) => {
    const qType: QuestionType = item.type || 'MCQ4';
    return {
      id: `q_teacher_${Date.now()}_${idx}`,
      slotId: `slot_teacher_${Date.now()}_${idx}`,
      subject: config.customSubject?.trim() || config.subject || 'Môn học',
      topic: item.topic || config.topicName || 'Chủ đề kiến thức',
      type: qType,
      level: item.level || 'NB',
      question: item.question || '',
      options: item.options,
      statements: item.statements,
      pairs: item.pairs,
      correctAnswer: item.correctAnswer || (qType === 'MCQ4' ? 'A' : ''),
      explanation: item.explanation || '',
      scoringGuide: item.scoringGuide || '',
      score:
        typeof item.score === 'number' && item.score > 0
          ? item.score
          : qType === 'ESSAY'
          ? 2.0
          : 0.25,
      needsReview: false,
      isTeacherWritten: true,
      figure: item.figure,
      optionExprs: item.optionExprs,
    };
  });
}

/**
 * Trích xuất các đơn vị kiến thức/chủ đề từ văn bản giáo án hoặc tài liệu Word
 */
export async function extractTopicsFromText(
  rawText: string,
  subject: string,
  grade: number
): Promise<string[]> {
  if (!rawText || rawText.trim().length === 0) return [];

  try {
    const prompt = `Trích xuất tối đa 10 chủ đề hoặc đơn vị kiến thức trọng tâm từ văn bản giáo án/SGK môn ${subject} lớp ${grade} sau. Trả về JSON mảng các chuỗi: ["Chủ đề 1", "Chủ đề 2", ...]`;
    const response = await fetch('/api/generate-exam-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelName: CURRENT_MODEL_NAME,
        contents: [{ text: `${prompt}\n\nVăn bản:\n${rawText.slice(0, 15000)}` }],
      }),
    });
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data?.data)) return data.data;
    }
  } catch (e) {
    console.warn('Lỗi trích xuất chủ đề:', e);
  }
  return [];
}

/**
 * Tự sửa và tái biên soạn lại một câu hỏi bị lỗi chất lượng (kèm nội dung lỗi và suggestedFix)
 */
export async function repairQuestionWithFeedback(
  slot: BlueprintSlot,
  config: ExamConfig,
  currentQ: Question,
  errorMessages: string[],
  suggestedFixes: string[],
  abortSignal?: AbortSignal
): Promise<Question> {
  const systemInstruction = buildSystemInstruction(config);
  const refParts = buildReferenceParts(config);

  const figureDirective = slot.needsFigure
    ? `\nBẮT BUỘC VỀ HÌNH VẼ: Ô này có needsFigure=true, BẮT BUỘC trả về dữ liệu hình vẽ hợp lệ trong trường 'figure' (thuộc ${slot.figureKinds?.join(', ') || 'các dạng hình chuẩn'}). Bạn không vẽ hình, chỉ đưa dữ liệu. Mọi dữ kiện trong đề, đáp án và lời giải phải suy ra được từ chính dữ liệu hình.`
    : `\nLƯU Ý: Ô này needsFigure=false, TUYỆT ĐỐI không nhắc đến hình ảnh, đồ thị hoặc bảng trong câu dẫn và KHÔNG đưa trường 'figure' vào JSON.`;

  const repairPrompt = `CHỈ THỊ ĐẶC BIỆT: TỰ SỬA VÀ TÁI BIÊN SOẠN CÂU HỎI DO GẶP LỖI CHẤT LƯỢNG
Thông tin ô chỉ mục trong ma trận:
- Mã ô: ${slot.id} (Câu số ${slot.orderNumber})
- Dạng câu: ${slot.questionType}
- Mức độ nhận thức: ${slot.level}
- Chủ đề kiến thức: ${slot.topic}
- Điểm số: ${slot.score}đ
- Cần hình vẽ: ${Boolean(slot.needsFigure)}${slot.figureKinds ? ` (${slot.figureKinds.join(', ')})` : ''}

CÂU HỎI HIỆN TẠI ĐANG BỊ PHÁT HIỆN LỖI:
"${currentQ.question}"
- Các lỗi cần khắc phục:
${errorMessages.map((m, i) => `  ${i + 1}. ${m}`).join('\n')}
${suggestedFixes.length > 0 ? `- Gợi ý sửa:\n${suggestedFixes.map((f, i) => `  ${i + 1}. ${f}`).join('\n')}` : ''}

YÊU CẦU:
1. Hãy biên soạn lại câu hỏi này một cách cẩn thận, khắc phục triệt để các lỗi và vấn đề nêu trên.
2. Đảm bảo đúng chuẩn kiến thức GDPT 2018, bám sát môn ${config.subject} lớp ${config.grade}.${figureDirective}
3. Nếu là trắc nghiệm MCQ4: đủ 4 phương án, 1 đáp án duy nhất đúng, các phương án nhiễu cùng kiểu dữ liệu.
4. NGUYÊN TẮC LỜI GIẢI VÀ ĐÁP ÁN:
   - Giải trọn vẹn đúng đề đã cho, tuyệt đối KHÔNG tự ý đổi đề trong lời giải (CẤM các cụm "Tuy nhiên, nếu đề bài", "giả sử đề bài", "như bản gốc", "kiểm tra lại tính toán").
   - Kết luận cuối cùng của lời giải PHẢI TRÙNG KHỚP TUYỆT ĐỐI với correctAnswer (ví dụ: nếu đề hỏi số giá trị nguyên của tham số m và kết luận có 1 giá trị thì correctAnswer phải là 1 hoặc phương án tương ứng, không được kết luận "không có giá trị nào" khi đáp án chọn phương án khác).
5. Định dạng JSON trả về:
{
  "questions": [
    {
      "slotId": "${slot.id}",
      "question": "Nội dung câu hỏi mới đã sửa...",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "optionExprs": ["..."],
      "statements": [...],
      "pairs": [...],
      "correctAnswer": "A",
      "explanation": "Lời giải chi tiết đầy đủ...",
      "scoringGuide": "Hướng dẫn chấm..."${getDynamicFigureSample(slot)}
    }
  ]
}`;

  const contents = [...refParts, { text: repairPrompt }];

  try {
    const rawData = await callGeminiJsonApi(
      systemInstruction,
      contents,
      abortSignal,
      EXAM_BATCH_RESPONSE_SCHEMA
    );
    const isArrayQuestions = Array.isArray(rawData?.questions);
    const generatedList: any[] = isArrayQuestions
      ? rawData.questions
      : Array.isArray(rawData)
      ? rawData
      : [];

    const matched = generatedList.find((q) => q.slotId === slot.id) || generatedList[0];
    const missingCount = matched && matched.question ? 0 : 1;
    console.log(
      `[Gemini Batch (Tự sửa)] Số ô gửi đi: 1, Số phần tử nhận về: ${generatedList.length}, Số ô bị thiếu hoặc lỗi parse: ${missingCount}`
    );

    if (matched && matched.question) {
      const fixed = normalizeQuestionFromAi(matched, slot, config);
      fixed.id = currentQ.id; // Giữ nguyên ID câu hỏi
      fixed.needsReview = false;
      fixed.reviewNote = undefined;
      fixed.regenerationCount = (currentQ.regenerationCount || 0) + 1;
      return fixed;
    }
  } catch (err: any) {
    console.log(
      `[Gemini Batch (Tự sửa)] Lỗi gọi/parse: ${err?.message || err}. Số ô gửi đi: 1, Số phần tử nhận về: 0, Số ô bị thiếu hoặc lỗi parse: 1`
    );
    if (err?.name === 'AbortError') throw err;
    console.warn(`Lỗi khi sửa câu hỏi ${currentQ.id}:`, err);
  }

  // Nếu không sửa được qua AI, đánh dấu needsReview và ghi chú lỗi
  return {
    ...currentQ,
    needsReview: true,
    reviewNote: `AI chưa sửa được: ${errorMessages.slice(0, 2).join('; ')}`,
  };
}

/**
 * Chỉ xin dữ liệu hình (QuestionFigure) cho một câu hỏi đã có sẵn nội dung
 * Giữ nguyên câu dẫn, options, correctAnswer và optionExprs
 * Thử lại tối đa 3 lần, kiểm tra validateFigure và đối soát optionExprs
 */
export async function repairFigureOnly(
  slot: BlueprintSlot,
  config: ExamConfig,
  question: Question,
  abortSignal?: AbortSignal
): Promise<QuestionFigure | null> {
  const kindsPrompt =
    slot.figureKinds && slot.figureKinds.length > 0
      ? slot.figureKinds.join(' hoặc ')
      : 'function-graph, variation-table, sign-table, geometry hoặc data-chart';

  const promptText = `Cho câu hỏi sau (nguyên văn):
"${question.question}"
${question.options && question.options.length > 0 ? `Các phương án:\n${question.options.join('\n')}\n` : ''}Đáp án đúng là: ${question.correctAnswer}
${question.optionExprs && question.optionExprs.length > 0 ? `Các biểu thức hàm số của từng phương án: ${question.optionExprs.join(', ')}\n` : ''}
Hãy trả về duy nhất đối tượng figure (kind: ${kindsPrompt}) sao cho đúng với câu hỏi và đáp án đúng là ${question.correctAnswer}.
LƯU Ý QUAN TRỌNG:
1. Bạn không vẽ hình, chỉ đưa dữ liệu. Mọi dữ kiện trong đề, đáp án và lời giải phải suy ra được từ chính dữ liệu hình.
2. Nếu là đồ thị hàm số (function-graph) và có các biểu thức hàm số của phương án, hàm trong figure.functions[0].expr BẮT BUỘC phải khớp với đáp án đúng ${question.correctAnswer}.
3. Trả về đúng định dạng JSON: { "figure": { "kind": "...", ... } }`;

  const FIGURE_ONLY_SCHEMA = {
    type: 'OBJECT',
    properties: {
      figure: FIGURE_OBJECT_SCHEMA,
    },
    required: ['figure'],
  };

  const systemInstruction = `Bạn là chuyên gia mô hình hóa dữ liệu hình vẽ toán học và khoa học GDPT 2018. Bạn không vẽ hình, chỉ đưa dữ liệu đối tượng figure JSON chính xác tuyệt đối theo đề bài và đáp án đúng đã cho.`;
  const refParts = buildReferenceParts(config);
  const contents = [...refParts, { text: promptText }];

  for (let attempt = 1; attempt <= 3; attempt++) {
    if (abortSignal?.aborted) break;

    try {
      const rawData = await callGeminiJsonApi(
        systemInstruction,
        contents,
        abortSignal,
        FIGURE_ONLY_SCHEMA
      );

      const rawFig = rawData?.figure;
      if (!rawFig || typeof rawFig !== 'object' || !rawFig.kind) {
        continue;
      }

      // 1. Kiểm tra tính hợp lệ bằng validateFigure
      const validation = validateFigure(rawFig.kind, rawFig);
      if (!validation.isValid) {
        console.warn(`[repairFigureOnly] Lần ${attempt}/3: Hình vẽ không hợp lệ: ${validation.error}`);
        continue;
      }

      // 2. Nếu là function-graph và có optionExprs, kiểm tra nhất quán đồ thị với đáp án đúng
      if (
        rawFig.kind === 'function-graph' &&
        Array.isArray(rawFig.functions) &&
        rawFig.functions.length > 0 &&
        Array.isArray(question.optionExprs) &&
        question.optionExprs.length === 4
      ) {
        const letters = ['A', 'B', 'C', 'D'];
        const correctIdx = letters.indexOf((question.correctAnswer || '').trim().toUpperCase());
        if (correctIdx >= 0 && correctIdx < question.optionExprs.length) {
          const correctExpr = question.optionExprs[correctIdx];
          const figureExpr = rawFig.functions[0].expr;
          try {
            const fnFigure = compile(figureExpr);
            const fnCorrect = compile(correctExpr);
            const [minX, maxX] = rawFig.xRange || [-3, 3];
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
                  if (Math.abs(yFig - yCorr) > 0.05) mismatchCount++;
                }
              } catch {
                // Điểm gián đoạn
              }
            }
            if (validComparisons >= 3 && mismatchCount > 0) {
              console.warn(
                `[repairFigureOnly] Lần ${attempt}/3: Đồ thị (${figureExpr}) không khớp đáp án đúng (${correctExpr})`
              );
              continue;
            }
          } catch (compileErr) {
            console.warn(`[repairFigureOnly] Lần ${attempt}/3: Lỗi biên dịch biểu thức hàm số:`, compileErr);
            continue;
          }
        }
      }

      return rawFig as QuestionFigure;
    } catch (err: any) {
      console.warn(`[repairFigureOnly] Lần ${attempt}/3 gặp lỗi:`, err?.message || err);
    }
  }

  return null;
}

/**
 * Đầu vào cho hàm đọc ma trận có sẵn
 */
export interface ParseMatrixInput {
  text?: string;
  file?: {
    name: string;
    mimeType: string;
    base64?: string;
    text?: string;
  };
}

/**
 * responseSchema cho Gemini đọc ma trận theo chuẩn JSON Schema của Gemini SDK
 */
export const MATRIX_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    totalPoints: {
      type: 'NUMBER',
      description: 'Tổng điểm toàn bài ghi trên ma trận (nếu có, ví dụ 10)',
    },
    totalQuestions: {
      type: 'INTEGER',
      description: 'Tổng số câu hỏi ghi trên ma trận (nếu có)',
    },
    topics: {
      type: 'ARRAY',
      description: 'Danh sách các chủ đề / mạch kiến thức / chương trong ma trận',
      items: {
        type: 'OBJECT',
        properties: {
          name: {
            type: 'STRING',
            description: 'Tên chủ đề hoặc đơn vị kiến thức',
          },
          requirement: {
            type: 'STRING',
            description: 'Yêu cầu cần đạt hoặc chuẩn kiến thức kỹ năng (nếu có)',
          },
          cells: {
            type: 'ARRAY',
            description: 'Các ô phân bổ số câu, dạng câu và điểm số theo mức độ nhận thức',
            items: {
              type: 'OBJECT',
              properties: {
                level: {
                  type: 'STRING',
                  enum: ['NB', 'TH', 'VD', 'VDC'],
                  description: 'Mức độ nhận thức: NB (Nhận biết), TH (Thông hiểu), VD (Vận dụng), VDC (Vận dụng cao)',
                },
                questionType: {
                  type: 'STRING',
                  description: 'Dạng câu hỏi: MCQ4, TRUE_FALSE, SHORT_ANSWER, ESSAY, MATCHING, FILL_BLANK, MCQ_MULTI',
                },
                count: {
                  type: 'INTEGER',
                  description: 'Số lượng câu hỏi trong ô (nguyên >= 0)',
                },
                points: {
                  type: 'NUMBER',
                  description: 'Tổng số điểm của ô đó (nếu có ghi trong ma trận)',
                },
              },
              required: ['level', 'questionType', 'count'],
            },
          },
        },
        required: ['name', 'cells'],
      },
    },
    warnings: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: 'Các cảnh báo, ô khó đọc, mờ hoặc tổng số liệu không khớp trong tài liệu gốc',
    },
  },
  required: ['topics', 'warnings'],
};

/**
 * Chuẩn hóa tên định dạng câu hỏi từ dữ liệu AI trích xuất
 */
function normalizeMatrixQuestionType(rawType: any): QuestionType {
  const str = String(rawType || '').trim().toUpperCase();
  if (str === 'TRUE_FALSE' || str.includes('ĐÚNG') || str.includes('SAI') || str === 'TF') return 'TRUE_FALSE';
  if (str === 'SHORT_ANSWER' || str.includes('NGẮN') || str.includes('TRẢ LỜI NGẮN') || str === 'TLN') return 'SHORT_ANSWER';
  if (str === 'ESSAY' || str.includes('TỰ LUẬN') || str === 'TL') return 'ESSAY';
  if (str === 'MATCHING' || str.includes('GHÉP') || str.includes('NỐI')) return 'MATCHING';
  if (str === 'FILL_BLANK' || str.includes('ĐIỀN') || str.includes('KHUYẾT')) return 'FILL_BLANK';
  if (str === 'MCQ_MULTI' || str.includes('NHIỀU ĐÁP ÁN')) return 'MCQ_MULTI';
  // Ma trận chỉ ghi chung “Trắc nghiệm” hoặc "TN" thì mặc định MCQ4
  return 'MCQ4';
}

/**
 * Chuẩn hóa mức độ nhận thức
 */
function normalizeMatrixLevel(rawLevel: any): Level {
  const str = String(rawLevel || '').trim().toUpperCase();
  if (str === 'TH' || str.includes('THÔNG HIỂU')) return 'TH';
  if (str === 'VDC' || str.includes('CAO')) return 'VDC';
  if (str === 'VD' || str.includes('VẬN DỤNG')) return 'VD';
  return 'NB';
}

/**
 * ĐỌC MA TRẬN: hàm parseMatrix() gọi Gemini với responseSchema JSON và trả về:
 * { totalPoints?, totalQuestions?, topics: [{ name, requirement?, cells: [{ level ('NB'|'TH'|'VD'|'VDC'), questionType, count, points? }] }], warnings: string[] }
 * AI chỉ chuyển đổi nguyên trạng những gì ghi trong ma trận, không tự thêm, không tự sửa con số.
 * Ô nào không đọc chắc thì ghi vào warnings.
 */
export async function parseMatrix(
  input: ParseMatrixInput,
  abortSignal?: AbortSignal
): Promise<ParsedMatrix> {
  const systemInstruction = `Bạn là chuyên gia số hóa ma trận và bản đặc tả đề kiểm tra giáo dục tại Việt Nam theo chương trình GDPT 2018.

NHIỆM VỤ:
Đọc dữ liệu ma trận hoặc bản đặc tả đề kiểm tra từ tài liệu đính kèm (PDF, Word, Ảnh, TXT) hoặc bảng được sao chép/dán, chuyển đổi nguyên trạng sang định dạng JSON có cấu trúc.

NGUYÊN TẮC BẮT BUỘC:
1. CHUYỂN ĐỔI NGUYÊN TRẠNG: Chỉ trích xuất đúng những gì ghi trong ma trận. Tuyệt đối KHÔNG tự ý thêm câu, KHÔNG tự sửa các con số.
2. MÃ HÓA MỨC ĐỘ:
   - 'NB': Nhận biết
   - 'TH': Thông hiểu
   - 'VD': Vận dụng
   - 'VDC': Vận dụng cao
3. MÃ HÓA DẠNG CÂU:
   - Ma trận chỉ ghi chung "Trắc nghiệm", "TN", "Trắc nghiệm nhiều lựa chọn": Ghi là "MCQ4".
   - "Đúng/Sai", "Đúng - Sai": Ghi là "TRUE_FALSE".
   - "Trả lời ngắn": Ghi là "SHORT_ANSWER".
   - "Tự luận": Ghi là "ESSAY".
   - "Nối cột", "Ghép đôi": Ghi là "MATCHING".
   - "Điền từ", "Điền khuyết": Ghi là "FILL_BLANK".
4. SỐ LIỆU:
   - 'count': Số lượng câu hỏi của ô (số nguyên >= 0).
   - 'points': Tổng điểm của ô (nếu ma trận có ghi).
   - 'totalPoints': Tổng điểm toàn bài ghi trên ma trận (nếu có, ví dụ 10).
   - 'totalQuestions': Tổng số câu ghi trên ma trận (nếu có).
5. Ô NGHI NGỜ / KHÔNG ĐỌC CHẮC:
   - Nếu ô nào chữ mờ, số liệu không rõ ràng, viết tắt khó đoán, hoặc tổng số trong tài liệu bị lệch: BẮT BUỘC ghi rõ chi tiết vào mảng 'warnings'.`;

  const contents: any[] = [];

  // 1. Tải file nếu có (PDF hoặc ảnh base64, Word hoặc TXT dạng text)
  if (input.file) {
    if ((input.file.mimeType.startsWith('image/') || input.file.mimeType === 'application/pdf') && input.file.base64) {
      contents.push({
        text: `[Tài liệu ma trận đính kèm: ${input.file.name} - Định dạng: ${input.file.mimeType}]:`,
      });
      contents.push({
        inlineData: {
          mimeType: input.file.mimeType,
          data: input.file.base64,
        },
      });
    } else if (input.file.text) {
      contents.push({
        text: `[Nội dung văn bản ma trận đính kèm: ${input.file.name}]:\n\n${input.file.text}`,
      });
    }
  }

  // 2. Dán bảng ma trận nếu có
  if (input.text && input.text.trim()) {
    contents.push({
      text: `[Bảng ma trận đề kiểm tra được dán trực tiếp]:\n\n${input.text.trim()}`,
    });
  }

  contents.push({
    text: `Hãy trích xuất nguyên trạng toàn bộ các hàng chủ đề và ô phân bổ của ma trận trên sang JSON theo đúng cấu trúc.`,
  });

  const raw = await callGeminiJsonApi(
    systemInstruction,
    contents,
    abortSignal,
    MATRIX_RESPONSE_SCHEMA
  );

  const warnings: string[] = Array.isArray(raw?.warnings) ? raw.warnings.map(String) : [];
  const rawTopics: any[] = Array.isArray(raw?.topics) ? raw.topics : [];

  const topics: MatrixTopic[] = rawTopics.map((t: any, tIdx: number) => {
    const rawCells: any[] = Array.isArray(t?.cells) ? t.cells : [];
    const cells: MatrixCell[] = rawCells.map((c: any) => {
      const count = typeof c?.count === 'number' && !isNaN(c.count) ? Math.max(0, Math.round(c.count)) : 0;
      const points = typeof c?.points === 'number' && !isNaN(c.points) ? c.points : undefined;
      return {
        level: normalizeMatrixLevel(c?.level),
        questionType: normalizeMatrixQuestionType(c?.questionType),
        count,
        points,
      };
    });

    return {
      id: `topic_mat_${Date.now()}_${tIdx + 1}`,
      name: String(t?.name || `Chủ đề ${tIdx + 1}`).trim(),
      requirement: t?.requirement ? String(t.requirement).trim() : undefined,
      cells,
    };
  });

  return {
    totalPoints: typeof raw?.totalPoints === 'number' && !isNaN(raw.totalPoints) ? raw.totalPoints : undefined,
    totalQuestions: typeof raw?.totalQuestions === 'number' && !isNaN(raw.totalQuestions) ? Math.round(raw.totalQuestions) : undefined,
    topics,
    warnings,
  };
}

export interface GenerateIllustrationResponse {
  success: boolean;
  dataUrl?: string;
  error?: string;
  noPermission?: boolean;
}

/**
 * Gọi API backend sinh hình ảnh minh họa bằng AI (Gemini)
 * Chỉ dùng cho hình minh họa đơn giản (con vật, đồ vật, cảnh vật).
 * Sử dụng model GEMINI_IMAGE_MODEL được khai báo trong src/config.ts
 */
export async function generateAiIllustration(
  prompt: string,
  abortSignal?: AbortSignal
): Promise<GenerateIllustrationResponse> {
  try {
    const res = await fetch('/api/generate-ai-illustration', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt }),
      signal: abortSignal,
    });

    const data = await res.json();
    return data;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return { success: false, error: 'Đã hủy yêu cầu tạo ảnh.' };
    }
    return {
      success: false,
      error: err?.message || 'Không thể kết nối đến máy chủ để tạo ảnh.',
    };
  }
}


