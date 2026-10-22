import React, { useState } from 'react';
import {
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  FlaskConical,
  X,
  Bug,
} from 'lucide-react';
import { APP_DISCLAIMER } from '../config';
import { selfTest, SelfTestReport } from '../lib/selfTest';
import { DebugReportTable } from './DebugReportTable';

export const Footer: React.FC = () => {
  const [testReport, setTestReport] = useState<SelfTestReport | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isDebugOpen, setIsDebugOpen] = useState<boolean>(false);

  const handleRunSelfTest = () => {
    const report = selfTest();
    setTestReport(report);
    setIsModalOpen(true);
  };

  return (
    <>
      {/* Bảng Báo cáo từng câu (Chế độ gỡ lỗi - không in ra giấy, không xuất Word) */}
      <DebugReportTable isOpen={isDebugOpen} onClose={() => setIsDebugOpen(false)} />

      <footer className="bg-white border-t border-slate-200 py-3 mt-auto print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs">
            {/* Thông điệp cảnh báo bắt buộc */}
            <div className="flex items-center gap-2 text-amber-700 bg-amber-50/80 px-3 py-1.5 rounded-md border border-amber-200/70 font-medium">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{APP_DISCLAIMER}</span>
            </div>

            {/* Các tiện ích & nút Kiểm thử logic / Gỡ lỗi */}
            <div className="flex items-center gap-2.5 text-slate-500">
              <div className="hidden md:flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <span>Chuẩn 4 mức: NB • TH • VD • VDC</span>
              </div>

              {/* Nút nhỏ Gỡ lỗi ở chân trang */}
              <button
                type="button"
                onClick={() => setIsDebugOpen((prev) => !prev)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                  isDebugOpen
                    ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold'
                    : 'text-slate-700 bg-slate-100 hover:bg-amber-50 hover:text-amber-800 border border-slate-200'
                }`}
                title="Bật/tắt bảng báo cáo gỡ lỗi từng câu hỏi"
              >
                <Bug className="w-3.5 h-3.5 text-amber-600" />
                <span>Gỡ lỗi</span>
              </button>

              {/* Nút nhỏ Kiểm thử logic ở chân trang */}
              <button
                type="button"
                onClick={handleRunSelfTest}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 transition-colors cursor-pointer"
                title="Chạy kiểm tra tự động các thuật toán tính điểm và quy đổi câu hỏi"
              >
                <FlaskConical className="w-3.5 h-3.5 text-blue-600" />
                <span>Kiểm thử logic</span>
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Modal hiển thị kết quả Kiểm thử logic */}
      {isModalOpen && testReport && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Header Modal */}
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    testReport.overallPassed
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {testReport.overallPassed ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <XCircle className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    Kết quả Kiểm thử logic thuật toán
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                        testReport.overallPassed
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {testReport.overallPassed ? 'ĐẠT 100%' : 'KHÔNG ĐẠT'}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Thời điểm chạy: {testReport.timestamp} • {testReport.passedTests}/
                    {testReport.totalTests} trường hợp kiểm thử thành công
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Danh sách các ca kiểm thử */}
            <div className="p-5 max-h-[70vh] overflow-y-auto space-y-3 text-xs">
              {testReport.results.map((t, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border ${
                    t.passed
                      ? 'bg-emerald-50/40 border-emerald-200'
                      : 'bg-red-50/50 border-red-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                      {t.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                      )}
                      <span>
                        Ca {idx + 1}: {t.name}
                      </span>
                    </span>

                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                        t.passed
                          ? 'bg-emerald-200 text-emerald-800'
                          : 'bg-red-200 text-red-800'
                      }`}
                    >
                      {t.passed ? 'ĐẠT' : 'KHÔNG ĐẠT'}
                    </span>
                  </div>

                  <div className="space-y-1 text-[11px] text-slate-600 bg-white/80 p-2 rounded border border-slate-200 font-mono">
                    <div>
                      <strong className="text-slate-500 font-sans">Kỳ vọng:</strong> {t.expected}
                    </div>
                    <div>
                      <strong className="text-slate-500 font-sans">Thực tế:</strong> {t.actual}
                    </div>
                  </div>

                  {t.details && (
                    <div className="mt-1 text-[10px] text-slate-500 italic">
                      * {t.details}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Footer Modal */}
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-500 text-[11px]">
                Toàn bộ phép tính số câu & chia điểm do code thuần xử lý (Không dùng AI).
              </span>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors text-xs"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
