"use client";

export default function SitePublicLoadingShell() {
  return (
    <main className="v3-page site-home-page site-home-page--standard">
      <div className="site-home-shell" style={{ minHeight: "100dvh", width: "100%" }}>
        <div className="site-shell-sticky-dock">
          <div className="site-home-top-white site-home-top-white--standard">
            <div className="site-home-brand" style={{ minHeight: "2.75rem", display: "flex", alignItems: "center" }}>
              <div className="site-mobile-page-title-block" aria-hidden="true">
                <span
                  style={{
                    display: "inline-block",
                    width: "8.5rem",
                    height: "1.1rem",
                    borderRadius: "999px",
                    background: "rgba(255,255,255,0.32)",
                  }}
                />
              </div>
            </div>
          </div>
          <div className="site-shell-controls">
            <div className="site-shell-controls-inner v3-stack" style={{ gap: "0.5rem" }}>
              <div
                style={{
                  height: "1.2rem",
                  width: "7rem",
                  borderRadius: "999px",
                  background: "#dbe3ea",
                }}
              />
              <div
                style={{
                  height: "2.25rem",
                  width: "100%",
                  borderRadius: "0.75rem",
                  background: "#edf1f5",
                }}
              />
            </div>
          </div>
        </div>
        <div className="site-shell-scroll-body">
          <section className="site-site-gray-main v3-stack" style={{ gap: "0.85rem" }}>
            <div className="card-clean" style={{ minHeight: "9rem", background: "#f8fafc" }} />
            <div className="card-clean" style={{ minHeight: "14rem", background: "#fff" }} />
            <div className="card-clean" style={{ minHeight: "9rem", background: "#fff" }} />
          </section>
        </div>
      </div>
    </main>
  );
}
