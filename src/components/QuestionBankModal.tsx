import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Search,
  Download,
  Upload,
  Plus,
  Trash2,
  Edit3,
  Copy,
  CheckCircle2,
  AlertTriangle,
  FolderPlus,
  Filter,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Sparkles,
  Info,
  BookOpen,
  ArrowRight,
  Database,
} from 'lucide-react';
import { BankQuestion, Grade, Level, Question, QuestionType, SchoolLevel } from '../types';
import {
  deleteBankQuestion,
  deleteMultipleBankQuestions,
  duplicateBankQuestion,
  exportBankToJson,
  getBankQuestions,
  importBankFromJson,
  updateBankQuestion,
} from '../lib/storage';
import { QUESTION_TYPE_LABELS, LEVEL_LABELS } from '../config';
import { MathText } from './MathText';
import { QuestionModal } from './preview/QuestionModal';

interface QuestionBankModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertQuestionsToExam: (questions: Question[]) => void;
  onSetAsTeacherQuestions: (questions: Question[]) => void;
}

export const QuestionBankModal: React.FC<QuestionBankModalProps> = ({
  isOpen,
  onClose,
  onInsertQuestionsToExam,
  onSetAsTeacherQuestions,
}) => {
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Bộ lọc
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [filterSubject, setFilterSubject] = useState<string>('ALL');
  const [filterGrade, setFilterGrade] = useState<string>('ALL');
  const [filterTopic, setFilterTopic] = useState<string>('ALL');
  const [filterLevel, setFilterLevel] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterSource, setFilterSource] = useState<string>('ALL');

  // Chọn hàng loạt
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Phân trang
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 12;

  // Modal Sửa câu hỏi
  const [editingQuestion, setEditingQuestion] = useState<BankQuestion | null>(null);

  // Xác nhận xóa
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState<boolean>(false);

  // File input ẩn để nhập JSON
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await getBankQuestions();
      setQuestions(data);
    } catch (e) {
      console.error('Lỗi khi tải ngân hàng câu hỏi:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
      setSelectedIds(new Set());
      setCurrentPage(1);
    }
  }, [isOpen]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Danh sách các môn hiện có trong ngân hàng để đưa vào dropdown lọc
  const uniqueSubjects = useMemo(() => {
    const set = new Set<string>();
    questions.forEach((q) => {
      if (q.subject) set.add(q.subject);
    });
    return Array.from(set);
  }, [questions]);

  // Danh sách các chủ đề hiện có trong ngân hàng để đưa vào dropdown lọc
  const uniqueTopics = useMemo(() => {
    const set = new Set<string>();
    questions.forEach((q) => {
      if (q.topic) set.add(q.topic);
    });
    return Array.from(set);
  }, [questions]);

  // Lọc câu hỏi theo các tiêu chí
  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      // Tìm kiếm từ khóa
      if (searchKeyword.trim()) {
        const kw = searchKeyword.toLowerCase().trim();
        const matchText =
          q.question.toLowerCase().includes(kw) ||
          (q.explanation && q.explanation.toLowerCase().includes(kw)) ||
          (q.correctAnswer && q.correctAnswer.toLowerCase().includes(kw)) ||
          (q.topic && q.topic.toLowerCase().includes(kw));
        if (!matchText) return false;
      }

      // Lọc theo Môn
      if (filterSubject !== 'ALL' && q.subject !== filterSubject) return false;

      // Lọc theo Lớp
      if (filterGrade !== 'ALL') {
        const gradeNum = parseInt(filterGrade, 10);
        if (q.grade !== gradeNum) return false;
      }

      // Lọc theo Chủ đề
      if (filterTopic !== 'ALL' && q.topic !== filterTopic) return false;

      // Lọc theo Mức độ
      if (filterLevel !== 'ALL' && q.level !== filterLevel) return false;

      // Lọc theo Dạng câu
      if (filterType !== 'ALL' && q.type !== filterType) return false;

      // Lọc theo Nguồn (AI / GV)
      if (filterSource !== 'ALL' && q.source !== filterSource) return false;

      return true;
    });
  }, [questions, searchKeyword, filterSubject, filterGrade, filterTopic, filterLevel, filterType, filterSource]);

  // Phân trang
  const totalPages = Math.max(1, Math.ceil(filteredQuestions.length / pageSize));
  const paginatedQuestions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredQuestions.slice(start, start + pageSize);
  }, [filteredQuestions, currentPage, pageSize]);

  // Reset trang về 1 khi đổi bộ lọc
  useEffect(() => {
    setCurrentPage(1);
  }, [searchKeyword, filterSubject, filterGrade, filterTopic, filterLevel, filterType, filterSource]);

  // Xử lý chọn/bỏ chọn
  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleSelectAllCurrentPage = () => {
    const next = new Set(selectedIds);
    const allPageSelected = paginatedQuestions.every((q) => next.has(q.id));
    if (allPageSelected) {
      paginatedQuestions.forEach((q) => next.delete(q.id));
    } else {
      paginatedQuestions.forEach((q) => next.add(q.id));
    }
    setSelectedIds(next);
  };

  // Xóa câu hỏi đơn lẻ
  const handleDeleteOne = async (id: string) => {
    const ok = await deleteBankQuestion(id);
    if (ok) {
      setQuestions((prev) => prev.filter((q) => q.id !== id));
      const nextSelected = new Set(selectedIds);
      nextSelected.delete(id);
      setSelectedIds(nextSelected);
      showToast('Đã xóa câu hỏi khỏi ngân hàng');
    }
    setConfirmDeleteId(null);
  };

  // Xóa hàng loạt
  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const ok = await deleteMultipleBankQuestions(ids);
    if (ok) {
      setQuestions((prev) => prev.filter((q) => !selectedIds.has(q.id)));
      setSelectedIds(new Set());
      showToast(`Đã xóa ${ids.length} câu hỏi được chọn`);
    }
    setConfirmBulkDelete(false);
  };

  // Nhân bản câu hỏi
  const handleDuplicate = async (id: string) => {
    const cloned = await duplicateBankQuestion(id);
    if (cloned) {
      setQuestions((prev) => [cloned, ...prev]);
      showToast('Đã nhân bản câu hỏi thành công');
    }
  };

  // Lưu sửa đổi câu hỏi từ QuestionModal
  const handleSaveEdit = async (data: Partial<Question>) => {
    if (!editingQuestion) return;
    const patch: Partial<BankQuestion> = {
      question: data.question,
      type: data.type,
      level: data.level,
      score: data.score,
      topic: data.topic,
      options: data.options,
      statements: data.statements,
      pairs: data.pairs,
      correctAnswer: data.correctAnswer,
      explanation: data.explanation,
      scoringGuide: data.scoringGuide,
    };

    const ok = await updateBankQuestion(editingQuestion.id, patch);
    if (ok) {
      setQuestions((prev) =>
        prev.map((q) => (q.id === editingQuestion.id ? { ...q, ...patch } : q))
      );
      showToast('Đã cập nhật nội dung câu hỏi trong ngân hàng');
    }
    setEditingQuestion(null);
  };

  // Chuyển BankQuestion sang Question để chèn vào đề
  const convertToExamQuestion = (bq: BankQuestion): Question => ({
    id: `q_bank_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    slotId: `slot_bank_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    subject: bq.subject,
    topic: bq.topic || 'Kiến thức ngân hàng',
    type: bq.type,
    level: bq.level,
    score: bq.score,
    question: bq.question,
    options: bq.options,
    statements: bq.statements,
    pairs: bq.pairs,
    correctAnswer: bq.correctAnswer,
    explanation: bq.explanation,
    scoringGuide: bq.scoringGuide,
    needsReview: false,
    isTeacherWritten: true, // Đánh dấu GV để AI không sửa
    figure: bq.figure,
    imageData: bq.imageData,
  });

  // Dùng lại 1: Thêm vào đề hiện tại
  const handleInsertSelectedToExam = () => {
    const selectedQuestions = questions
      .filter((q) => selectedIds.has(q.id))
      .map(convertToExamQuestion);

    if (selectedQuestions.length === 0) return;
    onInsertQuestionsToExam(selectedQuestions);
    showToast(`Đã thêm ${selectedQuestions.length} câu vào đề kiểm tra hiện tại!`);
    onClose();
  };

  // Dùng lại 2: Dùng làm câu GV nhập (cột trái)
  const handleSetAsTeacherQuestions = () => {
    const selectedQuestions = questions
      .filter((q) => selectedIds.has(q.id))
      .map(convertToExamQuestion);

    if (selectedQuestions.length === 0) return;
    onSetAsTeacherQuestions(selectedQuestions);
    showToast(`Đã nạp ${selectedQuestions.length} câu vào danh sách Câu GV tự nhập!`);
    onClose();
  };

  // Xuất file JSON
  const handleExportJson = async () => {
    try {
      const jsonStr = await exportBankToJson(questions);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const nowStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `ngan-hang-cau-hoi-stem-${nowStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Đã xuất toàn bộ ngân hàng câu hỏi ra file JSON');
    } catch (e: any) {
      showToast(`Lỗi xuất file: ${e?.message || 'Không thể tạo file'}`);
    }
  };

  // Nhập file JSON
  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const res = await importBankFromJson(text);
      if (res.error) {
        showToast(res.error);
      } else {
        await loadData();
        showToast(
          `Đã nhập thành công ${res.addedCount} câu mới (Bỏ qua ${res.duplicateCount} câu trùng lặp)`
        );
      }
    } catch (err: any) {
      showToast(`Không thể đọc file JSON: ${err?.message}`);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-6xl w-full my-auto max-h-[94vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* ========================================================= */}
        {/* HEADER MODAL */}
        {/* ========================================================= */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base text-slate-900">Ngân hàng câu hỏi</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">
                  {questions.length} câu hỏi đã lưu
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Lưu trữ, tái sử dụng và phân loại theo cấp, lớp, môn, chủ đề & mức độ GDPT 2018
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Nút Xuất JSON */}
            <button
              type="button"
              onClick={handleExportJson}
              disabled={questions.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold shadow-2xs transition-colors disabled:opacity-50"
              title="Tải toàn bộ câu hỏi trong ngân hàng về máy dưới dạng file JSON"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>Xuất JSON</span>
            </button>

            {/* Nút Nhập JSON */}
            <label
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              title="Nhập thêm câu hỏi từ file JSON đã sao lưu (tự động loại bỏ câu trùng)"
            >
              <Upload className="w-3.5 h-3.5 text-indigo-600" />
              <span>Nhập JSON</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileInputChange}
                className="hidden"
              />
            </label>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Ghi chú sao lưu an toàn */}
        <div className="bg-amber-50/80 border-b border-amber-200 px-6 py-2 text-[11px] text-amber-900 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span>
              <strong>Lưu ý quan trọng:</strong> Dữ liệu ngân hàng câu hỏi được lưu trữ an toàn trong trình duyệt này (IndexedDB). Thầy/cô nên định kỳ bấm <strong>“Xuất JSON”</strong> để sao lưu về máy tính cá nhân.
            </span>
          </div>

          {toastMessage && (
            <span className="font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded text-[11px] animate-in fade-in shrink-0">
              {toastMessage}
            </span>
          )}
        </div>

        {/* ========================================================= */}
        {/* BỘ LỌC & TÌM KIẾM */}
        {/* ========================================================= */}
        <div className="p-4 border-b border-slate-200 bg-white space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-xs">
            {/* Ô tìm kiếm */}
            <div className="col-span-2 relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="Tìm nội dung, chủ đề, lời giải..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Môn */}
            <div>
              <select
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="ALL">Tất cả môn</option>
                {uniqueSubjects.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Khối lớp */}
            <div>
              <select
                value={filterGrade}
                onChange={(e) => setFilterGrade(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="ALL">Tất cả khối lớp</option>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((g) => (
                  <option key={g} value={String(g)}>
                    Lớp {g}
                  </option>
                ))}
              </select>
            </div>

            {/* Chủ đề */}
            <div>
              <select
                value={filterTopic}
                onChange={(e) => setFilterTopic(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 truncate"
                title="Lọc theo chủ đề / bài học"
              >
                <option value="ALL">Tất cả chủ đề</option>
                {uniqueTopics.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* Dạng câu */}
            <div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="ALL">Tất cả dạng câu</option>
                <option value="MCQ4">Trắc nghiệm 4 LC</option>
                <option value="TRUE_FALSE">Đúng / Sai</option>
                <option value="MATCHING">Ghép nối</option>
                <option value="FILL_BLANK">Điền khuyết</option>
                <option value="SHORT_ANSWER">Trả lời ngắn</option>
                <option value="ESSAY">Tự luận</option>
              </select>
            </div>

            {/* Mức độ */}
            <div>
              <select
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="ALL">Tất cả mức độ</option>
                <option value="NB">Biết (NB)</option>
                <option value="TH">Hiểu (TH)</option>
                <option value="VD">Vận dụng (VD)</option>
                <option value="VDC">Vận dụng cao (VDC)</option>
              </select>
            </div>
          </div>

          {/* Thanh công cụ khi chọn nhiều câu hỏi */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 text-xs">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSelectAllCurrentPage}
                className="inline-flex items-center gap-1.5 text-slate-700 hover:text-slate-900 font-medium"
              >
                {paginatedQuestions.length > 0 &&
                paginatedQuestions.every((q) => selectedIds.has(q.id)) ? (
                  <CheckSquare className="w-4 h-4 text-indigo-600" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
                <span>Chọn tất cả trang này ({paginatedQuestions.length})</span>
              </button>

              {selectedIds.size > 0 && (
                <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                  Đã chọn {selectedIds.size} câu
                </span>
              )}
            </div>

            {/* Nhóm thao tác dùng lại & xóa nhiều */}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleInsertSelectedToExam}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-2xs transition-colors"
                  title="Chèn các câu đã chọn vào đề kiểm tra hiện tại (AI không đụng vào)"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm vào đề hiện tại ({selectedIds.size})</span>
                </button>

                <button
                  type="button"
                  onClick={handleSetAsTeacherQuestions}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-2xs transition-colors"
                  title="Đưa vào danh sách câu GV tự nhập ở cột Thiết lập để tạo đề mới giữ nguyên các câu này"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Dùng làm câu GV nhập ({selectedIds.size})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setConfirmBulkDelete(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold rounded-lg transition-colors"
                  title="Xóa các câu đã chọn khỏi ngân hàng"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa ({selectedIds.size})</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Hộp xác nhận xóa nhiều câu */}
        {confirmBulkDelete && (
          <div className="bg-rose-50 border-b border-rose-300 p-3 px-6 text-xs text-rose-900 flex items-center justify-between animate-in fade-in">
            <span>
              Bạn có chắc chắn muốn xóa vĩnh viễn <strong>{selectedIds.size}</strong> câu hỏi đã chọn khỏi ngân hàng?
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmBulkDelete(false)}
                className="px-3 py-1 bg-white border border-slate-300 text-slate-700 rounded-md font-medium"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleBulkDelete}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-md font-bold shadow-2xs"
              >
                Xác nhận xóa {selectedIds.size} câu
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* DANH SÁCH CÂU HỎI TRONG NGÂN HÀNG */}
        {/* ========================================================= */}
        <div className="p-5 flex-1 overflow-y-auto space-y-3 bg-slate-50/50">
          {isLoading ? (
            <div className="py-16 text-center text-xs text-slate-400">
              Đang tải danh sách câu hỏi từ ngân hàng...
            </div>
          ) : filteredQuestions.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <FolderPlus className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-xs font-semibold text-slate-700">
                {questions.length === 0
                  ? 'Chưa có câu hỏi nào trong ngân hàng.'
                  : 'Không có câu hỏi nào phù hợp với bộ lọc hiện tại.'}
              </p>
              <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                Khi xem đề thi, thầy/cô bấm nút <strong>“Lưu vào ngân hàng”</strong> ở từng câu hoặc <strong>“Lưu tất cả câu của đề”</strong> để tích lũy dữ liệu.
              </p>
            </div>
          ) : (
            paginatedQuestions.map((q, idx) => {
              const isSelected = selectedIds.has(q.id);
              const typeInfo = QUESTION_TYPE_LABELS[q.type];
              const levelInfo = LEVEL_LABELS[q.level];
              const isDeleting = confirmDeleteId === q.id;

              return (
                <div
                  key={q.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isSelected
                      ? 'border-indigo-400 bg-indigo-50/20 ring-1 ring-indigo-300'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <button
                      type="button"
                      onClick={() => handleToggleSelect(q.id)}
                      className="mt-0.5 text-slate-400 hover:text-indigo-600 shrink-0"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-indigo-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-300" />
                      )}
                    </button>

                    {/* Nội dung câu hỏi */}
                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Metadata badges */}
                      <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                        <span className="font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                          #{((currentPage - 1) * pageSize) + idx + 1}
                        </span>
                        <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                          {q.subject}
                        </span>
                        {q.grade && (
                          <span className="font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            Lớp {q.grade}
                          </span>
                        )}
                        <span className="font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-300">
                          {typeInfo?.short || q.type}
                        </span>
                        <span
                          className={`font-bold px-1.5 py-0.5 rounded border ${
                            q.level === 'NB'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : q.level === 'TH'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : q.level === 'VD'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {levelInfo?.short || q.level}
                        </span>
                        <span className="font-bold text-blue-700">{q.score}đ</span>
                        <span
                          className={`px-1.5 py-0.5 rounded font-medium ${
                            q.source === 'GV'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {q.source === 'GV' ? 'GV biên soạn' : 'AI tạo'}
                        </span>
                        {q.topic && (
                          <span className="text-slate-500 italic max-w-xs truncate">
                            • {q.topic}
                          </span>
                        )}
                      </div>

                      {/* Text câu hỏi */}
                      <div className="text-xs sm:text-[13px] text-slate-900 font-serif leading-relaxed">
                        <MathText content={q.question} />
                      </div>

                      {/* Phương án MCQ */}
                      {q.options && q.options.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs font-serif text-slate-700 pt-1">
                          {q.options.map((opt, oIdx) => (
                            <div key={oIdx} className="bg-slate-50 p-1.5 rounded border border-slate-100">
                              <MathText content={opt} />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Đáp án & Lời giải */}
                      <div className="pt-1 flex items-center gap-3 text-xs flex-wrap">
                        <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Đáp án: {q.correctAnswer}
                        </span>
                        {q.explanation && (
                          <span className="text-[11px] text-slate-500 italic max-w-lg truncate">
                            Lời giải: {q.explanation}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Nhóm nút thao tác */}
                    <div className="flex items-center gap-1 shrink-0 pt-0.5">
                      <button
                        type="button"
                        onClick={() => setEditingQuestion(q)}
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-slate-200 transition-colors"
                        title="Chỉnh sửa câu hỏi này"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDuplicate(q.id)}
                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-slate-200 transition-colors"
                        title="Nhân bản câu hỏi này"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(q.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-200 transition-colors"
                        title="Xóa câu hỏi khỏi ngân hàng"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Hộp xác nhận xóa đơn lẻ */}
                  {isDeleting && (
                    <div className="mt-2.5 p-2 bg-rose-50 border border-rose-200 rounded-lg text-xs flex items-center justify-between text-rose-900 animate-in fade-in">
                      <span>Bạn có chắc chắn muốn xóa câu hỏi này khỏi ngân hàng?</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2.5 py-1 text-slate-600 bg-white border border-slate-300 rounded text-[11px]"
                        >
                          Hủy
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteOne(q.id)}
                          className="px-2.5 py-1 text-white bg-rose-600 hover:bg-rose-700 font-bold rounded text-[11px] shadow-2xs"
                        >
                          Xác nhận xóa
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* ========================================================= */}
        {/* PHÂN TRANG & FOOTER */}
        {/* ========================================================= */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="text-slate-500">
            Hiển thị {paginatedQuestions.length}/{filteredQuestions.length} câu (Tổng cộng: {questions.length} câu)
          </div>

          {/* Nút phân trang */}
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-semibold text-slate-800 px-2">
                Trang {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 font-medium text-slate-700"
          >
            Đóng
          </button>
        </div>
      </div>

      {/* Modal chỉnh sửa câu hỏi */}
      {editingQuestion && (
        <QuestionModal
          initialQuestion={editingQuestion}
          isNew={false}
          customTitle="Chỉnh sửa câu hỏi trong ngân hàng"
          customSubtitle="Nội dung chỉnh sửa sẽ được lưu trực tiếp vào ngân hàng câu hỏi."
          onSave={handleSaveEdit}
          onClose={() => setEditingQuestion(null)}
        />
      )}
    </div>
  );
};
