import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import dotenv from 'dotenv';
import { robustJsonParse } from './src/lib/jsonParser';
import { GEMINI_IMAGE_MODEL } from './src/config';

dotenv.config();

const app = express();
const PORT = 3000;

// Hỗ trợ payload lớn cho việc tải file đính kèm base64
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Client Gemini trên server
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Quản lý thời gian hồi (Cooldown) cho các model khi chạm hạn mức (429 hoặc 503)
const modelCooldownMap = new Map<string, number>();

function isModelInCooldown(model: string): boolean {
  const until = modelCooldownMap.get(model);
  if (!until) return false;
  if (Date.now() < until) return true;
  modelCooldownMap.delete(model);
  return false;
}

function setModelCooldown(model: string, seconds: number = 45) {
  modelCooldownMap.set(model, Date.now() + seconds * 1000);
}

interface GeminiErrorInfo {
  code: number;
  message: string;
  isOverloaded: boolean; // 503 / 500 / UNAVAILABLE / high demand
  isRateLimit: boolean;  // 429 / RESOURCE_EXHAUSTED / quota
}

/**
 * Phân tích đối tượng lỗi từ Gemini SDK (bắt cả JSON string lồng bên trong message)
 */
function parseGeminiError(err: any): GeminiErrorInfo {
  let code = Number(err?.status || err?.code || 0);
  let message = String(err?.message || '');
  let statusText = '';

  const trimmed = message.trim();
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || trimmed.includes('"error"')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed?.error) {
        code = Number(parsed.error.code || code);
        message = String(parsed.error.message || message);
        statusText = String(parsed.error.status || '');
      }
    } catch {
      // Bỏ qua nếu không phải JSON chuẩn
    }
  }

  const combined = (message + ' ' + statusText + ' ' + String(err?.stack || '')).toLowerCase();

  const isOverloaded =
    code === 503 ||
    code === 500 ||
    statusText === 'UNAVAILABLE' ||
    combined.includes('503') ||
    combined.includes('unavailable') ||
    combined.includes('high demand') ||
    combined.includes('overloaded') ||
    combined.includes('spikes in demand');

  const isRateLimit =
    code === 429 ||
    statusText === 'RESOURCE_EXHAUSTED' ||
    combined.includes('429') ||
    combined.includes('resource_exhausted') ||
    combined.includes('quota') ||
    combined.includes('rate limit');

  if (isRateLimit && !code) code = 429;
  if (isOverloaded && !code) code = 503;
  if (!code) code = 500;

  return { code, message, isOverloaded, isRateLimit };
}

/**
 * Gọi Gemini với khả năng tự động thử lại khi 503 và tự động chuyển model dự phòng
 */
async function callGeminiWithResilience(
  preferredModel: string,
  contents: any,
  config: any
): Promise<{ text: string; usedModel: string }> {
  const candidateModels = Array.from(
    new Set([
      preferredModel,
      'gemini-3.8-flash',
      'gemini-3.1-flash-lite',
      'gemini-flash-latest',
    ])
  );

  let lastError: any = null;

  for (const model of candidateModels) {
    if (isModelInCooldown(model) && candidateModels.length > 1) {
      continue;
    }

    // Với mỗi model, cho phép thử tối đa 2 lần nếu gặp quá tải tức thời
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents,
          config,
        });

        const text = response.text || '';
        if (text) {
          return { text, usedModel: model };
        }
      } catch (err: any) {
        lastError = err;
        const errInfo = parseGeminiError(err);

        console.warn(
          `[Gemini Proxy] Model "${model}" lần thử ${attempt + 1}/2 thất bại (${errInfo.code}): ${errInfo.message.slice(0, 150)}`
        );

        if (errInfo.isRateLimit) {
          // Model chạm hạn mức 429: đặt thời gian hồi 45s và chuyển sang model khác ngay lập tức
          setModelCooldown(model, 45);
          break;
        }

        if (errInfo.isOverloaded) {
          // Model quá tải 503:
          if (attempt === 0) {
            // Chờ 1.2s rồi thử lại cùng model (các đợt tăng đột biến thường qua nhanh)
            await new Promise((res) => setTimeout(res, 1200));
            continue;
          } else {
            // Nếu vẫn 503: đặt hồi ngắn 20s và chuyển sang model dự phòng kế tiếp
            setModelCooldown(model, 20);
            break;
          }
        }

        // Lỗi khác: không thử lại model này, chuyển model tiếp theo
        break;
      }
    }
  }

  throw lastError;
}

/**
 * Route API proxy gọi Gemini AI sinh một lô câu hỏi (tối đa 8 câu/lô)
 */
app.post('/api/generate-exam-batch', async (req: Request, res: Response) => {
  try {
    const { modelName, contents, systemInstruction, responseSchema } = req.body;

    if (!contents) {
      return res.status(400).json({ error: 'Nội dung yêu cầu (contents) không được để trống' });
    }

    const requestedModel = modelName || 'gemini-3.8-flash';

    const genConfig: any = {
      systemInstruction,
      responseMimeType: 'application/json',
    };
    if (responseSchema) {
      genConfig.responseSchema = responseSchema;
    }

    const { text: responseText } = await callGeminiWithResilience(
      requestedModel,
      contents,
      genConfig
    );

    const parsed = robustJsonParse(responseText);
    return res.json({ success: true, data: parsed });
  } catch (err: any) {
    const errInfo = parseGeminiError(err);
    const statusCode = errInfo.isRateLimit ? 429 : errInfo.isOverloaded ? 503 : 500;

    let clientErrorMessage = errInfo.message;
    if (errInfo.isOverloaded) {
      clientErrorMessage =
        'Hệ thống AI Gemini đang quá tải tạm thời (503 High Demand). Vui lòng thử lại sau vài giây hoặc hệ thống đang tự động kích hoạt model dự phòng.';
    } else if (errInfo.isRateLimit) {
      clientErrorMessage =
        'Hạn mức API tạm thời đã vượt mức cho phép. Vui lòng thử lại sau 30-45 giây.';
    }

    return res.status(statusCode).json({
      success: false,
      error: clientErrorMessage,
    });
  }
});

/**
 * Route tạo hình minh họa đơn giản bằng AI (con vật, đồ vật, cảnh vật)
 * Sử dụng model GEMINI_IMAGE_MODEL được AI Studio đề xuất.
 * Phong cách: Nét đơn giản, nền trắng, không có chữ, phù hợp học sinh.
 */
app.post('/api/generate-ai-illustration', async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Mô tả hình ảnh không được để trống.' });
    }

    const cleanDesc = prompt.trim();
    // Tạo prompt định hình phong cách: nét đơn giản, nền trắng tinh, không chữ, phù hợp học sinh
    const styledPrompt = `A simple, clean minimalist educational illustration of: ${cleanDesc}. Minimalist line art or flat vector style, solid plain pure white background (#ffffff), absolutely no text, no words, no letters, no numbers, no labels, clear silhouette, student-friendly educational clip art illustration suitable for school tests.`;

    const response = await ai.models.generateContent({
      model: GEMINI_IMAGE_MODEL,
      contents: {
        parts: [{ text: styledPrompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: '1:1',
        },
      },
    });

    let dataUrl: string | null = null;
    const candidates = response.candidates || [];
    for (const candidate of candidates) {
      const parts = candidate.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          const mimeType = part.inlineData.mimeType || 'image/png';
          dataUrl = `data:${mimeType};base64,${part.inlineData.data}`;
          break;
        }
      }
      if (dataUrl) break;
    }

    if (!dataUrl) {
      return res.status(500).json({
        success: false,
        error: 'AI không trả về dữ liệu hình ảnh. Vui lòng thử lại với mô tả khác hoặc chèn ảnh có sẵn.',
      });
    }

    return res.json({
      success: true,
      dataUrl,
    });
  } catch (err: any) {
    const errMsg = String(err?.message || '');
    const errStatus = err?.status || err?.code || 0;

    // Phát hiện lỗi quyền truy cập model tạo ảnh hoặc giới hạn quota = 0
    const isPermissionOrQuota =
      errStatus === 403 ||
      errStatus === 429 ||
      errMsg.includes('limit: 0') ||
      errMsg.includes('RESOURCE_EXHAUSTED') ||
      errMsg.includes('PERMISSION_DENIED') ||
      errMsg.includes('quota') ||
      errMsg.includes('billing') ||
      errMsg.includes('not found') ||
      errMsg.includes('404');

    if (isPermissionOrQuota) {
      return res.status(403).json({
        success: false,
        noPermission: true,
        error:
          'Tài khoản hiện tại chưa có quyền hoặc hạn mức sử dụng model tạo ảnh của Gemini (cần gói trả phí hoặc quota tạo ảnh). Bạn vui lòng dùng tính năng "Chèn hình" có sẵn (tải file PNG/JPG hoặc dán từ clipboard) để tiếp tục.',
      });
    }

    return res.status(500).json({
      success: false,
      error: err?.message || 'Không thể tạo hình ảnh minh họa với AI.',
    });
  }
});

// Route kiểm tra trạng thái sức khỏe
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
  });
});

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    // Serve file tĩnh trong thư mục dist khi chạy production
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    // Tích hợp Vite middleware vào Express trong chế độ dev
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server đang lắng nghe tại http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Không thể khởi động server:', err);
});
