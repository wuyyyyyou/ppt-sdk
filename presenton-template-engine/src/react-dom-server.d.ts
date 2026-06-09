declare module "react-dom/server" {
  import type { ReactElement } from "react";

  export function renderToStaticMarkup(element: ReactElement): string;
}

declare module "react-dom" {
  export function flushSync<T>(callback: () => T): T;
}

declare module "react-dom/client" {
  import type { ReactElement } from "react";

  export interface Root {
    render(children: ReactElement): void;
    unmount(): void;
  }

  export function createRoot(container: Element | DocumentFragment): Root;
}
