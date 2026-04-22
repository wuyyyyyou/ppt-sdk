declare global {
  interface Window {
    __PRESENTON_REMOTE_SVG_PENDING__?: number;
  }
}

declare module "puppeteer" {
  const puppeteer: any;
  export default puppeteer;
}

export {};
