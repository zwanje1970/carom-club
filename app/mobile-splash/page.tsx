"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MobileSplashPage() {
  const router = useRouter();

  useEffect(() => {
    const t = window.setTimeout(() => {
      router.push("/site");
    }, 3000);
    return () => window.clearTimeout(t);
  }, [router]);

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        backgroundColor: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        margin: 0,
      }}
    >
      <img src="/splash.png" alt="splash" style={{ width: "45%" }} />
    </div>
  );
}
