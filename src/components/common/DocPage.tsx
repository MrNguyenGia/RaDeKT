import React from 'react';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

export interface DocPageProps {
  children: React.ReactNode;
  className?: string;
  versionCode?: string;
  pageNumber?: number;
  totalPages?: number;
  footerText?: string;
  hideFooter?: boolean;
}

export interface DocContainerProps {
  children: React.ReactNode;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  toolbarRight?: React.ReactNode;
}

/**
 * Thanh công cụ thu phóng 75% - 150% chỉ hiển thị trên màn hình
 */
export const DocZoomToolbar: React.FC<{
  zoom: number;
  onZoomChange: (zoom: number) => void;
  extraControls?: React.ReactNode;
}> = ({ zoom, onZoomChange, extraControls }) => {
  const zoomPercent = Math.round(zoom * 100);

  const handleZoomIn = () => {
    onZoomChange(Math.min(1.5, Math.round((zoom + 0.1) * 10) / 10));
  };

  const handleZoomOut = () => {
    onZoomChange(Math.max(0.75, Math.round((zoom - 0.1) * 10) / 10));
  };

  const handleReset = () => {
    onZoomChange(1.0);
  };

  return (
    <div className="w-full max-w-[210mm] mx-auto mb-3 px-3 py-1.5 bg-white/90 backdrop-blur-xs border border-slate-200/90 rounded-xl shadow-xs flex items-center justify-between gap-3 text-xs text-slate-700 print:hidden select-none">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-slate-600 text-[11px] uppercase tracking-wider">
          Thu phóng A4:
        </span>
        <button
          type="button"
          onClick={handleZoomOut}
          disabled={zoom <= 0.75}
          className="p-1 rounded hover:bg-slate-100 disabled:opacity-40 text-slate-700 transition-colors"
          title="Thu nhỏ (-10%)"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>

        <span className="w-12 text-center font-mono font-bold text-slate-800 text-[11px]">
          {zoomPercent}%
        </span>

        <button
          type="button"
          onClick={handleZoomIn}
          disabled={zoom >= 1.5}
          className="p-1 rounded hover:bg-slate-100 disabled:opacity-40 text-slate-700 transition-colors"
          title="Phóng to (+10%)"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>

        {zoom !== 1.0 && (
          <button
            type="button"
            onClick={handleReset}
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
            title="Về kích thước chuẩn 100%"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        )}

        <div className="hidden sm:flex items-center gap-1 ml-2">
          {[0.75, 0.9, 1.0, 1.1, 1.25, 1.5].map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => onZoomChange(z)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                Math.abs(zoom - z) < 0.03
                  ? 'bg-blue-600 text-white font-bold'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
            >
              {Math.round(z * 100)}%
            </button>
          ))}
        </div>
      </div>

      {extraControls && <div className="flex items-center gap-2">{extraControls}</div>}
    </div>
  );
};

/**
 * Component Tờ giấy A4 chuẩn cho toàn bộ văn bản (đề thi, đáp án, hướng dẫn chấm, ma trận)
 * Khổ rộng 210mm, nền trắng, lề trái 25mm, phải 15mm, trên 20mm, dưới 20mm
 */
export const DocPage: React.FC<DocPageProps> = ({
  children,
  className = '',
  versionCode,
  pageNumber = 1,
  totalPages = 1,
  footerText,
  hideFooter = false,
}) => {
  const defaultFooter = versionCode
    ? `Mã đề ${versionCode} – Trang ${pageNumber}/${totalPages}`
    : `Trang ${pageNumber}/${totalPages}`;

  return (
    <div className={`doc-page ${className}`}>
      <div className="doc-page-content flex-1 w-full">{children}</div>

      {!hideFooter && (
        <div className="doc-footer">
          {footerText || defaultFooter}
        </div>
      )}
    </div>
  );
};
