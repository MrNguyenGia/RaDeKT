import React, { useMemo } from 'react';
import {
  ListChecks,
  Sliders,
  TableProperties,
  Calculator,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Info,
} from 'lucide-react';
import {
  ESSAY_STYLE_OPTIONS,
  QUESTION_TYPES_ORDER,
  ROUNDING_STEPS,
} from '../config';
import {
  autoFillBlueprintMatrix,
  convertCountsToPercentages,
  convertPercentagesToCounts,
  generateBlueprintSlots,
  validateBlueprintMatrix,
} from '../lib/blueprint';
import {
  calculateExamSlotScores,
  validateTotalExamScore,
} from '../lib/scoring';
import { useExamStore } from '../store';
import {
  EssayStyle,
  Level,
  QuestionType,
  QuestionTypeCounts,
  TrueFalseType,
} from '../types';

export const ExamStructureSection: React.FC = () => {
  const { config, updateConfig } = useExamStore();

  const isPrimary = config.schoolLevel === 'TIEU_HOC';
  const use3Levels = Boolean(isPrimary && config.use3LevelsPrimary);
  const activeLevels: Level[] = use3Levels ? ['NB', 'TH', 'VD'] : ['NB', 'TH', 'VD', 'VDC'];

  // 1. Tính tổng số câu hỏi theo từng nhóm
  const questionCounts = config.questionCountsByType || {};

  const totalObjectiveQuestions =
    (questionCounts.MCQ4 || 0) +
    (questionCounts.MCQ_MULTI || 0) +
    (questionCounts.TRUE_FALSE || 0) +
    (questionCounts.MATCHING || 0) +
    (questionCounts.FILL_BLANK || 0) +
    (questionCounts.SHORT_ANSWER || 0);

  const totalEssayQuestions = questionCounts.ESSAY || 0;
  const totalQuestions = totalObjectiveQuestions + totalEssayQuestions;

  // 2. Phân bổ mức độ nhận thức
  const levelMode = config.levelMode || 'PERCENT';
  const percentages = config.levelDistribution || {
    nbPercent: use3Levels ? 50 : 40,
    thPercent: 30,
    vdPercent: 20,
    vdcPercent: use3Levels ? 0 : 10,
  };

  // Tính số câu tương ứng từ % nếu đang ở chế độ PERCENT
  const calculatedCountsFromPct = useMemo(() => {
    return convertPercentagesToCounts(totalQuestions, percentages, use3Levels);
  }, [totalQuestions, percentages, use3Levels]);

  const levelCounts = config.levelCounts || calculatedCountsFromPct;

  // Tổng số câu theo mức độ hiện tại
  const totalLevelQuestions = activeLevels.reduce(
    (sum, lvl) => sum + (levelCounts[lvl] || 0),
    0
  );

  // Tổng tỷ lệ % hiện tại
  const totalPercent =
    percentages.nbPercent +
    percentages.thPercent +
    percentages.vdPercent +
    (use3Levels ? 0 : percentages.vdcPercent);

  // 3. Ma trận Dạng câu x Mức độ
  const currentMatrix = useMemo(() => {
    if (config.blueprintMatrix) return config.blueprintMatrix;
    return autoFillBlueprintMatrix(questionCounts, levelCounts, use3Levels);
  }, [config.blueprintMatrix, questionCounts, levelCounts, use3Levels]);

  const matrixValidation = useMemo(() => {
    return validateBlueprintMatrix(currentMatrix, questionCounts, levelCounts, use3Levels);
  }, [currentMatrix, questionCounts, levelCounts, use3Levels]);

  // 4. Danh sách Slots và Thang điểm
  const slots = useMemo(() => {
    return generateBlueprintSlots({
      ...config,
      blueprintMatrix: currentMatrix,
      levelCounts,
    });
  }, [config, currentMatrix, levelCounts]);

  const slotScores = useMemo(() => {
    return calculateExamSlotScores(slots, config);
  }, [slots, config]);

  const scoreValidation = useMemo(() => {
    return validateTotalExamScore(
      slots,
      config.customSlotScores,
      config.scale || 10,
      config.roundingStep || 0.25
    );
  }, [slots, config.customSlotScores, config.scale, config.roundingStep]);

  // --- HANDLERS ---
  const handleQuestionCountChange = (type: QuestionType, value: number) => {
    const val = Math.max(0, isNaN(value) ? 0 : value);
    const newCounts: QuestionTypeCounts = {
      ...questionCounts,
      [type]: val,
    };

    const newTotal = Object.values(newCounts).reduce((a, b) => a + (b || 0), 0);
    const newLvlCounts = convertPercentagesToCounts(newTotal, percentages, use3Levels);
    const newMatrix = autoFillBlueprintMatrix(newCounts, newLvlCounts, use3Levels);

    updateConfig({
      questionCountsByType: newCounts,
      levelCounts: newLvlCounts,
      blueprintMatrix: newMatrix,
      customSlotScores: {}, // reset custom scores khi đổi số câu
    });
  };

  const handlePercentageChange = (level: Level, value: number) => {
    const val = Math.max(0, isNaN(value) ? 0 : value);
    const newPcts = {
      ...percentages,
      [level === 'NB'
        ? 'nbPercent'
        : level === 'TH'
        ? 'thPercent'
        : level === 'VD'
        ? 'vdPercent'
        : 'vdcPercent']: val,
    };

    const newLvlCounts = convertPercentagesToCounts(totalQuestions, newPcts, use3Levels);
    const newMatrix = autoFillBlueprintMatrix(questionCounts, newLvlCounts, use3Levels);

    updateConfig({
      levelDistribution: newPcts,
      levelCounts: newLvlCounts,
      blueprintMatrix: newMatrix,
    });
  };

  const handleCountChange = (level: Level, value: number) => {
    const val = Math.max(0, isNaN(value) ? 0 : value);
    const newCounts = {
      ...levelCounts,
      [level]: val,
    };

    const newPcts = convertCountsToPercentages(newCounts, totalQuestions, use3Levels);
    const newMatrix = autoFillBlueprintMatrix(questionCounts, newCounts, use3Levels);

    updateConfig({
      levelCounts: newCounts,
      levelDistribution: newPcts,
      blueprintMatrix: newMatrix,
    });
  };

  const handleApplySuggestedDistribution = (nb: number, th: number, vd: number, vdc: number) => {
    const newPcts = { nbPercent: nb, thPercent: th, vdPercent: vd, vdcPercent: vdc };
    const newCounts = convertPercentagesToCounts(totalQuestions, newPcts, use3Levels);
    const newMatrix = autoFillBlueprintMatrix(questionCounts, newCounts, use3Levels);

    updateConfig({
      levelDistribution: newPcts,
      levelCounts: newCounts,
      blueprintMatrix: newMatrix,
    });
  };

  const handleToggle3LevelsPrimary = (enabled: boolean) => {
    const newPcts = enabled
      ? { nbPercent: 50, thPercent: 30, vdPercent: 20, vdcPercent: 0 }
      : { nbPercent: 40, thPercent: 30, vdPercent: 20, vdcPercent: 10 };

    const newCounts = convertPercentagesToCounts(totalQuestions, newPcts, enabled);
    const newMatrix = autoFillBlueprintMatrix(questionCounts, newCounts, enabled);

    updateConfig({
      use3LevelsPrimary: enabled,
      levelDistribution: newPcts,
      levelCounts: newCounts,
      blueprintMatrix: newMatrix,
    });
  };

  const handleMatrixCellChange = (type: QuestionType, level: Level, val: number) => {
    const value = Math.max(0, isNaN(val) ? 0 : val);
    const newMatrix = {
      ...currentMatrix,
      [type]: {
        ...(currentMatrix[type] || { NB: 0, TH: 0, VD: 0, VDC: 0 }),
        [level]: value,
      },
    };

    updateConfig({ blueprintMatrix: newMatrix });
  };

  const handleResetMatrix = () => {
    const matrix = autoFillBlueprintMatrix(questionCounts, levelCounts, use3Levels);
    updateConfig({ blueprintMatrix: matrix });
  };

  const handleCustomScoreChange = (slotId: string, val: number) => {
    const value = isNaN(val) ? 0 : val;
    updateConfig({
      customSlotScores: {
        ...(config.customSlotScores || {}),
        [slotId]: value,
      },
    });
  };

  const QUESTION_FORMATS: { type: QuestionType; label: string; badge: string }[] = [
    { type: 'MCQ4', label: '4 lựa chọn (A, B, C, D)', badge: 'Trắc nghiệm' },
    { type: 'MCQ_MULTI', label: 'Nhiều đáp án đúng', badge: 'Trắc nghiệm' },
    { type: 'TRUE_FALSE', label: 'Đúng / Sai', badge: 'Trắc nghiệm' },
    { type: 'MATCHING', label: 'Ghép nối / Ghép cặp', badge: 'Trắc nghiệm' },
    { type: 'FILL_BLANK', label: 'Điền từ / Điền khuyết', badge: 'Trắc nghiệm' },
    { type: 'SHORT_ANSWER', label: 'Trả lời ngắn', badge: 'Trắc nghiệm' },
    { type: 'ESSAY', label: 'Tự luận', badge: 'Tự luận' },
  ];

  return (
    <section className="space-y-5 pt-3 border-t border-slate-200">
      {/* Tiêu đề mục */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
            <ListChecks className="w-3.5 h-3.5" />
          </span>
          <h3 className="font-semibold text-slate-800 text-sm">
            Cấu trúc đề & Phân bổ điểm số
          </h3>
        </div>

        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
          Tổng: {totalQuestions} câu • {config.scale || 10} điểm
        </span>
      </div>

      <div className="space-y-5 bg-slate-50/70 p-4 rounded-xl border border-slate-200 text-xs">
        {/* ========================================================= */}
        {/* 1. HÌNH THỨC CÂU HỎI */}
        {/* ========================================================= */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="font-semibold text-slate-800 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center text-[11px] font-bold">
                1
              </span>
              Số lượng câu theo từng hình thức câu hỏi:
            </label>
            <div className="text-[11px] text-slate-500">
              Trắc nghiệm: <strong className="text-slate-800">{totalObjectiveQuestions}</strong> | Tự luận:{' '}
              <strong className="text-slate-800">{totalEssayQuestions}</strong>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {QUESTION_FORMATS.map((fmt) => {
              const count = questionCounts[fmt.type] || 0;
              return (
                <div
                  key={fmt.type}
                  className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200 hover:border-blue-300 transition-colors"
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-medium text-slate-800 truncate" title={fmt.label}>
                      {fmt.label}
                    </div>
                    <span className="text-[10px] text-slate-400">{fmt.badge}</span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={count || ''}
                      placeholder="0"
                      onChange={(e) =>
                        handleQuestionCountChange(fmt.type, parseInt(e.target.value, 10))
                      }
                      className="w-14 px-2 py-1 text-xs text-center font-bold bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <span className="text-[11px] text-slate-500">câu</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Thiết lập phụ cho Tự luận (ESSAY) */}
          {totalEssayQuestions > 0 && (
            <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-200 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-blue-900">
                  Kiểu bài tự luận (essayStyle):
                </span>
                <span className="text-[10px] bg-blue-200/70 text-blue-800 px-1.5 py-0.2 rounded font-medium">
                  {totalEssayQuestions} câu tự luận
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {ESSAY_STYLE_OPTIONS.map((style) => {
                  const isSelected = config.essayStyle === style.value;
                  return (
                    <button
                      key={style.value}
                      type="button"
                      onClick={() => updateConfig({ essayStyle: style.value as EssayStyle })}
                      className={`px-2 py-1.5 rounded-md text-[11px] font-medium border text-center transition-all ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs font-semibold'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'
                      }`}
                    >
                      {style.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Thiết lập phụ cho Đúng / Sai */}
          {(questionCounts.TRUE_FALSE || 0) > 0 && (
            <div className="p-3 bg-slate-100/80 rounded-lg border border-slate-200 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                <span className="font-semibold text-slate-800">
                  Định dạng câu Đúng / Sai:
                </span>
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="trueFalseType"
                      checked={config.trueFalseType === 'CLUSTER4'}
                      onChange={() => updateConfig({ trueFalseType: 'CLUSTER4' })}
                      className="text-blue-600"
                    />
                    <span className="text-[11px]">Chùm 4 ý a,b,c,d (Chuẩn THPT 2025)</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="trueFalseType"
                      checked={config.trueFalseType === 'SINGLE'}
                      onChange={() => updateConfig({ trueFalseType: 'SINGLE' })}
                      className="text-blue-600"
                    />
                    <span className="text-[11px]">1 mệnh đề đơn</span>
                  </label>
                </div>
              </div>

              {config.trueFalseType === 'CLUSTER4' && (
                <label className="flex items-center gap-2 cursor-pointer pt-1 border-t border-slate-200">
                  <input
                    type="checkbox"
                    checked={config.trueFalseProgressiveScoring !== false}
                    onChange={(e) =>
                      updateConfig({ trueFalseProgressiveScoring: e.target.checked })
                    }
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-[11px] text-slate-700 font-medium">
                    Chấm lũy tiến theo chuẩn Bộ GD&ĐT (đúng 1 ý = 10%, 2 ý = 25%, 3 ý = 50%, 4 ý = 100%)
                  </span>
                </label>
              )}
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* 2. MỨC ĐỘ NHẬN THỨC */}
        {/* ========================================================= */}
        <div className="pt-3 border-t border-slate-200 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label className="font-semibold text-slate-800 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center text-[11px] font-bold">
                2
              </span>
              Phân bổ mức độ nhận thức ({activeLevels.length} mức):
            </label>

            {/* Chuyển đổi chế độ nhập */}
            <div className="inline-flex items-center p-0.5 bg-slate-200 rounded-lg text-[11px]">
              <button
                type="button"
                onClick={() => updateConfig({ levelMode: 'PERCENT' })}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  levelMode === 'PERCENT'
                    ? 'bg-white text-blue-700 font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Nhập Tỷ lệ %
              </button>
              <button
                type="button"
                onClick={() => updateConfig({ levelMode: 'COUNT' })}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  levelMode === 'COUNT'
                    ? 'bg-white text-blue-700 font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Nhập Số câu
              </button>
            </div>
          </div>

          {/* Tùy chọn 3 mức cho Tiểu học */}
          {isPrimary && (
            <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50/70 border border-amber-200">
              <span className="text-[11px] text-amber-900">
                Áp dụng 3 mức đánh giá cho Tiểu học (Mức 1 = NB, Mức 2 = TH, Mức 3 = VD, ẩn VDC)
              </span>
              <button
                type="button"
                onClick={() => handleToggle3LevelsPrimary(!use3Levels)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors ${
                  use3Levels
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'bg-white text-slate-700 border-slate-300'
                }`}
              >
                {use3Levels ? 'Đang bật 3 mức' : 'Bật 3 mức'}
              </button>
            </div>
          )}

          {/* 4 thẻ mức độ hiển thị đồng thời cả Số câu và Tỷ lệ % */}
          <div className={`grid gap-2 ${use3Levels ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
            {activeLevels.map((lvl) => {
              const labelMap: Record<Level, { name: string; color: string; border: string }> = {
                NB: { name: use3Levels ? 'Mức 1 (Nhận biết)' : 'Nhận biết (NB)', color: 'bg-emerald-50 text-emerald-800', border: 'border-emerald-200' },
                TH: { name: use3Levels ? 'Mức 2 (Thông hiểu)' : 'Thông hiểu (TH)', color: 'bg-blue-50 text-blue-800', border: 'border-blue-200' },
                VD: { name: use3Levels ? 'Mức 3 (Vận dụng)' : 'Vận dụng (VD)', color: 'bg-amber-50 text-amber-800', border: 'border-amber-200' },
                VDC: { name: 'Vận dụng cao (VDC)', color: 'bg-rose-50 text-rose-800', border: 'border-rose-200' },
              };

              const pct =
                lvl === 'NB'
                  ? percentages.nbPercent
                  : lvl === 'TH'
                  ? percentages.thPercent
                  : lvl === 'VD'
                  ? percentages.vdPercent
                  : percentages.vdcPercent;

              const cnt = levelCounts[lvl] || 0;
              const info = labelMap[lvl];

              return (
                <div
                  key={lvl}
                  className={`p-2.5 rounded-lg border ${info.border} ${info.color} space-y-1.5`}
                >
                  <div className="font-bold text-[11px] truncate">{info.name}</div>

                  <div className="grid grid-cols-2 gap-1.5 items-center">
                    {/* Nhập % */}
                    <div>
                      <span className="text-[10px] text-slate-500 block">Tỷ lệ %</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        disabled={levelMode !== 'PERCENT'}
                        value={pct}
                        onChange={(e) => handlePercentageChange(lvl, parseInt(e.target.value, 10))}
                        className="w-full px-1.5 py-1 text-xs text-center font-bold bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
                      />
                    </div>

                    {/* Nhập Số câu */}
                    <div>
                      <span className="text-[10px] text-slate-500 block">Số câu</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        disabled={levelMode !== 'COUNT'}
                        value={cnt}
                        onChange={(e) => handleCountChange(lvl, parseInt(e.target.value, 10))}
                        className="w-full px-1.5 py-1 text-xs text-center font-bold bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Hàng nút Gợi ý phân bổ & Kiểm tra tổng */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-500 font-medium">Gợi ý phân bổ:</span>
              {use3Levels ? (
                <button
                  type="button"
                  onClick={() => handleApplySuggestedDistribution(50, 30, 20, 0)}
                  className="px-2 py-0.5 rounded bg-white border border-slate-300 text-[11px] hover:border-blue-400 font-medium text-slate-700"
                >
                  50 / 30 / 20 (Chuẩn Tiểu học)
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => handleApplySuggestedDistribution(40, 30, 20, 10)}
                    className="px-2 py-0.5 rounded bg-white border border-slate-300 text-[11px] hover:border-blue-400 font-medium text-slate-700"
                  >
                    40 / 30 / 20 / 10 (Chuẩn THPT/THCS)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplySuggestedDistribution(30, 40, 20, 10)}
                    className="px-2 py-0.5 rounded bg-white border border-slate-300 text-[11px] hover:border-blue-400 font-medium text-slate-700"
                  >
                    30 / 40 / 20 / 10
                  </button>
                </>
              )}
            </div>

            <div className="text-[11px] flex items-center gap-2">
              <span>
                Tổng %:{' '}
                <strong className={Math.abs(totalPercent - 100) > 0.01 ? 'text-red-600 font-bold' : 'text-emerald-700'}>
                  {totalPercent}%
                </strong>
              </span>
              <span>•</span>
              <span>
                Tổng câu theo mức:{' '}
                <strong className={totalLevelQuestions !== totalQuestions ? 'text-red-600 font-bold' : 'text-emerald-700'}>
                  {totalLevelQuestions}/{totalQuestions}
                </strong>
              </span>
            </div>
          </div>

          {/* Cảnh báo đỏ nếu tổng % khác 100 hoặc tổng số câu khác tổng đề */}
          {Math.abs(totalPercent - 100) > 0.01 && (
            <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-[11px] flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              <span>Tổng tỷ lệ phần trăm các mức độ phải bằng 100% (hiện tại: {totalPercent}%).</span>
            </div>
          )}

          {totalLevelQuestions !== totalQuestions && (
            <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-[11px] flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              <span>
                Tổng số câu theo mức độ ({totalLevelQuestions}) đang lệch{' '}
                {totalLevelQuestions > totalQuestions ? `+${totalLevelQuestions - totalQuestions}` : `-${totalQuestions - totalLevelQuestions}`}{' '}
                câu so với tổng số câu của đề ({totalQuestions}).
              </span>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* 3. BẢNG PHÂN BỔ DẠNG CÂU × MỨC ĐỘ (BLUEPRINT MATRIX) */}
        {/* ========================================================= */}
        <div className="pt-3 border-t border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <label className="font-semibold text-slate-800 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center text-[11px] font-bold">
                3
              </span>
              Bảng ma trận Dạng câu × Mức độ nhận thức:
            </label>

            <button
              type="button"
              onClick={handleResetMatrix}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
              title="Tự động sắp xếp dạng câu từ dễ đến khó và lấp đầy theo mức độ"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Tự động phân bổ lại</span>
            </button>
          </div>

          <p className="text-[11px] text-slate-500">
            * Thuật toán xác định: Sắp các dạng từ dễ đến khó (Điền khuyết → TN 4 lựa chọn → Đúng/Sai → Nhiều đáp án → Ghép nối → Trả lời ngắn → Tự luận) rồi lấp lần lượt từ NB lên VDC. Bạn có thể sửa tay từng ô.
          </p>

          {/* Bảng ma trận 2 chiều */}
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-center border-collapse text-[11px]">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                  <th className="py-2 px-2.5 text-left font-semibold">Dạng câu hỏi</th>
                  {activeLevels.map((lvl) => (
                    <th key={lvl} className="py-2 px-2 font-semibold">
                      {lvl}
                    </th>
                  ))}
                  <th className="py-2 px-2.5 font-semibold bg-slate-200/60">Tổng hàng</th>
                  <th className="py-2 px-2 font-semibold">Đích</th>
                </tr>
              </thead>
              <tbody>
                {QUESTION_TYPES_ORDER.filter((t) => (questionCounts[t] || 0) > 0).map((type) => {
                  const targetRow = questionCounts[type] || 0;
                  const row = currentMatrix[type] || { NB: 0, TH: 0, VD: 0, VDC: 0 };
                  const rowActual = activeLevels.reduce((sum, lvl) => sum + (row[lvl] || 0), 0);
                  const isRowMismatch = rowActual !== targetRow;
                  const rowDiscrepancy = matrixValidation.rowDiscrepancies[type];

                  return (
                    <tr
                      key={type}
                      className={`border-b border-slate-100 hover:bg-slate-50/70 ${
                        isRowMismatch ? 'bg-red-50/50' : ''
                      }`}
                    >
                      <td className="py-2 px-2.5 text-left font-medium text-slate-800">
                        {type === 'MCQ4'
                          ? 'TN 4 lựa chọn'
                          : type === 'MCQ_MULTI'
                          ? 'Nhiều đáp án'
                          : type === 'TRUE_FALSE'
                          ? 'Đúng / Sai'
                          : type === 'MATCHING'
                          ? 'Ghép nối'
                          : type === 'FILL_BLANK'
                          ? 'Điền khuyết'
                          : type === 'SHORT_ANSWER'
                          ? 'Trả lời ngắn'
                          : 'Tự luận'}
                      </td>

                      {activeLevels.map((lvl) => (
                        <td key={lvl} className="p-1">
                          <input
                            type="number"
                            min={0}
                            value={row[lvl] || ''}
                            placeholder="0"
                            onChange={(e) =>
                              handleMatrixCellChange(type, lvl, parseInt(e.target.value, 10))
                            }
                            className="w-10 py-1 text-center font-bold bg-slate-50 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                      ))}

                      <td
                        className={`py-2 px-2 font-bold ${
                          isRowMismatch ? 'text-red-600 bg-red-100/60' : 'text-slate-800 bg-slate-100/50'
                        }`}
                      >
                        {rowActual}
                      </td>

                      <td className="py-2 px-2 text-slate-500 font-semibold">
                        {targetRow}
                        {rowDiscrepancy && (
                          <span className="block text-[9px] text-red-600">
                            ({rowDiscrepancy.diff > 0 ? `+${rowDiscrepancy.diff}` : rowDiscrepancy.diff})
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                {/* Dòng tổng cột */}
                <tr className="bg-slate-100 font-bold border-t-2 border-slate-300">
                  <td className="py-2 px-2.5 text-left text-slate-700">Tổng cột</td>
                  {activeLevels.map((lvl) => {
                    const colInfo = matrixValidation.colDiscrepancies[lvl];
                    const isColMismatch = colInfo.diff !== 0;
                    return (
                      <td
                        key={lvl}
                        className={`py-2 px-1 ${
                          isColMismatch ? 'text-red-600 bg-red-100/60' : 'text-slate-800'
                        }`}
                      >
                        <div>{colInfo.actual}</div>
                        <div className="text-[9px] font-normal text-slate-500">
                          / {colInfo.expected}
                          {colInfo.diff !== 0 && (
                            <span className="text-red-600 font-bold block">
                              ({colInfo.diff > 0 ? `+${colInfo.diff}` : colInfo.diff})
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td className="py-2 px-2 bg-slate-200/80 text-blue-900 font-bold">
                    {totalLevelQuestions}
                  </td>
                  <td className="py-2 px-2 text-slate-600">{totalQuestions}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {!matrixValidation.isValid && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-[11px] space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span>Ma trận đang có hàng hoặc cột chưa khớp:</span>
              </div>
              <ul className="list-disc pl-5 space-y-0.5 text-[10px]">
                {Object.entries(matrixValidation.rowDiscrepancies).map(([t, err]) => (
                  <li key={t}>
                    Hàng {t}: Đang có {err.actual} câu (yêu cầu đúng {err.expected} câu,{' '}
                    {err.diff > 0 ? `thừa +${err.diff}` : `thiếu ${err.diff}`}).
                  </li>
                ))}
                {activeLevels
                  .filter((lvl) => matrixValidation.colDiscrepancies[lvl].diff !== 0)
                  .map((lvl) => {
                    const err = matrixValidation.colDiscrepancies[lvl];
                    return (
                      <li key={lvl}>
                        Cột {lvl}: Đang có {err.actual} câu (yêu cầu đúng {err.expected} câu,{' '}
                        {err.diff > 0 ? `thừa +${err.diff}` : `thiếu ${err.diff}`}).
                      </li>
                    );
                  })}
              </ul>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* 4. THANG ĐIỂM & LÀM TRÒN */}
        {/* ========================================================= */}
        <div className="pt-3 border-t border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <label className="font-semibold text-slate-800 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center text-[11px] font-bold">
                4
              </span>
              Thang điểm & Cơ chế làm tròn số:
            </label>

            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
              scoreValidation.isValid
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {scoreValidation.isValid
                ? `Khớp ${scoreValidation.totalScore}/${config.scale || 10} điểm`
                : `Lệch: ${scoreValidation.totalScore}/${config.scale || 10} điểm`}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Chọn thang điểm */}
            <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1.5">
              <span className="text-[11px] font-medium text-slate-600 block">Thang điểm:</span>
              <div className="flex items-center gap-1.5">
                {[10, 20, 100].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => updateConfig({ scale: s, customSlotScores: {} })}
                    className={`px-2.5 py-1 rounded text-xs font-semibold border transition-colors ${
                      config.scale === s
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:border-blue-400'
                    }`}
                  >
                    {s}đ
                  </button>
                ))}
                <div className="flex items-center gap-1 ml-auto">
                  <span className="text-[11px] text-slate-400">Tùy biến:</span>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={config.scale || ''}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      updateConfig({ scale: isNaN(val) ? 10 : val, customSlotScores: {} });
                    }}
                    className="w-14 px-1.5 py-1 text-xs text-center font-bold bg-slate-50 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-[11px] text-slate-500">đ</span>
                </div>
              </div>
            </div>

            {/* Bước làm tròn */}
            <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1.5">
              <span className="text-[11px] font-medium text-slate-600 block">Bước làm tròn:</span>
              <div className="flex items-center gap-2">
                {ROUNDING_STEPS.map((step) => (
                  <button
                    key={step}
                    type="button"
                    onClick={() => updateConfig({ roundingStep: step, customSlotScores: {} })}
                    className={`flex-1 py-1 rounded text-xs font-semibold border transition-colors ${
                      config.roundingStep === step
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:border-blue-400'
                    }`}
                  >
                    {step} điểm
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Tùy chọn chia điểm theo phần (Trắc nghiệm / Tự luận) */}
          <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="font-semibold text-slate-800">
                Tùy chọn chia điểm theo phần (Trắc nghiệm / Tự luận)
              </span>
              <input
                type="checkbox"
                checked={Boolean(config.sectionScoringEnabled)}
                onChange={(e) =>
                  updateConfig({
                    sectionScoringEnabled: e.target.checked,
                    customSlotScores: {},
                  })
                }
                className="rounded text-blue-600 focus:ring-blue-500"
              />
            </label>

            {config.sectionScoringEnabled && (
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">
                    Điểm phần Trắc nghiệm ({totalObjectiveQuestions} câu):
                  </label>
                  <input
                    type="number"
                    step={config.roundingStep || 0.25}
                    value={config.sectionScores?.objectiveScore ?? 7}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      updateConfig({
                        sectionScores: {
                          ...config.sectionScores,
                          objectiveScore: isNaN(val) ? 0 : val,
                        },
                        customSlotScores: {},
                      });
                    }}
                    className="w-full px-2 py-1 text-xs font-bold bg-slate-50 border border-slate-300 rounded"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">
                    Điểm phần Tự luận ({totalEssayQuestions} câu):
                  </label>
                  <input
                    type="number"
                    step={config.roundingStep || 0.25}
                    value={config.sectionScores?.essayScore ?? 3}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      updateConfig({
                        sectionScores: {
                          ...config.sectionScores,
                          essayScore: isNaN(val) ? 0 : val,
                        },
                        customSlotScores: {},
                      });
                    }}
                    className="w-full px-2 py-1 text-xs font-bold bg-slate-50 border border-slate-300 rounded"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Danh sách từng câu hỏi & Cho phép sửa điểm tay */}
          {slots.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700 text-[11px]">
                  Bảng điểm chi tiết từng câu ({slots.length} câu) - Có thể sửa tay:
                </span>
                <span className="text-[10px] text-slate-400">
                  Tính nguyên đơn vị theo bước {config.roundingStep || 0.25}đ
                </span>
              </div>

              <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {slots.map((slot) => {
                    const currentScore = slotScores[slot.id] ?? slot.score;
                    return (
                      <div
                        key={slot.id}
                        className="p-1.5 rounded border border-slate-200 bg-slate-50 flex items-center justify-between gap-1 text-[11px]"
                      >
                        <span className="font-medium text-slate-700 truncate">
                          Câu {slot.orderNumber} ({slot.level}):
                        </span>
                        <input
                          type="number"
                          step={config.roundingStep || 0.25}
                          min={0}
                          value={currentScore}
                          onChange={(e) =>
                            handleCustomScoreChange(slot.id, parseFloat(e.target.value))
                          }
                          className="w-14 px-1 py-0.5 text-center font-bold bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Cảnh báo đỏ nếu tổng điểm lệch thang điểm */}
          {!scoreValidation.isValid && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-[11px] flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">Lệch thang điểm!</div>
                <div>{scoreValidation.message}</div>
                <div className="text-[10px] text-red-600/90 mt-0.5">
                  * Hệ thống không cho phép sinh đề khi tổng điểm còn lệch thang điểm quy định.
                </div>
              </div>
            </div>
          )}

          {scoreValidation.isValid && (
            <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>
                Điểm số đã cân đối chính xác: Tổng cộng {scoreValidation.totalScore} / {config.scale || 10} điểm.
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
