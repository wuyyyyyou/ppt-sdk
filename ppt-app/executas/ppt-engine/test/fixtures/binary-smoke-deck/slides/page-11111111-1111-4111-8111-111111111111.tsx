export default function Page() {
  return (
    <div
      id="binary-smoke-slide"
      className="relative flex"
      style={{ width: "1280px", height: "720px", background: "#f8fafc" }}
    >
      <section
        className="flex items-center justify-center"
        style={{ width: "640px", height: "720px", background: "#2563eb" }}
      >
        <h1 style={{ color: "#ffffff", fontFamily: "Arial, sans-serif", fontSize: "48px" }}>
          PPT_ENGINE_BINARY_SMOKE
        </h1>
      </section>
      <section
        className="flex items-center justify-center"
        style={{ width: "640px", height: "720px", background: "#f97316" }}
      >
        <svg aria-label="smoke marker" width="200" height="200" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="72" fill="#ffffff" />
          <rect x="72" y="72" width="56" height="56" rx="8" fill="#172033" />
        </svg>
      </section>
    </div>
  );
}
