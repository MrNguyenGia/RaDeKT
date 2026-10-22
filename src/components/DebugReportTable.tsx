import React, { useState, useMemo } from 'react';
import {
  Bug,
  Copy,
  Check,
  X,
  Code2,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  FileText,
  Search,
  Filter,
} from 'lucide-react';
import { useExamStore } from '../store';
import { Question, QuestionFigure, QuestionImageData } from '../types';
import { runCodeQualityCheck, QualityIssue } from '../lib/validate';
import { renderFigureToSvg } from '../lib/figureRenderer';

interface DebugReportTableProps {
  isOpen: boolean;
  onClose: () => void;
}

const FIGURE_KEYWORDS = [
  'hình vẽ',
  'hình bên',
  'hình dưới',
  'hình trên',
  'hình sau',
  'đồ thị',
  'bảng biến thiên',
  'biểu đồ',
  'sơ đồ',
];

interface FigureInspectionResult {
  kind: string;
  status: 'SUCCESS' | 'ERROR' | 'NONE';
  detail: string;
}

/**
 * Kiểm tra trạng thái vẽ hình của câu hỏi
 */
function inspectQuestionFigure(
  figure?: QuestionFigure,
  svgDiagram?: string,
  imageData?: QuestionImageData
): FigureInspectionResult {
  if (imageData?.dataUrl) {
    return {
      kind: 'Ảnh GV chèn',
      status: 'SUCCESS',
      detail: 'Đã tải ảnh lên (PNG/JPG)',
    };
  }

  if (figure) {
    try {
      const svg = renderFigureToSvg(figure);
      if (svg.includes('Không thể tạo hình:')) {
        const match = svg.match(/Không thể tạo hình: ([^<]+)/);
        return {
          kind: figure.kind,
          status: 'ERROR',
          detail: `Lỗi: ${match ? match[1].trim() : 'Lỗi cú pháp vẽ hình'}`,
        };
      }
      if (!svg || !svg.startsWith('<svg')) {
        return {
          kind: figure.kind,
          status: 'ERROR',
          detail: 'Lỗi: Không tạo được thẻ SVG',
        };
      }
      return {
        kind: figure.kind,
        status: 'SUCCESS',
        detail: 'Vẽ thành công (SVG)',
      };
    } catch (err: any) {
      return {
        kind: figure.kind,
        status: 'ERROR',
        detail: `Lỗi: ${err?.message || 'Ngoại lệ khi vẽ SVG'}`,
      };
    }
  }

  if (svgDiagram && svgDiagram.trim().startsWith('<svg')) {
    return {
      kind: 'SVG dự phòng',
      status: 'SUCCESS',
      detail: 'Vẽ thành công từ SVG',
    };
  }

  return {
    kind: 'không có',
    status: 'NONE',
    detail: 'Không có dữ liệu hình',
  };
}

/**
 * Tính số phương án hợp lệ của câu hỏi
 */
function getValidOptionsText(q: Question): string {
  if (q.type === 'MCQ4' || q.type === 'MCQ_MULTI') {
    const valid = (q.options || []).filter((o) => o && o.trim().length > 0).length;
    return `${valid}/4`;
  }
  if (q.type === 'TRUE_FALSE') {
    const valid = (q.statements || []).filter((s) => s && s.statement?.trim().length > 0).length;
    return `${valid}/4 mệnh đề`;
  }
  if (q.type === 'MATCHING') {
    const valid = (q.pairs || []).filter((p) => p && p.left?.trim().length > 0 && p.right?.trim().length > 0).length;
    return `${valid}/4 cặp`;
  }
  if (q.type === 'FILL_BLANK' || q.type === 'SHORT_ANSWER') {
    return q.correctAnswer?.trim() ? '1/1 đáp án' : '0/1 (chưa có)';
  }
  if (q.type === 'ESSAY') {
    return 'Tự luận';
  }
  return '—';
}

export const DebugReportTable: React.FC<DebugReportTableProps> = ({ isOpen, onClose }) => {
  const { currentExam, qualityReport, config } = useExamStore();
  const [copiedAll, setCopiedAll] = useState(false);
  const [selectedRawQ, setSelectedRawQ] = useState<{
    index: number;
    q: Question;
    jsonStr: string;
    parseError?: string;
  } | null>(null);
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [filterMode, setFilterMode] = useState<'ALL' | 'ERRORS_ONLY' | 'FIGURE_ONLY'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Lấy danh sách toàn bộ issues chất lượng
  const allIssues: QualityIssue[] = useMemo(() => {
    if (qualityReport?.allIssues && qualityReport.allIssues.length > 0) {
      return qualityReport.allIssues;
    }
    if (currentExam) {
      return runCodeQualityCheck(currentExam);
    }
    return [];
  }, [qualityReport, currentExam]);

  // Phân tích dữ liệu từng câu cho bảng
  const rowData = useMemo(() => {
    if (!currentExam || !currentExam.questions) return [];

    return currentExam.questions.map((q, idx) => {
      const qText = (q.question || '').toLowerCase();
      const mentionsFigure = FIGURE_KEYWORDS.some((kw) => qText.includes(kw));
      const figInspection = inspectQuestionFigure(q.figure, q.svgDiagram, q.imageData);
      const optionsText = getValidOptionsText(q);
      const qIssues = allIssues.filter((i) => i.questionId === q.id);
      const regCount = q.regenerationCount || 0;

      return {
        index: idx + 1,
        questionObj: q,
        slotId: q.slotId || `slot_${idx + 1}`,
        type: q.type,
        level: q.level,
        mentionsFigure,
        figureKind: figInspection.kind,
        figureStatus: figInspection.status,
        figureDetail: figInspection.detail,
        optionsCount: optionsText,
        issues: qIssues,
        regenerationCount: regCount,
        hasError: qIssues.some((i) => i.severity === 'ERROR') || (mentionsFigure && figInspection.status === 'NONE'),
      };
    });
  }, [currentExam, allIssues]);

  // Lọc hàng theo chế độ
  const filteredRows = useMemo(() => {
    return rowData.filter((row) => {
      if (filterMode === 'ERRORS_ONLY' && row.issues.length === 0 && !row.hasError) {
        return false;
      }
      if (filterMode === 'FIGURE_ONLY' && !row.mentionsFigure && row.figureStatus === 'NONE') {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchSlot = row.slotId.toLowerCase().includes(query);
        const matchNum = `câu ${row.index}`.includes(query);
        const matchType = row.type.toLowerCase().includes(query);
        const matchLevel = row.level.toLowerCase().includes(query);
        const matchText = (row.questionObj.question || '').toLowerCase().includes(query);
        if (!matchSlot && !matchNum && !matchType && !matchLevel && !matchText) {
          return false;
        }
      }
      return true;
    });
  }, [rowData, filterMode, searchQuery]);

  if (!isOpen) return null;

  // Thống kê nhanh
  const totalQuestions = rowData.length;
  const questionsMentioningFigure = rowData.filter((r) => r.mentionsFigure).length;
  const questionsWithFigure = rowData.filter((r) => r.figureStatus === 'SUCCESS').length;
  const questionsWithIssues = rowData.filter((r) => r.issues.length > 0).length;
  const questionsRegenerated = rowData.filter((r) => r.regenerationCount > 0).length;

  // Tạo báo cáo dạng văn bản Markdown để copy
  const handleCopyReport = () => {
    if (!currentExam) return;

    let text = `# BÁO CÁO GỠ LỖI ĐỀ KIỂM TRA (DEBUG REPORT)\n`;
    text += `- Thời điểm xuất báo cáo: ${new Date().toLocaleString('vi-VN')}\n`;
    text += `- Môn: ${config.customSubject?.trim() || config.subject} | Khối: ${config.grade || '—'} | Cấp: ${config.schoolLevel}\n`;
    text += `- Tổng số câu: ${totalQuestions}\n`;
    text += `- Số câu có nhắc hình/bảng: ${questionsMentioningFigure}\n`;
    text += `- Số câu có figure/ảnh hợp lệ: ${questionsWithFigure}\n`;
    text += `- Số câu có cảnh báo/lỗi validate: ${questionsWithIssues}\n`;
    text += `- Số câu đã từng tự sinh lại: ${questionsRegenerated}\n\n`;

    text += `| Số câu | slotId | Dạng | Mức | Nhắc hình/bảng | Figure Gemini | Trạng thái vẽ | Số phương án | Lỗi validate | Số lần sinh lại |\n`;
    text += `|:---:|:---|:---:|:---:|:---:|:---|:---|:---:|:---|:---:|\n`;

    rowData.forEach((r) => {
      const issuesText =
        r.issues.length === 0
          ? 'Đạt (0 lỗi)'
          : r.issues.map((i) => `TC${i.criterion}[${i.severity}]: ${i.message}`).join('; ');

      text += `| Câu ${r.index} | ${r.slotId} | ${r.type} | ${r.level} | ${r.mentionsFigure ? 'Có' : 'Không'} | ${r.figureKind} | ${r.figureDetail} | ${r.optionsCount} | ${issuesText} | ${r.regenerationCount} |\n`;
    });

    if (allIssues.length > 0) {
      text += `\n## DANH SÁCH TOÀN BỘ LỖI CHI TIẾT (TỔNG: ${allIssues.length} LỖI):\n`;
      allIssues.forEach((issue, idx) => {
        text += `${idx + 1}. [${issue.severity}] Tiêu chí ${issue.criterion}: ${issue.message}${issue.suggestedFix ? ` -> Gợi ý: ${issue.suggestedFix}` : ''}\n`;
      });
    }

    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2500);
  };

  // Mở popup xem JSON thô của một câu
  const handleOpenRawJson = (index: number, q: Question) => {
    const rawDataToDisplay = q.rawAiResponse || {
      note: 'Dữ liệu câu hỏi hiện tại (chưa có phản hồi thô ban đầu)',
      slotId: q.slotId,
      type: q.type,
      level: q.level,
      question: q.question,
      options: q.options,
      optionExprs: q.optionExprs,
      statements: q.statements,
      pairs: q.pairs,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      figure: q.figure,
      svgDiagram: q.svgDiagram,
      imageData: q.imageData ? { ...q.imageData, dataUrl: q.imageData.dataUrl.slice(0, 80) + '... (truncated)' } : undefined,
    };

    setSelectedRawQ({
      index,
      q,
      jsonStr: JSON.stringify(rawDataToDisplay, null, 2),
      parseError: q.rawParseError,
    });
  };

  return (
    <div className="print:hidden border-t-2 border-amber-300 bg-slate-900 text-slate-100 shadow-2xl transition-all duration-200">
      {/* Thanh điều khiển trên cùng của chế độ gỡ lỗi */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Bug className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-amber-300">
                  CHẾ ĐỘ GỠ LỖI – Báo cáo chi tiết từng câu
                </h3>
                <span className="text-[10px] font-mono bg-amber-950 text-amber-400 border border-amber-700/50 px-2 py-0.5 rounded-full">
                  DEBUG MODE (Không in, không xuất Word)
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Theo dõi sát sao từng slot, kết quả AI trả về, trạng thái vẽ hình và lỗi validate
              </p>
            </div>
          </div>

          {/* Các nút hành động */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleCopyReport}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs ${
                copiedAll
                  ? 'bg-emerald-600 text-white'
                  : 'bg-amber-600 hover:bg-amber-500 text-white'
              }`}
              title="Sao chép toàn bộ báo cáo dạng Markdown để dán lại cho đội ngũ hỗ trợ"
            >
              {copiedAll ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedAll ? 'Đã copy báo cáo!' : 'Copy báo cáo'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Đóng bảng gỡ lỗi"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Thanh đếm thống kê tóm tắt */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-3 pt-3 border-t border-slate-800 text-[11px]">
          <div className="bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700/60">
            <span className="text-slate-400 block">Tổng số câu:</span>
            <strong className="text-sm text-white font-mono">{totalQuestions}</strong>
          </div>
          <div className="bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700/60">
            <span className="text-slate-400 block">Câu nhắc hình/bảng:</span>
            <strong className="text-sm text-amber-300 font-mono">{questionsMentioningFigure}</strong>
          </div>
          <div className="bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700/60">
            <span className="text-slate-400 block">Figure/ảnh vẽ được:</span>
            <strong className="text-sm text-emerald-400 font-mono">{questionsWithFigure}</strong>
          </div>
          <div className="bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700/60">
            <span className="text-slate-400 block">Câu có lỗi validate:</span>
            <strong className={`text-sm font-mono ${questionsWithIssues > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {questionsWithIssues}
            </strong>
          </div>
          <div className="bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700/60">
            <span className="text-slate-400 block">Số câu tự sinh lại:</span>
            <strong className="text-sm text-blue-300 font-mono">{questionsRegenerated}</strong>
          </div>
        </div>

        {/* Bộ lọc và tìm kiếm */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 mt-3 pt-3 border-t border-slate-800">
          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto text-xs">
            <span className="text-slate-400 text-[11px] mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Lọc:
            </span>
            <button
              type="button"
              onClick={() => setFilterMode('ALL')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                filterMode === 'ALL'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Tất cả ({rowData.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('ERRORS_ONLY')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                filterMode === 'ERRORS_ONLY'
                  ? 'bg-rose-500 text-white font-bold'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Chỉ câu có lỗi ({rowData.filter((r) => r.issues.length > 0 || r.hasError).length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('FIGURE_ONLY')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                filterMode === 'FIGURE_ONLY'
                  ? 'bg-blue-500 text-white font-bold'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Chỉ câu có hình ({rowData.filter((r) => r.mentionsFigure || r.figureStatus !== 'NONE').length})
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo câu, slotId, từ khóa..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>
        </div>
      </div>

      {/* Bảng dữ liệu chi tiết từng câu */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-5">
        {totalQuestions === 0 ? (
          <div className="p-8 text-center bg-slate-800/40 rounded-xl border border-slate-800 my-2 text-slate-400 text-xs">
            Chưa có câu hỏi nào trong đề. Vui lòng bấm <strong>"Tạo đề kiểm tra bằng AI"</strong> để xem báo cáo gỡ lỗi từng câu.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-700/80 bg-slate-800/50 max-h-[60vh] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-850 text-slate-300 uppercase text-[10px] font-bold tracking-wider sticky top-0 z-10 border-b border-slate-700">
                <tr>
                  <th className="py-2.5 px-3 w-14 text-center">Câu</th>
                  <th className="py-2.5 px-3">slotId</th>
                  <th className="py-2.5 px-3">Dạng</th>
                  <th className="py-2.5 px-3">Mức</th>
                  <th className="py-2.5 px-3 text-center">Nhắc hình/bảng</th>
                  <th className="py-2.5 px-3">Figure Gemini</th>
                  <th className="py-2.5 px-3">Trạng thái vẽ</th>
                  <th className="py-2.5 px-3 text-center">Số phương án</th>
                  <th className="py-2.5 px-3">Lỗi validate</th>
                  <th className="py-2.5 px-3 text-center">Sinh lại</th>
                  <th className="py-2.5 px-3 text-center w-28">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60 font-sans">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-6 text-center text-slate-400 text-xs italic">
                      Không tìm thấy câu hỏi nào phù hợp với bộ lọc hiện tại.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => {
                    const rowBgClass = row.hasError
                      ? 'bg-rose-950/20 hover:bg-rose-950/30'
                      : row.index % 2 === 0
                      ? 'bg-slate-800/20 hover:bg-slate-700/40'
                      : 'hover:bg-slate-700/40';

                    return (
                      <tr key={row.questionObj.id} className={`${rowBgClass} transition-colors`}>
                        {/* 1. Số câu */}
                        <td className="py-2.5 px-3 text-center font-bold text-white font-mono">
                          {row.index}
                        </td>

                        {/* 2. slotId */}
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-300">
                          {row.slotId}
                        </td>

                        {/* 3. Dạng */}
                        <td className="py-2.5 px-3 font-semibold text-[11px] text-blue-300">
                          {row.type}
                        </td>

                        {/* 4. Mức */}
                        <td className="py-2.5 px-3 font-semibold text-[11px]">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] ${
                              row.level === 'NB'
                                ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700/40'
                                : row.level === 'TH'
                                ? 'bg-blue-900/60 text-blue-300 border border-blue-700/40'
                                : row.level === 'VD'
                                ? 'bg-amber-900/60 text-amber-300 border border-amber-700/40'
                                : 'bg-rose-900/60 text-rose-300 border border-rose-700/40'
                            }`}
                          >
                            {row.level}
                          </span>
                        </td>

                        {/* 5. Câu dẫn có nhắc hình/bảng hay không (có/không) */}
                        <td className="py-2.5 px-3 text-center">
                          {row.mentionsFigure ? (
                            <span className="inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              Có
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[11px]">Không</span>
                          )}
                        </td>

                        {/* 6. Figure Gemini trả về (kind hoặc “không có”) */}
                        <td className="py-2.5 px-3">
                          <span
                            className={`font-mono text-[11px] ${
                              row.figureKind !== 'không có'
                                ? 'text-indigo-300 font-bold'
                                : 'text-slate-500'
                            }`}
                          >
                            {row.figureKind}
                          </span>
                        </td>

                        {/* 7. Figure đã vẽ được hay lỗi (nếu lỗi thì nêu lý do) */}
                        <td className="py-2.5 px-3 text-[11px]">
                          {row.figureStatus === 'SUCCESS' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span>{row.figureDetail}</span>
                            </span>
                          ) : row.figureStatus === 'ERROR' ? (
                            <span className="inline-flex items-center gap-1 text-rose-400 font-medium" title={row.figureDetail}>
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate max-w-[170px]">{row.figureDetail}</span>
                            </span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>

                        {/* 8. Số phương án hợp lệ */}
                        <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-300">
                          {row.optionsCount}
                        </td>

                        {/* 9. Lỗi validate (tiêu chí nào, mức ERROR hay WARN) */}
                        <td className="py-2.5 px-3 max-w-[220px]">
                          {row.issues.length === 0 ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400 text-[10px] font-bold">
                              <Check className="w-3 h-3" /> Đạt (0 lỗi)
                            </span>
                          ) : (
                            <div className="space-y-1">
                              {row.issues.map((iss, iIdx) => (
                                <div
                                  key={iIdx}
                                  className={`text-[10px] px-1.5 py-0.5 rounded leading-tight flex items-start gap-1 ${
                                    iss.severity === 'ERROR'
                                      ? 'bg-rose-950/80 text-rose-300 border border-rose-800'
                                      : 'bg-amber-950/80 text-amber-300 border border-amber-800'
                                  }`}
                                  title={iss.message}
                                >
                                  <span className="font-bold shrink-0">TC{iss.criterion}:</span>
                                  <span className="truncate">{iss.message}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>

                        {/* 10. Số lần đã tự sinh lại */}
                        <td className="py-2.5 px-3 text-center font-mono text-[11px]">
                          {row.regenerationCount > 0 ? (
                            <span className="inline-flex items-center gap-0.5 font-bold px-1.5 py-0.5 rounded bg-blue-900/60 text-blue-300 border border-blue-700/50">
                              <RefreshCw className="w-2.5 h-2.5" />
                              <span>{row.regenerationCount}</span>
                            </span>
                          ) : (
                            <span className="text-slate-500">0</span>
                          )}
                        </td>

                        {/* 11. Nút Xem JSON thô */}
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleOpenRawJson(row.index, row.questionObj)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-750 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-600 text-[10px] font-semibold transition-colors cursor-pointer"
                            title="Xem phản hồi gốc của Gemini cho câu này"
                          >
                            <Code2 className="w-3 h-3 text-amber-400" />
                            <span>JSON thô</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =========================================================================
       * MODAL XEM JSON THÔ TỪNG CÂU
       * ========================================================================= */}
      {selectedRawQ && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-700 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
            {/* Header Modal */}
            <div className="px-5 py-3.5 bg-slate-850 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code2 className="w-5 h-5 text-amber-400" />
                <div>
                  <h4 className="font-bold text-sm text-white flex items-center gap-2">
                    <span>Phản hồi gốc từ Gemini – Câu {selectedRawQ.index}</span>
                    <span className="text-[11px] font-mono text-slate-400 font-normal">
                      ({selectedRawQ.q.slotId})
                    </span>
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    Dữ liệu thô trước các bước chuẩn hóa và làm sạch KaTeX
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRawQ(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Thông báo lỗi parse nếu có */}
            {selectedRawQ.parseError && (
              <div className="mx-5 mt-4 p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <div>
                  <strong className="block text-rose-200">Lỗi Parse / Xử lý:</strong>
                  <span>{selectedRawQ.parseError}</span>
                </div>
              </div>
            )}

            {/* Nội dung JSON */}
            <div className="p-5 flex-1 overflow-y-auto">
              <div className="relative">
                <pre className="p-4 rounded-xl bg-slate-950 text-emerald-400 font-mono text-xs overflow-x-auto border border-slate-800 leading-relaxed max-h-[50vh] select-all">
                  {selectedRawQ.jsonStr}
                </pre>
              </div>
            </div>

            {/* Footer Modal */}
            <div className="px-5 py-3 bg-slate-850 border-t border-slate-700 flex items-center justify-between text-xs">
              <span className="text-slate-400 text-[11px]">
                {selectedRawQ.q.isTeacherWritten
                  ? 'Câu hỏi do giáo viên tự soạn'
                  : 'Phản hồi từ model Gemini'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(selectedRawQ.jsonStr);
                    setCopiedRaw(true);
                    setTimeout(() => setCopiedRaw(false), 2000);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold flex items-center gap-1.5 transition-colors text-xs"
                >
                  {copiedRaw ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedRaw ? 'Đã copy JSON!' : 'Copy JSON'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRawQ(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors text-xs"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
