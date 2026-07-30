import { AsyncLocalStorage } from "node:async_hooks";

const currentInvokeId = new AsyncLocalStorage();

function readInvokeId(paramsOrInvokeId) {
  if (typeof paramsOrInvokeId === "string") {
    return paramsOrInvokeId || null;
  }
  if (!paramsOrInvokeId || typeof paramsOrInvokeId !== "object") {
    return null;
  }
  const context = paramsOrInvokeId.context;
  const invokeId = context && typeof context === "object"
    ? context.invoke_id ?? paramsOrInvokeId.invoke_id
    : paramsOrInvokeId.invoke_id;
  return typeof invokeId === "string" && invokeId.length > 0 ? invokeId : null;
}

export function bindInvoke(paramsOrInvokeId, handler) {
  return currentInvokeId.run(readInvokeId(paramsOrInvokeId), handler);
}

export function getCurrentInvokeId() {
  return currentInvokeId.getStore() ?? null;
}

export function attachInvokeContext(params) {
  const invokeId = getCurrentInvokeId();
  if (!invokeId || !params || typeof params !== "object" || Array.isArray(params)) {
    return params;
  }
  if (!params.context || typeof params.context !== "object" || Array.isArray(params.context)) {
    params.context = {};
  }
  if (params.context.invoke_id == null) {
    params.context.invoke_id = invokeId;
  }
  return params;
}
