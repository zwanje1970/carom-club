"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { TextStyle, Color, FontSize, FontFamily, BackgroundColor } from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import Image from "@tiptap/extension-image";
import { ResizableNodeView } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import { CellSelection } from "@tiptap/pm/tables";
import { TableRow } from "@tiptap/extension-table";
import {
  TableWithStyle,
  TableViewWithAlign,
  TableCellWithStyle,
  TableHeaderWithStyle,
  buildTableStyle,
  buildCellStyle,
  parseTableStyle,
} from "@/lib/table-style-extension";
import { BubbleMenu } from "@tiptap/react/menus";
import { ColorPalette64, type ColorApplyMode } from "@/components/editor/ColorPalette64";
import { SpecialCharsPicker } from "@/components/editor/SpecialCharsPicker";

/** 선 모양 아이콘 (실선/대시/점선/이중선/없음) */
function LineStyleIcon({ type, className }: { type: string; className?: string }) {
  const c = className ?? "stroke-current";
  const w = 20;
  const h = 8;
  const y = h / 2;
  if (type === "solid") {
    return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" strokeWidth="1.5" strokeLinecap="round" className={c}><line x1={0} y1={y} x2={w} y2={y} /></svg>;
  }
  if (type === "dashed") {
    return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 2" className={c}><line x1={0} y1={y} x2={w} y2={y} /></svg>;
  }
  if (type === "dotted") {
    return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" strokeWidth="2" strokeLinecap="round" strokeDasharray="1 2" className={c}><line x1={0} y1={y} x2={w} y2={y} /></svg>;
  }
  if (type === "double") {
    return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" strokeWidth="1" strokeLinecap="round" className={c}><line x1={0} y1={y - 1.2} x2={w} y2={y - 1.2} /><line x1={0} y1={y + 1.2} x2={w} y2={y + 1.2} /></svg>;
  }
  if (type === "none") {
    return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" strokeWidth="1" className={c}><line x1={0} y1={y} x2={w} y2={y} strokeDasharray="0" opacity={0.3} /><line x1={2} y1={2} x2={w - 2} y2={h - 2} strokeWidth={0.8} /></svg>;
  }
  return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" strokeWidth="1.5" className={c}><line x1={0} y1={y} x2={w} y2={y} strokeDasharray="2 1" /></svg>;
}

const BORDER_STYLE_OPTIONS = [
  { value: "", title: "기본", type: "default" },
  { value: "solid", title: "실선", type: "solid" },
  { value: "dashed", title: "대시", type: "dashed" },
  { value: "dotted", title: "점선", type: "dotted" },
  { value: "double", title: "이중선", type: "double" },
  { value: "none", title: "없음", type: "none" },
];

function LineStylePicker({
  value,
  onChange,
  size = "default",
}: { value: string; onChange: (v: string | null) => void; size?: "default" | "small" }) {
  const btnClass = size === "small" ? "p-1 rounded border" : "p-1.5 rounded border";
  return (
    <div className="flex items-center gap-0.5">
      {BORDER_STYLE_OPTIONS.map((opt) => {
        const isSelected = (value || "") === (opt.value || "");
        return (
          <button
            key={opt.value || "default"}
            type="button"
            title={opt.title}
            className={`${btnClass} transition-colors ${isSelected ? "border-site-primary bg-site-primary/10" : "border-gray-300 bg-white hover:bg-gray-100"}`}
            onClick={() => onChange(opt.value || null)}
          >
            <LineStyleIcon type={opt.type} />
          </button>
        );
      })}
    </div>
  );
}

export type RichEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
};

import { FONT_FAMILIES, FONT_SIZES_PX } from "@/lib/editor-fonts";

function useImageUpload() {
  return useCallback(async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/admin/upload-image", { method: "POST", body: formData });
    const text = await res.text();
    let errorMessage = "업로드 실패";
    try {
      const d = text ? JSON.parse(text) : {};
      errorMessage = d.error || errorMessage;
    } catch {
      if (!res.ok && text) errorMessage = text.slice(0, 100);
    }
    if (!res.ok) throw new Error(errorMessage);
    const d = JSON.parse(text) as { url?: string };
    if (!d?.url) throw new Error("업로드 결과가 올바르지 않습니다.");
    return d.url;
  }, []);
}

export function RichEditor({
  value,
  onChange,
  placeholder = "내용을 입력하세요",
  className = "",
  minHeight = "200px",
}: RichEditorProps) {
  const uploadImage = useImageUpload();
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    immediatelyRender: false,
    content: value || "",
    extensions: [
      StarterKit.configure({ heading: false }),
      Placeholder.configure({ placeholder }),
      Underline,
      TextStyle,
      Color.configure({ types: ["textStyle"] }),
      TextAlign.configure({ types: ["paragraph"] }),
      Image.extend({
        addAttributes() {
          const parent = this.parent?.();
          const parentAttrs =
            parent && typeof (parent as { addAttributes?: () => Record<string, unknown> }).addAttributes === "function"
              ? (parent as { addAttributes: () => Record<string, unknown> }).addAttributes()
              : {};
          return {
            ...parentAttrs,
            align: {
              default: null,
              parseHTML: (el) => (el as HTMLElement).getAttribute("data-align") || (el as HTMLImageElement).getAttribute?.("align") || null,
              renderHTML: (attrs) => (attrs.align ? { "data-align": attrs.align } : {}),
            },
          };
        },
        addNodeView() {
          // eslint-disable-next-line @typescript-eslint/no-this-alias -- extension instance needed in closure
          const ext = this;
          const resizeOpts = ext.options?.resize;
          if (!resizeOpts || !resizeOpts.enabled || typeof document === "undefined") return null;
          const { directions, minWidth, minHeight, alwaysPreserveAspectRatio } = resizeOpts;
          return ({ node, getPos, HTMLAttributes, editor }) => {
            const el = document.createElement("img");
            Object.entries(HTMLAttributes).forEach(([key, value]) => {
              if (value != null && key !== "width" && key !== "height") el.setAttribute(key, value as string);
            });
            if (node.attrs.align) el.setAttribute("data-align", node.attrs.align);
            el.src = HTMLAttributes.src as string;
            const nodeView = new ResizableNodeView({
              element: el,
              editor,
              node,
              getPos,
              onResize: (width, height) => {
                el.style.width = `${width}px`;
                el.style.height = `${height}px`;
              },
              onCommit: (width, height) => {
                const pos = getPos();
                if (pos !== undefined) editor.chain().setNodeSelection(pos).updateAttributes(ext.name, { width, height }).run();
              },
              onUpdate: (updatedNode) => {
                if (updatedNode.type !== node.type) return false;
                if (updatedNode.attrs.align) el.setAttribute("data-align", updatedNode.attrs.align);
                else el.removeAttribute("data-align");
                return true;
              },
              options: {
                directions: directions ?? ["bottom-right", "bottom-left", "top-right", "top-left"],
                min: { width: minWidth ?? 50, height: minHeight ?? 50 },
                preserveAspectRatio: alwaysPreserveAspectRatio === true,
              },
            });
            const dom = nodeView.dom as HTMLElement;
            dom.style.visibility = "hidden";
            dom.style.pointerEvents = "none";
            el.onload = () => {
              dom.style.visibility = "";
              dom.style.pointerEvents = "";
            };
            return nodeView;
          };
        },
      }).configure({
        inline: false,
        allowBase64: false,
        resize: {
          enabled: true,
          directions: ["bottom-right", "bottom-left", "top-right", "top-left"],
          minWidth: 50,
          minHeight: 50,
          alwaysPreserveAspectRatio: true,
        },
      }),
      TableWithStyle.configure({ resizable: true, allowTableNodeSelection: true, View: TableViewWithAlign }),
      TableRow,
      TableHeaderWithStyle,
      TableCellWithStyle,
      FontSize,
      FontFamily,
      BackgroundColor.configure({ types: ["textStyle"] }),
    ],
    onUpdate: ({ editor }) => {
      onChangeRef.current(editor.getHTML());
    },
    editorProps: {
      handleDrop: (view, event) => {
        const files = event.dataTransfer?.files;
        if (!files?.length) return false;
        const file = files[0];
        if (!file.type.startsWith("image/")) return false;
        event.preventDefault();
        uploadImage(file).then(
          (url) => editor?.commands.setImage({ src: url }),
          (err) => console.error(err)
        );
        return true;
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;
        for (const item of items) {
          if (item.type.startsWith("image/")) {
            const file = item.getAsFile();
            if (file) {
              event.preventDefault();
              uploadImage(file).then(
                (url) => editor?.commands.setImage({ src: url }),
                (err) => console.error(err)
              );
              return true;
            }
          }
        }
        return false;
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = value || "";
    if (editor.getHTML() !== current) {
      editor.commands.setContent(current, { emitUpdate: false });
    }
  }, [value, editor]);

  const setContentFromOutside = useRef(false);
  useEffect(() => {
    if (!editor || setContentFromOutside.current) return;
    const next = value || "";
    if (next && editor.getHTML() === "<p></p>" && !editor.isDestroyed) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only sync when editor mounts with empty content
  }, [editor]);

  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [tableBgPickerOpen, setTableBgPickerOpen] = useState(false);
  const [tableBorderPickerOpen, setTableBorderPickerOpen] = useState(false);
  const tableMenuRef = useRef<HTMLDivElement>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteMode, setPaletteMode] = useState<ColorApplyMode>("text");
  const paletteRef = useRef<HTMLDivElement>(null);
  const [specialCharsOpen, setSpecialCharsOpen] = useState(false);
  const specialCharsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!paletteOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (paletteRef.current && !paletteRef.current.contains(e.target as Node)) {
        setPaletteOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [paletteOpen]);

  useEffect(() => {
    if (!specialCharsOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (specialCharsRef.current && !specialCharsRef.current.contains(e.target as Node)) {
        setSpecialCharsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [specialCharsOpen]);

  const insertTable = useCallback(() => {
    editor?.chain().focus().insertTable({ rows: tableRows, cols: tableCols, withHeaderRow: true }).run();
  }, [editor, tableRows, tableCols]);

  useEffect(() => {
    if (!tableBgPickerOpen && !tableBorderPickerOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (tableMenuRef.current && !tableMenuRef.current.contains(e.target as Node)) {
        setTableBgPickerOpen(false);
        setTableBorderPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [tableBgPickerOpen, tableBorderPickerOpen]);

  const addImage = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) uploadImage(file).then((url) => editor?.commands.setImage({ src: url }));
    };
    input.click();
  }, [editor, uploadImage]);

  if (!editor) {
    return (
      <div className={`min-h-[200px] border border-site-border rounded-lg bg-gray-50 flex items-center justify-center text-gray-500 ${className}`}>
        에디터 로딩 중...
      </div>
    );
  }

  const ToolbarButton = ({
    onClick,
    active,
    title,
    children,
  }: {
    onClick: () => void;
    active?: boolean;
    title: string;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded border border-transparent hover:bg-gray-200 hover:border-gray-300 ${active ? "bg-site-primary/10 border-site-primary/30" : ""}`}
    >
      {children}
    </button>
  );

  return (
    <div className={`rich-editor-tiptap ${className}`}>
      <style dangerouslySetInnerHTML={{ __html: `
        .rich-editor-tiptap .ProseMirror { min-height: ${minHeight}; padding: 12px; outline: none; font-family: inherit; }
        .rich-editor-tiptap .ProseMirror p.is-editor-empty:first-child::before { content: attr(data-placeholder); color: #9ca3af; float: left; }
        .rich-editor-tiptap .ProseMirror table { border-collapse: collapse; width: 100%; table-layout: fixed; position: relative; }
        .rich-editor-tiptap .ProseMirror td, .rich-editor-tiptap .ProseMirror th { border: var(--table-bw, 1px) var(--table-bs, solid) var(--table-bc, #e5e7eb); padding: 8px; position: relative; min-width: 2em; }
        .rich-editor-tiptap .ProseMirror th { background: #f3f4f6; }
        .rich-editor-tiptap .ProseMirror .column-resize-handle { position: absolute; right: -2px; top: 0; bottom: 0; width: 4px; background: var(--site-primary); cursor: col-resize; }
        .rich-editor-tiptap .ProseMirror img { max-width: 100%; height: auto; display: block; cursor: move; }
        .rich-editor-tiptap .ProseMirror img[data-align="center"],
        .rich-editor-tiptap .ProseMirror img[align="center"] { margin-left: auto; margin-right: auto; }
        .rich-editor-tiptap .ProseMirror img[data-align="right"],
        .rich-editor-tiptap .ProseMirror img[align="right"] { margin-left: auto; margin-right: 0; }
        .rich-editor-tiptap .ProseMirror img[data-align="left"],
        .rich-editor-tiptap .ProseMirror img[align="left"] { margin-left: 0; margin-right: auto; }
        .rich-editor-tiptap [data-resize-container] { display: inline-flex; overflow: visible; }
        .rich-editor-tiptap [data-resize-wrapper] { position: relative; display: inline-block; overflow: visible; }
        .rich-editor-tiptap [data-resize-handle] { z-index: 30; position: absolute; box-sizing: border-box; }
        .rich-editor-tiptap [data-resize-handle="top-left"] { top: 0; left: 0; width: 16px; height: 16px; cursor: nwse-resize; border: 2px solid var(--site-primary); background: rgba(255,255,255,0.8); border-radius: 0 0 4px 0; }
        .rich-editor-tiptap [data-resize-handle="top-right"] { top: 0; right: 0; width: 16px; height: 16px; cursor: nesw-resize; border: 2px solid var(--site-primary); background: rgba(255,255,255,0.8); border-radius: 0 0 0 4px; }
        .rich-editor-tiptap [data-resize-handle="bottom-left"] { bottom: 0; left: 0; width: 16px; height: 16px; cursor: nesw-resize; border: 2px solid var(--site-primary); background: rgba(255,255,255,0.8); border-radius: 0 4px 0 0; }
        .rich-editor-tiptap [data-resize-handle="bottom-right"] { bottom: 0; right: 0; width: 16px; height: 16px; cursor: nwse-resize; border: 2px solid var(--site-primary); background: rgba(255,255,255,0.8); border-radius: 4px 0 0 0; }
        .rich-editor-tiptap [data-resize-handle]:hover { background: rgba(217, 119, 6, 0.25); }
        .rich-editor-tiptap [data-resize-container].ProseMirror-selectednode { outline: none; }
        .rich-editor-tiptap [data-resize-container].ProseMirror-selectednode img { box-shadow: 0 0 0 2px var(--site-primary); }
        .rich-editor-tiptap .tableWrapper { display: block; overflow: auto; resize: horizontal; min-width: 200px; max-width: 100%; cursor: default; }
        .rich-editor-tiptap .tableWrapper table { width: 100% !important; box-sizing: border-box; }
        /* 표 안 셀 지정(선택) 시 시각적 표시 */
        .rich-editor-tiptap .ProseMirror .selectedCell:after {
          z-index: 2;
          position: absolute;
          content: '';
          left: 0;
          right: 0;
          top: 0;
          bottom: 0;
          background: rgba(217, 119, 6, 0.2);
          pointer-events: none;
        }
        .rich-editor-tiptap .ProseMirror-focused { outline: none; }
        .rich-editor-tiptap .ProseMirror-selectednode { outline: 2px solid #d97706; outline-offset: 2px; }
      ` }} />

      <div className="flex flex-wrap items-center gap-1 p-2 border border-site-border border-b-0 rounded-t-lg bg-gray-50">
        {/* 서식 그룹 */}
        <div className="flex items-center gap-0.5">
          <select
            className="text-sm border border-site-border rounded px-1.5 py-1 bg-white"
            value={editor.getAttributes("textStyle").fontFamily || ""}
            onChange={(e) => {
              const v = e.target.value;
              editor.chain().focus().setFontFamily(v || "").run();
            }}
          >
            <option value="">글꼴</option>
            {FONT_FAMILIES.map((f) => (
              <option key={f.value || "default"} value={f.value}>{f.label}</option>
            ))}
          </select>
          <select
            className="text-sm border border-site-border rounded px-1.5 py-1 bg-white"
            value={editor.getAttributes("textStyle").fontSize || ""}
            onChange={(e) => {
              const v = e.target.value;
              if (v) editor.chain().focus().setFontSize(v).run();
            }}
          >
            <option value="">글자 크기</option>
            {FONT_SIZES_PX.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <div className="relative" ref={paletteRef}>
            <button
              type="button"
              onClick={() => setPaletteOpen((o) => !o)}
              title="색상 (글자/배경)"
              className={`flex items-center gap-1 p-1.5 rounded border ${paletteOpen ? "bg-site-primary/10 border-site-primary/30" : "border-transparent hover:bg-gray-200 hover:border-gray-300"}`}
            >
              <span
                className="inline-block leading-none"
                style={
                  paletteOpen && paletteMode === "background"
                    ? {
                        backgroundColor:
                          editor.getAttributes("textStyle").backgroundColor ?? "#374151",
                        color:
                          editor.getAttributes("textStyle").backgroundColor ?? "#374151",
                      }
                    : {
                        color:
                          editor.getAttributes("textStyle").color ?? "#374151",
                      }
                }
              >
                ■
              </span>
              <span>색상</span>
            </button>
            {paletteOpen && (
              <div className="absolute top-full left-0 z-50 mt-1 min-w-[220px] rounded-lg border border-site-border bg-white p-3 shadow-lg">
                <div className="mb-2 flex gap-1">
                  <button
                    type="button"
                    onClick={() => setPaletteMode("text")}
                    className={`rounded px-2 py-1 text-xs ${paletteMode === "text" ? "bg-site-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                  >
                    글자 색
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaletteMode("background")}
                    className={`rounded px-2 py-1 text-xs ${paletteMode === "background" ? "bg-site-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                  >
                    배경 색
                  </button>
                </div>
                <ColorPalette64
                  applyMode={paletteMode}
                  selectedHex={
                    paletteMode === "text"
                      ? editor.getAttributes("textStyle").color
                      : editor.getAttributes("textStyle").backgroundColor
                  }
                  onSelect={(hex) => {
                    if (paletteMode === "text") {
                      editor.chain().focus().setColor(hex).run();
                    } else {
                      editor.chain().focus().setBackgroundColor(hex).run();
                    }
                  }}
                  cellSize={22}
                />
              </div>
            )}
          </div>
          <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="굵게">
            <strong>B</strong>
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="기울임">
            <em>I</em>
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="밑줄">
            <u>U</u>
          </ToolbarButton>
        </div>
        <span className="text-gray-400 select-none"> | </span>
        {/* 정렬: 문단 / 표 / 그림 */}
        <div className="flex items-center gap-0.5">
          {editor.isActive("table") ? (() => {
            const sel = editor.state.selection;
            const tableAlign = sel instanceof NodeSelection && sel.node?.type?.name === "table" ? sel.node.attrs.align : editor.getAttributes("table").align;
            return (
            <>
              <ToolbarButton
                onClick={() => {
                  editor.chain().focus().command(({ state, dispatch }) => {
                    const sel = state.selection;
                    let pos: number | null = null;
                    let node = null;
                    if (sel instanceof NodeSelection && sel.node.type.name === "table") {
                      pos = sel.from;
                      node = sel.node;
                    } else {
                      const $from = sel.$from;
                      for (let d = $from.depth; d > 0; d--) {
                        const n = $from.node(d);
                        if (n.type.name === "table") {
                          pos = $from.before(d);
                          node = n;
                          break;
                        }
                      }
                    }
                    if (pos != null && node) {
                      if (dispatch) dispatch(state.tr.setNodeMarkup(pos, null, { ...node.attrs, align: "left" }));
                      return true;
                    }
                    return false;
                  }).run();
                }}
                active={tableAlign === "left"}
                title="표 왼쪽 정렬"
              >
                <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden><path d="M2 3h16M2 6h10M2 9h14M2 12h8" /></svg>
              </ToolbarButton>
              <span className="text-gray-400 select-none">|</span>
              <ToolbarButton
                onClick={() => {
                  editor.chain().focus().command(({ state, dispatch }) => {
                    const sel = state.selection;
                    let pos: number | null = null;
                    let node = null;
                    if (sel instanceof NodeSelection && sel.node.type.name === "table") {
                      pos = sel.from;
                      node = sel.node;
                    } else {
                      const $from = sel.$from;
                      for (let d = $from.depth; d > 0; d--) {
                        const n = $from.node(d);
                        if (n.type.name === "table") {
                          pos = $from.before(d);
                          node = n;
                          break;
                        }
                      }
                    }
                    if (pos != null && node) {
                      if (dispatch) dispatch(state.tr.setNodeMarkup(pos, null, { ...node.attrs, align: "center" }));
                      return true;
                    }
                    return false;
                  }).run();
                }}
                active={tableAlign === "center"}
                title="표 가운데 정렬"
              >
                <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden><path d="M5 3h10M3 6h14M4 9h12M6 12h8" /></svg>
              </ToolbarButton>
              <span className="text-gray-400 select-none">|</span>
              <ToolbarButton
                onClick={() => {
                  editor.chain().focus().command(({ state, dispatch }) => {
                    const sel = state.selection;
                    let pos: number | null = null;
                    let node = null;
                    if (sel instanceof NodeSelection && sel.node.type.name === "table") {
                      pos = sel.from;
                      node = sel.node;
                    } else {
                      const $from = sel.$from;
                      for (let d = $from.depth; d > 0; d--) {
                        const n = $from.node(d);
                        if (n.type.name === "table") {
                          pos = $from.before(d);
                          node = n;
                          break;
                        }
                      }
                    }
                    if (pos != null && node) {
                      if (dispatch) dispatch(state.tr.setNodeMarkup(pos, null, { ...node.attrs, align: "right" }));
                      return true;
                    }
                    return false;
                  }).run();
                }}
                active={tableAlign === "right"}
                title="표 오른쪽 정렬"
              >
                <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden><path d="M2 3h16M8 6h10M4 9h14M10 12h8" /></svg>
              </ToolbarButton>
            </>
            );
          })() : editor.isActive("image") ? (
            <>
              <ToolbarButton onClick={() => editor.chain().focus().updateAttributes("image", { align: "left" }).run()} active={editor.getAttributes("image").align === "left"} title="그림 왼쪽 정렬">
                <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden><path d="M2 3h16M2 6h10M2 9h14M2 12h8" /></svg>
              </ToolbarButton>
              <span className="text-gray-400 select-none">|</span>
              <ToolbarButton onClick={() => editor.chain().focus().updateAttributes("image", { align: "center" }).run()} active={editor.getAttributes("image").align === "center"} title="그림 가운데 정렬">
                <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden><path d="M5 3h10M3 6h14M4 9h12M6 12h8" /></svg>
              </ToolbarButton>
              <span className="text-gray-400 select-none">|</span>
              <ToolbarButton onClick={() => editor.chain().focus().updateAttributes("image", { align: "right" }).run()} active={editor.getAttributes("image").align === "right"} title="그림 오른쪽 정렬">
                <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden><path d="M2 3h16M8 6h10M4 9h14M10 12h8" /></svg>
              </ToolbarButton>
            </>
          ) : (
            <>
              <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} title="왼쪽 정렬">
                <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden><path d="M2 3h16M2 6h10M2 9h14M2 12h8" /></svg>
              </ToolbarButton>
              <span className="text-gray-400 select-none">|</span>
              <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} title="가운데">
                <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden><path d="M5 3h10M3 6h14M4 9h12M6 12h8" /></svg>
              </ToolbarButton>
              <span className="text-gray-400 select-none">|</span>
              <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} title="오른쪽">
                <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden><path d="M2 3h16M8 6h10M4 9h14M10 12h8" /></svg>
              </ToolbarButton>
            </>
          )}
        </div>
        <span className="text-gray-400 select-none"> | </span>
        {/* 목록/링크 */}
        <div className="flex items-center gap-0.5">
          <ToolbarButton
            onClick={() => {
              const url = window.prompt("링크 URL:");
              if (url) editor.chain().focus().setLink({ href: url }).run();
            }}
            active={editor.isActive("link")}
            title="링크"
          >
            링크
          </ToolbarButton>
          <div className="relative" ref={specialCharsRef}>
            <button
              type="button"
              onClick={() => setSpecialCharsOpen((o) => !o)}
              title="특수문자"
              className={`p-1.5 rounded border ${specialCharsOpen ? "bg-site-primary/10 border-site-primary/30" : "border-transparent hover:bg-gray-200 hover:border-gray-300"}`}
            >
              Ω 특수문자
            </button>
            {specialCharsOpen && (
              <div className="absolute left-0 top-full z-50 mt-1 min-w-[280px] rounded-lg border border-site-border bg-white p-3 shadow-lg">
                <SpecialCharsPicker
                  onInsert={(char) => {
                    editor.chain().focus().insertContent(char).run();
                  }}
                />
              </div>
            )}
          </div>
        </div>
        <span className="text-gray-400 select-none"> | </span>
        {/* 표 메뉴: 가로 한 줄 (표 | 줄 수, 칸 수, 배경색, 선 색, 선 굵기, 선 모양) */}
        <div ref={tableMenuRef} className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-700 font-medium">표</span>
          <span className="text-gray-300">|</span>
          <label className="flex items-center gap-1.5 text-sm text-gray-700">
            줄 수
            <input
              type="number"
              min={1}
              max={20}
              value={tableRows}
              onChange={(e) => setTableRows(Number(e.target.value) || 1)}
              className="w-11 border border-gray-300 rounded px-1.5 py-0.5 text-sm bg-white"
            />
          </label>
          <label className="flex items-center gap-1.5 text-sm text-gray-700">
            칸 수
            <input
              type="number"
              min={1}
              max={10}
              value={tableCols}
              onChange={(e) => setTableCols(Number(e.target.value) || 1)}
              className="w-11 border border-gray-300 rounded px-1.5 py-0.5 text-sm bg-white"
            />
          </label>
          <button
            type="button"
            onClick={insertTable}
            className="px-2 py-0.5 text-sm border border-gray-300 rounded bg-white hover:bg-gray-50"
          >
            삽입
          </button>
          <span className="text-gray-300">|</span>
          {(() => {
            const sel = editor.state.selection;
            const isTableNodeSelected = sel instanceof NodeSelection && sel.node?.type?.name === "table";
            const isCellSel = sel instanceof CellSelection;
            const isInCell = isCellSel || editor.isActive("tableCell") || editor.isActive("tableHeader");
            const inTable = isTableNodeSelected || isInCell;
            const isCell = isCellSel || editor.isActive("tableCell");
            const cellAttrs = isCell ? editor.getAttributes("tableCell") : editor.getAttributes("tableHeader");
            const tableAttrs = editor.getAttributes("table");
            const styleSource = inTable ? (isTableNodeSelected ? tableAttrs.style : cellAttrs.style) : null;
            const parsed = parseTableStyle(styleSource);
            const bgColor = parsed.backgroundColor ?? "";
            const lineColor = parsed.borderColor ?? "#e5e7eb";
            const lineWidth = parsed.borderWidth ?? "";
            const lineStyle = parsed.borderStyle ?? "";
            const applyTable = (opts: { backgroundColor?: string | null; borderColor?: string | null; borderStyle?: string | null; borderWidth?: string | null }) => {
              const next = buildTableStyle(tableAttrs.style, opts);
              editor.chain().focus().updateAttributes("table", { style: next || null }).run();
            };
            const applyCell = (opts: { backgroundColor?: string | null; borderColor?: string | null; borderStyle?: string | null; borderWidth?: string | null }) => {
              const next = buildCellStyle(cellAttrs.style, opts);
              editor.chain().focus().setCellAttribute("style", next || null).run();
            };
            const apply = inTable ? (isTableNodeSelected ? applyTable : applyCell) : () => {};
            const BORDER_WIDTHS = [
              { value: "", label: "기본" },
              { value: "0", label: "0" },
              { value: "1px", label: "1px" },
              { value: "2px", label: "2px" },
              { value: "3px", label: "3px" },
            ];
            return (
              <>
                <div className="relative flex items-center gap-1.5">
                  <label className="flex items-center gap-1.5 text-sm text-gray-700">
                    배경색
                    <button
                      type="button"
                      onClick={() => { setTableBorderPickerOpen(false); setTableBgPickerOpen((o) => !o); }}
                      className="w-5 h-5 rounded border border-gray-300 shrink-0"
                      style={{ backgroundColor: bgColor || "transparent" }}
                      title="배경색 선택"
                    />
                  </label>
                  {tableBgPickerOpen && (
                    <div className="absolute left-0 top-full z-50 mt-1 p-2 bg-white border border-gray-200 rounded shadow-lg">
                      <ColorPalette64
                        applyMode="background"
                        selectedHex={bgColor || undefined}
                        onSelect={(hex) => { apply({ backgroundColor: hex }); setTableBgPickerOpen(false); }}
                        cellSize={20}
                      />
                      <button type="button" onClick={() => { apply({ backgroundColor: null }); setTableBgPickerOpen(false); }} className="mt-1 text-xs border rounded px-2 py-0.5">없음</button>
                    </div>
                  )}
                </div>
                <div className="relative flex items-center gap-1.5">
                  <label className="flex items-center gap-1.5 text-sm text-gray-700">
                    선 색
                    <button
                      type="button"
                      onClick={() => { setTableBgPickerOpen(false); setTableBorderPickerOpen((o) => !o); }}
                      className="w-5 h-5 rounded border border-gray-300 shrink-0"
                      style={{ backgroundColor: lineColor }}
                      title="선 색 선택"
                    />
                  </label>
                  {tableBorderPickerOpen && (
                    <div className="absolute left-0 top-full z-50 mt-1 p-2 bg-white border border-gray-200 rounded shadow-lg">
                      <ColorPalette64
                        applyMode="text"
                        selectedHex={lineColor}
                        onSelect={(hex) => { apply({ borderColor: hex }); setTableBorderPickerOpen(false); }}
                        cellSize={20}
                      />
                    </div>
                  )}
                </div>
                <label className="flex items-center gap-1.5 text-sm text-gray-700">
                  선 굵기
                  <select
                    className="border border-gray-300 rounded px-1.5 py-0.5 text-sm bg-white min-w-[4rem]"
                    value={lineWidth}
                    onChange={(e) => apply({ borderWidth: e.target.value || null })}
                  >
                    {BORDER_WIDTHS.map((o) => <option key={o.value || "x"} value={o.value}>{o.label}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-1.5 text-sm text-gray-700">
                  선 모양
                  <LineStylePicker value={lineStyle} onChange={(v) => apply({ borderStyle: v })} size="default" />
                </label>
              </>
            );
          })()}
          {editor.isActive("table") && (
            <>
              <span className="text-gray-300">|</span>
              <ToolbarButton
                onClick={() => {
                  const $from = editor.state.selection.$from;
                  for (let d = $from.depth; d > 0; d--) {
                    const node = $from.node(d);
                    if (node.type.name === "tableCell" || node.type.name === "tableHeader") {
                      editor.chain().focus().setCellSelection({ anchorCell: $from.start(d), headCell: $from.start(d) }).run();
                      return;
                    }
                  }
                }}
                title="현재 셀 지정(드래그로 여러 셀 선택 가능)"
              >
                셀 지정
              </ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().addRowBefore().run()} title="위에 행 추가">+행↑</ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().addRowAfter().run()} title="아래에 행 추가">+행↓</ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().addColumnBefore().run()} title="왼쪽에 열 추가">+열←</ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().addColumnAfter().run()} title="오른쪽에 열 추가">+열→</ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().deleteRow().run()} title="행 삭제">행삭제</ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().deleteColumn().run()} title="열 삭제">열삭제</ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().deleteTable().run()} title="표 삭제">표삭제</ToolbarButton>
            </>
          )}
        </div>
        <span className="text-gray-400 select-none"> | </span>
        {/* 그림삽입 */}
        <div className="flex items-center gap-0.5">
          <button type="button" onClick={addImage} className="p-1.5 rounded border border-transparent hover:bg-gray-200" title="그림 삽입">
            그림삽입
          </button>
        </div>
      </div>

      <div className="border border-site-border rounded-b-lg bg-white">
        <EditorContent editor={editor} />
      </div>

      <BubbleMenu
        editor={editor}
        options={{ placement: "top" }}
        shouldShow={() => false}
        className="flex flex-wrap items-center gap-1 p-2 bg-white border border-site-border rounded-lg shadow-lg max-w-[90vw]"
      >
        {editor.isActive("image") && (
          <>
            <button type="button" onClick={() => editor.chain().focus().updateAttributes("image", { align: "left" }).run()} className={`px-2 py-1 text-sm border rounded hover:bg-gray-100 ${editor.getAttributes("image").align === "left" ? "bg-gray-200" : ""}`} title="왼쪽 정렬">왼쪽</button>
            <button type="button" onClick={() => editor.chain().focus().updateAttributes("image", { align: "center" }).run()} className={`px-2 py-1 text-sm border rounded hover:bg-gray-100 ${editor.getAttributes("image").align === "center" ? "bg-gray-200" : ""}`} title="가운데 정렬">가운데</button>
            <button type="button" onClick={() => editor.chain().focus().updateAttributes("image", { align: "right" }).run()} className={`px-2 py-1 text-sm border rounded hover:bg-gray-100 ${editor.getAttributes("image").align === "right" ? "bg-gray-200" : ""}`} title="오른쪽 정렬">오른쪽</button>
            <span className="border-l border-gray-200 h-4 mx-0.5" />
            <button type="button" onClick={() => editor.chain().focus().deleteSelection().run()} className="px-2 py-1 text-sm border rounded hover:bg-gray-100">
              그림 삭제
            </button>
          </>
        )}
        {(() => {
          const sel = editor.state.selection;
          const isTableNodeSelected = sel instanceof NodeSelection && sel.node?.type?.name === "table";
          const isCellSelection = sel instanceof CellSelection;
          const isInCell = isCellSelection || editor.isActive("tableCell") || editor.isActive("tableHeader");
          const inTable = isTableNodeSelected || isInCell;
          if (!inTable) return null;

          const selectTable = () => {
            editor.chain().focus().command(({ state, dispatch }) => {
              const $from = state.selection.$from;
              for (let d = $from.depth; d > 0; d--) {
                const node = $from.node(d);
                if (node.type.name === "table") {
                  const pos = $from.before(d);
                  if (dispatch) dispatch(state.tr.setSelection(NodeSelection.create(state.doc, pos)));
                  return true;
                }
              }
              return false;
            }).run();
          };

          /** 표 안에서 현재 커서가 있는 셀 하나를 셀 선택 상태로 지정 */
          const selectCurrentCell = () => {
            const $from = editor.state.selection.$from;
            for (let d = $from.depth; d > 0; d--) {
              const node = $from.node(d);
              if (node.type.name === "tableCell" || node.type.name === "tableHeader") {
                const pos = $from.start(d);
                editor.chain().focus().setCellSelection({ anchorCell: pos, headCell: pos }).run();
                return;
              }
            }
          };

          const BORDER_WIDTHS = [
            { value: "", label: "기본" },
            { value: "0", label: "0" },
            { value: "1px", label: "1px" },
            { value: "2px", label: "2px" },
            { value: "3px", label: "3px" },
          ];

          return (
            <>
              {isInCell && !isTableNodeSelected && (
                <>
                  <button type="button" onClick={selectCurrentCell} className="px-2 py-1 text-sm border rounded hover:bg-gray-100 whitespace-nowrap" title="현재 셀 지정">
                    셀 지정
                  </button>
                  <button type="button" onClick={selectTable} className="px-2 py-1 text-sm border rounded hover:bg-gray-100 whitespace-nowrap">
                    표 전체 선택
                  </button>
                </>
              )}
              {isTableNodeSelected && (
                <>
                  <button type="button" onClick={() => editor.chain().focus().updateAttributes("table", { align: "left" }).run()} className={`px-2 py-1 text-sm border rounded hover:bg-gray-100 ${editor.getAttributes("table").align === "left" ? "bg-gray-200" : ""}`}>왼쪽</button>
                  <button type="button" onClick={() => editor.chain().focus().updateAttributes("table", { align: "center" }).run()} className={`px-2 py-1 text-sm border rounded hover:bg-gray-100 ${editor.getAttributes("table").align === "center" ? "bg-gray-200" : ""}`}>가운데</button>
                  <button type="button" onClick={() => editor.chain().focus().updateAttributes("table", { align: "right" }).run()} className={`px-2 py-1 text-sm border rounded hover:bg-gray-100 ${editor.getAttributes("table").align === "right" ? "bg-gray-200" : ""}`}>오른쪽</button>
                  <span className="text-xs text-gray-500 px-1">표 스타일</span>
                </>
              )}
              {isInCell && !isTableNodeSelected && <span className="text-xs text-gray-500 px-1">셀 스타일</span>}
              {(isTableNodeSelected ? (
                (() => {
                  const tableStyle = parseTableStyle(editor.getAttributes("table").style);
                  const apply = (opts: { backgroundColor?: string | null; borderColor?: string | null; borderStyle?: string | null; borderWidth?: string | null }) => {
                    const next = buildTableStyle(editor.getAttributes("table").style, opts);
                    editor.chain().focus().updateAttributes("table", { style: next || null }).run();
                  };
                  return (
                    <>
                      <span className="text-xs text-gray-500">바탕</span>
                      <ColorPalette64 applyMode="background" selectedHex={tableStyle.backgroundColor ?? undefined} onSelect={(h) => apply({ backgroundColor: h })} cellSize={18} />
                      <button type="button" onClick={() => apply({ backgroundColor: null })} className="text-xs border rounded px-1.5 py-0.5">없음</button>
                      <span className="text-xs text-gray-500">선색</span>
                      <ColorPalette64 applyMode="text" selectedHex={tableStyle.borderColor ?? "#e5e7eb"} onSelect={(h) => apply({ borderColor: h })} cellSize={18} />
                      <LineStylePicker value={tableStyle.borderStyle ?? ""} onChange={(v) => apply({ borderStyle: v })} size="small" />
                      <select className="text-xs border rounded px-1 py-0.5" value={tableStyle.borderWidth ?? ""} onChange={(e) => apply({ borderWidth: e.target.value || null })}>
                        {BORDER_WIDTHS.map((o) => <option key={o.value || "x"} value={o.value}>{o.label}</option>)}
                      </select>
                    </>
                  );
                })()
              ) : (
                (() => {
                  const isCell = editor.isActive("tableCell");
                  const cellAttrs = isCell ? editor.getAttributes("tableCell") : editor.getAttributes("tableHeader");
                  const cellStyle = parseTableStyle(cellAttrs.style);
                  const apply = (opts: { backgroundColor?: string | null; borderColor?: string | null; borderStyle?: string | null; borderWidth?: string | null }) => {
                    const next = buildCellStyle(cellAttrs.style, opts);
                    editor.chain().focus().setCellAttribute("style", next || null).run();
                  };
                  return (
                    <>
                      <span className="text-xs text-gray-500">바탕</span>
                      <ColorPalette64 applyMode="background" selectedHex={cellStyle.backgroundColor ?? undefined} onSelect={(h) => apply({ backgroundColor: h })} cellSize={18} />
                      <button type="button" onClick={() => apply({ backgroundColor: null })} className="text-xs border rounded px-1.5 py-0.5">없음</button>
                      <span className="text-xs text-gray-500">선색</span>
                      <ColorPalette64 applyMode="text" selectedHex={cellStyle.borderColor ?? "#e5e7eb"} onSelect={(h) => apply({ borderColor: h })} cellSize={18} />
                      <LineStylePicker value={cellStyle.borderStyle ?? ""} onChange={(v) => apply({ borderStyle: v })} size="small" />
                      <select className="text-xs border rounded px-1 py-0.5" value={cellStyle.borderWidth ?? ""} onChange={(e) => apply({ borderWidth: e.target.value || null })}>
                        {BORDER_WIDTHS.map((o) => <option key={o.value || "x"} value={o.value}>{o.label}</option>)}
                      </select>
                    </>
                  );
                })()
              ))}
              <span className="border-l border-gray-200 h-4 mx-0.5" />
              <button type="button" onClick={() => editor.chain().focus().addRowAfter().run()} className="px-2 py-1 text-sm border rounded hover:bg-gray-100">행 추가</button>
              <button type="button" onClick={() => editor.chain().focus().addColumnAfter().run()} className="px-2 py-1 text-sm border rounded hover:bg-gray-100">열 추가</button>
              <button type="button" onClick={() => editor.chain().focus().deleteTable().run()} className="px-2 py-1 text-sm border rounded hover:bg-red-50 text-red-600">표 삭제</button>
            </>
          );
        })()}
      </BubbleMenu>
    </div>
  );
}
