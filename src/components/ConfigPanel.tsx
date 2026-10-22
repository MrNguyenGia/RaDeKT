import React, { useState } from 'react';
import {
  GraduationCap,
  School,
  BookOpen,
  Check,
  AlertCircle,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  FileText,
  Building2,
  Calendar,
  User,
  Layers,
  HelpCircle,
  PenTool,
  RotateCcw,
  History,
  Trash2,
  FileSpreadsheet,
  CheckCircle2,
} from 'lucide-react';
import {
  SCHOOL_LEVEL_OPTIONS,
  SUBJECTS_BY_LEVEL,
  GRADES_BY_LEVEL,
  EXAM_TYPE_OPTIONS,
  QUICK_DURATIONS,
} from '../config';
import { useExamStore } from '../store';
import { ExamType, Grade, SchoolLevel } from '../types';
import { validateExamConfig } from '../lib/validate';
import { ReferenceSection } from './ReferenceSection';
import { ExamStructureSection } from './ExamStructureSection';
import { TeacherQuestionsSection } from './TeacherQuestionsSection';
import { Loader2, XCircle } from 'lucide-react';

export const ConfigPanel: React.FC = () => {
  const {
    config,
    updateConfig,
    isGenerating,
    generationProgress,
    generationError,
    startGenerateExam,
    cancelGeneration,
    restoreSavedConfigAction,
    clearSavedConfigAction,
    hasSavedConfig,
    setIsMatrixModalOpen,
    removeImportedMatrixAction,
  } = useExamStore();

  // Trạng thái đóng/mở khối thông tin tiêu đề không bắt buộc
  const [showSchoolHeaderInfo, setShowSchoolHeaderInfo] = useState<boolean>(false);
  const [showConfirmClearConfig, setShowConfirmClearConfig] = useState<boolean>(false);

  // Môn học thực tế được sử dụng (ưu tiên môn nhập tay nếu có nội dung)
  const isCustomSubjectActive = Boolean(config.customSubject && config.customSubject.trim().length > 0);
  const effectiveSubject = isCustomSubjectActive
    ? config.customSubject!.trim()
    : config.subject;

  // Kiểm tra tính hợp lệ từng bước
  const isStep1Valid = Boolean(config.schoolLevel);
  const isStep2Valid = Boolean(config.grade);
  const isStep3Valid = Boolean(effectiveSubject && effectiveSubject.trim().length > 0);
  const isStep4Valid = Boolean(
    (config.topicName && config.topicName.trim().length > 0) ||
    (config.knowledgeScope && config.knowledgeScope.trim().length > 0) ||
    (config.rawLessonContent && config.rawLessonContent.trim().length > 0)
  );

  // Xử lý đổi cấp học (Tự động xóa lớp và môn học đã chọn, đặt mặc định Đúng/Sai theo cấp)
  const handleSelectLevel = (level: SchoolLevel) => {
    updateConfig({
      schoolLevel: level,
      grade: null,
      subject: '',
      customSubject: '',
      trueFalseType: level === 'THPT' ? 'CLUSTER4' : 'SINGLE',
      use3LevelsPrimary: false,
    });
  };

  // Xử lý chọn loại đề
  const handleSelectExamType = (type: ExamType, defaultDuration: number) => {
    const typeLabel = EXAM_TYPE_OPTIONS.find((t) => t.value === type)?.label || 'Kiểm tra';
    const gradeText = config.grade ? `Lớp ${config.grade}` : '';
    const subjectText = effectiveSubject ? `Môn ${effectiveSubject}` : '';
    const autoTitle = `Đề ${typeLabel.toLowerCase()} ${gradeText} ${subjectText}`.trim();

    updateConfig({
      examType: type,
      durationMinutes: type === '15_MIN' ? 15 : defaultDuration,
      // Tự cập nhật tên đề gợi ý nếu chưa nhập tên đề tùy chỉnh
      title: config.title ? config.title : autoTitle,
    });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
      {/* Tiêu đề Panel */}
      <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
            <PenTool className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">
              Thiết lập đề kiểm tra
            </h2>
            <p className="text-xs text-slate-500">
              Điền thông tin theo các bước để chuẩn bị ma trận & đề thi
            </p>
          </div>
        </div>

        {/* Thanh đếm tiến độ các bước bắt buộc */}
        <div className="flex items-center gap-1.5 bg-blue-50/80 px-2.5 py-1 rounded-full border border-blue-200">
          <span className="text-xs font-semibold text-blue-700">
            {[isStep1Valid, isStep2Valid, isStep3Valid].filter(Boolean).length}/3
          </span>
          <span className="text-[11px] text-blue-600 font-normal">bắt buộc</span>
        </div>
      </div>

      {/* Hai nút ở đầu cột Thiết lập: Khôi phục cấu hình & Xóa cấu hình */}
      <div className="px-5 py-2.5 bg-slate-100/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-slate-600">
          <History className="w-3.5 h-3.5 text-blue-600" />
          <span className="text-[11px] font-medium">Bộ nhớ cấu hình:</span>
          {hasSavedConfig ? (
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded border border-emerald-200">
              Đã ghi nhớ
            </span>
          ) : (
            <span className="text-[10px] bg-slate-200 text-slate-600 font-medium px-1.5 py-0.2 rounded">
              Mặc định
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={restoreSavedConfigAction}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-lg border border-slate-300 text-[11px] shadow-2xs transition-colors"
            title="Nạp lại các lựa chọn thiết lập đã lưu gần nhất từ trình duyệt"
          >
            <RotateCcw className="w-3 h-3 text-blue-600" />
            <span>Khôi phục cấu hình</span>
          </button>

          <button
            type="button"
            onClick={() => setShowConfirmClearConfig(true)}
            className="inline-flex items-center gap-1 px-2 py-1 bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-700 font-medium rounded-lg border border-slate-300 text-[11px] transition-colors"
            title="Xóa cấu hình đã lưu và đưa toàn bộ form về mặc định ban đầu"
          >
            <Trash2 className="w-3 h-3 text-rose-500" />
            <span>Xóa cấu hình</span>
          </button>
        </div>
      </div>

      {/* Hộp xác nhận xóa cấu hình */}
      {showConfirmClearConfig && (
        <div className="p-3 px-5 bg-rose-50 border-b border-rose-300 text-xs text-rose-900 flex items-center justify-between gap-3 animate-in fade-in">
          <div>
            <span className="font-bold">Xác nhận xóa cấu hình đã lưu?</span>
            <p className="text-[11px] text-rose-700">Toàn bộ thiết lập sẽ được đưa về giá trị mặc định ban đầu.</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowConfirmClearConfig(false)}
              className="px-2.5 py-1 bg-white border border-slate-300 text-slate-700 rounded-md text-[11px] font-medium"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={() => {
                clearSavedConfigAction();
                setShowConfirmClearConfig(false);
              }}
              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-[11px] font-bold shadow-2xs"
            >
              Xác nhận xóa
            </button>
          </div>
        </div>
      )}

      {/* Nội dung Stepper cuộn */}
      <div className="p-5 space-y-6 flex-1 overflow-y-auto max-h-[calc(100vh-210px)] text-sm">
        {/* ========================================================= */}
        {/* TÍNH NĂNG: TẠO TỪ MA TRẬN CÓ SẴN */}
        {/* ========================================================= */}
        {config.importedMatrix ? (
          <div className="p-3.5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-300 rounded-xl shadow-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <CheckCircle2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <span>Đang dùng ma trận nhập sẵn</span>
                  <span className="text-[10px] font-semibold bg-emerald-200/80 text-emerald-900 px-1.5 py-0.2 rounded border border-emerald-300">
                    {config.importedMatrix.topics.length} chủ đề • {config.importedMatrix.topics.reduce((acc, t) => acc + t.cells.reduce((ca, c) => ca + (c.count || 0), 0), 0)} câu
                  </span>
                </div>
                <p className="text-[11px] text-emerald-700 mt-0.5">
                  Bản đặc tả dựng chuẩn theo từng ô ma trận (không dùng thuật toán tự điền)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsMatrixModalOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-emerald-50 text-emerald-800 font-semibold rounded-lg text-xs border border-emerald-300 shadow-2xs transition-colors"
              >
                <span>Xem/Sửa</span>
              </button>
              <button
                type="button"
                onClick={removeImportedMatrixAction}
                className="inline-flex items-center gap-1 px-2 py-1.5 bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-700 font-medium rounded-lg text-xs border border-slate-200 transition-colors"
                title="Hủy ma trận nhập sẵn và quay lại cấu hình thường"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
              </button>
            </div>
          </div>
        ) : (
          <div className="p-3.5 bg-gradient-to-r from-blue-50/90 via-indigo-50/80 to-purple-50/70 border border-indigo-200/80 rounded-xl shadow-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <FileSpreadsheet className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <span>Tạo từ ma trận có sẵn</span>
                  <span className="text-[10px] font-semibold bg-indigo-100 text-indigo-700 px-1.5 py-0.2 rounded border border-indigo-200">
                    Nhanh & Chuẩn
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Tải file Word/PDF/ảnh hoặc dán bảng ma trận để AI trích xuất nguyên trạng
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsMatrixModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs shadow-xs transition-colors shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Nhập ma trận</span>
            </button>
          </div>
        )}

        {/* ========================================================= */}
        {/* BƯỚC 1: CHỌN CẤP HỌC */}
        {/* ========================================================= */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                isStep1Valid ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white'
              }`}>
                {isStep1Valid ? <Check className="w-3.5 h-3.5" /> : '1'}
              </span>
              <h3 className="font-semibold text-slate-800 text-sm">
                Bước 1: Chọn cấp học <span className="text-red-500">*</span>
              </h3>
            </div>
            {isStep1Valid && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <Check className="w-3 h-3" /> Đã chọn
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {SCHOOL_LEVEL_OPTIONS.map((opt) => {
              const isSelected = config.schoolLevel === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => handleSelectLevel(opt.key)}
                  className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50/60'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {opt.key === 'TIEU_HOC' && <BookOpen className="w-4 h-4" />}
                        {opt.key === 'THCS' && <School className="w-4 h-4" />}
                        {opt.key === 'THPT' && <GraduationCap className="w-4 h-4" />}
                      </div>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {opt.badge}
                      </span>
                    </div>

                    <div className="font-bold text-slate-900 text-sm">{opt.title}</div>
                    <div className="text-[11px] text-blue-600 font-medium mb-1">{opt.gradesText}</div>
                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                      {opt.description}
                    </p>
                  </div>

                  {isSelected && (
                    <div className="mt-2.5 pt-2 border-t border-blue-200/80 flex items-center gap-1 text-[11px] text-blue-700 font-medium">
                      <Check className="w-3.5 h-3.5 text-blue-600" />
                      <span>Đang chọn</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {!isStep1Valid && (
            <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 p-2 rounded-lg border border-red-200">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Vui lòng chọn cấp học (Tiểu học, THCS hoặc THPT).</span>
            </div>
          )}
        </section>

        {/* ========================================================= */}
        {/* BƯỚC 2: CHỌN LỚP */}
        {/* ========================================================= */}
        <section className="space-y-3 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                isStep2Valid ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white'
              }`}>
                {isStep2Valid ? <Check className="w-3.5 h-3.5" /> : '2'}
              </span>
              <h3 className="font-semibold text-slate-800 text-sm">
                Bước 2: Chọn khối lớp <span className="text-red-500">*</span>
              </h3>
            </div>
            {isStep2Valid && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <Check className="w-3 h-3" /> Lớp {config.grade}
              </span>
            )}
          </div>

          {config.schoolLevel ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {GRADES_BY_LEVEL[config.schoolLevel].map((gradeNum) => {
                  const isGradeSelected = config.grade === gradeNum;
                  return (
                    <button
                      key={gradeNum}
                      type="button"
                      onClick={() => updateConfig({ grade: gradeNum as Grade })}
                      className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-all ${
                        isGradeSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-500/20'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-blue-400 hover:bg-blue-50/40'
                      }`}
                    >
                      Lớp {gradeNum}
                    </button>
                  );
                })}
              </div>

              {!isStep2Valid && (
                <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 p-2 rounded-lg border border-red-200">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Vui lòng chọn một khối lớp để thiết lập ma trận tương ứng.</span>
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500 italic">
              Vui lòng chọn cấp học ở Bước 1 để hiển thị danh sách lớp phù hợp.
            </div>
          )}
        </section>

        {/* ========================================================= */}
        {/* BƯỚC 3: CHỌN MÔN HỌC */}
        {/* ========================================================= */}
        <section className="space-y-3 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                isStep3Valid ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white'
              }`}>
                {isStep3Valid ? <Check className="w-3.5 h-3.5" /> : '3'}
              </span>
              <h3 className="font-semibold text-slate-800 text-sm">
                Bước 3: Chọn môn học <span className="text-red-500">*</span>
              </h3>
            </div>
            {isStep3Valid && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <Check className="w-3 h-3" /> Môn: {effectiveSubject}
              </span>
            )}
          </div>

          <div className="space-y-3 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200">
            {/* Danh sách xổ xuống các môn phổ biến theo CT GDPT 2018 */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Môn học theo CT GDPT 2018:
              </label>
              <select
                value={config.subject || ''}
                disabled={!config.schoolLevel}
                onChange={(e) => updateConfig({ subject: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
              >
                <option value="">-- Chọn môn học từ danh sách --</option>
                {config.schoolLevel &&
                  SUBJECTS_BY_LEVEL[config.schoolLevel].map((subj) => (
                    <option key={subj} value={subj}>
                      {subj}
                    </option>
                  ))}
              </select>
            </div>

            {/* Ô nhập môn học khác (Bắt buộc có, ưu tiên hơn danh sách nếu có nội dung) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Hoặc nhập tên môn học khác:
                </label>
                {isCustomSubjectActive && (
                  <span className="text-[10px] font-semibold text-blue-700 bg-blue-100 px-2 py-0.2 rounded">
                    Đang ưu tiên môn tự nhập
                  </span>
                )}
              </div>
              <input
                type="text"
                placeholder="Ví dụ: Tiếng Nhật, Khoa học máy tính, Kỹ năng sống..."
                value={config.customSubject || ''}
                onChange={(e) => updateConfig({ customSubject: e.target.value })}
                className={`w-full px-3 py-2 text-xs bg-white border rounded-lg focus:outline-none focus:ring-2 ${
                  isCustomSubjectActive
                    ? 'border-blue-500 ring-1 ring-blue-500/20'
                    : 'border-slate-300 focus:ring-blue-500 focus:border-blue-500'
                }`}
              />
              <p className="text-[11px] text-slate-500 mt-1">
                * Nếu nhập ô này, hệ thống sẽ tự động ưu tiên tên môn tự nhập thay cho môn đã chọn ở danh sách trên.
              </p>
            </div>

            {!isStep3Valid && (
              <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 p-2 rounded-lg border border-red-200">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Vui lòng chọn một môn học trong danh sách hoặc nhập tên môn học khác.</span>
              </div>
            )}
          </div>
        </section>

        {/* ========================================================= */}
        {/* BƯỚC 4: NHẬP NỘI DUNG KIẾN THỨC */}
        {/* ========================================================= */}
        <section className="space-y-3 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                isStep4Valid ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white'
              }`}>
                {isStep4Valid ? <Check className="w-3.5 h-3.5" /> : '4'}
              </span>
              <h3 className="font-semibold text-slate-800 text-sm">
                Bước 4: Nhập nội dung kiến thức
              </h3>
            </div>
            {isStep4Valid && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <Check className="w-3 h-3" /> Đã nhập
              </span>
            )}
          </div>

          <div className="space-y-3 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200">
            {/* Tên bài / chủ đề & Chương */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tên bài / Chủ đề:
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Phân số và số thập phân / Khảo sát hàm số..."
                  value={config.topicName || ''}
                  onChange={(e) => updateConfig({ topicName: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Chương / Chuyên đề:
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Chương 1: Số học / Chương 2: Đạo hàm..."
                  value={config.chapter || ''}
                  onChange={(e) => updateConfig({ chapter: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Phạm vi kiến thức */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Phạm vi kiến thức trọng tâm:
              </label>
              <input
                type="text"
                placeholder="Ví dụ: Từ bài 1 đến bài 5; các định lý, quy tắc tính toán cơ bản..."
                value={config.knowledgeScope || ''}
                onChange={(e) => updateConfig({ knowledgeScope: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Nội dung cần kiểm tra & Yêu cầu cần đạt */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nội dung cần kiểm tra:
                </label>
                <textarea
                  rows={2}
                  placeholder="Các dạng bài tập, công thức, khái niệm trọng tâm cần đánh giá..."
                  value={config.testContent || ''}
                  onChange={(e) => updateConfig({ testContent: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Yêu cầu cần đạt:
                </label>
                <textarea
                  rows={2}
                  placeholder="Chuẩn kiến thức, kỹ năng học sinh cần đạt được sau bài học..."
                  value={config.learningOutcomes || ''}
                  onChange={(e) => updateConfig({ learningOutcomes: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Ghi chú */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ghi chú sư phạm:
              </label>
              <input
                type="text"
                placeholder="Ví dụ: Chú ý tránh các câu hỏi quá dài; ưu tiên bài toán gắn liền thực tế..."
                value={config.notes || ''}
                onChange={(e) => updateConfig({ notes: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Vùng văn bản lớn để dán nội dung bài học (có đếm ký tự) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Dán nội dung bài học / trích đoạn tài liệu:
                </label>
                <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-slate-200/80 text-slate-700">
                  {((config.rawLessonContent || '').length).toLocaleString()} ký tự
                </span>
              </div>
              <textarea
                rows={4}
                placeholder="Dán toàn bộ nội dung giáo án, tài liệu SGK, văn bản bài học hoặc các câu hỏi mẫu vào đây để AI phân tích bám sát..."
                value={config.rawLessonContent || ''}
                onChange={(e) => updateConfig({ rawLessonContent: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* TÀI LIỆU THAM CHIẾU & NGUỒN KIẾN THỨC (BƯỚC 3 YÊU CẦU) */}
        {/* ========================================================= */}
        <ReferenceSection />

        {/* ========================================================= */}
        {/* CẤU TRÚC ĐỀ, MA TRẬN & THANG ĐIỂM (BƯỚC 4 YÊU CẦU) */}
        {/* ========================================================= */}
        <ExamStructureSection />

        {/* ========================================================= */}
        {/* BỔ SUNG NGAY DƯỚI: LOẠI ĐỀ, THỜI GIAN, TIÊU ĐỀ */}
        {/* ========================================================= */}
        <section className="space-y-4 pt-2 border-t border-slate-200">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-slate-700 text-white flex items-center justify-center text-xs font-bold">
              +
            </span>
            <h3 className="font-semibold text-slate-800 text-sm">
              Thiết lập đề & Thời gian làm bài
            </h3>
          </div>

          <div className="space-y-3 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200">
            {/* Loại đề */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Loại đề kiểm tra:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {EXAM_TYPE_OPTIONS.map((item) => {
                  const isTypeActive = config.examType === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => handleSelectExamType(item.value, item.defaultDuration)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border text-center transition-all ${
                        isTypeActive
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs font-semibold'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50/40'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Ô nhập Tên đề */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tên đề kiểm tra:
              </label>
              <input
                type="text"
                placeholder="Ví dụ: Đề kiểm tra giữa học kỳ I - Môn Toán 12..."
                value={config.title || ''}
                onChange={(e) => updateConfig({ title: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>

            {/* Thời gian làm bài */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  Thời gian làm bài:
                </label>
                <span className="text-xs font-bold text-blue-700">
                  {config.durationMinutes || 45} phút
                </span>
              </div>

              {/* Nút chọn nhanh */}
              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                {QUICK_DURATIONS.map((dur) => {
                  const isDurActive = config.durationMinutes === dur;
                  return (
                    <button
                      key={dur}
                      type="button"
                      onClick={() => updateConfig({ durationMinutes: dur })}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                        isDurActive
                          ? 'bg-blue-600 text-white border-blue-600 font-semibold shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'
                      }`}
                    >
                      {dur}'
                    </button>
                  );
                })}

                {/* Hoặc tự nhập số phút */}
                <div className="flex items-center gap-1 ml-auto">
                  <span className="text-xs text-slate-500">Tự nhập:</span>
                  <input
                    type="number"
                    min={5}
                    max={300}
                    value={config.durationMinutes || ''}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      updateConfig({ durationMinutes: isNaN(val) ? 0 : val });
                    }}
                    className="w-16 px-2 py-1 text-xs text-center bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-xs text-slate-500">phút</span>
                </div>
              </div>
            </div>

            {/* Khu vực Câu hỏi giáo viên tự nhập */}
            <TeacherQuestionsSection />

            {/* Thông tin tiêu đề đề thi (Không bắt buộc) */}
            <div className="pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowSchoolHeaderInfo(!showSchoolHeaderInfo)}
                className="w-full flex items-center justify-between text-xs font-semibold text-slate-700 hover:text-blue-700 transition-colors py-1"
              >
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-500" />
                  Thông tin tiêu đề trường / sở / năm học (Không bắt buộc)
                </span>
                {showSchoolHeaderInfo ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {showSchoolHeaderInfo && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2.5 pt-2.5 border-t border-dashed border-slate-200">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Sở / Phòng GD&ĐT:
                    </label>
                    <input
                      type="text"
                      placeholder="Ví dụ: Sở GD&ĐT TP. Hà Nội"
                      value={config.departmentName || ''}
                      onChange={(e) => updateConfig({ departmentName: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Tên trường học:
                    </label>
                    <input
                      type="text"
                      placeholder="Ví dụ: Trường THPT Chu Văn An"
                      value={config.schoolName || ''}
                      onChange={(e) => updateConfig({ schoolName: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Năm học:
                    </label>
                    <input
                      type="text"
                      placeholder="Ví dụ: 2024 - 2025"
                      value={config.academicYear || ''}
                      onChange={(e) => updateConfig({ academicYear: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Giáo viên ra đề:
                    </label>
                    <input
                      type="text"
                      placeholder="Ví dụ: Thầy / Cô Nguyễn Văn A"
                      value={config.teacherName || ''}
                      onChange={(e) => updateConfig({ teacherName: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Chân cột thiết lập: Nút hành động */}
      <div className="p-4 border-t border-slate-200 bg-slate-50/90 space-y-3">
        {isGenerating ? (
          <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-blue-900 flex items-center gap-1.5">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <span>
                  Đang tạo lô {generationProgress?.batchIndex || 1}/{generationProgress?.totalBatches || 1}
                  {generationProgress?.currentSlotRange ? ` (${generationProgress.currentSlotRange})` : ''}...
                </span>
              </span>
              <span className="font-bold text-blue-700">{generationProgress?.percent || 0}%</span>
            </div>

            {/* Thanh tiến trình % */}
            <div className="w-full bg-blue-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${generationProgress?.percent || 5}%` }}
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-500">
                Gemini đang biên soạn nội dung & công thức LaTeX...
              </span>
              <button
                type="button"
                onClick={cancelGeneration}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-600 hover:text-red-700 bg-white border border-red-200 hover:bg-red-50 rounded-md transition-colors"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Hủy</span>
              </button>
            </div>
          </div>
        ) : (
          (() => {
            const validationResult = validateExamConfig(config);
            const canGenerate = validationResult.isValid;

            return (
              <>
                <button
                  type="button"
                  disabled={!canGenerate}
                  onClick={startGenerateExam}
                  className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold shadow-xs transition-all ${
                    canGenerate
                      ? 'bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white cursor-pointer hover:shadow-md'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                  }`}
                  title={canGenerate ? 'Bấm để Gemini AI bắt đầu sinh đề thi' : validationResult.errors[0]}
                >
                  <Sparkles className={`w-4 h-4 ${canGenerate ? 'text-amber-300 animate-pulse' : 'text-slate-400'}`} />
                  <span>TẠO ĐỀ KIỂM TRA VỚI AI</span>
                </button>

                {/* Dòng trạng thái / Lý do khóa nút */}
                <div className="text-[11px] px-1">
                  {!canGenerate ? (
                    <div className="text-amber-700 bg-amber-50/80 border border-amber-200 p-2 rounded-lg flex items-start gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600 mt-0.5" />
                      <div>
                        <strong className="font-semibold">Chưa thể tạo đề: </strong>
                        <span>{validationResult.errors[0] || 'Vui lòng kiểm tra lại thiết lập'}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-slate-500">
                      <span className="text-emerald-600 font-medium flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 shrink-0" />
                        <span>Sẵn sàng sinh đề ({config.scale || 10}đ)</span>
                      </span>
                      <span className="text-slate-400">Chuẩn GDPT 2018</span>
                    </div>
                  )}
                </div>
              </>
            );
          })()
        )}

        {generationError && (
          <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-medium">{generationError}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
