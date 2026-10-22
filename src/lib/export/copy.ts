import katex from 'katex';
import { Exam, ExamConfig, Question } from '../../types';
import { ExportOptions } from './types';
import { resolveTargetVersions } from './utils';
import { QUESTION_TYPE_LABELS, LEVEL_LABELS } from '../../config';
import { renderFigureToSvg } from '../figureRenderer';

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

  const fontStyle = "font-family: 'Times New Roman', Times, serif; font-size: 13pt; line-height: 1.5; color: #000000;";
  const tableStyle = "border-collapse: collapse; width: 100%; margin: 12pt 0; font-family: 'Times New Roman', Times, serif;";
  const cellStyle = "border: 1px solid #000000; padding: 6pt; font-size: 12pt; vertical-align: top;";
  const headerCellStyle = "border: none; padding: 4pt 8pt; vertical-align: top;";

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

  // Hàm chuyển hình ảnh hoặc đồ thị của câu hỏi thành thẻ <img> dạng Data URL
  // Giúp dán vào Microsoft Word và Google Docs hiển thị đúng ảnh
  const renderQuestionImageHtmlForCopy = (q: Question): string => {
    // 1. Ưu tiên cao nhất: imageData do giáo viên chèn
    if (q.imageData?.dataUrl) {
      const widthPct = Math.min(100, Math.max(20, q.imageData.widthPercent ?? 80));
      const captionHtml =
        q.imageData.caption && q.imageData.caption.trim().length > 0
          ? `<p style="text-align: center; font-style: italic; font-size: 9.5pt; color: #475569; margin: 3pt 0 0 0;">${q.imageData.caption.trim()}</p>`
          : '';
      return `
        <div style="text-align: center; margin: 8pt 0; page-break-inside: avoid;">
          <img src="${q.imageData.dataUrl}" alt="Hình vẽ" style="max-width: ${widthPct}%; width: ${widthPct}%; height: auto; display: inline-block; margin: 0 auto;" />
          ${captionHtml}
        </div>
      `;
    }

    // 2. Không có imageData: chuyển figure SVG thành thẻ <img> data URL
    const figSvg = q.figure
      ? renderFigureToSvg(q.figure)
      : q.svgDiagram && q.svgDiagram.trim().startsWith('<svg')
      ? q.svgDiagram
      : '';

    if (figSvg) {
      try {
        const b64 = btoa(unescape(encodeURIComponent(figSvg)));
        const dataUrl = `data:image/svg+xml;base64,${b64}`;
        return `
          <div style="text-align: center; margin: 8pt 0; page-break-inside: avoid;">
            <img src="${dataUrl}" alt="Đồ thị / Hình vẽ" style="max-width: 360px; width: 100%; height: auto; display: inline-block; margin: 0 auto;" />
          </div>
        `;
      } catch {
        return `<div style="text-align: center; margin: 8pt 0;">${figSvg}</div>`;
      }
    }

    return '';
  };

  // 1. Đề thi
  if (options.includeExam) {
    for (let vIdx = 0; vIdx < targetVersions.length; vIdx++) {
      const v = targetVersions[vIdx];
      const pageBreakStyle = vIdx > 0 ? 'page-break-before: always; margin-top: 24pt;' : '';

      const dept = (config.departmentName?.trim() || 'SỞ GIÁO DỤC VÀ ĐÀO TẠO').toUpperCase();
      const school = (config.schoolName?.trim() || 'TRƯỜNG THPT / THCS / TIỂU HỌC').toUpperCase();
      const title = (config.title?.trim() || 'ĐỀ KIỂM TRA ĐỊNH KỲ').toUpperCase();
      const subject = (config.customSubject?.trim() || config.subject || 'MÔN HỌC').toUpperCase();
      const grade = config.grade ? ` – KHỐI ${config.grade}` : '';

      let examHtml = `
        <div style="${fontStyle} ${pageBreakStyle}">
          <!-- Đầu đề 2 cột -->
          <table style="${tableStyle} border: none; margin-bottom: 14pt;">
            <tr>
              <td style="${headerCellStyle} width: 45%; text-align: center;">
                <div style="font-size: 11pt; font-weight: bold;">${dept}</div>
                <div style="font-size: 12pt; font-weight: bold; margin-top: 2pt;">${school}</div>
                <div style="font-size: 10pt; font-style: italic; margin-top: 2pt;">Năm học: ${config.academicYear || '2024 - 2025'}</div>
                <div style="font-size: 10pt; margin-top: 2pt;">------------------</div>
              </td>
              <td style="${headerCellStyle} width: 55%; text-align: center;">
                <div style="font-size: 13pt; font-weight: bold;">${title}</div>
                <div style="font-size: 12pt; font-weight: bold; margin-top: 2pt;">MÔN: ${subject}${grade}</div>
                <div style="font-size: 11pt; font-style: italic; margin-top: 2pt;">Thời gian làm bài: ${config.durationMinutes || 45} phút</div>
                <div style="font-size: 12pt; font-weight: bold; text-align: right; margin-top: 6pt;">Mã đề thi: ${v.code}</div>
              </td>
            </tr>
          </table>

          <!-- Thông tin thí sinh -->
          <table style="${tableStyle} margin-bottom: 14pt;">
            <tr>
              <td style="${cellStyle} width: 70%;">
                <p style="margin: 0 0 6pt 0;">Họ và tên thí sinh: .................................................................................................</p>
                <p style="margin: 0;">Lớp: ................................................. Số báo danh: .................................................</p>
              </td>
              <td style="${cellStyle} width: 30%; text-align: center; vertical-align: middle;">
                <p style="margin: 0; font-size: 10pt; font-weight: bold;">ĐIỂM / LỜI PHÊ</p>
                <div style="height: 30pt;"></div>
              </td>
            </tr>
          </table>

          <p style="font-style: italic; font-size: 10pt; margin-bottom: 12pt;">(Thí sinh không được sử dụng tài liệu. Cán bộ coi thi không giải thích gì thêm)</p>
      `;

      // Phân chia trắc nghiệm và tự luận
      const objQs = v.questions.filter((q) => q.type !== 'ESSAY');
      const essayQs = v.questions.filter((q) => q.type === 'ESSAY');

      if (objQs.length > 0) {
        examHtml += `<p style="font-weight: bold; font-size: 12pt; margin: 16pt 0 8pt 0;">PHẦN I. CÂU HỎI TRẮC NGHIỆM</p>`;
        for (const q of objQs) {
          const idx = v.questions.findIndex((item) => item.id === q.id) + 1;
          const scoreText = q.score ? ` <em>(${q.score.toFixed(2)} điểm)</em>` : '';
          const figHtml = renderQuestionImageHtmlForCopy(q);
          examHtml += `
            <div style="margin-bottom: 10pt; page-break-inside: avoid;">
              <p style="margin: 0 0 4pt 0;"><strong>Câu ${idx}${scoreText}:</strong> ${renderFormulaHtml(q.question)}</p>
              ${figHtml}
          `;

          if (q.options && q.options.length > 0) {
            examHtml += `<div style="margin-left: 18pt;">`;
            for (const opt of q.options) {
              examHtml += `<p style="margin: 2pt 0;">${renderFormulaHtml(opt)}</p>`;
            }
            examHtml += `</div>`;
          }

          if (q.statements && q.statements.length > 0) {
            examHtml += `<div style="margin-left: 18pt;">`;
            for (const st of q.statements) {
              examHtml += `<p style="margin: 2pt 0;"><strong>${st.id})</strong> ${renderFormulaHtml(st.statement)}</p>`;
            }
            examHtml += `</div>`;
          }

          if (q.pairs && q.pairs.length > 0) {
            examHtml += `<div style="margin-left: 18pt;">`;
            for (let i = 0; i < q.pairs.length; i++) {
              examHtml += `<p style="margin: 2pt 0;">${i + 1}. ${renderFormulaHtml(q.pairs[i].left)} --- ${String.fromCharCode(65 + i)}. ${renderFormulaHtml(q.pairs[i].right)}</p>`;
            }
            examHtml += `</div>`;
          }

          examHtml += `</div>`;
        }
      }

      if (essayQs.length > 0) {
        examHtml += `<p style="font-weight: bold; font-size: 12pt; margin: 18pt 0 8pt 0;">PHẦN II. CÂU HỎI TỰ LUẬN</p>`;
        for (const q of essayQs) {
          const idx = v.questions.findIndex((item) => item.id === q.id) + 1;
          const scoreText = q.score ? ` <em>(${q.score.toFixed(2)} điểm)</em>` : '';
          const figHtml = renderQuestionImageHtmlForCopy(q);
          examHtml += `
            <div style="margin-bottom: 12pt; page-break-inside: avoid;">
              <p style="margin: 0;"><strong>Câu ${idx}${scoreText}:</strong> ${renderFormulaHtml(q.question)}</p>
              ${figHtml}
            </div>
          `;
        }
      }

      examHtml += `
          <p style="text-align: center; font-weight: bold; margin: 24pt 0 12pt 0;">-------------------------- HẾT --------------------------</p>
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
          <h3 style="text-align: center; font-size: 14pt; font-weight: bold; margin-bottom: 14pt;">ĐÁP ÁN VÀ LỜI GIẢI CHI TIẾT – MÃ ĐỀ: ${v.code}</h3>
          <table style="${tableStyle}">
            <tr style="background-color: #f2f2f2; font-weight: bold; text-align: center;">
              <th style="${cellStyle} width: 15%;">Câu số</th>
              <th style="${cellStyle} width: 35%;">Dạng câu</th>
              <th style="${cellStyle} width: 35%;">Đáp án đúng</th>
              <th style="${cellStyle} width: 15%;">Điểm</th>
            </tr>
      `;

      v.questions.forEach((q, idx) => {
        ansHtml += `
          <tr>
            <td style="${cellStyle} text-align: center;">Câu ${idx + 1}</td>
            <td style="${cellStyle}">${QUESTION_TYPE_LABELS[q.type]?.short || q.type}</td>
            <td style="${cellStyle} text-align: center; font-weight: bold;">${renderFormulaHtml(q.correctAnswer)}</td>
            <td style="${cellStyle} text-align: center;">${q.score.toFixed(2)}đ</td>
          </tr>
        `;
      });

      ansHtml += `</table>`;

      ansHtml += `<h4 style="font-size: 13pt; font-weight: bold; margin: 16pt 0 8pt 0;">Lời giải chi tiết:</h4>`;
      v.questions.forEach((q, idx) => {
        if (q.explanation) {
          ansHtml += `
            <div style="margin-bottom: 8pt;">
              <p style="margin: 0;"><strong>Câu ${idx + 1} (${q.correctAnswer}):</strong> ${renderFormulaHtml(q.explanation)}</p>
            </div>
          `;
        }
      });

      ansHtml += `</div>`;
      sectionsHtml.push(ansHtml);
    }
  }

  // 3. Hướng dẫn chấm
  if (options.includeScoring) {
    const v = targetVersions[0] || { code: '101', questions: exam.questions };
    let scoreHtml = `
      <div style="${fontStyle} page-break-before: always; margin-top: 24pt;">
        <h3 style="text-align: center; font-size: 14pt; font-weight: bold; margin-bottom: 14pt;">HƯỚNG DẪN CHẤM VÀ THANG BIỂU ĐIỂM</h3>
    `;
    v.questions.forEach((q, idx) => {
      scoreHtml += `
        <div style="margin-bottom: 8pt;">
          <p style="margin: 0;"><strong>Câu ${idx + 1} (${q.score.toFixed(2)} điểm):</strong> ${renderFormulaHtml(q.scoringGuide || q.explanation || `Đáp án đúng ${q.correctAnswer}`)}</p>
        </div>
      `;
    });
    scoreHtml += `</div>`;
    sectionsHtml.push(scoreHtml);
  }

  // 4. Ma trận & Bản đặc tả
  if (options.includeMatrix && exam.blueprint) {
    let matrixHtml = `
      <div style="${fontStyle} page-break-before: always; margin-top: 24pt;">
        <h3 style="text-align: center; font-size: 14pt; font-weight: bold; margin-bottom: 14pt;">MA TRẬN ĐỀ KIỂM TRA</h3>
        <table style="${tableStyle}">
          <tr style="background-color: #f2f2f2; font-weight: bold; text-align: center;">
            <th style="${cellStyle}">STT</th>
            <th style="${cellStyle}">Chủ đề</th>
            <th style="${cellStyle}">Nhận biết</th>
            <th style="${cellStyle}">Thông hiểu</th>
            <th style="${cellStyle}">Vận dụng</th>
            <th style="${cellStyle}">Vận dụng cao</th>
            <th style="${cellStyle}">Tổng điểm</th>
          </tr>
    `;
    exam.blueprint.forEach((slot, idx) => {
      matrixHtml += `
        <tr>
          <td style="${cellStyle} text-align: center;">${idx + 1}</td>
          <td style="${cellStyle}">${slot.topic}</td>
          <td style="${cellStyle} text-align: center;">${slot.level === 'NB' ? '1' : '-'}</td>
          <td style="${cellStyle} text-align: center;">${slot.level === 'TH' ? '1' : '-'}</td>
          <td style="${cellStyle} text-align: center;">${slot.level === 'VD' ? '1' : '-'}</td>
          <td style="${cellStyle} text-align: center;">${slot.level === 'VDC' ? '1' : '-'}</td>
          <td style="${cellStyle} text-align: center;">${slot.score.toFixed(2)}đ</td>
        </tr>
      `;
    });
    matrixHtml += `</table></div>`;
    sectionsHtml.push(matrixHtml);
  }

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${config.title || 'Đề kiểm tra'}</title>
      </head>
      <body style="margin: 0; padding: 20px;">
        ${sectionsHtml.join('\n')}
      </body>
    </html>
  `;
}

/**
 * Tạo văn bản thuần túy sạch (plain text)
 */
export function buildCleanExportPlainText(
  exam: Exam,
  config: ExamConfig,
  options: ExportOptions
): string {
  const targetVersions = resolveTargetVersions(exam, options.selectedVersionCode);
  let text = '';

  if (options.includeExam) {
    for (const v of targetVersions) {
      text += `========================================================\n`;
      text += `${(config.departmentName || 'SỞ GIÁO DỤC VÀ ĐÀO TẠO').toUpperCase()}\n`;
      text += `${(config.schoolName || 'TRƯỜNG THPT / THCS / TIỂU HỌC').toUpperCase()}\n`;
      text += `ĐỀ KIỂM TRA: ${(config.title || 'MÔN HỌC').toUpperCase()}\n`;
      text += `Môn: ${config.customSubject?.trim() || config.subject} - Lớp: ${config.grade || '-'}\n`;
      text += `Thời gian làm bài: ${config.durationMinutes || 45} phút\n`;
      text += `MÃ ĐỀ THI: ${v.code}\n`;
      text += `========================================================\n\n`;

      v.questions.forEach((q, idx) => {
        text += `Câu ${idx + 1} (${q.score.toFixed(2)} điểm): ${q.question}\n`;
        if (q.options) {
          q.options.forEach((opt) => (text += `  ${opt}\n`));
        }
        if (q.statements) {
          q.statements.forEach((st) => (text += `  ${st.id}) ${st.statement}\n`));
        }
        if (q.pairs) {
          q.pairs.forEach((p, i) => (text += `  ${i + 1}. ${p.left} --- ${String.fromCharCode(65 + i)}. ${p.right}\n`));
        }
        text += `\n`;
      });
      text += `--- HẾT ---\n\n`;
    }
  }

  if (options.includeAnswers) {
    for (const v of targetVersions) {
      text += `=== ĐÁP ÁN VÀ LỜI GIẢI CHI TIẾT (MÃ ĐỀ ${v.code}) ===\n\n`;
      v.questions.forEach((q, idx) => {
        text += `Câu ${idx + 1}: Đáp án: ${q.correctAnswer}\n`;
        if (q.explanation) {
          text += `  Lời giải: ${q.explanation}\n`;
        }
        text += `\n`;
      });
    }
  }

  if (options.includeScoring) {
    text += `=== HƯỚNG DẪN CHẤM VÀ THANG ĐIỂM ===\n\n`;
    const v = targetVersions[0] || { code: '101', questions: exam.questions };
    v.questions.forEach((q, idx) => {
      text += `Câu ${idx + 1} (${q.score.toFixed(2)}đ): ${q.scoringGuide || q.explanation || q.correctAnswer}\n`;
    });
  }

  return text;
}

/**
 * Sao chép vào clipboard cả text/html và text/plain
 */
export async function copyExamToClipboard(
  exam: Exam,
  config: ExamConfig,
  options: ExportOptions
): Promise<boolean> {
  const htmlContent = buildCleanExportHtml(exam, config, options);
  const plainTextContent = buildCleanExportPlainText(exam, config, options);

  // Thử ClipboardItem trước (hỗ trợ cả HTML và Plain text cho Word)
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof ClipboardItem !== 'undefined') {
    try {
      const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
      const textBlob = new Blob([plainTextContent], { type: 'text/plain' });
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': htmlBlob,
          'text/plain': textBlob,
        }),
      ]);
      return true;
    } catch (err) {
      console.warn('ClipboardItem bị hạn chế, chuyển sang phương án dự phòng execCommand:', err);
    }
  }

  // Phương án dự phòng: Tạo phần tử DOM ẩn, chọn vùng và gọi document.execCommand('copy')
  try {
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    container.style.opacity = '0';
    container.innerHTML = htmlContent;
    document.body.appendChild(container);

    const range = document.createRange();
    range.selectNodeContents(container);
    const selection = window.getSelection();
    if (!selection) return false;

    selection.removeAllRanges();
    selection.addRange(range);
    const successful = document.execCommand('copy');
    selection.removeAllRanges();
    document.body.removeChild(container);

    return successful;
  } catch (err) {
    console.error('Không thể sao chép bằng execCommand:', err);
    return false;
  }
}
