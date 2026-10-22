import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Wrench,
  HelpCircle,
  Eye,
} from 'lucide-react';
import { QualityCheckReport, CriterionSummary } from '../../services/quality';
import { QualityIssue } from '../../lib/validate';
import { Exam } from '../../types';

interface QualityReportModalProps {
  report: QualityCheckReport | null;
  exam: Exam | null;
  isRunningCheck: boolean;
  onRecheck: () => Promise<void>;
  onClose: () => void;
  onJumpToQuestion: (qIdOrNumber: string | number) => void;
}

export const QualityReportModal: React.FC<QualityReportModalProps> = ({
  report,
  exam,
  isRunningCheck,
  onRecheck,
  onClose,
  onJumpToQuestion,
}) => {
  const [selectedCriterionId, setSelectedCriterionId] = useState<number | null>(null);

  if (!report && !isRunningCheck) {
    return null;
  }

  // Tìm số thứ tự câu hỏi từ questionId
  const getQuestionNumber = (qId?: string): number | null => {
    if (!qId || !exam) return null;
    const idx = exam.questions.findIndex((q) => q.id === qId);
    return idx !== -1 ? idx + 1 : null;
  };

  const handleIssueClick = (issue: QualityIssue) => {
    if (issue.questionId) {
      const qNum = getQuestionNumber(issue.questionId);
      if (qNum !== null) {
        onClose();
        onJumpToQuestion(qNum);
      }
    }
  };

  const passedCriteriaCount =
    report?.criteriaSummaries.filter((c) => c.status === 'PASS').length || 0;
  const warnCriteriaCount =
    report?.criteriaSummaries.filter((c) => c.status === 'WARN').length || 0;
  const errorCriteriaCount =
    report?.criteriaSummaries.filter((c) => c.status === 'ERROR').length || 0;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in duration-200">
        {/* HEADER */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
              <ShieldCheck className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Báo cáo kiểm tra chất lượng đề thi
                </h3>
                <span className="text-[11px] bg-blue-500/30 text-blue-200 px-2 py-0.5 rounded-full border border-blue-400/30 font-medium">
                  12 Tiêu chí chuẩn GDPT 2018
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Tự động thẩm định kết hợp bộ quy tắc CODE và AI chuyên gia khảo thí
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* LOADING TRẠNG THÁI KIỂM TRA */}
        {isRunningCheck && (
          <div className="p-8 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <RefreshCw className="w-6 h-6 animate-spin" />
            </div>
            <div>
              <h4 className="font-bold text-slate-800 text-sm">
                Đang rà soát và kiểm tra chất lượng 12 tiêu chí...
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Đang chạy quy tắc CODE, cho AI giải độc lập và tự sửa các lỗi phát hiện...
              </p>
            </div>
          </div>
        )}

        {/* NỘI DUNG BÁO CÁO */}
        {!isRunningCheck && report && (
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* THỐNG KÊ TỔNG QUÁT */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-purple-50/80 border border-purple-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-purple-700">Đã tự sửa</span>
                  <Wrench className="w-4 h-4 text-purple-600" />
                </div>
                <div className="text-2xl font-black text-purple-900 mt-1">
                  {report.repairedCount}
                </div>
                <div className="text-[11px] text-purple-700/80 mt-0.5">
                  Lỗi được AI sửa tự động
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-700">Tiêu chí Đạt</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-black text-emerald-900 mt-1">
                  {passedCriteriaCount} <span className="text-sm font-normal text-emerald-700">/ 12</span>
                </div>
                <div className="text-[11px] text-emerald-700/80 mt-0.5">
                  Đạt chuẩn tuyệt đối
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-amber-700">Cảnh báo</span>
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                </div>
                <div className="text-2xl font-black text-amber-900 mt-1">
                  {report.warnCount}
                </div>
                <div className="text-[11px] text-amber-700/80 mt-0.5">
                  Lưu ý sư phạm
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-rose-50/80 border border-rose-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-rose-700">Lỗi tồn đọng</span>
                  <XCircle className="w-4 h-4 text-rose-600" />
                </div>
                <div className="text-2xl font-black text-rose-900 mt-1">
                  {report.errorCount}
                </div>
                <div className="text-[11px] text-rose-700/80 mt-0.5">
                  Cần GV can thiệp
                </div>
              </div>
            </div>

            {/* DÒNG THÔNG BÁO TỔNG KẾT TỰ SỬA */}
            {report.repairedCount > 0 && (
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl flex items-center justify-between text-xs text-purple-900">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
                  <span>
                    Hệ thống <strong>đã tự sửa thành công {report.repairedCount} lỗi</strong> trong quá trình thẩm định.
                  </span>
                </div>
                <span className="text-[11px] bg-purple-200/70 text-purple-800 font-bold px-2 py-0.5 rounded-full">
                  Tự động tối ưu
                </span>
              </div>
            )}

            {/* BẢNG 12 TIÊU CHÍ */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="bg-slate-100/80 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Bảng đánh giá chi tiết 12 tiêu chí chất lượng
                </span>
                <span className="text-[11px] text-slate-500">
                  Bấm vào từng dòng hoặc lỗi để xem chi tiết
                </span>
              </div>

              <div className="divide-y divide-slate-100">
                {report.criteriaSummaries.map((crit) => {
                  const isExpanded = selectedCriterionId === crit.id;
                  const hasIssues = crit.issues.length > 0;

                  return (
                    <div
                      key={crit.id}
                      className={`transition-colors ${
                        crit.status === 'ERROR'
                          ? 'bg-rose-50/30'
                          : crit.status === 'WARN'
                          ? 'bg-amber-50/20'
                          : 'hover:bg-slate-50/60'
                      }`}
                    >
                      {/* Dòng tóm tắt tiêu chí */}
                      <div
                        onClick={() => setSelectedCriterionId(isExpanded ? null : crit.id)}
                        className="px-4 py-3 flex items-center justify-between gap-3 cursor-pointer"
                      >
                        {/* Cột 1: STT và Tên tiêu chí */}
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0 border border-slate-200">
                            {crit.id}
                          </span>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-xs sm:text-sm text-slate-900">
                                {crit.name}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                                  crit.category === 'CODE'
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                }`}
                              >
                                {crit.category}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 truncate max-w-md sm:max-w-xl">
                              {crit.shortDesc}
                            </p>
                          </div>
                        </div>

                        {/* Cột 2 & 3: Trạng thái và số lượng */}
                        <div className="flex items-center gap-3 shrink-0">
                          {crit.status === 'PASS' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold text-emerald-700 bg-emerald-100/80 border border-emerald-300">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Đạt ✓</span>
                            </span>
                          )}

                          {crit.status === 'WARN' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold text-amber-700 bg-amber-100/80 border border-amber-300">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>{crit.issues.length} Cảnh báo ⚠</span>
                            </span>
                          )}

                          {crit.status === 'ERROR' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold text-rose-700 bg-rose-100/80 border border-rose-300">
                              <XCircle className="w-3.5 h-3.5" />
                              <span>{crit.issues.length} Lỗi ✗</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Chi tiết các lỗi khi mở rộng hoặc khi có lỗi */}
                      {(isExpanded || (hasIssues && crit.status === 'ERROR')) && (
                        <div className="px-4 pb-3 pt-1 border-t border-slate-100 bg-white/70 space-y-2">
                          <p className="text-xs text-slate-600 italic">
                            {crit.description}
                          </p>

                          {crit.issues.length > 0 ? (
                            <div className="space-y-1.5 pt-1">
                              {crit.issues.map((issue, idx) => {
                                const qNum = getQuestionNumber(issue.questionId);
                                return (
                                  <div
                                    key={idx}
                                    onClick={() => handleIssueClick(issue)}
                                    className={`p-2.5 rounded-lg border text-xs flex items-start justify-between gap-3 transition-colors ${
                                      issue.questionId ? 'cursor-pointer hover:shadow-xs' : ''
                                    } ${
                                      issue.severity === 'ERROR'
                                        ? 'bg-rose-50 border-rose-200 text-rose-900 hover:bg-rose-100/60'
                                        : 'bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100/60'
                                    }`}
                                  >
                                    <div className="space-y-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        {qNum !== null ? (
                                          <span className="font-bold underline text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded text-[11px]">
                                            Câu {qNum}
                                          </span>
                                        ) : (
                                          <span className="font-bold text-[11px] text-slate-700">
                                            Toàn bài thi
                                          </span>
                                        )}
                                        <span className="font-semibold">{issue.message}</span>
                                      </div>

                                      {issue.suggestedFix && (
                                        <div className="text-[11px] opacity-90 text-slate-700 pl-2 border-l-2 border-current">
                                          <strong>Gợi ý:</strong> {issue.suggestedFix}
                                        </div>
                                      )}
                                    </div>

                                    {issue.questionId && (
                                      <div className="flex items-center gap-1 text-[11px] font-bold text-blue-600 shrink-0">
                                        <span>Cuộn tới câu</span>
                                        <ArrowRight className="w-3.5 h-3.5" />
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-xs text-emerald-700 flex items-center gap-1.5 pt-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Tiêu chí này hoàn toàn thỏa mãn, không có lưu ý nào.</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* FOOTER ACTIONS */}
        <div className="border-t border-slate-200 bg-slate-50 px-6 py-3.5 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            {report?.timestamp ? `Kiểm tra lần cuối: ${new Date(report.timestamp).toLocaleTimeString()}` : ''}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRecheck}
              disabled={isRunningCheck}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRunningCheck ? 'animate-spin' : ''}`} />
              <span>Chạy lại kiểm tra</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1 px-4 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
            >
              <span>Đóng báo cáo</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
