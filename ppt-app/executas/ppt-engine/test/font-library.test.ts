import assert from "node:assert/strict";
import test from "node:test";
import { inspectManagedFontFile } from "../src/font-library/index.ts";

function utf16be(value: string): Buffer {
  const littleEndian = Buffer.from(value, "utf16le");
  const result = Buffer.alloc(littleEndian.length);
  for (let index = 0; index < littleEndian.length; index += 2) {
    result[index] = littleEndian[index + 1]!;
    result[index + 1] = littleEndian[index]!;
  }
  return result;
}

function nameTable(family: string, subfamily: string): Buffer {
  const familyBytes = utf16be(family);
  const subfamilyBytes = utf16be(subfamily);
  const table = Buffer.alloc(6 + 24 + familyBytes.length + subfamilyBytes.length);
  table.writeUInt16BE(0, 0);
  table.writeUInt16BE(2, 2);
  table.writeUInt16BE(30, 4);
  const writeRecord = (offset: number, nameId: number, bytes: Buffer, stringOffset: number) => {
    table.writeUInt16BE(3, offset);
    table.writeUInt16BE(1, offset + 2);
    table.writeUInt16BE(0x0409, offset + 4);
    table.writeUInt16BE(nameId, offset + 6);
    table.writeUInt16BE(bytes.length, offset + 8);
    table.writeUInt16BE(stringOffset, offset + 10);
  };
  writeRecord(6, 1, familyBytes, 0);
  writeRecord(18, 2, subfamilyBytes, familyBytes.length);
  familyBytes.copy(table, 30);
  subfamilyBytes.copy(table, 30 + familyBytes.length);
  return table;
}

function minimalTtf(family: string, subfamily: string, weight: number): Buffer {
  const tables = [
    { tag: "name", bytes: nameTable(family, subfamily) },
    { tag: "OS/2", bytes: Buffer.alloc(64) },
    { tag: "head", bytes: Buffer.alloc(46) },
    { tag: "maxp", bytes: Buffer.alloc(6) },
    { tag: "cmap", bytes: Buffer.alloc(4) },
    { tag: "glyf", bytes: Buffer.alloc(4) },
  ];
  tables[1]!.bytes.writeUInt16BE(weight, 4);
  tables[2]!.bytes.writeUInt16BE(0x0003, 44);
  const directoryBytes = 12 + tables.length * 16;
  let total = directoryBytes;
  for (const table of tables) total += table.bytes.length;
  const font = Buffer.alloc(total);
  font.writeUInt32BE(0x00010000, 0);
  font.writeUInt16BE(tables.length, 4);
  let tableOffset = directoryBytes;
  tables.forEach((table, index) => {
    const directoryOffset = 12 + index * 16;
    font.write(table.tag, directoryOffset, 4, "latin1");
    font.writeUInt32BE(tableOffset, directoryOffset + 8);
    font.writeUInt32BE(table.bytes.length, directoryOffset + 12);
    table.bytes.copy(font, tableOffset);
    tableOffset += table.bytes.length;
  });
  return font;
}

test("parses a managed font family and PowerPoint variant from font tables", () => {
  assert.deepEqual(
    inspectManagedFontFile(minimalTtf("Portable Demo", "Bold Italic", 700), "demo.ttf"),
    {
      family: "Portable Demo",
      variant: "boldItalic",
      format: "ttf",
    },
  );
});

test("rejects a font whose extension does not match its bytes", () => {
  assert.throws(
    () => inspectManagedFontFile(minimalTtf("Portable Demo", "Regular", 400), "demo.otf"),
    /does not match/,
  );
});
