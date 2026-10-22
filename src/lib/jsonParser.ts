/**
 * Hàm phân tích cú pháp JSON nâng cao (Robust JSON Parser)
 * Tự động khắc phục các lỗi phổ biến khi LLM sinh JSON có chứa công thức LaTeX,
 * unescaped backslashes (\sqrt, \frac, \alpha, \times, \pm, \Delta...),
 * dấu phẩy thừa (trailing commas), hoặc markdown code fences (```json ... ```).
 */
export function robustJsonParse<T = any>(jsonString: string): T {
  if (!jsonString || typeof jsonString !== 'string') {
    throw new Error('Dữ liệu phản hồi trống hoặc không hợp lệ.');
  }

  // 1. Thử parse trực tiếp tiêu chuẩn
  try {
    return JSON.parse(jsonString) as T;
  } catch {
    // Tiếp tục các bước chuẩn hóa và tự động sửa lỗi
  }

  // 2. Bỏ markdown fence ```json ... ``` nếu có
  let cleaned = jsonString
    .replace(/^[\s\S]*?```(?:json)?\s*/i, (match) => (match.includes('```') ? '' : match))
    .replace(/\s*```[\s\S]*$/, '')
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Tiếp tục
  }

  // 3. Trích xuất khối JSON bao bọc outermost {} hoặc []
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  let startIdx = -1;
  let endIdx = -1;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
    endIdx = cleaned.lastIndexOf('}');
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    endIdx = cleaned.lastIndexOf(']');
  }

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    cleaned = cleaned.slice(startIdx, endIdx + 1);
  }

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Tiếp tục sửa lỗi escape LaTeX
  }

  // 4. Máy trạng thái quét chuỗi JSON để sửa lỗi unescaped backslashes
  // Trong chuỗi JSON, ký tự '\' chỉ được phép đứng trước: ", \, /, b, f, n, r, t, uXXXX.
  // Tuy nhiên khi viết LaTeX:
  // - Các lệnh như \frac, \times, \tan, \tau, \text bắt đầu bằng \f hoặc \t (trong JSON là formfeed hoặc tab).
  // - Các lệnh như \sqrt, \alpha, \Delta, \pm bắt đầu bằng \s, \a, \D, \p... dẫn đến lỗi SyntaxError: Bad escaped character.
  let result = '';
  let inString = false;
  let i = 0;

  while (i < cleaned.length) {
    const char = cleaned[i];

    // Xác định dấu mở/đóng chuỗi JSON (ngoại trừ khi dấu ngoặc kép được escape)
    if (char === '"' && (i === 0 || cleaned[i - 1] !== '\\')) {
      inString = !inString;
      result += char;
      i++;
      continue;
    }

    if (inString) {
      if (char === '\\') {
        const next = cleaned[i + 1];
        const remaining = cleaned.slice(i);

        // Các từ khóa lệnh LaTeX phổ biến
        const isLatexCommand = /^\\(frac|times|tan|text|tau|to|tilde|theta|textbf|textit|therefore|triangle|begin|bar|beta|bf|bmod|neq|nu|natural|not|nabla|ni|right|rho|rangle|sqrt|alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega|Delta|Gamma|Theta|Lambda|Xi|Pi|Sigma|Phi|Psi|Omega|cdot|pm|mp|le|ge|ne|approx|equiv|sim|simeq|subset|subseteq|supset|supseteq|in|notin|cup|cap|lor|land|forall|exists|infty|partial|sum|prod|int|oint|lim|sin|cos|log|ln|lg|exp|deg|angle|perp|parallel|left|right)/i.test(remaining);

        // Kiểm tra xem có phải là escape sequence chuẩn của JSON không
        const isValidStandardEscape = !isLatexCommand && (
          next === '"' ||
          next === '\\' ||
          next === '/' ||
          next === 'b' ||
          next === 'f' ||
          next === 'n' ||
          next === 'r' ||
          next === 't' ||
          (next === 'u' && /^[0-9a-fA-F]{4}/.test(cleaned.slice(i + 2, i + 6)))
        );

        if (isValidStandardEscape) {
          result += char + next;
          i += 2;
        } else {
          // Unescaped backslash trong chuỗi JSON (LaTeX hoặc ký tự thoát bị thiếu) -> sửa thành '\\'
          result += '\\\\';
          i++;
        }
        continue;
      } else if (char === '\n' || char === '\r') {
        // Ký tự xuống dòng thực tế bên trong chuỗi JSON -> sửa thành '\n'
        result += '\\n';
        i++;
        continue;
      }
    }

    result += char;
    i++;
  }

  // 5. Bỏ dấu phẩy thừa trước } hoặc ] (trailing commas)
  result = result.replace(/,\s*([}\]])/g, '$1');

  try {
    return JSON.parse(result) as T;
  } catch {
    // 6. Thử bước cuối: thay thế triệt để các ký tự điều khiển lạ
    const ultraCleaned = result.replace(/[\x00-\x1F\x7F]/g, (c) => {
      if (c === '\t') return '\\t';
      if (c === '\n') return '\\n';
      if (c === '\r') return '\\r';
      return '';
    });
    return JSON.parse(ultraCleaned) as T;
  }
}
