export function buildLlmInput(systemPrompt, userPrompt) {
  const messages = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: { type: "text", text: systemPrompt } });
  }
  messages.push({ role: "user", content: { type: "text", text: userPrompt } });
  return { messages };
}

export function selectLlmInvocationPath(runtime) {
  if (typeof runtime?.call === "function") return "runtime.call";
  if (typeof runtime?.llm?.complete === "function") return "runtime.llm.complete";
  return "unavailable";
}

export async function invokeAnnaLlm(runtime, input, timeoutMs) {
  const invocationPath = selectLlmInvocationPath(runtime);
  if (invocationPath === "runtime.call") {
    return {
      invocationPath,
      timeoutAppliedByRuntime: true,
      result: await runtime.call("llm", "complete", input, { timeoutMs }),
    };
  }
  if (invocationPath === "runtime.llm.complete") {
    return {
      invocationPath,
      timeoutAppliedByRuntime: false,
      result: await runtime.llm.complete(input),
    };
  }
  throw new Error("Anna runtime 未提供 llm.complete 能力");
}
