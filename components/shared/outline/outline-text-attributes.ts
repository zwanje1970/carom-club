import { Extension } from "@tiptap/core";

/** textStyle 마크에 fontSize / fontWeight 속성 (Color 등과 동일 패턴) */
export const OutlineFontSize = Extension.create({
  name: "outlineFontSize",
  addOptions() {
    return { types: ["textStyle"] as const };
  },
  addGlobalAttributes() {
    return [
      {
        types: [...this.options.types],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => {
              const raw = element.style.fontSize?.replace(/['"]+/g, "").trim();
              return raw || null;
            },
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
});

export const OutlineFontWeightStyle = Extension.create({
  name: "outlineFontWeightStyle",
  addOptions() {
    return { types: ["textStyle"] as const };
  },
  addGlobalAttributes() {
    return [
      {
        types: [...this.options.types],
        attributes: {
          fontWeight: {
            default: null,
            parseHTML: (element) => {
              const raw = element.style.fontWeight?.replace(/['"]+/g, "").trim();
              return raw || null;
            },
            renderHTML: (attributes) => {
              if (!attributes.fontWeight) return {};
              return { style: `font-weight: ${attributes.fontWeight}` };
            },
          },
        },
      },
    ];
  },
});

export const OUTLINE_FONT_SIZE = {
  large: "1.125rem",
  small: "0.875rem",
} as const;
