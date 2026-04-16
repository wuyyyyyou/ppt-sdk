import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const TARGET_PATH = path.join(SCRIPT_DIR, "..", "node_modules", "postject", "dist", "api.js");

const REPLACEMENTS = [
  [
    "const buffer = Buffer.from(data.buffer);",
    "const buffer = Buffer.from(data.buffer, data.byteOffset, data.byteLength);",
  ],
  [
    "buffer[colonIndex].charCodeAt(0)",
    "buffer[colonIndex]",
  ],
  [
    "hasResourceValue.charCodeAt(\n        0\n      )",
    "hasResourceValue",
  ],
];

const SENTINEL_BLOCK_PATTERNS = [
  /const firstSentinel = buffer\.indexOf\(sentinelFuse\);[\s\S]*?const hasResourceValue = buffer\[hasResourceIndex\];/m,
  /const zeroSentinel = `\$\{sentinelFuse\}:0`;\n  const oneSentinel = `\$\{sentinelFuse\}:1`;[\s\S]*?const hasResourceValue = buffer\[hasResourceIndex\];/m,
];

const SENTINEL_BLOCK_REPLACEMENT = `const zeroSentinel = \`\${sentinelFuse}:0\`;
  const oneSentinel = \`\${sentinelFuse}:1\`;
  const zeroSentinelIndex = buffer.indexOf(zeroSentinel);
  const oneSentinelIndex = buffer.indexOf(oneSentinel);
  if (zeroSentinelIndex === -1 && oneSentinelIndex === -1) {
    throw new Error(
      \`Could not find the sentinel \${sentinelFuse} in the binary\`
    );
  }
  const hasMultipleSentinels =
    (zeroSentinelIndex !== -1 && buffer.indexOf(zeroSentinel, zeroSentinelIndex + 1) !== -1) ||
    (oneSentinelIndex !== -1 && buffer.indexOf(oneSentinel, oneSentinelIndex + 1) !== -1) ||
    (zeroSentinelIndex !== -1 && oneSentinelIndex !== -1);
  if (hasMultipleSentinels) {
    throw new Error(
      \`Multiple occurences of sentinel "\${sentinelFuse}" found in the binary\`
    );
  }
  const sentinelIndex = zeroSentinelIndex !== -1 ? zeroSentinelIndex : oneSentinelIndex;
  const colonIndex = sentinelIndex + sentinelFuse.length;
  if (buffer[colonIndex] !== ":".charCodeAt(0)) {
    throw new Error(
      \`Value at index \${colonIndex} must be ':' but '\${buffer[colonIndex].charCodeAt(0)}' was found\`
    );
  }
  const hasResourceIndex = colonIndex + 1;
  const hasResourceValue = buffer[hasResourceIndex];`;

function replaceSentinelBlock(source) {
  if (source.includes(SENTINEL_BLOCK_REPLACEMENT)) {
    return { source, changed: false };
  }

  for (const pattern of SENTINEL_BLOCK_PATTERNS) {
    if (!pattern.test(source)) {
      continue;
    }

    return {
      source: source.replace(pattern, SENTINEL_BLOCK_REPLACEMENT),
      changed: true,
    };
  }

  throw new Error("Expected postject sentinel block not found");
}

async function main() {
  let source = await readFile(TARGET_PATH, "utf8");
  let changed = false;

  const sentinelReplacement = replaceSentinelBlock(source);
  source = sentinelReplacement.source;
  changed = sentinelReplacement.changed;

  for (const [from, to] of REPLACEMENTS) {
    if (source.includes(from)) {
      source = source.replace(from, to);
      changed = true;
      continue;
    }

    if (source.includes(to)) {
      continue;
    }

    throw new Error(`Expected postject source snippet not found: ${from}`);
  }

  if (changed) {
    await writeFile(TARGET_PATH, source, "utf8");
    console.log("Patched postject for Node SEA injection compatibility");
    return;
  }

  console.log("postject patch already present");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
