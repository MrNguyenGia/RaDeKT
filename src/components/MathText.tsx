import React, { useMemo } from 'react';
import katex from 'katex';

interface MathTextProps {
  content?: string | null;
  className?: string;
  as?: 'span' | 'div';
}

/**
 * Component MathText hiển thị văn bản kết hợp công thức toán/lý/hóa:
 * - $...$ : Công thức nội dòng (inline)
 * - $$...$$ : Công thức xuống dòng / khối (displayMode)
 * Sử dụng KaTeX để kết xuất an toàn và nhanh chóng.
 */
export const MathText: React.FC<MathTextProps> = ({
  content,
  className = '',
  as: Component = 'span',
}) => {
  const renderedHtml = useMemo(() => {
    if (!content) return '';

    // Regex phân tách $$...$$ và $...$
    // Không bắt các ký tự $ đơn lẻ trong tiền tệ nếu không có cặp đóng
    const regex = /(\$\$[\s\S]*?\$\$|\$(?!\$)[^\$\n]+?\$)/g;
    const parts = content.split(regex);

    return parts
      .map((part) => {
        if (!part) return '';

        // Display math: $$...$$
        if (part.startsWith('$$') && part.endsWith('$$') && part.length >= 4) {
          const formula = part.slice(2, -2).trim();
          try {
            return `<div class="my-2.5 overflow-x-auto text-center">${katex.renderToString(formula, {
              displayMode: true,
              throwOnError: false,
              strict: 'ignore',
              trust: true,
            })}</div>`;
          } catch {
            return `<code>${escapeHtml(part)}</code>`;
          }
        }

        // Inline math: $...$
        if (part.startsWith('$') && part.endsWith('$') && part.length >= 2) {
          const formula = part.slice(1, -1).trim();
          try {
            return katex.renderToString(formula, {
              displayMode: false,
              throwOnError: false,
              strict: 'ignore',
              trust: true,
            });
          } catch {
            return `<code>${escapeHtml(part)}</code>`;
          }
        }

        // Regular text: escape HTML and preserve newlines
        return escapeHtml(part).replace(/\n/g, '<br/>');
      })
      .join('');
  }, [content]);

  return (
    <Component
      className={`leading-relaxed ${className}`}
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  );
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export default MathText;
