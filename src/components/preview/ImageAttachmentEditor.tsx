import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Image as ImageIcon,
  Upload,
  Trash2,
  Sliders,
  Type,
  AlertCircle,
  Loader2,
  Sparkles,
  RefreshCw,
  X,
  AlertTriangle,
  Info,
  Check,
} from 'lucide-react';
import { QuestionImageData } from '../../types';
import { GEMINI_IMAGE_MODEL } from '../../config';
import { generateAiIllustration } from '../../services/gemini';

export interface ImageAttachmentEditorProps {
  imageData?: QuestionImageData | null;
  onChange: (data?: QuestionImageData) => void;
  onAiImageUsed?: (imageData: QuestionImageData, note: string) => void;
  className?: string;
}

/**
 * Nén và thu nhỏ ảnh về tối đa 1000px chiều rộng bằng HTML5 Canvas
 */
async function processAndCompressImage(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không thể đọc file ảnh.'));
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) {
        reject(new Error('File rỗng.'));
        return;
      }

      const img = new Image();
      img.onerror = () => reject(new Error('File không phải là định dạng hình ảnh hợp lệ.'));
      img.onload = () => {
        try {
          const maxDim = 1000;
          let targetWidth = img.width;
          let targetHeight = img.height;

          if (img.width > maxDim) {
            targetWidth = maxDim;
            targetHeight = Math.round((img.height * maxDim) / img.width);
          }

          const canvas = document.createElement('canvas');
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(dataUrl);
            return;
          }

          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

          // Nén JPEG 0.85 hoặc PNG
          const isPng = file.type === 'image/png';
          let compressed = isPng ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.85);
          if (isPng && compressed.length > 800 * 1024) {
            // Nếu PNG lớn hơn 800KB thì chuyển sang JPEG 0.88 để tiết kiệm dung lượng
            compressed = canvas.toDataURL('image/jpeg', 0.88);
          }

          resolve(compressed);
        } catch {
          resolve(dataUrl);
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

export const ImageAttachmentEditor: React.FC<ImageAttachmentEditorProps> = ({
  imageData,
  onChange,
  onAiImageUsed,
  className = '',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Trạng thái modal Tạo hình minh họa bằng AI
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiNoPermission, setAiNoPermission] = useState(false);
  const [aiPreviewDataUrl, setAiPreviewDataUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const caption = imageData?.caption || '';
  const widthPercent = imageData?.widthPercent ?? 80;

  // Xử lý nạp file do GV cung cấp
  const handleFile = useCallback(
    async (file: File | Blob) => {
      if (!file.type.startsWith('image/')) {
        setError('Vui lòng chọn file hình ảnh hợp lệ (PNG, JPG, WEBP).');
        return;
      }

      setIsProcessing(true);
      setError(null);
      try {
        const compressedDataUrl = await processAndCompressImage(file);
        onChange({
          dataUrl: compressedDataUrl,
          caption: imageData?.caption || '',
          widthPercent: imageData?.widthPercent ?? 80,
        });
      } catch (err: any) {
        setError(err?.message || 'Lỗi khi xử lý hình ảnh.');
      } finally {
        setIsProcessing(false);
      }
    },
    [imageData, onChange]
  );

  // Lắng nghe sự kiện paste clipboard (Ctrl+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Chỉ bắt paste nếu người dùng đang không ở trong modal tạo hình AI
      if (isAiModalOpen) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            handleFile(file);
            break;
          }
        }
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('paste', handlePaste);
    }
    return () => {
      if (container) {
        container.removeEventListener('paste', handlePaste);
      }
    };
  }, [handleFile, isAiModalOpen]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleRemoveImage = () => {
    setError(null);
    onChange(undefined);
  };

  const handleCaptionChange = (val: string) => {
    if (!imageData?.dataUrl) return;
    onChange({
      ...imageData,
      caption: val,
    });
  };

  const handleWidthChange = (val: number) => {
    if (!imageData?.dataUrl) return;
    onChange({
      ...imageData,
      widthPercent: val,
    });
  };

  // Hàm gọi Gemini sinh hình minh họa
  const handleGenerateAiImage = async (overridePrompt?: string) => {
    const query = (overridePrompt ?? aiPrompt).trim();
    if (!query) {
      setAiError('Vui lòng nhập mô tả ngắn cho hình ảnh (ví dụ: chú mèo con, củ cà rốt, chiếc xe đạp...)');
      return;
    }

    setAiLoading(true);
    setAiError(null);
    setAiNoPermission(false);

    try {
      const result = await generateAiIllustration(query);
      if (result.success && result.dataUrl) {
        setAiPreviewDataUrl(result.dataUrl);
      } else {
        if (result.noPermission) {
          setAiNoPermission(true);
        }
        setAiError(
          result.error ||
            'Không thể tạo hình ảnh minh họa bằng AI. Vui lòng thử lại với mô tả khác hoặc chèn ảnh có sẵn.'
        );
      }
    } catch (err: any) {
      setAiError(err?.message || 'Lỗi kết nối khi gọi model tạo ảnh.');
    } finally {
      setAiLoading(false);
    }
  };

  // Giáo viên bấm "Dùng hình này"
  const handleApplyAiImage = () => {
    if (!aiPreviewDataUrl) return;

    const newImageData: QuestionImageData = {
      dataUrl: aiPreviewDataUrl,
      caption: aiPrompt.trim() || 'Hình minh họa do AI tạo',
      widthPercent: imageData?.widthPercent ?? 80,
    };

    onChange(newImageData);
    onAiImageUsed?.(newImageData, 'Hình do AI tạo, cần GV kiểm tra');

    // Đóng modal & reset xem trước
    setIsAiModalOpen(false);
    setAiPreviewDataUrl(null);
    setAiError(null);
  };

  // Hủy tạo ảnh
  const handleCancelAiModal = () => {
    setIsAiModalOpen(false);
    setAiLoading(false);
    setAiError(null);
    setAiNoPermission(false);
    setAiPreviewDataUrl(null);
  };

  // Tính dung lượng xấp xỉ của ảnh
  const approxKb = imageData?.dataUrl ? Math.round((imageData.dataUrl.length * 0.75) / 1024) : 0;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3 focus:outline-none focus:ring-1 focus:ring-indigo-400 ${className}`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png, image/jpeg, image/jpg, image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />

      {/* Header khu vực ảnh */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <label className="font-semibold text-slate-800 flex items-center gap-1.5 text-xs">
          <ImageIcon className="w-4 h-4 text-emerald-600" />
          <span>Hình ảnh đính kèm câu hỏi</span>
        </label>
        <div className="flex items-center gap-2">
          {/* Nút Tạo hình minh họa bằng AI */}
          <button
            type="button"
            onClick={() => {
              setAiError(null);
              setAiNoPermission(false);
              setIsAiModalOpen(true);
            }}
            className="text-[11px] text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5 font-bold shadow-2xs transition-all hover:border-purple-300"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            <span>Tạo hình minh họa bằng AI</span>
          </button>

          {imageData?.dataUrl && (
            <button
              type="button"
              onClick={handleRemoveImage}
              className="text-[11px] text-rose-600 hover:text-rose-800 flex items-center gap-1 font-medium transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xóa hình</span>
            </button>
          )}
        </div>
      </div>

      {/* Thông báo lỗi nếu có khi upload file */}
      {error && (
        <div className="flex items-center gap-1.5 p-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-[11px]">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Chưa có ảnh: Khu vực Chèn hình & Kéo thả / Paste */}
      {!imageData?.dataUrl ? (
        <div className="space-y-2">
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center gap-2 text-center transition-all ${
              isDragging
                ? 'border-emerald-500 bg-emerald-50/60'
                : 'border-slate-300 hover:border-emerald-400 hover:bg-slate-100/60 bg-white'
            }`}
          >
            {isProcessing ? (
              <div className="flex items-center gap-2 text-emerald-600 py-3">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-xs font-medium">Đang xử lý và thu nhỏ ảnh...</span>
              </div>
            ) : (
              <>
                <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 shadow-2xs">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    <button
                      type="button"
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors"
                    >
                      Chèn hình
                    </button>
                    <span className="text-xs text-slate-400">hoặc</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsAiModalOpen(true);
                      }}
                      className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors flex items-center gap-1"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Tạo bằng AI</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2">
                    Chọn file PNG/JPG, <strong>kéo thả vào đây</strong>, hoặc bấm <strong>Ctrl+V</strong> để dán từ clipboard
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    (Phù hợp ảnh SGK, thí nghiệm, sơ đồ. Tự động thu nhỏ tối đa 1000px chiều rộng)
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        /* Đã có ảnh: Xem trước trực tiếp + Chú thích + Thanh chỉnh độ rộng */
        <div className="space-y-3 bg-white p-3 rounded-lg border border-slate-200">
          {/* Xem trước trực tiếp */}
          <div className="flex flex-col items-center justify-center p-2 bg-slate-50 rounded-lg border border-slate-200/60 overflow-hidden">
            <img
              src={imageData.dataUrl}
              alt={caption || 'Ảnh minh họa'}
              style={{ width: `${widthPercent}%`, maxWidth: `${widthPercent}%` }}
              className="h-auto max-h-[220px] object-contain rounded shadow-2xs transition-all bg-white"
            />
            {caption && (
              <p className="mt-1.5 text-xs text-slate-600 font-serif italic text-center">
                {caption}
              </p>
            )}
            <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400 flex-wrap justify-center">
              <span>Độ rộng: {widthPercent}%</span>
              <span>•</span>
              <span>Dung lượng: ~{approxKb} KB</span>
              <span>•</span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-emerald-700 hover:underline font-semibold"
              >
                Thay ảnh khác (tải file)
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => setIsAiModalOpen(true)}
                className="text-purple-700 hover:underline font-semibold flex items-center gap-0.5"
              >
                <Sparkles className="w-3 h-3" />
                <span>Tạo lại bằng AI</span>
              </button>
            </div>
          </div>

          {/* Ô Chú thích */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
              <Type className="w-3.5 h-3.5 text-slate-500" />
              <span>Chú thích hình ảnh (tùy chọn):</span>
            </label>
            <input
              type="text"
              value={caption}
              onChange={(e) => handleCaptionChange(e.target.value)}
              placeholder="Ví dụ: Hình 1. Con mèo con; hoặc Sơ đồ mạch điện..."
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* Thanh chỉnh độ rộng 20–100% */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-slate-700 flex items-center gap-1">
                <Sliders className="w-3.5 h-3.5 text-slate-500" />
                <span>Độ rộng hiển thị khi In / Xuất:</span>
              </span>
              <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[10px]">
                {widthPercent}%
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-slate-400">20%</span>
              <input
                type="range"
                min="20"
                max="100"
                step="5"
                value={widthPercent}
                onChange={(e) => handleWidthChange(Number(e.target.value))}
                className="flex-1 accent-emerald-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
              />
              <span className="text-[10px] text-slate-400">100%</span>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
       * MODAL TẠO HÌNH MINH HỌA BẰNG AI (GEMINI)
       * ========================================================================= */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-purple-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header Modal */}
            <div className="px-5 py-3.5 bg-purple-50/80 border-b border-purple-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-purple-600 text-white flex items-center justify-center shadow-xs">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900">Tạo hình minh họa bằng AI</h4>
                  <p className="text-[10px] text-purple-700 font-mono">
                    Model: {GEMINI_IMAGE_MODEL}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCancelAiModal}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Nội dung Modal */}
            <div className="p-5 space-y-4 text-xs">
              {/* Lời nhắc quy định sử dụng */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 space-y-1">
                <div className="flex items-start gap-1.5 font-semibold text-[11px]">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>Chỉ dùng cho hình minh họa đơn giản (con vật, đồ vật, cảnh vật)</span>
                </div>
                <p className="text-[11px] text-amber-800 pl-5 leading-relaxed">
                  Không dùng cho đồ thị, hình hình học hay sơ đồ có số liệu vì AI vẽ dễ sai.
                </p>
                <p className="text-[10px] text-amber-700 pl-5 font-medium">
                  • Phong cách: Nét đơn giản, nền trắng tinh, không chữ trên hình, phù hợp học sinh.
                </p>
              </div>

              {/* Thông báo nếu tài khoản chưa có quyền dùng model tạo ảnh */}
              {aiNoPermission ? (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-2 text-rose-900">
                  <div className="flex items-start gap-2 font-bold text-xs text-rose-700">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                    <span>Tài khoản chưa có quyền sử dụng model tạo ảnh</span>
                  </div>
                  <p className="text-[11px] text-rose-800 leading-relaxed">
                    Tài khoản hiện tại chưa có quyền hoặc hạn mức sử dụng model tạo ảnh của Gemini (cần gói trả phí hoặc quota tạo ảnh). Bạn vui lòng dùng tính năng "Chèn hình" có sẵn (tải file PNG/JPG hoặc dán từ clipboard) để tiếp tục.
                  </p>
                  <div className="pt-1 flex justify-end">
                    <button
                      type="button"
                      onClick={handleCancelAiModal}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                    >
                      Đóng & Dùng chèn hình có sẵn (H2)
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Ô nhập mô tả */}
                  <div className="space-y-1.5">
                    <label className="font-semibold text-slate-800 block">
                      Mô tả ngắn hình ảnh (tiếng Việt): <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={aiPrompt}
                        disabled={aiLoading}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !aiLoading) {
                            e.preventDefault();
                            handleGenerateAiImage();
                          }
                        }}
                        placeholder="Ví dụ: Một chú mèo vàng đang ngủ, Cây bàng mùa thu, Chiếc xe đạp..."
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                      />
                    </div>

                    {/* Gợi ý nhanh */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      <span className="text-[10px] text-slate-400">Gợi ý:</span>
                      {[
                        'Một chú thỏ trắng',
                        'Quả táo đỏ',
                        'Mặt trời mọc sau núi',
                        'Cây bàng mùa thu',
                        'Chiếc xe đạp màu xanh',
                      ].map((hint, i) => (
                        <button
                          key={i}
                          type="button"
                          disabled={aiLoading}
                          onClick={() => {
                            setAiPrompt(hint);
                            handleGenerateAiImage(hint);
                          }}
                          className="text-[10px] text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2 py-0.5 rounded-full transition-colors"
                        >
                          {hint}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Thông báo lỗi nếu có */}
                  {aiError && !aiNoPermission && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-[11px] flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{aiError}</span>
                    </div>
                  )}

                  {/* Trạng thái đang tải */}
                  {aiLoading && (
                    <div className="p-6 bg-purple-50/50 rounded-xl border border-purple-100 flex flex-col items-center justify-center gap-2 text-center animate-pulse">
                      <Loader2 className="w-7 h-7 text-purple-600 animate-spin" />
                      <p className="font-bold text-xs text-purple-900">
                        AI đang vẽ hình minh họa...
                      </p>
                      <p className="text-[11px] text-purple-700">
                        Phong cách nét đơn giản, nền trắng tinh, không chữ trên hình. Vui lòng đợi vài giây.
                      </p>
                    </div>
                  )}

                  {/* Xem trước trực tiếp khi AI sinh xong */}
                  {!aiLoading && aiPreviewDataUrl && (
                    <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="text-[11px] font-semibold text-slate-700 flex items-center justify-between">
                        <span>Hình ảnh AI vừa tạo (Xem trước):</span>
                        <span className="text-emerald-600 flex items-center gap-1 text-[10px]">
                          <Check className="w-3.5 h-3.5" /> Nền trắng chuẩn
                        </span>
                      </div>
                      <div className="flex justify-center p-3 bg-white rounded-lg border border-slate-200/80">
                        <img
                          src={aiPreviewDataUrl}
                          alt="Xem trước hình AI"
                          className="w-48 h-48 object-contain rounded border border-slate-100 shadow-2xs bg-white"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer Modal: Các nút hành động */}
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleCancelAiModal}
                disabled={aiLoading}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold text-xs transition-colors"
              >
                Hủy
              </button>

              {!aiPreviewDataUrl ? (
                <button
                  type="button"
                  disabled={aiLoading || !aiPrompt.trim()}
                  onClick={() => handleGenerateAiImage()}
                  className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {aiLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang tạo...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Tạo hình</span>
                    </>
                  )}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={aiLoading}
                    onClick={() => handleGenerateAiImage()}
                    className="px-3 py-1.5 rounded-lg border border-purple-300 text-purple-700 hover:bg-purple-50 font-semibold text-xs flex items-center gap-1 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Tạo lại</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyAiImage}
                    className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Dùng hình này</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
