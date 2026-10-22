import React, { useMemo } from 'react';
import { BarChart3, AlertTriangle, CheckCircle2, TrendingUp, Layers, PieChart } from 'lucide-react';
import { QUESTION_TYPE_LABELS, QUESTION_TYPES_ORDER } from '../../config';
import { ExamConfig, Level, Question, QuestionType } from '../../types';

interface StatsTabProps {
  questions: Question[];
  config: ExamConfig;
}

interface LevelStat {
  level: Level;
  name: string;
  count: number;
  score: number;
  percent: number;
  color: string;
  bgColor: string;
}

export const StatsTab: React.FC<StatsTabProps> = ({ questions, config }) => {
  const totalScore = useMemo(
    () => questions.reduce((sum, q) => sum + (Number(q.score) || 0), 0),
    [questions]
  );
  const totalQuestions = questions.length;

  // 1. Thống kê theo Mức độ nhận thức
  const levelStats: LevelStat[] = useMemo(() => {
    const map: Record<Level, { count: number; score: number }> = {
      NB: { count: 0, score: 0 },
      TH: { count: 0, score: 0 },
      VD: { count: 0, score: 0 },
      VDC: { count: 0, score: 0 },
    };

    questions.forEach((q) => {
      const lvl = q.level || 'NB';
      if (map[lvl]) {
        map[lvl].count += 1;
        map[lvl].score += Number(q.score) || 0;
      }
    });

    const isPrimary3Levels = Boolean(config.schoolLevel === 'TIEU_HOC' && config.use3LevelsPrimary);
    const activeLevels: Level[] = isPrimary3Levels ? ['NB', 'TH', 'VD'] : ['NB', 'TH', 'VD', 'VDC'];

    const meta: Record<Level, { name: string; color: string; bgColor: string }> = {
      NB: { name: 'Nhận biết (NB)', color: 'bg-emerald-500', bgColor: 'bg-emerald-50 text-emerald-800' },
      TH: { name: 'Thông hiểu (TH)', color: 'bg-blue-500', bgColor: 'bg-blue-50 text-blue-800' },
      VD: { name: 'Vận dụng (VD)', color: 'bg-amber-500', bgColor: 'bg-amber-50 text-amber-800' },
      VDC: { name: 'Vận dụng cao (VDC)', color: 'bg-rose-500', bgColor: 'bg-rose-50 text-rose-800' },
    };

    return activeLevels.map((lvl) => {
      const pct = totalScore > 0 ? Number(((map[lvl].score / totalScore) * 100).toFixed(1)) : 0;
      return {
        level: lvl,
        name: meta[lvl].name,
        count: map[lvl].count,
        score: Number(map[lvl].score.toFixed(2)),
        percent: pct,
        color: meta[lvl].color,
        bgColor: meta[lvl].bgColor,
      };
    });
  }, [questions, totalScore, config]);

  // 2. Thống kê theo Dạng câu hỏi
  const typeStats = useMemo(() => {
    const map = new Map<string, { count: number; score: number }>();
    questions.forEach((q) => {
      const current = map.get(q.type) || { count: 0, score: 0 };
      current.count += 1;
      current.score += Number(q.score) || 0;
      map.set(q.type, current);
    });

    return Array.from(map.entries()).map(([type, data]) => {
      const pct = totalScore > 0 ? Number(((data.score / totalScore) * 100).toFixed(1)) : 0;
      const label = QUESTION_TYPE_LABELS[type as QuestionType]?.label || type;
      return {
        type,
        label,
        count: data.count,
        score: Number(data.score.toFixed(2)),
        percent: pct,
      };
    });
  }, [questions, totalScore]);

  // 3. Thống kê theo Chủ đề kiến thức
  const topicStats = useMemo(() => {
    const map = new Map<string, { count: number; score: number }>();
    questions.forEach((q) => {
      const topicName = q.topic?.trim() || config.topicName?.trim() || 'Chủ đề chung';
      const current = map.get(topicName) || { count: 0, score: 0 };
      current.count += 1;
      current.score += Number(q.score) || 0;
      map.set(topicName, current);
    });

    return Array.from(map.entries()).map(([topic, data]) => {
      const pct = totalScore > 0 ? Number(((data.score / totalScore) * 100).toFixed(1)) : 0;
      return {
        topic,
        count: data.count,
        score: Number(data.score.toFixed(2)),
        percent: pct,
      };
    });
  }, [questions, totalScore, config.topicName]);

  // 4. Kiểm tra các cảnh báo lệch chuẩn sư phạm (CODE CHẠY)
  const warnings: string[] = useMemo(() => {
    const list: string[] = [];
    const nbPct = levelStats.find((l) => l.level === 'NB')?.percent || 0;
    const vdcPct = levelStats.find((l) => l.level === 'VDC')?.percent || 0;
    const thPct = levelStats.find((l) => l.level === 'TH')?.percent || 0;
    const vdPct = levelStats.find((l) => l.level === 'VD')?.percent || 0;

    if (nbPct > 50) {
      list.push(`Tỷ lệ câu hỏi Nhận biết quá cao (${nbPct}% > 50%), đề thi có thể quá dễ và thiếu tính phân hóa.`);
    }

    if (vdcPct === 0 && config.schoolLevel !== 'TIEU_HOC') {
      list.push('Đề thi chưa có câu Vận dụng cao (0%), sẽ khó phân loại được học sinh giỏi và xuất sắc.');
    }

    if (vdPct + vdcPct > 60) {
      list.push(`Tỷ lệ Vận dụng và Vận dụng cao chiếm tới ${(vdPct + vdcPct).toFixed(1)}% (> 60%), đề thi quá nặng so với thời lượng làm bài.`);
    }

    if (nbPct + thPct < 40 && totalQuestions > 0) {
      list.push(`Tỷ lệ Nhận biết & Thông hiểu dưới 40% (${(nbPct + thPct).toFixed(1)}%), có thể khiến nhiều học sinh trung bình không đạt yêu cầu.`);
    }

    return list;
  }, [levelStats, totalQuestions, config.schoolLevel]);

  return (
    <div className="space-y-6 max-w-[210mm] mx-auto bg-white p-6 sm:p-10 rounded-xl border border-slate-300 shadow-md font-serif print:shadow-none print:border-none print:p-0">
      {/* Header */}
      <div className="border-b-2 border-slate-900 pb-4">
        <h2 className="font-bold uppercase text-base sm:text-lg text-slate-950 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-700" />
          <span>BÁO CÁO THỐNG KÊ & PHÂN TÍCH ĐỀ KIỂM TRA</span>
        </h2>
        <p className="text-xs text-slate-600 italic mt-0.5">
          Tổng số câu: {totalQuestions} câu • Thang điểm: {totalScore.toFixed(2)}đ / {config.scale || 10}đ
        </p>
      </div>

      {/* CẢNH BÁO CHỈ SỐ LỆCH CHUẨN */}
      <div>
        {warnings.length > 0 ? (
          <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wide">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Khuyến nghị điều chỉnh chỉ số sư phạm:</span>
            </div>
            <ul className="list-disc pl-5 text-xs text-amber-800 space-y-1">
              {warnings.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center gap-2 text-emerald-900 text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Đề kiểm tra phân bổ các mức độ nhận thức đạt chuẩn Bộ GD&ĐT (khung năng lực 40-30-20-10 hoặc tương đương).</span>
          </div>
        )}
      </div>

      {/* 1. THỐNG KÊ THEO MỨC ĐỘ NHẬN THỨC */}
      <div className="space-y-3">
        <div className="font-bold text-slate-900 text-xs uppercase tracking-wide flex items-center justify-between">
          <span>1. Phân bổ theo mức độ nhận thức:</span>
          <span className="text-[11px] text-slate-500 font-normal">Chuẩn 4 mức nhận thức</span>
        </div>

        {/* Thanh bar trực quan */}
        <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
          {levelStats.map((l) => (
            <div
              key={l.level}
              style={{ width: `${l.percent}%` }}
              className={`${l.color} transition-all duration-300`}
              title={`${l.name}: ${l.count} câu (${l.score}đ - ${l.percent}%)`}
            />
          ))}
        </div>

        {/* Bảng chi tiết mức độ */}
        <div className="overflow-x-auto rounded-lg border border-slate-300">
          <table className="w-full text-xs text-center border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-bold">
                <th className="p-2 text-left">Mức độ nhận thức</th>
                <th className="p-2">Số câu</th>
                <th className="p-2">Tổng điểm</th>
                <th className="p-2">Tỷ lệ % điểm</th>
                <th className="p-2">Đánh giá chuẩn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {levelStats.map((l) => (
                <tr key={l.level} className="hover:bg-slate-50">
                  <td className="p-2 text-left font-bold text-slate-800 flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${l.color} inline-block`}></span>
                    <span>{l.name}</span>
                  </td>
                  <td className="p-2 font-bold text-slate-900">{l.count} câu</td>
                  <td className="p-2 font-semibold text-blue-800">{l.score.toFixed(2)}đ</td>
                  <td className="p-2 font-bold text-slate-900">{l.percent}%</td>
                  <td className="p-2 text-[11px] text-slate-600">
                    {l.level === 'NB' && (l.percent >= 30 && l.percent <= 50 ? 'Chuẩn' : 'Nên điều chỉnh')}
                    {l.level === 'TH' && (l.percent >= 20 && l.percent <= 40 ? 'Chuẩn' : 'Nên điều chỉnh')}
                    {l.level === 'VD' && (l.percent >= 15 && l.percent <= 30 ? 'Chuẩn' : 'Nên điều chỉnh')}
                    {l.level === 'VDC' && (l.percent >= 5 && l.percent <= 15 ? 'Chuẩn' : 'Nên điều chỉnh')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. THỐNG KÊ THEO DẠNG CÂU HỎI */}
      <div className="space-y-3 pt-2">
        <div className="font-bold text-slate-900 text-xs uppercase tracking-wide">
          2. Phân bổ theo dạng câu hỏi:
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-300">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-bold">
                <th className="p-2">Dạng câu hỏi</th>
                <th className="p-2 text-center">Số câu</th>
                <th className="p-2 text-right">Tổng điểm</th>
                <th className="p-2 text-right">Tỷ lệ %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {typeStats.map((t) => (
                <tr key={t.type} className="hover:bg-slate-50">
                  <td className="p-2 font-medium text-slate-800">{t.label}</td>
                  <td className="p-2 text-center font-bold text-slate-900">{t.count} câu</td>
                  <td className="p-2 text-right font-semibold text-blue-800">{t.score.toFixed(2)}đ</td>
                  <td className="p-2 text-right font-bold text-slate-900">{t.percent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. THỐNG KÊ THEO CHỦ ĐỀ KIẾN THỨC */}
      <div className="space-y-3 pt-2">
        <div className="font-bold text-slate-900 text-xs uppercase tracking-wide">
          3. Phân bổ theo chủ đề / đơn vị kiến thức:
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-300">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-bold">
                <th className="p-2">Chủ đề kiến thức</th>
                <th className="p-2 text-center">Số câu</th>
                <th className="p-2 text-right">Tổng điểm</th>
                <th className="p-2 text-right">Tỷ lệ %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {topicStats.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="p-2 font-medium text-slate-800">{item.topic}</td>
                  <td className="p-2 text-center font-bold text-slate-900">{item.count} câu</td>
                  <td className="p-2 text-right font-semibold text-blue-800">{item.score.toFixed(2)}đ</td>
                  <td className="p-2 text-right font-bold text-slate-900">{item.percent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
