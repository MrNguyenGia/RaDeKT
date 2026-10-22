import katex from 'katex';
import { Exam, ExamConfig, Question } from '../../types';
import { ExportOptions } from './types';
import { generateExportFileName, resolveTargetVersions } from './utils';
import { QUESTION_TYPE_LABELS, LEVEL_LABELS } from '../../config';

const PRINT_CONTAINER_ID = 'stem-exam-print-mount';

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

  const dept = (config.departmentName?.trim() || 'SỞ GIÁO DỤC VÀ ĐÀO TẠO').toUpperCase();
  const school = (config.schoolName?.trim() || 'TRƯỜNG THPT / THCS / TIỂU HỌC').toUpperCase();
  const title = (config.title?.trim() || 'ĐỀ KIỂM TRA ĐỊNH KỲ').toUpperCase();
  const subject = (config.customSubject?.trim() || config.subject || 'MÔN HỌC').toUpperCase();
  const grade = config.grade ? ` – KHỐI ${config.grade}` : '';
  const duration = config.durationMinutes || 45;
  const year = config.academicYear || '2024 - 2025';

  // 1. In Đề thi cho các mã đề đã chọn
  if (options.includeExam) {
    for (let vIdx = 0; vIdx < targetVersions.length; vIdx++) {
      const v = targetVersions[vIdx];
      const pageBreakClass = vIdx > 0 ? 'print-page-break' : '';

      let examHtml = `
        <div class="print-section ${pageBreakClass}">
          <!-- Đầu đề 2 cột chuẩn BGD -->
          <div class="print-header-grid">
            <div class="header-col-left">
              <div class="dept-name">${dept}</div>
              <div class="school-name">${school}</div>
              <div class="sub-year">Năm học: ${year}</div>
              <div class="divider-line"></div>
            </div>
            <div class="header-col-right">
              <div class="exam-title">${title}</div>
              <div class="exam-subject">MÔN: ${subject}${grade}</div>
              <div class="exam-duration">Thời gian làm bài: ${duration} phút <em>(không kể thời gian phát đề)</em></div>
              <div class="version-badge">Mã đề thi: ${v.code}</div>
            </div>
          </div>

          <!-- Thông tin thí sinh -->
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
                  <span>Số báo danh (SBD):</span>
                  <span class="dotted-fill"></span>
                </div>
              </div>
            </div>
            <div class="student-right">
              <div class="score-title">ĐIỂM / LỜI PHÊ</div>
            </div>
          </div>

          <p class="exam-instruction">(Thí sinh không được sử dụng tài liệu. Cán bộ coi thi không giải thích gì thêm)</p>
      `;

      // Phân tách trắc nghiệm và tự luận
      const objQs = v.questions.filter((q) => q.type !== 'ESSAY');
      const essayQs = v.questions.filter((q) => q.type === 'ESSAY');

      if (objQs.length > 0) {
        examHtml += `<div class="part-title">PHẦN I. CÂU HỎI TRẮC NGHIỆM</div>`;
        for (const q of objQs) {
          const idx = v.questions.findIndex((item) => item.id === q.id) + 1;
          const scoreText = q.score ? ` <span class="q-score">(${q.score.toFixed(2)} điểm)</span>` : '';
          
          examHtml += `
            <div class="question-item print-avoid-break">
              <div class="q-content">
                <strong>Câu ${idx}${scoreText}:</strong> ${renderFormulaHtmlForPrint(q.question)}
              </div>
          `;

          if (q.options && q.options.length > 0) {
            examHtml += `<div class="options-grid">`;
            for (const opt of q.options) {
              examHtml += `<div class="opt-item">${renderFormulaHtmlForPrint(opt)}</div>`;
            }
            examHtml += `</div>`;
          }

          if (q.statements && q.statements.length > 0) {
            examHtml += `<div class="statements-list">`;
            for (const st of q.statements) {
              examHtml += `<div class="st-item"><strong>${st.id})</strong> ${renderFormulaHtmlForPrint(st.statement)}</div>`;
            }
            examHtml += `</div>`;
          }

          if (q.pairs && q.pairs.length > 0) {
            examHtml += `<div class="pairs-list">`;
            for (let i = 0; i < q.pairs.length; i++) {
              examHtml += `<div class="pair-item">${i + 1}. ${renderFormulaHtmlForPrint(q.pairs[i].left)} &nbsp;---&nbsp; ${String.fromCharCode(65 + i)}. ${renderFormulaHtmlForPrint(q.pairs[i].right)}</div>`;
            }
            examHtml += `</div>`;
          }

          examHtml += `</div>`;
        }
      }

      if (essayQs.length > 0) {
        examHtml += `<div class="part-title">PHẦN II. CÂU HỎI TỰ LUẬN</div>`;
        for (const q of essayQs) {
          const idx = v.questions.findIndex((item) => item.id === q.id) + 1;
          const scoreText = q.score ? ` <span class="q-score">(${q.score.toFixed(2)} điểm)</span>` : '';
          
          examHtml += `
            <div class="question-item print-avoid-break">
              <div class="q-content">
                <strong>Câu ${idx}${scoreText}:</strong> ${renderFormulaHtmlForPrint(q.question)}
              </div>
            </div>
          `;
        }
      }

      examHtml += `
          <div class="exam-footer-line">-------------------------- HẾT --------------------------</div>
      `;

      if (options.includeAiNotice) {
        examHtml += `
          <div class="ai-notice-line">Đề thi được biên soạn với sự hỗ trợ của Hệ thống Sinh Đề GDPT 2018 (Google Gemini AI).</div>
        `;
      }

      examHtml += `</div>`;
      fragments.push(examHtml);
    }
  }

  // 2. In Đáp án cho các mã đề đã chọn
  if (options.includeAnswers) {
    for (const v of targetVersions) {
      let ansHtml = `
        <div class="print-section print-page-break">
          <div class="section-title">ĐÁP ÁN VÀ LỜI GIẢI CHI TIẾT – MÃ ĐỀ: ${v.code}</div>
          <table class="print-table">
            <thead>
              <tr>
                <th style="width: 15%;">Câu số</th>
                <th style="width: 35%;">Dạng câu</th>
                <th style="width: 35%;">Đáp án đúng</th>
                <th style="width: 15%;">Điểm</th>
              </tr>
            </thead>
            <tbody>
      `;

      v.questions.forEach((q, idx) => {
        ansHtml += `
          <tr>
            <td style="text-align: center;">Câu ${idx + 1}</td>
            <td>${QUESTION_TYPE_LABELS[q.type]?.short || q.type}</td>
            <td style="text-align: center; font-weight: bold;">${renderFormulaHtmlForPrint(q.correctAnswer)}</td>
            <td style="text-align: center;">${q.score.toFixed(2)}đ</td>
          </tr>
        `;
      });

      ansHtml += `
            </tbody>
          </table>

          <div class="sub-section-title">Lời giải chi tiết từng câu:</div>
      `;

      v.questions.forEach((q, idx) => {
        if (q.explanation) {
          ansHtml += `
            <div class="solution-item print-avoid-break">
              <strong>Câu ${idx + 1} (${q.correctAnswer}):</strong> ${renderFormulaHtmlForPrint(q.explanation)}
            </div>
          `;
        }
      });

      ansHtml += `</div>`;
      fragments.push(ansHtml);
    }
  }

  // 3. In Hướng dẫn chấm
  if (options.includeScoring) {
    const v = targetVersions[0] || { code: '101', questions: exam.questions };
    let scoreHtml = `
      <div class="print-section print-page-break">
        <div class="section-title">HƯỚNG DẪN CHẤM VÀ THANG BIỂU ĐIỂM</div>
    `;

    v.questions.forEach((q, idx) => {
      scoreHtml += `
        <div class="scoring-item print-avoid-break">
          <strong>Câu ${idx + 1} (${q.score.toFixed(2)} điểm):</strong> ${renderFormulaHtmlForPrint(q.scoringGuide || q.explanation || `Đáp án đúng ${q.correctAnswer}`)}
        </div>
      `;
    });

    scoreHtml += `</div>`;
    fragments.push(scoreHtml);
  }

  // 4. In Ma trận & Bản đặc tả (in khổ ngang landscape)
  if (options.includeMatrix && exam.blueprint) {
    let matrixHtml = `
      <div class="print-section print-page-break print-landscape">
        <div class="section-title">MA TRẬN ĐỀ KIỂM TRA ĐỊNH KỲ</div>
        <table class="print-table">
          <thead>
            <tr>
              <th style="width: 5%;">STT</th>
              <th style="width: 35%;">Chủ đề / Đơn vị kiến thức</th>
              <th style="width: 12%;">Nhận biết</th>
              <th style="width: 12%;">Thông hiểu</th>
              <th style="width: 12%;">Vận dụng</th>
              <th style="width: 12%;">Vận dụng cao</th>
              <th style="width: 12%;">Tổng điểm</th>
            </tr>
          </thead>
          <tbody>
    `;

    exam.blueprint.forEach((slot, idx) => {
      matrixHtml += `
        <tr>
          <td style="text-align: center;">${idx + 1}</td>
          <td>${slot.topic}</td>
          <td style="text-align: center;">${slot.level === 'NB' ? '1' : '-'}</td>
          <td style="text-align: center;">${slot.level === 'TH' ? '1' : '-'}</td>
          <td style="text-align: center;">${slot.level === 'VD' ? '1' : '-'}</td>
          <td style="text-align: center;">${slot.level === 'VDC' ? '1' : '-'}</td>
          <td style="text-align: center; font-weight: bold;">${slot.score.toFixed(2)}đ</td>
        </tr>
      `;
    });

    matrixHtml += `
          </tbody>
        </table>
      </div>
    `;
    fragments.push(matrixHtml);
  }

  if (options.includeSpec && exam.blueprint) {
    let specHtml = `
      <div class="print-section print-page-break print-landscape">
        <div class="section-title">BẢN ĐẶC TẢ MA TRẬN ĐỀ KIỂM TRA</div>
        <table class="print-table">
          <thead>
            <tr>
              <th style="width: 6%;">Câu</th>
              <th style="width: 24%;">Đơn vị kiến thức</th>
              <th style="width: 12%;">Mức độ</th>
              <th style="width: 14%;">Dạng câu</th>
              <th style="width: 36%;">Yêu cầu cần đạt</th>
              <th style="width: 8%;">Điểm</th>
            </tr>
          </thead>
          <tbody>
    `;

    exam.blueprint.forEach((slot, idx) => {
      specHtml += `
        <tr>
          <td style="text-align: center;">Câu ${idx + 1}</td>
          <td>${slot.topic}</td>
          <td style="text-align: center;">${LEVEL_LABELS[slot.level]?.short || slot.level}</td>
          <td style="text-align: center;">${QUESTION_TYPE_LABELS[slot.questionType]?.short || slot.questionType}</td>
          <td>${slot.learningOutcome || 'Chuẩn kiến thức, kỹ năng theo chương trình GDPT 2018'}</td>
          <td style="text-align: center; font-weight: bold;">${slot.score.toFixed(2)}đ</td>
        </tr>
      `;
    });

    specHtml += `
          </tbody>
        </table>
      </div>
    `;
    fragments.push(specHtml);
  }

  return fragments.join('\n');
}

/**
 * Thực hiện in đề (window.print)
 */
export function executePrint(
  exam: Exam,
  config: ExamConfig,
  options: ExportOptions
): void {
  // Gắn nội dung in vào root in ấn
  let mountEl = document.getElementById(PRINT_CONTAINER_ID);
  if (!mountEl) {
    mountEl = document.createElement('div');
    mountEl.id = PRINT_CONTAINER_ID;
    document.body.appendChild(mountEl);
  }

  mountEl.innerHTML = buildPrintHtml(exam, config, options);
  document.body.classList.add('is-printing-custom');

  // Đợi DOM & KaTeX render xong rồi gọi window.print()
  setTimeout(() => {
    window.print();

    // Dọn dẹp sau khi in
    const cleanup = () => {
      document.body.classList.remove('is-printing-custom');
      if (mountEl) {
        mountEl.innerHTML = '';
      }
      window.removeEventListener('afterprint', cleanup);
    };

    window.addEventListener('afterprint', cleanup);
    // Timeout dự phòng nếu trình duyệt không bắn sự kiện afterprint
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

  // Đổi title của tài liệu để trình duyệt tự điền tên file gợi ý khi chọn "Save as PDF"
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
