export type RuntimeMode = "anna" | "standalone" | "mock";

export function detectRuntimeMode(): RuntimeMode {
  if (typeof window !== "undefined" && "AnnaAppRuntime" in window) {
    return "anna";
  }

  if (import.meta.env.MODE === "test") {
    return "mock";
  }

  return "standalone";
}
