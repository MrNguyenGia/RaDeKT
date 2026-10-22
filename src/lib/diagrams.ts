/**
 * Bộ sinh và xử lý đồ thị / hình vẽ minh họa SVG cho đề kiểm tra
 * Hỗ trợ: Đồ thị hàm số (Bậc 3, Bậc 4, Parabol, Nhất biến), Bảng biến thiên, Hình học không gian (Hình chóp, Lăng trụ, Tứ diện)
 */

/**
 * Kiểm tra chuỗi có phải mã SVG hợp lệ không
 */
export function isValidSvg(svg?: string | null): boolean {
  if (!svg || typeof svg !== 'string') return false;
  const trimmed = svg.trim();
  return trimmed.startsWith('<svg') && trimmed.endsWith('</svg>');
}

/**
 * Chuẩn hóa mã SVG để đảm bảo an toàn và hiển thị responsive
 */
export function sanitizeSvg(svg: string): string {
  if (!isValidSvg(svg)) return '';
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '');
}

/**
 * Sinh đồ thị hàm số bậc 3 chuẩn đề thi (có hệ trục Oxy, điểm cực trị và đường gióng)
 */
export function generateCubicGraphSvg(): string {
  return `<svg viewBox="0 0 320 220" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto max-w-[320px] mx-auto select-none font-sans">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#1e293b" />
    </marker>
  </defs>
  <!-- Lưới mờ nhẹ -->
  <line x1="20" y1="60" x2="300" y2="60" stroke="#f1f5f9" stroke-width="1" />
  <line x1="20" y1="160" x2="300" y2="160" stroke="#f1f5f9" stroke-width="1" />
  <line x1="100" y1="20" x2="100" y2="200" stroke="#f1f5f9" stroke-width="1" />
  <line x1="220" y1="20" x2="220" y2="200" stroke="#f1f5f9" stroke-width="1" />

  <!-- Trục tọa độ Oxy -->
  <line x1="20" y1="110" x2="300" y2="110" stroke="#1e293b" stroke-width="1.8" marker-end="url(#arrow)" />
  <line x1="160" y1="205" x2="160" y2="15" stroke="#1e293b" stroke-width="1.8" marker-end="url(#arrow)" />
  <text x="295" y="125" font-size="13" font-style="italic" fill="#1e293b" font-weight="bold">x</text>
  <text x="145" y="22" font-size="13" font-style="italic" fill="#1e293b" font-weight="bold">y</text>
  <text x="148" y="125" font-size="12" fill="#1e293b">O</text>

  <!-- Đường gióng cực trị -->
  <line x1="105" y1="110" x2="105" y2="60" stroke="#64748b" stroke-width="1" stroke-dasharray="3,3" />
  <line x1="105" y1="60" x2="160" y2="60" stroke="#64748b" stroke-width="1" stroke-dasharray="3,3" />
  <line x1="215" y1="110" x2="215" y2="160" stroke="#64748b" stroke-width="1" stroke-dasharray="3,3" />
  <line x1="160" y1="160" x2="215" y2="160" stroke="#64748b" stroke-width="1" stroke-dasharray="3,3" />

  <!-- Nhãn tọa độ điểm cực trị -->
  <text x="96" y="125" font-size="11" fill="#475569">-1</text>
  <text x="210" y="103" font-size="11" fill="#475569">1</text>
  <text x="165" y="64" font-size="11" fill="#475569">2</text>
  <text x="142" y="164" font-size="11" fill="#475569">-2</text>

  <!-- Đường cong đồ thị bậc 3 -->
  <path d="M 50 190 C 85 110, 95 60, 105 60 C 125 60, 140 100, 160 110 C 180 120, 195 160, 215 160 C 225 160, 235 110, 270 30" 
        fill="none" stroke="#2563eb" stroke-width="2.2" stroke-linecap="round" />

  <!-- Điểm cực đại và cực tiểu -->
  <circle cx="105" cy="60" r="3" fill="#2563eb" />
  <circle cx="215" cy="160" r="3" fill="#2563eb" />
</svg>`;
}

/**
 * Sinh đồ thị parabol bậc 2 (y = ax^2 + bx + c)
 */
export function generateParabolaSvg(): string {
  return `<svg viewBox="0 0 320 220" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto max-w-[320px] mx-auto select-none font-sans">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#1e293b" />
    </marker>
  </defs>
  <!-- Trục tọa độ Oxy -->
  <line x1="20" y1="140" x2="300" y2="140" stroke="#1e293b" stroke-width="1.8" marker-end="url(#arrow)" />
  <line x1="160" y1="205" x2="160" y2="15" stroke="#1e293b" stroke-width="1.8" marker-end="url(#arrow)" />
  <text x="295" y="155" font-size="13" font-style="italic" fill="#1e293b" font-weight="bold">x</text>
  <text x="145" y="22" font-size="13" font-style="italic" fill="#1e293b" font-weight="bold">y</text>
  <text x="148" y="155" font-size="12" fill="#1e293b">O</text>

  <!-- Đỉnh Parabol I(2; -1) -->
  <line x1="210" y1="140" x2="210" y2="175" stroke="#64748b" stroke-width="1" stroke-dasharray="3,3" />
  <line x1="160" y1="175" x2="210" y2="175" stroke="#64748b" stroke-width="1" stroke-dasharray="3,3" />
  <text x="206" y="132" font-size="11" fill="#475569">2</text>
  <text x="144" y="178" font-size="11" fill="#475569">-1</text>

  <!-- Đường cong Parabol -->
  <path d="M 70 35 Q 210 260 270 50" fill="none" stroke="#2563eb" stroke-width="2.2" stroke-linecap="round" />
  <circle cx="210" cy="175" r="3" fill="#2563eb" />
  <text x="216" y="190" font-size="11" fill="#2563eb" font-weight="bold">I</text>
</svg>`;
}

/**
 * Sinh đồ thị phân thức nhất biến y = (ax+b)/(cx+d) có tiệm cận đứng và tiệm cận ngang
 */
export function generateRationalGraphSvg(): string {
  return `<svg viewBox="0 0 320 220" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto max-w-[320px] mx-auto select-none font-sans">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#1e293b" />
    </marker>
  </defs>
  <!-- Trục Oxy -->
  <line x1="20" y1="130" x2="300" y2="130" stroke="#1e293b" stroke-width="1.8" marker-end="url(#arrow)" />
  <line x1="140" y1="205" x2="140" y2="15" stroke="#1e293b" stroke-width="1.8" marker-end="url(#arrow)" />
  <text x="295" y="145" font-size="13" font-style="italic" fill="#1e293b" font-weight="bold">x</text>
  <text x="125" y="22" font-size="13" font-style="italic" fill="#1e293b" font-weight="bold">y</text>
  <text x="126" y="145" font-size="12" fill="#1e293b">O</text>

  <!-- Tiệm cận đứng x = 1 (x=180) -->
  <line x1="180" y1="20" x2="180" y2="200" stroke="#dc2626" stroke-width="1.5" stroke-dasharray="4,4" />
  <text x="184" y="32" font-size="11" fill="#dc2626" font-weight="bold">x = 1</text>

  <!-- Tiệm cận ngang y = 2 (y=75) -->
  <line x1="20" y1="75" x2="300" y2="75" stroke="#dc2626" stroke-width="1.5" stroke-dasharray="4,4" />
  <text x="250" y="70" font-size="11" fill="#dc2626" font-weight="bold">y = 2</text>

  <!-- 2 nhánh hypebol -->
  <path d="M 40 85 Q 160 90 172 200" fill="none" stroke="#2563eb" stroke-width="2.2" stroke-linecap="round" />
  <path d="M 188 20 Q 200 65 285 70" fill="none" stroke="#2563eb" stroke-width="2.2" stroke-linecap="round" />
</svg>`;
}

/**
 * Sinh bảng biến thiên (Variation Table) sư phạm chuẩn thi tốt nghiệp THPT
 */
export function generateVariationTableSvg(): string {
  return `<svg viewBox="0 0 340 160" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto max-w-[340px] mx-auto select-none font-sans">
  <!-- Khung bảng -->
  <rect x="10" y="10" width="320" height="140" fill="#ffffff" stroke="#334155" stroke-width="1.5" rx="4" />
  
  <!-- Đường kẻ ngang -->
  <line x1="10" y1="45" x2="330" y2="45" stroke="#334155" stroke-width="1.2" />
  <line x1="10" y1="80" x2="330" y2="80" stroke="#334155" stroke-width="1.2" />

  <!-- Đường kẻ dọc cột nhãn -->
  <line x1="55" y1="10" x2="55" y2="150" stroke="#334155" stroke-width="1.2" />

  <!-- Nhãn các hàng -->
  <text x="28" y="33" font-size="13" font-style="italic" fill="#1e293b" font-weight="bold">x</text>
  <text x="28" y="68" font-size="13" font-style="italic" fill="#1e293b" font-weight="bold">y'</text>
  <text x="28" y="120" font-size="13" font-style="italic" fill="#1e293b" font-weight="bold">y</text>

  <!-- Hàng x -->
  <text x="70" y="33" font-size="11" fill="#1e293b">-∞</text>
  <text x="135" y="33" font-size="11" fill="#1e293b">-1</text>
  <text x="215" y="33" font-size="11" fill="#1e293b">2</text>
  <text x="290" y="33" font-size="11" fill="#1e293b">+∞</text>

  <!-- Hàng y' -->
  <text x="100" y="68" font-size="13" font-weight="bold" fill="#2563eb">+</text>
  <text x="140" y="68" font-size="12" fill="#64748b">0</text>
  <text x="175" y="68" font-size="14" font-weight="bold" fill="#dc2626">-</text>
  <text x="220" y="68" font-size="12" fill="#64748b">0</text>
  <text x="260" y="68" font-size="13" font-weight="bold" fill="#2563eb">+</text>

  <!-- Hàng y (mũi tên biến thiên) -->
  <text x="68" y="142" font-size="11" fill="#475569">-∞</text>
  <!-- Mũi tên lên -->
  <line x1="88" y1="135" x2="135" y2="98" stroke="#1e293b" stroke-width="1.5" />
  <polygon points="135,98 127,104 135,108" fill="#1e293b" />
  <text x="135" y="94" font-size="11" font-weight="bold" fill="#2563eb">3</text>

  <!-- Mũi tên xuống -->
  <line x1="148" y1="98" x2="210" y2="138" stroke="#1e293b" stroke-width="1.5" />
  <polygon points="210,138 202,132 208,127" fill="#1e293b" />
  <text x="215" y="145" font-size="11" font-weight="bold" fill="#dc2626">-2</text>

  <!-- Mũi tên lên -->
  <line x1="228" y1="138" x2="285" y2="98" stroke="#1e293b" stroke-width="1.5" />
  <polygon points="285,98 277,104 285,108" fill="#1e293b" />
  <text x="290" y="94" font-size="11" fill="#475569">+∞</text>
</svg>`;
}

/**
 * Sinh hình chóp không gian S.ABCD đáy hình bình hành (đường đứt nét ẩn chuẩn hình học)
 */
export function generatePyramidSvg(): string {
  return `<svg viewBox="0 0 300 220" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto max-w-[300px] mx-auto select-none font-sans">
  <!-- Đỉnh S -->
  <!-- Đáy A, B, C, D: A(70, 150), B(150, 180), C(250, 170), D(170, 140) -->
  <!-- S(160, 30) -->
  
  <!-- Cạnh ẩn (nét đứt) -->
  <line x1="160" y1="30" x2="70" y2="150" stroke="#334155" stroke-width="1.5" stroke-dasharray="4,4" />
  <line x1="70" y1="150" x2="170" y2="140" stroke="#334155" stroke-width="1.5" stroke-dasharray="4,4" />
  <line x1="70" y1="150" x2="150" y2="180" stroke="#334155" stroke-width="1.5" stroke-dasharray="4,4" />
  
  <!-- Cạnh thấy (nét liền) -->
  <line x1="160" y1="30" x2="150" y2="180" stroke="#1e293b" stroke-width="1.8" />
  <line x1="160" y1="30" x2="250" y2="170" stroke="#1e293b" stroke-width="1.8" />
  <line x1="160" y1="30" x2="170" y2="140" stroke="#1e293b" stroke-width="1.8" />
  
  <line x1="150" y1="180" x2="250" y2="170" stroke="#1e293b" stroke-width="1.8" />
  <line x1="250" y1="170" x2="170" y2="140" stroke="#1e293b" stroke-width="1.8" />

  <!-- Tên đỉnh -->
  <text x="156" y="24" font-size="13" font-weight="bold" fill="#1e293b">S</text>
  <text x="54" y="156" font-size="12" font-weight="bold" fill="#1e293b">A</text>
  <text x="145" y="196" font-size="12" font-weight="bold" fill="#1e293b">B</text>
  <text x="256" y="176" font-size="12" font-weight="bold" fill="#1e293b">C</text>
  <text x="172" y="136" font-size="12" font-weight="bold" fill="#1e293b">D</text>

  <!-- Các điểm đỉnh -->
  <circle cx="160" cy="30" r="2.5" fill="#1e293b" />
  <circle cx="70" cy="150" r="2" fill="#334155" />
  <circle cx="150" cy="180" r="2.5" fill="#1e293b" />
  <circle cx="250" cy="170" r="2.5" fill="#1e293b" />
  <circle cx="170" cy="140" r="2.5" fill="#1e293b" />
</svg>`;
}

/**
 * Tự động tạo đồ thị/hình vẽ tương ứng nếu câu hỏi cần hình ảnh minh họa
 */
export function generateFallbackSvgDiagram(questionText: string, topic: string): string {
  const text = (questionText + ' ' + topic).toLowerCase();

  if (text.includes('bảng biến thiên')) {
    return generateVariationTableSvg();
  }
  if (text.includes('hình chóp') || text.includes('lăng trụ') || text.includes('hình học không gian') || text.includes('tứ diện')) {
    return generatePyramidSvg();
  }
  if (text.includes('tiệm cận') || text.includes('nhất biến') || text.includes('phân thức') || text.includes('hypebol')) {
    return generateRationalGraphSvg();
  }
  if (text.includes('parabol') || text.includes('bậc hai') || text.includes('bậc 2')) {
    return generateParabolaSvg();
  }
  // Mặc định cho hàm số / đồ thị chung
  return generateCubicGraphSvg();
}
