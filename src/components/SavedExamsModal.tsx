import React, { useState, useEffect } from 'react';
import {
  X,
  FolderOpen,
  Calendar,
  FileText,
  Copy,
  Trash2,
  Edit2,
  Check,
  Search,
  ExternalLink,
  AlertTriangle,
  Clock,
  Layers,
} from 'lucide-react';
import { Exam, SavedExamRecord } from '../types';
import {
  deleteSavedExamFromDb,
  duplicateSavedExam,
  getSavedExamsFromDb,
  isStorageFallbackActive,
  updateSavedExamTitle,
} from '../lib/storage';

interface SavedExamsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadExam: (exam: Exam) => void;
}

export const SavedExamsModal: React.FC<SavedExamsModalProps> = ({
  isOpen,
  onClose,
  onLoadExam,
}) => {
  const [exams, setExams] = useState<SavedExamRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const isFallback = isStorageFallbackActive();

  const loadExams = async () => {
    setIsLoading(true);
    try {
      const data = await getSavedExamsFromDb();
      setExams(data);
    } catch (e) {
      console.error('Lỗi khi tải danh sách đề:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadExams();
    }
  }, [isOpen]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleStartRename = (record: SavedExamRecord) => {
    setEditingId(record.id);
    setEditTitle(record.title);
  };

  const handleSaveRename = async (id: string) => {
    if (!editTitle.trim()) return;
    const ok = await updateSavedExamTitle(id, editTitle.trim());
    if (ok) {
      setExams((prev) =>
        prev.map((item) => (item.id === id ? { ...item, title: editTitle.trim() } : item))
      );
      showToast('Đã đổi tên đề thi');
    }
    setEditingId(null);
  };

  const handleDuplicate = async (id: string) => {
    const cloned = await duplicateSavedExam(id);
    if (cloned) {
      setExams((prev) => [cloned, ...prev]);
      showToast('Đã nhân bản đề thi thành công');
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await deleteSavedExamFromDb(id);
    if (ok) {
      setExams((prev) => prev.filter((item) => item.id !== id));
      showToast('Đã xóa đề thi');
    }
    setConfirmDeleteId(null);
  };

  const handleSelectExam = (record: SavedExamRecord) => {
    onLoadExam(record.exam);
    onClose();
  };

  if (!isOpen) return null;

  const filteredExams = exams.filter((e) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      e.title.toLowerCase().includes(q) ||
      e.subject.toLowerCase().includes(q) ||
      (e.grade ? `lớp ${e.grade}`.includes(q) : false)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full my-8 max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header Modal */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/90">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-900">Danh sách đề đã lưu</h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                  {exams.length} đề
                </span>
                {isFallback && (
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200"
                    title="IndexedDB không khả dụng trong môi trường hiện tại, dữ liệu đang được lưu tạm trên LocalStorage"
                  >
                    LocalStorage dự phòng
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Lưu trữ toàn bộ cấu hình, ma trận, câu hỏi và các mã đề hoán vị
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Thanh tìm kiếm & thông báo */}
        <div className="p-4 border-b border-slate-200 bg-white flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm theo tên đề, môn học, khối lớp..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {toastMsg && (
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg animate-in fade-in">
              {toastMsg}
            </span>
          )}
        </div>

        {/* Danh sách đề đã lưu */}
        <div className="p-5 flex-1 overflow-y-auto space-y-3 bg-slate-50/50">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Đang tải danh sách đề từ bộ nhớ...
            </div>
          ) : filteredExams.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <FileText className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-xs font-medium text-slate-600">
                {searchQuery ? 'Không tìm thấy đề thi phù hợp với từ khóa.' : 'Chưa có đề thi nào được lưu.'}
              </p>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                Sau khi sinh đề hoặc chỉnh sửa câu hỏi, thầy/cô bấm nút <strong>“Lưu đề”</strong> để lưu trữ lâu dài trong trình duyệt.
              </p>
            </div>
          ) : (
            filteredExams.map((record) => {
              const isEditing = editingId === record.id;
              const isDeleting = confirmDeleteId === record.id;

              return (
                <div
                  key={record.id}
                  className="p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-xs transition-all space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRename(record.id);
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                            autoFocus
                            className="flex-1 px-2.5 py-1 text-xs border border-blue-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveRename(record.id)}
                            className="p-1.5 text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                            title="Lưu tên mới"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg"
                            title="Hủy"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-slate-900 truncate">
                            {record.title}
                          </h4>
                          <button
                            type="button"
                            onClick={() => handleStartRename(record)}
                            className="p-1 text-slate-400 hover:text-blue-600 rounded"
                            title="Đổi tên đề"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      {/* Metadata badges */}
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap text-[11px] text-slate-500">
                        <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          {record.subject}
                        </span>
                        {record.grade && (
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 font-medium">
                            Lớp {record.grade}
                          </span>
                        )}
                        <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200 font-medium">
                          {record.questionCount} câu hỏi
                        </span>
                        {record.exam.versions && record.exam.versions.length > 0 && (
                          <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200 font-medium">
                            {record.exam.versions.length} mã đề
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-slate-400 ml-auto">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(record.updatedAt).toLocaleString('vi-VN')}</span>
                        </span>
                      </div>
                    </div>

                    {/* Nhóm nút thao tác */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleSelectExam(record)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-2xs transition-colors"
                        title="Tải đề này vào không gian làm việc"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Mở đề</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDuplicate(record.id)}
                        className="p-1.5 text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg border border-slate-200 bg-white transition-colors"
                        title="Nhân bản đề này"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(record.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-200 bg-white transition-colors"
                        title="Xóa đề này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Hộp xác nhận xóa */}
                  {isDeleting && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs flex items-center justify-between text-rose-900 animate-in fade-in">
                      <span>Bạn có chắc chắn muốn xóa vĩnh viễn đề <strong>"{record.title}"</strong>?</span>
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
                          onClick={() => handleDelete(record.id)}
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

        {/* Chân modal */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>Dữ liệu đề thi lưu trực tiếp trong trình duyệt bằng công nghệ IndexedDB.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 font-medium text-slate-700"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
