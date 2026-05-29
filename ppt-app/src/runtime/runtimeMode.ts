export type RuntimeMode = "anna" | "mock";

export function detectRuntimeMode(): RuntimeMode {
  if (typeof window !== "undefined" && "AnnaAppRuntime" in window) {
    return "anna";
  }

  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    if (params.has("wid") && params.has("t")) {
      return "anna";
    }
  }

  if (import.meta.env.MODE === "test") {
    return "mock";
  }

  throw new Error(
    "AnnaAppRuntime is not available. Run the app with `npm run dev`, `npm run dev:mock-llm`, or inside the Anna host."
  );
}
