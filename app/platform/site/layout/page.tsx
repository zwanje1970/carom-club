"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type LayoutMenuItem = {
  label: string;
  href: string;
};

type LayoutConfig = {
  header: {
    pc: { menuItems: LayoutMenuItem[] };
    mobile: { menuItems: LayoutMenuItem[] };
  };
  footer: {
    pc: { text: string };
    mobile: { text: string };
  };
};

type LayoutTab = "PC_HEADER" | "MOBILE_HEADER" | "PC_FOOTER" | "MOBILE_FOOTER";

function createEmptyConfig(): LayoutConfig {
  return {
    header: { pc: { menuItems: [] }, mobile: { menuItems: [] } },
    footer: { pc: { text: "" }, mobile: { text: "" } },
  };
}

function createEmptyMenuItem(): LayoutMenuItem {
  return { label: "", href: "" };
}

export default function PlatformSiteLayoutPage() {
  const [config, setConfig] = useState<LayoutConfig>(createEmptyConfig());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState<LayoutTab>("PC_HEADER");

  useEffect(() => {
    async function loadConfig() {
      setLoading(true);
      setMessage("");
      try {
        const response = await fetch("/api/platform/site-layout");
        const result = (await response.json()) as { config?: LayoutConfig; error?: string };
        if (!response.ok || !result.config) {
          setMessage(result.error ?? "설정을 불러오지 못했습니다.");
          return;
        }
        setConfig(result.config);
      } catch {
        setMessage("설정 조회 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    }

    void loadConfig();
  }, []);

  function updateHeaderMenuItems(target: "pc" | "mobile", nextItems: LayoutMenuItem[]) {
    setConfig((prev) => ({
      ...prev,
      header: {
        ...prev.header,
        [target]: { menuItems: nextItems },
      },
    }));
  }

  function updateFooterText(target: "pc" | "mobile", nextText: string) {
    setConfig((prev) => ({
      ...prev,
      footer: {
        ...prev.footer,
        [target]: { text: nextText },
      },
    }));
  }

  function addMenuItem(target: "pc" | "mobile") {
    const current = target === "pc" ? config.header.pc.menuItems : config.header.mobile.menuItems;
    updateHeaderMenuItems(target, [...current, createEmptyMenuItem()]);
  }

  function removeMenuItem(target: "pc" | "mobile", index: number) {
    const current = target === "pc" ? config.header.pc.menuItems : config.header.mobile.menuItems;
    updateHeaderMenuItems(
      target,
      current.filter((_, itemIndex) => itemIndex !== index)
    );
  }

  function updateMenuItem(target: "pc" | "mobile", index: number, field: "label" | "href", value: string) {
    const current = target === "pc" ? config.header.pc.menuItems : config.header.mobile.menuItems;
    const nextItems = current.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      return { ...item, [field]: value };
    });
    updateHeaderMenuItems(target, nextItems);
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/platform/site-layout", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          header: config.header,
          footer: config.footer,
        }),
      });
      const result = (await response.json()) as { ok?: boolean; config?: LayoutConfig; error?: string };
      if (!response.ok || !result.ok || !result.config) {
        setMessage(result.error ?? "저장에 실패했습니다.");
        return;
      }
      setConfig(result.config);
      setMessage("헤더/푸터 설정이 저장되었습니다.");
    } catch {
      setMessage("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  function renderHeaderEditor(target: "pc" | "mobile") {
    const menuItems = target === "pc" ? config.header.pc.menuItems : config.header.mobile.menuItems;
    return (
      <section className="v3-box v3-stack">
        <h2 className="v3-h2">{target === "pc" ? "PC 헤더 메뉴" : "모바일 헤더 메뉴"}</h2>
        {menuItems.length === 0 ? <p className="v3-muted">등록된 메뉴가 없습니다.</p> : null}
        {menuItems.map((item, index) => (
          <div key={`${target}-menu-${index}`} className="v3-box v3-stack" style={{ background: "#fafafa" }}>
            <label className="v3-stack">
              <span>텍스트</span>
              <input
                value={item.label}
                onChange={(event) => updateMenuItem(target, index, "label", event.target.value)}
                style={{ padding: "0.5rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
              />
            </label>
            <label className="v3-stack">
              <span>링크</span>
              <input
                value={item.href}
                onChange={(event) => updateMenuItem(target, index, "href", event.target.value)}
                style={{ padding: "0.5rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
              />
            </label>
            <button type="button" className="v3-btn" onClick={() => removeMenuItem(target, index)}>
              메뉴 삭제
            </button>
          </div>
        ))}
        <button type="button" className="v3-btn" onClick={() => addMenuItem(target)}>
          메뉴 추가
        </button>
      </section>
    );
  }

  function renderFooterEditor(target: "pc" | "mobile") {
    const text = target === "pc" ? config.footer.pc.text : config.footer.mobile.text;
    return (
      <section className="v3-box v3-stack">
        <h2 className="v3-h2">{target === "pc" ? "PC 푸터 텍스트" : "모바일 푸터 텍스트"}</h2>
        <textarea
          value={text}
          onChange={(event) => updateFooterText(target, event.target.value)}
          rows={5}
          style={{ padding: "0.6rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
        />
      </section>
    );
  }

  return (
    <main className="v3-page v3-stack">
      <h1 className="v3-h1">헤더/푸터 관리</h1>
      <p className="v3-muted">사이트 공통 헤더/푸터 문구와 메뉴를 관리합니다.</p>

      <div className="v3-row">
        <button type="button" className="v3-btn" onClick={() => setTab("PC_HEADER")}>
          PC 헤더
        </button>
        <button type="button" className="v3-btn" onClick={() => setTab("MOBILE_HEADER")}>
          모바일 헤더
        </button>
        <button type="button" className="v3-btn" onClick={() => setTab("PC_FOOTER")}>
          PC 푸터
        </button>
        <button type="button" className="v3-btn" onClick={() => setTab("MOBILE_FOOTER")}>
          모바일 푸터
        </button>
      </div>

      {loading ? <p className="v3-muted">불러오는 중...</p> : null}
      {!loading && tab === "PC_HEADER" ? renderHeaderEditor("pc") : null}
      {!loading && tab === "MOBILE_HEADER" ? renderHeaderEditor("mobile") : null}
      {!loading && tab === "PC_FOOTER" ? renderFooterEditor("pc") : null}
      {!loading && tab === "MOBILE_FOOTER" ? renderFooterEditor("mobile") : null}

      <div className="v3-row">
        <button type="button" className="v3-btn" onClick={handleSave} disabled={saving || loading}>
          {saving ? "저장 중..." : "저장"}
        </button>
        <Link className="v3-btn" href="/platform/site">
          사이트 관리로
        </Link>
      </div>

      {message ? <p className="v3-muted">{message}</p> : null}
    </main>
  );
}
