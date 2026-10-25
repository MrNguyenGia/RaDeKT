import { ExamConfig, Level, QuestionType, SchoolLevel } from './types';

/**
 * CẤU HÌNH MODEL GEMINI DUY NHẤT
 * Sử dụng model Gemini mặc định do Google AI Studio đề xuất.
 * Thay đổi tại đây sẽ áp dụng cho toàn bộ ứng dụng.
 */
export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';

/**
 * Model tạo ảnh của Gemini được AI Studio đề xuất cho tác vụ sinh hình ảnh
 */
export const GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-lite-image';

/**
 * Tên ứng dụng và khẩu hiệu
 */
export const APP_NAME = 'RA ĐỀ KIỂM TRA AI – 3 CẤP';
export const APP_SUBTITLE = 'Tiểu học • THCS • THPT – Áp dụng cho mọi môn học';
export const APP_DISCLAIMER =
  'Đề được AI hỗ trợ tạo. Giáo viên cần kiểm duyệt nội dung trước khi sử dụng.';

/**
 * Ánh xạ tên gọi Mức độ nhận thức theo Bộ GD&ĐT
 */
export const LEVEL_LABELS: Record<Level, { label: string; short: string; color: string; description: string }> = {
  NB: {
    label: 'Nhận biết',
    short: 'NB',
    color: 'emerald',
    description: 'Nhận diện, nhớ lại các khái niệm, định lý, công thức cơ bản.',
  },
  TH: {
    label: 'Thông hiểu',
    short: 'TH',
    color: 'blue',
    description: 'Hiểu bản chất, giải thích, phân biệt và chuyển đổi dạng biểu đạt.',
  },
  VD: {
    label: 'Vận dụng',
    short: 'VD',
    color: 'amber',
    description: 'Áp dụng kiến thức đã học vào giải quyết tình huống quen thuộc.',
  },
  VDC: {
    label: 'Vận dụng cao',
    short: 'VDC',
    color: 'rose',
    description: 'Vận dụng tổng hợp kiến thức để xử lý tình huống mới, nâng cao.',
  },
};

/**
 * Ánh xạ tên gọi Định dạng câu hỏi
 */
export const QUESTION_TYPE_LABELS: Record<QuestionType, { label: string; short: string; defaultScore: number }> = {
  MCQ4: {
    label: 'Trắc nghiệm 4 lựa chọn (A, B, C, D)',
    short: 'TN 4 lựa chọn',
    defaultScore: 0.25,
  },
  MCQ_MULTI: {
    label: 'Trắc nghiệm nhiều đáp án đúng',
    short: 'Nhiều đáp án',
    defaultScore: 0.5,
  },
  TRUE_FALSE: {
    label: 'Trắc nghiệm Đúng / Sai (Định dạng mới)',
    short: 'Đúng / Sai',
    defaultScore: 1.0,
  },
  MATCHING: {
    label: 'Ghép nối cặp tương ứng',
    short: 'Ghép cặp',
    defaultScore: 0.5,
  },
  FILL_BLANK: {
    label: 'Điền từ / Điền khuyết',
    short: 'Điền khuyết',
    defaultScore: 0.25,
  },
  SHORT_ANSWER: {
    label: 'Trả lời ngắn',
    short: 'Trả lời ngắn',
    defaultScore: 0.5,
  },
  ESSAY: {
    label: 'Tự luận / Tự luận mở',
    short: 'Tự luận',
    defaultScore: 2.0,
  },
};

/**
/**
 * Thông tin các cấp học
 */
export const SCHOOL_LEVEL_OPTIONS: {
  key: SchoolLevel;
  title: string;
  badge: string;
  gradesText: string;
  description: string;
}[] = [
  {
    key: 'TIEU_HOC',
    title: 'Tiểu học',
    badge: 'Cấp 1',
    gradesText: 'Lớp 1 – Lớp 5',
    description: 'Chú trọng hình ảnh trực quan, câu hỏi gợi mở, bài học sinh động.',
  },
  {
    key: 'THCS',
    title: 'THCS',
    badge: 'Cấp 2',
    gradesText: 'Lớp 6 – Lớp 9',
    description: 'Phát triển tư duy logic, cấu trúc ma trận chuẩn đổi mới GDPT 2018.',
  },
  {
    key: 'THPT',
    title: 'THPT',
    badge: 'Cấp 3',
    gradesText: 'Lớp 10 – Lớp 12',
    description: 'Bám sát định dạng thi tốt nghiệp THPT, đánh giá năng lực & tư duy.',
  },
];

/**
 * Danh sách môn học chuẩn Chương trình GDPT 2018 theo từng cấp
 */
export const SUBJECTS_BY_LEVEL: Record<SchoolLevel, string[]> = {
  TIEU_HOC: [
    'Toán',
    'Tiếng Việt',
    'Tiếng Anh',
    'Khoa học',
    'Lịch sử và Địa lí',
    'Tin học',
    'Đạo đức',
    'Công nghệ',
  ],
  THCS: [
    'Toán',
    'Ngữ văn',
    'Tiếng Anh',
    'Khoa học tự nhiên',
    'Lịch sử và Địa lí',
    'Giáo dục công dân',
    'Tin học',
    'Công nghệ',
  ],
  THPT: [
    'Toán',
    'Ngữ văn',
    'Tiếng Anh',
    'Vật lí',
    'Hóa học',
    'Sinh học',
    'Lịch sử',
    'Địa lí',
    'Giáo dục kinh tế và pháp luật',
    'Tin học',
    'Công nghệ',
  ],
};

/**
 * Các khối lớp theo cấp học
 */
export const GRADES_BY_LEVEL: Record<SchoolLevel, number[]> = {
  TIEU_HOC: [1, 2, 3, 4, 5],
  THCS: [6, 7, 8, 9],
  THPT: [10, 11, 12],
};

/**
 * Danh sách các loại đề kiểm tra
 */
export const EXAM_TYPE_OPTIONS: {
  value: 'THUONG_XUYEN' | '15_MIN' | 'MID_TERM' | 'FINAL_TERM' | 'REVIEW' | 'PRACTICE' | 'SURVEY' | 'OTHER';
  label: string;
  defaultDuration: number;
}[] = [
  { value: 'THUONG_XUYEN', label: 'Kiểm tra thường xuyên', defaultDuration: 15 },
  { value: '15_MIN', label: '15 phút', defaultDuration: 15 },
  { value: 'MID_TERM', label: 'Giữa kỳ', defaultDuration: 45 },
  { value: 'FINAL_TERM', label: 'Cuối kỳ', defaultDuration: 60 },
  { value: 'REVIEW', label: 'Ôn tập', defaultDuration: 45 },
  { value: 'PRACTICE', label: 'Luyện tập', defaultDuration: 30 },
  { value: 'SURVEY', label: 'Khảo sát', defaultDuration: 45 },
  { value: 'OTHER', label: 'Khác', defaultDuration: 45 },
];

/**
 * Các mốc thời gian làm bài nhanh (phút)
 */
export const QUICK_DURATIONS: number[] = [10, 15, 30, 45, 60, 90, 120];

/**
/**
 * Danh sách dạng bài tự luận
 */
export const ESSAY_STYLE_OPTIONS: { value: 'SHORT_QUESTION' | 'EXPLAIN' | 'PRESENT' | 'SOLVE_EXERCISE' | 'ANALYZE' | 'COMPARE' | 'READING_COMPREHENSION' | 'ESSAY_WRITING'; label: string }[] = [
  { value: 'SHORT_QUESTION', label: 'Câu hỏi ngắn' },
  { value: 'EXPLAIN', label: 'Giải thích' },
  { value: 'PRESENT', label: 'Trình bày' },
  { value: 'SOLVE_EXERCISE', label: 'Giải bài tập' },
  { value: 'ANALYZE', label: 'Phân tích' },
  { value: 'COMPARE', label: 'So sánh' },
  { value: 'READING_COMPREHENSION', label: 'Đọc hiểu' },
  { value: 'ESSAY_WRITING', label: 'Viết bài' },
];

/**
 * Thứ tự sắp xếp dạng câu hỏi từ dễ đến khó để tự động phân bổ ma trận
 */
export const QUESTION_TYPES_ORDER: QuestionType[] = [
  'FILL_BLANK',
  'MCQ4',
  'TRUE_FALSE',
  'MCQ_MULTI',
  'MATCHING',
  'SHORT_ANSWER',
  'ESSAY',
];

/**
 * Các bước làm tròn điểm số
 */
export const ROUNDING_STEPS = [0.05, 0.1, 0.25];

/**
 * Tính năm học mặc định dựa trên ngày hiện tại:
 * Từ tháng 8 trở đi là năm nay - năm sau, trước tháng 8 là năm trước - năm nay
 */
export function getDefaultAcademicYear(date: Date = new Date()): string {
  const month = date.getMonth() + 1; // 1-12
  const year = date.getFullYear();
  return month >= 8 ? `${year} - ${year + 1}` : `${year - 1} - ${year}`;
}

/**
 * Định dạng điểm số theo chuẩn chính tả văn bản Việt Nam:
 * - Dấu thập phân là dấu phẩy (0,25; 1,5), không dùng dấu chấm.
 * - Bỏ số 0 thừa (1,0 thành 1; 0,50 thành 0,5; 0,25 thành 0,25; 10 thành 10).
 */
export function formatScore(n: number | string | undefined | null): string {
  if (n === undefined || n === null || n === '') return '0';
  const num = typeof n === 'number' ? n : parseFloat(String(n).replace(',', '.'));
  if (isNaN(num)) return String(n);
  const rounded = Math.round(num * 100) / 100;
  return rounded.toString().replace('.', ',');
}

/**
 * Định dạng tên trường ở tiêu đề đầu đề:
 * Nếu để trống thì in dòng chấm "TRƯỜNG: ........................................" để giáo viên điền tay
 */
export function formatSchoolNameForHeader(schoolName?: string): string {
  const trimmed = schoolName?.trim();
  if (trimmed) return trimmed.toUpperCase();
  return 'TRƯỜNG: ........................................';
}

/**
 * Định dạng cơ quan quản lý (Sở / Phòng) ở tiêu đề đầu đề:
 * Nếu để trống thì in dòng chấm để giáo viên tự điền
 */
export function formatDepartmentForHeader(dept?: string): string {
  const trimmed = dept?.trim();
  if (trimmed) return trimmed.toUpperCase();
  return 'SỞ GIÁO DỤC VÀ ĐÀO TẠO ........................................';
}

/**
 * Cấu hình khởi tạo mặc định cho đề kiểm tra
 */
export const DEFAULT_EXAM_CONFIG: ExamConfig = {
  schoolLevel: 'THPT',
  grade: 12,
  subject: 'Toán',
  customSubject: '',
  topicName: 'Khảo sát sự biến thiên và vẽ đồ thị hàm số',
  chapter: 'Chương 1: Ứng dụng đạo hàm để khảo sát hàm số',
  knowledgeScope: 'Đơn điệu, cực trị, giá trị lớn nhất - nhỏ nhất, tiệm cận của đồ thị hàm số',
  testContent: 'Khảo sát hàm số bậc ba, hàm phân thức hữu tỉ, bài toán thực tế',
  learningOutcomes: 'Học sinh nhận biết và giải quyết được các bài toán liên quan đến đồ thị và tính chất hàm số',
  notes: 'Đề bám sát cấu trúc đề minh họa mới của Bộ GD&ĐT',
  rawLessonContent: '',
  knowledgeSource: 'UPLOAD_PLUS_CURRICULUM',
  referenceDocs: [],
  referenceSnippets: [],
  knowledgeSourceType: 'CURRICULUM_STANDARD',
  examType: 'MID_TERM',
  title: 'Đề kiểm tra giữa học kỳ I - Môn Toán 12',
  durationMinutes: 45,
  schoolName: '',
  departmentName: '',
  academicYear: getDefaultAcademicYear(),
  teacherName: '',
  scale: 10,
  roundingStep: 0.25,
  sectionScoringEnabled: false,
  sectionScores: { objectiveScore: 7, essayScore: 3 },
  customSlotScores: {},
  numberOfVersions: 2,
  curriculum: 'KET_NOI',
  questionCountsByType: {
    MCQ4: 12,
    TRUE_FALSE: 4,
    SHORT_ANSWER: 6,
    ESSAY: 0,
  },
  essayStyle: 'SOLVE_EXERCISE',
  trueFalseType: 'CLUSTER4',
  trueFalseProgressiveScoring: true,
  levelMode: 'PERCENT',
  use3LevelsPrimary: false,
  levelDistribution: {
    nbPercent: 40,
    thPercent: 30,
    vdPercent: 20,
    vdcPercent: 10,
  },
  levelCounts: {
    NB: 9,
    TH: 7,
    VD: 4,
    VDC: 2,
  },
  teacherQuestions: [],
  lockTeacherQuestions: true,
};

/**
 * Bảng ước tính thời gian làm bài trung bình (phút / câu) theo Dạng câu và Mức độ nhận thức.
 * Cấu hình tập trung tại đây để giáo viên / quản trị viên dễ dàng tinh chỉnh.
 */
export const ESTIMATED_MINUTES_PER_QUESTION: Record<QuestionType, Record<Level, number>> = {
  MCQ4: { NB: 1.0, TH: 1.5, VD: 2.5, VDC: 4.0 },
  MCQ_MULTI: { NB: 1.5, TH: 2.0, VD: 3.0, VDC: 5.0 },
  TRUE_FALSE: { NB: 2.0, TH: 3.0, VD: 4.5, VDC: 6.0 },
  MATCHING: { NB: 1.5, TH: 2.5, VD: 3.5, VDC: 5.0 },
  FILL_BLANK: { NB: 1.0, TH: 1.5, VD: 2.5, VDC: 3.5 },
  SHORT_ANSWER: { NB: 1.5, TH: 2.5, VD: 4.0, VDC: 6.0 },
  ESSAY: { NB: 4.0, TH: 6.0, VD: 9.0, VDC: 14.0 },
};

/**
 * Thông tin định nghĩa 12 tiêu chí chất lượng đề kiểm tra
 */
export interface QualityCriterionInfo {
  id: number;
  name: string;
  category: 'CODE' | 'AI';
  shortDesc: string;
  description: string;
}

export const QUALITY_CRITERIA_LIST: QualityCriterionInfo[] = [
  {
    id: 1,
    name: 'Đúng số câu theo từng dạng',
    category: 'CODE',
    shortDesc: 'Khớp số lượng câu hỏi theo từng dạng',
    description: 'Số câu thực tế của mỗi dạng câu hỏi khớp đúng với thiết lập ma trận.',
  },
  {
    id: 2,
    name: 'Đúng phân bổ mức độ',
    category: 'CODE',
    shortDesc: 'Khớp phân bổ 4 mức độ nhận thức (NB, TH, VD, VDC)',
    description: 'Tỷ lệ và số lượng câu hỏi theo 4 mức độ nhận thức đúng với cấu hình đề.',
  },
  {
    id: 3,
    name: 'Đúng tổng điểm và điểm từng câu',
    category: 'CODE',
    shortDesc: 'Tổng điểm toàn bài bằng thang điểm (10đ), điểm thành phần hợp lệ',
    description: 'Tổng điểm toàn bài bằng đúng thang điểm đề ra, điểm từng câu khớp với ma trận.',
  },
  {
    id: 4,
    name: 'Không trùng lặp câu hỏi',
    category: 'CODE',
    shortDesc: 'Chuẩn hóa văn bản, kiểm tra độ tương đồng (< 70%)',
    description: 'Không có câu hỏi trùng lặp hoặc có nội dung tương tự nhau trên 70%.',
  },
  {
    id: 5,
    name: 'Cấu trúc câu hợp lệ',
    category: 'CODE',
    shortDesc: 'Đủ 4 lựa chọn, đủ ý Đúng/Sai, đủ cặp ghép nối',
    description: 'Cấu trúc câu hỏi đầy đủ dữ liệu, không bị cắt cụt, đúng quy cách từng định dạng.',
  },
  {
    id: 6,
    name: 'Đủ đáp án, lời giải, hướng dẫn chấm',
    category: 'CODE',
    shortDesc: 'Đầy đủ đáp án, lời giải sư phạm chi tiết và biểu điểm',
    description: 'Mọi câu đều có đáp án chính xác, lời giải chi tiết và barem chấm điểm.',
  },
  {
    id: 7,
    name: 'Thời lượng làm bài hợp lý',
    category: 'CODE',
    shortDesc: 'Tổng thời gian ước tính làm bài phù hợp thời lượng đề (chỉ cảnh báo)',
    description: 'Thời gian học sinh giải đề nằm trong khoảng cho phép so với thời lượng thi.',
  },
  {
    id: 8,
    name: 'Đáp án đúng (Giải độc lập)',
    category: 'AI',
    shortDesc: 'AI giải độc lập không nhìn đáp án để đối chiếu',
    description: 'Gemini tự giải độc lập toàn bộ câu hỏi và đối chiếu đáp án với đề thi.',
  },
  {
    id: 9,
    name: 'Phương án nhiễu hợp lý, cùng kiểu dữ liệu',
    category: 'AI',
    shortDesc: 'Phương án nhiễu có tính sư phạm, cùng loại dữ liệu',
    description: 'Các lựa chọn sai có tính phân hóa tốt, cùng đơn vị/dạng thức với đáp án đúng.',
  },
  {
    id: 10,
    name: 'Đủ dữ kiện, không vô nghiệm, không mơ hồ',
    category: 'AI',
    shortDesc: 'Đề bài chặt chẽ, dữ kiện đầy đủ, không thiếu điều kiện',
    description: 'Đề bài không bị khuyết dữ kiện, bài toán có nghiệm duy nhất, câu hỏi rành mạch.',
  },
  {
    id: 11,
    name: 'Đúng phạm vi kiến thức, lớp, môn, tài liệu',
    category: 'AI',
    shortDesc: 'Bám sát Chương trình GDPT 2018 và tài liệu cung cấp',
    description: 'Nội dung bám sát đúng khối lớp, chương trình học và tài liệu giáo viên đã cấp.',
  },
  {
    id: 12,
    name: 'Chính tả, ngữ pháp, thuật ngữ khoa học',
    category: 'AI',
    shortDesc: 'Chuẩn chính tả, ngữ pháp tiếng Việt và công thức LaTeX',
    description: 'Không sai sót từ ngữ, lỗi chính tả, công thức LaTeX chuẩn xác, thuật ngữ chuẩn.',
  },
];
