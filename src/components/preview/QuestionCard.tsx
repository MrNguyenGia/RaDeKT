import React, { useState } from 'react';
import {
  Edit3,
  RefreshCw,
  Trash2,
  Plus,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  Lock,
  Unlock,
  FolderPlus,
  Check,
  Image as ImageIcon,
  X,
} from 'lucide-react';
import { Question } from '../../types';
import { MathText } from '../MathText';
import { FigureView } from '../FigureView';
import { useExamStore } from '../../store';
import { questionNeedsFigure } from '../../lib/validate';
import { ImageAttachmentEditor } from './ImageAttachmentEditor';
import { formatScore } from '../../config';

interface QuestionCardProps {
  index: number;
  question: Question;
  showScore?: boolean;
  showAnswerBox?: boolean;
  showWritingLines?: boolean;
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
  showAnswerBox = false,
  showWritingLines = false,
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
  const [showImageModal, setShowImageModal] = useState<boolean>(false);

  // Lưu vào ngân hàng câu hỏi & cập nhật câu hỏi
  const { saveQuestionToBankAction, updateQuestion } = useExamStore();
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
      className={`doc-question-item group relative transition-all ${
        isRegenerating
          ? 'p-3 rounded-lg border border-blue-300 bg-blue-50/30 ring-2 ring-blue-300'
          : hasAuditWarning
          ? 'p-3 rounded-lg border border-amber-300 bg-amber-50/20'
          : 'p-1 hover:bg-slate-50/50 rounded'
      } print:p-0 print:border-none print:bg-transparent print:break-inside-avoid`}
    >
      {/* Banner đang tạo lại câu hỏi */}
      {isRegenerating && (
        <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded text-blue-900 text-xs flex items-center justify-between print:hidden animate-pulse">
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
          className="mb-2 p-1.5 bg-amber-50 border border-amber-200 rounded text-amber-900 text-xs flex items-center justify-between print:hidden"
        >
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 font-bold bg-amber-200/80 text-amber-900 px-1.5 py-0.5 rounded text-[10px] border border-amber-300">
              <AlertTriangle className="w-3 h-3 text-amber-700" />
              <span>⚠ Cần GV kiểm tra</span>
            </span>
            <span className="text-[11px] text-amber-800 leading-tight">{reviewMessage}</span>
          </div>
        </div>
      )}

      {/* Dòng câu hỏi và Toolbar */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 text-black leading-snug">
          <span className="font-bold">Câu {index}.</span>
          {showScore && (
            <span className="font-normal italic"> ({formatScore(question.score)} điểm)</span>
          )}
          <span className="inline"> </span>
          <MathText content={question.question} className="inline" />
        </div>

        {/* Thanh công cụ thao tác nhỏ bên phải (Ẩn khi in ấn) */}
        <div className="flex items-center gap-1 print:hidden opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
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

          {/* Nút Tạo lại */}
          {question.isTeacherWritten && !isUnlocked ? (
            <button
              type="button"
              onClick={() => setShowUnlockModal(true)}
              disabled={isRegenerating}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium text-slate-500 hover:text-amber-800 hover:bg-amber-50 rounded border border-slate-200 bg-slate-50 transition-colors"
              title="Câu GV tự nhập (Đã khóa). Bấm để mở khóa tạo lại."
            >
              <Lock className="w-3 h-3 text-amber-600" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowRegenerateBox(!showRegenerateBox)}
              disabled={isRegenerating}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium rounded border transition-colors disabled:opacity-50 ${
                showRegenerateBox
                  ? 'bg-blue-100 text-blue-800 border-blue-300'
                  : 'text-slate-600 hover:text-blue-700 hover:bg-blue-50 border-slate-200 bg-white'
              }`}
              title="Đổi câu này (Dùng Gemini AI sinh lại nội dung mới)"
            >
              <RefreshCw className={`w-3 h-3 ${isRegenerating ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          )}

          {/* Nút Chỉnh sửa */}
          <button
            type="button"
            onClick={onEdit}
            disabled={isRegenerating}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded border border-slate-200 bg-white transition-colors"
            title="Chỉnh sửa câu hỏi này"
          >
            <Edit3 className="w-3 h-3" />
          </button>

          {/* Nút Thêm câu */}
          <button
            type="button"
            onClick={onInsertAfter}
            disabled={isRegenerating}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded border border-slate-200 bg-white transition-colors"
            title="Thêm câu hỏi mới sau câu này"
          >
            <Plus className="w-3 h-3" />
          </button>

          {/* Nút Lưu vào ngân hàng */}
          <button
            type="button"
            onClick={() => handleSaveToBank(false)}
            disabled={isSavingBank || isRegenerating}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium rounded border transition-colors ${
              isSavedToBank
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                : 'text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 border-slate-200 bg-white'
            }`}
            title="Lưu vào ngân hàng câu hỏi"
          >
            {isSavedToBank ? (
              <Check className="w-3 h-3 text-emerald-600" />
            ) : (
              <FolderPlus className="w-3 h-3 text-indigo-600" />
            )}
          </button>

          {/* Nút Xóa */}
          <button
            type="button"
            onClick={() => setShowConfirmDelete(true)}
            disabled={isRegenerating}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded border border-slate-200 bg-white transition-colors"
            title="Xóa câu này"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Cảnh báo trùng câu hỏi khi lưu vào ngân hàng */}
      {duplicatePrompt && (
        <div className="mt-2.5 p-2 bg-amber-50 border border-amber-300 rounded text-xs text-amber-900 flex flex-wrap items-center justify-between gap-2 print:hidden animate-in fade-in">
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
              className="px-2 py-0.5 text-slate-600 bg-white border border-slate-300 rounded text-[11px]"
            >
              Bỏ qua
            </button>
            <button
              type="button"
              onClick={() => handleSaveToBank(true)}
              className="px-2 py-0.5 text-white bg-amber-600 hover:bg-amber-700 font-bold rounded text-[11px] shadow-2xs"
            >
              Vẫn lưu
            </button>
          </div>
        </div>
      )}

      {/* Hộp xác nhận mở khóa câu giáo viên tự nhập */}
      {showUnlockModal && !isRegenerating && (
        <div className="mt-2.5 p-2.5 bg-amber-50/90 border border-amber-300 rounded space-y-2 text-xs print:hidden animate-in fade-in">
          <div className="flex items-center gap-2 text-amber-900 font-bold text-[12px]">
            <Lock className="w-4 h-4 text-amber-700 shrink-0" />
            <span>MỞ KHÓA TẠO LẠI CÂU {index} (DO GIÁO VIÊN BIÊN SOẠN)</span>
          </div>
          <p className="text-[11px] text-amber-800 leading-relaxed">
            Câu này do GV tự nhập/chỉnh sửa. Mở khóa để AI sinh lại nội dung mới?
          </p>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowUnlockModal(false)}
              className="px-2 py-0.5 text-slate-600 hover:bg-white rounded border border-slate-300 text-[11px]"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={() => {
                setShowUnlockModal(false);
                setIsUnlocked(true);
                setShowRegenerateBox(true);
              }}
              className="px-2.5 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold text-[11px] shadow-2xs flex items-center gap-1"
            >
              <Unlock className="w-3 h-3" />
              <span>Mở khóa</span>
            </button>
          </div>
        </div>
      )}

      {/* Hộp nhập "Yêu cầu riêng cho câu này" khi bấm Tạo lại */}
      {showRegenerateBox && !isRegenerating && (
        <div className="mt-2.5 p-2.5 bg-blue-50/80 border border-blue-200 rounded space-y-2 text-xs print:hidden animate-in fade-in">
          <div className="flex items-center justify-between text-blue-900 font-bold text-[11px]">
            <span>TẠO LẠI CÂU {index} (Dạng {question.type}, mức {question.level}, {formatScore(question.score)} điểm)</span>
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
              Yêu cầu riêng (Không bắt buộc):
            </label>
            <input
              type="text"
              value={regenerateHint}
              onChange={(e) => setRegenerateHint(e.target.value)}
              placeholder="VD: Bài toán gắn thực tế, số liệu đẹp..."
              className="w-full px-2.5 py-1 bg-white border border-blue-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowRegenerateBox(false)}
              className="px-2 py-0.5 text-slate-600 hover:bg-white rounded border border-slate-300 text-[11px]"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={() => {
                setShowRegenerateBox(false);
                onRegenerate(regenerateHint.trim() || undefined);
              }}
              className="px-2.5 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-[11px] shadow-2xs flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Tạo lại</span>
            </button>
          </div>
        </div>
      )}

      {/* Xác nhận xóa câu hỏi */}
      {showConfirmDelete && (
        <div className="mt-2 p-2 bg-rose-50 border border-rose-200 rounded text-xs flex items-center justify-between text-rose-900 print:hidden animate-in fade-in">
          <span>Xóa Câu {index} khỏi đề thi?</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowConfirmDelete(false)}
              className="px-2 py-0.5 text-slate-600 hover:bg-white rounded border border-slate-300 bg-slate-50 text-[11px]"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={() => {
                setShowConfirmDelete(false);
                onDelete();
              }}
              className="px-2 py-0.5 text-white bg-rose-600 hover:bg-rose-700 rounded text-[11px] font-bold shadow-xs"
            >
              Xác nhận xóa
            </button>
          </div>
        </div>
      )}

      {/* Kiểm tra câu cần hình và tình trạng dữ liệu hình */}
      {(() => {
        const needsFig = questionNeedsFigure(question);
        const hasFigData = Boolean(
          question.imageData?.dataUrl ||
          question.figure ||
          (question.svgDiagram && question.svgDiagram.trim().startsWith('<svg'))
        );

        if (needsFig && !hasFigData) {
          return (
            <div className="my-2 p-2 bg-rose-50 border border-rose-300 rounded flex items-center justify-between gap-2 text-rose-900 print:hidden animate-in fade-in">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="text-xs font-semibold">Câu này đang thiếu hình vẽ minh họa.</span>
              </div>
              <button
                type="button"
                onClick={() => setShowImageModal(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded shadow-xs cursor-pointer"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Chèn hình</span>
              </button>
            </div>
          );
        }

        if (!needsFig && !question.imageData?.dataUrl) {
          return null;
        }

        return (
          <FigureView
            figure={question.figure}
            svgDiagram={question.svgDiagram}
            imageData={question.imageData}
          />
        );
      })()}

      {/* 1. Trắc nghiệm 4 lựa chọn (MCQ4 / MCQ_MULTI) */}
      {(question.type === 'MCQ4' || question.type === 'MCQ_MULTI') && question.options && (() => {
        const cleanLengths = question.options.map((opt) => opt.replace(/^[A-D]\.\s*/i, '').trim().length);
        const maxLen = Math.max(...cleanLengths, 0);
        let gridColClass = 'doc-options-4col';
        if (maxLen > 45) {
          gridColClass = 'doc-options-1col';
        } else if (maxLen > 20) {
          gridColClass = 'doc-options-2col';
        }

        return (
          <div className={`doc-options-grid ${gridColClass}`}>
            {question.options.map((opt, i) => {
              const letter = ['A', 'B', 'C', 'D'][i] || `${i + 1}`;
              const cleanText = opt.replace(/^[A-D]\.\s*/i, '');
              const isCorrectOption = mode === 'ANSWERS' && question.correctAnswer?.toUpperCase().includes(letter);

              return (
                <div
                  key={i}
                  className={`doc-option-item ${
                    isCorrectOption ? 'font-bold text-emerald-800 bg-emerald-50/80 px-1 py-0.5 rounded' : ''
                  }`}
                >
                  <span className="doc-option-label">{letter}.</span>
                  <MathText content={cleanText} className="inline" />
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* 2. Đúng / Sai CLUSTER4 */}
      {question.type === 'TRUE_FALSE' && question.statements && (
        mode === 'EXAM' ? (
          <div className="doc-subitems">
            {question.statements.map((st) => (
              <div key={st.id} className="doc-subitem">
                <span className="font-bold">{st.id.toLowerCase()}) </span>
                <MathText content={st.statement} className="inline" />
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-2 pl-[8mm]">
            <table className="doc-table w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left">Ý / Lệnh hỏi</th>
                  <th className="w-16 text-center">Đúng</th>
                  <th className="w-16 text-center">Sai</th>
                </tr>
              </thead>
              <tbody>
                {question.statements.map((st) => (
                  <tr key={st.id}>
                    <td>
                      <strong className="mr-1.5 font-bold">{st.id.toLowerCase()})</strong>
                      <MathText content={st.statement} className="inline" />
                    </td>
                    <td className="text-center font-bold">
                      {st.isCorrect ? <span className="text-emerald-700">✓</span> : <span className="text-slate-300">-</span>}
                    </td>
                    <td className="text-center font-bold">
                      {!st.isCorrect ? <span className="text-rose-700">✓</span> : <span className="text-slate-300">-</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* 3. Ghép nối MATCHING */}
      {question.type === 'MATCHING' && question.pairs && (
        <div className="mt-2 pl-[8mm]">
          <table className="doc-table w-full text-xs">
            <thead>
              <tr>
                <th className="text-left w-1/2">Cột 1</th>
                <th className="text-left w-1/2">Cột A</th>
              </tr>
            </thead>
            <tbody>
              {question.pairs.map((p, i) => (
                <tr key={p.id || i}>
                  <td>
                    <strong className="mr-1 font-bold">{i + 1}.</strong>
                    <MathText content={p.left} className="inline" />
                  </td>
                  <td>
                    <strong className="mr-1 font-bold">{String.fromCharCode(65 + i)}.</strong>
                    <MathText content={p.right} className="inline" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 4. Điền khuyết FILL_BLANK */}
      {question.type === 'FILL_BLANK' && mode === 'EXAM' && (
        <div className="mt-1.5 pl-[8mm] text-xs text-slate-700">
          <span className="font-semibold">Chỗ trống cần điền: </span>
          <span className="inline-block border-b border-black w-36">&nbsp;</span>
        </div>
      )}

      {/* 5. Trả lời ngắn SHORT_ANSWER */}
      {question.type === 'SHORT_ANSWER' && mode === 'EXAM' && showAnswerBox && (
        <div className="mt-2 pl-[8mm] flex items-center gap-2 text-xs">
          <span className="font-semibold text-slate-900">Trả lời:</span>
          <span className="inline-block border border-black rounded px-3 py-1 min-w-[130px] text-center font-mono">
            &nbsp;
          </span>
        </div>
      )}

      {/* 6. Tự luận ESSAY */}
      {question.type === 'ESSAY' && mode === 'EXAM' && showWritingLines && (
        <div className="mt-2.5 pl-[8mm] space-y-3.5 print:my-2">
          <div className="border-b border-dashed border-slate-300 w-full h-4" />
          <div className="border-b border-dashed border-slate-300 w-full h-4" />
          <div className="border-b border-dashed border-slate-300 w-full h-4" />
          <div className="border-b border-dashed border-slate-300 w-full h-4" />
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

      {/* Modal Chèn hình nhanh ngay tại câu */}
      {showImageModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 print:hidden"
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-5 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-sm text-slate-900">Chèn hình cho Câu {index}</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowImageModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <ImageAttachmentEditor
              imageData={question.imageData}
              onChange={(newImg) => {
                updateQuestion(question.id, {
                  imageData: newImg,
                  needsReview: false,
                  reviewNote: undefined,
                });
                setShowImageModal(false);
              }}
              onAiImageUsed={(newImg) => {
                updateQuestion(question.id, {
                  imageData: newImg,
                  needsReview: false,
                  reviewNote: undefined,
                });
                setShowImageModal(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
