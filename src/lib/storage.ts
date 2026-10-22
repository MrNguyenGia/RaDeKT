import { openDB, IDBPDatabase } from 'idb';
import { BankQuestion, Exam, ExamConfig, Question, SavedExamRecord } from '../types';

export const CONFIG_STORAGE_KEY = 'stem_exam_last_config';
export const SAVED_EXAMS_FALLBACK_KEY = 'stem_saved_exams_fallback';
export const QUESTION_BANK_FALLBACK_KEY = 'stem_question_bank_fallback';

const DB_NAME = 'StemExamDB';
const DB_VERSION = 1;

/**
 * Cờ phát hiện môi trường có đang sử dụng LocalStorage làm dự phòng hay không
 */
let isFallbackModeActive = false;

export function isStorageFallbackActive(): boolean {
  return isFallbackModeActive;
}

/**
 * Chuẩn hóa văn bản câu hỏi để so khớp trùng lặp:
 * - Chuyển chữ thường
 * - Loại bỏ ký tự đặc biệt, dấu câu, thẻ công thức $...$, khoảng trắng thừa
 */
export function normalizeQuestionText(text?: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/\$+/g, '') // Bỏ ký hiệu KaTeX
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'’“”]/g, '') // Bỏ dấu câu
    .replace(/\s+/g, ' ') // Gộp khoảng trắng
    .trim();
}

/**
 * =========================================================================
 * (A) LƯU CẤU HÌNH BẰNG LOCALSTORAGE
 * =========================================================================
 */

/**
 * Lưu các lựa chọn thiết lập gần nhất vào localStorage.
 * KHÔNG lưu file tải lên (base64) và văn bản dán dài để tránh vượt quá dung lượng.
 */
export function saveExamConfigToStorage(config: ExamConfig): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;

    // Lọc bỏ file tải lên base64 và nội dung thô lớn
    const safeConfigToPersist: Partial<ExamConfig> = {
      schoolLevel: config.schoolLevel,
      grade: config.grade,
      subject: config.subject,
      customSubject: config.customSubject,
      curriculum: config.curriculum,
      examType: config.examType,
      durationMinutes: config.durationMinutes,
      questionCountsByType: config.questionCountsByType,
      levelCounts: config.levelCounts,
      levelDistribution: config.levelDistribution,
      levelMode: config.levelMode,
      use3LevelsPrimary: config.use3LevelsPrimary,
      trueFalseType: config.trueFalseType,
      scale: config.scale,
      roundingStep: config.roundingStep,
      knowledgeSource: config.knowledgeSource,
      knowledgeScope: config.knowledgeScope,
      topicName: config.topicName,
      chapter: config.chapter,
      numberOfVersions: config.numberOfVersions,
      departmentName: config.departmentName,
      schoolName: config.schoolName,
      academicYear: config.academicYear,
      teacherName: config.teacherName,
      lockTeacherQuestions: config.lockTeacherQuestions,
      importedMatrix: config.importedMatrix,
    };

    window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(safeConfigToPersist));
    return true;
  } catch (err) {
    console.warn('Không thể lưu cấu hình vào localStorage:', err);
    return false;
  }
}

/**
 * Khôi phục cấu hình gần nhất từ localStorage
 */
export function loadExamConfigFromStorage(): Partial<ExamConfig> | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed;
    }
    return null;
  } catch (err) {
    console.warn('Không thể đọc cấu hình từ localStorage:', err);
    return null;
  }
}

/**
 * Xóa cấu hình đã lưu trong localStorage
 */
export function clearExamConfigFromStorage(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    window.localStorage.removeItem(CONFIG_STORAGE_KEY);
    return true;
  } catch (err) {
    console.warn('Lỗi khi xóa cấu hình khỏi localStorage:', err);
    return false;
  }
}

/**
 * =========================================================================
 * KHỞI TẠO INDEXEDDB & CƠ CHẾ DỰ PHÒNG LOCALSTORAGE
 * =========================================================================
 */

async function getDatabase(): Promise<IDBPDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    isFallbackModeActive = true;
    return null;
  }

  try {
    const db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(database) {
        // Bảng 1: Lưu các đề kiểm tra hoàn chỉnh
        if (!database.objectStoreNames.contains('savedExams')) {
          const examStore = database.createObjectStore('savedExams', { keyPath: 'id' });
          examStore.createIndex('updatedAt', 'updatedAt');
          examStore.createIndex('subject', 'subject');
        }

        // Bảng 2: Ngân hàng câu hỏi
        if (!database.objectStoreNames.contains('questionBank')) {
          const bankStore = database.createObjectStore('questionBank', { keyPath: 'id' });
          bankStore.createIndex('createdAt', 'createdAt');
          bankStore.createIndex('subject', 'subject');
          bankStore.createIndex('level', 'level');
          bankStore.createIndex('type', 'type');
          bankStore.createIndex('normalizedText', 'normalizedText');
        }
      },
    });
    isFallbackModeActive = false;
    return db;
  } catch (err) {
    console.warn('Lỗi kết nối IndexedDB, chuyển sang LocalStorage dự phòng:', err);
    isFallbackModeActive = true;
    return null;
  }
}

/**
 * Loại bỏ trường imageData khi lưu vào LocalStorage dự phòng.
 * Quy định: Ảnh chỉ lưu trong IndexedDB, tuyệt đối không đưa vào localStorage.
 */
function stripImageDataForLocalStorage<T>(obj: T): T {
  try {
    return JSON.parse(
      JSON.stringify(obj, (key, value) => {
        if (key === 'imageData') return undefined;
        return value;
      })
    );
  } catch {
    return obj;
  }
}

/**
 * Tính tổng dung lượng (bytes) của tất cả ảnh imageData trong một đề thi
 */
export function calculateExamImagesBytes(exam: Exam): number {
  let totalBytes = 0;
  const countedUrls = new Set<string>();

  const processQuestion = (q?: Question) => {
    if (q?.imageData?.dataUrl && !countedUrls.has(q.imageData.dataUrl)) {
      countedUrls.add(q.imageData.dataUrl);
      // Data URL base64 xấp xỉ bytes: length * 0.75
      totalBytes += Math.round(q.imageData.dataUrl.length * 0.75);
    }
  };

  exam.questions?.forEach(processQuestion);
  exam.versions?.forEach((v) => v.questions?.forEach(processQuestion));

  return totalBytes;
}

/**
 * Helper dự phòng localStorage cho savedExams (chỉ lưu metadata & text, không lưu ảnh)
 */
function getFallbackExams(): SavedExamRecord[] {
  try {
    const raw = localStorage.getItem(SAVED_EXAMS_FALLBACK_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveFallbackExams(list: SavedExamRecord[]) {
  try {
    const safeList = stripImageDataForLocalStorage(list);
    localStorage.setItem(SAVED_EXAMS_FALLBACK_KEY, JSON.stringify(safeList));
  } catch (e) {
    console.warn('Lỗi lưu fallback exams:', e);
  }
}

/**
 * Helper dự phòng localStorage cho questionBank (chỉ lưu metadata & text, không lưu ảnh)
 */
function getFallbackQuestions(): BankQuestion[] {
  try {
    const raw = localStorage.getItem(QUESTION_BANK_FALLBACK_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveFallbackQuestions(list: BankQuestion[]) {
  try {
    const safeList = stripImageDataForLocalStorage(list);
    localStorage.setItem(QUESTION_BANK_FALLBACK_KEY, JSON.stringify(safeList));
  } catch (e) {
    console.warn('Lỗi lưu fallback questions:', e);
  }
}

/**
 * =========================================================================
 * (B) QUẢN LÝ ĐỀ ĐÃ LƯU (SAVED EXAMS)
 * =========================================================================
 */

/**
 * Lưu toàn bộ Exam vào IndexedDB (hoặc localStorage dự phòng)
 * Kèm cảnh báo nếu tổng dung lượng ảnh của đề vượt 20 MB.
 */
export async function saveExamToDb(
  exam: Exam
): Promise<{ success: boolean; id: string; isFallback: boolean; warning?: string }> {
  const totalImageBytes = calculateExamImagesBytes(exam);
  let warning: string | undefined = undefined;
  const LIMIT_20MB = 20 * 1024 * 1024;
  if (totalImageBytes > LIMIT_20MB) {
    const sizeMb = (totalImageBytes / (1024 * 1024)).toFixed(1);
    warning = `Cảnh báo: Tổng dung lượng ảnh của đề thi (${sizeMb} MB) đã vượt quá 20 MB. Vui lòng cân nhắc nén hoặc giảm bớt ảnh để tránh tràn bộ nhớ trình duyệt.`;
  }

  const db = await getDatabase();
  const record: SavedExamRecord = {
    id: exam.id || `exam_${Date.now()}`,
    title: exam.title || 'Đề kiểm tra',
    subject: exam.config.customSubject?.trim() || exam.config.subject || 'Môn học',
    grade: exam.config.grade || undefined,
    schoolLevel: exam.config.schoolLevel,
    questionCount: exam.questions.length,
    createdAt: exam.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    exam: {
      ...exam,
      updatedAt: new Date().toISOString(),
    },
  };

  if (!db) {
    // Fallback LocalStorage (Đã tự động loại bỏ imageData)
    const current = getFallbackExams();
    const existingIdx = current.findIndex((item) => item.id === record.id);
    if (existingIdx !== -1) {
      current[existingIdx] = record;
    } else {
      current.unshift(record);
    }
    saveFallbackExams(current);
    return { success: true, id: record.id, isFallback: true, warning };
  }

  try {
    await db.put('savedExams', record);
    return { success: true, id: record.id, isFallback: false, warning };
  } catch (err) {
    console.error('Lỗi khi lưu đề vào IndexedDB:', err);
    // Thử lưu vào fallback
    const current = getFallbackExams();
    current.unshift(record);
    saveFallbackExams(current);
    return { success: true, id: record.id, isFallback: true, warning };
  }
}

/**
 * Lấy danh sách tất cả các đề đã lưu
 */
export async function getSavedExamsFromDb(): Promise<SavedExamRecord[]> {
  const db = await getDatabase();
  if (!db) {
    const list = getFallbackExams();
    return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  try {
    const all = await db.getAll('savedExams');
    return (all as SavedExamRecord[]).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  } catch (err) {
    console.error('Lỗi đọc đề từ IndexedDB:', err);
    return getFallbackExams();
  }
}

/**
 * Xóa một đề thi đã lưu
 */
export async function deleteSavedExamFromDb(id: string): Promise<boolean> {
  const db = await getDatabase();
  if (!db) {
    const list = getFallbackExams().filter((item) => item.id !== id);
    saveFallbackExams(list);
    return true;
  }

  try {
    await db.delete('savedExams', id);
    return true;
  } catch (err) {
    console.error('Lỗi khi xóa đề khỏi IndexedDB:', err);
    return false;
  }
}

/**
 * Đổi tên một đề thi đã lưu
 */
export async function updateSavedExamTitle(id: string, newTitle: string): Promise<boolean> {
  const trimmed = newTitle.trim();
  if (!trimmed) return false;

  const db = await getDatabase();
  if (!db) {
    const list = getFallbackExams();
    const item = list.find((i) => i.id === id);
    if (item) {
      item.title = trimmed;
      item.exam.title = trimmed;
      item.updatedAt = new Date().toISOString();
      saveFallbackExams(list);
      return true;
    }
    return false;
  }

  try {
    const record = (await db.get('savedExams', id)) as SavedExamRecord | undefined;
    if (!record) return false;
    record.title = trimmed;
    record.exam.title = trimmed;
    record.updatedAt = new Date().toISOString();
    await db.put('savedExams', record);
    return true;
  } catch (err) {
    console.error('Lỗi khi đổi tên đề thi:', err);
    return false;
  }
}

/**
 * Nhân bản một đề thi đã lưu
 */
export async function duplicateSavedExam(id: string): Promise<SavedExamRecord | null> {
  const db = await getDatabase();
  let original: SavedExamRecord | undefined;

  if (!db) {
    original = getFallbackExams().find((item) => item.id === id);
  } else {
    try {
      original = await db.get('savedExams', id);
    } catch {
      original = getFallbackExams().find((item) => item.id === id);
    }
  }

  if (!original) return null;

  const newId = `exam_copy_${Date.now()}`;
  const now = new Date().toISOString();
  const clonedExam: Exam = {
    ...original.exam,
    id: newId,
    title: `${original.title} (Bản sao)`,
    createdAt: now,
    updatedAt: now,
  };

  const newRecord: SavedExamRecord = {
    ...original,
    id: newId,
    title: `${original.title} (Bản sao)`,
    createdAt: now,
    updatedAt: now,
    exam: clonedExam,
  };

  if (!db) {
    const list = getFallbackExams();
    list.unshift(newRecord);
    saveFallbackExams(list);
    return newRecord;
  }

  try {
    await db.put('savedExams', newRecord);
    return newRecord;
  } catch (err) {
    console.error('Lỗi khi nhân bản đề thi:', err);
    return null;
  }
}

/**
 * =========================================================================
 * (C) QUẢN LÝ NGÂN HÀNG CÂU HỎI (QUESTION BANK)
 * =========================================================================
 */

/**
 * Lấy tất cả câu hỏi trong ngân hàng
 */
export async function getBankQuestions(): Promise<BankQuestion[]> {
  const db = await getDatabase();
  if (!db) {
    const list = getFallbackQuestions();
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  try {
    const all = await db.getAll('questionBank');
    return (all as BankQuestion[]).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (err) {
    console.error('Lỗi khi lấy câu hỏi từ ngân hàng:', err);
    return getFallbackQuestions();
  }
}

/**
 * Lưu một câu hỏi vào ngân hàng (kèm kiểm tra trùng lặp)
 */
export async function saveQuestionToBank(
  q: Question,
  config: ExamConfig,
  forceDuplicate: boolean = false
): Promise<{ success: boolean; isDuplicate: boolean; savedItem?: BankQuestion }> {
  const normText = normalizeQuestionText(q.question);
  const allCurrent = await getBankQuestions();

  const isDuplicate = allCurrent.some(
    (item) => item.normalizedText === normText && item.type === q.type
  );

  if (isDuplicate && !forceDuplicate) {
    return { success: false, isDuplicate: true };
  }

  const bankItem: BankQuestion = {
    id: `bank_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    questionId: q.id,
    subject: config.customSubject?.trim() || config.subject || 'Môn học',
    grade: config.grade || undefined,
    schoolLevel: config.schoolLevel,
    topic: q.topic || config.topicName || 'Kiến thức trọng tâm',
    type: q.type,
    level: q.level,
    score: q.score,
    question: q.question,
    options: q.options,
    statements: q.statements,
    pairs: q.pairs,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
    scoringGuide: q.scoringGuide,
    createdAt: new Date().toISOString(),
    source: q.isTeacherWritten ? 'GV' : 'AI',
    normalizedText: normText,
    figure: q.figure,
    imageData: q.imageData,
  };

  const db = await getDatabase();
  if (!db) {
    const list = getFallbackQuestions();
    list.unshift(bankItem);
    saveFallbackQuestions(list);
    return { success: true, isDuplicate: false, savedItem: bankItem };
  }

  try {
    await db.put('questionBank', bankItem);
    return { success: true, isDuplicate: false, savedItem: bankItem };
  } catch (err) {
    console.error('Lỗi khi lưu câu hỏi vào ngân hàng:', err);
    const list = getFallbackQuestions();
    list.unshift(bankItem);
    saveFallbackQuestions(list);
    return { success: true, isDuplicate: false, savedItem: bankItem };
  }
}

/**
 * Lưu TẤT CẢ câu hỏi trong đề vào ngân hàng
 */
export async function saveAllQuestionsToBank(
  questions: Question[],
  config: ExamConfig
): Promise<{ addedCount: number; duplicateCount: number }> {
  const allCurrent = await getBankQuestions();
  const existingNorms = new Set(allCurrent.map((i) => `${i.type}___${i.normalizedText}`));

  let addedCount = 0;
  let duplicateCount = 0;

  const toAdd: BankQuestion[] = [];

  for (const q of questions) {
    const norm = normalizeQuestionText(q.question);
    const key = `${q.type}___${norm}`;

    if (existingNorms.has(key)) {
      duplicateCount++;
      continue;
    }

    existingNorms.add(key);
    addedCount++;

    toAdd.push({
      id: `bank_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      questionId: q.id,
      subject: config.customSubject?.trim() || config.subject || 'Môn học',
      grade: config.grade || undefined,
      schoolLevel: config.schoolLevel,
      topic: q.topic || config.topicName || 'Kiến thức trọng tâm',
      type: q.type,
      level: q.level,
      score: q.score,
      question: q.question,
      options: q.options,
      statements: q.statements,
      pairs: q.pairs,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      scoringGuide: q.scoringGuide,
      createdAt: new Date().toISOString(),
      source: q.isTeacherWritten ? 'GV' : 'AI',
      normalizedText: norm,
      figure: q.figure,
      imageData: q.imageData,
    });
  }

  if (toAdd.length === 0) {
    return { addedCount, duplicateCount };
  }

  const db = await getDatabase();
  if (!db) {
    const list = getFallbackQuestions();
    saveFallbackQuestions([...toAdd, ...list]);
    return { addedCount, duplicateCount };
  }

  try {
    const tx = db.transaction('questionBank', 'readwrite');
    for (const item of toAdd) {
      await tx.store.put(item);
    }
    await tx.done;
    return { addedCount, duplicateCount };
  } catch (err) {
    console.error('Lỗi khi lưu hàng loạt câu hỏi vào ngân hàng:', err);
    const list = getFallbackQuestions();
    saveFallbackQuestions([...toAdd, ...list]);
    return { addedCount, duplicateCount };
  }
}

/**
 * Xóa một câu hỏi khỏi ngân hàng
 */
export async function deleteBankQuestion(id: string): Promise<boolean> {
  const db = await getDatabase();
  if (!db) {
    const list = getFallbackQuestions().filter((i) => i.id !== id);
    saveFallbackQuestions(list);
    return true;
  }

  try {
    await db.delete('questionBank', id);
    return true;
  } catch (err) {
    console.error('Lỗi khi xóa câu hỏi khỏi ngân hàng:', err);
    return false;
  }
}

/**
 * Xóa nhiều câu hỏi khỏi ngân hàng cùng lúc
 */
export async function deleteMultipleBankQuestions(ids: string[]): Promise<boolean> {
  const idSet = new Set(ids);
  const db = await getDatabase();

  if (!db) {
    const list = getFallbackQuestions().filter((i) => !idSet.has(i.id));
    saveFallbackQuestions(list);
    return true;
  }

  try {
    const tx = db.transaction('questionBank', 'readwrite');
    for (const id of ids) {
      await tx.store.delete(id);
    }
    await tx.done;
    return true;
  } catch (err) {
    console.error('Lỗi khi xóa nhiều câu hỏi:', err);
    return false;
  }
}

/**
 * Sửa thông tin một câu hỏi trong ngân hàng
 */
export async function updateBankQuestion(
  id: string,
  patch: Partial<BankQuestion>
): Promise<boolean> {
  const db = await getDatabase();
  if (!db) {
    const list = getFallbackQuestions();
    const idx = list.findIndex((i) => i.id === id);
    if (idx !== -1) {
      const updated = {
        ...list[idx],
        ...patch,
        normalizedText: patch.question
          ? normalizeQuestionText(patch.question)
          : list[idx].normalizedText,
      };
      list[idx] = updated;
      saveFallbackQuestions(list);
      return true;
    }
    return false;
  }

  try {
    const existing = (await db.get('questionBank', id)) as BankQuestion | undefined;
    if (!existing) return false;
    const updated: BankQuestion = {
      ...existing,
      ...patch,
      normalizedText: patch.question
        ? normalizeQuestionText(patch.question)
        : existing.normalizedText,
    };
    await db.put('questionBank', updated);
    return true;
  } catch (err) {
    console.error('Lỗi khi sửa câu hỏi trong ngân hàng:', err);
    return false;
  }
}

/**
 * Nhân bản một câu hỏi trong ngân hàng
 */
export async function duplicateBankQuestion(id: string): Promise<BankQuestion | null> {
  const all = await getBankQuestions();
  const target = all.find((i) => i.id === id);
  if (!target) return null;

  const cloned: BankQuestion = {
    ...target,
    id: `bank_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    question: `${target.question} (Bản sao)`,
    createdAt: new Date().toISOString(),
    normalizedText: normalizeQuestionText(`${target.question} (Bản sao)`),
  };

  const db = await getDatabase();
  if (!db) {
    const list = getFallbackQuestions();
    list.unshift(cloned);
    saveFallbackQuestions(list);
    return cloned;
  }

  try {
    await db.put('questionBank', cloned);
    return cloned;
  } catch (err) {
    console.error('Lỗi nhân bản câu hỏi trong ngân hàng:', err);
    return null;
  }
}

/**
 * Xuất dữ liệu ngân hàng ra chuỗi JSON
 */
export async function exportBankToJson(questions?: BankQuestion[]): Promise<string> {
  const dataToExport = questions || (await getBankQuestions());
  const backupObject = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    totalQuestions: dataToExport.length,
    description: 'Dữ liệu Ngân hàng câu hỏi Hệ thống Sinh Đề Chuẩn 3 Cấp',
    questions: dataToExport,
  };
  return JSON.stringify(backupObject, null, 2);
}

/**
 * Nhập dữ liệu ngân hàng từ chuỗi JSON (Bỏ qua câu trùng lặp)
 */
export async function importBankFromJson(
  jsonText: string
): Promise<{ addedCount: number; duplicateCount: number; error?: string }> {
  try {
    const parsed = JSON.parse(jsonText);
    const questionsArray: any[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.questions)
      ? parsed.questions
      : [];

    if (questionsArray.length === 0) {
      return { addedCount: 0, duplicateCount: 0, error: 'Không tìm thấy câu hỏi hợp lệ trong file JSON.' };
    }

    const currentList = await getBankQuestions();
    const existingNorms = new Set(currentList.map((i) => `${i.type}___${i.normalizedText}`));

    const validQuestionsToAdd: BankQuestion[] = [];
    let duplicateCount = 0;

    for (const item of questionsArray) {
      if (!item.question || !item.type) continue;

      const norm = normalizeQuestionText(item.question);
      const key = `${item.type}___${norm}`;

      if (existingNorms.has(key)) {
        duplicateCount++;
        continue;
      }

      existingNorms.add(key);
      validQuestionsToAdd.push({
        id: `bank_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        questionId: item.questionId || `q_${Date.now()}`,
        subject: item.subject || 'Môn học',
        grade: item.grade,
        schoolLevel: item.schoolLevel,
        topic: item.topic || 'Chủ đề',
        type: item.type,
        level: item.level || 'NB',
        score: item.score ?? 0.25,
        question: item.question,
        options: item.options,
        statements: item.statements,
        pairs: item.pairs,
        correctAnswer: item.correctAnswer || '',
        explanation: item.explanation || '',
        scoringGuide: item.scoringGuide,
        createdAt: item.createdAt || new Date().toISOString(),
        source: item.source || 'GV',
        normalizedText: norm,
      });
    }

    if (validQuestionsToAdd.length === 0) {
      return { addedCount: 0, duplicateCount };
    }

    const db = await getDatabase();
    if (!db) {
      const list = getFallbackQuestions();
      saveFallbackQuestions([...validQuestionsToAdd, ...list]);
      return { addedCount: validQuestionsToAdd.length, duplicateCount };
    }

    const tx = db.transaction('questionBank', 'readwrite');
    for (const q of validQuestionsToAdd) {
      await tx.store.put(q);
    }
    await tx.done;

    return { addedCount: validQuestionsToAdd.length, duplicateCount };
  } catch (err: any) {
    return { addedCount: 0, duplicateCount: 0, error: err?.message || 'File JSON không đúng định dạng.' };
  }
}
