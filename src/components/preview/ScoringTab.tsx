import React from 'react';
import { ListOrdered, CheckCircle, Info } from 'lucide-react';
import { Exam, ExamConfig, Question } from '../../types';
import { MathText } from '../MathText';
import { FigureView } from '../FigureView';
import {
  formatSchoolNameForHeader,
  formatScore,
  formatDepartmentForHeader,
  getDefaultAcademicYear,
} from '../../config';
import { DocPage } from '../common/DocPage';

interface ScoringTabProps {
  exam: Exam;
  config: ExamConfig;
  questions: Question[];
  activeVersionCode: string;
}

interface CriterionItem {
  criterion: string;
  content: string;
  points: string;
}

/**
 * Phân tích scoringGuide thành các dòng tiêu chí chuẩn (Ý / Tiêu chí | Nội dung yêu cầu | Điểm)
 */
function parseScoringGuide(
  guide: string | undefined,
  totalScore: number,
  defaultExplanation: string
): CriterionItem[] {
  if (!guide || guide.trim() === '') {
    return [
      {
        criterion: 'Ý 1',
        content: defaultExplanation
          ? defaultExplanation.slice(0, 150) + '...'
          : 'Nêu đúng định nghĩa / công thức / phương pháp giải.',
        points: formatScore(totalScore * 0.4),
      },
      {
        criterion: 'Ý 2',
        content: 'Thực hiện các bước biến đổi, tính toán hoặc lập luận chính xác.',
        points: formatScore(totalScore * 0.4),
      },
      {
        criterion: 'Ý 3',
        content: 'Kết luận đúng yêu cầu của bài toán, ghi đúng đơn vị (nếu có).',
        points: formatScore(totalScore * 0.2),
      },
    ];
  }

  try {
    const parsed = JSON.parse(guide);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((item, i) => ({
        criterion: item.criterion || `Ý ${i + 1}`,
        content: item.content || item.description || item.criterion || 'Yêu cầu đạt chuẩn',
        points: formatScore(item.points !== undefined ? Number(item.points) : totalScore / parsed.length),
      }));
    }
  } catch {
    // Không phải JSON
  }

  const lines = guide.split(/[\n;]+/).map((l) => l.trim()).filter(Boolean);
  if (lines.length > 1) {
    const ptsPerLine = totalScore / lines.length;
    return lines.map((line, i) => {
      const scoreMatch = line.match(/\((\d+([.,]\d+)?)\s*(đ|điểm)?\)/i);
      const points = scoreMatch ? formatScore(Number(scoreMatch[1].replace(',', '.'))) : formatScore(ptsPerLine);
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
      points: formatScore(totalScore),
    },
  ];
}

export const ScoringTab: React.FC<ScoringTabProps> = ({
  exam,
  config,
  questions,
  activeVersionCode,
}) => {
  const deptDisplay = config.departmentName?.trim()
    ? formatDepartmentForHeader(config.departmentName)
    : 'SỞ GIÁO DỤC VÀ ĐÀO TẠO …………………';

  const schoolDisplay = config.schoolName?.trim()
    ? formatSchoolNameForHeader(config.schoolName)
    : 'TRƯỜNG: …………………………………';

  return (
    <div className="doc-viewport-bg py-4 px-2 sm:px-4">
      <DocPage versionCode={activeVersionCode} footerText={`Mã đề ${activeVersionCode} – Hướng dẫn chấm`}>
        {/* Header */}
        <table className="doc-header-table">
          <tbody>
            <tr>
              <td className="doc-header-left">
                <div className="text-[12pt] font-normal uppercase">{deptDisplay}</div>
                <div className="text-[12pt] font-bold uppercase mt-0.5">{schoolDisplay}</div>
                <div className="doc-short-line" />
              </td>
              <td className="doc-header-right">
                <div className="doc-exam-code-box">Mã đề: {activeVersionCode}</div>
                <div className="text-[14pt] font-bold uppercase tracking-wide">
                  HƯỚNG DẪN CHẤM & BIỂU ĐIỂM CHI TIẾT
                </div>
                <div className="text-[12pt] font-semibold mt-0.5">
                  {(config.customSubject?.trim() || config.subject || 'MÔN HỌC').toUpperCase()}
                  {config.grade ? ` – LỚP ${config.grade}` : ''}
                </div>
                <div className="text-[11pt] text-slate-700 italic mt-0.5">
                  Thang điểm: {formatScore(config.scale || 10)} điểm – Năm học: {config.academicYear || getDefaultAcademicYear()}
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* HƯỚNG DẪN CHUNG */}
        <div className="my-4 p-3 bg-slate-50 border border-slate-300 rounded text-xs leading-relaxed">
          <div className="font-bold uppercase text-slate-900 mb-1">
            NGUYÊN TẮC CHẤM CHUNG:
          </div>
          <ul className="list-disc pl-5 space-y-1 text-slate-800">
            <li>
              Học sinh làm bài theo cách khác nhưng đúng và chặt chẽ vẫn cho điểm tối đa theo từng phần tương ứng.
            </li>
            <li>
              Điểm toàn bài là tổng điểm các câu thành phần, làm tròn đến {formatScore(0.25)} hoặc {formatScore(0.1)} điểm theo quy chế.
            </li>
            <li>
              Đối với câu trắc nghiệm nhiều lựa chọn: mỗi câu chỉ có 01 phương án đúng duy nhất.
            </li>
          </ul>
        </div>

        {/* BIỂU ĐIỂM CHI TIẾT THEO CÂU */}
        <div className="mt-5 space-y-6">
          <div className="doc-section-header mb-2 text-[12pt]">
            BIỂU ĐIỂM VÀ TIÊU CHÍ ĐÁNH GIÁ TỪNG CÂU
          </div>

          {questions.map((q, idx) => {
            const criteria = parseScoringGuide(q.scoringGuide, q.score, q.explanation || '');

            return (
              <div
                key={q.id}
                style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
                className="doc-question-item border border-slate-300 rounded p-3 bg-white"
              >
                <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2">
                  <div className="font-bold text-slate-900 text-sm">
                    Câu {idx + 1}. ({formatScore(q.score)} điểm) [{q.type} - {q.level}]
                  </div>
                  <div className="text-xs text-blue-900 font-bold">
                    Đáp án: <span className="font-mono bg-blue-50 px-2 py-0.5 rounded border border-blue-200">{q.correctAnswer || 'Xem hướng dẫn'}</span>
                  </div>
                </div>

                <div className="text-xs text-slate-800 mb-2">
                  <span className="font-bold">Đề bài: </span>
                  <MathText content={q.question} className="inline" />
                </div>

                {/* Bảng tiêu chí chấm */}
                <table className="doc-table w-full text-xs">
                  <thead>
                    <tr>
                      <th className="w-20 text-center">Ý / Tiêu chí</th>
                      <th className="text-left">Nội dung yêu cầu cần đạt</th>
                      <th className="w-20 text-right">Điểm</th>
                    </tr>
                  </thead>
                  <tbody>
                    {criteria.map((c, cIdx) => (
                      <tr key={cIdx}>
                        <td className="text-center font-bold text-slate-900">{c.criterion}</td>
                        <td>
                          <MathText content={c.content} className="inline" />
                        </td>
                        <td className="text-right font-bold text-blue-900">{c.points}</td>
                      </tr>
                    ))}
                    <tr className="font-bold bg-slate-100">
                      <td colSpan={2} className="text-right uppercase">Tổng điểm câu {idx + 1}:</td>
                      <td className="text-right text-blue-900">{formatScore(q.score)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>

        {/* Chân trang kết thúc */}
        <div className="doc-end-notice mt-8">
          <div className="doc-end-title">— HẾT HƯỚNG DẪN CHẤM —</div>
        </div>
      </DocPage>
    </div>
  );
};
