import React from 'react';
import { ListOrdered, CheckCircle, Info } from 'lucide-react';
import { Exam, ExamConfig, Question } from '../../types';
import { MathText } from '../MathText';
import { FigureView } from '../FigureView';

interface ScoringTabProps {
  exam: Exam;
  config: ExamConfig;
  questions: Question[];
  activeVersionCode: string;
}

interface CriterionItem {
  criterion: string;
  content: string;
  points: number | string;
}

/**
 * Phân tích scoringGuide thành các dòng tiêu chí chuẩn (Ý / Tiêu chí | Nội dung yêu cầu | Điểm)
 */
function parseScoringGuide(guide: string | undefined, totalScore: number, defaultExplanation: string): CriterionItem[] {
  if (!guide || guide.trim() === '') {
    // Tự sinh tiêu chí mặc định nếu chưa có
    return [
      {
        criterion: 'Ý 1',
        content: defaultExplanation ? defaultExplanation.slice(0, 150) + '...' : 'Nêu đúng định nghĩa / công thức / phương pháp giải.',
        points: (totalScore * 0.4).toFixed(2),
      },
      {
        criterion: 'Ý 2',
        content: 'Thực hiện các bước biến đổi, tính toán hoặc lập luận chính xác.',
        points: (totalScore * 0.4).toFixed(2),
      },
      {
        criterion: 'Ý 3',
        content: 'Kết luận đúng yêu cầu của bài toán, ghi đúng đơn vị (nếu có).',
        points: (totalScore * 0.2).toFixed(2),
      },
    ];
  }

  // Thử parse JSON nếu AI trả về mảng [{ criterion, points }]
  try {
    const parsed = JSON.parse(guide);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((item, i) => ({
        criterion: item.criterion || `Ý ${i + 1}`,
        content: item.content || item.description || item.criterion || 'Yêu cầu đạt chuẩn',
        points: item.points !== undefined ? item.points : (totalScore / parsed.length).toFixed(2),
      }));
    }
  } catch {
    // Không phải JSON, xử lý text phân dòng
  }

  // Xử lý chuỗi văn bản thông thường
  const lines = guide.split(/[\n;]+/).map((l) => l.trim()).filter(Boolean);
  if (lines.length > 1) {
    const ptsPerLine = (totalScore / lines.length).toFixed(2);
    return lines.map((line, i) => {
      // Tìm điểm số nếu có trong ngoặc: ví dụ (0,5đ) hoặc (0.5 điểm)
      const scoreMatch = line.match(/\((\d+([.,]\d+)?)\s*(đ|điểm)?\)/i);
      const points = scoreMatch ? scoreMatch[1].replace(',', '.') : ptsPerLine;
      const cleanContent = line.replace(/\((\d+([.,]\d+)?)\s*(đ|điểm)?\)/i, '').trim();

      return {
        criterion: `Ý ${i + 1}`,
        content: cleanContent || line,
        points,
      };
    });
  }

  return [
    {
      criterion: 'Toàn bài',
      content: guide,
      points: totalScore.toFixed(2),
    },
  ];
}

export const ScoringTab: React.FC<ScoringTabProps> = ({
  exam,
  config,
  questions,
  activeVersionCode,
}) => {
  const essayOrGuidedQuestions = questions.filter(
    (q) => q.type === 'ESSAY' || Boolean(q.scoringGuide)
  );

  return (
    <div className="space-y-6 max-w-[210mm] mx-auto bg-white p-6 sm:p-10 rounded-xl border border-slate-300 shadow-md font-serif print:shadow-none print:border-none print:p-0">
      {/* Header */}
      <div className="border-b-2 border-slate-900 pb-4 text-center">
        <p className="font-bold uppercase tracking-wider text-slate-800 text-xs">
          {config.schoolName || 'TRƯỜNG THPT / THCS / TIỂU HỌC'}
        </p>
        <h2 className="font-bold uppercase text-base sm:text-lg text-slate-950 mt-1">
          HƯỚNG DẪN CHẤM & BIỂU ĐIỂM CHI TIẾT
        </h2>
        <p className="text-xs text-slate-700 italic mt-0.5">
          {exam.title} — MÃ ĐỀ: <strong className="text-blue-900 font-mono">{activeVersionCode}</strong> — Thang điểm chuẩn: {config.scale || 10} điểm
        </p>
      </div>

      {/* Thông tin thang điểm tổng quan */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 print:border print:border-slate-300 print:p-2">
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
          <div className="text-[11px] text-slate-500 font-bold uppercase">Thang điểm toàn bài</div>
          <div className="text-lg font-bold text-blue-800 mt-0.5">{config.scale || 10} điểm</div>
        </div>
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
          <div className="text-[11px] text-slate-500 font-bold uppercase">Bước làm tròn</div>
          <div className="text-lg font-bold text-slate-800 mt-0.5">{config.roundingStep || 0.25} điểm</div>
        </div>
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
          <div className="text-[11px] text-slate-500 font-bold uppercase">Quy cách Đúng/Sai</div>
          <div className="text-sm font-bold text-slate-800 mt-1">
            {config.trueFalseProgressiveScoring !== false ? 'Lũy tiến Bộ GD&ĐT' : 'Điểm đều các ý'}
          </div>
        </div>
      </div>

      {/* HƯỚNG DẪN CHẤM CHI TIẾT CHO TỪNG CÂU TỰ LUẬN (VÀ CÁC CÂU CÓ SCORING GUIDE) */}
      <div className="space-y-6 pt-2">
        <div className="font-bold text-slate-950 text-sm uppercase tracking-wide border-b border-slate-300 pb-1.5 flex items-center gap-2">
          <ListOrdered className="w-4 h-4 text-blue-700 shrink-0" />
          <span>Biểu điểm chi tiết cho các câu hỏi tự luận & yêu cầu cần đạt:</span>
        </div>

        {essayOrGuidedQuestions.length === 0 ? (
          <div className="p-6 text-center border border-dashed border-slate-300 rounded-xl bg-slate-50 text-xs text-slate-600">
            <Info className="w-6 h-6 mx-auto mb-2 text-slate-400" />
            <p className="font-bold text-slate-800">Đề thi này không có câu tự luận dài.</p>
            <p className="mt-1">
              Điểm của các câu trắc nghiệm được chấm theo bảng đáp án ở Tab 2.
            </p>
          </div>
        ) : (
          essayOrGuidedQuestions.map((q) => {
            const fullIndex = questions.findIndex((item) => item.id === q.id) + 1;
            const criteria = parseScoringGuide(q.scoringGuide, q.score, q.explanation);

            return (
              <div
                key={q.id}
                style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
                className="border border-slate-300 rounded-xl overflow-hidden bg-white shadow-2xs space-y-0 print:border print:shadow-none print:break-inside-avoid"
              >
                {/* Tiêu đề câu hỏi */}
                <div className="bg-slate-100 p-3 border-b border-slate-300 flex items-start justify-between gap-3 text-xs">
                  <div>
                    <span className="font-bold text-slate-900 text-sm">Câu {fullIndex}: </span>
                    <MathText content={q.question} className="font-serif inline" />
                  </div>
                  <span className="font-bold text-blue-800 bg-white px-2.5 py-1 rounded border border-slate-300 shrink-0">
                    {q.score.toFixed(2)} điểm
                  </span>
                </div>

                {/* Hình vẽ minh họa nếu có */}
                <FigureView figure={q.figure} svgDiagram={q.svgDiagram} imageData={q.imageData} />

                {/* Bảng 3 cột: Ý / Tiêu chí | Nội dung yêu cầu | Điểm */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-300 text-slate-800 font-bold">
                        <th className="py-2 px-3 w-24 text-center border-r border-slate-300">Ý / Tiêu chí</th>
                        <th className="py-2 px-4 border-r border-slate-300">Nội dung yêu cầu (Chuẩn cần đạt)</th>
                        <th className="py-2 px-3 w-20 text-center">Điểm</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {criteria.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 text-center font-bold text-slate-800 border-r border-slate-200 bg-slate-50/30">
                            {item.criterion}
                          </td>
                          <td className="py-2.5 px-4 text-slate-800 leading-relaxed border-r border-slate-200">
                            <MathText content={item.content} />
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-blue-700">
                            {typeof item.points === 'number' ? item.points.toFixed(2) : item.points}đ
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Chân bảng: Điểm tối đa: X điểm */}
                <div className="p-2.5 bg-slate-50 border-t border-slate-300 text-right text-xs font-bold text-slate-900">
                  <span>Điểm tối đa: {q.score.toFixed(2)} điểm</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* BẢNG TỔNG HỢP TOÀN BỘ ĐIỂM SỐ TRONG ĐỀ THI */}
      <div className="pt-4 border-t border-slate-300 space-y-3">
        <div className="font-bold text-slate-950 text-xs uppercase tracking-wide">
          Bảng tổng kết phân bổ điểm số toàn bài:
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-300">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-bold">
                <th className="p-2 w-14 text-center">Câu</th>
                <th className="p-2">Dạng câu</th>
                <th className="p-2">Mức độ</th>
                <th className="p-2">Chủ đề kiến thức</th>
                <th className="p-2 text-right">Điểm</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {questions.map((q, idx) => (
                <tr key={q.id} className="hover:bg-slate-50">
                  <td className="p-2 text-center font-bold text-slate-800">{idx + 1}</td>
                  <td className="p-2 font-medium text-slate-700">{q.type}</td>
                  <td className="p-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                      {q.level}
                    </span>
                  </td>
                  <td className="p-2 text-slate-600 truncate max-w-xs">{q.topic}</td>
                  <td className="p-2 text-right font-bold text-blue-700">{q.score.toFixed(2)}đ</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900">
                <td colSpan={4} className="p-2 text-right uppercase">
                  TỔNG CỘNG ({questions.length} câu):
                </td>
                <td className="p-2 text-right font-bold text-blue-800 text-sm">
                  {questions.reduce((sum, q) => sum + q.score, 0).toFixed(2)}đ
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
