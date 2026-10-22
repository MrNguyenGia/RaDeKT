import React from 'react';
import {
  GraduationCap,
  Sparkles,
  FileDown,
  FolderOpen,
  Database,
  Save,
  Check,
} from 'lucide-react';
import { APP_NAME, APP_SUBTITLE, DEFAULT_GEMINI_MODEL } from '../config';
import { useExamStore } from '../store';

export const Header: React.FC = () => {
  const {
    currentExam,
    saveCurrentExamAction,
    setIsSavedExamsModalOpen,
    setIsBankModalOpen,
    bankCount,
    openExportModal,
  } = useExamStore();

  const [isSaving, setIsSaving] = React.useState<boolean>(false);

  const handleSaveExam = async () => {
    setIsSaving(true);
    try {
      await saveCurrentExamAction();
    } finally {
      setTimeout(() => setIsSaving(false), 1000);
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18">
          {/* Logo & Tiêu đề */}
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-sm ring-2 ring-blue-100">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 font-sans">
                  {APP_NAME}
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                  <Sparkles className="w-3 h-3 text-blue-600" />
                  {DEFAULT_GEMINI_MODEL}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {APP_SUBTITLE}
              </p>
            </div>
          </div>

          {/* Công cụ đầu trang */}
          <div className="flex items-center gap-2">
            {/* Nút Lưu đề thi hiện tại */}
            {currentExam && (
              <button
                type="button"
                onClick={handleSaveExam}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition-colors"
                title="Lưu toàn bộ đề thi hiện tại vào bộ nhớ trình duyệt (IndexedDB)"
              >
                {isSaving ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                <span>{isSaving ? 'Đã lưu' : 'Lưu đề'}</span>
              </button>
            )}

            {/* Nút Màn hình Đề đã lưu */}
            <button
              type="button"
              onClick={() => setIsSavedExamsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-blue-700 hover:bg-blue-50 rounded-lg border border-slate-300 bg-white transition-colors shadow-2xs"
              title="Xem danh sách các đề thi đã lưu trong trình duyệt"
            >
              <FolderOpen className="w-3.5 h-3.5 text-blue-600" />
              <span>Đề đã lưu</span>
            </button>

            {/* Nút Ngân hàng câu hỏi */}
            <button
              type="button"
              onClick={() => setIsBankModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors shadow-2xs"
              title="Mở màn hình Ngân hàng câu hỏi"
            >
              <Database className="w-3.5 h-3.5 text-indigo-600" />
              <span>Ngân hàng câu hỏi</span>
              {bankCount > 0 && (
                <span className="bg-indigo-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-0.5">
                  {bankCount}
                </span>
              )}
            </button>

            {/* Nút Xuất Word */}
            {currentExam && (
              <button
                type="button"
                onClick={() => openExportModal('WORD')}
                title="Xuất đề thi và đáp án ra file Microsoft Word (.docx)"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors shadow-2xs"
              >
                <FileDown className="w-3.5 h-3.5 text-blue-600" />
                <span>Xuất Word (.docx)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
