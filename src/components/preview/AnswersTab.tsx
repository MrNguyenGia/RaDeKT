import React from 'react';
import { CheckCircle2, Edit3, RefreshCw } from 'lucide-react';
import { Exam, ExamConfig, Question } from '../../types';
import { MathText } from '../MathText';
import { FigureView } from '../FigureView';
import { formatSchoolNameForHeader, formatScore, formatDepartmentForHeader, getDefaultAcademicYear } from '../../config';
import { DocPage } from '../common/DocPage';

interface AnswersTabProps {
  exam: Exam;
  config: ExamConfig;
  questions: Question[];
  activeVersionCode: string;
  onEditQuestion: (q: Question) => void;
  onRegenerateQuestion: (qId: string) => void;
  regeneratingId: string | null;
}

export const AnswersTab: React.FC<AnswersTabProps> = ({
  exam,
  config,
  questions,
  activeVersionCode,
  onEditQuestion,
  onRegenerateQuestion,
  regeneratingId,
}) => {
  // Lọc các câu trắc nghiệm khách quan
  const mcqQuestions = questions.filter(
    (q) => q.type === 'MCQ4' || q.type === 'MCQ_MULTI'
  );

  const deptDisplay = config.departmentName?.trim()
    ? formatDepartmentForHeader(config.departmentName)
    : 'SỞ GIÁO DỤC VÀ ĐÀO TẠO …………………';

  const schoolDisplay = config.schoolName?.trim()
    ? formatSchoolNameForHeader(config.schoolName)
    : 'TRƯỜNG: …………………………………';

  return (
    <div className="doc-viewport-bg py-4 px-2 sm:px-4">
      <DocPage versionCode={activeVersionCode} footerText={`Mã đề ${activeVersionCode} – Đáp án & Lời giải`}>
        {/* Header */}
        <table className="doc-header-table">
          <tbody>
            <tr>
              <td className="doc-header-left">
                <div className="text-[12pt] font-normal uppercase">{deptDisplay}</div>
                <div className="text-[12pt] font-bold uppercase mt-0.5">{schoolDisplay}</div>
                <div className="doc-short-line" />
              </td>
              <td className="doc-header-right">
                <div className="doc-exam-code-box">Mã đề: {activeVersionCode}</div>
                <div className="text-[14pt] font-bold uppercase tracking-wide">
                  ĐÁP ÁN & LỜI GIẢI CHI TIẾT
                </div>
                <div className="text-[12pt] font-semibold mt-0.5">
                  {(config.customSubject?.trim() || config.subject || 'MÔN HỌC').toUpperCase()}
                  {config.grade ? ` – LỚP ${config.grade}` : ''}
                </div>
                <div className="text-[11pt] text-slate-700 italic mt-0.5">
                  Thang điểm: {formatScore(config.scale || 10)} điểm – Năm học: {config.academicYear || getDefaultAcademicYear()}
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* 1. BẢNG ĐÁP ÁN TRẮC NGHIỆM DẠNG LƯỚI */}
        {mcqQuestions.length > 0 && (
          <div className="my-4">
            <div className="doc-section-header mb-1 text-[12pt]">
              I. BẢNG ĐÁP ÁN TRẮC NGHIỆM NHANH
            </div>

            <table className="doc-table w-full text-center text-xs">
              <tbody>
                {/* Hàng số câu */}
                <tr className="bg-slate-100 font-bold">
                  <td className="w-16 py-1 bg-slate-200">Câu</td>
                  {mcqQuestions.map((q) => {
                    const fullIndex = questions.findIndex((item) => item.id === q.id) + 1;
                    return (
                      <td key={q.id} className="py-1">
                        {fullIndex}
                      </td>
                    );
                  })}
                </tr>
                {/* Hàng đáp án */}
                <tr className="font-bold text-blue-900">
                  <td className="py-1 bg-slate-200 font-bold">Đ/A</td>
                  {mcqQuestions.map((q) => (
                    <td key={q.id} className="py-1 font-bold">
                      {q.correctAnswer || '-'}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* 2. CHI TIẾT ĐÁP ÁN VÀ LỜI GIẢI TỪNG CÂU */}
        <div className="mt-5">
          <div className="doc-section-header mb-2 text-[12pt]">
            II. HƯỚNG DẪN GIẢI CHI TIẾT TỪNG CÂU
          </div>

          <div className="space-y-4">
            {questions.map((q, idx) => (
              <div
                key={q.id}
                style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
                className="doc-question-item border-b border-slate-200 pb-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="text-black">
                    <span className="font-bold">
                      Câu {idx + 1}. ({formatScore(q.score)} điểm) [{q.type} - {q.level}]:{' '}
                    </span>
                    <MathText content={q.question} className="inline ml-1" />
                  </div>

                  <div className="flex items-center gap-1 shrink-0 print:hidden">
                    <button
                      type="button"
                      onClick={() => onEditQuestion(q)}
                      className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors"
                      title="Chỉnh sửa câu hỏi & đáp án"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRegenerateQuestion(q.id)}
                      disabled={regeneratingId === q.id}
                      className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors"
                      title="Tạo lại câu này với AI"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${
                          regeneratingId === q.id ? 'animate-spin text-blue-600' : ''
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Hình vẽ nếu có */}
                {(q.imageData?.dataUrl || q.figure || q.svgDiagram) && (
                  <FigureView
                    figure={q.figure}
                    svgDiagram={q.svgDiagram}
                    imageData={q.imageData}
                  />
                )}

                {/* Khung đáp án đúng */}
                <div className="mt-1.5 flex items-center gap-2 text-xs">
                  <span className="font-bold text-slate-900">Đáp án chuẩn:</span>
                  <span className="font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 font-mono">
                    {q.correctAnswer || '(Chưa xác định)'}
                  </span>
                </div>

                {/* Lời giải chi tiết */}
                {q.explanation && (
                  <div className="mt-2 text-xs leading-relaxed text-slate-800 pl-3 border-l-2 border-blue-400">
                    <span className="font-semibold text-slate-900 block mb-0.5">
                      Hướng dẫn giải chi tiết:
                    </span>
                    <MathText content={q.explanation} className="text-slate-800 inline" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Chân trang kết thúc */}
        <div className="doc-end-notice mt-8">
          <div className="doc-end-title">— HẾT ĐÁP ÁN —</div>
        </div>
      </DocPage>
    </div>
  );
};
