import React, { useMemo } from 'react';
import { QuestionFigure, QuestionImageData } from '../types';
import { renderFigureToSvg } from '../lib/figureRenderer';

interface FigureViewProps {
  figure?: QuestionFigure | null;
  svgDiagram?: string | null;
  imageData?: QuestionImageData | null;
  className?: string;
}

export const FigureView: React.FC<FigureViewProps> = ({
  figure,
  svgDiagram,
  imageData,
  className = '',
}) => {
  const svgHtml = useMemo(() => {
    // Nếu có imageData thì ưu tiên imageData, không cần render SVG
    if (imageData?.dataUrl) {
      return null;
    }
    if (figure) {
      return renderFigureToSvg(figure);
    }
    if (svgDiagram && svgDiagram.trim().startsWith('<svg')) {
      return svgDiagram;
    }
    return null;
  }, [figure, svgDiagram, imageData]);

  // 1. Ưu tiên cao nhất: Ảnh do giáo viên chèn (imageData)
  if (imageData?.dataUrl) {
    const widthPct = Math.min(100, Math.max(20, imageData.widthPercent ?? 80));
    return (
      <figure
        style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
        className={`my-3 flex flex-col items-center justify-center p-2 bg-white rounded-lg border border-slate-200/80 shadow-2xs print:border-none print:shadow-none print:p-0 print:my-2 ${className}`}
      >
        <img
          src={imageData.dataUrl}
          alt={imageData.caption || 'Hình vẽ câu hỏi'}
          style={{ width: `${widthPct}%`, maxWidth: `${widthPct}%` }}
          className="h-auto object-contain rounded transition-all duration-150"
        />
        {imageData.caption && imageData.caption.trim().length > 0 && (
          <figcaption className="mt-1.5 text-xs text-slate-600 font-serif italic text-center print:text-black">
            {imageData.caption.trim()}
          </figcaption>
        )}
      </figure>
    );
  }

  // 2. Không có imageData: Hiển thị figure (SVG bằng code)
  if (!svgHtml) return null;

  return (
    <div
      style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
      className={`my-3 flex items-center justify-center p-2 bg-white rounded-lg border border-slate-200/80 shadow-2xs print:border-none print:shadow-none print:p-0 print:my-2 ${className}`}
    >
      <div
        className="max-w-full overflow-x-auto flex items-center justify-center [&>svg]:max-h-[240px] [&>svg]:w-auto [&>svg]:h-auto"
        dangerouslySetInnerHTML={{ __html: svgHtml }}
      />
    </div>
  );
};
