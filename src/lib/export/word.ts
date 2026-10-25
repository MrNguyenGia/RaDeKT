import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  Footer,
  PageNumber,
  PageBreak,
  ImportedXmlComponent,
  ImageRun,
  HeadingLevel,
  PageOrientation,
} from 'docx';
import { Exam, ExamConfig, Question } from '../../types';
import { ExportOptions, ResolvedVersionData } from './types';
import {
  convertLatexToOmml,
  convertLatexToPngBlob,
  generateExportFileName,
  parseMathTokens,
  resolveTargetVersions,
} from './utils';
import { QUESTION_TYPE_LABELS, LEVEL_LABELS, formatSchoolNameForHeader, getDefaultAcademicYear } from '../../config';
import { figureToSvg } from '../figureRenderer';
import { getQuestionErrorNote } from '../validate';

const FONT_NAME = 'Times New Roman';
const BASE_FONT_SIZE = 26; // 13pt trong docx (đơn vị half-points: 13 * 2 = 26)
const SMALL_FONT_SIZE = 22; // 11pt

const NO_BORDER = {
  style: BorderStyle.NONE,
  size: 0,
  color: 'auto',
};

const TABLE_THIN_BORDER = {
  style: BorderStyle.SINGLE,
  size: 4, // 0.5pt
  color: '999999',
};

export interface WordExportResult {
  blob: Blob;
  fileName: string;
  warnings: string[];
}

/**
 * Chuyển SVG sang ảnh PNG Uint8Array bằng HTML5 Canvas ở độ phân giải gấp 2 lần (2x)
 */
async function convertSvgToPngBuffer(
  svgString: string,
  widthPercent: number = 80
): Promise<{ data: Uint8Array; width: number; height: number } | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;

  return new Promise((resolve) => {
    try {
      const vbMatch = svgString.match(/viewBox=["']\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)["']/i);
      let baseWidth = 360;
      let baseHeight = 240;
      if (vbMatch) {
        baseWidth = parseFloat(vbMatch[3]) || 360;
        baseHeight = parseFloat(vbMatch[4]) || 240;
      }

      // Giới hạn chiều rộng trang A4 lề chuẩn (khoảng 460pt)
      const pageContentWidth = 460;
      const targetDocxWidth = Math.max(120, Math.min(pageContentWidth, Math.round((pageContentWidth * widthPercent) / 100)));
      const targetDocxHeight = Math.round((baseHeight / baseWidth) * targetDocxWidth);

      // Vẽ lên canvas ở độ phân giải gấp 2 lần (scale = 2) cho nét căng
      const scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(targetDocxWidth * scale);
      canvas.height = Math.round(targetDocxHeight * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const svgBase64 = btoa(unescape(encodeURIComponent(svgString)));
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        const base64Data = dataUrl.split(',')[1];
        if (!base64Data) {
          resolve(null);
          return;
        }
        const binary = atob(base64Data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        resolve({ data: bytes, width: targetDocxWidth, height: targetDocxHeight });
      };
      img.onerror = () => resolve(null);
      img.src = `data:image/svg+xml;base64,${svgBase64}`;
    } catch {
      resolve(null);
    }
  });
}

/**
 * Chuyển imageData dataUrl sang PNG/JPEG Buffer cho ImageRun docx với đúng độ rộng
 */
async function convertImageDataToBuffer(
  imageData: { dataUrl: string; widthPercent?: number; caption?: string }
): Promise<{ data: Uint8Array; width: number; height: number; caption?: string } | null> {
  if (typeof window === 'undefined') return null;

  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        const pageContentWidth = 460;
        const widthPct = Math.min(100, Math.max(20, imageData.widthPercent ?? 80));
        const targetWidth = Math.max(100, Math.min(pageContentWidth, Math.round((pageContentWidth * widthPct) / 100)));
        const aspectRatio = (img.height || 1) / (img.width || 1);
        const targetHeight = Math.round(targetWidth * aspectRatio);

        const base64Data = imageData.dataUrl.split(',')[1];
        if (!base64Data) {
          resolve(null);
          return;
        }
        const binary = atob(base64Data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        resolve({
          data: bytes,
          width: targetWidth,
          height: targetHeight,
          caption: imageData.caption,
        });
      };
      img.onerror = () => resolve(null);
      img.src = imageData.dataUrl;
    } catch {
      resolve(null);
    }
  });
}

/**
 * Sinh danh sách Paragraphs cho hình ảnh của câu hỏi (đặt giữa dòng, đúng độ rộng đã chọn)
 */
async function createQuestionImageParagraphs(
  q: Question,
  globalIdx: number,
  warnings: string[]
): Promise<Paragraph[]> {
  const paragraphs: Paragraph[] = [];

  // 1. Ưu tiên imageData do giáo viên chèn
  if (q.imageData?.dataUrl) {
    try {
      const imgRes = await convertImageDataToBuffer(q.imageData);
      if (imgRes) {
        paragraphs.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 80, after: imgRes.caption ? 30 : 80 },
            children: [
              new ImageRun({
                data: imgRes.data,
                type: 'png',
                transformation: { width: imgRes.width, height: imgRes.height },
              }),
            ],
          })
        );
        if (imgRes.caption && imgRes.caption.trim().length > 0) {
          paragraphs.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 20, after: 80 },
              children: [
                new TextRun({
                  text: imgRes.caption.trim(),
                  italics: true,
                  size: SMALL_FONT_SIZE - 4, // ~9pt
                  color: '475569',
                }),
              ],
            })
          );
        }
        return paragraphs;
      }
    } catch (err: any) {
      warnings.push(`Không thể chèn ảnh giáo viên cho Câu ${globalIdx}: ${err?.message}`);
    }
  }

  // 2. Không có imageData -> Xử lý figure (SVG) hoặc svgDiagram: chuyển thành PNG qua Canvas 2x
  const effectiveSvg = q.figure ? figureToSvg(q.figure) : (q.svgDiagram?.trim() || '');
  if (effectiveSvg && effectiveSvg.length > 0) {
    try {
      const pngRes = await convertSvgToPngBuffer(effectiveSvg, 80);
      if (pngRes) {
        paragraphs.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 80, after: 80 },
            children: [
              new ImageRun({
                data: pngRes.data,
                type: 'png',
                transformation: { width: pngRes.width, height: pngRes.height },
              }),
            ],
          })
        );
        return paragraphs;
      }
    } catch (diagErr: any) {
      warnings.push(`Không thể chèn hình vẽ cho Câu ${globalIdx}: ${diagErr?.message}`);
    }
  }

  return paragraphs;
}

/**
 * Tạo danh sách Runs (TextRun / ImportedXmlComponent / ImageRun) từ chuỗi có công thức toán
 */
async function createRunsFromText(
  text: string,
  options: {
    bold?: boolean;
    italics?: boolean;
    size?: number;
    formulaMode: 'OMML' | 'PNG';
    warnings: string[];
  }
): Promise<(TextRun | ImportedXmlComponent | ImageRun)[]> {
  const tokens = parseMathTokens(text);
  const size = options.size || BASE_FONT_SIZE;

  const runArrays = await Promise.all(
    tokens.map(async (token): Promise<(TextRun | ImportedXmlComponent | ImageRun)[]> => {
      if (token.type === 'text') {
        return [
          new TextRun({
            text: token.content,
            font: FONT_NAME,
            size,
            bold: options.bold,
            italics: options.italics,
          }),
        ];
      }

      // Công thức toán LaTeX
      if (options.formulaMode === 'OMML') {
        const { omml, error } = convertLatexToOmml(token.content, token.displayMode);
        if (omml) {
          try {
            const parsed = ImportedXmlComponent.fromXmlString(omml);
            if (parsed) {
              if ((parsed as any).rootKey === undefined && Array.isArray((parsed as any).root)) {
                return (parsed as any).root;
              }
              return [parsed];
            }
          } catch (e: any) {
            options.warnings.push(`Lỗi chèn OMML: ${e?.message || 'Không xác định'}`);
          }
        } else if (error) {
          options.warnings.push(`Cảnh báo công thức "$${token.content}$": ${error}. Tự động dùng ảnh PNG thay thế.`);
        }

        // Tự động chuyển sang ảnh PNG nếu OMML bị lỗi
        const png = await convertLatexToPngBlob(token.content, token.displayMode);
        if (png) {
          const buffer = await png.blob.arrayBuffer();
          return [
            new ImageRun({
              data: new Uint8Array(buffer),
              type: 'png',
              transformation: {
                width: png.width,
                height: png.height,
              },
            }),
          ];
        }

        // Nếu cả PNG cũng không tạo được, hiển thị công thức thô
        return [
          new TextRun({
            text: `$${token.content}$`,
            font: FONT_NAME,
            size,
            italics: true,
          }),
        ];
      }

      // Chế độ Ảnh PNG
      const png = await convertLatexToPngBlob(token.content, token.displayMode);
      if (png) {
        const buffer = await png.blob.arrayBuffer();
        return [
          new ImageRun({
            data: new Uint8Array(buffer),
            type: 'png',
            transformation: {
              width: png.width,
              height: png.height,
            },
          }),
        ];
      }

      return [
        new TextRun({
          text: `$${token.content}$`,
          font: FONT_NAME,
          size,
          italics: true,
        }),
      ];
    })
  );

  return runArrays.flat();
}

/**
 * Tạo bảng đầu đề chuẩn Bộ Giáo dục và Đào tạo 2 cột
 */
function createHeaderTable(config: ExamConfig, versionCode: string): Table {
  const departmentText = (config.departmentName?.trim() || 'SỞ GIÁO DỤC VÀ ĐÀO TẠO').toUpperCase();
  const schoolText = formatSchoolNameForHeader(config.schoolName);
  const examTitleText = (config.title?.trim() || 'ĐỀ KIỂM TRA ĐỊNH KỲ').toUpperCase();
  const subjectText = `MÔN: ${(config.customSubject?.trim() || config.subject || 'MÔN HỌC').toUpperCase()}${
    config.grade ? ` – KHỐI ${config.grade}` : ''
  }`;
  const durationText = `Thời gian làm bài: ${config.durationMinutes || 45} phút (không kể thời gian phát đề)`;
  const yearText = `Năm học: ${config.academicYear || getDefaultAcademicYear()}`;

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: NO_BORDER,
      bottom: NO_BORDER,
      left: NO_BORDER,
      right: NO_BORDER,
      insideHorizontal: NO_BORDER,
      insideVertical: NO_BORDER,
    },
    rows: [
      new TableRow({
        children: [
          // Cột trái: Sở / Phòng & Trường
          new TableCell({
            width: { size: 45, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: departmentText,
                    font: FONT_NAME,
                    size: 22,
                    bold: true,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: schoolText,
                    font: FONT_NAME,
                    size: 24,
                    bold: true,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: yearText,
                    font: FONT_NAME,
                    size: 20,
                    italics: true,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: '------------------',
                    font: FONT_NAME,
                    size: 18,
                  }),
                ],
              }),
            ],
          }),

          // Cột phải: Tên đề, Môn, Thời gian & Mã đề
          new TableCell({
            width: { size: 55, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: examTitleText,
                    font: FONT_NAME,
                    size: 26,
                    bold: true,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: subjectText,
                    font: FONT_NAME,
                    size: 24,
                    bold: true,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: durationText,
                    font: FONT_NAME,
                    size: 22,
                    italics: true,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { before: 80 },
                children: [
                  new TextRun({
                    text: `Mã đề thi: ${versionCode}`,
                    font: FONT_NAME,
                    size: 24,
                    bold: true,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

/**
 * Bảng thông tin thí sinh & ô chấm điểm
 */
function createStudentInfoTable(): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: TABLE_THIN_BORDER,
      bottom: TABLE_THIN_BORDER,
      left: TABLE_THIN_BORDER,
      right: TABLE_THIN_BORDER,
      insideHorizontal: TABLE_THIN_BORDER,
      insideVertical: TABLE_THIN_BORDER,
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 70, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: 'Họ và tên thí sinh: ............................................................................', font: FONT_NAME, size: 22 }),
                ],
              }),
              new Paragraph({
                spacing: { before: 80 },
                children: [
                  new TextRun({ text: 'Lớp: .................................. Số báo danh (SBD): .................................', font: FONT_NAME, size: 22 }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: 'ĐIỂM / LỜI PHÊ CỦA THẦY CÔ', font: FONT_NAME, size: 20, bold: true }),
                ],
              }),
              new Paragraph({
                spacing: { before: 180 },
                children: [new TextRun({ text: '' })],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

/**
 * Tạo tài liệu Word .docx từ cấu hình và các tùy chọn xuất bản
 */
export async function exportExamToWord(
  exam: Exam,
  config: ExamConfig,
  options: ExportOptions
): Promise<WordExportResult> {
  const warnings: string[] = [];
  const targetVersions = resolveTargetVersions(exam, options.selectedVersionCode);
  const sectionsChildren: (Paragraph | Table)[] = [];

  // =========================================================================
  // 1. XUẤT ĐỀ THI CHO TỪNG MÃ ĐỀ ĐƯỢC CHỌN
  // =========================================================================
  if (options.includeExam) {
    for (let vIdx = 0; vIdx < targetVersions.length; vIdx++) {
      const v = targetVersions[vIdx];
      
      // Ngắt trang nếu không phải mã đề đầu tiên
      if (vIdx > 0) {
        sectionsChildren.push(
          new Paragraph({
            children: [new PageBreak()],
          })
        );
      }

      // Đầu đề
      sectionsChildren.push(createHeaderTable(config, v.code));
      sectionsChildren.push(
        new Paragraph({
          spacing: { before: 120, after: 120 },
          children: [],
        })
      );
      sectionsChildren.push(createStudentInfoTable());
      sectionsChildren.push(
        new Paragraph({
          spacing: { before: 180, after: 120 },
          children: [
            new TextRun({
              text: '(Thí sinh không được sử dụng tài liệu. Cán bộ coi thi không giải thích gì thêm)',
              font: FONT_NAME,
              size: 20,
              italics: true,
            }),
          ],
        })
      );

      // Phân tách Trắc nghiệm và Tự luận
      const objectiveQs = v.questions.filter((q) => q.type !== 'ESSAY');
      const essayQs = v.questions.filter((q) => q.type === 'ESSAY');

      // PHẦN I: TRẮC NGHIỆM
      if (objectiveQs.length > 0) {
        sectionsChildren.push(
          new Paragraph({
            spacing: { before: 160, after: 100 },
            children: [
              new TextRun({
                text: 'PHẦN I. CÂU HỎI TRẮC NGHIỆM',
                font: FONT_NAME,
                size: 24,
                bold: true,
              }),
            ],
          })
        );

        for (let qIdx = 0; qIdx < objectiveQs.length; qIdx++) {
          const q = objectiveQs[qIdx];
          const globalIdx = v.questions.findIndex((item) => item.id === q.id) + 1;
          const scoreText = q.score ? ` (${q.score.toFixed(2)} điểm)` : '';

          const draftNote = options.isDraft ? getQuestionErrorNote(q) : null;
          const draftRuns = draftNote
            ? [
                new TextRun({
                  text: ` [CẦN KIỂM TRA: ${draftNote}]`,
                  font: FONT_NAME,
                  size: BASE_FONT_SIZE,
                  bold: true,
                  color: 'E11D48',
                }),
              ]
            : [];

          sectionsChildren.push(
            new Paragraph({
              spacing: { before: 120, after: 60 },
              children: [
                new TextRun({
                  text: `Câu ${globalIdx}${scoreText}: `,
                  font: FONT_NAME,
                  size: BASE_FONT_SIZE,
                  bold: true,
                }),
                ...(await createRunsFromText(q.question, {
                  formulaMode: options.formulaMode,
                  warnings,
                })),
                ...draftRuns,
              ],
            })
          );

          // Nếu câu hỏi có hình vẽ / ảnh minh họa (ưu tiên imageData, hoặc figure chuyển thành PNG 2x)
          const imageParas = await createQuestionImageParagraphs(q, globalIdx, warnings);
          sectionsChildren.push(...imageParas);

          // Các phương án MCQ4 / MCQ_MULTI
          if (q.options && q.options.length > 0) {
            for (const opt of q.options) {
              const optRuns = await createRunsFromText(opt, {
                formulaMode: options.formulaMode,
                warnings,
              });
              sectionsChildren.push(
                new Paragraph({
                  indent: { left: 400 },
                  spacing: { before: 40, after: 40 },
                  children: optRuns,
                })
              );
            }
          }

          // Các ý Đúng / Sai CLUSTER4
          if (q.statements && q.statements.length > 0) {
            for (const st of q.statements) {
              const stRuns = await createRunsFromText(`${st.id}) ${st.statement}`, {
                formulaMode: options.formulaMode,
                warnings,
              });
              sectionsChildren.push(
                new Paragraph({
                  indent: { left: 400 },
                  spacing: { before: 40, after: 40 },
                  children: stRuns,
                })
              );
            }
          }

          // Ghép nối
          if (q.pairs && q.pairs.length > 0) {
            for (let pIdx = 0; pIdx < q.pairs.length; pIdx++) {
              const p = q.pairs[pIdx];
              const pairText = `${pIdx + 1}. ${p.left}  ---  ${String.fromCharCode(65 + pIdx)}. ${p.right}`;
              const pRuns = await createRunsFromText(pairText, {
                formulaMode: options.formulaMode,
                warnings,
              });
              sectionsChildren.push(
                new Paragraph({
                  indent: { left: 400 },
                  spacing: { before: 40, after: 40 },
                  children: pRuns,
                })
              );
            }
          }
        }
      }

      // PHẦN II: TỰ LUẬN
      if (essayQs.length > 0) {
        sectionsChildren.push(
          new Paragraph({
            spacing: { before: 200, after: 100 },
            children: [
              new TextRun({
                text: 'PHẦN II. CÂU HỎI TỰ LUẬN',
                font: FONT_NAME,
                size: 24,
                bold: true,
              }),
            ],
          })
        );

        for (let qIdx = 0; qIdx < essayQs.length; qIdx++) {
          const q = essayQs[qIdx];
          const globalIdx = v.questions.findIndex((item) => item.id === q.id) + 1;
          const scoreText = q.score ? ` (${q.score.toFixed(2)} điểm)` : '';

          const draftNote = options.isDraft ? getQuestionErrorNote(q) : null;
          const draftRuns = draftNote
            ? [
                new TextRun({
                  text: ` [CẦN KIỂM TRA: ${draftNote}]`,
                  font: FONT_NAME,
                  size: BASE_FONT_SIZE,
                  bold: true,
                  color: 'E11D48',
                }),
              ]
            : [];

          sectionsChildren.push(
            new Paragraph({
              spacing: { before: 140, after: 60 },
              children: [
                new TextRun({
                  text: `Câu ${globalIdx}${scoreText}: `,
                  font: FONT_NAME,
                  size: BASE_FONT_SIZE,
                  bold: true,
                }),
                ...(await createRunsFromText(q.question, {
                  formulaMode: options.formulaMode,
                  warnings,
                })),
                ...draftRuns,
              ],
            })
          );

          // Nếu câu tự luận có hình vẽ / ảnh minh họa (ưu tiên imageData, hoặc figure chuyển thành PNG 2x)
          const essayImageParas = await createQuestionImageParagraphs(q, globalIdx, warnings);
          sectionsChildren.push(...essayImageParas);
        }
      }

      // Hết đề
      sectionsChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 240, after: 120 },
          children: [
            new TextRun({
              text: '-------------------------- HẾT --------------------------',
              font: FONT_NAME,
              size: 22,
              bold: true,
            }),
          ],
        })
      );

      // Tùy chọn in kèm dòng thông tin AI hỗ trợ
      if (options.includeAiNotice) {
        sectionsChildren.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 60 },
            children: [
              new TextRun({
                text: 'Đề thi được biên soạn với sự hỗ trợ của Hệ thống Sinh Đề GDPT 2018 (Google Gemini AI).',
                font: FONT_NAME,
                size: 18,
                italics: true,
              }),
            ],
          })
        );
      }
    }
  }

  // =========================================================================
  // 2. XUẤT ĐÁP ÁN (ANSWERS)
  // =========================================================================
  if (options.includeAnswers) {
    for (let vIdx = 0; vIdx < targetVersions.length; vIdx++) {
      const v = targetVersions[vIdx];

      sectionsChildren.push(
        new Paragraph({
          children: [new PageBreak()],
        })
      );

      sectionsChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 100, after: 140 },
          children: [
            new TextRun({
              text: `ĐÁP ÁN VÀ LỜI GIẢI CHI TIẾT – MÃ ĐỀ: ${v.code}`,
              font: FONT_NAME,
              size: 26,
              bold: true,
            }),
          ],
        })
      );

      // Bảng đáp án nhanh trắc nghiệm
      const objQs = v.questions.filter((q) => q.type !== 'ESSAY');
      if (objQs.length > 0) {
        const rows: TableRow[] = [];
        // Header
        rows.push(
          new TableRow({
            children: [
              new TableCell({
                width: { size: 20, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: 'Câu số', font: FONT_NAME, size: 22, bold: true })],
                  }),
                ],
              }),
              new TableCell({
                width: { size: 30, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: 'Dạng câu', font: FONT_NAME, size: 22, bold: true })],
                  }),
                ],
              }),
              new TableCell({
                width: { size: 30, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: 'Đáp án đúng', font: FONT_NAME, size: 22, bold: true })],
                  }),
                ],
              }),
              new TableCell({
                width: { size: 20, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: 'Điểm', font: FONT_NAME, size: 22, bold: true })],
                  }),
                ],
              }),
            ],
          })
        );

        // Data rows
        for (const q of objQs) {
          const idx = v.questions.findIndex((item) => item.id === q.id) + 1;
          rows.push(
            new TableRow({
              children: [
                new TableCell({
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [new TextRun({ text: `Câu ${idx}`, font: FONT_NAME, size: 22 })],
                    }),
                  ],
                }),
                new TableCell({
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new TextRun({
                          text: QUESTION_TYPE_LABELS[q.type]?.short || q.type,
                          font: FONT_NAME,
                          size: 20,
                        }),
                      ],
                    }),
                  ],
                }),
                new TableCell({
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new TextRun({
                          text: q.correctAnswer || '-',
                          font: FONT_NAME,
                          size: 22,
                          bold: true,
                        }),
                      ],
                    }),
                  ],
                }),
                new TableCell({
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [new TextRun({ text: `${q.score.toFixed(2)}đ`, font: FONT_NAME, size: 22 })],
                    }),
                  ],
                }),
              ],
            })
          );
        }

        sectionsChildren.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: TABLE_THIN_BORDER,
              bottom: TABLE_THIN_BORDER,
              left: TABLE_THIN_BORDER,
              right: TABLE_THIN_BORDER,
              insideHorizontal: TABLE_THIN_BORDER,
              insideVertical: TABLE_THIN_BORDER,
            },
            rows,
          })
        );
      }

      // Lời giải chi tiết
      sectionsChildren.push(
        new Paragraph({
          spacing: { before: 180, after: 100 },
          children: [
            new TextRun({
              text: 'LỜI GIẢI CHI TIẾT TỪNG CÂU:',
              font: FONT_NAME,
              size: 24,
              bold: true,
            }),
          ],
        })
      );

      for (let qIdx = 0; qIdx < v.questions.length; qIdx++) {
        const q = v.questions[qIdx];
        if (!q.explanation && !q.correctAnswer) continue;

        const qRuns = await createRunsFromText(q.explanation || 'Không có lời giải chi tiết', {
          formulaMode: options.formulaMode,
          warnings,
        });

        sectionsChildren.push(
          new Paragraph({
            spacing: { before: 100, after: 40 },
            children: [
              new TextRun({
                text: `Câu ${qIdx + 1} (Đáp án: ${q.correctAnswer || '-'}): `,
                font: FONT_NAME,
                size: BASE_FONT_SIZE,
                bold: true,
              }),
              ...qRuns,
            ],
          })
        );
      }
    }
  }

  // =========================================================================
  // 3. XUẤT HƯỚNG DẪN CHẤM (SCORING GUIDE)
  // =========================================================================
  if (options.includeScoring) {
    sectionsChildren.push(
      new Paragraph({
        children: [new PageBreak()],
      })
    );

    sectionsChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 100, after: 140 },
        children: [
          new TextRun({
            text: 'HƯỚNG DẪN CHẤM VÀ THANG BIỂU ĐIỂM',
            font: FONT_NAME,
            size: 26,
            bold: true,
          }),
        ],
      })
    );

    const firstVersion = targetVersions[0] || { code: '101', questions: exam.questions };
    for (let qIdx = 0; qIdx < firstVersion.questions.length; qIdx++) {
      const q = firstVersion.questions[qIdx];
      const guideRuns = await createRunsFromText(
        q.scoringGuide || q.explanation || `Đúng đáp án ${q.correctAnswer}: ${q.score.toFixed(2)} điểm`,
        { formulaMode: options.formulaMode, warnings }
      );

      sectionsChildren.push(
        new Paragraph({
          spacing: { before: 100, after: 40 },
          children: [
            new TextRun({
              text: `Câu ${qIdx + 1} (${q.score.toFixed(2)}đ): `,
              font: FONT_NAME,
              size: BASE_FONT_SIZE,
              bold: true,
            }),
            ...guideRuns,
          ],
        })
      );
    }
  }

  // =========================================================================
  // 4. XUẤT MA TRẬN & BẢN ĐẶC TẢ
  // =========================================================================
  if (options.includeMatrix || options.includeSpec) {
    sectionsChildren.push(
      new Paragraph({
        children: [new PageBreak()],
      })
    );

    if (options.includeMatrix) {
      sectionsChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 100, after: 120 },
          children: [
            new TextRun({
              text: 'MA TRẬN ĐỀ KIỂM TRA ĐỊNH KỲ',
              font: FONT_NAME,
              size: 26,
              bold: true,
            }),
          ],
        })
      );

      // Bảng thông tin ma trận tóm tắt
      const matrixRows: TableRow[] = [
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'STT', font: FONT_NAME, size: 22, bold: true })],
                }),
              ],
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'Chủ đề / Đơn vị kiến thức', font: FONT_NAME, size: 22, bold: true })],
                }),
              ],
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'Nhận biết', font: FONT_NAME, size: 22, bold: true })],
                }),
              ],
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'Thông hiểu', font: FONT_NAME, size: 22, bold: true })],
                }),
              ],
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'Vận dụng', font: FONT_NAME, size: 22, bold: true })],
                }),
              ],
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'Vận dụng cao', font: FONT_NAME, size: 22, bold: true })],
                }),
              ],
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'Tổng câu / Điểm', font: FONT_NAME, size: 22, bold: true })],
                }),
              ],
            }),
          ],
        }),
      ];

      // Thêm dòng dữ liệu từ blueprint
      const bp = exam.blueprint || [];
      const topicMap = new Map<string, { NB: number; TH: number; VD: number; VDC: number; totalScore: number }>();

      bp.forEach((slot) => {
        const topic = slot.topic || 'Kiến thức trọng tâm';
        if (!topicMap.has(topic)) {
          topicMap.set(topic, { NB: 0, TH: 0, VD: 0, VDC: 0, totalScore: 0 });
        }
        const data = topicMap.get(topic)!;
        data[slot.level]++;
        data.totalScore += slot.score;
      });

      let stt = 1;
      topicMap.forEach((val, topic) => {
        const totalCount = val.NB + val.TH + val.VD + val.VDC;
        matrixRows.push(
          new TableRow({
            children: [
              new TableCell({
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(stt++), font: FONT_NAME, size: 22 })] })],
              }),
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: topic, font: FONT_NAME, size: 22 })] })],
              }),
              new TableCell({
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(val.NB || '-'), font: FONT_NAME, size: 22 })] })],
              }),
              new TableCell({
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(val.TH || '-'), font: FONT_NAME, size: 22 })] })],
              }),
              new TableCell({
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(val.VD || '-'), font: FONT_NAME, size: 22 })] })],
              }),
              new TableCell({
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(val.VDC || '-'), font: FONT_NAME, size: 22 })] })],
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: `${totalCount} câu (${val.totalScore.toFixed(2)}đ)`, font: FONT_NAME, size: 22, bold: true })],
                  }),
                ],
              }),
            ],
          })
        );
      });

      sectionsChildren.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: TABLE_THIN_BORDER,
            bottom: TABLE_THIN_BORDER,
            left: TABLE_THIN_BORDER,
            right: TABLE_THIN_BORDER,
            insideHorizontal: TABLE_THIN_BORDER,
            insideVertical: TABLE_THIN_BORDER,
          },
          rows: matrixRows,
        })
      );
    }

    if (options.includeSpec) {
      sectionsChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 120 },
          children: [
            new TextRun({
              text: 'BẢN ĐẶC TẢ MA TRẬN ĐỀ KIỂM TRA',
              font: FONT_NAME,
              size: 26,
              bold: true,
            }),
          ],
        })
      );

      const bp = exam.blueprint || [];
      const specRows: TableRow[] = [
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Câu số', font: FONT_NAME, size: 22, bold: true })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Đơn vị kiến thức', font: FONT_NAME, size: 22, bold: true })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Mức độ', font: FONT_NAME, size: 22, bold: true })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Dạng câu', font: FONT_NAME, size: 22, bold: true })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Yêu cầu cần đạt / Tiêu chí đánh giá', font: FONT_NAME, size: 22, bold: true })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Điểm', font: FONT_NAME, size: 22, bold: true })] })] }),
          ],
        }),
      ];

      bp.forEach((slot, idx) => {
        specRows.push(
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Câu ${idx + 1}`, font: FONT_NAME, size: 22 })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: slot.topic || 'Kiến thức trọng tâm', font: FONT_NAME, size: 22 })] })] }),
              new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: LEVEL_LABELS[slot.level]?.short || slot.level, font: FONT_NAME, size: 22 })] })] }),
              new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: QUESTION_TYPE_LABELS[slot.questionType]?.short || slot.questionType, font: FONT_NAME, size: 22 })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: slot.learningOutcome || 'Chuẩn kiến thức, kỹ năng theo chương trình GDPT 2018', font: FONT_NAME, size: 22 })] })] }),
              new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${slot.score.toFixed(2)}đ`, font: FONT_NAME, size: 22 })] })] }),
            ],
          })
        );
      });

      sectionsChildren.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: TABLE_THIN_BORDER,
            bottom: TABLE_THIN_BORDER,
            left: TABLE_THIN_BORDER,
            right: TABLE_THIN_BORDER,
            insideHorizontal: TABLE_THIN_BORDER,
            insideVertical: TABLE_THIN_BORDER,
          },
          rows: specRows,
        })
      );
    }
  }

  // Khổ A4, lề trái 25mm (1417 dxa), phải 15mm (850 dxa), trên 20mm (1134 dxa), dưới 20mm (1134 dxa)
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1134,
              bottom: 1134,
              left: 1417,
              right: 850,
            },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: 'Trang ',
                    font: FONT_NAME,
                    size: SMALL_FONT_SIZE,
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font: FONT_NAME,
                    size: SMALL_FONT_SIZE,
                  }),
                  new TextRun({
                    text: ' / ',
                    font: FONT_NAME,
                    size: SMALL_FONT_SIZE,
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    font: FONT_NAME,
                    size: SMALL_FONT_SIZE,
                  }),
                ],
              }),
            ],
          }),
        },
        children: sectionsChildren,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const fileName = generateExportFileName(exam, config, options.selectedVersionCode, 'docx');

  return {
    blob,
    fileName,
    warnings,
  };
}

/**
 * Tải file Word đã tạo về máy tính người dùng
 */
export function triggerFileDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
