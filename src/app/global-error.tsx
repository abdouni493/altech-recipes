"use client";

// Last-resort boundary (root layout failed): plain markup, bilingual text.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="fr">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#F5F9FF", color: "#0F172A", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1>Une erreur est survenue · حدث خطأ</h1>
          <button onClick={reset} style={{ marginTop: 16, padding: "10px 20px", borderRadius: 999, border: 0, background: "#2563EB", color: "white", cursor: "pointer" }}>
            Réessayer · إعادة المحاولة
          </button>
        </div>
      </body>
    </html>
  );
}
