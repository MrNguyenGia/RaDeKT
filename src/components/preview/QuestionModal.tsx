import React, { useState, useMemo } from 'react';
import { X, Check, Eye, HelpCircle, Image as ImageIcon, Sparkles, Trash, Code2, AlertCircle, AlertTriangle } from 'lucide-react';
import { Level, Question, QuestionType, QuestionFigure, QuestionImageData } from '../../types';
import { MathText } from '../MathText';
import { FigureView } from '../FigureView';
import { ImageAttachmentEditor } from './ImageAttachmentEditor';
import { figureToSvg } from '../../lib/figureRenderer';
import {
  generateCubicGraphSvg,
  generateParabolaSvg,
  generateRationalGraphSvg,
  generateVariationTableSvg,
  generatePyramidSvg,
} from '../../lib/diagrams';

interface QuestionModalProps {
  initialQuestion: Partial<Question>;
  isNew?: boolean;
  insertIndex?: number;
  customTitle?: string;
  customSubtitle?: string;
  onSave: (questionData: Partial<Question>) => void;
  onClose: () => void;
}

export const QuestionModal: React.FC<QuestionModalProps> = ({
  initialQuestion,
  isNew = false,
  insertIndex = 0,
  customTitle,
  customSubtitle,
  onSave,
  onClose,
}) => {
  const [question, setQuestion] = useState<string>(initialQuestion.question || '');
  const [type, setType] = useState<QuestionType>(initialQuestion.type || 'MCQ4');
  const [level, setLevel] = useState<Level>(initialQuestion.level || 'NB');
  const [score, setScore] = useState<number>(initialQuestion.score ?? 0.25);
  const [topic, setTopic] = useState<string>(initialQuestion.topic || '');
  const [correctAnswer, setCorrectAnswer] = useState<string>(initialQuestion.correctAnswer || '');
  const [explanation, setExplanation] = useState<string>(initialQuestion.explanation || '');
  const [scoringGuide, setScoringGuide] = useState<string>(initialQuestion.scoringGuide || '');
  const [svgDiagram, setSvgDiagram] = useState<string>(initialQuestion.svgDiagram || '');
  const [imageData, setImageData] = useState<QuestionImageData | undefined>(initialQuestion.imageData);
  const [needsReview, setNeedsReview] = useState<boolean>(initialQuestion.needsReview ?? false);
  const [reviewNote, setReviewNote] = useState<string | undefined>(initialQuestion.reviewNote);

  // Trạng thái JSON hình vẽ (QuestionFigure)
  const [figureJson, setFigureJson] = useState<string>(() => {
    if (initialQuestion.figure) {
      try {
        return JSON.stringify(initialQuestion.figure, null, 2);
      } catch {
        return '';
      }
    }
    return '';
  });

  // Parse JSON figure trong thời gian thực để hiển thị xem trước
  const { parsedFigure, figureJsonError } = useMemo(() => {
    const trimmed = figureJson.trim();
    if (!trimmed) {
      return { parsedFigure: null, figureJsonError: null };
    }
    try {
      const obj = JSON.parse(trimmed);
      if (!obj || typeof obj !== 'object' || !obj.kind) {
        return {
          parsedFigure: null,
          figureJsonError: 'JSON cần có trường "kind": "function-graph" | "geometry" | "variation-table" | "sign-table" | "data-chart"',
        };
      }
      return { parsedFigure: obj as QuestionFigure, figureJsonError: null };
    } catch (e: any) {
      return {
        parsedFigure: null,
        figureJsonError: `Cú pháp JSON chưa hợp lệ: ${e?.message || 'Lỗi cú pháp'}`,
      };
    }
  }, [figureJson]);

  // Options for MCQ4
  const [options, setOptions] = useState<string[]>(
    initialQuestion.options && initialQuestion.options.length > 0
      ? initialQuestion.options
      : ['A. ', 'B. ', 'C. ', 'D. ']
  );

  // Statements for TRUE_FALSE
  const [statements, setStatements] = useState(
    initialQuestion.statements && initialQuestion.statements.length > 0
      ? initialQuestion.statements
      : [
          { id: 'a', statement: 'Mệnh đề a...', isCorrect: true },
          { id: 'b', statement: 'Mệnh đề b...', isCorrect: false },
          { id: 'c', statement: 'Mệnh đề c...', isCorrect: true },
          { id: 'd', statement: 'Mệnh đề d...', isCorrect: false },
        ]
  );

  // Pairs for MATCHING
  const [pairs, setPairs] = useState(
    initialQuestion.pairs && initialQuestion.pairs.length > 0
      ? initialQuestion.pairs
      : [
          { id: '1', left: 'Khái niệm 1', right: 'Định nghĩa 1' },
          { id: '2', left: 'Khái niệm 2', right: 'Định nghĩa 2' },
          { id: '3', left: 'Khái niệm 3', right: 'Định nghĩa 3' },
          { id: '4', left: 'Khái niệm 4', right: 'Định nghĩa 4' },
        ]
  );

  // Preview toggle
  const [showPreview, setShowPreview] = useState<boolean>(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const finalFigure = parsedFigure || undefined;
    const finalSvg = finalFigure ? figureToSvg(finalFigure) : (svgDiagram.trim() || undefined);

    onSave({
      ...initialQuestion,
      question: question.trim(),
      type,
      level,
      score,
      topic: topic.trim(),
      correctAnswer: correctAnswer.trim(),
      explanation: explanation.trim(),
      scoringGuide: scoringGuide.trim(),
      options: type === 'MCQ4' || type === 'MCQ_MULTI' ? options : undefined,
      statements: type === 'TRUE_FALSE' ? statements : undefined,
      pairs: type === 'MATCHING' ? pairs : undefined,
      figure: finalFigure,
      svgDiagram: finalSvg,
      imageData: imageData?.dataUrl ? imageData : undefined,
      needsReview,
      reviewNote,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full my-8 max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div>
            <h3 className="font-bold text-sm text-slate-900">
              {customTitle || (isNew ? `Thêm câu hỏi mới (Vị trí Câu ${insertIndex + 1})` : 'Chỉnh sửa câu hỏi')}
            </h3>
            <p className="text-[11px] text-slate-500">
              {customSubtitle || 'Hỗ trợ công thức KaTeX ($...$ và $$...$$). Điểm và nội dung sẽ được cập nhật vào đề thi.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Metadata row: Dạng câu, Mức độ, Điểm, Chủ đề */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Dạng câu hỏi</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as QuestionType)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium"
              >
                <option value="MCQ4">Trắc nghiệm 4 lựa chọn</option>
                <option value="TRUE_FALSE">Đúng / Sai (4 ý)</option>
                <option value="FILL_BLANK">Điền khuyết</option>
                <option value="MATCHING">Ghép nối</option>
                <option value="SHORT_ANSWER">Trả lời ngắn</option>
                <option value="ESSAY">Tự luận</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Mức độ nhận thức</label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value as Level)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium"
              >
                <option value="NB">Nhận biết (NB)</option>
                <option value="TH">Thông hiểu (TH)</option>
                <option value="VD">Vận dụng (VD)</option>
                <option value="VDC">Vận dụng cao (VDC)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Điểm số</label>
              <input
                type="number"
                step="0.05"
                min="0.05"
                value={score}
                onChange={(e) => setScore(parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-blue-700"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Chủ đề kiến thức</label>
              <input
                type="text"
                value={topic}
                placeholder="VD: Căn bậc hai..."
                onChange={(e) => setTopic(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
              />
            </div>
          </div>

          {/* Question Text */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-slate-800">
                Nội dung câu hỏi <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-medium"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{showPreview ? 'Ẩn xem trước' : 'Xem công thức toán'}</span>
              </button>
            </div>
            <textarea
              rows={3}
              required
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Nhập nội dung câu hỏi, ví dụ: Cho biểu thức $P = \sqrt{x^2 + 1}$..."
              className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono text-xs"
            />
            {showPreview && question.trim() && (
              <div className="mt-2 p-3 bg-blue-50/50 rounded-xl border border-blue-200 text-slate-800">
                <span className="text-[10px] uppercase font-bold text-blue-600 block mb-1">
                  Hiển thị thực tế (KaTeX):
                </span>
                <MathText content={question} />
              </div>
            )}
          </div>

          {/* Cảnh báo Cần GV kiểm tra nếu có */}
          {needsReview && (
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>⚠ {reviewNote || 'Cần GV kiểm tra'}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setNeedsReview(false);
                  setReviewNote(undefined);
                }}
                className="text-[11px] text-amber-700 hover:text-amber-900 underline font-semibold ml-2"
              >
                Đánh dấu đã duyệt xong
              </button>
            </div>
          )}

          {/* Ô Chèn ảnh do giáo viên cung cấp (PNG/JPG/Ctrl+V/Kéo thả) hoặc Tạo bằng AI */}
          <ImageAttachmentEditor
            imageData={imageData}
            onChange={setImageData}
            onAiImageUsed={(newImg, note) => {
              setImageData(newImg);
              setNeedsReview(true);
              setReviewNote(note);
            }}
          />

          {/* Ô JSON Hình vẽ & Đồ thị có xem trước trực tiếp cho giáo viên */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-800 flex items-center gap-1.5 text-xs">
                <Code2 className="w-4 h-4 text-indigo-600" />
                <span>Cấu trúc Hình vẽ (JSON Figure) & Xem trước trực tiếp</span>
              </label>
              {(figureJson.trim() || svgDiagram.trim()) && (
                <button
                  type="button"
                  onClick={() => {
                    setFigureJson('');
                    setSvgDiagram('');
                  }}
                  className="text-[11px] text-rose-600 hover:text-rose-800 flex items-center gap-1"
                >
                  <Trash className="w-3 h-3" />
                  <span>Xóa hình</span>
                </button>
              )}
            </div>

            {/* Các mẫu JSON chèn nhanh */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-slate-500 font-medium mr-1">Mẫu nhanh:</span>
              <button
                type="button"
                onClick={() => {
                  setSvgDiagram('');
                  setFigureJson(
                    JSON.stringify(
                      {
                        kind: 'function-graph',
                        functions: [{ expr: 'x^3 - 3*x', label: 'y = x^3 - 3x' }],
                        xRange: [-3, 3],
                        yRange: [-4, 4],
                        points: [
                          { x: -1, y: 2, label: '(-1; 2)' },
                          { x: 1, y: -2, label: '(1; -2)' },
                        ],
                        showGrid: true,
                      },
                      null,
                      2
                    )
                  );
                }}
                className="px-2 py-0.5 rounded text-[11px] bg-white hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 border border-slate-300 transition-colors"
              >
                Đồ thị hàm số
              </button>
              <button
                type="button"
                onClick={() => {
                  setSvgDiagram('');
                  setFigureJson(
                    JSON.stringify(
                      {
                        kind: 'geometry',
                        points: [
                          { id: 'S', x: 0, y: 3.5, label: 'S' },
                          { id: 'A', x: -2.5, y: 0, label: 'A' },
                          { id: 'B', x: -0.8, y: -1.8, label: 'B' },
                          { id: 'C', x: 2.5, y: 0, label: 'C' },
                        ],
                        segments: [
                          ['S', 'A'],
                          ['S', 'B'],
                          ['S', 'C'],
                          ['A', 'B'],
                          ['B', 'C'],
                        ],
                        dashed: [['A', 'C']],
                        rightAngles: [],
                      },
                      null,
                      2
                    )
                  );
                }}
                className="px-2 py-0.5 rounded text-[11px] bg-white hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 border border-slate-300 transition-colors"
              >
                Hình học không gian
              </button>
              <button
                type="button"
                onClick={() => {
                  setSvgDiagram('');
                  setFigureJson(
                    JSON.stringify(
                      {
                        kind: 'variation-table',
                        xValues: ['-\\infty', '-1', '1', '+\\infty'],
                        yValues: ['-\\infty', '2', '-2', '+\\infty'],
                        trends: ['up', 'down', 'up'],
                        derivativeSigns: ['+', '-', '+'],
                      },
                      null,
                      2
                    )
                  );
                }}
                className="px-2 py-0.5 rounded text-[11px] bg-white hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 border border-slate-300 transition-colors"
              >
                Bảng biến thiên
              </button>
              <button
                type="button"
                onClick={() => {
                  setSvgDiagram('');
                  setFigureJson(
                    JSON.stringify(
                      {
                        kind: 'data-chart',
                        chartType: 'bar',
                        title: 'Biểu đồ số liệu',
                        labels: ['Nhóm 1', 'Nhóm 2', 'Nhóm 3', 'Nhóm 4'],
                        series: [{ name: 'Số lượng', values: [12, 18, 15, 22] }],
                        unit: 'học sinh',
                      },
                      null,
                      2
                    )
                  );
                }}
                className="px-2 py-0.5 rounded text-[11px] bg-white hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 border border-slate-300 transition-colors"
              >
                Biểu đồ số liệu
              </button>
            </div>

            {/* Xem trước trực tiếp bằng FigureView */}
            {(parsedFigure || svgDiagram.trim()) && (
              <div className="p-3 bg-white border border-slate-200 rounded-lg flex flex-col items-center justify-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide self-start mb-1">
                  Xem trước hình vẽ:
                </span>
                <FigureView figure={parsedFigure} svgDiagram={svgDiagram} className="my-1 border-none shadow-none" />
              </div>
            )}

            {/* Báo lỗi cú pháp JSON nếu có */}
            {figureJsonError && (
              <div className="flex items-center gap-1.5 p-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-[11px]">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{figureJsonError}</span>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium text-slate-600">Mã JSON cấu trúc hình (figure):</span>
              </div>
              <textarea
                rows={4}
                value={figureJson}
                onChange={(e) => setFigureJson(e.target.value)}
                placeholder='Nhập JSON figure, ví dụ: { "kind": "function-graph", "functions": [{"expr": "x^3 - 3*x"}], "xRange": [-3, 3] }...'
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono text-[11px] bg-white text-slate-700"
              />
            </div>
          </div>

          {/* MCQ Options */}
          {(type === 'MCQ4' || type === 'MCQ_MULTI') && (
            <div className="space-y-2">
              <label className="font-semibold text-slate-800 block">Các phương án lựa chọn:</label>
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-6 font-bold text-slate-600 shrink-0">
                    {['A', 'B', 'C', 'D'][i]}.
                  </span>
                  <input
                    type="text"
                    value={opt.replace(/^[A-D]\.\s*/i, '')}
                    onChange={(e) => {
                      const updated = [...options];
                      updated[i] = `${['A', 'B', 'C', 'D'][i]}. ${e.target.value}`;
                      setOptions(updated);
                    }}
                    placeholder={`Nhập nội dung phương án ${['A', 'B', 'C', 'D'][i]}...`}
                    className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setCorrectAnswer(['A', 'B', 'C', 'D'][i])}
                    className={`px-2 py-1 rounded text-[11px] font-bold border transition-colors ${
                      correctAnswer.toUpperCase() === ['A', 'B', 'C', 'D'][i]
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    {correctAnswer.toUpperCase() === ['A', 'B', 'C', 'D'][i] ? 'Đáp án đúng' : 'Chọn đúng'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* TRUE_FALSE Statements */}
          {type === 'TRUE_FALSE' && (
            <div className="space-y-2">
              <label className="font-semibold text-slate-800 block">4 Mệnh đề a, b, c, d:</label>
              {statements.map((st, i) => (
                <div key={st.id} className="flex items-center gap-2">
                  <span className="w-5 font-bold text-slate-600 shrink-0">{st.id})</span>
                  <input
                    type="text"
                    value={st.statement}
                    onChange={(e) => {
                      const next = [...statements];
                      next[i] = { ...next[i], statement: e.target.value };
                      setStatements(next);
                    }}
                    className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const next = [...statements];
                      next[i] = { ...next[i], isCorrect: !next[i].isCorrect };
                      setStatements(next);
                      // sync correctAnswer
                      const ansStr = next.map((s) => `${s.id}: ${s.isCorrect ? 'Đúng' : 'Sai'}`).join(', ');
                      setCorrectAnswer(ansStr);
                    }}
                    className={`px-2.5 py-1 rounded text-xs font-bold border ${
                      st.isCorrect
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-rose-100 text-rose-800 border-rose-300'
                    }`}
                  >
                    {st.isCorrect ? 'Đúng' : 'Sai'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* MATCHING Pairs */}
          {type === 'MATCHING' && (
            <div className="space-y-2">
              <label className="font-semibold text-slate-800 block">Các cặp ghép nối (Cột trái - Cột phải):</label>
              {pairs.map((p, i) => (
                <div key={p.id} className="flex items-center gap-2">
                  <span className="w-6 font-bold text-slate-600 shrink-0">{i + 1}.</span>
                  <input
                    type="text"
                    value={p.left}
                    onChange={(e) => {
                      const next = [...pairs];
                      next[i] = { ...next[i], left: e.target.value };
                      setPairs(next);
                    }}
                    placeholder="Vế trái (khái niệm, biểu thức...)"
                    className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                  <span className="text-slate-400 font-bold">⇄</span>
                  <input
                    type="text"
                    value={p.right}
                    onChange={(e) => {
                      const next = [...pairs];
                      next[i] = { ...next[i], right: e.target.value };
                      setPairs(next);
                    }}
                    placeholder="Vế phải (định nghĩa, kết quả...)"
                    className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Correct Answer */}
          <div>
            <label className="block font-semibold text-slate-800 mb-1">
              Đáp án chuẩn / Khóa đáp án <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={correctAnswer}
              onChange={(e) => setCorrectAnswer(e.target.value)}
              placeholder="VD: A hoặc 4,5 hoặc a: Đúng, b: Sai..."
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-blue-700 font-mono"
            />
          </div>

          {/* Explanation */}
          <div>
            <label className="block font-semibold text-slate-800 mb-1">
              Lời giải chi tiết & Sư phạm:
            </label>
            <textarea
              rows={3}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Giải thích từng bước, hướng dẫn tư duy..."
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono"
            />
          </div>

          {/* Scoring guide for essay */}
          {type === 'ESSAY' && (
            <div>
              <label className="block font-semibold text-slate-800 mb-1">
                Hướng dẫn chấm / Tiêu chí biểu điểm:
              </label>
              <textarea
                rows={2}
                value={scoringGuide}
                onChange={(e) => setScoringGuide(e.target.value)}
                placeholder="Ý 1 (0.5đ): Nêu đúng định nghĩa. Ý 2 (1.0đ): Tính toán chính xác kết quả."
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono"
              />
            </div>
          )}

          {/* Footer actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100 font-medium text-xs"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{isNew ? 'Thêm vào đề thi' : 'Cập nhật câu hỏi'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
