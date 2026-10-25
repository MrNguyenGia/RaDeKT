import katex from 'katex';
import { Exam, ExamConfig, Question } from '../../types';
import { ExportOptions } from './types';
import { resolveTargetVersions } from './utils';
import {
  QUESTION_TYPE_LABELS,
  LEVEL_LABELS,
  formatSchoolNameForHeader,
  formatDepartmentForHeader,
  getDefaultAcademicYear,
  formatScore,
} from '../../config';
import { figureToSvg } from '../figureRenderer';
import { getQuestionErrorNote } from '../validate';

const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

const SECTION_TYPE_CONFIG: { type: Question['type']; title: string }[] = [
  { type: 'MCQ4', title: 'TRẮC NGHIỆM NHIỀU LỰA CHỌN' },
  { type: 'TRUE_FALSE', title: 'TRẮC NGHIỆM ĐÚNG – SAI' },
  { type: 'SHORT_ANSWER', title: 'TRẢ LỜI NGẮN' },
  { type: 'MATCHING', title: 'GHÉP NỐI' },
  { type: 'FILL_BLANK', title: 'ĐIỀN KHUYẾT' },
  { type: 'MCQ_MULTI', title: 'TRẮC NGHIỆM NHIỀU ĐÁP ÁN ĐÚNG' },
  { type: 'ESSAY', title: 'TỰ LUẬN' },
];

function getOptionsGridColCount(options: string[]): number {
  const cleanLengths = options.map((opt) => opt.replace(/^[A-D]\.\s*/i, '').trim().length);
  const maxLen = Math.max(...cleanLengths, 0);
  if (maxLen <= 20) return 4;
  if (maxLen <= 45) return 2;
  return 1;
}

/**
 * Tạo phiên bản HTML sạch (dùng inline style Times New Roman 13pt, bảng viền rõ) để dán vào Word chuẩn xác
 */
export function buildCleanExportHtml(
  exam: Exam,
  config: ExamConfig,
  options: ExportOptions
): string {
  const targetVersions = resolveTargetVersions(exam, options.selectedVersionCode);
  const sectionsHtml: string[] = [];

  const fontStyle = "font-family: 'Times New Roman', Tinos, 'Liberation Serif', serif; font-size: 13pt; line-height: 1.3; color: #000000; text-align: justify;";
  const tableStyle = "border-collapse: collapse; width: 100%; margin: 8pt 0; font-family: 'Times New Roman', Tinos, serif;";
  const cellStyle = "border: 0.75pt solid #000000; padding: 4pt 6pt; font-size: 11pt; vertical-align: top;";
  const headerCellStyle = "border: none; padding: 2pt 4pt; vertical-align: top;";

  // Hàm chuyển text có KaTeX sang HTML inline
  const renderFormulaHtml = (text?: string): string => {
    if (!text) return '';
    return text.replace(/(\$\$[\s\S]*?\$\$|\$[^\$\n]+?\$)/g, (match) => {
      const isDisplay = match.startsWith('$$');
      const formula = isDisplay ? match.slice(2, -2).trim() : match.slice(1, -1).trim();
      try {
        return katex.renderToString(formula, {
          output: 'htmlAndMathml',
          throwOnError: false,
          strict: 'ignore',
          trust: true,
          displayMode: isDisplay,
        });
      } catch {
        return `<em>${match}</em>`;
      }
    });
  };

  const renderQuestionImageHtmlForCopy = (q: Question): string => {
    if (q.imageData?.dataUrl) {
      const widthPct = Math.min(70, Math.max(20, q.imageData.widthPercent ?? 70));
      const captionHtml =
        q.imageData.caption && q.imageData.caption.trim().length > 0
          ? `<p style="text-align: center; font-style: italic; font-size: 11pt; color: #000; margin: 3pt 0 0 0;">${q.imageData.caption.trim()}</p>`
          : '';
      return `
        <div style="text-align: center; margin: 8pt 0; page-break-inside: avoid;">
          <img src="${q.imageData.dataUrl}" alt="Hình vẽ" style="max-width: ${widthPct}%; width: ${widthPct}%; height: auto; display: inline-block; margin: 0 auto;" />
          ${captionHtml}
        </div>
      `;
    }

    const figSvg = q.figure
      ? figureToSvg(q.figure)
      : q.svgDiagram && q.svgDiagram.trim().startsWith('<svg')
      ? q.svgDiagram
      : '';

    if (figSvg) {
      const isTable = q.figure?.kind === 'variation-table' || q.figure?.kind === 'sign-table';
      const maxW = isTable ? '100%' : '70%';
      const captionText = (q.figure as any)?.caption;
      const captionHtml =
        captionText && captionText.trim().length > 0
          ? `<p style="text-align: center; font-style: italic; font-size: 11pt; color: #000; margin: 3pt 0 0 0;">${captionText.trim()}</p>`
          : '';
      try {
        const b64 = btoa(unescape(encodeURIComponent(figSvg)));
        const dataUrl = `data:image/svg+xml;base64,${b64}`;
        return `
          <div style="text-align: center; margin: 8pt auto; max-width: ${maxW}; page-break-inside: avoid;">
            <img src="${dataUrl}" alt="Hình vẽ" style="max-width: 100%; width: auto; height: auto; display: inline-block; margin: 0 auto;" />
            ${captionHtml}
          </div>
        `;
      } catch {
        return `<div style="text-align: center; margin: 8pt auto; max-width: ${maxW};">${figSvg}${captionHtml}</div>`;
      }
    }

    return '';
  };

  // 1. Đề thi
  if (options.includeExam) {
    for (let vIdx = 0; vIdx < targetVersions.length; vIdx++) {
      const v = targetVersions[vIdx];
      const pageBreakStyle = vIdx > 0 ? 'page-break-before: always; margin-top: 24pt;' : '';

      const dept = config.departmentName?.trim()
        ? formatDepartmentForHeader(config.departmentName)
        : 'SỞ GIÁO DỤC VÀ ĐÀO TẠO …………………';

      const school = config.schoolName?.trim()
        ? formatSchoolNameForHeader(config.schoolName)
        : 'TRƯỜNG: …………………………………';

      const title = (exam.title?.trim() || config.title?.trim() || 'ĐỀ KIỂM TRA ĐỊNH KỲ').toUpperCase();
      const subject = (config.customSubject?.trim() || config.subject || 'MÔN HỌC').toUpperCase();
      const grade = config.grade ? ` – LỚP ${config.grade}` : '';
      const duration = config.durationMinutes || 45;
      const year = config.academicYear || getDefaultAcademicYear();

      let examHtml = `
        <div style="${fontStyle} ${pageBreakStyle}">
          <!-- Đầu đề 2 cột -->
          <table style="${tableStyle} border: none; margin-bottom: 6pt;">
            <tr>
              <td style="${headerCellStyle} width: 45%; text-align: center;">
                <div style="font-size: 12pt; text-transform: uppercase;">${dept}</div>
                <div style="font-size: 12pt; font-weight: bold; text-transform: uppercase; margin-top: 2pt;">${school}</div>
                <div style="width: 50mm; height: 0.75pt; background: #000; margin: 3pt auto 0 auto;"></div>
              </td>
              <td style="${headerCellStyle} width: 55%; text-align: center; position: relative;">
                <div style="border: 0.75pt solid #000; display: inline-block; padding: 1pt 6pt; font-size: 11pt; font-weight: bold; float: right;">Mã đề: ${v.code}</div>
                <div style="clear: both;"></div>
                <div style="font-size: 14pt; font-weight: bold; text-transform: uppercase;">${title}</div>
                <div style="font-size: 13pt; font-weight: bold; margin-top: 1pt;">Môn: ${subject}${grade}</div>
                <div style="font-size: 12pt; font-style: italic; margin-top: 1pt;">Thời gian làm bài: ${duration} phút <em>(không kể thời gian phát đề)</em></div>
                <div style="font-size: 11pt; font-style: italic; margin-top: 1pt;">Năm học: ${year}</div>
              </td>
            </tr>
          </table>

          <!-- Khung thông tin thí sinh -->
          <table style="${tableStyle} border: 0.75pt solid #000; margin-bottom: 8pt;">
            <tr>
              <td style="${cellStyle} width: 75%; border: none;">
                <p style="margin: 2pt 0 4pt 0;">Họ và tên thí sinh: .................................................................................................</p>
                <p style="margin: 2pt 0;">Lớp: ........................................... Số báo danh (SBD): ...........................................</p>
              </td>
              <td style="${cellStyle} width: 25%; text-align: center; vertical-align: middle; border-left: 0.75pt solid #000;">
                <div style="font-size: 9.5pt; font-weight: bold; border-bottom: 0.75pt solid #000; padding-bottom: 2pt;">ĐIỂM / LỜI PHÊ</div>
                <div style="height: 24pt;"></div>
              </td>
            </tr>
          </table>
      `;

      // Nhóm phần La Mã
      let romanIdx = 0;
      for (const entry of SECTION_TYPE_CONFIG) {
        const matchingQuestions: { question: Question; overallIndex: number }[] = [];
        v.questions.forEach((q, idx) => {
          if (q.type === entry.type) {
            matchingQuestions.push({ question: q, overallIndex: idx + 1 });
          }
        });

        if (matchingQuestions.length > 0) {
          const roman = ROMAN_NUMERALS[romanIdx++] || `${romanIdx}`;
          const startNum = matchingQuestions[0].overallIndex;
          const endNum = matchingQuestions[matchingQuestions.length - 1].overallIndex;
          const rangeText = startNum === endNum ? `Câu ${startNum}` : `Từ câu ${startNum} đến câu ${endNum}`;

          const firstScore = matchingQuestions[0].question.score ?? 0;
          const isUniform = matchingQuestions.every(
            (m) => Math.abs((m.question.score ?? 0) - firstScore) < 0.001
          );

          let instruction = '';
          if (entry.type === 'MCQ4') {
            instruction = isUniform
              ? `(${rangeText}. Mỗi câu hỏi thí sinh chỉ chọn một phương án. Mỗi câu trả lời đúng được ${formatScore(firstScore)} điểm.)`
              : `(${rangeText}. Mỗi câu hỏi thí sinh chỉ chọn một phương án.)`;
          } else if (entry.type === 'TRUE_FALSE') {
            instruction = isUniform
              ? `(${rangeText}. Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn đúng hoặc sai. Mỗi câu trả lời đúng được ${formatScore(firstScore)} điểm.)`
              : `(${rangeText}. Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn đúng hoặc sai.)`;
          } else if (entry.type === 'SHORT_ANSWER') {
            instruction = isUniform
              ? `(${rangeText}. Thí sinh ghi câu trả lời ngắn vào vị trí quy định. Mỗi câu trả lời đúng được ${formatScore(firstScore)} điểm.)`
              : `(${rangeText}. Thí sinh ghi câu trả lời ngắn vào vị trí quy định.)`;
          } else if (entry.type === 'MATCHING') {
            instruction = isUniform
              ? `(${rangeText}. Thí sinh ghép nối mỗi ý ở Cột 1 với một ý tương ứng ở Cột A. Mỗi câu đúng được ${formatScore(firstScore)} điểm.)`
              : `(${rangeText}. Thí sinh ghép nối mỗi ý ở Cột 1 với một ý tương ứng ở Cột A.)`;
          } else if (entry.type === 'FILL_BLANK') {
            instruction = isUniform
              ? `(${rangeText}. Thí sinh điền từ, cụm từ hoặc số thích hợp vào chỗ trống. Mỗi câu đúng được ${formatScore(firstScore)} điểm.)`
              : `(${rangeText}. Thí sinh điền từ, cụm từ hoặc số thích hợp vào chỗ trống.)`;
          } else if (entry.type === 'MCQ_MULTI') {
            instruction = isUniform
              ? `(${rangeText}. Thí sinh chọn một hoặc nhiều phương án. Mỗi câu trả lời đúng được ${formatScore(firstScore)} điểm.)`
              : `(${rangeText}. Thí sinh chọn một hoặc nhiều phương án.)`;
          } else if (entry.type === 'ESSAY') {
            instruction = isUniform
              ? `(${rangeText}. Thí sinh trình bày bài làm chi tiết vào giấy làm bài. Mỗi câu được ${formatScore(firstScore)} điểm.)`
              : `(${rangeText}. Thí sinh trình bày bài làm chi tiết vào giấy làm bài.)`;
          }

          examHtml += `
            <div style="margin-top: 10pt; margin-bottom: 6pt;">
              <div style="font-weight: bold; font-size: 13pt; text-transform: uppercase;">PHẦN ${roman}. ${entry.title}</div>
              <div style="font-style: italic; font-size: 12pt; margin-bottom: 4pt;">${instruction}</div>
          `;

          for (const item of matchingQuestions) {
            const q = item.question;
            const idx = item.overallIndex;
            const scoreText = !isUniform && q.score ? ` <em>(${formatScore(q.score)} điểm)</em>` : '';
            const figHtml = renderQuestionImageHtmlForCopy(q);

            examHtml += `
              <div style="margin-bottom: 6pt; page-break-inside: avoid;">
                <p style="margin: 0 0 2pt 0;"><strong>Câu ${idx}.</strong>${scoreText} ${renderFormulaHtml(q.question)}</p>
                ${figHtml}
            `;

            if ((q.type === 'MCQ4' || q.type === 'MCQ_MULTI') && q.options && q.options.length > 0) {
              const cols = getOptionsGridColCount(q.options);
              if (cols === 4) {
                examHtml += `<table style="width: 100%; border: none; margin: 2pt 0 4pt 8mm;"><tr>`;
                for (let i = 0; i < q.options.length; i++) {
                  const letter = ['A', 'B', 'C', 'D'][i] || `${i + 1}`;
                  const clean = q.options[i].replace(/^[A-D]\.\s*/i, '');
                  examHtml += `<td style="border: none; padding: 2pt 6pt; width: 25%;"><strong>${letter}.</strong> ${renderFormulaHtml(clean)}</td>`;
                }
                examHtml += `</tr></table>`;
              } else if (cols === 2) {
                examHtml += `<table style="width: 100%; border: none; margin: 2pt 0 4pt 8mm;">`;
                for (let r = 0; r < q.options.length; r += 2) {
                  examHtml += `<tr>`;
                  for (let c = 0; c < 2; c++) {
                    const i = r + c;
                    if (i < q.options.length) {
                      const letter = ['A', 'B', 'C', 'D'][i] || `${i + 1}`;
                      const clean = q.options[i].replace(/^[A-D]\.\s*/i, '');
                      examHtml += `<td style="border: none; padding: 2pt 6pt; width: 50%;"><strong>${letter}.</strong> ${renderFormulaHtml(clean)}</td>`;
                    }
                  }
                  examHtml += `</tr>`;
                }
                examHtml += `</table>`;
              } else {
                examHtml += `<div style="margin-left: 8mm; margin-top: 2pt;">`;
                for (let i = 0; i < q.options.length; i++) {
                  const letter = ['A', 'B', 'C', 'D'][i] || `${i + 1}`;
                  const clean = q.options[i].replace(/^[A-D]\.\s*/i, '');
                  examHtml += `<p style="margin: 2pt 0;"><strong>${letter}.</strong> ${renderFormulaHtml(clean)}</p>`;
                }
                examHtml += `</div>`;
              }
            }

            if (q.type === 'TRUE_FALSE' && q.statements && q.statements.length > 0) {
              examHtml += `<div style="margin-left: 8mm; margin-top: 2pt;">`;
              for (const st of q.statements) {
                examHtml += `<p style="margin: 2pt 0;"><strong>${st.id.toLowerCase()})</strong> ${renderFormulaHtml(st.statement)}</p>`;
              }
              examHtml += `</div>`;
            }

            if (q.type === 'MATCHING' && q.pairs && q.pairs.length > 0) {
              examHtml += `<table style="${tableStyle} margin-left: 8mm; width: calc(100% - 8mm);"><tr><th style="${cellStyle}">Cột 1</th><th style="${cellStyle}">Cột A</th></tr>`;
              for (let i = 0; i < q.pairs.length; i++) {
                examHtml += `<tr><td style="${cellStyle}"><strong>${i + 1}.</strong> ${renderFormulaHtml(q.pairs[i].left)}</td><td style="${cellStyle}"><strong>${String.fromCharCode(65 + i)}.</strong> ${renderFormulaHtml(q.pairs[i].right)}</td></tr>`;
              }
              examHtml += `</table>`;
            }

            if (q.type === 'FILL_BLANK') {
              examHtml += `<p style="margin: 2pt 0 4pt 8mm;">Chỗ trống cần điền: ................................................................</p>`;
            }

            examHtml += `</div>`;
          }

          examHtml += `</div>`;
        }
      }

      examHtml += `
          <div style="text-align: center; margin-top: 14pt; padding-top: 6pt; border-top: 0.75pt solid #000;">
            <p style="margin: 0; font-weight: bold; letter-spacing: 2pt;">— HẾT —</p>
            <p style="margin: 2pt 0 0 0; font-style: italic; font-size: 11pt;">Thí sinh không được sử dụng tài liệu. Cán bộ coi thi không giải thích gì thêm.</p>
          </div>
          <div style="text-align: center; font-size: 11pt; margin-top: 10pt;">Mã đề ${v.code} – Trang 1/1</div>
        </div>
      `;
      sectionsHtml.push(examHtml);
    }
  }

  // 2. Đáp án
  if (options.includeAnswers) {
    for (const v of targetVersions) {
      let ansHtml = `
        <div style="${fontStyle} page-break-before: always; margin-top: 24pt;">
          <h3 style="text-align: center; font-size: 14pt; font-weight: bold; margin-bottom: 12pt;">ĐÁP ÁN VÀ LỜI GIẢI CHI TIẾT – MÃ ĐỀ: ${v.code}</h3>
          <table style="${tableStyle}">
            <tr style="background-color: #f2f2f2; font-weight: bold; text-align: center;">
              <th style="${cellStyle} width: 15%;">Câu số</th>
              <th style="${cellStyle} width: 35%;">Dạng câu</th>
              <th style="${cellStyle} width: 35%;">Đáp án đúng</th>
              <th style="${cellStyle} width: 15%;">Điểm</th>
            </tr>
      `;

      for (let i = 0; i < v.questions.length; i++) {
        const q = v.questions[i];
        ansHtml += `
          <tr>
            <td style="${cellStyle} text-align: center; font-weight: bold;">Câu ${i + 1}</td>
            <td style="${cellStyle}">${QUESTION_TYPE_LABELS[q.type]?.label || q.type}</td>
            <td style="${cellStyle} text-align: center; font-weight: bold; color: #1e3a8a;">${q.correctAnswer || 'Xem hướng dẫn'}</td>
            <td style="${cellStyle} text-align: right; font-weight: bold;">${formatScore(q.score)}đ</td>
          </tr>
        `;
      }

      ansHtml += `</table></div>`;
      sectionsHtml.push(ansHtml);
    }
  }

  return sectionsHtml.join('\n');
}

/**
 * Tạo phiên bản plain text có định dạng gọn gàng để sao chép nhanh
 */
export function buildPlainText(
  exam: Exam,
  config: ExamConfig,
  options: ExportOptions
): string {
  const targetVersions = resolveTargetVersions(exam, options.selectedVersionCode);
  const textBlocks: string[] = [];

  const dept = config.departmentName?.trim()
    ? formatDepartmentForHeader(config.departmentName)
    : 'SỞ GIÁO DỤC VÀ ĐÀO TẠO …………………';

  const school = config.schoolName?.trim()
    ? formatSchoolNameForHeader(config.schoolName)
    : 'TRƯỜNG: …………………………………';

  const title = (exam.title?.trim() || config.title?.trim() || 'ĐỀ KIỂM TRA ĐỊNH KỲ').toUpperCase();
  const subject = (config.customSubject?.trim() || config.subject || 'MÔN HỌC').toUpperCase();
  const grade = config.grade ? ` – LỚP ${config.grade}` : '';
  const duration = config.durationMinutes || 45;
  const year = config.academicYear || getDefaultAcademicYear();

  if (options.includeExam) {
    for (const v of targetVersions) {
      const lines: string[] = [];
      lines.push(`${dept.padEnd(40, ' ')} ${title}`);
      lines.push(`${school.padEnd(40, ' ')} Môn: ${subject}${grade}`);
      lines.push(`Năm học: ${year}`.padEnd(40, ' ') + ` Thời gian: ${duration} phút`);
      lines.push(`Mã đề: ${v.code}`);
      lines.push('--------------------------------------------------------------------------------');
      lines.push('Họ và tên thí sinh: ....................................... Lớp: ......... SBD: .........');
      lines.push('--------------------------------------------------------------------------------\n');

      let romanIdx = 0;
      for (const entry of SECTION_TYPE_CONFIG) {
        const matchingQuestions: { question: Question; overallIndex: number }[] = [];
        v.questions.forEach((q, idx) => {
          if (q.type === entry.type) {
            matchingQuestions.push({ question: q, overallIndex: idx + 1 });
          }
        });

        if (matchingQuestions.length > 0) {
          const roman = ROMAN_NUMERALS[romanIdx++] || `${romanIdx}`;
          const firstScore = matchingQuestions[0].question.score ?? 0;
          const isUniform = matchingQuestions.every(
            (m) => Math.abs((m.question.score ?? 0) - firstScore) < 0.001
          );

          lines.push(`\nPHẦN ${roman}. ${entry.title}`);

          for (const item of matchingQuestions) {
            const q = item.question;
            const idx = item.overallIndex;
            const scoreText = !isUniform && q.score ? ` (${formatScore(q.score)} điểm)` : '';
            lines.push(`Câu ${idx}.${scoreText} ${q.question}`);

            if ((q.type === 'MCQ4' || q.type === 'MCQ_MULTI') && q.options) {
              q.options.forEach((opt, optIdx) => {
                const letter = ['A', 'B', 'C', 'D'][optIdx] || `${optIdx + 1}`;
                const clean = opt.replace(/^[A-D]\.\s*/i, '');
                lines.push(`   ${letter}. ${clean}`);
              });
            } else if (q.type === 'TRUE_FALSE' && q.statements) {
              q.statements.forEach((st) => {
                lines.push(`   ${st.id.toLowerCase()}) ${st.statement}`);
              });
            } else if (q.type === 'MATCHING' && q.pairs) {
              q.pairs.forEach((p, pIdx) => {
                lines.push(`   ${pIdx + 1}. ${p.left}  <--->  ${String.fromCharCode(65 + pIdx)}. ${p.right}`);
              });
            } else if (q.type === 'FILL_BLANK') {
              lines.push('   Chỗ trống cần điền: ........................................');
            }
            lines.push('');
          }
        }
      }

      lines.push('\n-------------------------- — HẾT — --------------------------');
      lines.push('Thí sinh không được sử dụng tài liệu. Cán bộ coi thi không giải thích gì thêm.');
      lines.push(`Mã đề ${v.code} – Trang 1/1`);

      textBlocks.push(lines.join('\n'));
    }
  }

  return textBlocks.join('\n\n================================================================================\n\n');
}

/**
 * Thực hiện sao chép tài liệu vào clipboard ở cả định dạng HTML (để dán vào Word/Docs) và Text
 */
export async function copyExamToClipboard(
  exam: Exam,
  config: ExamConfig,
  options: ExportOptions
): Promise<boolean> {
  const html = buildCleanExportHtml(exam, config, options);
  const plain = buildPlainText(exam, config, options);

  try {
    if (navigator.clipboard && window.ClipboardItem) {
      const blobHtml = new Blob([html], { type: 'text/html' });
      const blobText = new Blob([plain], { type: 'text/plain' });
      const item = new ClipboardItem({
        'text/html': blobHtml,
        'text/plain': blobText,
      });
      await navigator.clipboard.write([item]);
      return true;
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(plain);
      return true;
    }
  } catch (err) {
    console.warn('Clipboard write failed, trying fallback execCommand', err);
  }

  // Fallback dùng DOM selection
  try {
    const el = document.createElement('div');
    el.innerHTML = html;
    el.style.position = 'fixed';
    el.style.left = '-9999px';
    document.body.appendChild(el);
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    const ok = document.execCommand('copy');
    sel?.removeAllRanges();
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

