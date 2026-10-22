import React, { useState } from 'react';
import { X, Sparkles, PenTool, Check, Loader2, Eye, HelpCircle, AlertTriangle } from 'lucide-react';
import { BlueprintSlot, ExamConfig, Level, Question, QuestionType, QuestionImageData } from '../../types';
import { QUESTION_TYPE_LABELS, LEVEL_LABELS } from '../../config';
import { MathText } from '../MathText';
import { ImageAttachmentEditor } from './ImageAttachmentEditor';
import { regenerateSlotWithContext } from '../../services/gemini';

interface AddQuestionModalProps {
  insertIndex: number;
  config: ExamConfig;
  existingQuestions: Question[];
  onInsert: (question: Partial<Question>) => void;
  onClose: () => void;
}

export const AddQuestionModal: React.FC<AddQuestionModalProps> = ({
  insertIndex,
  config,
  existingQuestions,
  onInsert,
  onClose,
}) => {
  const [mode, setMode] = useState<'AI' | 'MANUAL'>('AI');
  const [type, setType] = useState<QuestionType>('MCQ4');
  const [level, setLevel] = useState<Level>('NB');
  const [score, setScore] = useState<number>(0.25);
  const [topic, setTopic] = useState<string>(config.topicName || 'Kiến thức trọng tâm');

  // AI creation state
  const [customHint, setCustomHint] = useState<string>('');
  const [isAiGenerating, setIsAiGenerating] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Manual creation state
  const [question, setQuestion] = useState<string>('');
  const [correctAnswer, setCorrectAnswer] = useState<string>('A');
  const [explanation, setExplanation] = useState<string>('');
  const [scoringGuide, setScoringGuide] = useState<string>('');
  const [options, setOptions] = useState<string[]>([
    'A. Lựa chọn A',
    'B. Lựa chọn B',
    'C. Lựa chọn C',
    'D. Lựa chọn D',
  ]);
  const [statements, setStatements] = useState([
    { id: 'a', statement: 'Mệnh đề a...', isCorrect: true },
    { id: 'b', statement: 'Mệnh đề b...', isCorrect: false },
    { id: 'c', statement: 'Mệnh đề c...', isCorrect: true },
    { id: 'd', statement: 'Mệnh đề d...', isCorrect: false },
  ]);
  const [showPreview, setShowPreview] = useState<boolean>(true);
  const [imageData, setImageData] = useState<QuestionImageData | undefined>(undefined);
  const [needsReview, setNeedsReview] = useState<boolean>(false);
  const [reviewNote, setReviewNote] = useState<string | undefined>(undefined);

  // Xử lý tạo câu hỏi mới bằng AI
  const handleGenerateWithAi = async () => {
    setIsAiGenerating(true);
    setAiError(null);

    const tempSlot: BlueprintSlot = {
      id: `slot_new_${Date.now()}`,
      orderNumber: insertIndex + 1,
      questionType: type,
      level,
      topic: topic.trim() || config.topicName || 'Kiến thức trọng tâm',
      score,
      learningOutcome: `Mức độ ${level} môn ${config.subject}`,
    };

    try {
      const generated = await regenerateSlotWithContext(
        tempSlot,
        config,
        existingQuestions,
        customHint
      );
      onInsert(generated);
      onClose();
    } catch (err: any) {
      setAiError(err?.message || 'Không thể tạo câu hỏi bằng AI. Vui lòng thử lại.');
    } finally {
      setIsAiGenerating(false);
    }
  };

  // Xử lý lưu câu tự nhập
  const handleSaveManual = (e: React.FormEvent) => {
    e.preventDefault();
    onInsert({
      id: `q_manual_${Date.now()}`,
      slotId: `slot_manual_${Date.now()}`,
      subject: config.customSubject?.trim() || config.subject || 'Môn học',
      topic: topic.trim(),
      type,
      level,
      score,
      question: question.trim(),
      options: type === 'MCQ4' || type === 'MCQ_MULTI' ? options : undefined,
      statements: type === 'TRUE_FALSE' ? statements : undefined,
      correctAnswer: correctAnswer.trim(),
      explanation: explanation.trim(),
      scoringGuide: scoringGuide.trim(),
      needsReview,
      reviewNote,
      isTeacherWritten: true,
      imageData: imageData?.dataUrl ? imageData : undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full my-8 max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="font-bold text-sm text-slate-900">
              Thêm câu hỏi mới (Chèn sau Câu {insertIndex})
            </h3>
            <p className="text-[11px] text-slate-500">
              Chọn cấu trúc ô ma trận, sau đó chọn sinh bằng AI hoặc tự nhập tay
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 flex-1 overflow-y-auto space-y-4 text-xs">
          {/* Metadata: Dạng câu, Mức độ, Điểm, Chủ đề */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <span className="font-bold text-slate-800 block text-[11px] uppercase tracking-wide">
              1. Cấu hình ô câu hỏi cần chèn
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Dạng câu hỏi</label>
                <select
                  value={type}
                  onChange={(e) => {
                    const newType = e.target.value as QuestionType;
                    setType(newType);
                    setScore(newType === 'ESSAY' ? 2.0 : newType === 'TRUE_FALSE' ? 1.0 : 0.25);
                  }}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium"
                >
                  <option value="MCQ4">TN 4 lựa chọn</option>
                  <option value="TRUE_FALSE">Đúng / Sai (4 ý)</option>
                  <option value="SHORT_ANSWER">Trả lời ngắn</option>
                  <option value="FILL_BLANK">Điền khuyết</option>
                  <option value="MATCHING">Ghép nối</option>
                  <option value="ESSAY">Tự luận</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Mức độ nhận thức</label>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value as Level)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium"
                >
                  <option value="NB">Nhận biết (NB)</option>
                  <option value="TH">Thông hiểu (TH)</option>
                  <option value="VD">Vận dụng (VD)</option>
                  <option value="VDC">Vận dụng cao (VDC)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Điểm số</label>
                <input
                  type="number"
                  step="0.05"
                  min="0.05"
                  value={score}
                  onChange={(e) => setScore(parseFloat(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-blue-700"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Chủ đề kiến thức</label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Chủ đề bài học..."
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>
          </div>

          {/* Chọn phương thức: "AI tạo" hoặc "Tự nhập" */}
          <div className="space-y-3">
            <span className="font-bold text-slate-800 block text-[11px] uppercase tracking-wide">
              2. Chọn phương thức tạo câu hỏi
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode('AI')}
                className={`py-2.5 px-3 rounded-xl border flex items-center justify-center gap-2 font-bold transition-all ${
                  mode === 'AI'
                    ? 'bg-blue-50 border-blue-400 text-blue-700 shadow-xs'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span>AI tạo tự động</span>
              </button>

              <button
                type="button"
                onClick={() => setMode('MANUAL')}
                className={`py-2.5 px-3 rounded-xl border flex items-center justify-center gap-2 font-bold transition-all ${
                  mode === 'MANUAL'
                    ? 'bg-indigo-50 border-indigo-400 text-indigo-700 shadow-xs'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <PenTool className="w-4 h-4 text-indigo-600" />
                <span>Tự nhập nội dung</span>
              </button>
            </div>
          </div>

          {/* Nội dung theo phương thức được chọn */}
          {mode === 'AI' ? (
            <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-xl space-y-3">
              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Yêu cầu riêng cho câu này (Không bắt buộc):
                </label>
                <textarea
                  rows={3}
                  value={customHint}
                  onChange={(e) => setCustomHint(e.target.value)}
                  placeholder="Ví dụ: Cho bài toán gắn liền với thực tế, hoặc hỏi về công thức diện tích mặt cầu, không dùng số thập phân..."
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                />
                <span className="text-[11px] text-slate-500 block mt-1">
                  Gemini sẽ tự động đối chiếu với {existingQuestions.length} câu hỏi đang có để không sinh câu trùng lặp.
                </span>
              </div>

              {aiError && (
                <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs">
                  {aiError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl hover:bg-slate-100 font-medium"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={isAiGenerating}
                  onClick={handleGenerateWithAi}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isAiGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Gemini đang sinh câu hỏi...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>Tạo bằng AI & Chèn vào đề</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Form tự nhập */
            <form onSubmit={handleSaveManual} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-800">
                    Nội dung câu hỏi <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPreview(!showPreview)}
                    className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-medium"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{showPreview ? 'Ẩn xem trước' : 'Xem công thức toán'}</span>
                  </button>
                </div>
                <textarea
                  rows={3}
                  required
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Nhập nội dung câu hỏi, hỗ trợ công thức $x^2 + 1$..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                {showPreview && question.trim() && (
                  <div className="mt-1.5 p-2.5 bg-blue-50/50 rounded-xl border border-blue-200 text-slate-800">
                    <MathText content={question} />
                  </div>
                )}
              </div>

              {/* Cảnh báo Cần GV kiểm tra nếu có */}
              {needsReview && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>⚠ {reviewNote || 'Cần GV kiểm tra'}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setNeedsReview(false);
                      setReviewNote(undefined);
                    }}
                    className="text-[11px] text-amber-700 hover:text-amber-900 underline font-semibold ml-2"
                  >
                    Đánh dấu đã duyệt xong
                  </button>
                </div>
              )}

              {/* Ô Chèn ảnh giáo viên cung cấp hoặc Tạo bằng AI */}
              <ImageAttachmentEditor
                imageData={imageData}
                onChange={setImageData}
                onAiImageUsed={(newImg, note) => {
                  setImageData(newImg);
                  setNeedsReview(true);
                  setReviewNote(note);
                }}
              />

              {/* MCQ Options */}
              {(type === 'MCQ4' || type === 'MCQ_MULTI') && (
                <div className="space-y-2">
                  <label className="font-semibold text-slate-800 block">Các phương án:</label>
                  {options.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-6 font-bold text-slate-600 shrink-0">
                        {['A', 'B', 'C', 'D'][i]}.
                      </span>
                      <input
                        type="text"
                        value={opt.replace(/^[A-D]\.\s*/i, '')}
                        onChange={(e) => {
                          const updated = [...options];
                          updated[i] = `${['A', 'B', 'C', 'D'][i]}. ${e.target.value}`;
                          setOptions(updated);
                        }}
                        className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setCorrectAnswer(['A', 'B', 'C', 'D'][i])}
                        className={`px-2 py-1 rounded text-[11px] font-bold border ${
                          correctAnswer === ['A', 'B', 'C', 'D'][i]
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-slate-100 text-slate-600 border-slate-300'
                        }`}
                      >
                        {correctAnswer === ['A', 'B', 'C', 'D'][i] ? 'Đáp án đúng' : 'Chọn đúng'}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Correct answer */}
              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Đáp án chuẩn <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={correctAnswer}
                  onChange={(e) => setCorrectAnswer(e.target.value)}
                  placeholder="VD: A hoặc đáp án số hoặc văn bản..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-blue-700 font-mono"
                />
              </div>

              {/* Explanation */}
              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Lời giải chi tiết:
                </label>
                <textarea
                  rows={2}
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder="Lời giải chi tiết từng bước..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl hover:bg-slate-100 font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-xs flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Lưu & Chèn vào đề</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
