import React, { createContext, useContext, useState, useRef, useEffect, ReactNode } from 'react';
import { DEFAULT_EXAM_CONFIG, QUALITY_CRITERIA_LIST, QUESTION_TYPES_ORDER } from '../config';
import { buildBlueprint } from '../lib/blueprint';
import { generateExamVersions } from '../lib/shuffle';
import { allocateIntegerScores } from '../lib/scoring';
import { runCodeQualityCheck } from '../lib/validate';
import {
  generateCompleteExam,
  regenerateSingleQuestion,
  regenerateSlotWithContext,
  formatAiErrorMessage,
} from '../services/gemini';
import { QualityCheckReport, runQualityCheck } from '../services/quality';
import { BlueprintSlot, Exam, ExamConfig, Level, ParsedMatrix, PreviewTab, Question, QuestionType } from '../types';
import { ExportActionType } from '../lib/export/types';
import {
  saveExamConfigToStorage,
  loadExamConfigFromStorage,
  clearExamConfigFromStorage,
  saveExamToDb,
  saveQuestionToBank,
  saveAllQuestionsToBank,
  getBankQuestions,
  isStorageFallbackActive,
} from '../lib/storage';

export interface GenerationProgress {
  batchIndex: number;
  totalBatches: number;
  currentSlotRange: string;
  percent: number;
}

interface ExamContextType {
  config: ExamConfig;
  updateConfig: (patch: Partial<ExamConfig>) => void;
  resetConfig: () => void;
  blueprint: BlueprintSlot[];
  isBlueprintStale: boolean;
  generateBlueprintAction: () => BlueprintSlot[];
  currentExam: Exam | null;
  setCurrentExam: (exam: Exam | null) => void;
  activeTab: PreviewTab;
  setActiveTab: (tab: PreviewTab) => void;
  isGenerating: boolean;
  generationProgress: GenerationProgress | null;
  generationError: string | null;
  startGenerateExam: () => Promise<void>;
  startGenerateEquivalentExam: () => Promise<void>;
  isExamOutdated: boolean;
  cancelGeneration: () => void;
  selectedVersionIndex: number;
  setSelectedVersionIndex: (index: number) => void;
  updateQuestion: (questionId: string, patch: Partial<Question>) => void;
  deleteQuestionAction: (questionId: string) => void;
  insertQuestionAction: (index: number, customData?: Partial<Question>) => void;
  regeneratingQuestionId: string | null;
  regenerateQuestionAction: (questionId: string, customHint?: string) => Promise<void>;
  generateNewVersionsAction: (count: number) => void;
  redistributeScoresAction: () => void;
  undo: () => void;
  canUndo: boolean;
  redo: () => void;
  canRedo: boolean;
  historyLength: number;
  addTeacherQuestion: (q: Question) => void;
  updateTeacherQuestion: (id: string, patch: Partial<Question>) => void;
  removeTeacherQuestion: (id: string) => void;
  setTeacherQuestions: (qs: Question[]) => void;
  notificationMessage: string | null;
  setNotificationMessage: (msg: string | null) => void;
  qualityReport: QualityCheckReport | null;
  setQualityReport: (report: QualityCheckReport | null) => void;
  isQualityChecking: boolean;
  runManualQualityCheck: () => Promise<QualityCheckReport | null>;

  // (A) Lưu cấu hình (localStorage)
  restoreSavedConfigAction: () => void;
  clearSavedConfigAction: () => void;
  hasSavedConfig: boolean;

  // (B) Lưu đề thi (IndexedDB / LocalStorage)
  isSavedExamsModalOpen: boolean;
  setIsSavedExamsModalOpen: (open: boolean) => void;
  saveCurrentExamAction: () => Promise<boolean>;
  loadExamFromSaved: (exam: Exam) => void;

  // (C) Ngân hàng câu hỏi (IndexedDB / LocalStorage)
  isBankModalOpen: boolean;
  setIsBankModalOpen: (open: boolean) => void;
  bankCount: number;
  refreshBankCount: () => Promise<void>;
  saveQuestionToBankAction: (
    q: Question,
    forceDuplicate?: boolean
  ) => Promise<{ success: boolean; isDuplicate: boolean }>;
  saveAllQuestionsToBankAction: () => Promise<{ addedCount: number; duplicateCount: number }>;
  insertBankQuestionsToCurrentExam: (questions: Question[]) => void;
  setBankQuestionsAsTeacherQuestions: (questions: Question[]) => void;

  // Xuất bản & In ấn (Print, Word, PDF, Copy)
  exportModalState: { isOpen: boolean; action: ExportActionType };
  openExportModal: (action?: ExportActionType) => void;
  closeExportModal: () => void;

  // Tạo từ ma trận có sẵn
  isMatrixModalOpen: boolean;
  setIsMatrixModalOpen: (open: boolean) => void;
  applyImportedMatrixAction: (matrix: ParsedMatrix) => void;
  removeImportedMatrixAction: () => void;
}

const ExamContext = createContext<ExamContextType | undefined>(undefined);

/**
 * Phát âm thanh thông báo nhẹ nhàng bằng Web Audio API khi hoàn tất tạo đề
 */
function playSuccessChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.12, start + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration);
    };

    // Chuỗi âm C5 -> E5 -> G5 vui tươi
    playTone(523.25, now, 0.25);
    playTone(659.25, now + 0.12, 0.25);
    playTone(783.99, now + 0.24, 0.4);
  } catch {
    // Không chặn nếu trình duyệt chưa có tương tác audio
  }
}

/**
 * Tự động chạy lại tiêu chí 1-7 bằng code khi giáo viên chỉnh sửa/thay đổi câu hỏi
 */
function refreshQualityCodeIssues(
  currentReport: QualityCheckReport | null,
  updatedExam: Exam
): QualityCheckReport | null {
  if (!currentReport) return null;
  const newCodeIssues = runCodeQualityCheck(updatedExam);

  // Giữ lại các issue AI từ lượt A & B (tiêu chí 8..12), thay thế hoàn toàn các issue code 1..7
  const remainingAiIssues = (currentReport.allIssues || []).filter((i) => i.criterion >= 8);
  const combinedIssues = [...newCodeIssues, ...remainingAiIssues];

  const updatedSummaries = QUALITY_CRITERIA_LIST.map((crit) => {
    const matchingIssues = combinedIssues.filter((i) => i.criterion === crit.id);
    const hasError = matchingIssues.some((i) => i.severity === 'ERROR');
    const hasWarn = matchingIssues.some((i) => i.severity === 'WARN');
    let status: 'PASS' | 'WARN' | 'ERROR' = 'PASS';
    if (hasError) status = 'ERROR';
    else if (hasWarn) status = 'WARN';

    return {
      id: crit.id,
      name: crit.name,
      category: crit.category,
      shortDesc: crit.shortDesc,
      description: crit.description,
      status,
      issues: matchingIssues,
    };
  });

  return {
    ...currentReport,
    timestamp: new Date().toLocaleTimeString('vi-VN'),
    totalIssues: combinedIssues.length,
    errorCount: combinedIssues.filter((i) => i.severity === 'ERROR').length,
    warnCount: combinedIssues.filter((i) => i.severity === 'WARN').length,
    criteriaSummaries: updatedSummaries,
    allIssues: combinedIssues,
    exam: updatedExam,
  };
}

export const ExamProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<ExamConfig>(DEFAULT_EXAM_CONFIG);
  const [blueprint, setBlueprint] = useState<BlueprintSlot[]>(() =>
    buildBlueprint(DEFAULT_EXAM_CONFIG)
  );
  const [isBlueprintStale, setIsBlueprintStale] = useState<boolean>(false);
  const [currentExam, setCurrentExam] = useState<Exam | null>(null);
  const [activeTab, setActiveTab] = useState<PreviewTab>('MATRIX');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [selectedVersionIndex, setSelectedVersionIndex] = useState<number>(0);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const [qualityReport, setQualityReport] = useState<QualityCheckReport | null>(null);
  const [isQualityChecking, setIsQualityChecking] = useState<boolean>(false);
  const [regeneratingQuestionId, setRegeneratingQuestionId] = useState<string | null>(null);
  const [isExamOutdated, setIsExamOutdated] = useState<boolean>(false);

  // Trạng thái cấu hình đã lưu
  const [hasSavedConfig, setHasSavedConfig] = useState<boolean>(false);

  // Trạng thái modal Đề đã lưu & Ngân hàng câu hỏi
  const [isSavedExamsModalOpen, setIsSavedExamsModalOpen] = useState<boolean>(false);
  const [isBankModalOpen, setIsBankModalOpen] = useState<boolean>(false);
  const [bankCount, setBankCount] = useState<number>(0);

  // Trạng thái modal Tạo từ ma trận có sẵn
  const [isMatrixModalOpen, setIsMatrixModalOpen] = useState<boolean>(false);

  // Trạng thái modal Xuất bản & In ấn
  const [exportModalState, setExportModalState] = useState<{
    isOpen: boolean;
    action: ExportActionType;
  }>({
    isOpen: false,
    action: 'PRINT',
  });

  const openExportModal = (action: ExportActionType = 'PRINT') => {
    setExportModalState({ isOpen: true, action });
  };

  const closeExportModal = () => {
    setExportModalState((prev) => ({ ...prev, isOpen: false }));
  };

  // Làm mới số lượng câu hỏi trong ngân hàng
  const refreshBankCount = async () => {
    try {
      const all = await getBankQuestions();
      setBankCount(all.length);
    } catch {
      // Bỏ qua lỗi
    }
  };

  // Ngăn xếp lưu lịch sử Hoàn tác (Undo) ít nhất 20 bước (lưu tối đa 35 bước)
  const [history, setHistory] = useState<Exam[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  const abortControllerRef = useRef<AbortController | null>(null);

  // 1. Tự động khôi phục cấu hình gần nhất khi mở app
  useEffect(() => {
    try {
      const saved = loadExamConfigFromStorage();
      if (saved && Object.keys(saved).length > 0) {
        setConfig((prev) => {
          const merged = { ...prev, ...saved };
          const newBp = buildBlueprint(merged);
          setBlueprint(newBp);
          return merged;
        });
        setHasSavedConfig(true);
        setNotificationMessage('Đã khôi phục cấu hình gần nhất');
        setTimeout(() => setNotificationMessage(null), 3000);
      }
    } catch (e) {
      console.warn('Lỗi khôi phục cấu hình:', e);
    }
    refreshBankCount();
  }, []);

  // 2. Tự động lưu cấu hình an toàn khi có thay đổi (bọc try/catch)
  useEffect(() => {
    try {
      saveExamConfigToStorage(config);
      setHasSavedConfig(true);
    } catch (e) {
      console.warn('Lỗi tự động lưu cấu hình:', e);
    }
  }, [config]);

  // Hành động Khôi phục cấu hình thủ công
  const restoreSavedConfigAction = () => {
    try {
      const saved = loadExamConfigFromStorage();
      if (saved && Object.keys(saved).length > 0) {
        setConfig((prev) => {
          const merged = { ...prev, ...saved };
          const newBp = buildBlueprint(merged);
          setBlueprint(newBp);
          setIsBlueprintStale(false);
          return merged;
        });
        setHasSavedConfig(true);
        setNotificationMessage('Đã khôi phục cấu hình gần nhất từ bộ nhớ');
        setTimeout(() => setNotificationMessage(null), 3000);
      } else {
        setNotificationMessage('Chưa có cấu hình nào được lưu trước đó');
        setTimeout(() => setNotificationMessage(null), 3000);
      }
    } catch (e) {
      console.warn('Lỗi khôi phục cấu hình:', e);
    }
  };

  // Hành động Xóa cấu hình
  const clearSavedConfigAction = () => {
    try {
      clearExamConfigFromStorage();
      setHasSavedConfig(false);
      resetConfig();
      setNotificationMessage('Đã xóa cấu hình đã lưu và đưa form về mặc định ban đầu');
      setTimeout(() => setNotificationMessage(null), 3500);
    } catch (e) {
      console.warn('Lỗi xóa cấu hình:', e);
    }
  };

  // Hành động Lưu đề kiểm tra (IndexedDB / LocalStorage)
  const saveCurrentExamAction = async (): Promise<boolean> => {
    if (!currentExam) {
      setNotificationMessage('Chưa có đề thi nào để lưu.');
      setTimeout(() => setNotificationMessage(null), 2500);
      return false;
    }

    try {
      const result = await saveExamToDb(currentExam);
      if (result.warning) {
        setNotificationMessage(result.warning);
        setTimeout(() => setNotificationMessage(null), 6000);
      } else if (result.isFallback) {
        setNotificationMessage(
          'Đã lưu đề thi vào LocalStorage dự phòng (IndexedDB không khả dụng trong môi trường này).'
        );
        setTimeout(() => setNotificationMessage(null), 4000);
      } else {
        setNotificationMessage('Đã lưu đề kiểm tra thành công vào bộ nhớ trình duyệt (IndexedDB)!');
        setTimeout(() => setNotificationMessage(null), 4000);
      }
      return true;
    } catch (e: any) {
      setNotificationMessage(`Không thể lưu đề: ${e?.message || 'Lỗi lưu trữ'}`);
      setTimeout(() => setNotificationMessage(null), 4000);
      return false;
    }
  };

  // Nạp đề thi từ danh sách đã lưu
  const loadExamFromSaved = (savedExam: Exam) => {
    setCurrentExam(savedExam);
    setConfig(savedExam.config);
    setBlueprint(savedExam.blueprint || buildBlueprint(savedExam.config));
    setHistory([savedExam]);
    setHistoryIndex(0);
    setActiveTab('EXAM');
    setNotificationMessage(`Đã mở đề thi: ${savedExam.title}`);
    setTimeout(() => setNotificationMessage(null), 3000);
  };

  // Lưu một câu hỏi vào ngân hàng
  const saveQuestionToBankAction = async (q: Question, forceDuplicate: boolean = false) => {
    const res = await saveQuestionToBank(q, config, forceDuplicate);
    if (res.success) {
      await refreshBankCount();
      setNotificationMessage('Đã lưu câu hỏi vào ngân hàng thành công!');
      setTimeout(() => setNotificationMessage(null), 3000);
    }
    return res;
  };

  // Lưu tất cả câu hỏi của đề vào ngân hàng
  const saveAllQuestionsToBankAction = async () => {
    if (!currentExam || currentExam.questions.length === 0) {
      return { addedCount: 0, duplicateCount: 0 };
    }
    const res = await saveAllQuestionsToBank(currentExam.questions, config);
    await refreshBankCount();
    setNotificationMessage(
      `Đã lưu ${res.addedCount} câu vào ngân hàng (${res.duplicateCount} câu trùng lặp đã bỏ qua)`
    );
    setTimeout(() => setNotificationMessage(null), 4000);
    return res;
  };

  // Thêm các câu hỏi ngân hàng vào đề thi hiện tại
  const insertBankQuestionsToCurrentExam = (newQuestions: Question[]) => {
    if (!currentExam) return;
    const updated = [...currentExam.questions, ...newQuestions];
    const nextExam = recomputeExamFromQuestions(
      currentExam,
      updated,
      currentExam.versions.length || 2
    );
    pushExamToHistory(nextExam);
    setQualityReport((prev) => refreshQualityCodeIssues(prev, nextExam));
    setNotificationMessage(`Đã thêm ${newQuestions.length} câu từ ngân hàng vào đề thi!`);
    setTimeout(() => setNotificationMessage(null), 3000);
  };

  // Dùng các câu ngân hàng làm câu GV nhập ở cột trái
  const setBankQuestionsAsTeacherQuestions = (newQuestions: Question[]) => {
    const current = config.teacherQuestions || [];
    updateConfig({
      teacherQuestions: [...current, ...newQuestions],
      lockTeacherQuestions: true,
    });
    setNotificationMessage(
      `Đã nạp ${newQuestions.length} câu vào danh sách Câu GV tự nhập (Đã bật Giữ nguyên)!`
    );
    setTimeout(() => setNotificationMessage(null), 3500);
  };

  const updateConfig = (patch: Partial<ExamConfig>) => {
    setConfig((prev) => ({
      ...prev,
      ...patch,
    }));
    setIsBlueprintStale(true);
    if (currentExam) {
      setIsExamOutdated(true);
    }
  };

  const resetConfig = () => {
    setConfig(DEFAULT_EXAM_CONFIG);
    const newBp = buildBlueprint(DEFAULT_EXAM_CONFIG);
    setBlueprint(newBp);
    setIsBlueprintStale(false);
  };

  /**
   * Tạo / Cập nhật Ma trận & Bản đặc tả theo thiết lập mới nhất
   */
  const generateBlueprintAction = (): BlueprintSlot[] => {
    const newBp = buildBlueprint(config);
    setBlueprint(newBp);
    setIsBlueprintStale(false);
    setActiveTab('MATRIX');
    return newBp;
  };

  /**
   * Nạp ma trận có sẵn vào cấu hình (Tính năng "Tạo từ ma trận có sẵn")
   * Nạp vào ExamConfig (số câu theo dạng, phân bổ mức độ, thang điểm bằng tổng điểm ma trận, danh sách chủ đề).
   * Khi có ma trận nạp vào, buildBlueprint dựng đúng từng ô (chủ đề × mức × dạng) theo ma trận, KHÔNG dùng thuật toán tự điền ở Bước 3.
   * Điểm từng ô: dùng điểm trong ma trận nếu có, nếu không có thì chia đều bằng scoring.ts.
   */
  const applyImportedMatrixAction = (parsedMatrix: ParsedMatrix) => {
    // 1. Số câu theo từng dạng câu hỏi
    const questionCountsByType: Partial<Record<QuestionType, number>> = {};
    parsedMatrix.topics.forEach((t) => {
      (t.cells || []).forEach((c) => {
        const cnt = Number(c.count) || 0;
        if (cnt > 0) {
          questionCountsByType[c.questionType] = (questionCountsByType[c.questionType] || 0) + cnt;
        }
      });
    });

    // 2. Phân bổ mức độ nhận thức
    const levelCounts: Record<Level, number> = { NB: 0, TH: 0, VD: 0, VDC: 0 };
    parsedMatrix.topics.forEach((t) => {
      (t.cells || []).forEach((c) => {
        const cnt = Number(c.count) || 0;
        if (cnt > 0 && c.level in levelCounts) {
          levelCounts[c.level] += cnt;
        }
      });
    });
    const totalQuestions = Object.values(levelCounts).reduce((a, b) => a + b, 0);
    const levelDistribution =
      totalQuestions > 0
        ? {
            nbPercent: Math.round((levelCounts.NB / totalQuestions) * 100),
            thPercent: Math.round((levelCounts.TH / totalQuestions) * 100),
            vdPercent: Math.round((levelCounts.VD / totalQuestions) * 100),
            vdcPercent: Math.round((levelCounts.VDC / totalQuestions) * 100),
          }
        : { nbPercent: 40, thPercent: 30, vdPercent: 20, vdcPercent: 10 };

    // 3. Thang điểm bằng tổng điểm ma trận (hoặc tổng điểm các ô nếu có)
    let targetScale = parsedMatrix.totalPoints;
    if (!targetScale || targetScale <= 0) {
      const sumPoints = parsedMatrix.topics.reduce(
        (acc, t) => acc + t.cells.reduce((ca, c) => ca + (c.points || 0), 0),
        0
      );
      targetScale = sumPoints > 0 ? sumPoints : config.scale || 10;
    }

    // 4. Danh sách chủ đề
    const topics = parsedMatrix.topics.map((t, idx) => ({
      id: t.id || `topic_${idx + 1}`,
      name: t.name,
      learningOutcome: t.requirement,
      weight: 1,
    }));

    // 5. Cập nhật blueprintMatrix dạng câu x mức độ (để đồng bộ giao diện lưới ở Bước 3)
    const blueprintMatrix: Partial<Record<QuestionType, Record<Level, number>>> = {};
    QUESTION_TYPES_ORDER.forEach((type) => {
      blueprintMatrix[type] = { NB: 0, TH: 0, VD: 0, VDC: 0 };
    });
    parsedMatrix.topics.forEach((t) => {
      (t.cells || []).forEach((c) => {
        const cnt = Number(c.count) || 0;
        if (cnt > 0 && blueprintMatrix[c.questionType]) {
          blueprintMatrix[c.questionType]![c.level] = (blueprintMatrix[c.questionType]![c.level] || 0) + cnt;
        }
      });
    });

    const updatedConfig: ExamConfig = {
      ...config,
      importedMatrix: parsedMatrix,
      questionCountsByType,
      levelCounts,
      levelDistribution,
      scale: targetScale,
      topics,
      blueprintMatrix,
      levelMode: 'COUNT',
      topicName: parsedMatrix.topics[0]?.name || config.topicName,
    };

    setConfig(updatedConfig);
    const newSlots = buildBlueprint(updatedConfig);
    setBlueprint(newSlots);
    setIsBlueprintStale(false);
    setIsMatrixModalOpen(false);
    setActiveTab('MATRIX');

    setNotificationMessage('Đã nạp ma trận có sẵn thành công! Bản đặc tả đã dựng chuẩn theo từng ô.');
    setTimeout(() => setNotificationMessage(null), 4000);
  };

  /**
   * Hủy bỏ việc dùng ma trận có sẵn và quay lại chế độ phân bổ tự động
   */
  const removeImportedMatrixAction = () => {
    const updatedConfig: ExamConfig = {
      ...config,
      importedMatrix: null,
    };
    setConfig(updatedConfig);
    const newSlots = buildBlueprint(updatedConfig);
    setBlueprint(newSlots);
    setIsBlueprintStale(false);
    setNotificationMessage('Đã hủy sử dụng ma trận nhập sẵn, quay lại phân bổ thông thường.');
    setTimeout(() => setNotificationMessage(null), 3000);
  };

  /**
   * Bắt đầu quy trình sinh đề kiểm tra hoàn chỉnh bằng AI
   */
  const startGenerateExam = async () => {
    // Tạo blueprint mới nhất nếu chưa có
    const currentSlots = buildBlueprint(config);
    setBlueprint(currentSlots);
    setIsBlueprintStale(false);

    if (currentSlots.length === 0) {
      setGenerationError('Cấu trúc đề hiện tại chưa có câu hỏi nào. Vui lòng kiểm tra lại số lượng câu.');
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);
    setGenerationProgress({
      batchIndex: 1,
      totalBatches: Math.ceil(currentSlots.length / 8),
      currentSlotRange: 'Đang khởi động kết nối...',
      percent: 5,
    });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // 1. Sinh các câu hỏi qua Gemini
      const generatedQuestions = await generateCompleteExam(
        config,
        currentSlots,
        (progress) => {
          // Ánh xạ tiến trình sinh đề chiếm 0% -> 80%
          setGenerationProgress({
            ...progress,
            percent: Math.max(5, Math.round(progress.percent * 0.8)),
          });
        },
        controller.signal
      );

      const examTitle =
        config.title?.trim() ||
        `Đề kiểm tra ${config.subject} Lớp ${config.grade || ''}`.trim();

      const initialDraftExam: Exam = {
        id: `exam_${Date.now()}`,
        title: examTitle,
        config: { ...config },
        blueprint: currentSlots,
        questions: generatedQuestions,
        versions: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // 2. Chạy quy trình kiểm tra chất lượng 12 tiêu chí tự động và tự sửa lỗi
      setGenerationProgress({
        batchIndex: currentSlots.length,
        totalBatches: currentSlots.length,
        currentSlotRange: 'Đang kiểm tra chất lượng 12 tiêu chí...',
        percent: 85,
      });

      let finalQuestions = generatedQuestions;
      try {
        const qualityResult = await runQualityCheck(
          initialDraftExam,
          (msg) => {
            setGenerationProgress((p) =>
              p
                ? {
                    ...p,
                    currentSlotRange: msg,
                    percent: Math.min(96, (p.percent || 85) + 3),
                  }
                : null
            );
          },
          controller.signal
        );

        finalQuestions = qualityResult.exam.questions;
        setQualityReport(qualityResult);
      } catch (qErr: any) {
        console.warn('Lỗi kiểm tra chất lượng tự động:', qErr?.message);
      }

      // 3. Tiến trình hoàn thiện đề thi
      setGenerationProgress({
        batchIndex: currentSlots.length,
        totalBatches: currentSlots.length,
        currentSlotRange: 'Đang hoàn thiện và tạo các mã đề hoán vị...',
        percent: 98,
      });

      // Tạo các mã đề hoán vị (mặc định 2 hoặc 4 mã đề)
      const numVersions = config.numberOfVersions || 2;
      const versions = generateExamVersions(finalQuestions, numVersions);

      const newExam: Exam = {
        id: `exam_${Date.now()}`,
        title: examTitle,
        config: { ...config },
        blueprint: currentSlots,
        questions: finalQuestions,
        versions,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setCurrentExam(newExam);
      setHistory([newExam]);
      setHistoryIndex(0);
      setSelectedVersionIndex(0);
      setIsExamOutdated(false);
      setIsGenerating(false);
      setGenerationProgress(null);

      // Tự chuyển sang tab Đề kiểm tra
      setActiveTab('EXAM');

      // Phát âm thanh nhẹ và hiện thông báo thành công
      playSuccessChime();
      const repairNotice =
        qualityReport && qualityReport.repairedCount > 0
          ? ` (Đã tự động sửa ${qualityReport.repairedCount} lỗi chất lượng)`
          : '';
      setNotificationMessage(
        `Đã tạo thành công đề kiểm tra gồm ${finalQuestions.length} câu hỏi!${repairNotice}`
      );
      setTimeout(() => setNotificationMessage(null), 5000);
    } catch (err: any) {
      setGenerationError(formatAiErrorMessage(err));
      setIsGenerating(false);
      setGenerationProgress(null);
    } finally {
      abortControllerRef.current = null;
    }
  };

  /**
   * Tạo đề tương đương: Giữ nguyên ma trận/bản đặc tả, sinh bộ câu hỏi mới hoàn toàn
   * Tránh lặp lại câu hỏi của đề hiện tại
   */
  const startGenerateEquivalentExam = async () => {
    const slots = currentExam?.blueprint || buildBlueprint(config);
    if (!slots || slots.length === 0) {
      setGenerationError('Chưa có cấu trúc ma trận để tạo đề tương đương.');
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);
    setGenerationProgress({
      batchIndex: 1,
      totalBatches: Math.ceil(slots.length / 8),
      currentSlotRange: 'Đang khởi động tạo đề tương đương...',
      percent: 5,
    });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const generatedQuestions = await generateCompleteExam(
        config,
        slots,
        (progress) => {
          setGenerationProgress({
            ...progress,
            percent: Math.max(5, Math.round(progress.percent * 0.8)),
          });
        },
        controller.signal,
        currentExam?.questions
      );

      const baseTitle =
        config.title?.trim() || currentExam?.title?.trim() || `Đề kiểm tra ${config.subject}`;
      const examTitle = baseTitle.includes('Đề tương đương')
        ? baseTitle
        : `${baseTitle} (Đề tương đương)`;

      const initialDraftExam: Exam = {
        id: `exam_${Date.now()}`,
        title: examTitle,
        config: { ...config },
        blueprint: slots,
        questions: generatedQuestions,
        versions: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setGenerationProgress({
        batchIndex: slots.length,
        totalBatches: slots.length,
        currentSlotRange: 'Đang kiểm tra chất lượng 12 tiêu chí...',
        percent: 85,
      });

      let finalQuestions = generatedQuestions;
      try {
        const qualityResult = await runQualityCheck(
          initialDraftExam,
          (msg) => {
            setGenerationProgress((p) =>
              p
                ? {
                    ...p,
                    currentSlotRange: msg,
                    percent: Math.min(96, (p.percent || 85) + 3),
                  }
                : null
            );
          },
          controller.signal
        );

        finalQuestions = qualityResult.exam.questions;
        setQualityReport(qualityResult);
      } catch (qErr: any) {
        console.warn('Lỗi kiểm tra chất lượng đề tương đương:', qErr?.message);
      }

      const numVersions = config.numberOfVersions || 2;
      const versions = generateExamVersions(finalQuestions, numVersions);

      const newExam: Exam = {
        id: `exam_${Date.now()}`,
        title: examTitle,
        config: { ...config },
        blueprint: slots,
        questions: finalQuestions,
        versions,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setCurrentExam(newExam);
      setHistory((prev) => [newExam, ...prev.slice(0, 30)]);
      setHistoryIndex(0);
      setSelectedVersionIndex(0);
      setIsExamOutdated(false);
      setIsGenerating(false);
      setGenerationProgress(null);
      setActiveTab('EXAM');

      playSuccessChime();
      setNotificationMessage(
        'Đã tạo thành công đề tương đương (giữ nguyên ma trận, làm mới 100% câu hỏi)!'
      );
      setTimeout(() => setNotificationMessage(null), 5000);
    } catch (err: any) {
      setGenerationError(formatAiErrorMessage(err));
      setIsGenerating(false);
      setGenerationProgress(null);
    } finally {
      abortControllerRef.current = null;
    }
  };

  /**
   * Chạy kiểm tra chất lượng thủ công (khi giáo viên bấm nút "Kiểm tra đề")
   */
  const runManualQualityCheck = async (): Promise<QualityCheckReport | null> => {
    if (!currentExam) return null;
    setIsQualityChecking(true);
    try {
      const res = await runQualityCheck(currentExam);
      setQualityReport(res);

      if (res.repairedCount > 0) {
        setCurrentExam(res.exam);
        setNotificationMessage(
          `Đã hoàn tất kiểm tra và tự động sửa ${res.repairedCount} lỗi chất lượng!`
        );
        setTimeout(() => setNotificationMessage(null), 5000);
      }
      return res;
    } catch (err: any) {
      console.error('Lỗi khi chạy kiểm tra chất lượng:', err);
      return null;
    } finally {
      setIsQualityChecking(false);
    }
  };

  /**
   * Hủy quá trình đang tạo đề
   */
  const cancelGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    setGenerationProgress(null);
    setGenerationError('Quá trình tạo đề đã được hủy.');
  };

  /**
   * Tái tính toán và đồng bộ lại Exam khi có thay đổi:
   * - Tự đánh số lại câu (1..N) cho slotId / orderNumber
   * - Ma trận và bản đặc tả tính lại từ các câu thực có
   * - Tạo lại các phiên bản mã đề hoán vị
   */
  const recomputeExamFromQuestions = (
    current: Exam,
    updatedQuestions: Question[],
    numVersions: number = 2
  ): Exam => {
    // 1. Tự đánh số lại câu (1..N) và sinh BlueprintSlots thực tế
    const reindexedBlueprint: BlueprintSlot[] = updatedQuestions.map((q, idx) => ({
      id: q.slotId || `slot_${idx + 1}`,
      orderNumber: idx + 1,
      questionType: q.type,
      level: q.level,
      topic: q.topic || current.config.topicName || 'Kiến thức trọng tâm',
      score: q.score,
      learningOutcome: q.scoringGuide,
    }));

    // Đảm bảo slotId của q khớp với blueprint
    const syncedQuestions = updatedQuestions.map((q, idx) => ({
      ...q,
      slotId: q.slotId || reindexedBlueprint[idx].id,
    }));

    // 2. Tạo lại các phiên bản mã đề hoán vị
    const updatedVersions = generateExamVersions(syncedQuestions, numVersions);

    return {
      ...current,
      questions: syncedQuestions,
      blueprint: reindexedBlueprint,
      versions: updatedVersions,
      updatedAt: new Date().toISOString(),
    };
  };

  /**
   * Đẩy trạng thái mới vào ngăn xếp Hoàn tác (Undo Stack)
   */
  const pushExamToHistory = (newExam: Exam) => {
    setHistory((prev) => {
      const nextHistory = prev.slice(0, historyIndex + 1);
      nextHistory.push(newExam);
      if (nextHistory.length > 30) {
        nextHistory.shift();
      }
      return nextHistory;
    });
    setHistoryIndex((prev) => Math.min(prev + 1, 29));
    setCurrentExam(newExam);
  };

  /**
   * Hoàn tác (Undo) - quay lại trạng thái đề thi trước đó
   */
  const undo = () => {
    if (historyIndex > 0) {
      const prevIdx = historyIndex - 1;
      setHistoryIndex(prevIdx);
      setCurrentExam(history[prevIdx]);
      setNotificationMessage('Đã hoàn tác thay đổi gần nhất');
      setTimeout(() => setNotificationMessage(null), 2500);
    }
  };

  /**
   * Làm lại (Redo) - khôi phục trạng thái đã hoàn tác
   */
  const redo = () => {
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1;
      setHistoryIndex(nextIdx);
      setCurrentExam(history[nextIdx]);
      setNotificationMessage('Đã làm lại thao tác (Redo)');
      setTimeout(() => setNotificationMessage(null), 2500);
    }
  };

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex >= 0 && historyIndex < history.length - 1;

  /**
   * Cập nhật nội dung một câu hỏi (khi giáo viên chỉnh sửa):
   * - Bỏ nhãn "Cần GV kiểm tra" (needsReview = false)
   * - Tự đánh số lại câu và ma trận
   * - Lưu vào lịch sử Hoàn tác
   */
  const updateQuestion = (questionId: string, patch: Partial<Question>) => {
    if (!currentExam) return;

    const updatedQuestions = currentExam.questions.map((q) => {
      if (q.id === questionId) {
        return {
          ...q,
          ...patch,
          isTeacherWritten: true,
          needsReview: false,
          reviewNote: undefined,
        };
      }
      return q;
    });

    const nextExam = recomputeExamFromQuestions(
      currentExam,
      updatedQuestions,
      currentExam.versions.length || config.numberOfVersions || 2
    );

    pushExamToHistory(nextExam);
    setQualityReport((prev) => refreshQualityCodeIssues(prev, nextExam));
    setNotificationMessage('Đã lưu nội dung chỉnh sửa câu hỏi');
    setTimeout(() => setNotificationMessage(null), 2500);
  };

  /**
   * Xóa một câu hỏi khỏi đề thi:
   * - Tự đánh số lại các câu còn lại
   * - Tính lại ma trận và bản đặc tả
   * - Lưu vào lịch sử Hoàn tác
   */
  const deleteQuestionAction = (questionId: string) => {
    if (!currentExam) return;
    const targetIdx = currentExam.questions.findIndex((q) => q.id === questionId);
    if (targetIdx === -1) return;

    const updatedQuestions = currentExam.questions.filter((q) => q.id !== questionId);
    const nextExam = recomputeExamFromQuestions(
      currentExam,
      updatedQuestions,
      currentExam.versions.length || 2
    );

    pushExamToHistory(nextExam);
    setQualityReport((prev) => refreshQualityCodeIssues(prev, nextExam));
    setNotificationMessage(`Đã xóa câu hỏi số ${targetIdx + 1}`);
    setTimeout(() => setNotificationMessage(null), 3000);
  };

  /**
   * Thêm một câu hỏi mới vào vị trí bất kỳ (chèn sau câu hiện tại):
   * - Tự đánh số lại câu
   * - Tính lại ma trận và bản đặc tả
   * - Lưu vào lịch sử Hoàn tác
   */
  const insertQuestionAction = (index: number, customData?: Partial<Question>) => {
    if (!currentExam) return;

    const newId = `q_custom_${Date.now()}`;
    const newQuestion: Question = {
      id: newId,
      slotId: `slot_custom_${Date.now()}`,
      subject: config.customSubject?.trim() || config.subject || 'Môn học',
      topic: customData?.topic || config.topicName?.trim() || 'Chủ đề kiến thức',
      type: customData?.type || 'MCQ4',
      level: customData?.level || 'NB',
      question: customData?.question || 'Nhập nội dung câu hỏi mới tại đây...',
      options:
        customData?.options ||
        (customData?.type === 'MCQ4'
          ? ['A. Lựa chọn A', 'B. Lựa chọn B', 'C. Lựa chọn C', 'D. Lựa chọn D']
          : undefined),
      correctAnswer: customData?.correctAnswer || 'A',
      explanation: customData?.explanation || 'Giải thích chi tiết cho đáp án...',
      score: customData?.score ?? (customData?.type === 'ESSAY' ? 2.0 : 0.25),
      needsReview: false,
      isTeacherWritten: true,
      ...customData,
    };

    const updatedQuestions = [...currentExam.questions];
    const insertIdx = Math.max(0, Math.min(index, updatedQuestions.length));
    updatedQuestions.splice(insertIdx, 0, newQuestion);

    const nextExam = recomputeExamFromQuestions(
      currentExam,
      updatedQuestions,
      currentExam.versions.length || 2
    );

    pushExamToHistory(nextExam);
    setQualityReport((prev) => refreshQualityCodeIssues(prev, nextExam));
    setNotificationMessage(`Đã chèn thêm câu hỏi mới vào vị trí Câu ${insertIdx + 1}!`);
    setTimeout(() => setNotificationMessage(null), 3000);
  };

  /**
   * Tạo lại duy nhất một câu hỏi bằng AI:
   * - Giữ nguyên ô (dạng, mức, chủ đề, điểm)
   * - Gửi kèm danh sách các câu còn lại để AI tránh trùng lặp
   * - Hỗ trợ "Yêu cầu riêng cho câu này"
   * - Chỉ câu đó hiện trạng thái đang tạo
   */
  const regenerateQuestionAction = async (questionId: string, customHint?: string) => {
    if (!currentExam) return;

    const targetIdx = currentExam.questions.findIndex((q) => q.id === questionId);
    if (targetIdx === -1) return;

    const oldQuestion = currentExam.questions[targetIdx];
    const targetSlot: BlueprintSlot = {
      id: oldQuestion.slotId || `slot_${targetIdx + 1}`,
      orderNumber: targetIdx + 1,
      questionType: oldQuestion.type,
      level: oldQuestion.level,
      topic: oldQuestion.topic || config.topicName || 'Kiến thức trọng tâm',
      score: oldQuestion.score,
    };

    const otherQuestions = currentExam.questions.filter((q) => q.id !== questionId);

    setRegeneratingQuestionId(questionId);
    try {
      setNotificationMessage(`Đang dùng AI sinh lại câu ${targetIdx + 1}...`);
      const newQuestion = await regenerateSlotWithContext(
        targetSlot,
        currentExam.config,
        otherQuestions,
        customHint
      );
      newQuestion.id = oldQuestion.id; // giữ ID câu hỏi
      newQuestion.slotId = targetSlot.id;
      newQuestion.score = targetSlot.score;
      newQuestion.needsReview = false;
      newQuestion.reviewNote = undefined;
      newQuestion.regenerationCount = (oldQuestion.regenerationCount || 0) + 1;

      const updatedList = [...currentExam.questions];
      updatedList[targetIdx] = newQuestion;

      const nextExam = recomputeExamFromQuestions(
        currentExam,
        updatedList,
        currentExam.versions.length || 2
      );

      pushExamToHistory(nextExam);
      setQualityReport((prev) => refreshQualityCodeIssues(prev, nextExam));
      playSuccessChime();
      setNotificationMessage(`Đã sinh lại câu ${targetIdx + 1} thành công!`);
      setTimeout(() => setNotificationMessage(null), 3500);
    } catch (e: any) {
      setNotificationMessage(`Không thể sinh lại câu: ${e?.message || 'Lỗi kết nối'}`);
      setTimeout(() => setNotificationMessage(null), 4000);
    } finally {
      setRegeneratingQuestionId(null);
    }
  };

  /**
   * Chia lại điểm số toàn đề bằng scoring.ts khi tổng điểm lệch thang điểm quy định
   */
  const redistributeScoresAction = () => {
    if (!currentExam || currentExam.questions.length === 0) return;
    const targetScale = config.scale || 10;
    const step = config.roundingStep || 0.25;
    const newScores = allocateIntegerScores(targetScale, currentExam.questions.length, step);

    const updatedQuestions = currentExam.questions.map((q, idx) => ({
      ...q,
      score: newScores[idx] ?? q.score,
    }));

    const nextExam = recomputeExamFromQuestions(
      currentExam,
      updatedQuestions,
      currentExam.versions.length || 2
    );

    pushExamToHistory(nextExam);
    setQualityReport((prev) => refreshQualityCodeIssues(prev, nextExam));
    setNotificationMessage(`Đã chia lại điểm toàn đề đạt chuẩn ${targetScale} điểm!`);
    setTimeout(() => setNotificationMessage(null), 3500);
  };

  /**
   * Quản lý câu hỏi do giáo viên tự nhập ở cột trái
   */
  const addTeacherQuestion = (q: Question) => {
    const current = config.teacherQuestions || [];
    updateConfig({
      teacherQuestions: [...current, q],
    });
    setNotificationMessage('Đã lưu câu hỏi giáo viên tự nhập');
    setTimeout(() => setNotificationMessage(null), 2500);
  };

  const updateTeacherQuestion = (id: string, patch: Partial<Question>) => {
    const current = config.teacherQuestions || [];
    updateConfig({
      teacherQuestions: current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    });
  };

  const removeTeacherQuestion = (id: string) => {
    const current = config.teacherQuestions || [];
    updateConfig({
      teacherQuestions: current.filter((item) => item.id !== id),
    });
  };

  const setTeacherQuestions = (qs: Question[]) => {
    updateConfig({ teacherQuestions: qs });
  };

  /**
   * Tạo thêm các mã đề hoán vị mới
   */
  const generateNewVersionsAction = (count: number) => {
    if (!currentExam) return;
    const newVersions = generateExamVersions(currentExam.questions, count);
    setCurrentExam({
      ...currentExam,
      versions: newVersions,
    });
    setSelectedVersionIndex(0);
    setNotificationMessage(`Đã tạo thành công ${newVersions.length} mã đề hoán vị!`);
    setTimeout(() => setNotificationMessage(null), 3000);
  };

  return (
    <ExamContext.Provider
      value={{
        config,
        updateConfig,
        resetConfig,
        blueprint,
        isBlueprintStale,
        generateBlueprintAction,
        currentExam,
        setCurrentExam,
        activeTab,
        setActiveTab,
        isGenerating,
        generationProgress,
        generationError,
        startGenerateExam,
        startGenerateEquivalentExam,
        isExamOutdated,
        cancelGeneration,
        selectedVersionIndex,
        setSelectedVersionIndex,
        updateQuestion,
        deleteQuestionAction,
        insertQuestionAction,
        regeneratingQuestionId,
        regenerateQuestionAction,
        generateNewVersionsAction,
        redistributeScoresAction,
        undo,
        canUndo,
        redo,
        canRedo,
        historyLength: history.length,
        addTeacherQuestion,
        updateTeacherQuestion,
        removeTeacherQuestion,
        setTeacherQuestions,
        notificationMessage,
        setNotificationMessage,
        qualityReport,
        setQualityReport,
        isQualityChecking,
        runManualQualityCheck,
        restoreSavedConfigAction,
        clearSavedConfigAction,
        hasSavedConfig,
        isSavedExamsModalOpen,
        setIsSavedExamsModalOpen,
        saveCurrentExamAction,
        loadExamFromSaved,
        isBankModalOpen,
        setIsBankModalOpen,
        bankCount,
        refreshBankCount,
        saveQuestionToBankAction,
        saveAllQuestionsToBankAction,
        insertBankQuestionsToCurrentExam,
        setBankQuestionsAsTeacherQuestions,
        exportModalState,
        openExportModal,
        closeExportModal,
        isMatrixModalOpen,
        setIsMatrixModalOpen,
        applyImportedMatrixAction,
        removeImportedMatrixAction,
      }}
    >
      {children}
    </ExamContext.Provider>
  );
};

export function useExamStore(): ExamContextType {
  const context = useContext(ExamContext);
  if (!context) {
    throw new Error('useExamStore must be used within an ExamProvider');
  }
  return context;
}
