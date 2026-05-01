"use client";

import {
  ChangeEvent,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  COMMUNITY_POST_DEFAULT_SIZE_LEVEL,
  COMMUNITY_POST_SIZE_LEVEL_MAX,
  COMMUNITY_POST_SIZE_LEVEL_MIN,
  clampCommunityPostSizeLevel,
  getCommunityPostLongEdgePx,
} from "../../../lib/community-post-content-images";
import { MAX_COMMUNITY_POST_IMAGE_COUNT } from "../../../lib/community-post-images";

type TextBlock = { type: "text"; value: string };
/** `previewUrl`: 업로드 전 로컬 미리보기(blob:). 저장 직렬화에는 `url`(서버 w640 등)만 포함 */
type ImageBlock = { type: "image"; url: string; sizeLevel: number; previewUrl?: string };
type Block = TextBlock | ImageBlock;

function countImages(blocks: Block[]): number {
  return blocks.filter((b) => b.type === "image").length;
}

/** 빈 cp-text에만 쓰는 캐럿 앵커(저장·직렬화에서는 제거) */
const TEXT_CARET_ANCHOR = "\u200B";

/** 저장: 기존 마크다운 직렬화 유지 */
function serializeBlocks(blocks: Block[]): { content: string; imageUrls: string[]; imageSizeLevels: number[] } {
  const imageUrls: string[] = [];
  const imageSizeLevels: number[] = [];
  let content = "";
  for (const b of blocks) {
    if (b.type === "text") {
      content += b.value.replace(new RegExp(TEXT_CARET_ANCHOR, "g"), "");
    } else {
      if (b.previewUrl && !b.url.trim()) {
        content += "\n";
        continue;
      }
      const u = b.url.trim();
      if (!u) {
        content += "\n";
        continue;
      }
      imageUrls.push(u);
      imageSizeLevels.push(b.sizeLevel);
      const needsNl = content.length > 0 && !content.endsWith("\n");
      content += `${needsNl ? "\n" : ""}![](${u})\n`;
    }
  }
  return { content, imageUrls, imageSizeLevels };
}

function deserializeBlocks(content: string, fallbackUrls: string[], sizeLevels: number[]): Block[] {
  const re = /!\[\]\(([^)]+)\)/g;
  const blocks: Block[] = [];
  let last = 0;
  let imgIdx = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    if (m.index > last) {
      blocks.push({ type: "text", value: content.slice(last, m.index) });
    }
    const url = m[1].trim();
    if (url) {
      const level = clampCommunityPostSizeLevel(sizeLevels[imgIdx] ?? COMMUNITY_POST_DEFAULT_SIZE_LEVEL);
      blocks.push({ type: "image", url, sizeLevel: level });
      imgIdx++;
    }
    last = m.index + m[0].length;
  }
  if (last < content.length) {
    blocks.push({ type: "text", value: content.slice(last) });
  }
  if (blocks.length === 0) {
    blocks.push({ type: "text", value: content });
  }
  const embedded = new Set<string>();
  for (const b of blocks) {
    if (b.type === "image") embedded.add(b.url);
  }
  for (const u of fallbackUrls) {
    if (!embedded.has(u)) {
      const level = clampCommunityPostSizeLevel(sizeLevels[imgIdx] ?? COMMUNITY_POST_DEFAULT_SIZE_LEVEL);
      blocks.push({ type: "image", url: u, sizeLevel: level });
      imgIdx++;
    }
  }
  return blocks;
}

function deleteImageBlock(blocks: Block[], imageBlockIndex: number): Block[] {
  if (blocks[imageBlockIndex]?.type !== "image") return blocks;
  const next = [...blocks];
  const prev = next[imageBlockIndex - 1];
  const after = next[imageBlockIndex + 1];
  if (prev?.type === "text" && after?.type === "text") {
    next.splice(imageBlockIndex - 1, 3, { type: "text", value: prev.value + after.value });
  } else {
    next.splice(imageBlockIndex, 1);
  }
  return next;
}

function splitTextBlock(blocks: Block[], textBlockIndex: number, cursor: number): Block[] {
  const b = blocks[textBlockIndex];
  if (b?.type !== "text") return blocks;
  const before = b.value.slice(0, cursor);
  const after = b.value.slice(cursor);
  const next = [...blocks];
  next.splice(textBlockIndex, 1, { type: "text", value: before }, { type: "text", value: after });
  return next;
}

function mergeAdjacentTextBlocks(blocks: Block[], firstTextIdx: number): Block[] {
  const a = blocks[firstTextIdx] as TextBlock | undefined;
  const b = blocks[firstTextIdx + 1] as TextBlock | undefined;
  if (a?.type !== "text" || b?.type !== "text") return blocks;
  const next = [...blocks];
  next.splice(firstTextIdx, 2, { type: "text", value: a.value + b.value });
  return next;
}

function findPrevTextBlockIndex(blocks: Block[], textIdx: number): number | null {
  let j = textIdx - 1;
  while (j >= 0 && blocks[j].type === "image") j--;
  if (j < 0 || blocks[j].type !== "text") return null;
  return j;
}

function findNextTextBlockIndex(blocks: Block[], textIdx: number): number | null {
  let j = textIdx + 1;
  while (j < blocks.length && blocks[j].type === "image") j++;
  if (j >= blocks.length || blocks[j].type !== "text") return null;
  return j;
}

function ensureTrailingTextBlock(blocks: Block[]): Block[] {
  if (blocks.length === 0) return [{ type: "text", value: "" }];
  if (blocks[blocks.length - 1].type === "image") {
    return [...blocks, { type: "text", value: "" }];
  }
  return blocks;
}

/**
 * editor 직계 자식이 아닌 div/p 래핑 등이 있어도, 문서 순서의 논리 블록 루트(cp-text | cp-img-wrap)만 모은다.
 * 한 블록 루트가 다른 cp-text/cp-img-wrap 안에 중첩된 경우는 제외(상위 루트만 사용).
 */
function getOrderedBlockRoots(editor: HTMLElement): HTMLElement[] {
  const candidates = editor.querySelectorAll(".cp-text, .cp-img-wrap");
  const roots: HTMLElement[] = [];
  candidates.forEach((el) => {
    const h = el as HTMLElement;
    let p: HTMLElement | null = h.parentElement;
    while (p && p !== editor) {
      if (p.classList.contains("cp-text") || p.classList.contains("cp-img-wrap")) {
        return;
      }
      p = p.parentElement;
    }
    roots.push(h);
  });
  roots.sort((a, b) => {
    const pos = a.compareDocumentPosition(b);
    if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  });
  return roots;
}

function setCaretInTextBlock(editor: HTMLElement, blockIndex: number, offset: number) {
  const roots = getOrderedBlockRoots(editor);
  const child = roots[blockIndex] as HTMLElement | undefined;
  if (!child?.classList.contains("cp-text")) return;
  let tn = child.firstChild as Text | null;
  if (!tn || tn.nodeType !== Node.TEXT_NODE) {
    tn = document.createTextNode("");
    child.appendChild(tn);
  }
  const len = tn.length;
  const o = Math.max(0, Math.min(offset, len));
  const range = document.createRange();
  range.setStart(tn, o);
  range.collapse(true);
  const sel = window.getSelection();
  if (!sel) return;
  sel.removeAllRanges();
  sel.addRange(range);
}

function renderEditorFromBlocks(editor: HTMLElement, blocks: Block[]) {
  editor.textContent = "";
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.type === "text") {
      const span = document.createElement("span");
      span.className = "cp-text";
      span.style.whiteSpace = "pre-wrap";
      span.style.outline = "none";
      span.style.display = "inline";
      span.dataset.bi = String(i);
      const tv = b.value === "" ? TEXT_CARET_ANCHOR : b.value;
      span.appendChild(document.createTextNode(tv));
      editor.appendChild(span);
    } else {
      const wrap = document.createElement("span");
      wrap.className = "cp-img-wrap";
      wrap.contentEditable = "false";
      wrap.dataset.bi = String(i);
      wrap.dataset.url = b.url;
      if (b.previewUrl) wrap.dataset.previewUrl = b.previewUrl;
      else delete wrap.dataset.previewUrl;
      wrap.dataset.sizeLevel = String(b.sizeLevel);
      wrap.style.display = "inline-block";
      wrap.style.boxSizing = "border-box";
      wrap.style.verticalAlign = "bottom";
      wrap.style.maxWidth = "100%";
      wrap.style.margin = "0.2rem 0.35rem 0.2rem 0";
      wrap.style.lineHeight = "normal";
      const px = getCommunityPostLongEdgePx(b.sizeLevel);
      const img = document.createElement("img");
      img.src = b.previewUrl && !b.url.trim() ? b.previewUrl : b.url;
      img.alt = "";
      img.draggable = false;
      img.loading = b.previewUrl && !b.url.trim() ? "eager" : "lazy";
      img.decoding = "async";
      img.style.maxWidth = `${px}px`;
      img.style.maxHeight = `${px}px`;
      img.style.width = "auto";
      img.style.height = "auto";
      img.style.objectFit = "contain";
      img.style.display = "inline-block";
      img.style.verticalAlign = "middle";
      img.style.borderRadius = "0.35rem";
      img.style.border = "1px solid #e5e5e5";
      img.style.cursor = "pointer";
      wrap.appendChild(img);
      editor.appendChild(wrap);
    }
  }
}

/** contenteditable 안의 브라우저 삽입 노드(div, br, 래핑 등)까지 순회해 텍스트·이미지 블록 복원 */
function parseDomToBlocks(editor: HTMLElement): Block[] {
  const blocks: Block[] = [];
  let buf = "";

  function flushText() {
    let v = buf;
    if (v === TEXT_CARET_ANCHOR) v = "";
    blocks.push({ type: "text", value: v });
    buf = "";
  }

  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      buf += node.textContent ?? "";
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;

    if (el.classList.contains("cp-img-wrap")) {
      flushText();
      const url = el.dataset.url ?? "";
      const previewUrl = typeof el.dataset.previewUrl === "string" ? el.dataset.previewUrl.trim() : "";
      const level = clampCommunityPostSizeLevel(
        parseInt(el.dataset.sizeLevel ?? "", 10) || COMMUNITY_POST_DEFAULT_SIZE_LEVEL
      );
      if (url.trim() || previewUrl) {
        blocks.push({
          type: "image",
          url: url.trim(),
          sizeLevel: level,
          ...(previewUrl ? { previewUrl } : {}),
        });
      }
      return;
    }

    if (el.tagName === "BR") {
      buf += "\n";
      return;
    }

    for (let i = 0; i < el.childNodes.length; i++) {
      walk(el.childNodes[i]!);
    }
  }

  for (let i = 0; i < editor.childNodes.length; i++) {
    walk(editor.childNodes[i]!);
  }
  flushText();

  const merged: Block[] = [];
  for (const b of blocks) {
    if (b.type === "text") {
      const last = merged[merged.length - 1];
      if (last?.type === "text") {
        if (last.value === "" && b.value === "") {
          merged.push({ type: "text", value: "" });
        } else {
          last.value += b.value;
        }
      } else {
        merged.push({ type: "text", value: b.value });
      }
    } else {
      merged.push(b);
    }
  }

  if (merged.length === 0) merged.push({ type: "text", value: "" });
  return ensureTrailingTextBlock(merged);
}

/** 이미지가 선형 길이에 없을 때 폴백(중첩 DOM 등) */
function mapLinearOffsetToCaret(
  blocks: Block[],
  linear: number
): { blockIndex: number; start: number; end: number } {
  let pos = linear;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.type !== "text") continue;
    const L = b.value.length;
    if (pos < L) return { blockIndex: i, start: pos, end: pos };
    if (pos === L) return { blockIndex: i, start: L, end: L };
    pos -= L;
  }
  for (let j = blocks.length - 1; j >= 0; j--) {
    if (blocks[j].type === "text") {
      const tb = blocks[j] as TextBlock;
      return { blockIndex: j, start: tb.value.length, end: tb.value.length };
    }
  }
  return { blockIndex: 0, start: 0, end: 0 };
}

function getCaretInEditorFromLinear(editor: HTMLElement, blocks: Block[]): { blockIndex: number; start: number; end: number } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const r = sel.getRangeAt(0);
  const pre = document.createRange();
  pre.selectNodeContents(editor);
  try {
    pre.setEnd(r.startContainer, r.startOffset);
  } catch {
    return null;
  }
  const linearStart = pre.toString().length;
  let linearEnd = linearStart;
  if (!r.collapsed) {
    const preEnd = document.createRange();
    preEnd.selectNodeContents(editor);
    try {
      preEnd.setEnd(r.endContainer, r.endOffset);
      linearEnd = preEnd.toString().length;
    } catch {
      linearEnd = linearStart;
    }
  }
  const startCaret = mapLinearOffsetToCaret(blocks, linearStart);
  if (!r.collapsed) {
    const endCaret = mapLinearOffsetToCaret(blocks, linearEnd);
    return { blockIndex: startCaret.blockIndex, start: startCaret.start, end: endCaret.end };
  }
  return startCaret;
}

function getTextOffsetInSpan(span: HTMLElement, node: Node, offset: number): number {
  const range = document.createRange();
  range.selectNodeContents(span);
  range.setEnd(node, offset);
  return range.toString().length;
}

/** 이미지는 Range 길이에 안 잡혀 선형 오프셋이 깨지므로, DOM의 블록 루트(cp-text/cp-img-wrap) 순서로 인덱스를 맞춘다 */
function getCaretInEditor(editor: HTMLElement, blocks: Block[]): { blockIndex: number; start: number; end: number } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  const roots = getOrderedBlockRoots(editor);

  function caretInTextChild(i: number, child: HTMLElement) {
    const rawStart =
      range.startContainer.nodeType === Node.TEXT_NODE && child.contains(range.startContainer)
        ? getTextOffsetInSpan(child, range.startContainer, range.startOffset)
        : range.startContainer === child
          ? 0
          : 0;
    const blockText = (blocks[i] as TextBlock | undefined)?.value ?? "";
    const start = blockText === "" && rawStart >= 1 && child.textContent === TEXT_CARET_ANCHOR ? 0 : rawStart;
    let end = start;
    if (range.collapsed) {
      return { blockIndex: i, start, end: start };
    }
    if (child.contains(range.endContainer) || child === range.endContainer) {
      const rawEnd =
        range.endContainer.nodeType === Node.TEXT_NODE && child.contains(range.endContainer)
          ? getTextOffsetInSpan(child, range.endContainer, range.endOffset)
          : start;
      const endNorm = blockText === "" && rawEnd >= 1 && child.textContent === TEXT_CARET_ANCHOR ? 0 : rawEnd;
      end = endNorm;
    }
    return { blockIndex: i, start, end };
  }

  for (let i = 0; i < roots.length; i++) {
    const child = roots[i];
    if (!child.classList.contains("cp-text")) continue;
    if (child.contains(range.startContainer) || child === range.startContainer) {
      return caretInTextChild(i, child);
    }
  }

  if (range.startContainer === editor && range.startOffset <= editor.childNodes.length) {
    const off = range.startOffset;
    const before = off > 0 ? editor.childNodes[off - 1] : null;
    const after = off < editor.childNodes.length ? editor.childNodes[off] : null;
    if (after?.nodeType === Node.ELEMENT_NODE) {
      const el = after as HTMLElement;
      if (el.classList.contains("cp-text")) {
        const ri = roots.indexOf(el);
        if (ri >= 0) return { blockIndex: ri, start: 0, end: 0 };
      }
    }
    if (before?.nodeType === Node.ELEMENT_NODE) {
      const el = before as HTMLElement;
      if (el.classList.contains("cp-text")) {
        const ri = roots.indexOf(el);
        if (ri >= 0) {
          const tb = (blocks[ri] as TextBlock | undefined)?.value ?? "";
          return { blockIndex: ri, start: tb.length, end: tb.length };
        }
      }
      if (el.classList.contains("cp-img-wrap")) {
        const ri = roots.indexOf(el);
        if (ri >= 0 && ri + 1 < roots.length) {
          const next = roots[ri + 1];
          if (next.classList.contains("cp-text")) {
            const ni = ri + 1;
            return { blockIndex: ni, start: 0, end: 0 };
          }
        }
      }
    }
  }

  return getCaretInEditorFromLinear(editor, blocks);
}

function scrollCaretOrSelectionIntoViewIfNeeded(editor: HTMLElement) {
  if (typeof window === "undefined") return;
  if (!window.matchMedia("(pointer: coarse)").matches && !("ontouchstart" in window)) return;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const r = sel.getRangeAt(0);
  let rect = r.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    const n = r.startContainer;
    if (n.nodeType === Node.TEXT_NODE && n.parentElement) {
      rect = n.parentElement.getBoundingClientRect();
    } else {
      return;
    }
  }
  const vv = window.visualViewport;
  const vh = vv?.height ?? window.innerHeight;
  const topInset = (vv?.offsetTop ?? 0) + 40;
  const bottomInset = (vv?.offsetTop ?? 0) + vh - 56;
  if (rect.top < topInset || rect.bottom > bottomInset) {
    editor.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
}

export type CommunityPostBodyEditorHandle = {
  openImageAttach: () => void;
};

type Props = {
  disabled?: boolean;
  initialContent: string;
  initialImageUrls: string[];
  initialImageSizeLevels: number[];
  onSerializedChange: (payload: { content: string; imageUrls: string[]; imageSizeLevels: number[] }) => void;
  /** 부모에서 라벨 줄에 붙이는 첨부 버튼용(업로드 중·잔여 슬롯) */
  onAttachUiChange?: (state: { uploading: boolean; remaining: number; pendingImages: boolean }) => void;
};

const CommunityPostBodyEditor = forwardRef<CommunityPostBodyEditorHandle, Props>(function CommunityPostBodyEditor(
  { disabled, initialContent, initialImageUrls, initialImageSizeLevels, onSerializedChange, onAttachUiChange },
  ref
) {
  const [blocks, setBlocks] = useState<Block[]>(() =>
    ensureTrailingTextBlock(deserializeBlocks(initialContent, initialImageUrls, initialImageSizeLevels))
  );
  const editorRef = useRef<HTMLDivElement>(null);
  const lastCaretRef = useRef({ blockIndex: 0, start: 0, end: 0 });
  const fileRef = useRef<HTMLInputElement>(null);
  /** 동시에 두 번 파일 선택 처리 방지(업로드 중에도 본문 편집은 유지) */
  const imagePickBusyRef = useRef(false);
  const bodySurfaceRef = useRef<HTMLDivElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [selectedImageBlockIndex, setSelectedImageBlockIndex] = useState<number | null>(null);
  const selectedImageBlockIndexRef = useRef<number | null>(null);
  const [toolbarRect, setToolbarRect] = useState<DOMRect | null>(null);
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;
  const composingRef = useRef(false);
  const [coarsePointer, setCoarsePointer] = useState(false);

  useEffect(() => {
    setCoarsePointer(typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches);
  }, []);

  useEffect(() => {
    selectedImageBlockIndexRef.current = selectedImageBlockIndex;
  }, [selectedImageBlockIndex]);

  useEffect(() => {
    onSerializedChange(serializeBlocks(blocks));
  }, [blocks, onSerializedChange]);

  const remaining = MAX_COMMUNITY_POST_IMAGE_COUNT - countImages(blocks);
  const pendingImages = blocks.some((b) => b.type === "image" && !!(b as ImageBlock).previewUrl && !b.url.trim());
  useEffect(() => {
    onAttachUiChange?.({ uploading, remaining, pendingImages });
  }, [onAttachUiChange, uploading, remaining, pendingImages]);

  useLayoutEffect(() => {
    const ed = editorRef.current;
    if (!ed) return;
    renderEditorFromBlocks(ed, blocks);
    const caret = lastCaretRef.current;
    const roots = getOrderedBlockRoots(ed);
    if (roots[caret.blockIndex]?.classList.contains("cp-text")) {
      setCaretInTextBlock(ed, caret.blockIndex, caret.start);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 초기 마운트 시에만 편집면을 채움
  }, []);

  useLayoutEffect(() => {
    const ed = editorRef.current;
    if (!ed) return;
    ed.querySelectorAll(".cp-img-wrap").forEach((w) => {
      const bi = parseInt((w as HTMLElement).dataset.bi ?? "", 10);
      const img = w.querySelector("img");
      if (!img) return;
      const isSel = selectedImageBlockIndex === bi;
      img.style.border = isSel ? "1px solid #6b8cae" : "1px solid #e5e5e5";
    });
  }, [selectedImageBlockIndex, blocks]);

  useLayoutEffect(() => {
    const idx = selectedImageBlockIndex;
    if (idx === null) {
      setToolbarRect(null);
      return;
    }
    const ed = editorRef.current;
    const wrap = ed?.querySelector(`[data-bi="${idx}"].cp-img-wrap`) as HTMLElement | null;
    if (!wrap) {
      setToolbarRect(null);
      return;
    }
    setToolbarRect(wrap.getBoundingClientRect());
  }, [selectedImageBlockIndex, blocks]);

  useEffect(() => {
    function onScrollOrResize() {
      const idx = selectedImageBlockIndexRef.current;
      if (idx === null) return;
      const ed = editorRef.current;
      const wrap = ed?.querySelector(`[data-bi="${idx}"].cp-img-wrap`) as HTMLElement | null;
      if (wrap) setToolbarRect(wrap.getBoundingClientRect());
    }
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, []);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      const root = bodySurfaceRef.current?.parentElement;
      if (!root?.contains(e.target as Node)) {
        setSelectedImageBlockIndex(null);
        setToolbarRect(null);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    function onVV() {
      const ed = editorRef.current;
      if (ed && document.activeElement === ed) {
        scrollCaretOrSelectionIntoViewIfNeeded(ed);
      }
    }
    vv.addEventListener("resize", onVV);
    return () => vv.removeEventListener("resize", onVV);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const idx = selectedImageBlockIndexRef.current;
      if (idx === null || disabled) return;
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        setBlocks((prev) => {
          if (prev[idx]?.type !== "image") return prev;
          const hit = prev[idx] as ImageBlock;
          if (hit.previewUrl) URL.revokeObjectURL(hit.previewUrl);
          const next = deleteImageBlock(prev, idx);
          queueMicrotask(() => {
            const ed = editorRef.current;
            if (ed) renderEditorFromBlocks(ed, next);
          });
          return next;
        });
        setSelectedImageBlockIndex(null);
        setToolbarRect(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [disabled]);

  function syncCaretRef() {
    const ed = editorRef.current;
    if (!ed) return;
    const c = getCaretInEditor(ed, blocksRef.current);
    if (c) lastCaretRef.current = c;
  }

  function syncCaretRefAndMaybeScroll() {
    syncCaretRef();
    const ed = editorRef.current;
    if (ed) scrollCaretOrSelectionIntoViewIfNeeded(ed);
  }

  function updateTextFromDom() {
    const ed = editorRef.current;
    if (!ed) return;
    const next = ensureTrailingTextBlock(parseDomToBlocks(ed));
    const c = getCaretInEditor(ed, next);
    if (c) lastCaretRef.current = c;
    setBlocks(next);
  }

  function updateImageLevel(i: number, delta: number) {
    setBlocks((prev) => {
      const next = [...prev];
      const b = next[i];
      if (b?.type !== "image") return prev;
      const nl = clampCommunityPostSizeLevel(b.sizeLevel + delta);
      if (nl === b.sizeLevel) return prev;
      next[i] = { ...b, sizeLevel: nl };
      queueMicrotask(() => {
        const ed = editorRef.current;
        if (!ed) return;
        renderEditorFromBlocks(ed, next);
        syncCaretRef();
      });
      return next;
    });
  }

  function removeImageAt(i: number) {
    setBlocks((prev) => {
      const cur = prev[i];
      if (cur?.type === "image" && cur.previewUrl) URL.revokeObjectURL(cur.previewUrl);
      const next = deleteImageBlock(prev, i);
      queueMicrotask(() => {
        const ed = editorRef.current;
        if (!ed) return;
        renderEditorFromBlocks(ed, next);
        syncCaretRef();
      });
      return next;
    });
    setSelectedImageBlockIndex(null);
    setToolbarRect(null);
  }

  function openFileDialogOnly() {
    if (disabled) return;
    syncCaretRef();
    fileRef.current?.click();
  }

  useImperativeHandle(
    ref,
    () => ({
      openImageAttach: () => {
        if (disabled) return;
        syncCaretRef();
        fileRef.current?.click();
      },
    }),
    [disabled]
  );

  async function handleFilePick(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files;
    const fileArray = picked ? Array.from(picked) : [];
    event.target.value = "";
    if (!fileArray.length || disabled) return;
    if (imagePickBusyRef.current) return;
    const ed0 = editorRef.current;
    if (!ed0) return;

    // DOM → 로컬 working만 갱신(저장과 분리). 초기 setBlocks 생략으로 업로드 중에도 입력 반응 유지
    let working = ensureTrailingTextBlock(parseDomToBlocks(ed0));
    const caretNow = getCaretInEditor(ed0, working);
    if (caretNow) {
      lastCaretRef.current = { blockIndex: caretNow.blockIndex, start: caretNow.start, end: caretNow.end };
    }
    let insertAtBlock = lastCaretRef.current.blockIndex;
    let sel = { start: lastCaretRef.current.start, end: lastCaretRef.current.end };

    if (countImages(working) >= MAX_COMMUNITY_POST_IMAGE_COUNT) {
      setError("이미지는 최대 " + MAX_COMMUNITY_POST_IMAGE_COUNT + "장까지입니다.");
      return;
    }

    imagePickBusyRef.current = true;
    setError("");
    setSelectedImageBlockIndex(null);
    setToolbarRect(null);

    try {
      for (const file of fileArray) {
        if (countImages(working) >= MAX_COMMUNITY_POST_IMAGE_COUNT) break;

        if (insertAtBlock < 0 || insertAtBlock >= working.length || working[insertAtBlock].type !== "text") {
          let tidx = working.findIndex((b) => b.type === "text");
          if (tidx < 0) {
            working = [...working, { type: "text", value: "" }];
            tidx = working.length - 1;
          }
          insertAtBlock = tidx;
          const tb0 = working[tidx] as TextBlock;
          sel = { start: tb0.value.length, end: tb0.value.length };
        }
        const tb = working[insertAtBlock] as TextBlock;
        let before = tb.value.slice(0, sel.start);
        const after = tb.value.slice(sel.end);
        if (before.length > 0 && !before.endsWith("\n")) {
          before = `${before}\n`;
        }

        const previewUrl = URL.createObjectURL(file);
        const pendingBlock: ImageBlock = {
          type: "image",
          url: "",
          sizeLevel: COMMUNITY_POST_DEFAULT_SIZE_LEVEL,
          previewUrl,
        };

        const prevIsImage = insertAtBlock > 0 && working[insertAtBlock - 1]?.type === "image";
        if (prevIsImage && before === "") {
          const newBlocks: Block[] = [
            ...working.slice(0, insertAtBlock),
            pendingBlock,
            { type: "text", value: after },
            ...working.slice(insertAtBlock + 1),
          ];
          working = ensureTrailingTextBlock(newBlocks);
          const afterTextIndex = insertAtBlock + 1;
          lastCaretRef.current = { blockIndex: afterTextIndex, start: 0, end: 0 };
          insertAtBlock = afterTextIndex;
          sel = { start: 0, end: 0 };
        } else {
          const newBlocks: Block[] = [
            ...working.slice(0, insertAtBlock),
            { type: "text", value: before },
            pendingBlock,
            { type: "text", value: after },
            ...working.slice(insertAtBlock + 1),
          ];
          working = ensureTrailingTextBlock(newBlocks);
          const afterTextIndex = insertAtBlock + 2;
          lastCaretRef.current = { blockIndex: afterTextIndex, start: 0, end: 0 };
          insertAtBlock = afterTextIndex;
          sel = { start: 0, end: 0 };
        }

        setBlocks(working);
        queueMicrotask(() => {
          const ed = editorRef.current;
          if (!ed) return;
          renderEditorFromBlocks(ed, working);
          setCaretInTextBlock(ed, lastCaretRef.current.blockIndex, lastCaretRef.current.start);
          ed.focus();
        });

        setUploading(true);
        const formData = new FormData();
        formData.append("file", file);
        formData.append("sitePublic", "1");
        const response = await fetch("/api/upload/image", { method: "POST", body: formData });
        if (!response.ok) {
          setError("이미지 업로드에 실패했습니다.");
          setUploading(false);
          const revokeUrl = previewUrl;
          setBlocks((prev) => {
            const next = ensureTrailingTextBlock(
              prev.filter((b) => !(b.type === "image" && (b as ImageBlock).previewUrl === revokeUrl))
            );
            working = next;
            URL.revokeObjectURL(revokeUrl);
            queueMicrotask(() => {
              const ed = editorRef.current;
              if (ed) renderEditorFromBlocks(ed, next);
            });
            return next;
          });
          continue;
        }
        const data = (await response.json()) as { w640Url?: string };
        if (typeof data.w640Url !== "string" || !data.w640Url.trim()) {
          setUploading(false);
          const revokeUrl = previewUrl;
          setBlocks((prev) => {
            const next = ensureTrailingTextBlock(
              prev.filter((b) => !(b.type === "image" && (b as ImageBlock).previewUrl === revokeUrl))
            );
            working = next;
            URL.revokeObjectURL(revokeUrl);
            queueMicrotask(() => {
              const ed = editorRef.current;
              if (ed) renderEditorFromBlocks(ed, next);
            });
            return next;
          });
          continue;
        }
        const url = data.w640Url.trim();
        const matchPreview = previewUrl;
        setBlocks((prev) => {
          const next = prev.map((b) => {
            if (b.type === "image" && (b as ImageBlock).previewUrl === matchPreview) {
              URL.revokeObjectURL(matchPreview);
              return { type: "image" as const, url, sizeLevel: b.sizeLevel };
            }
            return b;
          });
          working = next;
          queueMicrotask(() => {
            const ed = editorRef.current;
            if (ed) renderEditorFromBlocks(ed, next);
          });
          return next;
        });
        setUploading(false);
      }
    } catch {
      setError("이미지 업로드에 실패했습니다.");
    } finally {
      setUploading(false);
      imagePickBusyRef.current = false;
    }
  }

  const onEditorMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const t = e.target as HTMLElement;
      const wrap = t.closest?.(".cp-img-wrap") as HTMLElement | null;
      if (wrap) {
        e.preventDefault();
        const bi = parseInt(wrap.dataset.bi ?? "", 10);
        if (!Number.isNaN(bi) && !disabled) {
          setSelectedImageBlockIndex(bi);
          requestAnimationFrame(() => {
            if (typeof window === "undefined" || !window.matchMedia("(pointer: coarse)").matches) return;
            const r = wrap.getBoundingClientRect();
            const vv = window.visualViewport;
            const vh = vv?.height ?? window.innerHeight;
            const top = vv?.offsetTop ?? 0;
            if (r.bottom > top + vh - 12 || r.top < top + 36) {
              wrap.scrollIntoView({ block: "nearest", inline: "nearest" });
            }
          });
        }
        return;
      }
      setSelectedImageBlockIndex(null);
    },
    [disabled]
  );

  const onEditorInput = useCallback(() => {
    if (composingRef.current) return;
    updateTextFromDom();
    const ed = editorRef.current;
    if (ed) scrollCaretOrSelectionIntoViewIfNeeded(ed);
  }, []);

  return (
    <div className="ui-community-post-editor-shell v3-stack">
      <div
        ref={bodySurfaceRef}
        className="ui-community-post-editor-surface"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) {
            setSelectedImageBlockIndex(null);
          }
        }}
      >
        <div
          ref={editorRef}
          className="community-post-body-editor-root ui-community-post-editor-editable"
          contentEditable={!disabled}
          suppressContentEditableWarning
          data-placeholder=""
          onMouseDown={onEditorMouseDown}
          onInput={onEditorInput}
          onTouchEnd={() => {
            requestAnimationFrame(() => syncCaretRefAndMaybeScroll());
          }}
          onKeyDown={(e) => {
            if (disabled) return;
            const ed = editorRef.current;
            if (!ed) return;
            syncCaretRef();

            if (e.key === " ") {
              const selImg = selectedImageBlockIndexRef.current;
              if (selImg !== null) {
                e.preventDefault();
                setSelectedImageBlockIndex(null);
                setToolbarRect(null);
                setBlocks((prev) => {
                  const next = [...prev];
                  const afterIdx = selImg + 1;
                  if (afterIdx < next.length && next[afterIdx]?.type === "text") {
                    const t = next[afterIdx] as TextBlock;
                    const v = t.value;
                    next[afterIdx] = { type: "text", value: v.startsWith(" ") ? v : ` ${v}` };
                  } else {
                    next.splice(afterIdx, 0, { type: "text", value: " " });
                  }
                  const merged = ensureTrailingTextBlock(next);
                  queueMicrotask(() => {
                    const el = editorRef.current;
                    if (!el) return;
                    renderEditorFromBlocks(el, merged);
                    const roots = getOrderedBlockRoots(el);
                    const ri = roots.findIndex((r) => r.classList.contains("cp-text") && r.dataset.bi === String(afterIdx));
                    const blockPos = ri >= 0 ? ri : afterIdx;
                    const tb = merged[afterIdx] as TextBlock | undefined;
                    const off = tb && tb.value.length > 0 ? 1 : 0;
                    lastCaretRef.current = { blockIndex: blockPos, start: off, end: off };
                    setCaretInTextBlock(el, blockPos, off);
                  });
                  return merged;
                });
                return;
              }
            }

            if (e.key === "Backspace") {
              const c = getCaretInEditor(ed, blocksRef.current);
              if (!c) return;
              const ti = c.blockIndex;
              const roots = getOrderedBlockRoots(ed);
              const t = roots[ti] as HTMLElement | undefined;
              if (!t?.classList.contains("cp-text")) return;
              const val = (blocksRef.current[ti] as TextBlock | undefined)?.value ?? "";
              const start = c.start;
              const end = c.end;
              if (start !== end) return;
              if (start === 0 && end === 0) {
                e.preventDefault();
                if (ti === 0) return;
                const prevB = blocksRef.current[ti - 1];
                if (prevB?.type === "text") {
                  const len = prevB.value.length;
                  setBlocks((prev) => {
                    const merged = mergeAdjacentTextBlocks(prev, ti - 1);
                    queueMicrotask(() => {
                      const el = editorRef.current;
                      if (!el) return;
                      renderEditorFromBlocks(el, merged);
                      lastCaretRef.current = { blockIndex: ti - 1, start: len, end: len };
                      setCaretInTextBlock(el, ti - 1, len);
                    });
                    return merged;
                  });
                  return;
                }
                if (prevB?.type === "image") {
                  const imgIdx = ti - 1;
                  setBlocks((prev) => {
                    const tBefore = prev[imgIdx - 1];
                    const tAfter = prev[ti];
                    const merged = deleteImageBlock(prev, imgIdx);
                    queueMicrotask(() => {
                      const el = editorRef.current;
                      if (!el) return;
                      renderEditorFromBlocks(el, merged);
                    let focusIdx = 0;
                    let cursor = 0;
                    if (tBefore?.type === "text" && tAfter?.type === "text") {
                      focusIdx = imgIdx - 1;
                      cursor = tBefore.value.length;
                    } else if (tAfter?.type === "text") {
                      focusIdx = merged.findIndex((bl) => bl.type === "text");
                      if (focusIdx < 0) focusIdx = 0;
                      cursor = 0;
                    } else {
                      const fi = merged.findIndex((bl) => bl.type === "text");
                      focusIdx = fi >= 0 ? fi : 0;
                      const tb = merged[focusIdx] as TextBlock | undefined;
                      cursor = tb?.value.length ?? 0;
                    }
                    lastCaretRef.current = { blockIndex: focusIdx, start: cursor, end: cursor };
                    setCaretInTextBlock(el, focusIdx, cursor);
                    });
                    return merged;
                  });
                  return;
                }
                return;
              }
              if (start === 0 && val === "" && ti > 0 && blocksRef.current[ti - 1]?.type === "image") {
                e.preventDefault();
                const imgIdx = ti - 1;
                setBlocks((prev) => {
                  const tBefore = prev[imgIdx - 1];
                  const tAfter = prev[ti];
                  const merged = deleteImageBlock(prev, imgIdx);
                  queueMicrotask(() => {
                    const el = editorRef.current;
                    if (!el) return;
                    renderEditorFromBlocks(el, merged);
                  let focusIdx = 0;
                  let cursor = 0;
                  if (tBefore?.type === "text" && tAfter?.type === "text") {
                    focusIdx = imgIdx - 1;
                    cursor = tBefore.value.length;
                  } else if (tAfter?.type === "text") {
                    focusIdx = merged.findIndex((bl) => bl.type === "text");
                    if (focusIdx < 0) focusIdx = 0;
                    cursor = 0;
                  } else {
                    const fi = merged.findIndex((bl) => bl.type === "text");
                    focusIdx = fi >= 0 ? fi : 0;
                    const tb = merged[focusIdx] as TextBlock | undefined;
                    cursor = tb?.value.length ?? 0;
                  }
                  lastCaretRef.current = { blockIndex: focusIdx, start: cursor, end: cursor };
                  setCaretInTextBlock(el, focusIdx, cursor);
                  });
                  return merged;
                });
                return;
              }
              return;
            }

            if (e.key === "Delete") {
              const c = getCaretInEditor(ed, blocksRef.current);
              if (!c) return;
              const ti = c.blockIndex;
              const roots = getOrderedBlockRoots(ed);
              const t = roots[ti] as HTMLElement | undefined;
              if (!t?.classList.contains("cp-text")) return;
              const val = (blocksRef.current[ti] as TextBlock | undefined)?.value ?? "";
              const start = c.start;
              const end = c.end;
              if (start !== end) return;
              if (start === end && start === val.length) {
                e.preventDefault();
                if (ti + 1 >= blocksRef.current.length) return;
                const nextB = blocksRef.current[ti + 1];
                if (nextB?.type === "text") {
                  const len = (blocksRef.current[ti] as TextBlock).value.length;
                  setBlocks((prev) => {
                    const merged = mergeAdjacentTextBlocks(prev, ti);
                    queueMicrotask(() => {
                      const el = editorRef.current;
                      if (!el) return;
                      renderEditorFromBlocks(el, merged);
                      lastCaretRef.current = { blockIndex: ti, start: len, end: len };
                      setCaretInTextBlock(el, ti, len);
                    });
                    return merged;
                  });
                  return;
                }
                if (nextB?.type === "image") {
                  const imgIdx = ti + 1;
                  setBlocks((prev) => {
                    const tBefore = prev[ti];
                    const tAfter = prev[imgIdx + 1];
                    const merged = deleteImageBlock(prev, imgIdx);
                    queueMicrotask(() => {
                      const el = editorRef.current;
                      if (!el) return;
                      renderEditorFromBlocks(el, merged);
                    let focusIdx = 0;
                    let cursor = 0;
                    if (tBefore?.type === "text" && tAfter?.type === "text") {
                      focusIdx = ti;
                      cursor = tBefore.value.length;
                    } else if (tAfter?.type === "text") {
                      focusIdx = merged.findIndex((bl) => bl.type === "text");
                      if (focusIdx < 0) focusIdx = 0;
                      cursor = 0;
                    } else {
                      const fi = merged.findIndex((bl) => bl.type === "text");
                      focusIdx = fi >= 0 ? fi : 0;
                      const tb = merged[focusIdx] as TextBlock | undefined;
                      cursor = tb?.value.length ?? 0;
                    }
                    lastCaretRef.current = { blockIndex: focusIdx, start: cursor, end: cursor };
                    setCaretInTextBlock(el, focusIdx, cursor);
                    });
                    return merged;
                  });
                  return;
                }
              }
              return;
            }

            if (e.key === "ArrowLeft" && !e.shiftKey) {
              const c = getCaretInEditor(ed, blocksRef.current);
              if (!c || c.start !== 0 || c.end !== 0) return;
              const prev = blocksRef.current;
              const pIdx = findPrevTextBlockIndex(prev, c.blockIndex);
              if (pIdx === null) return;
              e.preventDefault();
              const plen = (prev[pIdx] as TextBlock).value.length;
              lastCaretRef.current = { blockIndex: pIdx, start: plen, end: plen };
              setCaretInTextBlock(ed, pIdx, plen);
              return;
            }

            if (e.key === "ArrowRight" && !e.shiftKey) {
              const c = getCaretInEditor(ed, blocksRef.current);
              if (!c) return;
              const val = (blocksRef.current[c.blockIndex] as TextBlock | undefined)?.value ?? "";
              if (c.start !== c.end || c.start !== val.length) return;
              const prev = blocksRef.current;
              const nIdx = findNextTextBlockIndex(prev, c.blockIndex);
              if (nIdx === null) return;
              e.preventDefault();
              lastCaretRef.current = { blockIndex: nIdx, start: 0, end: 0 };
              setCaretInTextBlock(ed, nIdx, 0);
              return;
            }

            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              const c = getCaretInEditor(ed, blocksRef.current);
              if (!c) {
                setBlocks((prev) => {
                  const next = [...prev];
                  let textIdx = -1;
                  for (let j = next.length - 1; j >= 0; j--) {
                    if (next[j]?.type === "text") {
                      textIdx = j;
                      break;
                    }
                  }
                  if (textIdx < 0) {
                    next.push({ type: "text", value: "\n" });
                    textIdx = next.length - 1;
                  } else {
                    const tbb = next[textIdx] as TextBlock;
                    next[textIdx] = { type: "text", value: `${tbb.value}\n` };
                  }
                  const merged = ensureTrailingTextBlock(next);
                  const fi = textIdx;
                  const len = (merged[fi] as TextBlock).value.length;
                  queueMicrotask(() => {
                    const el = editorRef.current;
                    if (!el) return;
                    renderEditorFromBlocks(el, merged);
                    lastCaretRef.current = { blockIndex: fi, start: len, end: len };
                    setCaretInTextBlock(el, fi, len);
                  });
                  return merged;
                });
                return;
              }
              const ti = c.blockIndex;
              const cur = blocksRef.current;
              const prevIsImage = ti > 0 && cur[ti - 1]?.type === "image";
              const nextIsImage = ti + 1 < cur.length && cur[ti + 1]?.type === "image";
              if (prevIsImage || nextIsImage) {
                const roots = getOrderedBlockRoots(ed);
                const t = roots[ti] as HTMLElement | undefined;
                if (!t?.classList.contains("cp-text")) return;
                const val = (cur[ti] as TextBlock).value;
                const pos = c.start;
                const newVal = val.slice(0, pos) + "\n" + val.slice(c.end);
                setBlocks((prev) => {
                  const next = [...prev];
                  const b = next[ti];
                  if (b?.type !== "text") return prev;
                  next[ti] = { type: "text", value: newVal };
                  const np = pos + 1;
                  queueMicrotask(() => {
                    const el = editorRef.current;
                    if (!el) return;
                    renderEditorFromBlocks(el, next);
                    lastCaretRef.current = { blockIndex: ti, start: np, end: np };
                    setCaretInTextBlock(el, ti, np);
                  });
                  return next;
                });
                return;
              }
              const cursor = c.start;
              setBlocks((prev) => {
                const merged = splitTextBlock(prev, ti, cursor);
                queueMicrotask(() => {
                  const el = editorRef.current;
                  if (!el) return;
                  renderEditorFromBlocks(el, merged);
                  lastCaretRef.current = { blockIndex: ti + 1, start: 0, end: 0 };
                  setCaretInTextBlock(el, ti + 1, 0);
                });
                return merged;
              });
              return;
            }
          }}
          onKeyUp={() => syncCaretRefAndMaybeScroll()}
          onSelect={() => syncCaretRefAndMaybeScroll()}
          onBlur={() => {
            requestAnimationFrame(() => {
              const ae = document.activeElement;
              if (!ae || !bodySurfaceRef.current?.contains(ae)) {
                syncCaretRef();
              }
            });
          }}
          onPaste={(e) => {
            e.preventDefault();
            const text = e.clipboardData.getData("text/plain").replace(/\r\n/g, "\n");
            document.execCommand("insertText", false, text);
          }}
          onCompositionStart={() => {
            composingRef.current = true;
          }}
          onCompositionEnd={() => {
            composingRef.current = false;
            updateTextFromDom();
            const ed = editorRef.current;
            if (ed) scrollCaretOrSelectionIntoViewIfNeeded(ed);
          }}
        />

        {toolbarRect !== null && selectedImageBlockIndex !== null && blocks[selectedImageBlockIndex]?.type === "image" ? (
          <div
            role="toolbar"
            aria-label="이미지 편집"
            className="ui-community-image-toolbar"
            onMouseDown={(e) => e.preventDefault()}
            style={{
              position: "fixed",
              left: toolbarRect.left + toolbarRect.width / 2,
              top: toolbarRect.top - 8,
              transform: "translate(-50%, -100%)",
              zIndex: 30,
            }}
          >
            <button
              type="button"
              className="ui-community-image-toolbar-btn"
              disabled={disabled || (blocks[selectedImageBlockIndex] as ImageBlock).sizeLevel >= COMMUNITY_POST_SIZE_LEVEL_MAX}
              onClick={() => updateImageLevel(selectedImageBlockIndex, 1)}
              style={{
                width: coarsePointer ? 44 : 32,
                height: coarsePointer ? 44 : 28,
              }}
            >
              +
            </button>
            <button
              type="button"
              className="ui-community-image-toolbar-btn"
              disabled={disabled || (blocks[selectedImageBlockIndex] as ImageBlock).sizeLevel <= COMMUNITY_POST_SIZE_LEVEL_MIN}
              onClick={() => updateImageLevel(selectedImageBlockIndex, -1)}
              style={{
                width: coarsePointer ? 44 : 32,
                height: coarsePointer ? 44 : 28,
              }}
            >
              −
            </button>
            <button
              type="button"
              className="ui-community-image-toolbar-remove"
              disabled={disabled}
              onClick={() => removeImageAt(selectedImageBlockIndex)}
              style={{
                minHeight: coarsePointer ? 44 : 28,
                padding: coarsePointer ? "0 12px" : "0 8px",
              }}
            >
              삭제
            </button>
          </div>
        ) : null}
      </div>
      {remaining <= 0 ? <p className="v3-muted" style={{ margin: 0, fontSize: "0.85rem" }}>이미지 한도에 도달했습니다.</p> : null}
      {error ? <p className="v3-muted" style={{ margin: 0, fontSize: "0.85rem" }}>{error}</p> : null}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        tabIndex={-1}
        aria-hidden
        onChange={handleFilePick}
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          whiteSpace: "nowrap",
          border: 0,
          opacity: 0,
          pointerEvents: "none",
        }}
      />
    </div>
  );
});

export default CommunityPostBodyEditor;
