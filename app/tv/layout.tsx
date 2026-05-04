export default function TvLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="tv-root-shell"
      style={{
        minHeight: "100vh",
        background: "#0b1220",
        color: "#e8eef7",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {children}
    </div>
  );
}
