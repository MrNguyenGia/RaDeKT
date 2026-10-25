import { Exam, ExamConfig, Question } from '../../types';

export type ExportActionType = 'PRINT' | 'WORD' | 'PDF' | 'COPY';
export type FormulaExportMode = 'OMML' | 'PNG';

export interface ExportOptions {
  includeExam: boolean; // 1. Đề thi
  includeAnswers: boolean; // 2. Đáp án
  includeScoring: boolean; // 3. Hướng dẫn chấm
  includeMatrix: boolean; // 4. Ma trận
  includeSpec: boolean; // 5. Bản đặc tả
  selectedVersionCode: string; // 'ALL' hoặc mã cụ thể ví dụ '101'
  formulaMode: FormulaExportMode; // 'OMML' (công thức Word sửa được) | 'PNG' (ảnh cố định)
  includeAiNotice: boolean; // In kèm dòng thông tin AI hỗ trợ (mặc định tắt)
  isDraft?: boolean; // Xuất bản nháp: chèn chú thích đỏ [CẦN KIỂM TRA: lý do] sau câu lỗi
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  includeExam: true,
  includeAnswers: true,
  includeScoring: true,
  includeMatrix: false,
  includeSpec: false,
  selectedVersionCode: 'ALL',
  formulaMode: 'OMML',
  includeAiNotice: false,
  isDraft: false,
};

export interface ResolvedVersionData {
  code: string;
  questions: Question[];
}
