/**
 * Định nghĩa toàn bộ kiểu dữ liệu cho ứng dụng RA ĐỀ KIỂM TRA AI – 3 CẤP
 */

/** Cấp học: Tiểu học (Lớp 1-5), THCS (Lớp 6-9), THPT (Lớp 10-12) */
export type SchoolLevel = 'TIEU_HOC' | 'THCS' | 'THPT';

/** Khối lớp từ 1 đến 12 */
export type Grade = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

/**
 * 4 mức độ nhận thức theo chuẩn đánh giá của Bộ Giáo dục và Đào tạo:
 * - NB: Nhận biết
 * - TH: Thông hiểu
 * - VD: Vận dụng
 * - VDC: Vận dụng cao
 */
export type Level = 'NB' | 'TH' | 'VD' | 'VDC';

/**
 * Các định dạng câu hỏi hỗ trợ:
 * - MCQ4: Trắc nghiệm khách quan 4 lựa chọn (A, B, C, D)
 * - MCQ_MULTI: Trắc nghiệm có thể chọn nhiều đáp án đúng
 * - TRUE_FALSE: Trắc nghiệm Đúng / Sai (dạng format mới THPT/THCS 4 ý a, b, c, d)
 * - MATCHING: Nối cột / Ghép cặp
 * - FILL_BLANK: Điền từ / Điền khuyết
 * - SHORT_ANSWER: Trả lời ngắn
 * - ESSAY: Tự luận
 */
export type QuestionType =
  | 'MCQ4'
  | 'MCQ_MULTI'
  | 'TRUE_FALSE'
  | 'MATCHING'
  | 'FILL_BLANK'
  | 'SHORT_ANSWER'
  | 'ESSAY';

/** Ý khẳng định trong câu hỏi Đúng / Sai */
export interface TrueFalseStatement {
  id: string;
  statement: string;
  isCorrect: boolean; // true = Đúng, false = Sai
  explanation?: string;
}

/** Cặp ghép trong câu hỏi Nối cột */
export interface MatchingPair {
  id: string;
  left: string;
  right: string;
}

/**
 * Phân bổ mức độ nhận thức (tổng = 100% hoặc theo số câu)
 */
export interface LevelDistribution {
  nbPercent: number; // Tỷ lệ % Nhận biết (vd: 40)
  thPercent: number; // Tỷ lệ % Thông hiểu (vd: 30)
  vdPercent: number; // Tỷ lệ % Vận dụng (vd: 20)
  vdcPercent: number; // Tỷ lệ % Vận dụng cao (vd: 10)
}

/**
 * Số lượng câu hỏi theo từng định dạng
 */
export type QuestionTypeCounts = Partial<Record<QuestionType, number>>;

export type ExamType =
  | 'THUONG_XUYEN' // Kiểm tra thường xuyên
  | '15_MIN' // 15 phút
  | 'MID_TERM' // Giữa kỳ
  | 'FINAL_TERM' // Cuối kỳ
  | 'REVIEW' // Ôn tập
  | 'PRACTICE' // Luyện tập
  | 'SURVEY' // Khảo sát
  | 'OTHER' // Khác
  | 'CUSTOM';

export type ReferenceDocKind = 'PDF' | 'DOCX' | 'TXT' | 'IMAGE';

/**
 * Cấu trúc tài liệu tham chiếu đã tải lên
 */
export interface ReferenceDoc {
  id: string;
  name: string;
  kind: ReferenceDocKind;
  mimeType: string;
  sizeBytes: number;
  text?: string;
  base64?: string;
}

/** Loại đoạn văn bản trích dẫn dán vào */
export type ReferenceSnippetType = 'SGK' | 'GIAO_AN' | 'MA_TRAN_CU' | 'NGU_LIEU' | 'OTHER';

/** Một đoạn văn bản tham chiếu được dán */
export interface ReferenceSnippet {
  id: string;
  type: ReferenceSnippetType;
  title?: string;
  content: string;
  createdAt: string;
}

/**
 * 3 chế độ nguồn kiến thức để ra đề:
 * - 'UPLOAD_ONLY': Chỉ sử dụng tài liệu tải lên (không tự bịa dữ kiện nếu thiếu thông tin).
 * - 'UPLOAD_PLUS_CURRICULUM': Tài liệu tải lên + kiến thức chương trình phổ thông (mặc định).
 * - 'TEACHER_INPUT': Giáo viên tự nhập nội dung (chỉ dùng nội dung ở Bước 1).
 */
export type KnowledgeSource = 'UPLOAD_ONLY' | 'UPLOAD_PLUS_CURRICULUM' | 'TEACHER_INPUT';

/** Kiểu bài tự luận bổ sung */
export type EssayStyle =
  | 'SHORT_QUESTION' // Câu hỏi ngắn
  | 'EXPLAIN' // Giải thích
  | 'PRESENT' // Trình bày
  | 'SOLVE_EXERCISE' // Giải bài tập
  | 'ANALYZE' // Phân tích
  | 'COMPARE' // So sánh
  | 'READING_COMPREHENSION' // Đọc hiểu
  | 'ESSAY_WRITING'; // Viết bài

/** Kiểu câu hỏi Đúng / Sai */
export type TrueFalseType = 'SINGLE' | 'CLUSTER4';

/**
 * Thiết lập toàn bộ cấu hình đề kiểm tra
 */
export interface ExamConfig {
  schoolLevel?: SchoolLevel;
  grade?: Grade | null;
  subject: string;
  customSubject?: string; // Nhập tên môn học khác (ưu tiên cao hơn môn chọn sẵn)
  
  // Chi tiết nội dung kiến thức
  topicName?: string; // Tên bài / chủ đề
  chapter?: string; // Chương
  knowledgeScope: string; // Phạm vi kiến thức
  testContent?: string; // Nội dung cần kiểm tra
  learningOutcomes?: string; // Yêu cầu cần đạt
  notes?: string; // Ghi chú
  rawLessonContent?: string; // Vùng văn bản lớn để dán nội dung bài học (đếm ký tự)
  topics?: KnowledgeTopic[]; // Danh sách chủ đề / đơn vị kiến thức có trọng số

  // Khu vực tài liệu tham chiếu & nguồn kiến thức
  knowledgeSource: KnowledgeSource; // 3 chế độ nguồn kiến thức
  referenceDocs: ReferenceDoc[]; // Danh sách file đã tải
  referenceSnippets: ReferenceSnippet[]; // Danh sách đoạn văn bản đã dán

  knowledgeSourceType: 'MANUAL_INPUT' | 'DOCX_UPLOAD' | 'CURRICULUM_STANDARD'; // Nguồn kiến thức (tương thích cũ)
  knowledgeSourceContent?: string; // Dữ liệu tài liệu
  examType: ExamType; // Loại đề
  title: string; // Tên đề
  durationMinutes: number; // Thời gian làm bài (phút)

  // Thông tin tiêu đề (không bắt buộc)
  schoolName?: string; // Tên trường
  departmentName?: string; // Sở / Phòng GDĐT
  academicYear?: string; // Năm học
  teacherName?: string; // Tên giáo viên

  questionCountsByType: QuestionTypeCounts; // Số câu từng dạng
  essayStyle?: EssayStyle; // Trường phụ tự luận
  trueFalseType?: TrueFalseType; // 'SINGLE' hoặc 'CLUSTER4' (mặc định CLUSTER4 ở THPT, SINGLE ở cấp còn lại)
  trueFalseProgressiveScoring?: boolean; // Chấm lũy tiến cho CLUSTER4: đúng 1 ý = 10%, 2 ý = 25%, 3 ý = 50%, 4 ý = 100%

  // Mức độ nhận thức
  levelMode?: 'PERCENT' | 'COUNT'; // Nhập theo tỷ lệ % hay số câu
  levelDistribution: LevelDistribution; // Phân bổ mức độ (%)
  levelCounts?: Record<Level, number>; // Số câu tương ứng theo mức
  use3LevelsPrimary?: boolean; // Tùy chọn 3 mức cho Tiểu học (Mức 1 = NB, Mức 2 = TH, Mức 3 = VD, ẩn VDC)

  // Bảng phân bổ Dạng câu x Mức độ (hàng: dạng câu, cột: mức độ)
  blueprintMatrix?: Partial<Record<QuestionType, Record<Level, number>>>;

  // Thang điểm & làm tròn
  scale: number; // Thang điểm (thường là 10)
  roundingStep?: number; // Bước làm tròn: 0.05 | 0.1 | 0.25 (mặc định 0.25)
  sectionScoringEnabled?: boolean; // Tùy chọn nhập điểm theo phần (Trắc nghiệm / Tự luận)
  sectionScores?: { objectiveScore?: number; essayScore?: number }; // Điểm từng phần
  customSlotScores?: Record<string, number>; // Điểm tùy chỉnh theo ô câu hỏi

  numberOfVersions: number; // Số mã đề cần sinh (vd: 1, 2, 4)
  curriculum?: 'CANH_DIEU' | 'KET_NOI' | 'CHAN_TROI' | 'CUSTOM'; // Bộ sách giáo khoa

  // Câu hỏi do giáo viên tự nhập ở cột trái
  teacherQuestions?: Question[]; // Danh sách câu hỏi GV tự nhập
  lockTeacherQuestions?: boolean; // Công tắc: Giữ nguyên câu hỏi GV tự nhập khi sinh đề

  // Ma trận nhập sẵn từ file/bảng (Tính năng "Tạo từ ma trận có sẵn")
  importedMatrix?: ParsedMatrix | null;
}

/** Ô dữ liệu trong ma trận đọc từ tài liệu/bảng */
export interface MatrixCell {
  level: Level;
  questionType: QuestionType;
  count: number;
  points?: number;
}

/** Chủ đề trong ma trận đọc từ tài liệu/bảng */
export interface MatrixTopic {
  id?: string;
  name: string;
  requirement?: string;
  cells: MatrixCell[];
}

/** Dữ liệu ma trận hoàn chỉnh đọc từ Gemini hoặc người dùng chỉnh sửa */
export interface ParsedMatrix {
  totalPoints?: number;
  totalQuestions?: number;
  topics: MatrixTopic[];
  warnings: string[];
}

export interface KnowledgeTopic {
  id: string;
  name: string;
  learningOutcome?: string;
  weight: number; // Trọng số (số tiết hoặc %, mặc định = 1)
}

/**
 * Ô chỉ mục trong Ma trận / Bản đặc tả (mỗi ô là một câu hỏi sẽ được sinh)
 */
export interface BlueprintSlot {
  id: string;
  questionType: QuestionType;
  level: Level;
  topic: string;
  learningOutcome?: string;
  score: number;
  orderNumber: number;
}

export type FunctionGraphFigure = {
  kind: 'function-graph';
  functions: { expr: string; label?: string }[];
  xRange: [number, number];
  yRange?: [number, number];
  points?: { x: number; y: number; label?: string }[];
  showGrid?: boolean;
};

export type GeometryFigure = {
  kind: 'geometry';
  points: { id: string; x: number; y: number; label: string }[];
  segments?: [string, string][];
  dashed?: [string, string][];
  circles?: { center: string; radius: number }[];
  polygons?: string[][];
  rightAngles?: [string, string, string][];
};

export type VariationTableFigure = {
  kind: 'variation-table';
  xValues: string[];
  yValues: string[];
  trends: ('up' | 'down')[];
  derivativeSigns?: ('+' | '-')[];
};

export type DataChartFigure = {
  kind: 'data-chart';
  chartType: 'bar' | 'line' | 'pie';
  title?: string;
  labels: string[];
  series: { name: string; values: number[] }[];
  unit?: string;
};

export type QuestionFigure =
  | FunctionGraphFigure
  | GeometryFigure
  | VariationTableFigure
  | DataChartFigure;

export interface QuestionImageData {
  dataUrl: string; // Base64 data URL của ảnh (đã nén và thu nhỏ <= 1000px)
  caption?: string; // Chú thích hình ảnh
  widthPercent?: number; // Độ rộng hiển thị (20% - 100%)
}

/**
 * Cấu trúc một câu hỏi hoàn chỉnh
 */
export interface Question {
  id: string;
  slotId: string;
  subject: string;
  topic: string;
  type: QuestionType;
  level: Level;
  question: string; // Nội dung câu hỏi (chứa LaTeX $...$ nếu có)
  options?: string[]; // 4 lựa chọn A, B, C, D (cho MCQ4)
  optionExprs?: string[]; // Biểu thức từng phương án theo cú pháp mathjs, cùng thứ tự với options
  statements?: TrueFalseStatement[]; // Các mệnh đề cho TRUE_FALSE
  pairs?: MatchingPair[]; // Cặp ghép cho MATCHING
  correctAnswer: string; // Đáp án đúng (A, B, C, D hoặc từ điền, hoặc tóm tắt)
  explanation: string; // Lời giải chi tiết
  scoringGuide?: string; // Hướng dẫn chấm / tiêu chí biểu điểm
  score: number; // Điểm số của câu
  needsReview: boolean; // Cần giáo viên rà soát lại (true/false)
  reviewNote?: string; // Ghi chú cảnh báo/lưu ý cho giáo viên
  isTeacherWritten: boolean; // Do giáo viên tự viết hay AI sinh ra
  figure?: QuestionFigure; // Cấu trúc dữ liệu hình vẽ chuẩn để sinh SVG bằng code
  svgDiagram?: string; // Mã SVG hình vẽ dự phòng
  imageData?: QuestionImageData; // Ảnh chèn do giáo viên tải lên (ưu tiên cao hơn figure)
  rawAiResponse?: any; // Phản hồi gốc của Gemini cho câu đó (trước mọi bước xử lý/sửa)
  rawParseError?: string; // Lỗi parse nếu có
  regenerationCount?: number; // Số lần đã tự sinh lại
}

/**
 * Một mã đề cụ thể (được xáo trộn câu/đáp án từ đề gốc)
 */
export interface ExamVersion {
  code: string; // Mã đề (vd: "101", "102")
  questions: Question[];
}

/**
 * Đối tượng Đề kiểm tra tổng thể
 */
export interface Exam {
  id: string;
  title: string;
  config: ExamConfig;
  blueprint: BlueprintSlot[];
  questions: Question[];
  versions: ExamVersion[];
  createdAt: string;
  updatedAt: string;
}

/** Tab xem trước ở cột bên phải */
export type PreviewTab =
  | 'EXAM' // Tab 1: Đề kiểm tra
  | 'ANSWERS' // Tab 2: Đáp án
  | 'SCORING' // Tab 3: Hướng dẫn chấm
  | 'MATRIX' // Tab 4: Ma trận & Bản đặc tả
  | 'SPECIFICATION' // Bản đặc tả
  | 'STATS'; // Tab 5: Thống kê

/**
 * Câu hỏi trong Ngân hàng câu hỏi
 */
export interface BankQuestion {
  id: string; // ID duy nhất trong ngân hàng
  questionId?: string; // ID câu hỏi gốc (nếu có)
  subject: string;
  grade?: Grade;
  schoolLevel?: SchoolLevel;
  topic?: string;
  type: QuestionType;
  level: Level;
  score: number;
  question: string;
  options?: string[];
  statements?: TrueFalseStatement[];
  pairs?: MatchingPair[];
  correctAnswer: string;
  explanation: string;
  scoringGuide?: string;
  createdAt: string;
  source: 'AI' | 'GV';
  normalizedText: string; // Văn bản đã chuẩn hóa để so khớp trùng lặp
  figure?: QuestionFigure;
  imageData?: QuestionImageData;
}

/**
 * Bản ghi đề thi lưu trữ trong IndexedDB / LocalStorage
 */
export interface SavedExamRecord {
  id: string;
  title: string;
  subject: string;
  grade?: Grade;
  schoolLevel?: SchoolLevel;
  questionCount: number;
  createdAt: string;
  updatedAt: string;
  exam: Exam;
}

