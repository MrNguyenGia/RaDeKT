import katex from 'katex';
import { Exam, ExamConfig, Question } from '../../types';
import { ExportOptions } from './types';
import { generateExportFileName, resolveTargetVersions } from './utils';
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

const PRINT_CONTAINER_ID = 'stem-exam-print-mount';

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

/**
 * Hiển thị hình vẽ / ảnh câu hỏi cho bản in
 */
function renderQuestionFigureHtmlForPrint(q: Question): string {
  if (q.imageData?.dataUrl) {
    const widthPct = Math.min(70, Math.max(20, q.imageData.widthPercent ?? 70));
    const caption = q.imageData.caption
      ? `<div style="text-align: center; font-style: italic; font-size: 11pt; color: #000; margin-top: 4pt;">${q.imageData.caption.trim()}</div>`
      : '';
    return `
      <div style="text-align: center; margin: 8pt 0; page-break-inside: avoid; break-inside: avoid;">
        <img src="${q.imageData.dataUrl}" style="max-width: ${widthPct}%; width: ${widthPct}%; height: auto; display: inline-block; margin: 0 auto;" />
        ${caption}
      </div>
    `;
  }
  if (q.figure) {
    const svgStr = figureToSvg(q.figure);
    if (svgStr) {
      const isTable = q.figure.kind === 'variation-table' || q.figure.kind === 'sign-table';
      const maxW = isTable ? '100%' : '70%';
      const captionText = (q.figure as any)?.caption;
      const caption = captionText && captionText.trim().length > 0
        ? `<div style="text-align: center; font-style: italic; font-size: 11pt; color: #000; margin-top: 4pt;">${captionText.trim()}</div>`
        : '';
      return `
        <div style="text-align: center; margin: 8pt auto; max-width: ${maxW}; page-break-inside: avoid; break-inside: avoid;">
          ${svgStr}
          ${caption}
        </div>
      `;
    }
  } else if (q.svgDiagram && q.svgDiagram.trim().startsWith('<svg')) {
    return `
      <div style="text-align: center; margin: 8pt auto; max-width: 70%; page-break-inside: avoid; break-inside: avoid;">
        ${q.svgDiagram}
      </div>
    `;
  }
  return '';
}

/**
 * Render công thức toán bằng KaTeX để in ấn sắc nét
 */
function renderFormulaHtmlForPrint(text?: string): string {
  if (!text) return '';
  return text.replace(/(\$\$[\s\S]*?\$\$|\$[^\$\n]+?\$)/g, (match) => {
    const isDisplay = match.startsWith('$$');
    const formula = isDisplay ? match.slice(2, -2).trim() : match.slice(1, -1).trim();
    try {
      return katex.renderToString(formula, {
        output: 'html',
        throwOnError: false,
        strict: 'ignore',
        trust: true,
        displayMode: isDisplay,
      });
    } catch {
      return `<span>${match}</span>`;
    }
  });
}

function getOptionsGridColCount(options: string[]): number {
  const cleanLengths = options.map((opt) => opt.replace(/^[A-D]\.\s*/i, '').trim().length);
  const maxLen = Math.max(...cleanLengths, 0);
  if (maxLen <= 20) return 4;
  if (maxLen <= 45) return 2;
  return 1;
}

/**
 * Tạo HTML hoàn chỉnh cho bản in theo đúng quy chuẩn A4, lề 25-15-20-20mm và Times New Roman 13pt
 */
export function buildPrintHtml(
  exam: Exam,
  config: ExamConfig,
  options: ExportOptions
): string {
  const targetVersions = resolveTargetVersions(exam, options.selectedVersionCode);
  const fragments: string[] = [];

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

  // 1. In Đề thi cho các mã đề đã chọn
  if (options.includeExam) {
    for (let vIdx = 0; vIdx < targetVersions.length; vIdx++) {
      const v = targetVersions[vIdx];
      const pageBreakStyle = vIdx > 0 ? 'page-break-before: always; break-before: page;' : '';

      let examHtml = `
        <div class="print-doc-page" style="${pageBreakStyle}">
          <!-- Đầu đề 2 cột chuẩn BGD -->
          <table class="print-header-table">
            <tbody>
              <tr>
                <td class="header-col-left">
                  <div class="dept-name">${dept}</div>
                  <div class="school-name">${school}</div>
                  <div class="header-short-line"></div>
                </td>
                <td class="header-col-right">
                  <div class="version-badge">Mã đề: ${v.code}</div>
                  <div class="exam-title">${title}</div>
                  <div class="exam-subject">Môn: ${subject}${grade}</div>
                  <div class="exam-duration">Thời gian làm bài: ${duration} phút <em>(không kể thời gian phát đề)</em></div>
                  <div class="exam-year">Năm học: ${year}</div>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Khung thông tin thí sinh viền mảnh 0.75pt -->
          <div class="student-info-box">
            <div class="student-left">
              <div class="student-row">
                <span>Họ và tên thí sinh:</span>
                <span class="dotted-fill"></span>
              </div>
              <div class="student-row-split">
                <div class="split-item">
                  <span>Lớp:</span>
                  <span class="dotted-fill"></span>
                </div>
                <div class="split-item">
                  <span>Số báo danh:</span>
                  <span class="dotted-fill"></span>
                </div>
              </div>
            </div>
            <div class="student-right">
              <div class="score-title">ĐIỂM</div>
              <div class="score-val">.../10</div>
              <div class="score-note-title">LỜI PHÊ</div>
            </div>
          </div>
      `;

      // Nhóm câu hỏi theo phần La Mã
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
            <div class="part-container">
              <div class="part-title">PHẦN ${roman}. ${entry.title}</div>
              <div class="part-instruction">${instruction}</div>
          `;

          for (const item of matchingQuestions) {
            const q = item.question;
            const idx = item.overallIndex;
            const scoreText = !isUniform && q.score ? ` <em>(${formatScore(q.score)} điểm)</em>` : '';

            examHtml += `
              <div class="question-item">
                <div class="q-content">
                  <strong>Câu ${idx}.</strong>${scoreText} ${renderFormulaHtmlForPrint(q.question)}
                </div>
                ${renderQuestionFigureHtmlForPrint(q)}
            `;

            if ((q.type === 'MCQ4' || q.type === 'MCQ_MULTI') && q.options && q.options.length > 0) {
              const cols = getOptionsGridColCount(q.options);
              examHtml += `<div class="options-grid cols-${cols}">`;
              for (let i = 0; i < q.options.length; i++) {
                const opt = q.options[i];
                const letter = ['A', 'B', 'C', 'D'][i] || `${i + 1}`;
                const clean = opt.replace(/^[A-D]\.\s*/i, '');
                examHtml += `<div class="opt-item"><strong>${letter}.</strong> ${renderFormulaHtmlForPrint(clean)}</div>`;
              }
              examHtml += `</div>`;
            }

            if (q.type === 'TRUE_FALSE' && q.statements && q.statements.length > 0) {
              examHtml += `<div class="statements-list">`;
              for (const st of q.statements) {
                examHtml += `<div class="st-item"><strong>${st.id.toLowerCase()})</strong> ${renderFormulaHtmlForPrint(st.statement)}</div>`;
              }
              examHtml += `</div>`;
            }

            if (q.type === 'MATCHING' && q.pairs && q.pairs.length > 0) {
              examHtml += `<table class="matching-table"><thead><tr><th>Cột 1</th><th>Cột A</th></tr></thead><tbody>`;
              for (let i = 0; i < q.pairs.length; i++) {
                examHtml += `<tr><td><strong>${i + 1}.</strong> ${renderFormulaHtmlForPrint(q.pairs[i].left)}</td><td><strong>${String.fromCharCode(65 + i)}.</strong> ${renderFormulaHtmlForPrint(q.pairs[i].right)}</td></tr>`;
              }
              examHtml += `</tbody></table>`;
            }

            if (q.type === 'FILL_BLANK') {
              examHtml += `<div class="blank-fill-line"><span>Chỗ trống cần điền: </span><span class="blank-underline"></span></div>`;
            }

            examHtml += `</div>`;
          }

          examHtml += `</div>`;
        }
      }

      examHtml += `
          <div class="exam-end-box">
            <div class="exam-end-title">— HẾT —</div>
            <div class="exam-end-note">Thí sinh không được sử dụng tài liệu. Cán bộ coi thi không giải thích gì thêm.</div>
          </div>
          <div class="print-doc-footer">Mã đề ${v.code} – Trang 1/1</div>
        </div>
      `;
      fragments.push(examHtml);
    }
  }

  // 2. In Đáp án cho các mã đề đã chọn
  if (options.includeAnswers) {
    for (let vIdx = 0; vIdx < targetVersions.length; vIdx++) {
      const v = targetVersions[vIdx];
      const mcqs = v.questions.filter((q) => q.type === 'MCQ4' || q.type === 'MCQ_MULTI');

      let ansHtml = `
        <div class="print-doc-page" style="page-break-before: always; break-before: page;">
          <table class="print-header-table">
            <tbody>
              <tr>
                <td class="header-col-left">
                  <div class="dept-name">${dept}</div>
                  <div class="school-name">${school}</div>
                  <div class="header-short-line"></div>
                </td>
                <td class="header-col-right">
                  <div class="version-badge">Mã đề: ${v.code}</div>
                  <div class="exam-title">ĐÁP ÁN & LỜI GIẢI CHI TIẾT</div>
                  <div class="exam-subject">Môn: ${subject}${grade}</div>
                  <div class="exam-year">Năm học: ${year}</div>
                </td>
              </tr>
            </tbody>
          </table>
      `;

      if (mcqs.length > 0) {
        ansHtml += `
          <div class="part-title">I. BẢNG ĐÁP ÁN TRẮC NGHIỆM NHANH</div>
          <table class="grid-ans-table">
            <tbody>
              <tr class="row-num">
                <td class="col-lbl">Câu</td>
                ${mcqs.map((q) => {
                  const idx = v.questions.findIndex((item) => item.id === q.id) + 1;
                  return `<td>${idx}</td>`;
                }).join('')}
              </tr>
              <tr class="row-ans">
                <td class="col-lbl">Đ/A</td>
                ${mcqs.map((q) => `<td><strong>${q.correctAnswer || '-'}</strong></td>`).join('')}
              </tr>
            </tbody>
          </table>
        `;
      }

      ansHtml += `<div class="part-title" style="margin-top: 12pt;">II. HƯỚNG DẪN GIẢI CHI TIẾT</div>`;

      for (let i = 0; i < v.questions.length; i++) {
        const q = v.questions[i];
        ansHtml += `
          <div class="ans-detail-item">
            <div><strong>Câu ${i + 1}. (${formatScore(q.score)} điểm):</strong> ${renderFormulaHtmlForPrint(q.question)}</div>
            <div style="margin-top: 3pt;"><strong>Đáp án chuẩn:</strong> <span class="ans-badge">${q.correctAnswer || '(Chưa có)'}</span></div>
            ${q.explanation ? `<div style="margin-top: 3pt; font-size: 11pt; color: #222;"><strong>Lời giải:</strong> ${renderFormulaHtmlForPrint(q.explanation)}</div>` : ''}
          </div>
        `;
      }

      ansHtml += `
          <div class="exam-end-box"><div class="exam-end-title">— HẾT ĐÁP ÁN —</div></div>
          <div class="print-doc-footer">Mã đề ${v.code} – Đáp án</div>
        </div>
      `;
      fragments.push(ansHtml);
    }
  }

  // 3. CSS định dạng in ấn hoàn chỉnh
  const printStyles = `
    <style>
      @page {
        size: A4 portrait;
        margin: 20mm 15mm 20mm 25mm;
      }
      body {
        margin: 0;
        padding: 0;
        background: #fff;
        color: #000;
        font-family: 'Times New Roman', Tinos, 'Liberation Serif', serif;
        font-size: 13pt;
        line-height: 1.3;
      }
      .print-doc-page {
        width: 100%;
        max-width: 210mm;
        margin: 0 auto;
        box-sizing: border-box;
      }
      .print-header-table {
        width: 100%;
        border-collapse: collapse;
        border: none;
        margin-bottom: 4pt;
      }
      .header-col-left {
        width: 45%;
        text-align: center;
        vertical-align: top;
        padding: 0 4pt;
      }
      .header-col-right {
        width: 55%;
        text-align: center;
        vertical-align: top;
        position: relative;
        padding: 0 4pt;
      }
      .dept-name {
        font-size: 12pt;
        text-transform: uppercase;
      }
      .school-name {
        font-size: 12pt;
        font-weight: bold;
        text-transform: uppercase;
        margin-top: 2pt;
      }
      .header-short-line {
        width: 50mm;
        height: 0.75pt;
        background: #000;
        margin: 3pt auto 0 auto;
      }
      .version-badge {
        position: absolute;
        top: 0;
        right: 0;
        border: 0.75pt solid #000;
        padding: 1.5pt 4pt;
        font-size: 11pt;
        font-weight: bold;
      }
      .exam-title {
        font-size: 14pt;
        font-weight: bold;
        text-transform: uppercase;
      }
      .exam-subject {
        font-size: 13pt;
        font-weight: bold;
        margin-top: 1pt;
      }
      .exam-duration {
        font-size: 12pt;
        font-style: italic;
        margin-top: 1pt;
      }
      .exam-year {
        font-size: 11pt;
        font-style: italic;
        margin-top: 1pt;
      }
      .student-info-box {
        border: 0.75pt solid #000;
        padding: 4pt 6pt;
        margin: 4pt 0 8pt 0;
        display: flex;
        font-size: 11pt;
      }
      .student-left {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 3pt;
      }
      .student-right {
        width: 120px;
        border: 0.75pt solid #000;
        display: flex;
        flex-direction: column;
        text-align: center;
      }
      .score-title, .score-note-title {
        font-size: 9pt;
        font-weight: bold;
        border-bottom: 0.75pt solid #000;
        padding: 1pt;
      }
      .score-val {
        height: 18pt;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #999;
      }
      .student-row, .student-row-split {
        display: flex;
        align-items: baseline;
      }
      .student-row-split {
        gap: 12pt;
      }
      .split-item {
        flex: 1;
        display: flex;
        align-items: baseline;
      }
      .dotted-fill {
        flex: 1;
        border-bottom: 0.75pt dotted #000;
        margin-left: 4pt;
        min-height: 12pt;
      }
      .part-container {
        margin-bottom: 6pt;
      }
      .part-title {
        font-weight: bold;
        font-size: 13pt;
        text-transform: uppercase;
        break-after: avoid;
        page-break-after: avoid;
      }
      .part-instruction {
        font-style: italic;
        font-size: 12pt;
        margin-bottom: 4pt;
      }
      .question-item {
        break-inside: avoid;
        page-break-inside: avoid;
        margin-bottom: 6pt;
        text-align: justify;
      }
      .options-grid {
        display: grid;
        padding-left: 8mm;
        margin-top: 3pt;
        gap: 2pt 12pt;
      }
      .options-grid.cols-4 { grid-template-columns: repeat(4, 1fr); }
      .options-grid.cols-2 { grid-template-columns: repeat(2, 1fr); }
      .options-grid.cols-1 { grid-template-columns: 1fr; }
      .opt-item {
        text-align: left;
      }
      .statements-list {
        padding-left: 8mm;
        margin-top: 3pt;
      }
      .st-item {
        margin-bottom: 2pt;
      }
      .matching-table {
        margin-top: 3pt;
        margin-left: 8mm;
        border-collapse: collapse;
        border: 0.75pt solid #000;
        width: calc(100% - 8mm);
        font-size: 12pt;
      }
      .matching-table th, .matching-table td {
        border: 0.75pt solid #000;
        padding: 3pt 6pt;
      }
      .blank-fill-line {
        padding-left: 8mm;
        margin-top: 3pt;
      }
      .blank-underline {
        display: inline-block;
        width: 140px;
        border-bottom: 0.75pt solid #000;
      }
      .exam-end-box {
        text-align: center;
        margin-top: 12pt;
        padding-top: 6pt;
        border-top: 0.75pt solid #000;
        break-inside: avoid;
      }
      .exam-end-title {
        font-weight: bold;
        letter-spacing: 2pt;
      }
      .exam-end-note {
        font-style: italic;
        font-size: 11pt;
        margin-top: 2pt;
      }
      .print-doc-footer {
        text-align: center;
        font-size: 11pt;
        margin-top: 12pt;
      }
      .grid-ans-table {
        width: 100%;
        border-collapse: collapse;
        border: 0.75pt solid #000;
        font-size: 11pt;
        text-align: center;
      }
      .grid-ans-table td {
        border: 0.75pt solid #000;
        padding: 2pt 4pt;
      }
      .col-lbl {
        font-weight: bold;
        background: #eee;
        width: 40px;
      }
      .ans-detail-item {
        break-inside: avoid;
        margin-bottom: 8pt;
        padding-bottom: 6pt;
        border-bottom: 0.5pt dashed #ccc;
      }
      .ans-badge {
        font-weight: bold;
        border: 0.75pt solid #000;
        padding: 1pt 4pt;
      }
      .katex {
        font-size: 1em !important;
      }
    </style>
  `;

  return printStyles + fragments.join('\n');
}

/**
 * Thực hiện in đề (window.print)
 */
export function executePrint(
  exam: Exam,
  config: ExamConfig,
  options: ExportOptions
): void {
  let mountEl = document.getElementById(PRINT_CONTAINER_ID);
  if (!mountEl) {
    mountEl = document.createElement('div');
    mountEl.id = PRINT_CONTAINER_ID;
    document.body.appendChild(mountEl);
  }

  mountEl.innerHTML = buildPrintHtml(exam, config, options);
  document.body.classList.add('is-printing-custom');

  setTimeout(() => {
    window.print();

    const cleanup = () => {
      document.body.classList.remove('is-printing-custom');
      if (mountEl) {
        mountEl.innerHTML = '';
      }
      window.removeEventListener('afterprint', cleanup);
    };

    window.addEventListener('afterprint', cleanup);
    setTimeout(cleanup, 4000);
  }, 250);
}

/**
 * Thực hiện xuất PDF (mở hộp thoại in với tiêu đề file gợi ý)
 */
export function executeExportPdf(
  exam: Exam,
  config: ExamConfig,
  options: ExportOptions
): string {
  const suggestedFileName = generateExportFileName(exam, config, options.selectedVersionCode, '');
  const originalTitle = document.title;

  document.title = suggestedFileName;

  let mountEl = document.getElementById(PRINT_CONTAINER_ID);
  if (!mountEl) {
    mountEl = document.createElement('div');
    mountEl.id = PRINT_CONTAINER_ID;
    document.body.appendChild(mountEl);
  }

  mountEl.innerHTML = buildPrintHtml(exam, config, options);
  document.body.classList.add('is-printing-custom');

  setTimeout(() => {
    window.print();

    const cleanup = () => {
      document.title = originalTitle;
      document.body.classList.remove('is-printing-custom');
      if (mountEl) {
        mountEl.innerHTML = '';
      }
      window.removeEventListener('afterprint', cleanup);
    };

    window.addEventListener('afterprint', cleanup);
    setTimeout(cleanup, 4000);
  }, 250);

  return suggestedFileName;
}
