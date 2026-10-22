import React from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { ConfigPanel } from './components/ConfigPanel';
import { PreviewPanel } from './components/PreviewPanel';
import { SavedExamsModal } from './components/SavedExamsModal';
import { QuestionBankModal } from './components/QuestionBankModal';
import { ExportModal } from './components/ExportModal';
import { ImportMatrixModal } from './components/ImportMatrixModal';
import { ExamProvider, useExamStore } from './store';
import { CheckCircle2, Info } from 'lucide-react';

function AppContent() {
  const {
    currentExam,
    config,
    selectedVersionIndex,
    isSavedExamsModalOpen,
    setIsSavedExamsModalOpen,
    loadExamFromSaved,
    isBankModalOpen,
    setIsBankModalOpen,
    insertBankQuestionsToCurrentExam,
    setBankQuestionsAsTeacherQuestions,
    exportModalState,
    closeExportModal,
    notificationMessage,
    setNotificationMessage,
  } = useExamStore();

  const activeVersionCode =
    currentExam?.versions && currentExam.versions[selectedVersionIndex]
      ? currentExam.versions[selectedVersionIndex].code
      : '101';

  return (
    <div className="min-h-screen flex flex-col bg-slate-100/60 font-sans text-slate-800 antialiased selection:bg-blue-100 selection:text-blue-900 relative">
      {/* Thông báo nổi (Toast Notification) */}
      {notificationMessage && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md bg-slate-900/95 text-white px-4 py-3 rounded-2xl shadow-2xl text-xs font-medium backdrop-blur-md border border-slate-700/60 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="leading-snug">{notificationMessage}</span>
        </div>
      )}

      {/* Thanh tiêu đề chính */}
      <Header />

      {/* Nội dung chính 2 cột: Trái: Thiết lập - Phải: Xem trước (5 tabs) */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Cột trái: Thiết lập (Chiếm 5/12 cột trên màn hình lớn) */}
          <section
            aria-label="Cột thiết lập cấu hình đề"
            className="lg:col-span-5 w-full sticky top-22 self-start"
          >
            <ConfigPanel />
          </section>

          {/* Cột phải: Xem trước (Chiếm 7/12 cột trên màn hình lớn) */}
          <section
            aria-label="Cột xem trước đề kiểm tra"
            className="lg:col-span-7 w-full"
          >
            <PreviewPanel />
          </section>
        </div>
      </main>

      {/* Chân trang cố định quy chuẩn sư phạm và cảnh báo AI */}
      <Footer />

      {/* Modal Màn hình Đề đã lưu */}
      <SavedExamsModal
        isOpen={isSavedExamsModalOpen}
        onClose={() => setIsSavedExamsModalOpen(false)}
        onLoadExam={loadExamFromSaved}
      />

      {/* Modal Màn hình Ngân hàng câu hỏi */}
      <QuestionBankModal
        isOpen={isBankModalOpen}
        onClose={() => setIsBankModalOpen(false)}
        onInsertQuestionsToExam={insertBankQuestionsToCurrentExam}
        onSetAsTeacherQuestions={setBankQuestionsAsTeacherQuestions}
      />

      {/* Modal Hộp thoại chọn nội dung Xuất bản & In ấn */}
      <ExportModal
        isOpen={exportModalState.isOpen}
        onClose={closeExportModal}
        initialAction={exportModalState.action}
        exam={currentExam}
        config={config}
        activeVersionCode={activeVersionCode}
        onShowToast={(msg) => {
          setNotificationMessage(msg);
          setTimeout(() => setNotificationMessage(null), 3500);
        }}
      />

      {/* Modal Tạo từ ma trận có sẵn */}
      <ImportMatrixModal />
    </div>
  );
}

export default function App() {
  return (
    <ExamProvider>
      <AppContent />
    </ExamProvider>
  );
}
