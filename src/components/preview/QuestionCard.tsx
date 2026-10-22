import React, { useState } from 'react';
import {
  Edit3,
  RefreshCw,
  Trash2,
  Plus,
  AlertTriangle,
  HelpCircle,
  Lock,
  Unlock,
  FolderPlus,
  Check,
} from 'lucide-react';
import { Question } from '../../types';
import { MathText } from '../MathText';
import { FigureView } from '../FigureView';
import { useExamStore } from '../../store';

interface QuestionCardProps {
  index: number;
  question: Question;
  showScore?: boolean;
  auditNotes?: string[];
  isRegenerating?: boolean;
  onEdit: () => void;
  onRegenerate: (customHint?: string) => void;
  onDelete: () => void;
  onInsertAfter: () => void;
  mode?: 'EXAM' | 'ANSWERS' | 'SCORING';
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  index,
  question,
  showScore = true,
  auditNotes,
  isRegenerating = false,
  onEdit,
  onRegenerate,
  onDelete,
  onInsertAfter,
  mode = 'EXAM',
}) => {
  const [showConfirmDelete, setShowConfirmDelete] = useState<boolean>(false);
  const [showRegenerateBox, setShowRegenerateBox] = useState<boolean>(false);
  const [regenerateHint, setRegenerateHint] = useState<string>('');
  const [showUnlockModal, setShowUnlockModal] = useState<boolean>(false);
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);

  // Lưu vào ngân hàng câu hỏi
  const { saveQuestionToBankAction } = useExamStore();
  const [isSavedToBank, setIsSavedToBank] = useState<boolean>(false);
  const [duplicatePrompt, setDuplicatePrompt] = useState<boolean>(false);
  const [isSavingBank, setIsSavingBank] = useState<boolean>(false);

  const handleSaveToBank = async (force: boolean = false) => {
    setIsSavingBank(true);
    setDuplicatePrompt(false);
    try {
      const res = await saveQuestionToBankAction(question, force);
      if (res.isDuplicate && !force) {
        setDuplicatePrompt(true);
      } else if (res.success) {
        setIsSavedToBank(true);
        setTimeout(() => setIsSavedToBank(false), 2500);
      }
    } finally {
      setIsSavingBank(false);
    }
  };

  const hasAuditWarning = (auditNotes && auditNotes.length > 0) || question.needsReview;
  const reviewMessage =
    question.reviewNote || (auditNotes && auditNotes.join(' • ')) || 'Cần giáo viên kiểm tra nội dung';

  return (
    <div
      id={`question-card-${index}`}
      style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
      className={`group relative p-4 rounded-xl border transition-all ${
        isRegenerating
          ? 'border-blue-300 bg-blue-50/30 ring-2 ring-blue-300'
          : hasAuditWarning
          ? 'border-amber-300 bg-amber-50/25 ring-1 ring-amber-200/50'
          : 'border-slate-200/80 hover:border-slate-300 bg-white'
      } print:border-none print:p-0 print:my-4 print:bg-transparent print:break-inside-avoid`}
    >
      {/* Banner đang tạo lại câu hỏi */}
      {isRegenerating && (
        <div className="mb-2.5 p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 text-xs flex items-center justify-between print:hidden animate-pulse">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
            <span className="font-bold">Đang dùng Gemini AI tạo lại Câu {index}...</span>
          </div>
          <span className="text-[11px] text-blue-700">Giữ nguyên dạng, mức độ & điểm số</span>
        </div>
      )}

      {/* Cảnh báo audit "Cần GV kiểm tra" */}
      {!isRegenerating && hasAuditWarning && (
        <div
          title={reviewMessage}
          className="mb-2.5 p-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs flex items-center justify-between print:hidden"
        >
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 font-bold bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded text-[11px] border border-amber-300">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
              <span>⚠ Cần GV kiểm tra</span>
            </span>
            <span className="text-[11px] text-amber-800 leading-tight">{reviewMessage}</span>
          </div>
        </div>
      )}

      {/* Dòng câu hỏi và Toolbar */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 text-[13px] sm:text-sm text-slate-900 leading-relaxed font-serif">
          <span className="font-bold text-slate-900 mr-1">
            Câu {index}.
            {showScore && (
              <span className="font-normal italic text-slate-600 text-xs ml-1">
                ({question.score.toFixed(2)} điểm)
              </span>
            )}
            :
          </span>
          <MathText content={question.question} className="inline text-slate-900 font-serif" />
        </div>

        {/* Thanh công cụ thao tác nhỏ bên phải (Ẩn khi in ấn) */}
        <div className="flex items-center gap-1 print:hidden opacity-90 group-hover:opacity-100 transition-opacity shrink-0">
          {/* Badge GV tự nhập nếu do giáo viên biên soạn */}
          {question.isTeacherWritten && (
            <span
              className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200"
              title="Câu hỏi do giáo viên tự nhập hoặc đã chỉnh sửa"
            >
              GV tự nhập
            </span>
          )}

          {/* Badge Mức độ */}
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
              question.level === 'NB'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : question.level === 'TH'
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : question.level === 'VD'
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}
            title={`Mức độ nhận thức: ${question.level}`}
          >
            {question.level}
          </span>

          {/* Nút Tạo lại (Bị khóa nếu câu do GV tự nhập trừ khi GV tự mở khóa) */}
          {question.isTeacherWritten && !isUnlocked ? (
            <button
              type="button"
              onClick={() => setShowUnlockModal(true)}
              disabled={isRegenerating}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-500 hover:text-amber-800 hover:bg-amber-50 rounded-md border border-slate-200 bg-slate-50/80 transition-colors"
              title="Câu GV tự nhập (Đã khóa tạo lại để tránh AI ghi đè). Bấm để mở khóa nếu bạn muốn đổi câu này bằng AI."
            >
              <Lock className="w-3 h-3 text-amber-600" />
              <span className="hidden sm:inline">Tạo lại (Khóa)</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowRegenerateBox(!showRegenerateBox)}
              disabled={isRegenerating}
              className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md border transition-colors disabled:opacity-50 ${
                showRegenerateBox
                  ? 'bg-blue-100 text-blue-800 border-blue-300'
                  : 'text-slate-600 hover:text-blue-700 hover:bg-blue-50 border-slate-200 bg-white'
              }`}
              title="Đổi câu này (Dùng Gemini AI sinh lại nội dung mới, giữ nguyên ô ma trận)"
            >
              <RefreshCw className={`w-3 h-3 ${isRegenerating ? 'animate-spin text-blue-600' : ''}`} />
              <span className="hidden sm:inline">
                {isUnlocked ? 'Tạo lại (Mở)' : 'Tạo lại'}
              </span>
            </button>
          )}

          {/* Nút Chỉnh sửa */}
          <button
            type="button"
            onClick={onEdit}
            disabled={isRegenerating}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded-md border border-slate-200 bg-white transition-colors"
            title="Chỉnh sửa chi tiết nội dung, đáp án và lời giải câu hỏi này"
          >
            <Edit3 className="w-3 h-3" />
            <span className="hidden sm:inline">Chỉnh sửa</span>
          </button>

          {/* Nút Thêm câu */}
          <button
            type="button"
            onClick={onInsertAfter}
            disabled={isRegenerating}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-md border border-slate-200 bg-white transition-colors"
            title="Thêm câu hỏi mới vào sau câu này (AI tạo hoặc tự nhập)"
          >
            <Plus className="w-3 h-3" />
            <span className="hidden sm:inline">Thêm câu</span>
          </button>

          {/* Nút Lưu vào ngân hàng câu hỏi */}
          <button
            type="button"
            onClick={() => handleSaveToBank(false)}
            disabled={isSavingBank || isRegenerating}
            className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md border transition-colors ${
              isSavedToBank
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                : 'text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 border-slate-200 bg-white'
            }`}
            title="Lưu câu hỏi này vào Ngân hàng câu hỏi"
          >
            {isSavedToBank ? (
              <Check className="w-3 h-3 text-emerald-600" />
            ) : (
              <FolderPlus className="w-3 h-3 text-indigo-600" />
            )}
            <span className="hidden sm:inline">
              {isSavedToBank ? 'Đã lưu' : 'Lưu vào NH'}
            </span>
          </button>

          {/* Nút Xóa */}
          <button
            type="button"
            onClick={() => setShowConfirmDelete(true)}
            disabled={isRegenerating}
            className="inline-flex items-center gap-1 px-1.5 py-1 text-[11px] font-medium text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md border border-slate-200 bg-white transition-colors"
            title="Xóa câu hỏi này khỏi đề thi"
          >
            <Trash2 className="w-3 h-3" />
            <span className="hidden sm:inline">Xóa</span>
          </button>
        </div>
      </div>

      {/* Cảnh báo trùng câu hỏi khi lưu vào ngân hàng */}
      {duplicatePrompt && (
        <div className="mt-2.5 p-2.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex flex-wrap items-center justify-between gap-2 print:hidden animate-in fade-in">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong>Cảnh báo:</strong> Câu {index} đã có nội dung trùng lặp trong Ngân hàng câu hỏi.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDuplicatePrompt(false)}
              className="px-2.5 py-1 text-slate-600 bg-white border border-slate-300 rounded-lg text-[11px]"
            >
              Bỏ qua
            </button>
            <button
              type="button"
              onClick={() => handleSaveToBank(true)}
              className="px-2.5 py-1 text-white bg-amber-600 hover:bg-amber-700 font-bold rounded-lg text-[11px] shadow-2xs"
            >
              Vẫn lưu bản sao
            </button>
          </div>
        </div>
      )}

      {/* Hộp xác nhận mở khóa câu giáo viên tự nhập */}
      {showUnlockModal && !isRegenerating && (
        <div className="mt-3 p-3 bg-amber-50/90 border border-amber-300 rounded-xl space-y-2 text-xs print:hidden animate-in fade-in">
          <div className="flex items-center gap-2 text-amber-900 font-bold text-[12px]">
            <Lock className="w-4 h-4 text-amber-700 shrink-0" />
            <span>MỞ KHÓA TẠO LẠI CÂU {index} (DO GIÁO VIÊN BIÊN SOẠN)</span>
          </div>
          <p className="text-[11px] text-amber-800 leading-relaxed">
            Câu hỏi này được đánh dấu là <strong>GV tự nhập</strong> hoặc đã được chỉnh sửa. Để tránh AI ghi đè làm mất công sức của thầy/cô, câu hỏi này mặc định được khóa bảo vệ. Nếu thầy/cô muốn dùng AI sinh lại nội dung mới cho ô này, vui lòng xác nhận mở khóa.
          </p>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowUnlockModal(false)}
              className="px-2.5 py-1 text-slate-600 hover:bg-white rounded border border-slate-300 text-[11px]"
            >
              Giữ nguyên (Hủy)
            </button>
            <button
              type="button"
              onClick={() => {
                setShowUnlockModal(false);
                setIsUnlocked(true);
                setShowRegenerateBox(true);
              }}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold text-[11px] shadow-2xs flex items-center gap-1"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>Mở khóa & Tạo lại với AI</span>
            </button>
          </div>
        </div>
      )}

      {/* Hộp nhập "Yêu cầu riêng cho câu này" khi bấm Tạo lại */}
      {showRegenerateBox && !isRegenerating && (
        <div className="mt-3 p-3 bg-blue-50/80 border border-blue-200 rounded-xl space-y-2 text-xs print:hidden animate-in fade-in">
          <div className="flex items-center justify-between text-blue-900 font-bold text-[11px]">
            <span>TẠO LẠI CÂU {index} VỚI AI (Giữ nguyên dạng {question.type}, mức {question.level}, {question.score}đ)</span>
            <button
              type="button"
              onClick={() => setShowRegenerateBox(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Yêu cầu riêng cho câu này (Không bắt buộc):
            </label>
            <input
              type="text"
              value={regenerateHint}
              onChange={(e) => setRegenerateHint(e.target.value)}
              placeholder="VD: Cho bài toán gắn liền thực tế, hoặc đổi sang dạng số liệu chẵn..."
              className="w-full px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowRegenerateBox(false)}
              className="px-2.5 py-1 text-slate-600 hover:bg-white rounded border border-slate-300 text-[11px]"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={() => {
                setShowRegenerateBox(false);
                onRegenerate(regenerateHint.trim() || undefined);
              }}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-[11px] shadow-2xs flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Tạo lại với AI</span>
            </button>
          </div>
        </div>
      )}

      {/* Xác nhận xóa câu hỏi */}
      {showConfirmDelete && (
        <div className="mt-2 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs flex items-center justify-between text-rose-900 print:hidden animate-in fade-in">
          <span>Bạn có chắc chắn muốn xóa Câu {index} này khỏi đề?</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowConfirmDelete(false)}
              className="px-2 py-1 text-slate-600 hover:bg-white rounded border border-slate-300 bg-slate-50 text-[11px]"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={() => {
                setShowConfirmDelete(false);
                onDelete();
              }}
              className="px-2.5 py-1 text-white bg-rose-600 hover:bg-rose-700 rounded text-[11px] font-bold shadow-xs"
            >
              Xác nhận xóa
            </button>
          </div>
        </div>
      )}

      {/* Hình vẽ / Đồ thị minh họa FigureView (nếu có, không có text giữ chỗ, ưu tiên imageData) */}
      <FigureView
        figure={question.figure}
        svgDiagram={question.svgDiagram}
        imageData={question.imageData}
      />

      {/* Hiển thị nội dung theo từng dạng câu hỏi */}

      {/* 1. Trắc nghiệm 4 lựa chọn (MCQ4 / MCQ_MULTI) */}
      {(question.type === 'MCQ4' || question.type === 'MCQ_MULTI') && question.options && (
        <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 pl-4 text-[13px] font-serif">
          {question.options.map((opt, i) => {
            const letter = ['A', 'B', 'C', 'D'][i] || `${i + 1}`;
            const cleanText = opt.replace(/^[A-D]\.\s*/i, '');
            const isCorrectOption = mode === 'ANSWERS' && question.correctAnswer?.toUpperCase().includes(letter);

            return (
              <div
                key={i}
                className={`flex items-baseline gap-1.5 ${
                  isCorrectOption ? 'text-emerald-700 font-bold bg-emerald-50 px-2 py-1 rounded' : 'text-slate-800'
                }`}
              >
                <span className="font-bold">{letter}.</span>
                <MathText content={cleanText} className="font-serif inline" />
              </div>
            );
          })}
        </div>
      )}

      {/* 2. Đúng / Sai CLUSTER4 */}
      {question.type === 'TRUE_FALSE' && question.statements && (
        <div className="mt-3 pl-2 sm:pl-4">
          <table className="w-full text-xs font-serif border border-slate-300 rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-slate-100 text-slate-700 border-b border-slate-300 font-bold">
                <th className="py-1.5 px-3 text-left">Ý / Lệnh hỏi</th>
                <th className="py-1.5 px-3 w-16 text-center border-l border-slate-300">Đúng</th>
                <th className="py-1.5 px-3 w-16 text-center border-l border-slate-300">Sai</th>
              </tr>
            </thead>
            <tbody>
              {question.statements.map((st) => (
                <tr key={st.id} className="border-b border-slate-200 last:border-b-0 hover:bg-slate-50/50">
                  <td className="py-2 px-3 text-slate-900">
                    <strong className="mr-1.5 font-bold">{st.id})</strong>
                    <MathText content={st.statement} className="inline font-serif" />
                  </td>
                  <td className="py-2 px-3 text-center border-l border-slate-200">
                    {mode === 'ANSWERS' ? (
                      st.isCorrect ? (
                        <span className="font-bold text-emerald-600">✓</span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )
                    ) : (
                      <span className="w-4 h-4 rounded-full border border-slate-400 inline-block align-middle"></span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-center border-l border-slate-200">
                    {mode === 'ANSWERS' ? (
                      !st.isCorrect ? (
                        <span className="font-bold text-rose-600">✓</span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )
                    ) : (
                      <span className="w-4 h-4 rounded-full border border-slate-400 inline-block align-middle"></span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 3. Ghép nối MATCHING */}
      {question.type === 'MATCHING' && question.pairs && (
        <div className="mt-3 pl-2 sm:pl-4">
          <table className="w-full text-xs font-serif border border-slate-300 rounded-lg">
            <thead>
              <tr className="bg-slate-100 text-slate-700 border-b border-slate-300 font-bold">
                <th className="py-1.5 px-3 text-left w-1/2">Cột A</th>
                <th className="py-1.5 px-3 text-left w-1/2 border-l border-slate-300">Cột B</th>
              </tr>
            </thead>
            <tbody>
              {question.pairs.map((p, i) => (
                <tr key={p.id || i} className="border-b border-slate-200 last:border-b-0">
                  <td className="py-2 px-3 text-slate-900">
                    <strong className="mr-1">{i + 1}.</strong>
                    <MathText content={p.left} className="inline font-serif" />
                  </td>
                  <td className="py-2 px-3 text-slate-900 border-l border-slate-200">
                    <strong className="mr-1">{String.fromCharCode(65 + i)}.</strong>
                    <MathText content={p.right} className="inline font-serif" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 4. Điền khuyết FILL_BLANK & Trả lời ngắn */}
      {(question.type === 'FILL_BLANK' || question.type === 'SHORT_ANSWER') && mode === 'EXAM' && (
        <div className="mt-2.5 pl-4 text-xs font-serif text-slate-600 italic">
          Trả lời: ........................................................................................................................................
        </div>
      )}

      {/* 5. Tự luận ESSAY */}
      {question.type === 'ESSAY' && mode === 'EXAM' && (
        <div className="mt-3 pl-4 space-y-2">
          {question.scoringGuide && (
            <div className="text-[11px] text-slate-500 italic">
              * Gợi ý yêu cầu cần đạt: {question.scoringGuide}
            </div>
          )}
          <div className="h-24 border border-dashed border-slate-300 rounded-lg bg-slate-50/30 p-2.5 text-[11px] text-slate-400 italic">
            (Học sinh trình bày bài làm tự luận vào giấy thi)
          </div>
        </div>
      )}

      {/* Hiển thị thêm cho Tab Đáp án hoặc Lời giải */}
      {(mode === 'ANSWERS' || mode === 'SCORING') && (
        <div className="mt-3 pt-3 border-t border-slate-200/80 bg-slate-50/60 p-3 rounded-lg text-xs space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">Đáp án chuẩn:</span>
            <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              {question.correctAnswer || '(Chưa có)'}
            </span>
          </div>

          {question.explanation && (
            <div>
              <strong className="text-slate-800 block mb-1">Hướng dẫn giải / Lời giải chi tiết:</strong>
              <MathText content={question.explanation} className="text-slate-700 text-xs leading-relaxed" />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
