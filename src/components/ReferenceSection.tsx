import React, { useState, useRef } from 'react';
import mammoth from 'mammoth';
import {
  UploadCloud,
  FileText,
  FileCode,
  Image as ImageIcon,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Plus,
  Layers,
  FileCheck,
  Eye,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useExamStore } from '../store';
import {
  KnowledgeSource,
  ReferenceDoc,
  ReferenceDocKind,
  ReferenceSnippet,
  ReferenceSnippetType,
} from '../types';

export const ReferenceSection: React.FC = () => {
  const { config, updateConfig } = useExamStore();

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Trạng thái cho việc dán đoạn văn bản mới
  const [snippetType, setSnippetType] = useState<ReferenceSnippetType>('SGK');
  const [snippetTitle, setSnippetTitle] = useState<string>('');
  const [snippetContent, setSnippetContent] = useState<string>('');
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const referenceDocs = config.referenceDocs || [];
  const referenceSnippets = config.referenceSnippets || [];

  // Tính tổng dung lượng hiện tại của các file
  const totalSizeBytes = referenceDocs.reduce((acc, d) => acc + (d.sizeBytes || 0), 0);
  const maxTotalBytes = 20 * 1024 * 1024; // 20 MB
  const maxFileBytes = 10 * 1024 * 1024; // 10 MB

  // Đọc file thành base64 thuần (bỏ tiền tố data:...;base64,)
  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const commaIndex = result.indexOf(',');
        if (commaIndex !== -1) {
          resolve(result.substring(commaIndex + 1));
        } else {
          resolve(result);
        }
      };
      reader.onerror = (error) => reject(error);
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
      reader.onerror = (error) => reject(error);
      reader.readAsText(file, 'utf-8');
    });
  };

  // Xử lý nạp danh sách file
  const processFiles = async (files: FileList | File[]) => {
    setErrorMessage(null);
    setIsProcessing(true);

    const newDocs: ReferenceDoc[] = [];
    let runningTotalBytes = totalSizeBytes;

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const lowerName = file.name.toLowerCase();

        // 1. Kiểm tra file .doc cũ
        if (lowerName.endsWith('.doc') && !lowerName.endsWith('.docx')) {
          setErrorMessage(`File "${file.name}": Định dạng .doc cũ không được hỗ trợ. Vui lòng lưu lại thành .docx`);
          continue;
        }

        // 2. Kiểm tra dung lượng từng file (tối đa 10 MB)
        if (file.size > maxFileBytes) {
          setErrorMessage(`File "${file.name}" dung lượng ${(file.size / (1024 * 1024)).toFixed(1)} MB vượt quá giới hạn 10 MB.`);
          continue;
        }

        // 3. Kiểm tra tổng dung lượng tích lũy (tối đa 20 MB)
        if (runningTotalBytes + file.size > maxTotalBytes) {
          setErrorMessage(`Tổng dung lượng tài liệu vượt quá giới hạn 20 MB. Đã dừng nạp thêm file "${file.name}".`);
          break;
        }

        runningTotalBytes += file.size;
        const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

        // Phân loại và đọc file
        if (lowerName.endsWith('.pdf') || file.type === 'application/pdf') {
          const base64 = await readFileAsBase64(file);
          newDocs.push({
            id: docId,
            name: file.name,
            kind: 'PDF',
            mimeType: 'application/pdf',
            sizeBytes: file.size,
            base64,
          });
        } else if (
          file.type.startsWith('image/') ||
          lowerName.endsWith('.png') ||
          lowerName.endsWith('.jpg') ||
          lowerName.endsWith('.jpeg') ||
          lowerName.endsWith('.webp')
        ) {
          const mime = file.type || (lowerName.endsWith('.png') ? 'image/png' : 'image/jpeg');
          const base64 = await readFileAsBase64(file);
          newDocs.push({
            id: docId,
            name: file.name,
            kind: 'IMAGE',
            mimeType: mime,
            sizeBytes: file.size,
            base64,
          });
        } else if (lowerName.endsWith('.docx')) {
          try {
            const extractedText = await readDocxAsText(file);
            newDocs.push({
              id: docId,
              name: file.name,
              kind: 'DOCX',
              mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              sizeBytes: file.size,
              text: extractedText,
            });
          } catch (err) {
            console.error('Lỗi khi đọc file Word:', err);
            setErrorMessage(`Không thể đọc nội dung file Word "${file.name}".`);
          }
        } else if (lowerName.endsWith('.txt') || file.type === 'text/plain') {
          const text = await readTxtAsText(file);
          newDocs.push({
            id: docId,
            name: file.name,
            kind: 'TXT',
            mimeType: 'text/plain',
            sizeBytes: file.size,
            text,
          });
        } else {
          setErrorMessage(`File "${file.name}": Định dạng chưa được hỗ trợ. Vui lòng chỉ chọn PDF, Word (.docx), TXT hoặc Ảnh.`);
        }
      }

      if (newDocs.length > 0) {
        updateConfig({
          referenceDocs: [...referenceDocs, ...newDocs],
        });
      }
    } catch (error) {
      console.error('Lỗi nạp file:', error);
      setErrorMessage('Đã xảy ra lỗi trong quá trình xử lý file tài liệu.');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Xóa một file đã tải
  const handleDeleteDoc = (id: string) => {
    updateConfig({
      referenceDocs: referenceDocs.filter((d) => d.id !== id),
    });
  };

  // Thêm đoạn văn bản dán
  const handleAddSnippet = () => {
    if (!snippetContent.trim()) return;

    const newSnippet: ReferenceSnippet = {
      id: `snip_${Date.now()}`,
      type: snippetType,
      title: snippetTitle.trim() || undefined,
      content: snippetContent.trim(),
      createdAt: new Date().toISOString(),
    };

    updateConfig({
      referenceSnippets: [...referenceSnippets, newSnippet],
    });

    setSnippetTitle('');
    setSnippetContent('');
  };

  // Xóa một đoạn văn bản dán
  const handleDeleteSnippet = (id: string) => {
    updateConfig({
      referenceSnippets: referenceSnippets.filter((s) => s.id !== id),
    });
  };

  // Thay đổi nguồn kiến thức (radio)
  const handleKnowledgeSourceChange = (source: KnowledgeSource) => {
    updateConfig({ knowledgeSource: source });
  };

  // Kiểm tra cảnh báo UPLOAD_ONLY khi không có dữ liệu
  const isUploadOnly = config.knowledgeSource === 'UPLOAD_ONLY';
  const hasUploadedContent =
    referenceDocs.length > 0 ||
    referenceSnippets.length > 0 ||
    Boolean(config.rawLessonContent && config.rawLessonContent.trim().length > 0);
  const showUploadOnlyWarning = isUploadOnly && !hasUploadedContent;

  const SNIPPET_TYPE_OPTIONS: { value: ReferenceSnippetType; label: string }[] = [
    { value: 'SGK', label: 'Sách giáo khoa' },
    { value: 'GIAO_AN', label: 'Giáo án / Kế hoạch' },
    { value: 'MA_TRAN_CU', label: 'Ma trận / Đề cũ' },
    { value: 'NGU_LIEU', label: 'Ngữ liệu đọc hiểu' },
    { value: 'OTHER', label: 'Khác' },
  ];

  return (
    <section className="space-y-4 pt-3 border-t border-slate-200">
      {/* Tiêu đề mục */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
            <Layers className="w-3.5 h-3.5" />
          </span>
          <h3 className="font-semibold text-slate-800 text-sm">
            Tài liệu tham chiếu & Nguồn đề
          </h3>
        </div>

        {referenceDocs.length > 0 || referenceSnippets.length > 0 ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" />
            {referenceDocs.length} file • {referenceSnippets.length} đoạn trích
          </span>
        ) : null}
      </div>

      <div className="space-y-4 bg-slate-50/70 p-4 rounded-xl border border-slate-200 text-xs">
        {/* ========================================================= */}
        {/* 1. TẢI FILE (KÉO THẢ HOẶC CHỌN NHIỀU FILE) */}
        {/* ========================================================= */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="font-semibold text-slate-700">
              1. Tải file tài liệu (PDF, Word .docx, TXT, Ảnh PNG/JPG):
            </label>
            <span className="text-[11px] text-slate-500">
              {(totalSizeBytes / (1024 * 1024)).toFixed(1)} / 20 MB
            </span>
          </div>

          {/* Vùng kéo thả file */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                processFiles(e.dataTransfer.files);
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
              isDragging
                ? 'border-blue-500 bg-blue-50/70'
                : 'border-slate-300 hover:border-blue-400 bg-white'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.doc,.txt,image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  processFiles(e.target.files);
                }
              }}
            />

            <UploadCloud className="w-7 h-7 mx-auto text-blue-600 mb-1.5" />
            <p className="text-xs font-semibold text-slate-700">
              Kéo thả file vào đây hoặc <span className="text-blue-600 underline">bấm để chọn file</span>
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Hỗ trợ PDF, Word (.docx), TXT, Ảnh. Tối đa 10 MB/file, tổng 20 MB.
            </p>
          </div>

          {/* Trạng thái xử lý file */}
          {isProcessing && (
            <div className="mt-2 text-blue-600 flex items-center gap-1.5">
              <span className="inline-block w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span>Đang đọc và trích xuất nội dung file...</span>
            </div>
          )}

          {/* Thông báo lỗi nếu có */}
          {errorMessage && (
            <div className="mt-2 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Danh sách file đã tải */}
          {referenceDocs.length > 0 && (
            <div className="mt-3 space-y-2">
              <span className="font-semibold text-slate-700 text-[11px] block">
                Danh sách file đã nạp ({referenceDocs.length}):
              </span>

              {referenceDocs.map((doc) => {
                const isExpanded = expandedDocId === doc.id;
                const sizeText =
                  doc.sizeBytes > 1024 * 1024
                    ? `${(doc.sizeBytes / (1024 * 1024)).toFixed(1)} MB`
                    : `${(doc.sizeBytes / 1024).toFixed(1)} KB`;

                return (
                  <div
                    key={doc.id}
                    className="p-2.5 bg-white rounded-lg border border-slate-200 flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {doc.kind === 'PDF' && <FileCheck className="w-4 h-4 text-red-500 shrink-0" />}
                        {doc.kind === 'DOCX' && <FileText className="w-4 h-4 text-blue-600 shrink-0" />}
                        {doc.kind === 'TXT' && <FileCode className="w-4 h-4 text-slate-600 shrink-0" />}
                        {doc.kind === 'IMAGE' && <ImageIcon className="w-4 h-4 text-emerald-600 shrink-0" />}

                        <span className="font-medium text-slate-800 truncate" title={doc.name}>
                          {doc.name}
                        </span>

                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded shrink-0">
                          {doc.kind} • {sizeText}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {(doc.text || doc.base64) && (
                          <button
                            type="button"
                            onClick={() => setExpandedDocId(isExpanded ? null : doc.id)}
                            className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors"
                            title="Xem trước nội dung"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteDoc(doc.id)}
                          className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                          title="Xóa tài liệu này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Vùng xem trước: Ảnh thu nhỏ hoặc 300 ký tự đầu văn bản */}
                    {isExpanded && (
                      <div className="p-2 bg-slate-50 rounded border border-slate-200 text-[11px] text-slate-600 space-y-1.5">
                        {doc.kind === 'IMAGE' && doc.base64 && (
                          <div className="flex items-center gap-3">
                            <img
                              src={`data:${doc.mimeType};base64,${doc.base64}`}
                              alt={doc.name}
                              className="w-20 h-20 object-cover rounded border border-slate-200 shadow-2xs"
                            />
                            <p className="text-slate-500 italic">
                              Ảnh đã được mã hóa Base64 và sẵn sàng chuyển tiếp tới Gemini AI.
                            </p>
                          </div>
                        )}

                        {doc.kind === 'PDF' && (
                          <p className="text-slate-600">
                            📄 <strong>File PDF</strong>: Đã mã hóa Base64 (chuẩn bị gửi inlineData nguyên bản cho Gemini).
                          </p>
                        )}

                        {(doc.kind === 'DOCX' || doc.kind === 'TXT') && doc.text && (
                          <div>
                            <div className="font-semibold text-slate-700 mb-0.5">
                              Xem trước (300 ký tự đầu):
                            </div>
                            <div className="font-mono bg-white p-2 rounded border border-slate-200 whitespace-pre-wrap leading-relaxed">
                              {doc.text.slice(0, 300)}
                              {doc.text.length > 300 && '...'}
                            </div>
                            <span className="text-[10px] text-slate-400 mt-0.5 block">
                              Tổng cộng: {doc.text.length.toLocaleString()} ký tự trích xuất
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* 2. DÁN VĂN BẢN TRÍCH ĐOẠN (SGK, GIÁO ÁN, MA TRẬN, NGỮ LIỆU) */}
        {/* ========================================================= */}
        <div className="pt-3 border-t border-slate-200">
          <label className="font-semibold text-slate-700 block mb-1.5">
            2. Dán văn bản / Ngữ liệu trích đoạn (nhiều mục riêng):
          </label>

          <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">
                  Phân loại tài liệu:
                </label>
                <select
                  value={snippetType}
                  onChange={(e) => setSnippetType(e.target.value as ReferenceSnippetType)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {SNIPPET_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] text-slate-500 block mb-1">
                  Tiêu đề đoạn trích (tùy chọn):
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Đoạn trích bài thơ / Bảng ma trận cũ..."
                  value={snippetTitle}
                  onChange={(e) => setSnippetTitle(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] text-slate-500">
                  Nội dung đoạn trích:
                </label>
                <span className="text-[10px] text-slate-400 font-mono">
                  {snippetContent.length.toLocaleString()} ký tự
                </span>
              </div>
              <textarea
                rows={3}
                placeholder="Dán ngữ liệu bài đọc, câu hỏi mẫu, bảng chuẩn kiến thức hoặc trích đoạn SGK..."
                value={snippetContent}
                onChange={(e) => setSnippetContent(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-xs"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                disabled={!snippetContent.trim()}
                onClick={handleAddSnippet}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm đoạn trích này</span>
              </button>
            </div>
          </div>

          {/* Danh sách các đoạn trích đã dán */}
          {referenceSnippets.length > 0 && (
            <div className="mt-3 space-y-2">
              <span className="font-semibold text-slate-700 text-[11px] block">
                Đoạn trích đã lưu ({referenceSnippets.length}):
              </span>

              {referenceSnippets.map((snip, index) => {
                const label =
                  SNIPPET_TYPE_OPTIONS.find((o) => o.value === snip.type)?.label || snip.type;
                return (
                  <div
                    key={snip.id}
                    className="p-2.5 bg-white rounded-lg border border-slate-200 flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                          {label}
                        </span>
                        <span className="font-medium text-slate-800">
                          {snip.title || `Mục ${index + 1}`}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          ({snip.content.length.toLocaleString()} ký tự)
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteSnippet(snip.id)}
                        className="text-slate-400 hover:text-red-600 p-1 rounded"
                        title="Xóa đoạn trích này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded border border-slate-100 whitespace-pre-wrap line-clamp-2">
                      {snip.content}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* 3. NGUỒN KIẾN THỨC (RADIO - CHỌN 1 TRONG 3) */}
        {/* ========================================================= */}
        <div className="pt-3 border-t border-slate-200 space-y-2">
          <label className="font-semibold text-slate-700 block">
            3. Chế độ nguồn kiến thức để ra đề:
          </label>

          <div className="space-y-2 bg-white p-3 rounded-xl border border-slate-200">
            {/* Lựa chọn 1: UPLOAD_PLUS_CURRICULUM (Mặc định) */}
            <label className="flex items-start gap-2.5 cursor-pointer p-2 rounded-lg hover:bg-slate-50 transition-colors">
              <input
                type="radio"
                name="knowledgeSource"
                checked={config.knowledgeSource === 'UPLOAD_PLUS_CURRICULUM'}
                onChange={() => handleKnowledgeSourceChange('UPLOAD_PLUS_CURRICULUM')}
                className="mt-0.5 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <div className="font-semibold text-slate-800">
                  Tài liệu tải lên + kiến thức chương trình phổ thông <span className="text-blue-600 font-normal">(Mặc định)</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Kết hợp tài liệu cung cấp với chuẩn kiến thức GDPT để xây dựng câu hỏi đa dạng, liên kết bài học.
                </p>
              </div>
            </label>

            {/* Lựa chọn 2: UPLOAD_ONLY */}
            <label className="flex items-start gap-2.5 cursor-pointer p-2 rounded-lg hover:bg-slate-50 transition-colors">
              <input
                type="radio"
                name="knowledgeSource"
                checked={config.knowledgeSource === 'UPLOAD_ONLY'}
                onChange={() => handleKnowledgeSourceChange('UPLOAD_ONLY')}
                className="mt-0.5 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <div className="font-semibold text-slate-800">
                  Chỉ sử dụng tài liệu tải lên
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Giới hạn nghiêm ngặt: không tự bịa thêm dữ kiện nếu tài liệu tải lên thiếu thông tin.
                </p>
              </div>
            </label>

            {/* Lựa chọn 3: TEACHER_INPUT */}
            <label className="flex items-start gap-2.5 cursor-pointer p-2 rounded-lg hover:bg-slate-50 transition-colors">
              <input
                type="radio"
                name="knowledgeSource"
                checked={config.knowledgeSource === 'TEACHER_INPUT'}
                onChange={() => handleKnowledgeSourceChange('TEACHER_INPUT')}
                className="mt-0.5 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <div className="font-semibold text-slate-800">
                  Giáo viên tự nhập nội dung
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Chỉ sử dụng tên bài, chương và nội dung do giáo viên nhập ở Bước 1 & Bước 4.
                </p>
              </div>
            </label>
          </div>

          {/* Dòng nguyên tắc bắt buộc ghi rõ dưới ô chọn */}
          <div className="p-2 rounded-lg bg-blue-50/80 border border-blue-200 text-blue-800 font-medium text-[11px] flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>Ưu tiên tuyệt đối nội dung tài liệu tải lên để ra đề.</span>
          </div>

          {/* Cảnh báo khi chọn UPLOAD_ONLY mà chưa có tài liệu nào */}
          {showUploadOnlyWarning && (
            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">Chưa có tài liệu tải lên!</div>
                <div>
                  Bạn đang chọn chế độ <em>"Chỉ sử dụng tài liệu tải lên"</em> nhưng chưa tải file hoặc dán đoạn văn bản nào. Cấu hình chưa hợp lệ.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
