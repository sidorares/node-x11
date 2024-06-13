import { ParseResult } from "./types";
import { promises as fs } from "fs";
import { Element, xml2js } from "xml-js";
import { sift } from "../util";
// @ts-ignore
import camelCase from "lodash.camelcase";
// @ts-ignore
import partition from "lodash.partition";

interface ProcessedElement extends Element {
  name: string;
  attributes: Record<string, string>;
  elements: ProcessedElement[];
}

const EMPTY_OBJ = {};
const EMPTY_ARR: ProcessedElement[] = [];

function processParseResult(json: Element, path = ""): ProcessedElement {
  if (!json.name) {
    json.name = "text";
    if (path.endsWith("fieldref")) {
      json.text = camelCase(json.text);
    }
  }
  if (!json.attributes) {
    json.attributes = EMPTY_OBJ;
  } else {
    if (
      json.attributes.name?.toString().includes("_") &&
      json.name === "field"
    ) {
      json.attributes.name = camelCase(json.attributes.name);
    }
  }
  if (!json.elements) {
    json.elements = EMPTY_ARR;
  } else {
    json.elements.forEach((child) =>
      processParseResult(child, path + json.name),
    );
  }
  return json as ProcessedElement;
}

export async function parse(filePath: string) {
  const fileContent = (await fs.readFile(filePath)).toString();
  const json = processParseResult(
    xml2js(fileContent, {
      compact: false,
      ignoreComment: true,
      ignoreDeclaration: true,
      nativeType: true,
    }) as Element,
  );
  json.name = "root";
  const re = parseEl(json);
  return re as ParseResult.Results;
}

function group(
  input: any[],
  getKey: (item: any) => string,
  getVal: (item: any) => any,
): Record<string, any[]> {
  return input.reduce((acc: Record<string, any>, cur: any) => {
    const key = `${getKey(cur)}s`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(getVal(cur));
    return acc;
  }, {});
}

function parseEl(el: ProcessedElement): any {
  switch (el.name) {
    case "root":
      return parseEl(el.elements[0]);
    case "xcb":
      return {
        ...el.attributes,
        ...group(
          sift(
            el.elements.map((el) => {
              const parsed = parseEl(el);
              return parsed && [el.name, parsed];
            }),
          ),
          (item: any) => item[0],
          (item) => item[1],
        ),
      };
    case "struct":
    case "reply":
    case "event":
    case "error":
    case "enum":
      return {
        ...el.attributes,
        fields: sift(el.elements.map(parseEl)),
      };
    case "request":
      const [[replyEl], otherEls] = partition(
        el.elements,
        ({ name }: ProcessedElement) => name === "reply",
      );
      return {
        ...el.attributes,
        fields: sift(otherEls.map(parseEl)),
        reply: replyEl && parseEl(replyEl),
      };
    case "item":
      return el.elements.length > 0
        ? {
            ...el.attributes,
            [el.elements[0].name]: parseEl(el.elements[0]),
          }
        : el.attributes;

    case "xidunion":
      return {
        name: el.attributes.name,
        types: el.elements.map(parseEl),
      };
    case "list":
      const list: Record<string, any> = {
        name: el.attributes.name,
        itemType: el.attributes.type,
        type: "List",
      };
      if (el.elements.length) {
        const key = el.elements[0].name === "value" ? "length" : "fieldref";
        list[key] = parseEl(el.elements[0]);
      } else {
        list.fieldref = "//todo";
      }
      return list;

    // leaf nodes
    case "pad":
    case "field":
    case "xidtype":
    case "typedef":
    case "errorcopy":
    case "eventcopy":
      return el.attributes;
    case "fieldref":
    case "type":
    case "value":
    case "bit":
    case "":
      return el.elements[0]?.text;
    case "doc":
      return undefined;
    default:
      console.warn(`tag: ${el.name} is not parsed`);
      return undefined;
  }
}
