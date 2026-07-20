export function resolveCorepackInvocation(platform = process.platform) {
  if (platform === "win32") {
    return {
      command: "corepack pnpm build",
      args: [],
      shell: true,
    };
  }

  return {
    command: "corepack",
    args: ["pnpm", "build"],
    shell: false,
  };
}
