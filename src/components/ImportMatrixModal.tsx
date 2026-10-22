import React, { useState, useRef } from 'react';
import mammoth from 'mammoth';
import {
  FileSpreadsheet,
  UploadCloud,
  FileText,
  Image as ImageIcon,
  AlertTriangle,
  CheckCircle2,
  X,
  Plus,
  Trash2,
  Sparkles,
  RotateCcw,
  HelpCircle,
  Check,
  ArrowRight,
  Info,
} from 'lucide-react';
import { useExamStore } from '../store';
import { Level, MatrixCell, MatrixTopic, ParsedMatrix, QuestionType } from '../types';
import { parseMatrix } from '../services/gemini';
import { validateParsedMatrix, MatrixValidationAnalysis } from '../lib/matrix';
import { QUESTION_TYPE_LABELS } from '../config';

const AVAILABLE_QUESTION_TYPES: { type: QuestionType; label: string }[] = [
  { type: 'MCQ4', label: 'Trắc nghiệm 4 lựa chọn (MCQ4)' },
  { type: 'TRUE_FALSE', label: 'Trắc nghiệm Đúng / Sai (Đ/S)' },
  { type: 'SHORT_ANSWER', label: 'Trả lời ngắn (Điền số/từ)' },
  { type: 'ESSAY', label: 'Tự luận (Tự luận ngắn/dài)' },
  { type: 'MATCHING', label: 'Nối cột / Ghép cặp' },
  { type: 'FILL_BLANK', label: 'Điền khuyết / Điền từ' },
  { type: 'MCQ_MULTI', label: 'Nhiều lựa chọn đúng' },
];

const SAMPLE_MATRIX_TEXT = `Ma trận đề kiểm tra giữa học kỳ môn Toán lớp 10 - Thang điểm 10 - Tổng 22 câu
1. Mệnh đề và tập hợp | Chuẩn kiến thức GDPT 2018 | NB: 3 câu TN (0.75đ), TH: 2 câu TN (0.5đ), VD: 1 câu TL (0.5đ), VDC: 0 câu
2. Bất phương trình và hệ bất phương trình bậc nhất hai ẩn | Biểu diễn miền nghiệm | NB: 2 câu TN (0.5đ), TH: 2 câu TN (0.5đ), VD: 1 câu TL (1.0đ), VDC: 0 câu
3. Hàm số bậc hai và đồ thị | Khảo sát hàm số, parabol | NB: 3 câu TN (0.75đ), TH: 2 câu TN (0.5đ), VD: 1 câu TL (1.0đ), VDC: 1 câu TL (0.5đ)
4. Hệ thức lượng trong tam giác | Định lý sin, cos, công thức Heron | NB: 2 câu TN (0.5đ), TH: 1 câu TN (0.25đ), VD: 1 câu TL (0.75đ), VDC: 0 câu`;

export const ImportMatrixModal: React.FC = () => {
  const {
    isMatrixModalOpen,
    setIsMatrixModalOpen,
    applyImportedMatrixAction,
    config,
  } = useExamStore();

  const [activeInputTab, setActiveInputTab] = useState<'UPLOAD' | 'PASTE'>('UPLOAD');
  const [selectedFile, setSelectedFile] = useState<{
    file: File;
    name: string;
    sizeBytes: number;
    mimeType: string;
    base64?: string;
    text?: string;
  } | null>(null);

  const [pastedText, setPastedText] = useState<string>('');
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Ma trận đã đọc hoặc đang chỉnh sửa
  const [editingMatrix, setEditingMatrix] = useState<ParsedMatrix | null>(null);
  const [manualTotalPoints, setManualTotalPoints] = useState<string>('10');
  const [manualTotalQuestions, setManualTotalQuestions] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isMatrixModalOpen) return null;

  // Đọc file thành base64 cho ảnh & pdf
  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const commaIndex = result.indexOf(',');
        resolve(commaIndex !== -1 ? result.substring(commaIndex + 1) : result);
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  // Đọc file Word .docx bằng mammoth
  const readDocxAsText = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value || '';
  };

  // Đọc file TXT
  const readTxtAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (err) => reject(err);
      reader.readAsText(file, 'utf-8');
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setParseError(null);

    const lower = file.name.toLowerCase();
    if (lower.endsWith('.doc') && !lower.endsWith('.docx')) {
      setParseError('Định dạng .doc cũ không được hỗ trợ. Vui lòng lưu lại thành .docx trước khi tải lên.');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setParseError('Dung lượng file tối đa là 15 MB.');
      return;
    }

    try {
      if (lower.endsWith('.pdf') || file.type === 'application/pdf') {
        const base64 = await readFileAsBase64(file);
        setSelectedFile({ file, name: file.name, sizeBytes: file.size, mimeType: 'application/pdf', base64 });
      } else if (file.type.startsWith('image/')) {
        const base64 = await readFileAsBase64(file);
        setSelectedFile({ file, name: file.name, sizeBytes: file.size, mimeType: file.type || 'image/png', base64 });
      } else if (lower.endsWith('.docx')) {
        const text = await readDocxAsText(file);
        setSelectedFile({ file, name: file.name, sizeBytes: file.size, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', text });
      } else {
        const text = await readTxtAsText(file);
        setSelectedFile({ file, name: file.name, sizeBytes: file.size, mimeType: 'text/plain', text });
      }
    } catch (err: any) {
      setParseError(`Lỗi đọc file: ${err?.message || 'Không thể đọc nội dung file'}`);
    }
  };

  // Bắt đầu gọi parseMatrix qua Gemini
  const handleStartParsing = async () => {
    setParseError(null);
    const hasFile = Boolean(selectedFile);
    const hasText = Boolean(pastedText.trim());

    if (!hasFile && !hasText) {
      setParseError('Vui lòng tải lên một file ma trận hoặc dán bảng ma trận vào ô nhập.');
      return;
    }

    setIsParsing(true);
    try {
      const input = {
        text: hasText ? pastedText.trim() : undefined,
        file: hasFile && selectedFile ? {
          name: selectedFile.name,
          mimeType: selectedFile.mimeType,
          base64: selectedFile.base64,
          text: selectedFile.text,
        } : undefined,
      };

      const result = await parseMatrix(input);

      if (!result.topics || result.topics.length === 0) {
        throw new Error('AI không tìm thấy hàng hoặc ô ma trận nào trong tài liệu được cung cấp.');
      }

      // Đảm bảo mỗi topic đều có đủ 4 ô NB, TH, VD, VDC
      const normalizedTopics = result.topics.map((t) => {
        const levels: Level[] = ['NB', 'TH', 'VD', 'VDC'];
        const existingCells = t.cells || [];
        const fullCells: MatrixCell[] = levels.map((lvl) => {
          const found = existingCells.find((c) => c.level === lvl);
          return (
            found || {
              level: lvl,
              questionType: 'MCQ4',
              count: 0,
              points: undefined,
            }
          );
        });
        return {
          ...t,
          cells: fullCells,
        };
      });

      const finalMatrix: ParsedMatrix = {
        totalPoints: result.totalPoints !== undefined ? result.totalPoints : 10,
        totalQuestions: result.totalQuestions,
        topics: normalizedTopics,
        warnings: result.warnings || [],
      };

      setEditingMatrix(finalMatrix);
      if (finalMatrix.totalPoints) {
        setManualTotalPoints(String(finalMatrix.totalPoints));
      }
      if (finalMatrix.totalQuestions) {
        setManualTotalQuestions(String(finalMatrix.totalQuestions));
      }
    } catch (err: any) {
      console.error('Lỗi phân tích ma trận:', err);
      setParseError(err?.message || 'Không thể đọc ma trận từ tài liệu. Vui lòng kiểm tra lại file hoặc dán dạng bảng.');
    } finally {
      setIsParsing(false);
    }
  };

  // Cập nhật ô dữ liệu trong bảng ma trận
  const handleUpdateCell = (
    topicIdx: number,
    cellLevel: Level,
    field: 'count' | 'points' | 'questionType',
    value: any
  ) => {
    if (!editingMatrix) return;
    const newTopics = [...editingMatrix.topics];
    const topic = { ...newTopics[topicIdx] };
    const newCells = topic.cells.map((c) => {
      if (c.level === cellLevel) {
        if (field === 'count') {
          const num = parseInt(value, 10);
          return { ...c, count: isNaN(num) ? 0 : Math.max(0, num) };
        }
        if (field === 'points') {
          if (value === '' || value === undefined) {
            return { ...c, points: undefined };
          }
          const p = parseFloat(value);
          return { ...c, points: isNaN(p) ? undefined : Math.max(0, p) };
        }
        if (field === 'questionType') {
          return { ...c, questionType: value as QuestionType };
        }
      }
      return c;
    });
    topic.cells = newCells;
    newTopics[topicIdx] = topic;

    setEditingMatrix({
      ...editingMatrix,
      topics: newTopics,
    });
  };

  // Đổi tên hoặc yêu cầu cần đạt của chủ đề
  const handleUpdateTopicMeta = (topicIdx: number, field: 'name' | 'requirement', val: string) => {
    if (!editingMatrix) return;
    const newTopics = [...editingMatrix.topics];
    newTopics[topicIdx] = {
      ...newTopics[topicIdx],
      [field]: val,
    };
    setEditingMatrix({
      ...editingMatrix,
      topics: newTopics,
    });
  };

  // Thêm chủ đề mới
  const handleAddTopic = () => {
    if (!editingMatrix) return;
    const newTopic: MatrixTopic = {
      id: `topic_${Date.now()}`,
      name: `Chủ đề ${editingMatrix.topics.length + 1}`,
      requirement: '',
      cells: [
        { level: 'NB', questionType: 'MCQ4', count: 1, points: undefined },
        { level: 'TH', questionType: 'MCQ4', count: 1, points: undefined },
        { level: 'VD', questionType: 'MCQ4', count: 0, points: undefined },
        { level: 'VDC', questionType: 'MCQ4', count: 0, points: undefined },
      ],
    };
    setEditingMatrix({
      ...editingMatrix,
      topics: [...editingMatrix.topics, newTopic],
    });
  };

  // Xóa chủ đề
  const handleRemoveTopic = (idx: number) => {
    if (!editingMatrix) return;
    if (editingMatrix.topics.length <= 1) {
      alert('Ma trận phải có ít nhất 1 chủ đề kiến thức.');
      return;
    }
    const newTopics = editingMatrix.topics.filter((_, i) => i !== idx);
    setEditingMatrix({
      ...editingMatrix,
      topics: newTopics,
    });
  };

  // Cập nhật tổng điểm và tổng câu kỳ vọng
  const handleUpdateTotalsMeta = (totPoints?: number, totQuestions?: number) => {
    if (!editingMatrix) return;
    setEditingMatrix({
      ...editingMatrix,
      totalPoints: totPoints,
      totalQuestions: totQuestions,
    });
  };

  // Tự động phân bổ lại điểm nếu người dùng muốn chia đều
  const handleAutoDistributePoints = () => {
    if (!editingMatrix) return;
    const target = parseFloat(manualTotalPoints) || editingMatrix.totalPoints || 10;
    const totalQuestions = editingMatrix.topics.reduce(
      (acc, t) => acc + t.cells.reduce((ca, c) => ca + (c.count || 0), 0),
      0
    );
    if (totalQuestions <= 0) return;

    const pointPerQ = Number((target / totalQuestions).toFixed(2));
    const newTopics = editingMatrix.topics.map((t) => ({
      ...t,
      cells: t.cells.map((c) => ({
        ...c,
        points: c.count > 0 ? Number((c.count * pointPerQ).toFixed(2)) : undefined,
      })),
    }));

    setEditingMatrix({
      ...editingMatrix,
      totalPoints: target,
      topics: newTopics,
    });
  };

  // Phân tích kiểm tra code
  const validation: MatrixValidationAnalysis | null = editingMatrix
    ? validateParsedMatrix(editingMatrix)
    : null;

  // Áp dụng ma trận vào đề
  const handleApplyMatrix = () => {
    if (!editingMatrix || !validation || !validation.isValid) return;
    applyImportedMatrixAction(editingMatrix);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header Modal */}
        <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white shadow-inner backdrop-blur-xs">
              <FileSpreadsheet className="w-5 h-5 text-blue-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">Tạo từ ma trận có sẵn</h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/30 text-blue-100 border border-blue-400/30">
                  AI Trích xuất & Code Kiểm toán
                </span>
              </div>
              <p className="text-xs text-blue-100/90 mt-0.5">
                Tải file (PDF, Word, Ảnh, TXT) hoặc dán bảng ma trận. AI giữ nguyên trạng con số, kiểm tra khớp 100% trước khi nạp.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsMatrixModalOpen(false)}
            className="p-1.5 text-blue-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nội dung chính Modal */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-slate-50/50">
          {!editingMatrix ? (
            /* Bước 1: Nạp file hoặc dán bảng ma trận */
            <div className="space-y-5 max-w-3xl mx-auto py-2">
              {/* Chọn phương thức nạp */}
              <div className="flex items-center justify-center gap-2 p-1 bg-slate-200/70 rounded-xl max-w-md mx-auto">
                <button
                  type="button"
                  onClick={() => setActiveInputTab('UPLOAD')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                    activeInputTab === 'UPLOAD'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Tải file ma trận</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveInputTab('PASTE')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                    activeInputTab === 'PASTE'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Dán bảng ma trận</span>
                </button>
              </div>

              {parseError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-800 text-xs">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Lỗi đọc ma trận: </span>
                    <span>{parseError}</span>
                  </div>
                </div>
              )}

              {activeInputTab === 'UPLOAD' ? (
                /* Tab Tải file */
                <div className="space-y-4">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-white hover:bg-blue-50/30 rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center group"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.docx,.png,.jpg,.jpeg,.txt"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <div className="w-14 h-14 rounded-2xl bg-blue-50 group-hover:bg-blue-100 text-blue-600 flex items-center justify-center mb-3 transition-colors">
                      <UploadCloud className="w-7 h-7" />
                    </div>
                    <div className="text-sm font-bold text-slate-800 group-hover:text-blue-700">
                      Nhấp để chọn file hoặc kéo thả tài liệu vào đây
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Hỗ trợ PDF, Word (.docx), Ảnh (.png, .jpg), hoặc file Text (.txt) - Tối đa 15 MB
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2 justify-center text-[11px] text-slate-600 font-medium">
                      <span className="px-2 py-0.5 bg-slate-100 rounded-md border border-slate-200">PDF ma trận</span>
                      <span className="px-2 py-0.5 bg-slate-100 rounded-md border border-slate-200">Word .docx</span>
                      <span className="px-2 py-0.5 bg-slate-100 rounded-md border border-slate-200">Ảnh chụp ma trận</span>
                      <span className="px-2 py-0.5 bg-slate-100 rounded-md border border-slate-200">Bản đặc tả TXT</span>
                    </div>
                  </div>

                  {selectedFile && (
                    <div className="p-3.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between shadow-2xs">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                          {selectedFile.mimeType.includes('pdf')
                            ? 'PDF'
                            : selectedFile.mimeType.includes('word') || selectedFile.name.endsWith('.docx')
                            ? 'DOCX'
                            : selectedFile.mimeType.startsWith('image/')
                            ? 'IMG'
                            : 'TXT'}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-800 truncate max-w-md">
                            {selectedFile.name}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {(selectedFile.sizeBytes / 1024).toFixed(1)} KB • Sẵn sàng để AI phân tích
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedFile(null)}
                        className="text-xs text-rose-600 hover:text-rose-800 p-1.5 hover:bg-rose-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* Tab Dán bảng ma trận */
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700">
                      Nội dung bảng ma trận sao chép từ Word / Excel:
                    </label>
                    <button
                      type="button"
                      onClick={() => setPastedText(SAMPLE_MATRIX_TEXT)}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 hover:underline"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Dán mẫu ma trận thử nghiệm
                    </button>
                  </div>
                  <textarea
                    rows={8}
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder="Sao chép bảng ma trận từ Microsoft Word hoặc Excel rồi dán vào đây...
Ví dụ:
Chủ đề 1: Mệnh đề - NB: 2 câu TN (0.5đ), TH: 2 câu TN (0.5đ), VD: 1 câu TL (0.5đ)
Chủ đề 2: Tập hợp - NB: 3 câu TN (0.75đ), TH: 1 câu TN (0.25đ)..."
                    className="w-full text-xs font-mono p-3.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white"
                  />
                  <p className="text-[11px] text-slate-500">
                    Mẹo: Bạn có thể chọn toàn bộ bảng trong file Word/Excel và nhấn Ctrl+C, sau đó dán vào khung trên. AI sẽ tự động bóc tách từng hàng chủ đề và từng mức độ nhận thức.
                  </p>
                </div>
              )}

              {/* Nút Đọc ma trận */}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  disabled={isParsing || (!selectedFile && !pastedText.trim())}
                  onClick={handleStartParsing}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-semibold rounded-xl text-xs shadow-md transition-all cursor-pointer disabled:cursor-not-allowed"
                >
                  {isParsing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Đang đọc và phân tích ma trận...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Đọc ma trận bằng AI</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Bước 2: Hiển thị ma trận vừa đọc dưới dạng bảng có thể sửa tay từng ô */
            <div className="space-y-4">
              {/* Thanh điều khiển trên cùng */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">Thông số ma trận gốc:</span>
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                    <span>Thang điểm:</span>
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      max="100"
                      value={manualTotalPoints}
                      onChange={(e) => {
                        setManualTotalPoints(e.target.value);
                        handleUpdateTotalsMeta(parseFloat(e.target.value) || undefined, editingMatrix.totalQuestions);
                      }}
                      className="w-14 text-center font-bold text-slate-800 bg-white border border-slate-300 rounded px-1 py-0.5 focus:outline-none"
                    />
                    <span>điểm</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                    <span>Tổng số câu:</span>
                    <input
                      type="number"
                      min="1"
                      value={manualTotalQuestions}
                      placeholder="Tùy chọn"
                      onChange={(e) => {
                        setManualTotalQuestions(e.target.value);
                        handleUpdateTotalsMeta(editingMatrix.totalPoints, parseInt(e.target.value, 10) || undefined);
                      }}
                      className="w-16 text-center font-bold text-slate-800 bg-white border border-slate-300 rounded px-1 py-0.5 focus:outline-none"
                    />
                    <span>câu</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAutoDistributePoints}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium border border-slate-200 transition-colors"
                    title="Chia đều điểm theo tổng điểm cho tất cả các câu đã có"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
                    <span>Chia đều điểm</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleAddTopic}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold border border-blue-200 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm chủ đề</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Quay lại màn hình nạp file? Dữ liệu đang chỉnh sửa sẽ bị xóa.')) {
                        setEditingMatrix(null);
                        setSelectedFile(null);
                        setPastedText('');
                      }
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-medium border border-slate-200"
                  >
                    <span>Đổi tài liệu khác</span>
                  </button>
                </div>
              </div>

              {/* Cảnh báo từ AI nếu có */}
              {editingMatrix.warnings && editingMatrix.warnings.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-amber-800 mb-0.5">
                      Cảnh báo từ quá trình đọc ma trận ({editingMatrix.warnings.length} lưu ý):
                    </div>
                    <ul className="list-disc list-inside space-y-0.5 text-amber-700">
                      {editingMatrix.warnings.map((w, idx) => (
                        <li key={idx}>{w}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Bảng chỉnh sửa ma trận 2 chiều */}
              <div className="border border-slate-300 rounded-xl overflow-hidden bg-white shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100/90 text-slate-700 border-b border-slate-300">
                        <th className="py-2.5 px-3 text-left font-bold w-12 border-r border-slate-200">
                          STT
                        </th>
                        <th className="py-2.5 px-3 text-left font-bold min-w-[220px] border-r border-slate-200">
                          Chủ đề kiến thức & Yêu cầu cần đạt
                        </th>
                        <th className="py-2.5 px-3 text-center font-bold min-w-[130px] border-r border-slate-200 bg-blue-50/50 text-blue-900">
                          Nhận biết (NB)
                        </th>
                        <th className="py-2.5 px-3 text-center font-bold min-w-[130px] border-r border-slate-200 bg-emerald-50/50 text-emerald-900">
                          Thông hiểu (TH)
                        </th>
                        <th className="py-2.5 px-3 text-center font-bold min-w-[130px] border-r border-slate-200 bg-amber-50/50 text-amber-900">
                          Vận dụng (VD)
                        </th>
                        <th className="py-2.5 px-3 text-center font-bold min-w-[130px] border-r border-slate-200 bg-purple-50/50 text-purple-900">
                          Vận dụng cao (VDC)
                        </th>
                        <th className="py-2.5 px-3 text-center font-bold min-w-[100px] border-r border-slate-200 bg-slate-200/60">
                          Tổng hàng
                        </th>
                        <th className="py-2.5 px-2 text-center font-bold w-12">
                          Xóa
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {editingMatrix.topics.map((topic, tIdx) => {
                        const rowStat = validation?.rowTotals[tIdx] || { count: 0, points: 0 };
                        return (
                          <tr key={topic.id || tIdx} className="hover:bg-slate-50/80 transition-colors">
                            {/* STT */}
                            <td className="py-2.5 px-3 font-semibold text-slate-500 text-center border-r border-slate-200">
                              {tIdx + 1}
                            </td>

                            {/* Tên chủ đề & Yêu cầu cần đạt */}
                            <td className="py-2.5 px-3 border-r border-slate-200 space-y-1.5">
                              <input
                                type="text"
                                value={topic.name}
                                onChange={(e) => handleUpdateTopicMeta(tIdx, 'name', e.target.value)}
                                placeholder="Tên chủ đề / chương..."
                                className={`w-full font-semibold text-slate-800 border rounded px-2 py-1 text-xs focus:outline-none ${
                                  !topic.name.trim() ? 'border-rose-400 bg-rose-50/50' : 'border-slate-300 bg-white'
                                }`}
                              />
                              <input
                                type="text"
                                value={topic.requirement || ''}
                                onChange={(e) => handleUpdateTopicMeta(tIdx, 'requirement', e.target.value)}
                                placeholder="Yêu cầu cần đạt (nếu có)..."
                                className="w-full text-[11px] text-slate-500 border border-slate-200 rounded px-2 py-0.5 bg-slate-50 focus:bg-white focus:outline-none"
                              />
                            </td>

                            {/* 4 Mức độ: NB, TH, VD, VDC */}
                            {(['NB', 'TH', 'VD', 'VDC'] as Level[]).map((lvl) => {
                              const cell = topic.cells.find((c) => c.level === lvl) || {
                                level: lvl,
                                questionType: 'MCQ4',
                                count: 0,
                                points: undefined,
                              };
                              const cellKey = `${tIdx}_${topic.cells.findIndex((c) => c.level === lvl)}`;
                              const cellError = validation?.cellErrors[cellKey];

                              return (
                                <td
                                  key={lvl}
                                  className={`py-2 px-2.5 border-r border-slate-200 align-top ${
                                    cellError
                                      ? 'bg-rose-50/80 border-rose-300'
                                      : cell.count > 0
                                      ? 'bg-white'
                                      : 'bg-slate-50/40 text-slate-400'
                                  }`}
                                >
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] text-slate-500 font-medium">Số câu:</span>
                                      <input
                                        type="number"
                                        min="0"
                                        value={cell.count}
                                        onChange={(e) => handleUpdateCell(tIdx, lvl, 'count', e.target.value)}
                                        className={`w-12 text-center font-bold text-xs border rounded px-1 py-0.5 focus:outline-none ${
                                          cellError ? 'border-rose-500 bg-rose-50' : 'border-slate-300 bg-white'
                                        }`}
                                      />
                                    </div>

                                    {/* Điểm của ô */}
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] text-slate-500 font-medium">Điểm:</span>
                                      <input
                                        type="number"
                                        step="0.05"
                                        min="0"
                                        placeholder="Tự chia"
                                        value={cell.points !== undefined ? cell.points : ''}
                                        onChange={(e) => handleUpdateCell(tIdx, lvl, 'points', e.target.value)}
                                        className="w-16 text-center text-[11px] font-medium border border-slate-200 rounded px-1 py-0.5 focus:outline-none bg-white placeholder:text-[10px] placeholder:text-slate-400"
                                      />
                                      <span className="text-[10px] text-slate-400">đ</span>
                                    </div>

                                    {/* Dạng câu hỏi (dropdown cho phép GV đổi dạng nếu ma trận chỉ ghi chung Trắc nghiệm) */}
                                    <div>
                                      <select
                                        value={cell.questionType || 'MCQ4'}
                                        onChange={(e) => handleUpdateCell(tIdx, lvl, 'questionType', e.target.value)}
                                        className="w-full text-[10px] py-0.5 px-1 font-medium bg-slate-50 border border-slate-200 rounded text-slate-700 focus:outline-none"
                                        title="Đổi định dạng câu hỏi cho ô này"
                                      >
                                        {AVAILABLE_QUESTION_TYPES.map((qt) => (
                                          <option key={qt.type} value={qt.type}>
                                            {qt.type} - {QUESTION_TYPE_LABELS[qt.type]?.short || qt.label}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    {cellError && (
                                      <div className="text-[10px] text-rose-600 font-semibold">{cellError}</div>
                                    )}
                                  </div>
                                </td>
                              );
                            })}

                            {/* Tổng hàng */}
                            <td className="py-2.5 px-3 border-r border-slate-200 text-center font-bold bg-slate-50/70">
                              <div className="text-xs text-slate-800">{rowStat.count} câu</div>
                              {rowStat.points > 0 && (
                                <div className="text-[11px] text-blue-700 font-semibold">{rowStat.points} đ</div>
                              )}
                            </td>

                            {/* Xóa hàng */}
                            <td className="py-2.5 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveTopic(tIdx)}
                                className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors"
                                title="Xóa chủ đề này"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>

                    {/* Dòng tổng cộng (Footer) */}
                    <tfoot>
                      <tr className="bg-slate-100 font-bold text-slate-800 border-t-2 border-slate-300">
                        <td colSpan={2} className="py-2.5 px-3 text-right border-r border-slate-300">
                          Tổng cộng toàn bài:
                        </td>
                        {(['NB', 'TH', 'VD', 'VDC'] as Level[]).map((lvl) => {
                          const col = validation?.colTotals[lvl] || { count: 0, points: 0, percent: 0 };
                          return (
                            <td key={lvl} className="py-2.5 px-2.5 text-center border-r border-slate-300 bg-slate-100/90">
                              <div className="text-xs text-slate-900">{col.count} câu</div>
                              <div className="text-[11px] text-slate-600 font-normal">
                                {col.points > 0 ? `${col.points}đ • ` : ''}
                                <span className="font-semibold text-blue-700">{col.percent}%</span>
                              </div>
                            </td>
                          );
                        })}
                        <td className="py-2.5 px-3 text-center border-r border-slate-300 bg-blue-50/80">
                          <div className="text-sm font-extrabold text-blue-900">
                            {validation?.grandTotal.count || 0} câu
                          </div>
                          <div className="text-xs font-bold text-blue-700">
                            {validation?.grandTotal.points || 0} đ • 100%
                          </div>
                        </td>
                        <td className="bg-slate-100"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Khung Xác nhận bằng Code & Thông báo lỗi / hợp lệ */}
              {validation && (
                <div
                  className={`p-4 rounded-xl border flex items-start gap-3 transition-colors ${
                    validation.isValid
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                      : 'bg-rose-50 border-rose-300 text-rose-900'
                  }`}
                >
                  {validation.isValid ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  )}

                  <div className="flex-1 space-y-1">
                    <div className="text-xs font-bold flex items-center justify-between">
                      <span>
                        {validation.isValid
                          ? 'Xác nhận bằng code: Ma trận hoàn toàn hợp lệ!'
                          : 'Xác nhận bằng code: Ma trận chưa hợp lệ (Chưa cho dùng cho đến khi hợp lệ)'}
                      </span>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-white/80">
                        {validation.isValid ? 'Hợp lệ ✓' : 'Cần sửa ô màu đỏ'}
                      </span>
                    </div>

                    {validation.isValid ? (
                      <p className="text-xs text-emerald-700">
                        Tổng hàng, tổng cột, tổng số câu ({validation.grandTotal.count} câu) và tổng tỷ lệ 100% đã khớp hoàn hảo. Khi bấm &ldquo;Dùng ma trận này&rdquo;, hệ thống sẽ dựng đúng từng ô (chủ đề × mức × dạng) theo ma trận.
                      </p>
                    ) : (
                      <div className="space-y-1 text-xs text-rose-700">
                        <p className="font-medium">Vui lòng điều chỉnh các ô dữ liệu trước khi tiếp tục:</p>
                        <ul className="list-disc list-inside space-y-0.5 pl-1">
                          {validation.errors.map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Modal với nút hành động */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-blue-600" />
            <span>AI trích xuất nguyên trạng; Code xác thực tính toàn vẹn 100%.</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsMatrixModalOpen(false)}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-xl text-xs border border-slate-300 transition-colors"
            >
              Đóng
            </button>

            {editingMatrix && (
              <button
                type="button"
                disabled={!validation?.isValid}
                onClick={handleApplyMatrix}
                className={`inline-flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-bold shadow-md transition-all ${
                  validation?.isValid
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer hover:shadow-lg'
                    : 'bg-slate-300 text-slate-500 cursor-not-allowed border border-slate-300'
                }`}
                title={
                  validation?.isValid
                    ? 'Nạp ma trận vào cấu hình đề thi'
                    : 'Chưa cho dùng cho đến khi ma trận hợp lệ'
                }
              >
                <Check className="w-4 h-4" />
                <span>Dùng ma trận này</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
