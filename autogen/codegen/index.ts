import { ParseResult } from "../parse/types";
import { sift, writeFilePrettified } from "../util";
import { toConst, toEnum } from "./encode";
import * as fs from "node:fs";

export class CodeGenerator {
  parsed: ParseResult.Results;
  static NUMBER_TYPES = ["Int8", "UInt8", "Int16", "UInt16", "Int32", "UInt32"];
  static COMPOSE_TYPES = ["List", "ValueMap"];
  static DEF_TYPE = "Definitions.Field[]";
  numberTypeMapping: Record<string, string>;
  structNames: Set<string>;
  requestNameOpcodeMapping: Record<string, number>;

  constructor(parsed: ParseResult.Results) {
    this.parsed = parsed;
    this.numberTypeMapping = CodeGenerator.getNumberTypeMapping(parsed);
    this.structNames = new Set(parsed.structs.map(({ name }) => name));
    this.requestNameOpcodeMapping = Object.fromEntries(
      parsed.requests.map((r) => [r.name, r.opcode]),
    );
  }

  static getNumberTypeMapping(parsed: ParseResult.Results) {
    const mappingObj: Record<
      string,
      (typeof CodeGenerator.NUMBER_TYPES)[number]
    > = {
      char: "UInt8",
      BOOL: "UInt8",
      BYTE: "Int8",
      CARD8: "UInt8",
      INT8: "Int8",
      CARD16: "UInt16",
      INT16: "Int16",
      CARD32: "UInt32",
      INT32: "Int32",
    };

    Object.assign(
      mappingObj,
      Object.fromEntries(
        parsed.xidtypes.map((idtype) => [idtype.name, "UInt32"]),
      ),
    );

    Object.assign(
      mappingObj,
      Object.fromEntries(
        parsed.typedefs.map((def) => {
          if (mappingObj[def.oldname]) {
            return [def.newname, mappingObj[def.oldname]];
          }
          throw new Error(`${def.oldname} not found`);
        }),
      ),
    );

    Object.assign(
      mappingObj,
      Object.fromEntries(
        parsed.xidunions.map((def) => {
          const union = Array.from(
            new Set(def.types.map((t) => mappingObj[t])),
          );
          if (union.length === 1 && union[0] !== undefined) {
            return [def.name, union[0]];
          }
          throw new Error("union type is not consistent");
        }),
      ),
    );

    return mappingObj;
  }

  static encodeEnums(parsed: ParseResult.Results) {
    return parsed.enums
      .map(({ name, fields }) => {
        const def = Object.fromEntries(
          fields.map((field) => [
            field.name,
            field.bit !== undefined
              ? 1 << field.bit
              : field.value ?? field.name,
          ]),
        );
        return toEnum(name, def);
      })
      .join("\n");
  }

  typeLookup(type: string) {
    if (type in this.numberTypeMapping) {
      return `NumberType.${this.numberTypeMapping[type]}`;
    }
    if (CodeGenerator.NUMBER_TYPES.includes(type)) {
      return `NumberType.${type}`;
    }
    if (CodeGenerator.COMPOSE_TYPES.includes(type)) {
      return `ComposeType.${type}`;
    }
    if (this.structNames.has(type)) {
      return JSON.stringify(type);
    }
    console.warn(`unknown type ${type}`);
    return JSON.stringify(type);
  }

  encodeFields(fields: ParseResult.Struct["fields"]) {
    return fields
      .map((field) => {
        if ("type" in field) {
          return `{${Object.entries(field)
            .map(([key, value]: [string, any]) => {
              return `${key}: ${key === "type" ? this.typeLookup(value) : JSON.stringify(value)}`;
            })
            .join()}}`;
        }
        return JSON.stringify(field);
      })
      .join();
  }

  encodeStructDefs() {
    return [
      ...this.parsed.structs.map(
        ({ name, fields }) =>
          `const ${name}: ${CodeGenerator.DEF_TYPE} = [${this.encodeFields(fields)}]`,
      ),
      `export const structs: Record<string, ${CodeGenerator.DEF_TYPE}> = { ${Array.from(this.structNames)} }`,
    ].join("\n");
  }

  encodeRequestDefs() {
    return [
      toConst("requestNameToOpcodeMapping", this.requestNameOpcodeMapping),
      "export const requestOpcodeToNameMapping = Object.fromEntries(Object.entries(requestNameToOpcodeMapping).map(([key, value]: [string, number]) => [value, key]))",
      ...this.parsed.requests.map(
        ({ name, fields }) =>
          `const ${name}: ${CodeGenerator.DEF_TYPE} = [${this.encodeFields(fields)}]`,
      ),
      ...sift(
        this.parsed.requests.map(
          ({ name, reply }) =>
            reply &&
            `const ${name}Reply: ${CodeGenerator.DEF_TYPE} = [${this.encodeFields(reply.fields)}]`,
        ),
      ),
      `export const requests: Record<string, ${CodeGenerator.DEF_TYPE}> = { ${Object.keys(this.requestNameOpcodeMapping)} }`,
      toConst(
        `replies: Record<string, ${CodeGenerator.DEF_TYPE}>`,
        Object.fromEntries(
          this.parsed.requests
            .filter(({ reply }) => !!reply)
            .map(({ name }) => [name, `${name}Reply`]),
        ),
        true,
      ),
    ].join("\n");
  }

  async generate() {
    await writeFilePrettified(
      "./out/type.ts",
      [
        toEnum("ByteOrder", { LE: "LE", BE: "BE" }),
        CodeGenerator.encodeEnums(this.parsed),
      ].join("\n"),
    );
    await writeFilePrettified(
      "./out/constants.ts",
      [
        (await fs.promises.readFile("./codegen/types.include.ts")).toString(),
        toEnum(
          "ComposeType",
          Object.fromEntries(
            CodeGenerator.COMPOSE_TYPES.map((type) => [type, type]),
          ),
        ),
        this.encodeStructDefs(),
        this.encodeRequestDefs(),
      ].join("\n"),
    );
  }
}
