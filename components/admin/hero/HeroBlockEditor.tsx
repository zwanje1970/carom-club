"use client";

import { useCallback, useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Paragraph from "@tiptap/extension-paragraph";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { TextStyle, Color, FontSize, FontFamily } from "@tiptap/extension-text-style";
import type { Editor } from "@tiptap/core";

/** 커서가 있는 단락에만 줄간격 적용 (paragraph lineHeight 속성) */
const ParagraphWithLineHeight = Paragraph.extend({
  addAttributes() {
    return {
      lineHeight: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).style?.lineHeight || null,
        renderHTML: (attrs) =>
          attrs.lineHeight ? { style: `line-height: ${attrs.lineHeight}` } : {},
      },
    };
  },
  addCommands() {
    return {
      setParagraph: () => ({ commands }: { commands: { setNode: (name: string) => boolean } }) => commands.setNode(this.name),
      setParagraphLineHeight:
        (lineHeight: string | null) =>
        ({ commands }: { commands: { updateAttributes: (node: string, attrs: object) => boolean } }) =>
          commands.updateAttributes("paragraph", { lineHeight: lineHeight ?? null }),
    };
  },
});

export type HeroBlockEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onFocus?: () => void;
  onEditorReady?: (editor: Editor | null) => void;
  /** 커서가 있는 단락의 줄간격 (편집툴에서 적용 시 사용). 예: "1.25", "1.5" */
  lineHeight?: string;
  /** 선택/커서 변경 시 현재 단락의 줄간격을 알려줌 */
  onParagraphLineHeight?: (lineHeight: string | null) => void;
  className?: string;
  minHeight?: string;
  /** true면 입력칸에서는 서식 없이 통일된 모양으로만 표시 (미리보기에서만 서식 적용) */
  plainView?: boolean;
};

export function HeroBlockEditor({
  value,
  onChange,
  placeholder = "입력하세요",
  onFocus,
  onEditorReady,
  onParagraphLineHeight,
  plainView = true,
  className = "",
  minHeight = "72px",
}: HeroBlockEditorProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onParagraphLineHeightRef = useRef(onParagraphLineHeight);
  onParagraphLineHeightRef.current = onParagraphLineHeight;

  const toHtml = useCallback((v: string) => {
    const s = (v || "").trim();
    if (!s) return "<p></p>";
    if (s.startsWith("<") && s.includes(">")) return s;
    return "<p>" + s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") + "</p>";
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    content: toHtml(value),
    extensions: [
      StarterKit.configure({ heading: false, paragraph: false }),
      ParagraphWithLineHeight,
      Placeholder.configure({ placeholder }),
      Underline,
      TextStyle,
      Color.configure({ types: ["textStyle"] }),
      FontSize,
      FontFamily,
    ],
    onUpdate: ({ editor }) => {
      onChangeRef.current(editor.getHTML());
    },
    onSelectionUpdate: ({ editor }) => {
      const { from } = editor.state.selection;
      const $pos = editor.state.doc.resolve(from);
      const node = $pos.parent;
      const lh = node.type.name === "paragraph" ? (node.attrs.lineHeight as string | undefined) ?? null : null;
      onParagraphLineHeightRef.current?.(lh ?? null);
    },
    editorProps: {
      attributes: {
        class: "hero-block-editor-inner outline-none min-h-[2.5rem]",
      },
      handleFocus: () => onFocus?.(),
    } as Record<string, unknown>,
  });

  useEffect(() => {
    onEditorReady?.(editor ?? null);
    return () => onEditorReady?.(null);
  }, [editor, onEditorReady]);

  useEffect(() => {
    if (!editor) return;
    const current = toHtml(value);
    if (editor.getHTML() !== current) {
      editor.commands.setContent(current, { emitUpdate: false });
    }
  }, [value, editor, toHtml]);

  // 에디터 준비 시 현재 단락 줄간격 한 번만 알림 (ref 사용으로 리렌더 루프 방지)
  useEffect(() => {
    if (!editor) return;
    const { from } = editor.state.selection;
    const $pos = editor.state.doc.resolve(from);
    const node = $pos.parent;
    const lh = node.type.name === "paragraph" ? (node.attrs.lineHeight as string | undefined) ?? null : null;
    onParagraphLineHeightRef.current?.(lh ?? null);
  }, [editor]);

  if (!editor) {
    return (
      <div className={`rounded border border-site-border bg-gray-50 flex items-center justify-center text-gray-500 text-sm ${className}`} style={{ minHeight }}>
        로딩 중...
      </div>
    );
  }

  return (
    <div
      className={`hero-block-editor rounded-lg border border-site-border bg-white overflow-visible ${plainView ? "hero-block-editor-plain-view" : ""} ${className}`}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        .hero-block-editor .hero-block-editor-inner { padding: 8px 10px; }
        .hero-block-editor .ProseMirror p.is-editor-empty:first-child::before { content: attr(data-placeholder); color: #9ca3af; float: left; }
        .hero-block-editor-plain-view .hero-block-editor-inner,
        .hero-block-editor-plain-view .hero-block-editor-inner * { font-family: inherit !important; font-size: 14px !important; color: #374151 !important; }
        .hero-block-editor-plain-view .hero-block-editor-inner strong { font-weight: 700 !important; }
        .hero-block-editor-plain-view .hero-block-editor-inner em { font-style: italic !important; }
        .hero-block-editor-plain-view .hero-block-editor-inner u { text-decoration: underline !important; }
      ` }} />
      <EditorContent editor={editor} />
    </div>
  );
}

/** HTML에서 텍스트만 추출 (태그 제거) - 미리보기 폴백용 */
export function stripHeroHtml(html: string): string {
  if (!html || !html.includes("<")) return html;
  const div = typeof document !== "undefined" ? document.createElement("div") : null;
  if (div) {
    div.innerHTML = html;
    return div.textContent || div.innerText || html;
  }
  return html.replace(/<[^>]+>/g, "");
}
