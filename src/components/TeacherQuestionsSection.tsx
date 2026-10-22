import React, { useState, useMemo } from 'react';
import {
  UserCheck,
  Plus,
  FileText,
  Trash2,
  Edit3,
  Sparkles,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Loader2,
  X,
  Layers,
  ArrowUpRight,
} from 'lucide-react';
import { useExamStore } from '../store';
import { Question, QuestionType, Level } from '../types';
import { QUESTION_TYPE_LABELS, LEVEL_LABELS } from '../config';
import { QuestionModal } from './preview/QuestionModal';
import { MathText } from './MathText';
import { parseQuestionsFromRawText } from '../services/gemini';
import { buildBlueprint } from '../lib/blueprint';

export const TeacherQuestionsSection: React.FC = () => {
  const {
    config,
    updateConfig,
    addTeacherQuestion,
    updateTeacherQuestion,
    removeTeacherQuestion,
    setTeacherQuestions,
  } = useExamStore();

  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [editingQuestion, setEditingQuestion] = useState<{
    isOpen: boolean;
    isNew: boolean;
    data: Partial<Question>;
    editId?: string;
  }>({
    isOpen: false,
    isNew: false,
    data: {},
  });

  // Modal dán nhiều câu và tách bằng AI
  const [isParseModalOpen, setIsParseModalOpen] = useState<boolean>(false);
  const [rawText, setRawText] = useState<string>('');
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedCandidates, setParsedCandidates] = useState<
    { selected: boolean; question: Question }[]
  >([]);

  const teacherQuestions = config.teacherQuestions || [];
  const isLocked = config.lockTeacherQuestions ?? true;

  // Xử lý mở form thêm mới từng câu
  const handleOpenAddNew = () => {
    setEditingQuestion({
      isOpen: true,
      isNew: true,
      data: {
        id: `q_teacher_${Date.now()}`,
        slotId: `slot_teacher_${Date.now()}`,
        subject: config.customSubject?.trim() || config.subject || 'Môn học',
        topic: config.topicName?.trim() || 'Chủ đề kiến thức',
        type: 'MCQ4',
        level: 'NB',
        score: 0.25,
        question: '',
        options: ['A. Lựa chọn A', 'B. Lựa chọn B', 'C. Lựa chọn C', 'D. Lựa chọn D'],
        correctAnswer: 'A',
        explanation: '',
        needsReview: false,
        isTeacherWritten: true,
      },
    });
  };

  // Xử lý sửa câu hỏi
  const handleEdit = (q: Question) => {
    setEditingQuestion({
      isOpen: true,
      isNew: false,
      data: q,
      editId: q.id,
    });
  };

  // Lưu câu hỏi từ QuestionModal
  const handleSaveQuestion = (qData: Partial<Question>) => {
    if (editingQuestion.isNew) {
      addTeacherQuestion({
        id: qData.id || `q_teacher_${Date.now()}`,
        slotId: qData.slotId || `slot_teacher_${Date.now()}`,
        subject: config.customSubject?.trim() || config.subject || 'Môn học',
        topic: qData.topic || config.topicName || 'Chủ đề kiến thức',
        type: qData.type || 'MCQ4',
        level: qData.level || 'NB',
        question: qData.question || '',
        options: qData.options,
        statements: qData.statements,
        pairs: qData.pairs,
        correctAnswer: qData.correctAnswer || '',
        explanation: qData.explanation || '',
        scoringGuide: qData.scoringGuide,
        score: qData.score ?? 0.25,
        needsReview: false,
        isTeacherWritten: true,
      });
    } else if (editingQuestion.editId) {
      updateTeacherQuestion(editingQuestion.editId, qData);
    }
    setEditingQuestion({ isOpen: false, isNew: false, data: {} });
  };

  // Xử lý gọi Gemini tách câu hỏi từ văn bản dán
  const handleParseQuestions = async () => {
    if (!rawText.trim()) return;
    setIsParsing(true);
    setParseError(null);
    try {
      const parsed = await parseQuestionsFromRawText(rawText, config);
      if (parsed.length === 0) {
        setParseError('Không nhận diện được câu hỏi nào từ văn bản. Vui lòng kiểm tra định dạng.');
      } else {
        setParsedCandidates(parsed.map((q) => ({ selected: true, question: q })));
      }
    } catch (err: any) {
      setParseError(err?.message || 'Có lỗi khi phân tích văn bản câu hỏi với AI.');
    } finally {
      setIsParsing(false);
    }
  };

  // Xác nhận thêm các câu đã chọn sau khi tách
  const handleConfirmParsedQuestions = () => {
    const selectedOnes = parsedCandidates.filter((item) => item.selected).map((item) => item.question);
    if (selectedOnes.length > 0) {
      setTeacherQuestions([...teacherQuestions, ...selectedOnes]);
    }
    setIsParseModalOpen(false);
    setRawText('');
    setParsedCandidates([]);
    setParseError(null);
  };

  // Bản thiết kế hiện tại
  const designBlueprint = useMemo(() => buildBlueprint(config), [config]);

  // Kiểm tra từng câu hỏi giáo viên xem có khớp ô nào trong bản thiết kế không
  const excessQuestions = useMemo(() => {
    if (!teacherQuestions || teacherQuestions.length === 0) return [];

    const availableSlots = [...designBlueprint];
    const excess: { index: number; question: Question }[] = [];

    teacherQuestions.forEach((q, idx) => {
      // Ưu tiên 1: Khớp dạng, mức độ, và chủ đề
      let slotIdx = availableSlots.findIndex(
        (s) =>
          s.questionType === q.type &&
          s.level === q.level &&
          s.topic &&
          q.topic &&
          s.topic.trim().toLowerCase() === q.topic.trim().toLowerCase()
      );

      // Ưu tiên 2: Khớp dạng và mức độ
      if (slotIdx === -1) {
        slotIdx = availableSlots.findIndex(
          (s) => s.questionType === q.type && s.level === q.level
        );
      }

      // Dự phòng: Khớp dạng câu
      if (slotIdx === -1) {
        slotIdx = availableSlots.findIndex((s) => s.questionType === q.type);
      }

      if (slotIdx !== -1) {
        availableSlots.splice(slotIdx, 1);
      } else {
        excess.push({ index: idx + 1, question: q });
      }
    });

    return excess;
  }, [teacherQuestions, designBlueprint]);

  // Tự động tăng số câu thiết lập cho câu hỏi thừa
  const handleAutoIncreaseConfig = (q: Question) => {
    const currentTypeCount = config.questionCountsByType?.[q.type] || 0;
    const updatedLevelCounts: Record<Level, number> = {
      NB: config.levelCounts?.NB ?? 0,
      TH: config.levelCounts?.TH ?? 0,
      VD: config.levelCounts?.VD ?? 0,
      VDC: config.levelCounts?.VDC ?? 0,
    };
    updatedLevelCounts[q.level] = (updatedLevelCounts[q.level] || 0) + 1;

    updateConfig({
      questionCountsByType: {
        ...config.questionCountsByType,
        [q.type]: currentTypeCount + 1,
      },
      levelCounts: updatedLevelCounts,
    });
  };

  // Tự động tăng cho tất cả các câu thừa
  const handleAutoIncreaseAll = () => {
    const updatedTypeCounts = { ...config.questionCountsByType };
    const updatedLevelCounts: Record<Level, number> = {
      NB: config.levelCounts?.NB ?? 0,
      TH: config.levelCounts?.TH ?? 0,
      VD: config.levelCounts?.VD ?? 0,
      VDC: config.levelCounts?.VDC ?? 0,
    };

    excessQuestions.forEach(({ question: q }) => {
      updatedTypeCounts[q.type] = (updatedTypeCounts[q.type] || 0) + 1;
      updatedLevelCounts[q.level] = (updatedLevelCounts[q.level] || 0) + 1;
    });

    updateConfig({
      questionCountsByType: updatedTypeCounts,
      levelCounts: updatedLevelCounts,
    });
  };

  // Không đưa câu này vào đề (xóa khỏi danh sách câu GV tự nhập)
  const handleExcludeQuestion = (qId: string) => {
    removeTeacherQuestion(qId);
  };

  return (
    <div className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-2xs">
      {/* Header khu vực */}
      <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
            <UserCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-slate-800">
                Câu hỏi giáo viên tự nhập
              </span>
              <span className="text-[11px] font-bold px-2 py-0.2 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                {teacherQuestions.length} câu
              </span>
            </div>
            <p className="text-[10px] text-slate-500">
              Nhập trước câu hỏi để AI bảo lưu cố định khi sinh đề
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200/60"
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {isExpanded && (
        <div className="p-3.5 space-y-3.5 text-xs">
          {/* Công tắc "Giữ nguyên câu hỏi GV tự nhập" */}
          <div className="p-2.5 rounded-xl border border-indigo-100 bg-indigo-50/50 space-y-1">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-900">
                <input
                  type="checkbox"
                  checked={isLocked}
                  onChange={(e) => updateConfig({ lockTeacherQuestions: e.target.checked })}
                  className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
                />
                <span className="text-xs">Giữ nguyên câu hỏi GV tự nhập</span>
              </label>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  isLocked
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {isLocked ? 'Đang bật' : 'Đang tắt'}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 leading-normal pl-6">
              Khi bật, các câu này được gán cố định vào đề (<code className="text-indigo-700">isTeacherWritten: true</code>). AI chỉ sinh bổ sung các câu còn thiếu theo ma trận thiết lập và không sinh câu trùng lặp.
            </p>
          </div>

          {/* Cảnh báo câu GV nhập thừa so với thiết lập (Kèm 2 lựa chọn) */}
          {excessQuestions.length > 0 && (
            <div className="p-3 rounded-xl border border-amber-300 bg-amber-50/90 space-y-2.5 text-xs animate-in fade-in">
              <div className="flex items-center justify-between text-amber-900 font-bold">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>Phát hiện {excessQuestions.length} câu hỏi thừa so với thiết lập:</span>
                </div>
                {excessQuestions.length > 1 && (
                  <button
                    type="button"
                    onClick={handleAutoIncreaseAll}
                    className="text-[10px] font-bold text-amber-800 bg-amber-200/90 hover:bg-amber-300 px-2 py-0.5 rounded border border-amber-400 transition-colors"
                  >
                    Tăng thiết lập cho tất cả
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {excessQuestions.map(({ index: qNum, question: q }) => {
                  const typeLabel = QUESTION_TYPE_LABELS[q.type]?.short || q.type;
                  const levelLabel = LEVEL_LABELS[q.level]?.short || q.level;

                  return (
                    <div
                      key={q.id}
                      className="p-2.5 rounded-lg bg-white border border-amber-200 space-y-2 shadow-2xs"
                    >
                      <div className="text-amber-950 font-medium text-[11px] leading-snug">
                        <span className="font-bold text-rose-700 mr-1">
                          Câu {qNum} (dạng {typeLabel}, mức {levelLabel}) thừa so với thiết lập
                        </span>
                        {q.question ? `– "${q.question.slice(0, 50)}..."` : ''}
                      </div>

                      <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleAutoIncreaseConfig(q)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] shadow-2xs transition-colors"
                          title="Tự động tăng số câu dạng này và mức này trong thiết lập ma trận đề thi"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Tự động tăng số câu thiết lập</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleExcludeQuestion(q.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px] border border-slate-300 transition-colors"
                          title="Xóa câu này khỏi danh sách câu GV tự nhập để đề khớp thiết lập"
                        >
                          <X className="w-3 h-3 text-slate-500" />
                          <span>Không đưa câu này vào đề</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Nhóm 2 nút hành động: Nhập từng câu & Dán tách bằng AI */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleOpenAddNew}
              className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold shadow-2xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-indigo-600" />
              <span>Nhập từng câu</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsParseModalOpen(true);
                setParsedCandidates([]);
                setParseError(null);
              }}
              className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-semibold shadow-2xs transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Dán & Tách câu hỏi</span>
            </button>
          </div>

          {/* Danh sách các câu hỏi GV đã nhập */}
          {teacherQuestions.length > 0 ? (
            <div className="space-y-2 pt-1 border-t border-slate-100">
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span className="font-semibold text-slate-700">
                  Danh sách câu hỏi đã lưu ({teacherQuestions.length}):
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Bạn có chắc muốn xóa tất cả câu hỏi tự nhập?')) {
                      setTeacherQuestions([]);
                    }
                  }}
                  className="text-rose-600 hover:text-rose-800 font-medium"
                >
                  Xóa tất cả
                </button>
              </div>

              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {teacherQuestions.map((q, idx) => {
                  const typeLabel = QUESTION_TYPE_LABELS[q.type]?.short || q.type;
                  const levelInfo = LEVEL_LABELS[q.level];

                  return (
                    <div
                      key={q.id || idx}
                      className="p-2 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-slate-50 flex items-start justify-between gap-2 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span className="font-bold text-slate-800 text-[11px]">
                            #{idx + 1}
                          </span>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-white border border-slate-300 text-slate-700">
                            {typeLabel}
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${
                              q.level === 'NB'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : q.level === 'TH'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : q.level === 'VD'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            {levelInfo?.short || q.level}
                          </span>
                          <span className="text-[10px] font-bold text-blue-700">
                            {q.score}đ
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-700 line-clamp-2 font-serif">
                          {q.question || '(Chưa có nội dung)'}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 pt-0.5">
                        <button
                          type="button"
                          onClick={() => handleEdit(q)}
                          className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="Sửa câu hỏi này"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeTeacherQuestion(q.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                          title="Xóa câu hỏi này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-lg border border-dashed border-slate-300 bg-slate-50/50 text-center text-slate-400 text-[11px]">
              Chưa có câu hỏi tự nhập nào. Bấm <strong>“Nhập từng câu”</strong> hoặc <strong>“Dán & Tách câu hỏi”</strong> để thêm.
            </div>
          )}
        </div>
      )}

      {/* Modal Chỉnh sửa / Thêm mới từng câu */}
      {editingQuestion.isOpen && (
        <QuestionModal
          initialQuestion={editingQuestion.data}
          isNew={editingQuestion.isNew}
          customTitle={
            editingQuestion.isNew
              ? 'Thêm câu hỏi do giáo viên tự nhập'
              : 'Chỉnh sửa câu hỏi giáo viên tự nhập'
          }
          customSubtitle="Nội dung sẽ được bảo lưu cố định khi sinh đề (isTeacherWritten: true)"
          onSave={handleSaveQuestion}
          onClose={() => setEditingQuestion({ isOpen: false, isNew: false, data: {} })}
        />
      )}

      {/* Modal Dán nhiều câu và Tách bằng AI */}
      {isParseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full my-8 max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header modal */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    Dán & Tách câu hỏi tự động với AI
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Dán văn bản nhiều câu hỏi, Gemini sẽ phân tách thành từng Question JSON để bạn duyệt trước khi thêm.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsParseModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 flex-1 overflow-y-auto space-y-4 text-xs">
              {parsedCandidates.length === 0 ? (
                <div className="space-y-3">
                  <label className="block font-semibold text-slate-700">
                    Dán nội dung các câu hỏi (từ Word, giáo án hoặc tài liệu):
                  </label>
                  <textarea
                    rows={8}
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder={`Ví dụ:
Câu 1. Cho biểu thức P = x^2 - 4x + 5. Giá trị nhỏ nhất của P là:
A. 1    B. 2    C. 3    D. 5
Đáp án: A. Lời giải: P = (x-2)^2 + 1 >= 1...

Câu 2 (Đúng/Sai). Cho hình lập phương ABCD.A'B'C'D' cạnh a...
a) Đường thẳng AA' vuông góc với (ABCD) - Đúng
b) ...`}
                    className="w-full p-3 border border-slate-300 rounded-xl font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />

                  {parseError && (
                    <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                      <span>{parseError}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsParseModalOpen(false)}
                      className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl hover:bg-slate-100 font-medium"
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      disabled={isParsing || !rawText.trim()}
                      onClick={handleParseQuestions}
                      className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold flex items-center gap-2 shadow-xs"
                    >
                      {isParsing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Gemini đang tách câu hỏi...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 text-amber-300" />
                          <span>Tách thành câu hỏi</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                /* Bước 2: Giáo viên xem xét và xác nhận từng câu trước khi thêm */
                <div className="space-y-4">
                  <div className="p-3 bg-indigo-50/80 border border-indigo-200 rounded-xl flex items-center justify-between text-indigo-950">
                    <div>
                      <span className="font-bold">
                        AI đã nhận diện thành công {parsedCandidates.length} câu hỏi.
                      </span>
                      <p className="text-[11px] text-indigo-800">
                        Vui lòng tích chọn các câu bạn muốn đưa vào đề kiểm tra:
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setParsedCandidates((prev) => prev.map((p) => ({ ...p, selected: true })))
                        }
                        className="text-[11px] text-indigo-700 hover:underline font-semibold"
                      >
                        Chọn tất cả
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() =>
                          setParsedCandidates((prev) => prev.map((p) => ({ ...p, selected: false })))
                        }
                        className="text-[11px] text-indigo-700 hover:underline font-semibold"
                      >
                        Bỏ chọn
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                    {parsedCandidates.map((item, idx) => (
                      <div
                        key={idx}
                        className={`p-3.5 rounded-xl border transition-all ${
                          item.selected
                            ? 'border-indigo-400 bg-indigo-50/20 ring-1 ring-indigo-200'
                            : 'border-slate-200 bg-white opacity-60'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <input
                            type="checkbox"
                            checked={item.selected}
                            onChange={(e) => {
                              const updated = [...parsedCandidates];
                              updated[idx].selected = e.target.checked;
                              setParsedCandidates(updated);
                            }}
                            className="mt-1 w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
                          />
                          <div className="flex-1 space-y-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-900">Câu {idx + 1}</span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                                {QUESTION_TYPE_LABELS[item.question.type]?.short || item.question.type}
                              </span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                {LEVEL_LABELS[item.question.level]?.short || item.question.level}
                              </span>
                              <span className="text-xs font-bold text-indigo-700">
                                {item.question.score}đ
                              </span>
                            </div>

                            <p className="text-slate-800 font-serif leading-relaxed">
                              {item.question.question}
                            </p>

                            {/* Options if MCQ */}
                            {item.question.options && item.question.options.length > 0 && (
                              <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-600 font-serif pt-1">
                                {item.question.options.map((opt, oIdx) => (
                                  <div key={oIdx} className="truncate">
                                    {opt}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Correct answer */}
                            <div className="pt-1 text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Đáp án: {item.question.correctAnswer}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setParsedCandidates([])}
                      className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
                    >
                      ← Dán lại văn bản khác
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsParseModalOpen(false)}
                        className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl hover:bg-slate-100 font-medium"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmParsedQuestions}
                        disabled={parsedCandidates.filter((p) => p.selected).length === 0}
                        className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold flex items-center gap-2 shadow-xs"
                      >
                        <UserCheck className="w-4 h-4" />
                        <span>
                          Xác nhận thêm ({parsedCandidates.filter((p) => p.selected).length} câu)
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
