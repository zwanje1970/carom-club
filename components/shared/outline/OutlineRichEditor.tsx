"use client";

import { useEffect, useRef } from "react";
import type { Editor } from "@tiptap/core";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";

import { OutlineFontSize, OutlineFontWeightStyle, OUTLINE_FONT_SIZE } from "./outline-text-attributes";

const OUTLINE_TEXT_COLORS = [
  "#0f172a",
  "#334155",
  "#64748b",
  "#2563eb",
  "#1d4ed8",
  "#dc2626",
  "#16a34a",
  "#ca8a04",
  "#7c3aed",
  "#ffffff",
];

export type OutlineRichEditorProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  compact?: boolean;
};

function toolbarBtn(active: boolean, compact: boolean) {
  const pad = compact ? "0.25rem 0.4rem" : "0.35rem 0.5rem";
  return {
    padding: pad,
    border: "1px solid #e2e8f0",
    borderRadius: "0.35rem",
    background: active ? "#e0e7ff" : "#fff",
    color: "#0f172a",
    fontSize: compact ? "0.75rem" : "0.8rem",
    cursor: "pointer" as const,
  };
}

/** 정렬: 커서 줄 또는 선택된 줄/문단에만 적용 */
function setTextAlignCurrentLine(editor: Editor, align: "left" | "center" | "right"): boolean {
  return editor
    .chain()
    .focus()
    .command(({ tr, state }) => {
      const positions = new Set<number>();
      const { from, to, empty, $from } = state.selection;

      if (empty) {
        for (let d = $from.depth; d > 0; d--) {
          const node = $from.node(d);
          if (node.type.name === "paragraph" || node.type.name === "heading") {
            positions.add($from.before(d));
            break;
          }
        }
      } else {
        state.doc.nodesBetween(from, to, (node, pos) => {
          if (node.type.name !== "paragraph" && node.type.name !== "heading") return;
          if (pos + node.nodeSize < from) return;
          if (pos > to) return;
          positions.add(pos);
        });
        if (positions.size === 0) {
          for (let d = $from.depth; d > 0; d--) {
            const node = $from.node(d);
            if (node.type.name === "paragraph" || node.type.name === "heading") {
              positions.add($from.before(d));
              break;
            }
          }
        }
      }

      positions.forEach((pos) => {
        const node = tr.doc.nodeAt(pos);
        if (!node) return;
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, textAlign: align });
      });
      return positions.size > 0;
    })
    .run();
}

function getTextStyleAttrs(editor: Editor): Record<string, unknown> {
  return editor.getAttributes("textStyle") as Record<string, unknown>;
}

function mergeTextStyle(editor: Editor, patch: Record<string, string | null>): boolean {
  const cur = getTextStyleAttrs(editor) as Record<string, unknown>;
  const next: Record<string, unknown> = { ...cur };
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === "") {
      delete next[k];
    } else {
      next[k] = v;
    }
  }
  const keys = Object.keys(next).filter((k) => next[k] != null && next[k] !== "");
  if (keys.length === 0) {
    return editor.chain().focus().unsetMark("textStyle").run();
  }
  return editor.chain().focus().setMark("textStyle", next as Record<string, string>).run();
}

function applyFontSize(editor: Editor, mode: "large" | "normal" | "small"): boolean {
  if (mode === "normal") {
    return mergeTextStyle(editor, { fontSize: null });
  }
  const v = mode === "large" ? OUTLINE_FONT_SIZE.large : OUTLINE_FONT_SIZE.small;
  return mergeTextStyle(editor, { fontSize: v });
}

function applyFontWeight(editor: Editor, mode: "bold" | "normal" | "light"): boolean {
  const cur = getTextStyleAttrs(editor) as Record<string, unknown>;
  const withoutWeight = { ...cur };
  delete withoutWeight.fontWeight;

  if (mode === "bold") {
    const keys = Object.keys(withoutWeight).filter((k) => withoutWeight[k] != null && withoutWeight[k] !== "");
    if (keys.length === 0) {
      return editor.chain().focus().unsetMark("textStyle").setBold().run();
    }
    return editor.chain().focus().setMark("textStyle", withoutWeight as Record<string, string>).setBold().run();
  }
  if (mode === "normal") {
    editor.chain().focus().unsetBold().run();
    return mergeTextStyle(editor, { fontWeight: null });
  }
  return editor
    .chain()
    .focus()
    .unsetBold()
    .setMark("textStyle", { ...withoutWeight, fontWeight: "300" } as Record<string, string>)
    .run();
}

export default function OutlineRichEditor({ value, onChange, placeholder, compact }: OutlineRichEditorProps) {
  const editorRef = useRef<Editor | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Underline,
      TextAlign.configure({
        types: ["paragraph", "heading"],
        alignments: ["left", "center", "right"],
        defaultAlignment: null,
      }),
      Link.configure({
        openOnClick: false,
        autolink: false,
        HTMLAttributes: { rel: "noopener noreferrer" },
      }),
      TextStyle,
      OutlineFontSize,
      OutlineFontWeightStyle,
      Color.configure({ types: ["textStyle"] }),
      Placeholder.configure({
        placeholder: placeholder ?? "경기요강 내용을 입력하세요.",
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: "outline-tiptap-root",
        style: "min-height: 12rem; outline: none; padding: 0.5rem 0.65rem;",
      },
      handleKeyDown: (_view, event) => {
        const ed = editorRef.current;
        if (!ed) return false;
        if (!(event.metaKey || event.ctrlKey) || !event.shiftKey) return false;
        const key = event.key.toLowerCase();
        if (key === "l") {
          event.preventDefault();
          setTextAlignCurrentLine(ed, "left");
          return true;
        }
        if (key === "e") {
          event.preventDefault();
          setTextAlignCurrentLine(ed, "center");
          return true;
        }
        if (key === "r") {
          event.preventDefault();
          setTextAlignCurrentLine(ed, "right");
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    const cur = editor.getHTML();
    if (value !== cur) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) {
    return (
      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: "0.4rem",
          minHeight: "12rem",
          background: "#f8fafc",
        }}
      />
    );
  }

  const gap = compact ? "0.25rem" : "0.35rem";
  const ts = getTextStyleAttrs(editor);
  const fontSize = typeof ts.fontSize === "string" ? ts.fontSize : "";
  const fontWeight = typeof ts.fontWeight === "string" ? ts.fontWeight : "";
  const sizeLarge = fontSize === OUTLINE_FONT_SIZE.large;
  const sizeSmall = fontSize === OUTLINE_FONT_SIZE.small;
  const sizeNormal = !sizeLarge && !sizeSmall;
  const wBold = editor.isActive("bold");
  const wLight = !editor.isActive("bold") && fontWeight === "300";
  const wNormal = !editor.isActive("bold") && !wLight;

  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: "0.4rem", background: "#fff" }}>
      <div
        className="v3-row"
        style={{
          flexWrap: "wrap",
          gap,
          padding: compact ? "0.35rem" : "0.45rem",
          borderBottom: "1px solid #e2e8f0",
          background: "#f8fafc",
        }}
        role="toolbar"
        aria-label="서식"
      >
        <button type="button" style={toolbarBtn(sizeLarge, !!compact)} onClick={() => applyFontSize(editor, "large")}>
          크게
        </button>
        <button type="button" style={toolbarBtn(sizeNormal, !!compact)} onClick={() => applyFontSize(editor, "normal")}>
          보통
        </button>
        <button type="button" style={toolbarBtn(sizeSmall, !!compact)} onClick={() => applyFontSize(editor, "small")}>
          작게
        </button>
        <button type="button" style={toolbarBtn(wBold, !!compact)} onClick={() => applyFontWeight(editor, "bold")}>
          굵게
        </button>
        <button type="button" style={toolbarBtn(wNormal, !!compact)} onClick={() => applyFontWeight(editor, "normal")}>
          보통
        </button>
        <button type="button" style={toolbarBtn(wLight, !!compact)} onClick={() => applyFontWeight(editor, "light")}>
          가늘게
        </button>
        <button
          type="button"
          style={toolbarBtn(editor.isActive("italic"), !!compact)}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          기울임
        </button>
        <button
          type="button"
          style={toolbarBtn(editor.isActive("underline"), !!compact)}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          밑줄
        </button>
        <button
          type="button"
          style={toolbarBtn(editor.isActive({ textAlign: "left" }), !!compact)}
          onClick={() => setTextAlignCurrentLine(editor, "left")}
        >
          왼쪽
        </button>
        <button
          type="button"
          style={toolbarBtn(editor.isActive({ textAlign: "center" }), !!compact)}
          onClick={() => setTextAlignCurrentLine(editor, "center")}
        >
          가운데
        </button>
        <button
          type="button"
          style={toolbarBtn(editor.isActive({ textAlign: "right" }), !!compact)}
          onClick={() => setTextAlignCurrentLine(editor, "right")}
        >
          오른쪽
        </button>
        {OUTLINE_TEXT_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            title={c}
            onClick={() => editor.chain().focus().setColor(c).run()}
            style={{
              width: compact ? "1.25rem" : "1.4rem",
              height: compact ? "1.25rem" : "1.4rem",
              borderRadius: "0.25rem",
              border: editor.isActive("textStyle", { color: c })
                ? "2px solid #2563eb"
                : c === "#ffffff"
                  ? "1px solid #cbd5e1"
                  : "1px solid transparent",
              background: c,
              cursor: "pointer",
            }}
          />
        ))}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
