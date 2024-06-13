import { promises as fs } from "fs";
import * as prettier from "prettier";

export async function writeFilePrettified(path: string, data: string) {
  const formatted = await prettier.format(data, { parser: "typescript" });
  await fs.writeFile(path, formatted);
}

export function getSeparator(name: string) {
  return `\n// =============================== ${name} ===============================\n`;
}

export function sift<T>(input: (T | undefined)[]): T[] {
  return input.filter((each) => each !== undefined) as T[];
}
