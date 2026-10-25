import React, { useMemo } from 'react';
import { QuestionFigure, QuestionImageData } from '../types';
import { figureToSvg } from '../lib/figureRenderer';

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
  const isVariationOrSignTable =
    figure?.kind === 'variation-table' || figure?.kind === 'sign-table';

  const svgHtml = useMemo(() => {
    // Nếu có imageData thì ưu tiên imageData
    if (imageData?.dataUrl) {
      return null;
    }
    if (figure) {
      return figureToSvg(figure);
    }
    if (svgDiagram && svgDiagram.trim().startsWith('<svg')) {
      return svgDiagram;
    }
    return null;
  }, [figure, svgDiagram, imageData]);

  // 1. Ưu tiên cao nhất: Ảnh do giáo viên chèn (imageData)
  if (imageData?.dataUrl) {
    const widthPct = Math.min(70, Math.max(20, imageData.widthPercent ?? 70));
    return (
      <figure
        style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
        className={`doc-figure-wrapper figure-image my-2 flex flex-col items-center justify-center ${className}`}
      >
        <img
          src={imageData.dataUrl}
          alt={imageData.caption || 'Hình vẽ minh họa'}
          style={{ width: `${widthPct}%`, maxWidth: '70%' }}
          className="h-auto object-contain mx-auto transition-all duration-150"
        />
        {imageData.caption && imageData.caption.trim().length > 0 && (
          <figcaption className="doc-figure-caption">
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
      className={`doc-figure-wrapper ${
        isVariationOrSignTable ? 'figure-variation-table w-full' : 'figure-chart'
      } my-2 flex flex-col items-center justify-center ${className}`}
    >
      <div
        className={`flex items-center justify-center w-full [&>svg]:max-h-[260px] [&>svg]:w-auto [&>svg]:h-auto [&>svg]:mx-auto`}
        dangerouslySetInnerHTML={{ __html: svgHtml }}
      />
      {(figure as any)?.caption && (figure as any).caption.trim().length > 0 && (
        <div className="doc-figure-caption">
          {(figure as any).caption.trim()}
        </div>
      )}
    </div>
  );
};

