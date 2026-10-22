import React from 'react';
import { CheckCircle2, Edit3, RefreshCw } from 'lucide-react';
import { Exam, ExamConfig, Question } from '../../types';
import { MathText } from '../MathText';
import { FigureView } from '../FigureView';

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

  return (
    <div className="space-y-6 max-w-[210mm] mx-auto bg-white p-6 sm:p-10 rounded-xl border border-slate-300 shadow-md font-serif print:shadow-none print:border-none print:p-0">
      {/* Header */}
      <div className="border-b-2 border-slate-900 pb-4 text-center">
        <p className="font-bold uppercase tracking-wider text-slate-800 text-xs">
          {config.schoolName || 'TRƯỜNG THPT / THCS / TIỂU HỌC'}
        </p>
        <h2 className="font-bold uppercase text-base sm:text-lg text-slate-950 mt-1">
          HỆ THỐNG ĐÁP ÁN & HƯỚNG DẪN GIẢI CHI TIẾT
        </h2>
        <p className="text-xs text-slate-700 italic mt-0.5">
          {exam.title} — MÃ ĐỀ: <strong className="text-blue-900 font-mono">{activeVersionCode}</strong> — Thang điểm: {config.scale || 10} điểm
        </p>
      </div>

      {/* 1. BẢNG ĐÁP ÁN TRẮC NGHIỆM DẠNG LƯỚI (Câu | Đáp án) */}
      {mcqQuestions.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-xs uppercase tracking-wide">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>1. Bảng tra nhanh đáp án trắc nghiệm:</span>
          </div>

          <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5 border border-slate-300 rounded-lg p-2 bg-slate-50/70">
            {mcqQuestions.map((q) => {
              const fullIndex = questions.findIndex((item) => item.id === q.id) + 1;
              return (
                <div
                  key={q.id}
                  className="bg-white border border-slate-200 rounded p-1 text-center shadow-2xs hover:border-blue-400 transition-colors"
                >
                  <div className="text-[10px] text-slate-500 font-bold">Câu {fullIndex}</div>
                  <div className="text-sm font-bold text-blue-700 font-mono">
                    {q.correctAnswer || '-'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. CHI TIẾT ĐÁP ÁN VÀ LỜI GIẢI TỪNG CÂU */}
      <div className="space-y-4 pt-2">
        <div className="font-bold text-slate-900 text-xs uppercase tracking-wide border-b border-slate-200 pb-1.5">
          2. Chi tiết đáp án và lời giải sư phạm từng câu:
        </div>

        <div className="space-y-4 divide-y divide-slate-200">
          {questions.map((q, idx) => (
            <div
              key={q.id}
              style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
              className="pt-4 first:pt-0 space-y-2 print:break-inside-avoid"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-xs sm:text-[13px] font-bold text-slate-900">
                  <span>Câu {idx + 1} ({q.score.toFixed(2)}đ) [{q.type} - {q.level}]: </span>
                  <MathText content={q.question} className="font-normal inline ml-1" />
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
                    className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors disabled:opacity-50"
                    title="Dùng AI sinh lại"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${regeneratingId === q.id ? 'animate-spin text-blue-600' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Hình vẽ / Đồ thị minh họa nếu có */}
              <FigureView figure={q.figure} svgDiagram={q.svgDiagram} imageData={q.imageData} />

              {/* Chi tiết đáp án theo dạng */}
              <div className="bg-slate-50/80 rounded-lg border border-slate-200 p-3 text-xs space-y-2">
                {/* Đúng/Sai: Hiển thị từng ý a, b, c, d */}
                {q.type === 'TRUE_FALSE' && q.statements && (
                  <div>
                    <span className="font-bold text-slate-800 block mb-1">Đáp án các mệnh đề:</span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {q.statements.map((st) => (
                        <div
                          key={st.id}
                          className={`p-1.5 rounded border text-center font-semibold ${
                            st.isCorrect
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : 'bg-rose-50 text-rose-800 border-rose-300'
                          }`}
                        >
                          Ý {st.id}): {st.isCorrect ? 'ĐÚNG (Đ)' : 'SAI (S)'}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Điền khuyết / Trả lời ngắn / MCQ */}
                {q.type !== 'TRUE_FALSE' && q.type !== 'ESSAY' && (
                  <div className="flex items-baseline gap-2">
                    <span className="font-bold text-slate-800">Đáp án chuẩn:</span>
                    <span className="font-bold text-blue-800 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200 font-mono">
                      {q.correctAnswer}
                    </span>
                  </div>
                )}

                {/* Ghép nối */}
                {q.type === 'MATCHING' && q.pairs && (
                  <div>
                    <span className="font-bold text-slate-800 block mb-1">Cặp ghép nối:</span>
                    <div className="space-y-1">
                      {q.pairs.map((p, i) => (
                        <div key={p.id || i} className="text-slate-700">
                          <strong>{i + 1}</strong> nối với <strong>{String.fromCharCode(65 + i)}</strong> ({p.left} → {p.right})
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Lời giải / Gợi ý giải */}
                {q.explanation && (
                  <div className="pt-2 border-t border-slate-200">
                    <strong className="text-slate-900 block mb-1">
                      {q.type === 'ESSAY' ? 'Gợi ý / Lời giải chi tiết:' : 'Giải thích sư phạm:'}
                    </strong>
                    <MathText content={q.explanation} className="text-slate-800 leading-relaxed" />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
