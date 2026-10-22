import React from 'react';
import { MathText } from './MathText';

interface MathRendererProps {
  content: string;
  className?: string;
  as?: 'span' | 'div';
}

/**
 * Tương thích ngược với MathRenderer, sử dụng MathText chuẩn KaTeX
 */
export const MathRenderer: React.FC<MathRendererProps> = ({ content, className = '', as = 'span' }) => {
  return <MathText content={content} className={className} as={as} />;
};

export default MathRenderer;
