import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  RotateCcw,
  RotateCw,
  Scale,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  FolderPlus,
  Check,
  Layers,
} from 'lucide-react';
import { useExamStore } from '../../store';
import { Exam, ExamConfig, Level, Question } from '../../types';
import { getFaultyQuestions } from '../../lib/validate';
import {
  formatSchoolNameForHeader,
  getDefaultAcademicYear,
  formatScore,
  formatDepartmentForHeader,
} from '../../config';
import { QuestionCard } from './QuestionCard';
import { DocPage, DocZoomToolbar } from '../common/DocPage';

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
  // Trạng thái thu phóng màn hình 75% - 150% (mặc định 100%)
  const [zoom, setZoom] = useState<number>(1.0);

  // Tùy chọn hiển thị
  const [showQuestionScores, setShowQuestionScores] = useState<boolean>(false);
  const [showAnswerBox, setShowAnswerBox] = useState<boolean>(false);
  const [showWritingLines, setShowWritingLines] = useState<boolean>(false);
  const [viewAllVersions, setViewAllVersions] = useState<boolean>(false);

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

  // Tính toán độ lệch điểm và số câu so với cấu hình
  const actualTotalScore = Number(
    questions.reduce((sum, q) => sum + (q.score || 0), 0).toFixed(2)
  );
  const targetScale = config.scale || 10;
  const isScoreMismatched = Math.abs(actualTotalScore - targetScale) > 0.001;
  const scoreDiff = Number((actualTotalScore - targetScale).toFixed(2));

  const expectedTotalQuestions = Object.values(config.questionCountsByType || {}).reduce(
    (sum, val) => sum + (val || 0),
    0
  );
  const isCountMismatched =
    expectedTotalQuestions > 0 && questions.length !== expectedTotalQuestions;
  const countDiff = questions.length - expectedTotalQuestions;

  const faultyQuestions = useMemo(() => {
    return getFaultyQuestions(questions, config, exam);
  }, [questions, config, exam]);

  // Hàm sinh danh sách các phần La Mã liên tiếp cho một bộ câu hỏi
  const buildExamSections = (targetQuestions: Question[]) => {
    const result: {
      romanIndex: string;
      type: Question['type'];
      title: string;
      items: { question: Question; overallIndex: number }[];
      instruction: string;
      isUniformScore: boolean;
      scorePerQuestion: number;
    }[] = [];

    let romanIdx = 0;
    for (const entry of SECTION_TYPE_CONFIG) {
      const matchingQuestions: { question: Question; overallIndex: number }[] = [];
      targetQuestions.forEach((q, idx) => {
        if (q.type === entry.type) {
          matchingQuestions.push({ question: q, overallIndex: idx + 1 });
        }
      });

      if (matchingQuestions.length > 0) {
        const roman = ROMAN_NUMERALS[romanIdx++] || `${romanIdx}`;
        const startNum = matchingQuestions[0].overallIndex;
        const endNum = matchingQuestions[matchingQuestions.length - 1].overallIndex;
        const rangeText =
          startNum === endNum ? `Câu ${startNum}` : `Từ câu ${startNum} đến câu ${endNum}`;

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

        result.push({
          romanIndex: roman,
          type: entry.type,
          title: entry.title,
          items: matchingQuestions,
          instruction,
          isUniformScore: isUniform,
          scorePerQuestion: firstScore,
        });
      }
    }

    return result;
  };

  const sections = useMemo(() => buildExamSections(questions), [questions]);

  // Xử lý đầu đề chuẩn Bộ Giáo Dục và Đào Tạo
  const deptDisplay = config.departmentName?.trim()
    ? formatDepartmentForHeader(config.departmentName)
    : 'SỞ GIÁO DỤC VÀ ĐÀO TẠO …………………';

  const schoolDisplay = config.schoolName?.trim()
    ? formatSchoolNameForHeader(config.schoolName)
    : 'TRƯỜNG: …………………………………';

  const titleDisplay = (
    exam.title?.trim() ||
    config.title?.trim() ||
    'ĐỀ KIỂM TRA ĐỊNH KỲ'
  ).toUpperCase();

  const subjectDisplay = (
    config.customSubject?.trim() ||
    config.subject ||
    'MÔN HỌC'
  ).toUpperCase();

  const gradeDisplay = config.grade ? ` – LỚP ${config.grade}` : '';
  const durationDisplay = config.durationMinutes || 45;
  const yearDisplay = config.academicYear || getDefaultAcademicYear();

  // Render một trang đề hoàn chỉnh cho một mã đề
  const renderExamPaper = (vCode: string, vQuestions: Question[], isSingleView = true) => {
    const vSections = isSingleView ? sections : buildExamSections(vQuestions);

    return (
      <DocPage
        key={vCode}
        versionCode={vCode}
        className={!isSingleView ? 'mb-10' : ''}
      >
        {/* ========================================================= */}
        {/* ĐẦU ĐỀ: BẢNG 2 CỘT KHÔNG VIỀN */}
        {/* ========================================================= */}
        <table className="doc-header-table">
          <tbody>
            <tr>
              {/* Cột trái */}
              <td className="doc-header-left">
                <div className="text-[12pt] font-normal uppercase tracking-wide">
                  {deptDisplay}
                </div>
                <div className="text-[12pt] font-bold uppercase tracking-wider mt-0.5">
                  {schoolDisplay}
                </div>
                <div className="doc-short-line" />
              </td>

              {/* Cột phải */}
              <td className="doc-header-right">
                {/* Khung mã đề thi góc phải */}
                <div className="doc-exam-code-box">
                  Mã đề: {vCode}
                </div>

                <div className="text-[14pt] font-bold uppercase tracking-wide">
                  {titleDisplay}
                </div>
                <div className="text-[13pt] font-semibold mt-0.5">
                  MÔN: {subjectDisplay}{gradeDisplay}
                </div>
                <div className="text-[12pt] italic mt-0.5">
                  Thời gian làm bài: {durationDisplay} phút <em>(không kể thời gian phát đề)</em>
                </div>
                <div className="text-[11pt] text-slate-700 italic mt-0.5">
                  Năm học: {yearDisplay}
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* ========================================================= */}
        {/* KHUNG THÔNG TIN THÍ SINH VIỀN MẢNH 0.75PT */}
        {/* ========================================================= */}
        <div className="doc-candidate-box">
          <div className="flex flex-col justify-center space-y-2 text-[11pt]">
            <div className="flex items-baseline">
              <span className="whitespace-nowrap font-medium">Họ và tên thí sinh:</span>
              <span className="flex-1 ml-2 border-b border-dotted border-black min-h-[14px]" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-baseline">
                <span className="whitespace-nowrap font-medium">Lớp:</span>
                <span className="flex-1 ml-2 border-b border-dotted border-black min-h-[14px]" />
              </div>
              <div className="flex items-baseline">
                <span className="whitespace-nowrap font-medium">Số báo danh (SBD):</span>
                <span className="flex-1 ml-2 border-b border-dotted border-black min-h-[14px]" />
              </div>
            </div>
          </div>

          <div className="border border-black grid grid-cols-2 text-center text-[10pt]">
            <div className="border-r border-black p-1 flex flex-col justify-between">
              <span className="font-bold uppercase text-[9pt]">ĐIỂM</span>
              <div className="h-7 flex items-center justify-center font-bold text-[12pt] text-slate-300">
                .../10
              </div>
            </div>
            <div className="p-1 flex flex-col justify-between">
              <span className="font-bold uppercase text-[9pt]">LỜI PHÊ</span>
              <div className="h-7" />
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* NỘI DUNG ĐỀ THI: CÁC PHẦN LA MÃ LIÊN TIẾP */}
        {/* ========================================================= */}
        <div className="mt-4">
          {vSections.map((sec) => (
            <div key={sec.type} className="mb-4">
              <div className="doc-section-header">
                PHẦN {sec.romanIndex}. {sec.title}
              </div>
              <div className="doc-section-instruction">
                {sec.instruction}
              </div>

              <div>
                {sec.items.map(({ question: q, overallIndex }) => (
                  <QuestionCard
                    key={q.id}
                    index={overallIndex}
                    question={q}
                    showScore={showQuestionScores || !sec.isUniformScore}
                    showAnswerBox={showAnswerBox}
                    showWritingLines={showWritingLines}
                    auditNotes={auditNotesMap.get(q.id)}
                    isRegenerating={regeneratingId === q.id}
                    onEdit={() => onEditQuestion(q)}
                    onRegenerate={(hint) => onRegenerateQuestion(q.id, hint)}
                    onDelete={() => onDeleteQuestion(q.id)}
                    onInsertAfter={() => onInsertQuestion(overallIndex)}
                    mode="EXAM"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ========================================================= */}
        {/* CUỐI ĐỀ THI */}
        {/* ========================================================= */}
        <div className="doc-end-notice">
          <div className="doc-end-title">— HẾT —</div>
          <div className="doc-end-note">
            Thí sinh không được sử dụng tài liệu. Cán bộ coi thi không giải thích gì thêm.
          </div>
        </div>
      </DocPage>
    );
  };

  return (
    <div className="doc-viewport-bg py-4 px-2 sm:px-4">
      {/* ========================================================= */}
      {/* THANH ĐIỀU KHIỂN & CÔNG CỤ (ẨN KHI IN ẤN) */}
      {/* ========================================================= */}
      <div className="max-w-[210mm] mx-auto space-y-2 mb-3 print:hidden">
        {/* Thông báo câu lỗi nếu có */}
        {faultyQuestions.length > 0 && (
          <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-3 text-rose-900 flex items-center justify-between gap-3 text-xs sm:text-sm font-medium shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2 flex-wrap">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span className="font-bold">
                Đề còn {faultyQuestions.length} câu lỗi:
              </span>
              <span className="inline-flex items-center gap-1.5 flex-wrap">
                {faultyQuestions.map((item) => (
                  <button
                    key={item.question.id}
                    type="button"
                    onClick={() => {
                      const el = document.getElementById(`question-card-${item.index}`);
                      if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        el.classList.add('ring-4', 'ring-rose-400');
                        setTimeout(() => el.classList.remove('ring-4', 'ring-rose-400'), 2000);
                      }
                    }}
                    className="inline-flex items-center px-2 py-0.5 rounded-md font-bold text-xs bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 transition-colors cursor-pointer shadow-2xs"
                    title={`Bấm để cuộn tới Câu ${item.index}: ${item.reasons.join(' • ')}`}
                  >
                    Câu {item.index}
                  </button>
                ))}
              </span>
            </div>
            <span className="text-[11px] text-rose-700">
              (Bấm vào câu để sửa ngay)
            </span>
          </div>
        )}

        {/* Thanh công cụ biên soạn (Hoàn tác, thêm câu, lưu NH) */}
        <div className="bg-white/95 backdrop-blur-xs p-2.5 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
                canUndo
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300 shadow-2xs'
                  : 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
              }`}
              title="Hoàn tác (Ctrl+Z)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Hoàn tác</span>
            </button>

            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
                canRedo
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300 shadow-2xs'
                  : 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
              }`}
              title="Làm lại (Ctrl+Y)"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Làm lại</span>
            </button>

            <div className="h-4 w-px bg-slate-200 mx-1" />

            {/* Nút thêm câu */}
            <button
              type="button"
              onClick={() => onInsertQuestion(questions.length)}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg font-semibold text-xs transition-colors shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm câu</span>
            </button>

            {/* Nút Lưu tất cả câu vào NH */}
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
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg font-semibold text-xs transition-colors shadow-2xs"
              title="Lưu tất cả câu hỏi vào Ngân hàng câu hỏi"
            >
              {isSavingAllBank ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <FolderPlus className="w-3.5 h-3.5 text-indigo-600" />
              )}
              <span>{isSavingAllBank ? 'Đã lưu vào NH' : 'Lưu tất cả vào NH'}</span>
            </button>
          </div>

          {/* Huy hiệu số câu & tổng điểm */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[11px] border ${
                isCountMismatched
                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                  : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              {isCountMismatched && <AlertTriangle className="w-3 h-3 text-amber-600" />}
              <span>
                {questions.length} câu
                {isCountMismatched && (
                  <span className="ml-1 text-[10px] font-normal">
                    ({countDiff > 0 ? `+${countDiff}` : countDiff} câu)
                  </span>
                )}
              </span>
            </span>

            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[11px] border ${
                isScoreMismatched
                  ? 'bg-rose-50 text-rose-800 border-rose-300 animate-pulse'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }`}
            >
              {isScoreMismatched ? (
                <AlertTriangle className="w-3 h-3 text-rose-600" />
              ) : (
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              )}
              <span>
                {formatScore(actualTotalScore)} / {formatScore(targetScale)}đ
              </span>
            </span>

            {isScoreMismatched && (
              <button
                type="button"
                onClick={onRedistributeScores}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded shadow-2xs text-[11px] transition-colors"
                title="Cân bằng lại điểm số"
              >
                <Scale className="w-3 h-3" />
                <span>Chia lại điểm</span>
              </button>
            )}

            {/* Xem tất cả mã đề nếu có nhiều phiên bản */}
            {exam.versions && exam.versions.length > 1 && (
              <button
                type="button"
                onClick={() => setViewAllVersions(!viewAllVersions)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border transition-colors ${
                  viewAllVersions
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-300'
                }`}
                title="Hiển thị liên tục tất cả các mã đề thi"
              >
                <Layers className="w-3 h-3" />
                <span>{viewAllVersions ? 'Thu gọn 1 mã đề' : `Xem cả ${exam.versions.length} mã đề`}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* THANH THU PHÓNG A4 (75% - 150%) VÀ CÁC CÔNG TẮC BẬT TẮT */}
      {/* ========================================================= */}
      <DocZoomToolbar
        zoom={zoom}
        onZoomChange={setZoom}
        extraControls={
          <div className="flex items-center gap-3 text-xs text-slate-700 flex-wrap">
            <label className="flex items-center gap-1.5 cursor-pointer hover:text-slate-900 select-none">
              <input
                type="checkbox"
                checked={showQuestionScores}
                onChange={(e) => setShowQuestionScores(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-blue-600 border-slate-300"
              />
              <span className="text-[11px]">Hiện điểm từng câu</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer hover:text-slate-900 select-none">
              <input
                type="checkbox"
                checked={showAnswerBox}
                onChange={(e) => setShowAnswerBox(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-blue-600 border-slate-300"
              />
              <span className="text-[11px]">In ô đáp án (Trả lời ngắn)</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer hover:text-slate-900 select-none">
              <input
                type="checkbox"
                checked={showWritingLines}
                onChange={(e) => setShowWritingLines(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-blue-600 border-slate-300"
              />
              <span className="text-[11px]">Chừa dòng kẻ (Tự luận)</span>
            </label>
          </div>
        }
      />

      {/* ========================================================= */}
      {/* VÙNG HIỂN THỊ TỜ GIẤY THI A4 (ÁP DỤNG THU PHÓNG) */}
      {/* ========================================================= */}
      <div
        className="doc-zoom-wrapper"
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: 'top center',
          marginBottom: zoom < 1.0 ? `-${(1.0 - zoom) * 800}px` : undefined,
        }}
      >
        {viewAllVersions && exam.versions && exam.versions.length > 0 ? (
          exam.versions.map((ver) => renderExamPaper(ver.code, ver.questions, false))
        ) : (
          renderExamPaper(activeVersionCode, questions, true)
        )}
      </div>
    </div>
  );
};
