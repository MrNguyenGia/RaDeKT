import React, { useMemo, useState } from 'react';
import { Grid, FileSpreadsheet, ArrowRight, BookOpen, Layers, CheckCircle2, AlertTriangle } from 'lucide-react';
import { BlueprintSlot, ExamConfig, Question } from '../../types';
import {
  buildMatrixSummary,
  buildSpecificationRows,
  formatQuestionRange,
  compareExamWithImportedMatrix,
} from '../../lib/matrix';
import { MathText } from '../MathText';
import { DocPage } from '../common/DocPage';
import { formatScore } from '../../config';

interface MatrixSpecTabProps {

  config: ExamConfig;
  blueprint: BlueprintSlot[];
  questions?: Question[];
  onJumpToQuestion: (qNumber: number) => void;
}

export const MatrixSpecTab: React.FC<MatrixSpecTabProps> = ({
  config,
  blueprint,
  questions = [],
  onJumpToQuestion,
}) => {
  // Chế độ xem phụ: Ma trận vs Bản đặc tả
  const [activeSubTab, setActiveSubTab] = useState<'MATRIX' | 'SPECIFICATION'>('MATRIX');
  // Chế độ xem ma trận: Chủ đề vs Dạng câu
  const [matrixViewMode, setMatrixViewMode] = useState<'TOPIC' | 'QUESTION_TYPE'>('TOPIC');

  // Dùng slots từ questions thực tế nếu đã sinh đề, hoặc blueprint dự kiến
  const effectiveSlots: BlueprintSlot[] = useMemo(() => {
    if (questions.length > 0) {
      return questions.map((q, idx) => ({
        id: q.slotId || q.id,
        orderNumber: idx + 1,
        questionType: q.type,
        level: q.level,
        topic: q.topic || config.topicName || 'Kiến thức trọng tâm',
        score: q.score,
        learningOutcome: q.scoringGuide || 'Chuẩn kiến thức, kỹ năng cần đạt theo chương trình GDPT.',
      }));
    }
    return blueprint;
  }, [questions, blueprint, config.topicName]);

  // Tính ma trận
  const matrixSummary = useMemo(() => {
    return buildMatrixSummary(effectiveSlots, config, matrixViewMode);
  }, [effectiveSlots, config, matrixViewMode]);

  // Tính bản đặc tả
  const specRows = useMemo(() => {
    return buildSpecificationRows(effectiveSlots, config);
  }, [effectiveSlots, config]);

  // So sánh đề thi với ma trận gốc nhập sẵn
  const matrixMatch = useMemo(() => {
    if (!config.importedMatrix || questions.length === 0) return null;
    return compareExamWithImportedMatrix(questions, config.importedMatrix);
  }, [questions, config.importedMatrix]);

  return (
    <div className="doc-viewport-bg py-4 px-2 sm:px-4">
      <DocPage footerText="Ma trận & Bản đặc tả theo chuẩn GDPT 2018">
        {/* Header & Sub-tab Switch */}
        <div className="border-b-2 border-slate-900 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-bold uppercase text-base sm:text-lg text-slate-950">
              MA TRẬN & BẢN ĐẶC TẢ ĐỀ KIỂM TRA
            </h2>
            <p className="text-xs text-slate-600 italic">
              Quy chuẩn đánh giá 2 chiều theo khung năng lực Chương trình GDPT 2018
            </p>
          </div>


        {/* Nút chuyển đổi giữa Ma trận và Bản đặc tả */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 print:hidden shrink-0">
          <button
            type="button"
            onClick={() => setActiveSubTab('MATRIX')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
              activeSubTab === 'MATRIX'
                ? 'bg-white text-blue-800 shadow-2xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>1. Bảng Ma trận</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('SPECIFICATION')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
              activeSubTab === 'SPECIFICATION'
                ? 'bg-white text-blue-800 shadow-2xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>2. Bản đặc tả chi tiết</span>
          </button>
        </div>
      </div>

      {/* Thông tin đối soát Ma trận gốc nếu được nạp từ file/bảng */}
      {config.importedMatrix && (
        <div
          className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            matrixMatch
              ? matrixMatch.isMatch100
                ? 'bg-emerald-50 border-emerald-300'
                : 'bg-amber-50 border-amber-300'
              : 'bg-blue-50 border-blue-200'
          }`}
        >
          <div className="flex items-center gap-3">
            {matrixMatch ? (
              matrixMatch.isMatch100 ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              )
            ) : (
              <FileSpreadsheet className="w-5 h-5 text-blue-600 shrink-0" />
            )}
            <div>
              <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                <span>Ma trận gốc nhập sẵn ({config.importedMatrix.topics.length} chủ đề)</span>
                {matrixMatch && (
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                      matrixMatch.isMatch100
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-amber-100 text-amber-800 border-amber-300'
                    }`}
                  >
                    {matrixMatch.isMatch100 ? 'Khớp ma trận gốc 100% ✓' : `Lệch ${matrixMatch.discrepancies.length} ô`}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                {matrixMatch?.isMatch100
                  ? 'Tất cả các ô phân bổ giữa đề thi và ma trận gốc đều khớp hoàn hảo 100% về số câu, dạng câu và mức độ nhận thức.'
                  : matrixMatch
                  ? `Có ${matrixMatch.discrepancies.length} ô có độ lệch về số câu giữa ma trận gốc và đề thi thực tế.`
                  : 'Bản đặc tả được dựng đúng từng ô theo ma trận có sẵn (không dùng thuật toán tự điền).'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* PHẦN 1: BẢNG MA TRẬN ĐỀ KIỂM TRA */}
      {/* ========================================================= */}
      {activeSubTab === 'MATRIX' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-900 uppercase">
              Bảng ma trận 2 chiều (Chủ đề / Dạng câu × Mức độ nhận thức):
            </span>

            {/* Công tắc chuyển: Chủ đề | Dạng câu hỏi */}
            <div className="flex items-center gap-2 text-xs print:hidden">
              <span className="text-slate-500 font-medium">Xem theo:</span>
              <div className="inline-flex rounded-lg border border-slate-300 p-0.5 bg-slate-50">
                <button
                  type="button"
                  onClick={() => setMatrixViewMode('TOPIC')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${
                    matrixViewMode === 'TOPIC'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Chủ đề kiến thức
                </button>
                <button
                  type="button"
                  onClick={() => setMatrixViewMode('QUESTION_TYPE')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${
                    matrixViewMode === 'QUESTION_TYPE'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Dạng câu hỏi
                </button>
              </div>
            </div>
          </div>

          {/* Bảng ma trận */}
          <div className="overflow-x-auto rounded-xl border border-slate-300 shadow-2xs">
            <table className="w-full text-center border-collapse text-xs font-serif">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-bold">
                  <th className="py-2.5 px-3 text-left w-1/4 border-r border-slate-300">
                    {matrixViewMode === 'TOPIC' ? 'Chủ đề / Mạch nội dung' : 'Dạng câu hỏi'}
                  </th>
                  {matrixSummary.levels.map((lvl) => (
                    <th key={lvl} className="py-2.5 px-2 border-r border-slate-300">
                      <div>
                        {lvl === 'NB'
                          ? 'Nhận biết'
                          : lvl === 'TH'
                          ? 'Thông hiểu'
                          : lvl === 'VD'
                          ? 'Vận dụng'
                          : 'Vận dụng cao'}
                      </div>
                      <div className="text-[10px] text-slate-500 font-normal">({lvl})</div>
                    </th>
                  ))}
                  <th className="py-2.5 px-3 bg-slate-200/70 font-bold text-slate-950">
                    TỔNG CỘNG
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {matrixSummary.rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-3 text-left font-bold text-slate-900 border-r border-slate-300">
                      {row.name}
                    </td>
                    {matrixSummary.levels.map((lvl) => {
                      const cell = row.cells[lvl];
                      return (
                        <td
                          key={lvl}
                          className="py-2 px-2 border-r border-slate-300 align-top"
                        >
                          {cell.count > 0 ? (
                            <div className="space-y-1">
                              <div className="font-bold text-slate-900">
                                {cell.count} câu
                              </div>
                              <div className="text-[11px] text-blue-700 font-semibold">
                                {formatScore(cell.score)}đ ({formatScore(cell.percentage)}%)
                              </div>
                              {/* Nút bấm nhảy đến câu tương ứng */}
                              {cell.questionNumbers.length > 0 && (
                                <div className="flex flex-wrap gap-1 justify-center pt-0.5 print:hidden">
                                  {cell.questionNumbers.map((qNum) => (
                                    <button
                                      key={qNum}
                                      type="button"
                                      onClick={() => onJumpToQuestion(qNum)}
                                      className="text-[10px] font-bold text-blue-700 hover:text-white bg-blue-50 hover:bg-blue-600 px-1 py-0.2 rounded border border-blue-200 transition-colors cursor-pointer"
                                      title={`Nhảy tới Câu ${qNum} ở Đề thi`}
                                    >
                                      Câu {qNum}
                                    </button>
                                  ))}
                                </div>
                              )}
                              {/* Khi in ấn hiển thị chữ thường */}
                              <div className="hidden print:block text-[10px] text-slate-500 italic">
                                {formatQuestionRange(cell.questionNumbers)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="py-2 px-3 bg-slate-50/50 align-top font-bold text-slate-900">
                      <div>{row.total.count} câu</div>
                      <div className="text-[11px] text-blue-900 font-semibold">
                        {formatScore(row.total.score)}đ ({formatScore(row.total.percentage)}%)
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-bold border-t-2 border-slate-400 text-slate-950">
                  <td className="py-2.5 px-3 text-left border-r border-slate-300 uppercase">
                    TỔNG SỐ
                  </td>
                  {matrixSummary.levels.map((lvl) => {
                    const colCount = matrixSummary.rows.reduce(
                      (acc, r) => acc + r.cells[lvl].count,
                      0
                    );
                    const colScore = matrixSummary.rows.reduce(
                      (acc, r) => acc + r.cells[lvl].score,
                      0
                    );
                    const colPct = matrixSummary.grandTotal.score > 0
                      ? formatScore((colScore / matrixSummary.grandTotal.score) * 100)
                      : '0';

                    return (
                      <td key={lvl} className="py-2.5 px-2 border-r border-slate-300">
                        <div className="text-blue-900 font-bold">{colCount} câu</div>
                        <div className="text-[11px] text-slate-700 font-medium">
                          {formatScore(colScore)}đ ({colPct}%)
                        </div>
                      </td>
                    );
                  })}
                  <td className="py-2.5 px-3 bg-slate-200/80 font-bold text-blue-950 text-sm">
                    <div>{matrixSummary.grandTotal.count} câu</div>
                    <div className="text-xs text-blue-900">
                      {formatScore(matrixSummary.grandTotal.score)}đ (100%)
                    </div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* PHẦN 2: BẢN ĐẶC TẢ CHI TIẾT */}
      {/* ========================================================= */}
      {activeSubTab === 'SPECIFICATION' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 uppercase">
              Bản đặc tả chi tiết ma trận đề kiểm tra ({effectiveSlots.length} câu hỏi):
            </span>
            <span className="text-xs text-slate-500 italic">
              Bấm vào số câu để xem nội dung câu hỏi tương ứng trong đề thi
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-300 shadow-2xs">
            <table className="w-full text-left border-collapse text-xs font-serif">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-bold">
                  <th className="py-2.5 px-3 w-12 text-center border-r border-slate-300">STT</th>
                  <th className="py-2.5 px-3 w-40 border-r border-slate-300">Chủ đề kiến thức</th>
                  <th className="py-2.5 px-4 border-r border-slate-300">Yêu cầu cần đạt</th>
                  <th className="py-2.5 px-2.5 w-24 text-center border-r border-slate-300">Dạng câu</th>
                  <th className="py-2.5 px-2 w-16 text-center border-r border-slate-300">Mức độ</th>
                  <th className="py-2.5 px-3 w-28 text-center border-r border-slate-300">Số câu</th>
                  <th className="py-2.5 px-2.5 w-16 text-right">Điểm</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {specRows.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 text-center font-bold text-slate-700 border-r border-slate-200">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900 border-r border-slate-200">
                      {row.topic}
                    </td>
                    <td className="py-2.5 px-4 text-slate-800 leading-relaxed border-r border-slate-200">
                      <MathText content={row.learningOutcome} />
                    </td>
                    <td className="py-2.5 px-2.5 text-center text-slate-700 border-r border-slate-200 font-medium">
                      {row.questionTypeLabel}
                    </td>
                    <td className="py-2.5 px-2 text-center border-r border-slate-200">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          row.level === 'NB'
                            ? 'bg-emerald-100 text-emerald-800'
                            : row.level === 'TH'
                            ? 'bg-blue-100 text-blue-800'
                            : row.level === 'VD'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {row.level}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center border-r border-slate-200">
                      <div className="flex flex-wrap gap-1 justify-center">
                        {row.rawNumbers.map((qNum) => (
                          <button
                            key={qNum}
                            type="button"
                            onClick={() => onJumpToQuestion(qNum)}
                            className="text-[11px] font-bold text-blue-700 hover:text-white bg-blue-50 hover:bg-blue-600 px-1.5 py-0.5 rounded border border-blue-200 transition-colors"
                            title={`Nhảy tới Câu ${qNum} ở Đề thi`}
                          >
                            Câu {qNum}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-bold text-blue-800">
                      {formatScore(row.totalScore)}đ
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-bold border-t-2 border-slate-400 text-slate-900">
                  <td colSpan={5} className="py-2.5 px-3 text-right uppercase">
                    TỔNG CỘNG:
                  </td>
                  <td className="py-2.5 px-3 text-center text-blue-900">
                    {effectiveSlots.length} câu
                  </td>
                  <td className="py-2.5 px-2.5 text-right text-blue-900">
                    {formatScore(effectiveSlots.reduce((sum, s) => sum + s.score, 0))}đ
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
      </DocPage>
    </div>
  );
};
