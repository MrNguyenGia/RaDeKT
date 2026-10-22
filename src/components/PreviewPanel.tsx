import React, { useMemo, useState } from 'react';
import {
  FileText,
  CheckCircle2,
  ListOrdered,
  Grid,
  BarChart3,
  Printer,
  Copy,
  Download,
  RefreshCw,
  Plus,
  AlertTriangle,
  FileCheck,
  Info,
  Sparkles,
  Layers,
  HelpCircle,
  X,
  FileSpreadsheet,
  ShieldCheck,
  RotateCcw,
  RotateCw,
  Scale,
  Save,
  Check,
  FileDown,
} from 'lucide-react';
import { useExamStore } from '../store';
import { PreviewTab, Question } from '../types';
import { auditExamQuality } from '../lib/qualityAudit';
import { compareExamWithImportedMatrix } from '../lib/matrix';
import { ExamTab } from './preview/ExamTab';
import { AnswersTab } from './preview/AnswersTab';
import { ScoringTab } from './preview/ScoringTab';
import { MatrixSpecTab } from './preview/MatrixSpecTab';
import { StatsTab } from './preview/StatsTab';
import { QuestionModal } from './preview/QuestionModal';
import { QualityReportModal } from './preview/QualityReportModal';
import { AddQuestionModal } from './preview/AddQuestionModal';

export const PreviewPanel: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    currentExam,
    config,
    blueprint,
    selectedVersionIndex,
    setSelectedVersionIndex,
    updateQuestion,
    deleteQuestionAction,
    insertQuestionAction,
    regeneratingQuestionId,
    regenerateQuestionAction,
    generateNewVersionsAction,
    redistributeScoresAction,
    undo,
    canUndo,
    redo,
    canRedo,
    startGenerateExam,
    startGenerateEquivalentExam,
    isExamOutdated,
    isBlueprintStale,
    generateBlueprintAction,
    cancelGeneration,
    isGenerating,
    generationProgress,
    generationError,
    notificationMessage,
    qualityReport,
    isQualityChecking,
    runManualQualityCheck,
    saveCurrentExamAction,
    openExportModal,
  } = useExamStore();

  const [isSavingExam, setIsSavingExam] = useState<boolean>(false);

  // Modal quản lý chỉnh sửa câu hỏi
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    isNew: boolean;
    question: Partial<Question>;
    insertIndex: number;
  }>({
    isOpen: false,
    isNew: false,
    question: {},
    insertIndex: 0,
  });

  // Modal thêm mới câu hỏi (AI tạo hoặc tự nhập)
  const [addModalState, setAddModalState] = useState<{
    isOpen: boolean;
    insertIndex: number;
  }>({
    isOpen: false,
    insertIndex: 0,
  });

  // Modal báo cáo kiểm tra chất lượng 12 tiêu chí
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [copiedToast, setCopiedToast] = useState<boolean>(false);

  // 5 Tab theo đúng yêu cầu đề bài
  const tabs: { key: PreviewTab; label: string; icon: React.ReactNode }[] = [
    { key: 'EXAM', label: '1. Đề kiểm tra', icon: <FileText className="w-4 h-4" /> },
    { key: 'ANSWERS', label: '2. Đáp án', icon: <CheckCircle2 className="w-4 h-4" /> },
    { key: 'SCORING', label: '3. Hướng dẫn chấm', icon: <ListOrdered className="w-4 h-4" /> },
    { key: 'MATRIX', label: '4. Ma trận & Bản đặc tả', icon: <Grid className="w-4 h-4" /> },
    { key: 'STATS', label: '5. Thống kê', icon: <BarChart3 className="w-4 h-4" /> },
  ];

  // Lấy danh sách câu hỏi của mã đề đang chọn (hoặc đề gốc)
  const activeVersion =
    currentExam?.versions && currentExam.versions[selectedVersionIndex]
      ? currentExam.versions[selectedVersionIndex]
      : null;

  const displayQuestions: Question[] = useMemo(() => {
    if (!currentExam) return [];
    return activeVersion ? activeVersion.questions : currentExam.questions;
  }, [currentExam, activeVersion]);

  // Kiểm tra chất lượng đề tự động bằng CODE (không gọi AI)
  const auditResult = useMemo(() => {
    return auditExamQuality(displayQuestions, config, currentExam?.blueprint || blueprint);
  }, [displayQuestions, config, currentExam, blueprint]);

  // Map ghi chú cho từng câu
  const auditNotesMap = useMemo(() => {
    const map = new Map<string, string[]>();
    auditResult.questionAudits.forEach((info, qId) => {
      if (info.needsReview && info.notes.length > 0) {
        map.set(qId, info.notes);
      }
    });
    return map;
  }, [auditResult]);

  // Số lượng câu cần giáo viên kiểm tra (n tính bằng code)
  const questionsNeedingReviewCount = useMemo(() => {
    return displayQuestions.filter((q) => q.needsReview).length;
  }, [displayQuestions]);

  const [showMatrixDiscrepanciesModal, setShowMatrixDiscrepanciesModal] = useState<boolean>(false);

  // So sánh ma trận của đề với ma trận gốc từng ô một
  const matrixComparison = useMemo(() => {
    const targetMatrix = currentExam?.config?.importedMatrix || config.importedMatrix;
    if (!currentExam || !targetMatrix) return null;
    return compareExamWithImportedMatrix(currentExam.questions, targetMatrix);
  }, [currentExam, config.importedMatrix]);

  // In ấn nội dung của tab hiện tại
  const handlePrint = () => {
    window.print();
  };

  // Sao chép nội dung theo từng tab dưới dạng text / markdown
  const handleCopy = () => {
    if (!currentExam) return;

    let text = '';
    const versionCode = activeVersion?.code || '101';

    if (activeTab === 'EXAM') {
      text += `${config.departmentName || 'SỞ GIÁO DỤC VÀ ĐÀO TẠO'}\n`;
      text += `${config.schoolName || 'TRƯỜNG THPT / THCS / TIỂU HỌC'}\n\n`;
      text += `ĐỀ KIỂM TRA: ${(currentExam.title || 'MÔN HỌC').toUpperCase()}\n`;
      text += `Môn: ${config.customSubject?.trim() || config.subject} — Lớp: ${config.grade || '-'}\n`;
      text += `Thời gian làm bài: ${config.durationMinutes || 45} phút\n`;
      text += `Mã đề thi: ${versionCode}\n`;
      text += `--------------------------------------------------------\n\n`;

      displayQuestions.forEach((q, idx) => {
        text += `Câu ${idx + 1} (${q.score.toFixed(2)} điểm): ${q.question}\n`;
        if (q.options && q.options.length > 0) {
          q.options.forEach((opt) => (text += `  ${opt}\n`));
        }
        if (q.statements && q.statements.length > 0) {
          q.statements.forEach((st) => (text += `  ${st.id}) ${st.statement}\n`));
        }
        if (q.pairs && q.pairs.length > 0) {
          q.pairs.forEach((p, i) => (text += `  ${i + 1}. ${p.left}  ---  ${String.fromCharCode(65 + i)}. ${p.right}\n`));
        }
        text += `\n`;
      });
      text += `--- HẾT ---\n`;
    } else if (activeTab === 'ANSWERS') {
      text += `=== ĐÁP ÁN VÀ LỜI GIẢI CHI TIẾT (MÃ ĐỀ ${versionCode}) ===\n\n`;
      displayQuestions.forEach((q, idx) => {
        text += `Câu ${idx + 1}: Đáp án: ${q.correctAnswer}\n`;
        if (q.explanation) {
          text += `Lời giải: ${q.explanation}\n`;
        }
        text += `\n`;
      });
    } else if (activeTab === 'SCORING') {
      text += `=== HƯỚNG DẪN CHẤM VÀ THANG BIỂU ĐIỂM (MÃ ĐỀ ${versionCode}) ===\n\n`;
      displayQuestions.forEach((q, idx) => {
        text += `Câu ${idx + 1} (${q.score.toFixed(2)}đ): ${q.question.slice(0, 80)}...\n`;
        if (q.scoringGuide) {
          text += `Biểu điểm: ${q.scoringGuide}\n`;
        }
        text += `\n`;
      });
    } else {
      text += `=== THÔNG TIN MA TRẬN & BẢN ĐẶC TẢ ===\n`;
      text += `Tổng số câu: ${displayQuestions.length} câu - Thang điểm: ${config.scale || 10}đ\n`;
    }

    navigator.clipboard.writeText(text).then(() => {
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 3000);
    });
  };

  // Tạo lại 1 câu hỏi bằng AI (có hỗ trợ yêu cầu riêng)
  const handleRegenerateQuestion = async (qId: string, customHint?: string) => {
    setRegeneratingId(qId);
    try {
      await regenerateQuestionAction(qId, customHint);
    } finally {
      setRegeneratingId(null);
    }
  };

  // Nhảy tới câu hỏi ở Tab 1
  const handleJumpToQuestion = (qNumber: number) => {
    setActiveTab('EXAM');
    setTimeout(() => {
      const el = document.getElementById(`question-card-${qNumber}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2');
        setTimeout(() => {
          el.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2');
        }, 2000);
      }
    }, 100);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col h-full overflow-hidden">
      {/* Toast thông báo nhanh */}
      {notificationMessage && (
        <div className="bg-emerald-600 text-white text-xs font-medium px-4 py-2 flex items-center justify-between shadow-md print:hidden">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-200" />
            <span>{notificationMessage}</span>
          </div>
        </div>
      )}

      {copiedToast && (
        <div className="bg-blue-600 text-white text-xs font-medium px-4 py-2 flex items-center justify-between shadow-md print:hidden">
          <div className="flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-blue-200" />
            <span>Đã sao chép nội dung vào bộ nhớ tạm!</span>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* THANH CÔNG CỤ TRÊN CÙNG (TOOLBAR) */}
      {/* ========================================================= */}
      <div className="border-b border-slate-200 bg-slate-50/90 px-4 py-2 flex flex-wrap items-center justify-between gap-2 print:hidden">
        {/* Nhóm nút bên trái: Tạo đề / Tạo lại, Tạo tương đương, Tạo ma trận */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={startGenerateExam}
            disabled={isGenerating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-2xs transition-colors disabled:opacity-50"
            title="Dùng AI biên soạn đề thi theo cấu trúc ma trận"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
            <span>{currentExam ? 'Tạo lại' : 'Tạo đề'}</span>
          </button>

          {/* Nút Tạo đề tương đương */}
          <button
            type="button"
            onClick={startGenerateEquivalentExam}
            disabled={isGenerating || (!currentExam && blueprint.length === 0)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 transition-colors shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
            title="Giữ nguyên ma trận/bản đặc tả, dùng AI biên soạn bộ câu hỏi mới hoàn toàn"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden sm:inline">Tạo đề tương đương</span>
          </button>

          {/* Nút Tạo ma trận */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('MATRIX');
              if (isBlueprintStale) {
                generateBlueprintAction();
              }
            }}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              activeTab === 'MATRIX'
                ? 'bg-blue-50 text-blue-700 border-blue-300 font-bold'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
            title="Xem và thiết lập bảng Ma trận & Bản đặc tả"
          >
            <Grid className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tạo ma trận</span>
            {isBlueprintStale && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse ml-0.5" title="Có cập nhật thiết lập mới" />
            )}
          </button>
        </div>

        {/* Nhóm nút bên phải: Hoàn tác, Làm lại, Kiểm tra đề, Lưu, In, Sao chép */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Nút Hoàn tác / Làm lại */}
          <div className="flex items-center gap-1 border-r border-slate-200 pr-1.5 mr-0.5">
            <button
              type="button"
              onClick={undo}
              disabled={!canUndo}
              className={`p-1.5 text-xs font-medium rounded-lg border transition-colors ${
                canUndo
                  ? 'text-slate-700 bg-white border-slate-300 hover:bg-slate-50 cursor-pointer shadow-2xs'
                  : 'text-slate-300 bg-slate-50 border-slate-200 cursor-not-allowed'
              }`}
              title="Hoàn tác thay đổi vừa thực hiện (Ctrl+Z)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={!canRedo}
              className={`p-1.5 text-xs font-medium rounded-lg border transition-colors ${
                canRedo
                  ? 'text-slate-700 bg-white border-slate-300 hover:bg-slate-50 cursor-pointer shadow-2xs'
                  : 'text-slate-300 bg-slate-50 border-slate-200 cursor-not-allowed'
              }`}
              title="Làm lại thao tác vừa hoàn tác (Ctrl+Y)"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Nút Kiểm tra đề */}
          <button
            type="button"
            onClick={async () => {
              setIsReportModalOpen(true);
              if (!qualityReport && currentExam) {
                await runManualQualityCheck();
              }
            }}
            disabled={!currentExam || isQualityChecking}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors shadow-2xs ${
              currentExam
                ? 'text-indigo-800 bg-indigo-50/90 border-indigo-200 hover:bg-indigo-100/90 cursor-pointer'
                : 'text-slate-400 bg-slate-100 border-slate-200 cursor-not-allowed'
            }`}
            title="Mở Báo cáo kiểm tra chất lượng 12 tiêu chí chuẩn GDPT 2018"
          >
            <ShieldCheck className={`w-3.5 h-3.5 ${isQualityChecking ? 'animate-spin text-indigo-600' : 'text-indigo-600'}`} />
            <span>Kiểm tra đề</span>
            {qualityReport && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  qualityReport.errorCount > 0
                    ? 'bg-rose-200 text-rose-800'
                    : qualityReport.warnCount > 0
                    ? 'bg-amber-200 text-amber-800'
                    : 'bg-emerald-200 text-emerald-800'
                }`}
              >
                {qualityReport.errorCount > 0
                  ? `${qualityReport.errorCount} lỗi`
                  : qualityReport.warnCount > 0
                  ? `${qualityReport.warnCount} lưu ý`
                  : '✓ Đạt 12/12'}
              </span>
            )}
          </button>

          {/* Nút Lưu đề thi vào IndexedDB */}
          <button
            type="button"
            onClick={async () => {
              setIsSavingExam(true);
              try {
                await saveCurrentExamAction();
              } finally {
                setTimeout(() => setIsSavingExam(false), 1200);
              }
            }}
            disabled={!currentExam || isSavingExam}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors shadow-2xs ${
              currentExam
                ? 'text-white bg-emerald-600 hover:bg-emerald-700 border-emerald-700 cursor-pointer'
                : 'text-slate-400 bg-slate-100 border-slate-200 cursor-not-allowed'
            }`}
            title="Lưu toàn bộ đề thi (cấu hình, ma trận, câu hỏi, mã đề, đề tương đương) vào bộ nhớ trình duyệt (IndexedDB)"
          >
            {isSavingExam ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            <span>{isSavingExam ? 'Đã lưu' : 'Lưu'}</span>
          </button>

          {/* Nút In đề */}
          <button
            type="button"
            onClick={() => openExportModal('PRINT')}
            disabled={!currentExam}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              currentExam
                ? 'text-slate-700 bg-white border-slate-300 hover:bg-slate-50 cursor-pointer shadow-2xs'
                : 'text-slate-400 bg-slate-100 border-slate-200 cursor-not-allowed'
            }`}
            title="In đề thi chuẩn khổ A4, Times New Roman 13pt"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">In đề</span>
          </button>

          {/* Nút Xuất PDF */}
          <button
            type="button"
            onClick={() => openExportModal('PDF')}
            disabled={!currentExam}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              currentExam
                ? 'text-slate-700 bg-white border-slate-300 hover:bg-slate-50 cursor-pointer shadow-2xs'
                : 'text-slate-400 bg-slate-100 border-slate-200 cursor-not-allowed'
            }`}
            title="Xuất file PDF với tên file chuẩn gợi ý"
          >
            <FileText className="w-3.5 h-3.5 text-rose-600" />
            <span className="hidden sm:inline">Xuất PDF</span>
          </button>

          {/* Nút Xuất Word */}
          <button
            type="button"
            onClick={() => openExportModal('WORD')}
            disabled={!currentExam}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors shadow-2xs ${
              currentExam
                ? 'text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100 cursor-pointer'
                : 'text-slate-400 bg-slate-100 border-slate-200 cursor-not-allowed'
            }`}
            title="Xuất tài liệu Microsoft Word (.docx) kèm công thức sửa được"
          >
            <FileDown className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline">Xuất Word</span>
          </button>

          {/* Nút Sao chép */}
          <button
            type="button"
            onClick={() => openExportModal('COPY')}
            disabled={!currentExam}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              currentExam
                ? 'text-slate-700 bg-white border-slate-300 hover:bg-slate-50 cursor-pointer shadow-2xs'
                : 'text-slate-400 bg-slate-100 border-slate-200 cursor-not-allowed'
            }`}
            title="Sao chép nội dung chuẩn HTML và Plain Text dán vào Word"
          >
            <Copy className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden sm:inline">Sao chép</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 5 TABS ĐIỀU HƯỚNG */}
      {/* ========================================================= */}
      <div className="border-b border-slate-200 bg-slate-50/60 px-4 pt-2 flex items-center justify-between overflow-x-auto scrollbar-none print:hidden">
        <div className="flex space-x-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-t-lg transition-colors whitespace-nowrap border-b-2 ${
                  isActive
                    ? 'border-blue-600 text-blue-700 bg-white shadow-2xs'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.key === 'EXAM' && currentExam && isExamOutdated && (
                  <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded font-bold ml-1">
                    Đề cũ
                  </span>
                )}
                {tab.key === 'MATRIX' && isBlueprintStale && (
                  <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded font-bold ml-1">
                    Cần cập nhật
                  </span>
                )}
                {currentExam && (tab.key === 'EXAM' || tab.key === 'ANSWERS') && !isExamOutdated && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 ml-0.5"></span>
                )}
              </button>
            );
          })}
        </div>

        {/* Bộ chuyển đổi mã đề thi (101, 102...) */}
        {currentExam && currentExam.versions && currentExam.versions.length > 1 && (
          <div className="flex items-center gap-1.5 pb-1 shrink-0">
            <span className="text-[11px] font-bold text-slate-500">Mã đề:</span>
            <div className="flex gap-1">
              {currentExam.versions.map((ver, idx) => (
                <button
                  key={ver.code}
                  type="button"
                  onClick={() => setSelectedVersionIndex(idx)}
                  className={`px-2 py-0.5 text-xs font-bold rounded border transition-all ${
                    selectedVersionIndex === idx
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {ver.code}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* CẢNH BÁO: ĐỀ THI CŨ DO ĐỔI THIẾT LẬP */}
      {isExamOutdated && currentExam && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900 print:hidden">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-200 text-amber-900 border border-amber-300">
              Đề thi cũ (cần tạo lại)
            </span>
            <span className="text-amber-800">
              Thiết lập cấu trúc hoặc số liệu đã được chỉnh sửa sau khi tạo đề. Bấm <strong>Tạo lại</strong> để cập nhật đề thi theo cấu trúc mới.
            </span>
          </div>
          <button
            type="button"
            onClick={startGenerateExam}
            disabled={isGenerating}
            className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-2xs transition-colors shrink-0"
          >
            Tạo lại ngay
          </button>
        </div>
      )}

      {/* CẢNH BÁO: MA TRẬN CŨ CẦN CẬP NHẬT */}
      {isBlueprintStale && (
        <div className="bg-blue-50/90 border-b border-blue-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-blue-900 print:hidden">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
              Ma trận cũ (cần cập nhật)
            </span>
            <span className="text-blue-800">
              Thiết lập vừa thay đổi. Bấm <strong>Cập nhật ma trận</strong> để tính toán lại phân bổ ô câu hỏi.
            </span>
          </div>
          <button
            type="button"
            onClick={generateBlueprintAction}
            className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-2xs transition-colors shrink-0"
          >
            Cập nhật ma trận
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* AN TOÀN HỌC THUẬT & KHU VỰC THÔNG BÁO TỔNG KẾT AUDIT */}
      {/* ========================================================= */}
      {currentExam && (
        <div className="bg-slate-100/90 border-b border-slate-200 px-5 py-2.5 flex flex-wrap items-center justify-between gap-2.5 text-xs print:hidden">
          {/* Cảnh báo an toàn học thuật bắt buộc (không in ra giấy) */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 font-medium text-amber-900 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
              <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Đề được AI hỗ trợ tạo. Giáo viên cần kiểm duyệt nội dung trước khi sử dụng.</span>
            </span>

            <span className="text-slate-400 hidden sm:inline">•</span>

            {/* Có n câu cần kiểm tra */}
            {questionsNeedingReviewCount > 0 ? (
              <span className="inline-flex items-center gap-1 font-bold text-amber-900 bg-amber-100/90 px-2.5 py-1 rounded-md border border-amber-300">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                <span>Có {questionsNeedingReviewCount} câu cần kiểm tra</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-bold text-emerald-800 bg-emerald-100/90 px-2.5 py-1 rounded-md border border-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Tất cả các câu đều đạt chuẩn</span>
              </span>
            )}

            {/* Huy hiệu so sánh ma trận gốc nếu đề được tạo từ ma trận có sẵn */}
            {matrixComparison && (
              <>
                <span className="text-slate-400 hidden sm:inline">•</span>
                {matrixComparison.isMatch100 ? (
                  <span className="inline-flex items-center gap-1.5 font-bold text-emerald-800 bg-emerald-100/90 px-2.5 py-1 rounded-md border border-emerald-300 shadow-2xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Khớp ma trận gốc 100% ✓</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowMatrixDiscrepanciesModal(true)}
                    className="inline-flex items-center gap-1.5 font-bold text-amber-900 bg-amber-100/90 hover:bg-amber-200/90 px-2.5 py-1 rounded-md border border-amber-300 transition-colors shadow-2xs cursor-pointer"
                    title="Bấm để xem danh sách các ô lệch so với ma trận gốc"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                    <span>Lệch {matrixComparison.discrepancies.length} ô so với ma trận gốc (Xem chi tiết)</span>
                  </button>
                )}
              </>
            )}
          </div>

          {/* Dòng tổng kết điểm và nút mở báo cáo 12 tiêu chí */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-slate-600 hidden md:inline">
              Tổng điểm: <strong>{auditResult.totalScore.toFixed(2)}đ</strong> / {auditResult.expectedScale}đ
            </span>

            <button
              type="button"
              onClick={() => setIsReportModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-50 text-indigo-700 font-bold border border-indigo-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span>Báo cáo 12 tiêu chí</span>
              {qualityReport?.repairedCount ? (
                <span className="bg-purple-100 text-purple-700 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                  Sửa {qualityReport.repairedCount} lỗi
                </span>
              ) : null}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* NỘI DUNG CHÍNH (CONTENT AREA) */}
      {/* ========================================================= */}
      <div className="flex-1 p-5 overflow-y-auto bg-slate-50/40 print:p-0 print:bg-white print:overflow-visible">
        {/* TRẠNG THÁI ĐANG SINH ĐỀ VỚI GEMINI */}
        {isGenerating && generationProgress && (
          <div className="max-w-md mx-auto my-12 p-6 bg-white rounded-2xl border border-blue-200 shadow-md text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <RefreshCw className="w-6 h-6 animate-spin" />
            </div>

            <div>
              <h4 className="font-bold text-slate-900 text-sm">
                Đang dùng Gemini AI biên soạn đề kiểm tra...
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Lô {generationProgress.batchIndex} / {generationProgress.totalBatches}:{' '}
                {generationProgress.currentSlotRange}
              </p>
            </div>

            {/* Progress bar */}
            <div className="space-y-1">
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${generationProgress.percent}%` }}
                />
              </div>
              <div className="text-right text-[11px] font-bold text-blue-700">
                {generationProgress.percent}%
              </div>
            </div>

            <button
              type="button"
              onClick={cancelGeneration}
              className="text-xs font-semibold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg border border-rose-200 transition-colors"
            >
              Hủy quá trình sinh đề
            </button>
          </div>
        )}

        {/* LỖI TRONG QUÁ TRÌNH SINH ĐỀ */}
        {generationError && !isGenerating && (
          <div className="max-w-lg mx-auto mb-6 p-4 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-900 space-y-2">
            <div className="flex items-center gap-2 font-bold">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Không thể hoàn tất sinh đề:</span>
            </div>
            <p className="text-rose-800">{generationError}</p>
            <div className="pt-2">
              <button
                type="button"
                onClick={startGenerateExam}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold text-xs shadow-xs"
              >
                Thử lại ngay
              </button>
            </div>
          </div>
        )}

        {/* TRẠNG THÁI CHƯA CÓ ĐỀ (3 BƯỚC HƯỚNG DẪN RÕ RÀNG) */}
        {!currentExam && !isGenerating && (
          <div className="max-w-xl mx-auto py-8 px-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4 border border-blue-100 shadow-xs">
              <FileText className="w-8 h-8" />
            </div>

            <h3 className="text-base font-bold text-slate-900 mb-1">
              Chưa có đề kiểm tra được tạo
            </h3>
            <p className="text-xs text-slate-500 mb-6 max-w-md mx-auto">
              Hệ thống sẵn sàng hỗ trợ thầy/cô soạn thảo đề thi chuẩn 3 cấp theo 3 bước nhanh chóng:
            </p>

            {/* 3 Bước thực hiện */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left mb-6">
              <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1.5">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">
                  1
                </div>
                <div className="font-bold text-xs text-slate-800">Thông tin bài học</div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Chọn Cấp, Lớp, Môn và dán tài liệu nội dung hoặc văn bản bài học.
                </p>
              </div>

              <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1.5">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">
                  2
                </div>
                <div className="font-bold text-xs text-slate-800">Cấu trúc & Ma trận</div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Thiết lập số câu, mức độ (NB-TH-VD-VDC) và bấm "TẠO MA TRẬN".
                </p>
              </div>

              <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1.5">
                <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center">
                  3
                </div>
                <div className="font-bold text-xs text-slate-800">Tạo đề thi với AI</div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Bấm nút lớn "TẠO ĐỀ KIỂM TRA" để Gemini AI biên soạn hoàn chỉnh.
                </p>
              </div>
            </div>

            {/* Xem trước ma trận dự kiến */}
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl inline-flex items-center gap-2 text-xs text-blue-800">
              <Info className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                Thầy/cô có thể bấm tab <strong className="cursor-pointer underline" onClick={() => setActiveTab('MATRIX')}>"Ma trận & Bản đặc tả"</strong> ở trên để xem khung đề dự kiến.
              </span>
            </div>
          </div>
        )}

        {/* NỘI DUNG 5 TABS KHI ĐÃ CÓ ĐỀ HOẶC CẤU HÌNH */}
        {activeTab === 'EXAM' && currentExam && (
          <ExamTab
            exam={currentExam}
            config={config}
            questions={displayQuestions}
            activeVersionCode={activeVersion?.code || '101'}
            auditNotesMap={auditNotesMap}
            regeneratingId={regeneratingQuestionId || regeneratingId}
            onEditQuestion={(q) =>
              setModalState({ isOpen: true, isNew: false, question: q, insertIndex: 0 })
            }
            onRegenerateQuestion={handleRegenerateQuestion}
            onDeleteQuestion={deleteQuestionAction}
            onInsertQuestion={(idx) =>
              setAddModalState({ isOpen: true, insertIndex: idx })
            }
            onRedistributeScores={redistributeScoresAction}
            onUndo={undo}
            canUndo={canUndo}
            onRedo={redo}
            canRedo={canRedo}
          />
        )}

        {activeTab === 'ANSWERS' && currentExam && (
          <AnswersTab
            exam={currentExam}
            config={config}
            questions={displayQuestions}
            activeVersionCode={activeVersion?.code || '101'}
            onEditQuestion={(q) =>
              setModalState({ isOpen: true, isNew: false, question: q, insertIndex: 0 })
            }
            onRegenerateQuestion={handleRegenerateQuestion}
            regeneratingId={regeneratingId}
          />
        )}

        {activeTab === 'SCORING' && (
          <ScoringTab
            exam={currentExam || { id: 'preview', title: config.title || 'Đề kiểm tra', config, blueprint, questions: [], versions: [], createdAt: '', updatedAt: '' }}
            config={config}
            questions={displayQuestions}
            activeVersionCode={activeVersion?.code || '101'}
          />
        )}

        {activeTab === 'MATRIX' && (
          <MatrixSpecTab
            config={config}
            blueprint={blueprint}
            questions={displayQuestions}
            onJumpToQuestion={handleJumpToQuestion}
          />
        )}

        {activeTab === 'STATS' && (
          <StatsTab questions={displayQuestions} config={config} />
        )}
      </div>

      {/* ========================================================= */}
      {/* MODAL CHỈNH SỬA / THÊM CÂU HỎI */}
      {/* ========================================================= */}
      {modalState.isOpen && (
        <QuestionModal
          initialQuestion={modalState.question}
          isNew={modalState.isNew}
          insertIndex={modalState.insertIndex}
          onSave={(data) => {
            if (modalState.isNew) {
              insertQuestionAction(modalState.insertIndex, data);
            } else if (modalState.question.id) {
              updateQuestion(modalState.question.id, data);
            }
            setModalState({ isOpen: false, isNew: false, question: {}, insertIndex: 0 });
          }}
          onClose={() =>
            setModalState({ isOpen: false, isNew: false, question: {}, insertIndex: 0 })
          }
        />
      )}

      {/* ========================================================= */}
      {/* MODAL THÊM CÂU HỎI MỚI (AI TẠO HOẶC TỰ NHẬP) */}
      {/* ========================================================= */}
      {addModalState.isOpen && (
        <AddQuestionModal
          insertIndex={addModalState.insertIndex}
          config={config}
          existingQuestions={displayQuestions}
          onInsert={(newQ) => {
            insertQuestionAction(addModalState.insertIndex, newQ);
            setAddModalState({ isOpen: false, insertIndex: 0 });
          }}
          onClose={() => setAddModalState({ isOpen: false, insertIndex: 0 })}
        />
      )}

      {/* ========================================================= */}
      {/* MODAL BÁO CÁO KIỂM TRA CHẤT LƯỢNG 12 TIÊU CHÍ */}
      {/* ========================================================= */}
      {isReportModalOpen && (
        <QualityReportModal
          report={qualityReport}
          exam={currentExam}
          isRunningCheck={isQualityChecking}
          onRecheck={async () => {
            await runManualQualityCheck();
          }}
          onClose={() => setIsReportModalOpen(false)}
          onJumpToQuestion={(qNum) => handleJumpToQuestion(Number(qNum))}
        />
      )}

      {/* ========================================================= */}
      {/* MODAL CHI TIẾT CÁC Ô LỆCH SO VỚI MA TRẬN GỐC */}
      {/* ========================================================= */}
      {showMatrixDiscrepanciesModal && matrixComparison && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-amber-500 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-100" />
                <h3 className="font-bold text-base text-white">
                  Danh sách ô lệch so với ma trận gốc ({matrixComparison.discrepancies.length} ô)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowMatrixDiscrepanciesModal(false)}
                className="text-amber-100 hover:text-white p-1 rounded-lg hover:bg-amber-600/50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 max-h-[60vh] overflow-y-auto space-y-3">
              <p className="text-xs text-slate-600">
                Hệ thống đã đối soát từng ô giữa đề thi thực tế và ma trận gốc nhập vào:
              </p>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">Chủ đề</th>
                      <th className="py-2 px-2 text-center">Mức</th>
                      <th className="py-2 px-2 text-center">Dạng câu</th>
                      <th className="py-2 px-2 text-center">Gốc</th>
                      <th className="py-2 px-2 text-center">Đề thực tế</th>
                      <th className="py-2 px-2 text-center">Độ lệch</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {matrixComparison.discrepancies.map((d, idx) => (
                      <tr key={idx} className="hover:bg-amber-50/50">
                        <td className="py-2 px-3 font-medium text-slate-800">{d.topic}</td>
                        <td className="py-2 px-2 text-center font-bold text-blue-700">{d.level}</td>
                        <td className="py-2 px-2 text-center text-slate-600">{d.questionType}</td>
                        <td className="py-2 px-2 text-center font-semibold text-slate-700">{d.expectedCount}</td>
                        <td className="py-2 px-2 text-center font-bold text-slate-900">{d.actualCount}</td>
                        <td className="py-2 px-2 text-center font-bold text-rose-600">
                          {d.diffCount > 0 ? `+${d.diffCount}` : d.diffCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowMatrixDiscrepanciesModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs rounded-xl"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
