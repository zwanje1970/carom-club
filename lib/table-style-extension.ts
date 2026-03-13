/**
 * Table/TableCell/TableHeader 확장: style 속성 추가.
 * 표 바탕색·선색·선종류·선굵기, 셀별 바탕색·선색·선종류·선굵기 지원.
 * 표 정렬(왼쪽/가운데/오른쪽) 지원.
 */
import { Table, TableCell, TableHeader } from "@tiptap/extension-table";
import { TableView as BaseTableView } from "@tiptap/pm/tables";
import type { Node as PMNode } from "@tiptap/pm/model";
import type { NodeView } from "@tiptap/pm/view";

function applyTableAlign(dom: HTMLElement, align: string | null) {
  const v = align || "left";
  dom.style.marginLeft = v === "right" ? "auto" : v === "center" ? "auto" : "0";
  dom.style.marginRight = v === "right" ? "0" : v === "center" ? "auto" : "auto";
  if (v === "center" || v === "right") {
    dom.style.width = "fit-content";
    dom.style.maxWidth = "100%";
  } else {
    dom.style.width = "";
    dom.style.maxWidth = "";
  }
}

/** 표 정렬(wrapper) + style(테이블 요소) 적용 TableView */
export class TableViewWithAlign extends BaseTableView implements NodeView {
  declare table: HTMLTableElement;

  constructor(
    node: PMNode,
    cellMinWidth: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- BaseTableView signature
    _view?: import("@tiptap/pm/view").EditorView
  ) {
    super(node, cellMinWidth);
    applyTableAlign(this.dom, node.attrs.align);
    if (node.attrs.style && typeof node.attrs.style === "string") {
      this.table.style.cssText = node.attrs.style;
    }
  }

  update(node: PMNode): boolean {
    const ok = super.update(node);
    if (ok) {
      applyTableAlign(this.dom, node.attrs.align);
      if (node.attrs.style && typeof node.attrs.style === "string") {
        this.table.style.cssText = node.attrs.style;
      }
    }
    return ok;
  }
}

export const TableWithStyle = Table.extend({
  addAttributes() {
    return {
      style: {
        default: null,
        parseHTML: (element) => (element as HTMLElement).getAttribute("style") || null,
        renderHTML: (attributes) => (attributes.style ? { style: attributes.style } : {}),
      },
      align: {
        default: null,
        parseHTML: (element) => (element as HTMLElement).getAttribute("data-align") || null,
        renderHTML: (attributes) => (attributes.align ? { "data-align": attributes.align } : {}),
      },
    };
  },
});

/** 셀 노드에 style 속성 추가 (셀별 바탕색·선·선종류·선굵기). */
export const TableCellWithStyle = TableCell.extend({
  addAttributes() {
    const parent = this.parent?.() ?? {};
    return {
      ...parent,
      style: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute("style") || null,
        renderHTML: (attrs) => (attrs.style ? { style: attrs.style } : {}),
      },
    };
  },
});

export const TableHeaderWithStyle = TableHeader.extend({
  addAttributes() {
    const parent = this.parent?.() ?? {};
    return {
      ...parent,
      style: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute("style") || null,
        renderHTML: (attrs) => (attrs.style ? { style: attrs.style } : {}),
      },
    };
  },
});

/**
 * 현재 table style 문자열에서 width/min-width만 추출 (표 너비 유지용).
 */
export function getWidthFromTableStyle(style: string | null | undefined): string {
  if (!style || typeof style !== "string") return "";
  const widthMatch = style.match(/\bwidth\s*:\s*[^;]+/i);
  const minWidthMatch = style.match(/\bmin-width\s*:\s*[^;]+/i);
  const parts: string[] = [];
  if (widthMatch) parts.push(widthMatch[0].trim());
  if (minWidthMatch) parts.push(minWidthMatch[0].trim());
  return parts.join("; ");
}

export type TableStyleParts = {
  backgroundColor?: string;
  borderColor?: string;
  borderStyle?: string;
  borderWidth?: string;
};

/**
 * style 문자열에서 배경/테두리 관련 부분 파싱 (대략적).
 */
export function parseTableStyle(style: string | null | undefined): TableStyleParts {
  const out: TableStyleParts = {};
  if (!style || typeof style !== "string") return out;
  const bg = style.match(/\bbackground(?:-color)?\s*:\s*([^;]+)/i);
  if (bg) out.backgroundColor = bg[1].trim();
  const bc = style.match(/\b(?:border-color|--table-bc)\s*:\s*([^;]+)/i);
  if (bc) out.borderColor = bc[1].trim();
  const bs = style.match(/\b(?:border-style|--table-bs)\s*:\s*([^;]+)/i);
  if (bs) out.borderStyle = bs[1].trim();
  const bw = style.match(/\b(?:border-width|--table-bw)\s*:\s*([^;]+)/i);
  if (bw) out.borderWidth = bw[1].trim();
  if (!out.borderWidth && !out.borderStyle && !out.borderColor) {
    const borderShorthand = style.match(/\bborder\s*:\s*([^;]+)/i);
    if (borderShorthand) {
      const parts = borderShorthand[1].trim().split(/\s+/);
      if (parts.length >= 1) out.borderWidth = parts[0];
      if (parts.length >= 2) out.borderStyle = parts[1];
      if (parts.length >= 3) out.borderColor = parts[2];
    }
  }
  return out;
}

/**
 * 바탕색·선색·선종류·선굵기 + 기존 width/min-width 를 합쳐 style 문자열 생성.
 * options에 없는 값은 currentStyle에서 파싱한 값으로 유지.
 * 셀 테두리용 CSS 변수(--table-bc, --table-bs, --table-bw)도 포함.
 */
export function buildTableStyle(
  currentStyle: string | null | undefined,
  options: {
    backgroundColor?: string | null;
    borderColor?: string | null;
    borderStyle?: string | null;
    borderWidth?: string | null;
  }
): string {
  const widthPart = getWidthFromTableStyle(currentStyle);
  const parsed = parseTableStyle(currentStyle);
  const bg = options.backgroundColor !== undefined ? options.backgroundColor : parsed.backgroundColor;
  const bc = options.borderColor !== undefined ? options.borderColor : parsed.borderColor;
  const bs = options.borderStyle !== undefined ? options.borderStyle : parsed.borderStyle;
  const bw = options.borderWidth !== undefined ? options.borderWidth : parsed.borderWidth;
  const parts: string[] = [];
  if (bg) parts.push(`background-color: ${bg}`);
  if (bw) parts.push(`border-width: ${bw}`);
  if (bs) parts.push(`border-style: ${bs}`);
  if (bc) parts.push(`border-color: ${bc}`);
  if (bc) parts.push(`--table-bc: ${bc}`);
  if (bs) parts.push(`--table-bs: ${bs}`);
  if (bw) parts.push(`--table-bw: ${bw}`);
  if (widthPart) parts.push(widthPart);
  return parts.join("; ");
}

/** 셀용: 바탕색·선색·선종류·선굵기만 (width 없음). */
export function buildCellStyle(
  currentStyle: string | null | undefined,
  options: {
    backgroundColor?: string | null;
    borderColor?: string | null;
    borderStyle?: string | null;
    borderWidth?: string | null;
  }
): string {
  const parsed = parseTableStyle(currentStyle);
  const bg = options.backgroundColor !== undefined ? options.backgroundColor : parsed.backgroundColor;
  const bc = options.borderColor !== undefined ? options.borderColor : parsed.borderColor;
  const bs = options.borderStyle !== undefined ? options.borderStyle : parsed.borderStyle;
  const bw = options.borderWidth !== undefined ? options.borderWidth : parsed.borderWidth;
  const parts: string[] = [];
  if (bg) parts.push(`background-color: ${bg}`);
  if (bw) parts.push(`border-width: ${bw}`);
  if (bs) parts.push(`border-style: ${bs}`);
  if (bc) parts.push(`border-color: ${bc}`);
  return parts.join("; ");
}
