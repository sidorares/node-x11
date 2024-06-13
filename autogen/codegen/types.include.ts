export enum NumberType {
  Int8 = "Int8",
  UInt8 = "UInt8",
  Int16 = "Int16",
  UInt16 = "UInt16",
  Int32 = "Int32",
  UInt32 = "UInt32",
}

export namespace Definitions {
  export type SimpleField = {
    type: string;
    name: string;
    enum?: string;
    mask?: string;
    altenum?: string;
    expression?: string;
  };

  export type NumberField = SimpleField & {
    type: NumberType;
  };

  export type Pad =
    | {
        bytes: number;
        align?: undefined;
      }
    | {
        align: number;
        bytes?: undefined;
      };

  export type List =
    | {
        type: "List";
        itemType: string;
        fieldref: string;
        name: string;
      }
    | { type: "List"; itemType: string; length: number; name: string };

  export type Field = NumberField | SimpleField | Pad | List;
}

export function isPadField(input: Definitions.Field): input is Definitions.Pad {
  return !("name" in input);
}
export function isListField(
  input: Definitions.Field,
): input is Definitions.List {
  return "type" in input && input.type === "List";
}
export function isNumberField(
  input: Definitions.Field,
): input is Definitions.NumberField {
  return "type" in input && input.type in NumberType;
}
