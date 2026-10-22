import React, { useState, useEffect } from 'react';
import {
  Plus,
  RotateCcw,
  RotateCw,
  Scale,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  FolderPlus,
  Check,
} from 'lucide-react';
import { useExamStore } from '../../store';
import { Exam, ExamConfig, Level, Question } from '../../types';
import { QuestionCard } from './QuestionCard';

interface ExamTabProps {
  exam: Exam;
  config: ExamConfig;
  questions: Question[];
  activeVersionCode: string;
  auditNotesMap: Map<string, string[]>;
  regeneratingId: string | null;
  onEditQuestion: (q: Question) => void;
  onRegenerateQuestion: (qId: string, customHint?: string) => void;
  onDeleteQuestion: (qId: string) => void;
  onInsertQuestion: (index: number) => void;
  onRedistributeScores: () => void;
  onUndo: () => void;
  canUndo: boolean;
  onRedo: () => void;
  canRedo: boolean;
}

export const ExamTab: React.FC<ExamTabProps> = ({
  exam,
  config,
  questions,
  activeVersionCode,
  auditNotesMap,
  regeneratingId,
  onEditQuestion,
  onRegenerateQuestion,
  onDeleteQuestion,
  onInsertQuestion,
  onRedistributeScores,
  onUndo,
  canUndo,
  onRedo,
  canRedo,
}) => {
  const [showQuestionScores, setShowQuestionScores] = useState<boolean>(true);
  const { saveAllQuestionsToBankAction } = useExamStore();
  const [isSavingAllBank, setIsSavingAllBank] = useState<boolean>(false);

  // Phím tắt bàn phím Ctrl+Z (Undo) và Ctrl+Y (Redo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          if (canRedo) {
            e.preventDefault();
            onRedo();
          }
        } else {
          if (canUndo) {
            e.preventDefault();
            onUndo();
          }
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        if (canRedo) {
          e.preventDefault();
          onRedo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canUndo, canRedo, onUndo, onRedo]);

  // Phân chia theo Phần I. Trắc nghiệm và Phần II. Tự luận
  const objectiveQuestions = questions.filter((q) => q.type !== 'ESSAY');
  const essayQuestions = questions.filter((q) => q.type === 'ESSAY');

  // Phân nhóm con trong Trắc nghiệm
  const mcqGroup = objectiveQuestions.filter((q) => q.type === 'MCQ4' || q.type === 'MCQ_MULTI');
  const tfGroup = objectiveQuestions.filter((q) => q.type === 'TRUE_FALSE');
  const matchingGroup = objectiveQuestions.filter((q) => q.type === 'MATCHING');
  const shortFillGroup = objectiveQuestions.filter(
    (q) => q.type === 'FILL_BLANK' || q.type === 'SHORT_ANSWER'
  );

  // Hàm tính số thứ tự tổng thể của câu hỏi
  const getQuestionIndex = (q: Question) => {
    return questions.findIndex((item) => item.id === q.id) + 1;
  };

  // Tính toán độ lệch điểm và số câu so với cấu hình
  const actualTotalScore = Number(
    questions.reduce((sum, q) => sum + (q.score || 0), 0).toFixed(2)
  );
  const targetScale = config.scale || 10;
  const isScoreMismatched = Math.abs(actualTotalScore - targetScale) > 0.001;
  const scoreDiff = Number((actualTotalScore - targetScale).toFixed(2));

  // Tổng số câu cấu hình dự kiến
  const expectedTotalQuestions = Object.values(config.questionCountsByType || {}).reduce(
    (sum, val) => sum + (val || 0),
    0
  );
  const isCountMismatched =
    expectedTotalQuestions > 0 && questions.length !== expectedTotalQuestions;
  const countDiff = questions.length - expectedTotalQuestions;

  // Thống kê phân bổ mức độ nhận thức thực tế
  const actualLevels: Record<Level, number> = { NB: 0, TH: 0, VD: 0, VDC: 0 };
  questions.forEach((q) => {
    if (actualLevels[q.level] !== undefined) {
      actualLevels[q.level]++;
    }
  });

  return (
    <div className="space-y-3">
      {/* ========================================================= */}
      {/* THANH TRẠNG THÁI & ĐIỀU KHIỂN ĐỀ THI (ẨN KHI IN ẤN) */}
      {/* ========================================================= */}
      <div className="max-w-[210mm] mx-auto space-y-2 print:hidden">
        {/* Hàng 1: Nút Hoàn tác/Làm lại, Trạng thái lệch & Chia lại điểm */}
        <div className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-2xs flex flex-wrap items-center justify-between gap-2 text-xs">
          {/* Nhóm Hoàn tác / Làm lại */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border font-medium transition-colors ${
                canUndo
                  ? 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-300 shadow-2xs'
                  : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
              }`}
              title="Hoàn tác thay đổi vừa thực hiện (Ctrl+Z)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Hoàn tác</span>
            </button>

            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border font-medium transition-colors ${
                canRedo
                  ? 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-300 shadow-2xs'
                  : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
              }`}
              title="Làm lại thao tác vừa hoàn tác (Ctrl+Y)"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Làm lại</span>
            </button>

            <div className="h-4 w-px bg-slate-200 mx-1"></div>

            {/* Công tắc hiển thị điểm từng câu */}
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 hover:text-slate-900 font-medium select-none">
              <input
                type="checkbox"
                checked={showQuestionScores}
                onChange={(e) => setShowQuestionScores(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
              />
              <span>Hiện điểm từng câu</span>
            </label>
          </div>

          {/* Nhóm huy hiệu trạng thái & Cân đối điểm */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Huy hiệu số câu */}
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[11px] border ${
                isCountMismatched
                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                  : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}
              title={`Tổng số câu thực tế: ${questions.length} / Cấu hình ban đầu: ${expectedTotalQuestions}`}
            >
              {isCountMismatched && <AlertTriangle className="w-3 h-3 text-amber-600" />}
              <span>
                {questions.length} câu
                {isCountMismatched && (
                  <span className="ml-1 text-[10px] font-normal">
                    ({countDiff > 0 ? `+${countDiff}` : countDiff} câu so với thiết lập)
                  </span>
                )}
              </span>
            </span>

            {/* Huy hiệu tổng điểm */}
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md font-bold text-[11px] border ${
                isScoreMismatched
                  ? 'bg-rose-50 text-rose-800 border-rose-300 animate-pulse'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }`}
              title={`Tổng điểm các câu: ${actualTotalScore}đ / Thang điểm đề: ${targetScale}đ`}
            >
              {isScoreMismatched ? (
                <AlertTriangle className="w-3 h-3 text-rose-600" />
              ) : (
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              )}
              <span>
                Tổng: {actualTotalScore} / {targetScale}đ
                {isScoreMismatched && (
                  <span className="ml-1 font-normal text-[10px]">
                    ({scoreDiff > 0 ? `thừa +${scoreDiff}đ` : `thiếu ${scoreDiff}đ`})
                  </span>
                )}
              </span>
            </span>

            {/* Nút Chia lại điểm khi tổng điểm lệch thang điểm */}
            {isScoreMismatched && (
              <button
                type="button"
                onClick={onRedistributeScores}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg shadow-2xs text-[11px] transition-colors"
                title="Tự động cân bằng lại điểm số các câu bằng thuật toán số nguyên để tổng đúng bằng thang điểm"
              >
                <Scale className="w-3.5 h-3.5" />
                <span>Chia lại điểm ({targetScale}đ chuẩn)</span>
              </button>
            )}

            {/* Nút thêm câu vào cuối đề */}
            <button
              type="button"
              onClick={() => onInsertQuestion(questions.length)}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg font-semibold text-[11px] transition-colors"
            >
              <Plus className="w-3 h-3" />
              <span>Thêm câu</span>
            </button>

            {/* Nút Lưu tất cả câu của đề vào ngân hàng */}
            <button
              type="button"
              onClick={async () => {
                setIsSavingAllBank(true);
                try {
                  await saveAllQuestionsToBankAction();
                } finally {
                  setTimeout(() => setIsSavingAllBank(false), 2000);
                }
              }}
              disabled={isSavingAllBank || questions.length === 0}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg font-semibold text-[11px] transition-colors shadow-2xs"
              title="Lưu tất cả câu hỏi trong đề vào Ngân hàng câu hỏi (tự động bỏ qua các câu trùng lặp)"
            >
              {isSavingAllBank ? (
                <Check className="w-3 h-3 text-emerald-600" />
              ) : (
                <FolderPlus className="w-3 h-3 text-indigo-600" />
              )}
              <span>{isSavingAllBank ? 'Đã lưu vào NH' : 'Lưu tất cả câu của đề'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* TỜ GIẤY THI CHUẨN A4 */}
      {/* ========================================================= */}
      <div
        className="bg-white max-w-[210mm] mx-auto p-8 sm:p-12 rounded-xl border border-slate-300 shadow-md print:shadow-none print:border-none print:p-0 print:max-w-none font-serif text-[13px] leading-relaxed text-slate-900"
        style={{ fontFamily: "'Times New Roman', Times, serif" }}
      >
        {/* ========================================================= */}
        {/* ĐẦU ĐỀ (HEADER CHUẨN BỘ GIÁO DỤC VÀ ĐÀO TẠO) */}
        {/* ========================================================= */}
        <div className="border-b-2 border-slate-900 pb-4">
          <div className="grid grid-cols-2 gap-4 text-xs sm:text-[13px]">
            {/* Cột trái */}
            <div className="text-center sm:text-left">
              <p className="font-semibold uppercase tracking-wide text-slate-800 text-[12px]">
                {config.departmentName?.trim() || 'SỞ GIÁO DỤC VÀ ĐÀO TẠO'}
              </p>
              <p className="font-bold uppercase tracking-wider text-slate-900 text-sm mt-0.5">
                {config.schoolName?.trim() || 'TRƯỜNG THPT / THCS / TIỂU HỌC'}
              </p>
              <p className="text-slate-600 mt-1 italic text-[11px]">
                Năm học: {config.academicYear || '2024 - 2025'}
              </p>
              <div className="w-24 h-0.5 bg-slate-800 my-1 mx-auto sm:mx-0"></div>
            </div>

            {/* Cột phải */}
            <div className="text-center sm:text-right">
              <p className="font-bold uppercase tracking-wider text-slate-950 text-sm sm:text-base">
                {exam.title || 'ĐỀ KIỂM TRA CHẤT LƯỢNG'}
              </p>
              <p className="font-semibold text-slate-800 text-xs sm:text-[13px] mt-0.5">
                MÔN: {(config.customSubject?.trim() || config.subject || 'MÔN HỌC').toUpperCase()}
                {config.grade ? ` – KHỐI ${config.grade}` : ''}
              </p>
              <p className="text-slate-700 italic text-[12px] mt-0.5">
                Thời gian làm bài: <strong>{config.durationMinutes || 45} phút</strong> (không kể thời gian phát đề)
              </p>
              <p className="font-mono text-slate-900 text-[11px] font-bold mt-1">
                MÃ ĐỀ THI: {activeVersionCode}
              </p>
            </div>
          </div>

          {/* Dòng Họ và tên, Lớp, Số báo danh và Ô Điểm / Lời phê */}
          <div className="mt-4 pt-3 border-t border-slate-300 grid grid-cols-1 sm:grid-cols-3 gap-3 items-stretch">
            {/* Cột thông tin học sinh */}
            <div className="sm:col-span-2 space-y-2 text-xs">
              <div className="flex items-baseline">
                <span className="font-semibold text-slate-800 whitespace-nowrap">Họ và tên thí sinh:</span>
                <span className="border-b border-dotted border-slate-400 flex-1 ml-2 inline-block h-4"></span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-baseline">
                  <span className="font-semibold text-slate-800 whitespace-nowrap">Lớp:</span>
                  <span className="border-b border-dotted border-slate-400 flex-1 ml-2 inline-block h-4"></span>
                </div>
                <div className="flex items-baseline">
                  <span className="font-semibold text-slate-800 whitespace-nowrap">Số báo danh:</span>
                  <span className="border-b border-dotted border-slate-400 flex-1 ml-2 inline-block h-4"></span>
                </div>
              </div>
            </div>

            {/* Khung Điểm / Lời phê */}
            <div className="border border-slate-800 rounded-sm grid grid-cols-2 text-center text-xs">
              <div className="border-r border-slate-800 p-1 flex flex-col justify-between">
                <span className="font-bold uppercase text-[11px]">ĐIỂM</span>
                <div className="h-9 flex items-center justify-center font-bold text-base text-slate-300">
                  ....../10
                </div>
              </div>
              <div className="p-1 flex flex-col justify-between">
                <span className="font-bold uppercase text-[11px]">LỜI PHÊ CỦA THẦY/CÔ</span>
                <div className="h-9"></div>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* NỘI DUNG ĐỀ KIỂM TRA CHIA THEO PHẦN */}
        {/* ========================================================= */}
        <div className="mt-6 space-y-6">
          {/* ----------------------------------------------------- */}
          {/* PHẦN I: TRẮC NGHIỆM */}
          {/* ----------------------------------------------------- */}
          {objectiveQuestions.length > 0 && (
            <div className="space-y-4">
              <div className="font-bold uppercase tracking-wide text-slate-950 border-b border-slate-800 pb-1 text-sm flex items-center justify-between">
                <span>PHẦN I. TRẮC NGHIỆM ({objectiveQuestions.length} câu)</span>
              </div>

              {/* Nhóm MCQ 4 lựa chọn */}
              {mcqGroup.length > 0 && (
                <div className="space-y-3">
                  <div className="italic text-xs font-semibold text-slate-800 bg-slate-100/70 p-2 rounded border-l-3 border-slate-700">
                    * Câu {getQuestionIndex(mcqGroup[0])} đến Câu{' '}
                    {getQuestionIndex(mcqGroup[mcqGroup.length - 1])}: Thí sinh chỉ chọn một phương án trả lời đúng duy nhất (A, B, C hoặc D).
                  </div>
                  <div className="space-y-3">
                    {mcqGroup.map((q) => (
                      <QuestionCard
                        key={q.id}
                        index={getQuestionIndex(q)}
                        question={q}
                        showScore={showQuestionScores}
                        auditNotes={auditNotesMap.get(q.id)}
                        isRegenerating={regeneratingId === q.id}
                        onEdit={() => onEditQuestion(q)}
                        onRegenerate={(hint) => onRegenerateQuestion(q.id, hint)}
                        onDelete={() => onDeleteQuestion(q.id)}
                        onInsertAfter={() => onInsertQuestion(getQuestionIndex(q))}
                        mode="EXAM"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Nhóm Đúng / Sai CLUSTER4 */}
              {tfGroup.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="italic text-xs font-semibold text-slate-800 bg-slate-100/70 p-2 rounded border-l-3 border-slate-700">
                    * Câu {getQuestionIndex(tfGroup[0])} đến Câu{' '}
                    {getQuestionIndex(tfGroup[tfGroup.length - 1])}: Thí sinh trả lời Đúng hoặc Sai cho mỗi ý a), b), c), d) ở từng câu hỏi.
                  </div>
                  <div className="space-y-3">
                    {tfGroup.map((q) => (
                      <QuestionCard
                        key={q.id}
                        index={getQuestionIndex(q)}
                        question={q}
                        showScore={showQuestionScores}
                        auditNotes={auditNotesMap.get(q.id)}
                        isRegenerating={regeneratingId === q.id}
                        onEdit={() => onEditQuestion(q)}
                        onRegenerate={(hint) => onRegenerateQuestion(q.id, hint)}
                        onDelete={() => onDeleteQuestion(q.id)}
                        onInsertAfter={() => onInsertQuestion(getQuestionIndex(q))}
                        mode="EXAM"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Nhóm Ghép nối */}
              {matchingGroup.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="italic text-xs font-semibold text-slate-800 bg-slate-100/70 p-2 rounded border-l-3 border-slate-700">
                    * Câu {getQuestionIndex(matchingGroup[0])} đến Câu{' '}
                    {getQuestionIndex(matchingGroup[matchingGroup.length - 1])}: Thí sinh ghép nối thông tin tương ứng ở Cột A với Cột B.
                  </div>
                  <div className="space-y-3">
                    {matchingGroup.map((q) => (
                      <QuestionCard
                        key={q.id}
                        index={getQuestionIndex(q)}
                        question={q}
                        showScore={showQuestionScores}
                        auditNotes={auditNotesMap.get(q.id)}
                        isRegenerating={regeneratingId === q.id}
                        onEdit={() => onEditQuestion(q)}
                        onRegenerate={(hint) => onRegenerateQuestion(q.id, hint)}
                        onDelete={() => onDeleteQuestion(q.id)}
                        onInsertAfter={() => onInsertQuestion(getQuestionIndex(q))}
                        mode="EXAM"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Nhóm Điền khuyết / Trả lời ngắn */}
              {shortFillGroup.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="italic text-xs font-semibold text-slate-800 bg-slate-100/70 p-2 rounded border-l-3 border-slate-700">
                    * Câu {getQuestionIndex(shortFillGroup[0])} đến Câu{' '}
                    {getQuestionIndex(shortFillGroup[shortFillGroup.length - 1])}: Thí sinh điền từ/cụm từ/số thích hợp vào chỗ trống (______) hoặc viết câu trả lời ngắn.
                  </div>
                  <div className="space-y-3">
                    {shortFillGroup.map((q) => (
                      <QuestionCard
                        key={q.id}
                        index={getQuestionIndex(q)}
                        question={q}
                        showScore={showQuestionScores}
                        auditNotes={auditNotesMap.get(q.id)}
                        isRegenerating={regeneratingId === q.id}
                        onEdit={() => onEditQuestion(q)}
                        onRegenerate={(hint) => onRegenerateQuestion(q.id, hint)}
                        onDelete={() => onDeleteQuestion(q.id)}
                        onInsertAfter={() => onInsertQuestion(getQuestionIndex(q))}
                        mode="EXAM"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ----------------------------------------------------- */}
          {/* PHẦN II: TỰ LUẬN */}
          {/* ----------------------------------------------------- */}
          {essayQuestions.length > 0 && (
            <div className="space-y-4 pt-4">
              <div className="font-bold uppercase tracking-wide text-slate-950 border-b border-slate-800 pb-1 text-sm">
                PHẦN II. TỰ LUẬN ({essayQuestions.length} câu)
              </div>
              <div className="italic text-xs font-semibold text-slate-800 bg-slate-100/70 p-2 rounded border-l-3 border-slate-700">
                * Thí sinh trình bày bài làm chi tiết vào giấy làm bài kiểm tra.
              </div>

              <div className="space-y-4">
                {essayQuestions.map((q) => (
                  <QuestionCard
                    key={q.id}
                    index={getQuestionIndex(q)}
                    question={q}
                    showScore={showQuestionScores}
                    auditNotes={auditNotesMap.get(q.id)}
                    isRegenerating={regeneratingId === q.id}
                    onEdit={() => onEditQuestion(q)}
                    onRegenerate={(hint) => onRegenerateQuestion(q.id, hint)}
                    onDelete={() => onDeleteQuestion(q.id)}
                    onInsertAfter={() => onInsertQuestion(getQuestionIndex(q))}
                    mode="EXAM"
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* CHÂN ĐỀ THI */}
        {/* ========================================================= */}
        <div className="mt-10 pt-6 border-t border-slate-800 text-center">
          <p className="font-bold tracking-widest text-sm">— HẾT —</p>
          <p className="italic text-xs text-slate-600 mt-1">
            (Cán bộ coi thi không giải thích gì thêm)
          </p>
        </div>
      </div>
    </div>
  );
};
