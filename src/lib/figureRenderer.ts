import { compile } from 'mathjs';
import {
  DataChartFigure,
  FunctionGraphFigure,
  GeometryFigure,
  QuestionFigure,
  SignTableFigure,
  VariationTableFigure,
} from '../types';

/**
 * Định dạng ký hiệu toán học phổ biến trong SVG (chuyển -\infty thành −∞, +\infty thành +∞)
 */
function formatMathSymbolsForSvg(val: string): string {
  if (!val) return '';
  return val
    .replace(/\\-?\\infty|-\\infty/g, '−∞')
    .replace(/\\+\\infty|\+\\infty/g, '+∞')
    .replace(/\\infty/g, '∞')
    .replace(/\\pm/g, '±')
    .replace(/\+/g, '+')
    .replace(/-/g, '−');
}

/**
 * Hiển thị khung đỏ khi figure bị lỗi cú pháp thay vì để trống
 */
function renderFigureErrorSvg(message: string): string {
  const safeMsg = message ? message.replace(/[<>&"']/g, ' ') : 'Lỗi dữ liệu hình';
  return `<svg viewBox="0 0 360 65" xmlns="http://www.w3.org/2000/svg" class="w-full max-w-[360px] mx-auto select-none">
    <rect width="360" height="65" fill="#fff1f2" stroke="#e11d48" stroke-width="1.5" rx="6" />
    <text x="180" y="27" text-anchor="middle" font-size="12" font-weight="bold" fill="#be123c">Hình vẽ gặp lỗi cú pháp</text>
    <text x="180" y="46" text-anchor="middle" font-size="10.5" fill="#9f1239">${safeMsg}</text>
  </svg>`;
}

/**
 * Hàm sinh chuỗi SVG hoàn chỉnh từ đối tượng QuestionFigure
 * Thiết kế gọn gàng, nền trắng, nét đen chuẩn sư phạm cho đề thi
 */
export function figureToSvg(figure: QuestionFigure): string {
  try {
    if (!figure || typeof figure !== 'object') {
      return renderFigureErrorSvg('Dữ liệu hình không tồn tại');
    }
    switch (figure.kind) {
      case 'function-graph':
        return renderFunctionGraphSvg(figure);
      case 'geometry':
        return renderGeometrySvg(figure);
      case 'variation-table':
        return renderVariationTableSvg(figure);
      case 'sign-table':
        return renderSignTableSvg(figure);
      case 'data-chart':
        return renderDataChartSvg(figure);
      default:
        return renderFigureErrorSvg(`Loại hình "${(figure as any)?.kind || 'không xác định'}" chưa được hỗ trợ`);
    }
  } catch (err: any) {
    return renderFigureErrorSvg(err?.message || 'Lỗi cú pháp vẽ hình');
  }
}

/**
 * Tương thích ngược: renderFigureToSvg là alias của figureToSvg
 */
export const renderFigureToSvg = figureToSvg;

/**
 * 1. Vẽ đồ thị hàm số (function-graph) bằng mathjs
 */
function renderFunctionGraphSvg(fig: FunctionGraphFigure): string {
  const width = 360;
  const height = 260;
  const padLeft = 40;
  const padRight = 30;
  const padTop = 30;
  const padBottom = 35;

  if (!Array.isArray(fig.xRange) || fig.xRange.length !== 2 || typeof fig.xRange[0] !== 'number' || typeof fig.xRange[1] !== 'number') {
    throw new Error('Khoảng biến xRange không hợp lệ');
  }
  const [rawMinX, rawMaxX] = fig.xRange;
  if (rawMinX >= rawMaxX || !isFinite(rawMinX) || !isFinite(rawMaxX)) {
    throw new Error('Khoảng biến xRange không hợp lệ (xRange[0] phải nhỏ hơn xRange[1])');
  }
  const minX = rawMinX;
  const maxX = rawMaxX;

  let minY = -4;
  let maxY = 4;
  if (fig.yRange && fig.yRange.length === 2) {
    minY = Math.min(fig.yRange[0], fig.yRange[1]);
    maxY = Math.max(fig.yRange[0], fig.yRange[1]);
  }
  if (minY === maxY) {
    minY -= 2;
    maxY += 2;
  }

  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const toPxX = (x: number) => padLeft + ((x - minX) / (maxX - minX)) * plotW;
  const toPxY = (y: number) => padTop + plotH - ((y - minY) / (maxY - minY)) * plotH;

  const originX = toPxX(0);
  const originY = toPxY(0);

  let gridSvg = '';
  if (fig.showGrid !== false) {
    const xStep = Math.max(1, Math.round((maxX - minX) / 8));
    for (let x = Math.ceil(minX); x <= Math.floor(maxX); x += xStep) {
      if (x === 0) continue;
      const px = toPxX(x);
      gridSvg += `<line x1="${px.toFixed(1)}" y1="${padTop}" x2="${px.toFixed(1)}" y2="${height - padBottom}" stroke="#f1f5f9" stroke-width="1" />`;
    }
    const yStep = Math.max(1, Math.round((maxY - minY) / 6));
    for (let y = Math.ceil(minY); y <= Math.floor(maxY); y += yStep) {
      if (y === 0) continue;
      const py = toPxY(y);
      gridSvg += `<line x1="${padLeft}" y1="${py.toFixed(1)}" x2="${width - padRight}" y2="${py.toFixed(1)}" stroke="#f1f5f9" stroke-width="1" />`;
    }
  }

  // Trục Ox & Oy
  const clampOxY = Math.max(padTop + 10, Math.min(height - padBottom - 10, originY));
  const clampOyX = Math.max(padLeft + 10, Math.min(width - padRight - 10, originX));

  const axesSvg = `
    <!-- Mũi tên Ox, Oy -->
    <defs>
      <marker id="fig-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#000000" />
      </marker>
    </defs>
    <!-- Trục Ox -->
    <line x1="${padLeft - 10}" y1="${clampOxY.toFixed(1)}" x2="${(width - padRight + 15).toFixed(1)}" y2="${clampOxY.toFixed(1)}" stroke="#000000" stroke-width="1.6" marker-end="url(#fig-arrow)" />
    <text x="${(width - padRight + 18).toFixed(1)}" y="${(clampOxY + 4).toFixed(1)}" font-size="12" font-style="italic" font-family="'Times New Roman', serif" fill="#000000" font-weight="bold">x</text>

    <!-- Trục Oy -->
    <line x1="${clampOyX.toFixed(1)}" y1="${(height - padBottom + 10).toFixed(1)}" x2="${clampOyX.toFixed(1)}" y2="${(padTop - 15).toFixed(1)}" stroke="#000000" stroke-width="1.6" marker-end="url(#fig-arrow)" />
    <text x="${(clampOyX - 4).toFixed(1)}" y="${(padTop - 18).toFixed(1)}" font-size="12" font-style="italic" font-family="'Times New Roman', serif" fill="#000000" font-weight="bold" text-anchor="end">y</text>

    <!-- Gốc O -->
    <text x="${(clampOyX - 4).toFixed(1)}" y="${(clampOxY + 13).toFixed(1)}" font-size="11" font-family="'Times New Roman', serif" fill="#000000">O</text>
  `;

  if (!Array.isArray(fig.functions) || fig.functions.length === 0) {
    throw new Error('Thiếu danh sách hàm số trong figure');
  }

  // Vẽ các đồ thị hàm số (functions)
  let curvesSvg = '';
  const samples = 350;
  const dx = (maxX - minX) / samples;

  fig.functions.forEach((fnObj) => {
    let compiledFn: any;
    try {
      compiledFn = compile(fnObj.expr);
    } catch {
      throw new Error(`Biểu thức hàm số "${fnObj.expr}" sai cú pháp`);
    }

    const segments: { x: number; y: number }[][] = [];
    let currentSegment: { x: number; y: number }[] = [];
    let prevY: number | null = null;

    for (let i = 0; i <= samples; i++) {
      const x = minX + i * dx;
      let y: number;
      try {
        const val = compiledFn.evaluate({ x });
        if (typeof val !== 'number' || !isFinite(val) || isNaN(val)) {
          if (currentSegment.length > 0) {
            segments.push(currentSegment);
            currentSegment = [];
          }
          prevY = null;
          continue;
        }
        y = val;
      } catch {
        if (currentSegment.length > 0) {
          segments.push(currentSegment);
          currentSegment = [];
        }
        prevY = null;
        continue;
      }

      // Phát hiện tiệm cận đứng / gián đoạn nhảy vọt
      if (prevY !== null && Math.abs(y - prevY) > (maxY - minY) * 0.9) {
        if (currentSegment.length > 0) {
          segments.push(currentSegment);
          currentSegment = [];
        }
      }

      // Kẹp tọa độ hiển thị trong phạm vi hợp lý
      const clampedY = Math.max(minY - 3, Math.min(maxY + 3, y));
      currentSegment.push({ x: toPxX(x), y: toPxY(clampedY) });
      prevY = y;
    }

    if (currentSegment.length > 0) {
      segments.push(currentSegment);
    }

    // Biến các segments thành path
    segments.forEach((seg) => {
      if (seg.length < 2) return;
      let d = `M ${seg[0].x.toFixed(1)} ${seg[0].y.toFixed(1)}`;
      for (let j = 1; j < seg.length; j++) {
        d += ` L ${seg[j].x.toFixed(1)} ${seg[j].y.toFixed(1)}`;
      }
      curvesSvg += `<path d="${d}" fill="none" stroke="#000000" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />`;
    });
  });

  if (!curvesSvg) {
    throw new Error('Không thể vẽ đồ thị từ biểu thức hàm số đã cho');
  }

  // Kiểm tra danh sách nhãn được phép hiển thị cho học sinh (studentVisibleLabels)
  const allowedLabelsSet =
    Array.isArray(fig.studentVisibleLabels) && fig.studentVisibleLabels.length > 0
      ? new Set(fig.studentVisibleLabels.map((l) => l.trim().toLowerCase()))
      : null;

  // Vẽ các điểm đặc biệt (points)
  let pointsSvg = '';
  (fig.points || []).forEach((pt) => {
    const px = toPxX(pt.x);
    const py = toPxY(pt.y);

    const rawLabel = (pt.label || '').trim();
    const isLeakyExtremum =
      Boolean(pt.isExtremum) ||
      /^(max|min|cực\s*đại|cực\s*tiểu|cực\s*trị|đcđ|đct)/i.test(rawLabel) ||
      /\b(max|min)\s*\(/i.test(rawLabel) ||
      /^\([+-]?\d+([.,]\d+)?\s*[;,]\s*[+-]?\d+([.,]\d+)?\)$/.test(rawLabel);

    let displayLabel: string | null = null;
    let showDashedLines = true;

    if (allowedLabelsSet) {
      if (rawLabel && allowedLabelsSet.has(rawLabel.toLowerCase())) {
        displayLabel = rawLabel;
        showDashedLines = true;
      } else {
        displayLabel = null;
        showDashedLines = false;
      }
    } else {
      // Khi không có studentVisibleLabels chỉ định rõ:
      // Bỏ mọi nhãn kiểu Max/Min, tọa độ cực trị và bỏ đường nét đứt đến cực trị
      if (isLeakyExtremum) {
        displayLabel = null;
        showDashedLines = false;
      } else if (rawLabel) {
        // Chỉ hiện nhãn nếu là tên điểm trung tính (A, B, C, M, N...) hoặc giá trị mốc
        displayLabel = rawLabel;
        showDashedLines = true;
      } else {
        displayLabel = null;
        showDashedLines = false;
      }
    }

    // Đường gióng nét đứt tới Ox, Oy (chỉ vẽ khi không phải điểm lộ đáp án)
    if (showDashedLines) {
      if (Math.abs(pt.x) > 0.05) {
        pointsSvg += `<line x1="${px.toFixed(1)}" y1="${py.toFixed(1)}" x2="${px.toFixed(1)}" y2="${clampOxY.toFixed(1)}" stroke="#64748b" stroke-width="1" stroke-dasharray="3,3" />`;
      }
      if (Math.abs(pt.y) > 0.05) {
        pointsSvg += `<line x1="${px.toFixed(1)}" y1="${py.toFixed(1)}" x2="${clampOyX.toFixed(1)}" y2="${py.toFixed(1)}" stroke="#64748b" stroke-width="1" stroke-dasharray="3,3" />`;
      }
    }

    // Điểm tròn
    pointsSvg += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="2.5" fill="#000000" />`;

    // Nhãn điểm (nếu được phép hiển thị)
    if (displayLabel) {
      pointsSvg += `<text x="${(px + 4).toFixed(1)}" y="${(py - 4).toFixed(1)}" font-size="10.5" font-family="'Times New Roman', serif" fill="#000000" font-weight="bold">${displayLabel}</text>`;
    }
  });

  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto max-w-[360px] mx-auto select-none bg-white">
    <rect width="${width}" height="${height}" fill="#ffffff" />
    ${gridSvg}
    ${axesSvg}
    ${curvesSvg}
    ${pointsSvg}
  </svg>`;
}

/**
 * 2. Vẽ hình học không gian & phẳng (geometry)
 */
function renderGeometrySvg(fig: GeometryFigure): string {
  const width = 340;
  const height = 240;
  const padding = 35;

  if (!fig.points || fig.points.length === 0) return '';

  const ptMap = new Map<string, { id: string; x: number; y: number; label: string }>();
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  fig.points.forEach((p) => {
    ptMap.set(p.id, p);
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  });

  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const plotW = width - padding * 2;
  const plotH = height - padding * 2;

  // Giữ tỉ lệ hình (aspect ratio) không bị méo
  const scale = Math.min(plotW / rangeX, plotH / rangeY);
  const offsetX = (width - rangeX * scale) / 2;
  const offsetY = (height - rangeY * scale) / 2;

  const toPx = (p: { x: number; y: number }) => ({
    x: offsetX + (p.x - minX) * scale,
    y: offsetY + (rangeY - (p.y - minY)) * scale,
  });

  let elementsSvg = '';

  // Đa giác (polygons)
  (fig.polygons || []).forEach((poly) => {
    const pts = poly
      .map((id) => ptMap.get(id))
      .filter(Boolean)
      .map((p) => {
        const px = toPx(p!);
        return `${px.x.toFixed(1)},${px.y.toFixed(1)}`;
      })
      .join(' ');
    if (pts) {
      elementsSvg += `<polygon points="${pts}" fill="#f8fafc" stroke="#000000" stroke-width="1.6" />`;
    }
  });

  // Đoạn thẳng nét đứt (dashed)
  (fig.dashed || []).forEach(([id1, id2]) => {
    const p1 = ptMap.get(id1);
    const p2 = ptMap.get(id2);
    if (!p1 || !p2) return;
    const px1 = toPx(p1);
    const px2 = toPx(p2);
    elementsSvg += `<line x1="${px1.x.toFixed(1)}" y1="${px1.y.toFixed(1)}" x2="${px2.x.toFixed(1)}" y2="${px2.y.toFixed(1)}" stroke="#000000" stroke-width="1.5" stroke-dasharray="4,4" />`;
  });

  // Đoạn thẳng nét liền (segments)
  (fig.segments || []).forEach(([id1, id2]) => {
    const p1 = ptMap.get(id1);
    const p2 = ptMap.get(id2);
    if (!p1 || !p2) return;
    const px1 = toPx(p1);
    const px2 = toPx(p2);
    elementsSvg += `<line x1="${px1.x.toFixed(1)}" y1="${px1.y.toFixed(1)}" x2="${px2.x.toFixed(1)}" y2="${px2.y.toFixed(1)}" stroke="#000000" stroke-width="1.7" stroke-linecap="round" />`;
  });

  // Đường tròn (circles)
  (fig.circles || []).forEach((c) => {
    const center = ptMap.get(c.center);
    if (!center) return;
    const px = toPx(center);
    const r = c.radius * scale;
    elementsSvg += `<circle cx="${px.x.toFixed(1)}" cy="${px.y.toFixed(1)}" r="${r.toFixed(1)}" fill="none" stroke="#000000" stroke-width="1.6" />`;
  });

  // Ký hiệu góc vuông (rightAngles)
  (fig.rightAngles || []).forEach(([idA, idV, idB]) => {
    const pA = ptMap.get(idA);
    const pV = ptMap.get(idV);
    const pB = ptMap.get(idB);
    if (!pA || !pV || !pB) return;
    const pxA = toPx(pA);
    const pxV = toPx(pV);
    const pxB = toPx(pB);

    const s = 10;
    const dAx = pxA.x - pxV.x;
    const dAy = pxA.y - pxV.y;
    const lenA = Math.hypot(dAx, dAy) || 1;
    const uAx = (dAx / lenA) * s;
    const uAy = (dAy / lenA) * s;

    const dBx = pxB.x - pxV.x;
    const dBy = pxB.y - pxV.y;
    const lenB = Math.hypot(dBx, dBy) || 1;
    const uBx = (dBx / lenB) * s;
    const uBy = (dBy / lenB) * s;

    const p1x = pxV.x + uAx;
    const p1y = pxV.y + uAy;
    const p2x = pxV.x + uAx + uBx;
    const p2y = pxV.y + uAy + uBy;
    const p3x = pxV.x + uBx;
    const p3y = pxV.y + uBy;

    elementsSvg += `<polyline points="${p1x.toFixed(1)},${p1y.toFixed(1)} ${p2x.toFixed(1)},${p2y.toFixed(1)} ${p3x.toFixed(1)},${p3y.toFixed(1)}" fill="none" stroke="#000000" stroke-width="1.2" />`;
  });

  // Điểm và Nhãn điểm (labels)
  let pointsSvg = '';
  const centroidX = fig.points.reduce((acc, p) => acc + p.x, 0) / fig.points.length;
  const centroidY = fig.points.reduce((acc, p) => acc + p.y, 0) / fig.points.length;

  fig.points.forEach((p) => {
    const px = toPx(p);
    pointsSvg += `<circle cx="${px.x.toFixed(1)}" cy="${px.y.toFixed(1)}" r="2.2" fill="#000000" />`;

    // Đẩy nhãn lệch nhẹ ra phía ngoài trọng tâm hình
    const vx = p.x - centroidX;
    const vy = p.y - centroidY;
    const dist = Math.hypot(vx, vy) || 1;
    const offsetXLabel = (vx / dist) * 11;
    const offsetYLabel = (vy / dist) * -11; // SVG Y hướng xuống

    pointsSvg += `<text x="${(px.x + offsetXLabel).toFixed(1)}" y="${(px.y + offsetYLabel + 4).toFixed(1)}" font-size="12" font-style="italic" font-family="'Times New Roman', serif" font-weight="bold" fill="#000000" text-anchor="middle">${p.label || p.id}</text>`;
  });

  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto max-w-[340px] mx-auto select-none bg-white">
    <rect width="${width}" height="${height}" fill="#ffffff" />
    ${elementsSvg}
    ${pointsSvg}
  </svg>`;
}

/**
 * 3. Vẽ bảng biến thiên (variation-table) chuẩn THPT
 */
function renderVariationTableSvg(fig: VariationTableFigure): string {
  const width = 360;
  const hasDeriv = Boolean(fig.derivativeSigns && fig.derivativeSigns.length > 0);
  const height = hasDeriv ? 165 : 135;

  const headerW = 55;
  const tableW = width - 20;
  const contentW = tableW - headerW;
  const numCols = Math.max(2, fig.xValues.length);
  const colStep = contentW / (numCols - 1);

  const row1H = 35;
  const row2H = hasDeriv ? 35 : 0;
  const row3H = 75;

  // Khung bảng
  let svg = `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto max-w-[360px] mx-auto select-none bg-white font-serif">
    <rect width="${width}" height="${height}" fill="#ffffff" />
    <rect x="10" y="10" width="${tableW}" height="${height - 20}" fill="#ffffff" stroke="#000000" stroke-width="1.5" rx="3" />
    
    <!-- Kẻ dọc phân cột nhãn -->
    <line x1="${10 + headerW}" y1="10" x2="${10 + headerW}" y2="${height - 10}" stroke="#000000" stroke-width="1.2" />

    <!-- Kẻ ngang hàng x -->
    <line x1="10" y1="${10 + row1H}" x2="${10 + tableW}" y2="${10 + row1H}" stroke="#000000" stroke-width="1.2" />

    <!-- Nhãn hàng x -->
    <text x="${10 + headerW / 2}" y="${10 + 22}" font-size="13" font-style="italic" font-weight="bold" fill="#000000" text-anchor="middle">x</text>
  `;

  if (hasDeriv) {
    // Kẻ ngang hàng y'
    svg += `
      <line x1="10" y1="${10 + row1H + row2H}" x2="${10 + tableW}" y2="${10 + row1H + row2H}" stroke="#000000" stroke-width="1.2" />
      <text x="${10 + headerW / 2}" y="${10 + row1H + 22}" font-size="13" font-style="italic" font-weight="bold" fill="#000000" text-anchor="middle">y'</text>
    `;
  }

  // Nhãn hàng y
  const yLabelY = hasDeriv ? 10 + row1H + row2H + row3H / 2 + 4 : 10 + row1H + row3H / 2 + 4;
  svg += `<text x="${10 + headerW / 2}" y="${yLabelY}" font-size="13" font-style="italic" font-weight="bold" fill="#000000" text-anchor="middle">y</text>`;

  // Điền hàng x
  fig.xValues.forEach((val, i) => {
    const px = 10 + headerW + i * colStep;
    const cleanVal = formatMathSymbolsForSvg(val);
    svg += `<text x="${px.toFixed(1)}" y="${10 + 22}" font-size="11" fill="#000000" text-anchor="middle">${cleanVal}</text>`;
  });

  // Điền hàng y' (dấu và số 0)
  if (hasDeriv && fig.derivativeSigns) {
    fig.derivativeSigns.forEach((sign, i) => {
      const midX = 10 + headerW + (i + 0.5) * colStep;
      const cleanSign = sign === '-' ? '−' : '+';
      svg += `<text x="${midX.toFixed(1)}" y="${10 + row1H + 22}" font-size="13" font-weight="bold" fill="#000000" text-anchor="middle">${cleanSign}</text>`;
    });
    // Điền số 0 tại các nghiệm
    for (let i = 1; i < fig.xValues.length - 1; i++) {
      const px = 10 + headerW + i * colStep;
      svg += `<text x="${px.toFixed(1)}" y="${10 + row1H + 22}" font-size="11" fill="#64748b" text-anchor="middle">0</text>`;
    }
  }

  // Vẽ mũi tên và giá trị y
  const yTop = hasDeriv ? 10 + row1H + row2H + 18 : 10 + row1H + 18;
  const yBottom = hasDeriv ? 10 + row1H + row2H + row3H - 14 : 10 + row1H + row3H - 14;

  const yPos: { x: number; y: number }[] = [];
  fig.yValues.forEach((val, i) => {
    const px = 10 + headerW + i * colStep;
    // Xác định vị trí đỉnh (yTop) hay đáy (yBottom) dựa vào xu hướng
    let py = yTop;
    if (i === 0) {
      py = fig.trends[0] === 'up' ? yBottom : yTop;
    } else if (i === fig.yValues.length - 1) {
      py = fig.trends[fig.trends.length - 1] === 'up' ? yTop : yBottom;
    } else {
      const prevTrend = fig.trends[i - 1];
      py = prevTrend === 'up' ? yTop : yBottom;
    }

    yPos.push({ x: px, y: py });
    const cleanYVal = formatMathSymbolsForSvg(val);
    svg += `<text x="${px.toFixed(1)}" y="${(py + (py === yTop ? -4 : 12)).toFixed(1)}" font-size="11" font-weight="bold" fill="#000000" text-anchor="middle">${cleanYVal}</text>`;
  });

  // Mũi tên biến thiên
  fig.trends.forEach((trend, i) => {
    if (i >= yPos.length - 1) return;
    const p1 = yPos[i];
    const p2 = yPos[i + 1];

    const arrowY1 = trend === 'up' ? yBottom : yTop;
    const arrowY2 = trend === 'up' ? yTop : yBottom;

    svg += `
      <line x1="${(p1.x + 8).toFixed(1)}" y1="${arrowY1}" x2="${(p2.x - 8).toFixed(1)}" y2="${arrowY2}" stroke="#000000" stroke-width="1.5" marker-end="url(#fig-arrow)" />
    `;
  });

  svg += `</svg>`;
  return svg;
}

/**
 * 4. Vẽ bảng xét dấu (sign-table) chuẩn THPT
 * { kind: 'sign-table', rowLabel: string, xValues: string[], intervalSigns: ('+' | '-')[], pointMarks: ('0' | '||' | '')[] }
 */
function renderSignTableSvg(fig: SignTableFigure): string {
  const width = 360;
  const height = 95;
  const headerW = 55;
  const tableW = width - 20;
  const contentW = tableW - headerW;
  const numCols = Math.max(2, fig.xValues.length);
  const colStep = contentW / (numCols - 1);
  const row1H = 38;
  const row2H = 37;

  let svg = `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto max-w-[360px] mx-auto select-none bg-white font-serif">
    <rect width="${width}" height="${height}" fill="#ffffff" />
    <rect x="10" y="10" width="${tableW}" height="${row1H + row2H}" fill="#ffffff" stroke="#000000" stroke-width="1.4" rx="3" />
    
    <!-- Kẻ dọc phân cột nhãn -->
    <line x1="${10 + headerW}" y1="10" x2="${10 + headerW}" y2="${10 + row1H + row2H}" stroke="#000000" stroke-width="1.2" />

    <!-- Kẻ ngang giữa hàng x và hàng rowLabel -->
    <line x1="10" y1="${10 + row1H}" x2="${10 + tableW}" y2="${10 + row1H}" stroke="#000000" stroke-width="1.2" />

    <!-- Nhãn hàng x -->
    <text x="${10 + headerW / 2}" y="${10 + 24}" font-size="13" font-style="italic" font-weight="bold" fill="#000000" text-anchor="middle">x</text>

    <!-- Nhãn hàng dấu (rowLabel: ví dụ f'(x) hoặc y') -->
    <text x="${10 + headerW / 2}" y="${10 + row1H + 24}" font-size="13" font-style="italic" font-weight="bold" fill="#000000" text-anchor="middle">${fig.rowLabel || "f'(x)"}</text>
  `;

  // Điền hàng x (xValues)
  fig.xValues.forEach((val, i) => {
    const px = 10 + headerW + i * colStep;
    const cleanVal = formatMathSymbolsForSvg(val);
    svg += `<text x="${px.toFixed(1)}" y="${10 + 24}" font-size="12" fill="#000000" text-anchor="middle">${cleanVal}</text>`;
  });

  // Điền hàng dấu: các mốc pointMarks ngay dưới các mốc ở giữa
  if (Array.isArray(fig.pointMarks)) {
    fig.pointMarks.forEach((mark, i) => {
      const px = 10 + headerW + (i + 1) * colStep;
      if (mark === '||') {
        // Dấu hai gạch song song thẳng đứng
        svg += `
          <line x1="${(px - 1.5).toFixed(1)}" y1="${10 + row1H}" x2="${(px - 1.5).toFixed(1)}" y2="${10 + row1H + row2H}" stroke="#000000" stroke-width="1.2" />
          <line x1="${(px + 1.5).toFixed(1)}" y1="${10 + row1H}" x2="${(px + 1.5).toFixed(1)}" y2="${10 + row1H + row2H}" stroke="#000000" stroke-width="1.2" />
        `;
      } else if (mark === '0' || (mark as any) === 0) {
        svg += `<text x="${px.toFixed(1)}" y="${10 + row1H + 24}" font-size="12" fill="#000000" text-anchor="middle">0</text>`;
      } else if (mark) {
        svg += `<text x="${px.toFixed(1)}" y="${10 + row1H + 24}" font-size="12" fill="#000000" text-anchor="middle">${mark}</text>`;
      }
    });
  }

  // Điền khoảng dấu intervalSigns (+ hoặc -) ở giữa các mốc
  if (Array.isArray(fig.intervalSigns)) {
    fig.intervalSigns.forEach((sign, i) => {
      const midX = 10 + headerW + (i + 0.5) * colStep;
      const displaySign = sign === '-' ? '−' : '+';
      svg += `<text x="${midX.toFixed(1)}" y="${10 + row1H + 25}" font-size="15" font-weight="bold" fill="#000000" text-anchor="middle">${displaySign}</text>`;
    });
  }

  svg += `</svg>`;
  return svg;
}

/**
 * 4. Vẽ biểu đồ số liệu (data-chart)
 */
function renderDataChartSvg(fig: DataChartFigure): string {
  const width = 360;
  const height = 220;
  const padLeft = 45;
  const padRight = 30;
  const padTop = 35;
  const padBottom = 40;

  const labels = fig.labels || [];
  const series = fig.series || [];
  if (labels.length === 0 || series.length === 0) return '';

  let maxVal = 0;
  series.forEach((s) => {
    s.values.forEach((v) => {
      if (v > maxVal) maxVal = v;
    });
  });
  if (maxVal === 0) maxVal = 10;
  maxVal = Math.ceil(maxVal * 1.15);

  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  let titleSvg = '';
  if (fig.title) {
    titleSvg = `<text x="${width / 2}" y="20" font-size="12" font-weight="bold" fill="#000000" text-anchor="middle">${fig.title}</text>`;
  }

  const unitSvg = fig.unit
    ? `<text x="${padLeft}" y="${padTop - 10}" font-size="10" font-style="italic" fill="#64748b">(${fig.unit})</text>`
    : '';

  // Trục Ox, Oy
  const axesSvg = `
    <line x1="${padLeft}" y1="${height - padBottom}" x2="${width - padRight}" y2="${height - padBottom}" stroke="#000000" stroke-width="1.5" />
    <line x1="${padLeft}" y1="${height - padBottom}" x2="${padLeft}" y2="${padTop}" stroke="#000000" stroke-width="1.5" />
  `;

  let chartContent = '';

  if (fig.chartType === 'line') {
    // Biểu đồ đường
    series.forEach((s, sIdx) => {
      const pts = s.values.map((v, i) => {
        const x = padLeft + (i + 0.5) * (plotW / labels.length);
        const y = padTop + plotH - (v / maxVal) * plotH;
        return { x, y, v };
      });

      let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
      for (let i = 1; i < pts.length; i++) {
        d += ` L ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
      }

      chartContent += `<path d="${d}" fill="none" stroke="#000000" stroke-width="1.8" />`;
      pts.forEach((pt) => {
        chartContent += `<circle cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="3" fill="#000000" />`;
        chartContent += `<text x="${pt.x.toFixed(1)}" y="${(pt.y - 6).toFixed(1)}" font-size="10" fill="#000000" text-anchor="middle">${pt.v}</text>`;
      });
    });
  } else {
    // Mặc định: Biểu đồ cột (bar)
    const groupW = plotW / labels.length;
    const barW = Math.min(28, (groupW * 0.7) / series.length);

    labels.forEach((label, i) => {
      const groupX = padLeft + i * groupW + groupW * 0.15;
      series.forEach((s, sIdx) => {
        const v = s.values[i] || 0;
        const bH = (v / maxVal) * plotH;
        const bx = groupX + sIdx * (barW + 2);
        const by = height - padBottom - bH;

        chartContent += `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${barW.toFixed(1)}" height="${bH.toFixed(1)}" fill="#334155" stroke="#000000" stroke-width="1" />`;
        chartContent += `<text x="${(bx + barW / 2).toFixed(1)}" y="${(by - 4).toFixed(1)}" font-size="9.5" fill="#000000" text-anchor="middle">${v}</text>`;
      });
    });
  }

  // Nhãn x-axis
  let labelsSvg = '';
  labels.forEach((label, i) => {
    const x = padLeft + (i + 0.5) * (plotW / labels.length);
    labelsSvg += `<text x="${x.toFixed(1)}" y="${height - padBottom + 16}" font-size="10.5" fill="#000000" text-anchor="middle">${label}</text>`;
  });

  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto max-w-[360px] mx-auto select-none bg-white font-sans">
    <rect width="${width}" height="${height}" fill="#ffffff" />
    ${titleSvg}
    ${unitSvg}
    ${axesSvg}
    ${chartContent}
    ${labelsSvg}
  </svg>`;
}
