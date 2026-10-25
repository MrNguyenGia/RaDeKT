import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Printer,
  FileDown,
  Copy,
  FileText,
  CheckCircle2,
  CheckSquare,
  Square,
  Layers,
  Sparkles,
  Info,
  Loader2,
  ExternalLink,
  Settings2,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react';
import { Exam, ExamConfig } from '../types';
import {
  DEFAULT_EXPORT_OPTIONS,
  ExportActionType,
  ExportOptions,
  FormulaExportMode,
} from '../lib/export/types';
import { exportExamToWord, triggerFileDownload } from '../lib/export/word';
import { copyExamToClipboard } from '../lib/export/copy';
import { executePrint, executeExportPdf } from '../lib/export/print';
import { generateExportFileName } from '../lib/export/utils';
import { getFaultyQuestions } from '../lib/validate';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialAction?: ExportActionType;
  exam: Exam | null;
  config: ExamConfig;
  activeVersionCode?: string;
  onShowToast?: (msg: string) => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  initialAction = 'PRINT',
  exam,
  config,
  activeVersionCode = '101',
  onShowToast,
}) => {
  const [currentAction, setCurrentAction] = useState<ExportActionType>(initialAction);
  const [options, setOptions] = useState<ExportOptions>({
    ...DEFAULT_EXPORT_OPTIONS,
    selectedVersionCode: activeVersionCode || 'ALL',
  });
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [localToast, setLocalToast] = useState<string | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string>('');
  const [showConfirmBlockModal, setShowConfirmBlockModal] = useState<boolean>(false);
  const [isTeacherConfirmedClean, setIsTeacherConfirmedClean] = useState<boolean>(false);

  const faultyQuestions = useMemo(() => {
    if (!exam) return [];
    return getFaultyQuestions(exam.questions, config, exam);
  }, [exam, config]);

  useEffect(() => {
    if (isOpen) {
      setCurrentAction(initialAction);
      setOptions((prev) => ({
        ...prev,
        selectedVersionCode: activeVersionCode || 'ALL',
      }));
      setShowConfirmBlockModal(false);
      setIsTeacherConfirmedClean(false);
    }
  }, [isOpen, initialAction, activeVersionCode]);

  if (!isOpen || !exam) return null;

  const showLocalToast = (msg: string) => {
    setLocalToast(msg);
    if (onShowToast) onShowToast(msg);
    setTimeout(() => setLocalToast(null), 3500);
  };

  const availableVersions =
    exam.versions && exam.versions.length > 0
      ? exam.versions.map((v) => v.code)
      : ['101'];

  // Đổi trạng thái chọn nội dung
  const toggleContent = (key: keyof ExportOptions) => {
    setOptions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const isAnyContentSelected =
    options.includeExam ||
    options.includeAnswers ||
    options.includeScoring ||
    options.includeMatrix ||
    options.includeSpec;

  const performActualExport = async (effectiveOptions: ExportOptions) => {
    setIsProcessing(true);

    try {
      if (currentAction === 'PRINT') {
        executePrint(exam, config, effectiveOptions);
        showLocalToast('Đang mở hộp thoại in của hệ thống...');
        setTimeout(() => {
          setIsProcessing(false);
          onClose();
        }, 500);
      } else if (currentAction === 'PDF') {
        const fileName = executeExportPdf(exam, config, effectiveOptions);
        setPdfFileName(fileName);
        showLocalToast(`Đã chuẩn bị file PDF: "${fileName}". Chọn "Lưu thành PDF" trên hộp thoại.`);
        setTimeout(() => {
          setIsProcessing(false);
          onClose();
        }, 800);
      } else if (currentAction === 'WORD') {
        const result = await exportExamToWord(exam, config, effectiveOptions);
        triggerFileDownload(result.blob, result.fileName);
        if (result.warnings.length > 0) {
          showLocalToast(`Đã xuất file Word: ${result.fileName} (${result.warnings.length} công thức dùng ảnh dự phòng).`);
        } else {
          showLocalToast(`Đã tải xuống file Word: ${result.fileName}!`);
        }
        setIsProcessing(false);
        onClose();
      } else if (currentAction === 'COPY') {
        const ok = await copyExamToClipboard(exam, config, effectiveOptions);
        if (ok) {
          showLocalToast('Đã sao chép nội dung vào bộ nhớ tạm (dán được vào Word giữ nguyên định dạng)!');
        } else {
          showLocalToast('Không thể tự động ghi vào clipboard. Vui lòng thử phương án In hoặc Xuất Word.');
        }
        setIsProcessing(false);
        onClose();
      }
    } catch (err: any) {
      console.error('Lỗi khi xuất bản:', err);
      showLocalToast(`Lỗi: ${err?.message || 'Không thể xuất bản'}`);
      setIsProcessing(false);
    }
  };

  const handleExecute = async () => {
    if (!isAnyContentSelected) {
      showLocalToast('Vui lòng chọn ít nhất 1 nội dung để xuất bản.');
      return;
    }

    // Nếu đề còn câu lỗi ERROR hoặc needsReview -> hiển thị hộp thoại xác nhận 3 lựa chọn
    if (faultyQuestions.length > 0) {
      setShowConfirmBlockModal(true);
      return;
    }

    performActualExport({ ...options, isDraft: false });
  };

  const previewFileName = generateExportFileName(
    exam,
    config,
    options.selectedVersionCode,
    currentAction === 'WORD' ? 'docx' : currentAction === 'PDF' ? 'pdf' : ''
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full my-6 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header Modal */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              {currentAction === 'PRINT' && <Printer className="w-5 h-5" />}
              {currentAction === 'WORD' && <FileDown className="w-5 h-5" />}
              {currentAction === 'PDF' && <FileText className="w-5 h-5" />}
              {currentAction === 'COPY' && <Copy className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">
                Tùy chọn xuất bản & in ấn
              </h3>
              <p className="text-xs text-slate-500">
                Chuẩn hóa định dạng A4, Times New Roman 13pt & công thức toán học
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 4 Tabs phương thức xuất */}
        <div className="border-b border-slate-200 bg-slate-100/70 p-2 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCurrentAction('PRINT')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              currentAction === 'PRINT'
                ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>In đề (A4)</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentAction('WORD')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              currentAction === 'WORD'
                ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>Xuất Word (.docx)</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentAction('PDF')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              currentAction === 'PDF'
                ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Xuất PDF</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentAction('COPY')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              currentAction === 'COPY'
                ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Sao chép (HTML)</span>
          </button>
        </div>

        {/* Nội dung form thiết lập */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
          {/* Hướng dẫn riêng cho từng phương thức */}
          {currentAction === 'PDF' && (
            <div className="p-3 bg-blue-50/90 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-center gap-2.5">
              <Info className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                <strong>Hướng dẫn xuất PDF:</strong> Khi hộp thoại in mở ra, thầy/cô vui lòng chọn mục <strong>Đích đến (Destination): “Lưu dưới dạng PDF”</strong> (Save as PDF).
              </span>
            </div>
          )}

          {currentAction === 'WORD' && (
            <div className="p-3 bg-indigo-50/80 border border-indigo-200 rounded-xl text-xs text-indigo-900 flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>
                File Word chuẩn hóa lề A4 (trái 25mm, phải 15mm, trên/dưới 20mm), font Times New Roman 13pt và đầu đề 2 cột kèm đánh số trang tự động.
              </span>
            </div>
          )}

          {currentAction === 'COPY' && (
            <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-700 flex items-center gap-2.5">
              <Copy className="w-4 h-4 text-slate-500 shrink-0" />
              <span>
                Sao chép dữ liệu dạng bảng và văn bản chuẩn HTML/Plain Text. Khi dán vào Microsoft Word sẽ tự động giữ nguyên định dạng bảng, font chữ và số thứ tự.
              </span>
            </div>
          )}

          {/* 1. Chọn nội dung xuất bản */}
          <div className="space-y-2.5">
            <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider">
              1. Chọn các nội dung cần xuất bản:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <label
                onClick={() => toggleContent('includeExam')}
                className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer select-none transition-all ${
                  options.includeExam
                    ? 'bg-blue-50/70 border-blue-300 text-blue-900'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="mt-0.5">
                  {options.includeExam ? (
                    <CheckSquare className="w-4 h-4 text-blue-600" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                </div>
                <div>
                  <span className="font-bold">Đề kiểm tra</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Đầu đề, thông tin thí sinh, câu hỏi trắc nghiệm & tự luận
                  </p>
                </div>
              </label>

              <label
                onClick={() => toggleContent('includeAnswers')}
                className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer select-none transition-all ${
                  options.includeAnswers
                    ? 'bg-blue-50/70 border-blue-300 text-blue-900'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="mt-0.5">
                  {options.includeAnswers ? (
                    <CheckSquare className="w-4 h-4 text-blue-600" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                </div>
                <div>
                  <span className="font-bold">Đáp án & Lời giải</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Bảng đáp án nhanh và lời giải chi tiết cho từng câu
                  </p>
                </div>
              </label>

              <label
                onClick={() => toggleContent('includeScoring')}
                className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer select-none transition-all ${
                  options.includeScoring
                    ? 'bg-blue-50/70 border-blue-300 text-blue-900'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="mt-0.5">
                  {options.includeScoring ? (
                    <CheckSquare className="w-4 h-4 text-blue-600" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                </div>
                <div>
                  <span className="font-bold">Hướng dẫn chấm</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Thang biểu điểm chi tiết và tiêu chí chấm tự luận
                  </p>
                </div>
              </label>

              <label
                onClick={() => toggleContent('includeMatrix')}
                className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer select-none transition-all ${
                  options.includeMatrix
                    ? 'bg-blue-50/70 border-blue-300 text-blue-900'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="mt-0.5">
                  {options.includeMatrix ? (
                    <CheckSquare className="w-4 h-4 text-blue-600" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                </div>
                <div>
                  <span className="font-bold">Ma trận đề thi</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Bảng phân bổ dạng câu và mức độ nhận thức (khổ ngang)
                  </p>
                </div>
              </label>

              <label
                onClick={() => toggleContent('includeSpec')}
                className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer select-none transition-all ${
                  options.includeSpec
                    ? 'bg-blue-50/70 border-blue-300 text-blue-900'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="mt-0.5">
                  {options.includeSpec ? (
                    <CheckSquare className="w-4 h-4 text-blue-600" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                </div>
                <div>
                  <span className="font-bold">Bản đặc tả đề thi</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Chi tiết yêu cầu cần đạt theo chuẩn GDPT 2018 (khổ ngang)
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* 2. Chọn mã đề */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider">
              2. Chọn mã đề thi cần xuất:
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setOptions((prev) => ({ ...prev, selectedVersionCode: 'ALL' }))}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  options.selectedVersionCode === 'ALL'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                Tất cả các mã đề ({availableVersions.length} mã)
              </button>

              {availableVersions.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setOptions((prev) => ({ ...prev, selectedVersionCode: code }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-colors ${
                    options.selectedVersionCode === code
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  Mã {code}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500">
              Mỗi phần và mỗi mã đề sẽ tự động bắt đầu ở một trang giấy mới. Mã đề thi được in rõ ràng ở góc đầu đề.
            </p>
          </div>

          {/* 3. Tùy chọn nâng cao riêng cho Word */}
          {currentAction === 'WORD' && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
              <label className="block text-xs font-bold text-slate-800">
                Công thức toán học trong Word:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <label className="flex items-start gap-2 p-2.5 bg-white rounded-lg border border-slate-200 cursor-pointer">
                  <input
                    type="radio"
                    name="formulaMode"
                    value="OMML"
                    checked={options.formulaMode === 'OMML'}
                    onChange={() => setOptions((prev) => ({ ...prev, formulaMode: 'OMML' }))}
                    className="mt-0.5 text-blue-600"
                  />
                  <div>
                    <span className="font-semibold text-slate-900">
                      1. Công thức Word sửa được (Khuyên dùng)
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Chuyển sang định dạng toán học OMML gốc của Microsoft Word để chỉnh sửa dễ dàng
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-2 p-2.5 bg-white rounded-lg border border-slate-200 cursor-pointer">
                  <input
                    type="radio"
                    name="formulaMode"
                    value="PNG"
                    checked={options.formulaMode === 'PNG'}
                    onChange={() => setOptions((prev) => ({ ...prev, formulaMode: 'PNG' }))}
                    className="mt-0.5 text-blue-600"
                  />
                  <div>
                    <span className="font-semibold text-slate-900">
                      2. Ảnh PNG cố định
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Hiển thị sắc nét trên mọi phiên bản Word cũ nhưng không sửa được ký hiệu
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* 4. Tùy chọn in kèm dòng thông tin AI */}
          <div className="pt-2 border-t border-slate-200">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 select-none">
              <input
                type="checkbox"
                checked={options.includeAiNotice}
                onChange={(e) => setOptions((prev) => ({ ...prev, includeAiNotice: e.target.checked }))}
                className="w-4 h-4 text-blue-600 rounded border-slate-300"
              />
              <span>In kèm dòng thông báo: <em>“Đề thi được biên soạn với sự hỗ trợ của Hệ thống Sinh Đề GDPT 2018 (Google Gemini AI)”</em> (Mặc định tắt)</span>
            </label>
          </div>

          {/* Tên file gợi ý */}
          <div className="flex items-center justify-between text-[11px] text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <span>Tên file chuẩn:</span>
            <span className="font-mono font-semibold text-slate-800">{previewFileName}</span>
          </div>
        </div>

        {/* Footer Modal */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {localToast && <span className="font-bold text-emerald-700">{localToast}</span>}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl transition-colors"
            >
              Hủy
            </button>

            <button
              type="button"
              onClick={handleExecute}
              disabled={isProcessing || !isAnyContentSelected}
              className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang xử lý...</span>
                </>
              ) : currentAction === 'PRINT' ? (
                <>
                  <Printer className="w-4 h-4" />
                  <span>Bắt đầu In đề</span>
                </>
              ) : currentAction === 'WORD' ? (
                <>
                  <FileDown className="w-4 h-4" />
                  <span>Tải file Word (.docx)</span>
                </>
              ) : currentAction === 'PDF' ? (
                <>
                  <FileText className="w-4 h-4" />
                  <span>Lưu thành PDF</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Sao chép ngay</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Hộp xác nhận chặn xuất khi còn lỗi (ERROR hoặc needsReview) */}
        {showConfirmBlockModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl border-2 border-rose-400 shadow-2xl max-w-lg w-full p-5 space-y-4 animate-in zoom-in-95">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Đề thi còn câu hỏi lỗi hoặc chưa hoàn thiện
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Phát hiện {faultyQuestions.length} câu hỏi có lỗi ERROR hoặc cần kiểm tra trước khi xuất bản.
                  </p>
                </div>
              </div>

              {/* Danh sách câu lỗi và lý do */}
              <div className="max-h-52 overflow-y-auto space-y-2 border border-rose-200 bg-rose-50/60 rounded-xl p-3 text-xs">
                {faultyQuestions.map((item) => (
                  <div key={item.question.id} className="flex items-start gap-2 text-rose-950">
                    <span className="font-bold px-1.5 py-0.5 bg-rose-200 text-rose-900 rounded text-[11px] shrink-0">
                      Câu {item.index}
                    </span>
                    <span className="text-rose-800 leading-tight">
                      {item.reasons.join(' • ')}
                    </span>
                  </div>
                ))}
              </div>

              {/* Checkbox xác nhận của giáo viên */}
              <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer text-xs text-slate-700 hover:bg-slate-100 select-none transition-colors">
                <input
                  type="checkbox"
                  checked={isTeacherConfirmedClean}
                  onChange={(e) => setIsTeacherConfirmedClean(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                />
                <span className="font-bold text-slate-900">Tôi đã kiểm tra</span>
                <span className="text-slate-500 text-[11px]">(Cho phép xuất bản sạch không kèm chú thích)</span>
              </label>

              {/* 3 Lựa chọn hành động */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowConfirmBlockModal(false);
                    onClose();
                  }}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
                >
                  Quay lại sửa
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowConfirmBlockModal(false);
                    performActualExport({ ...options, isDraft: true });
                  }}
                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs transition-colors shadow-2xs cursor-pointer"
                  title="Chèn chú thích đỏ [CẦN KIỂM TRA: lý do] ngay sau các câu lỗi"
                >
                  Xuất bản nháp
                </button>

                <button
                  type="button"
                  disabled={!isTeacherConfirmedClean}
                  onClick={() => {
                    setShowConfirmBlockModal(false);
                    performActualExport({ ...options, isDraft: false });
                  }}
                  className={`px-3.5 py-2 font-bold rounded-xl text-xs transition-colors shadow-2xs ${
                    isTeacherConfirmedClean
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                  title={!isTeacherConfirmedClean ? 'Vui lòng tích chọn "Tôi đã kiểm tra" để kích hoạt' : 'Xuất bản sạch không chèn chú thích'}
                >
                  Xuất bản sạch
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
