import { Definitions } from "../codegen/types.include";

export namespace ParseResult {
  export type Struct = {
    name: string;
    fields: Definitions.Field[];
  };

  export type Event = Struct & { number: number };
  export type Error = Event;

  export type Copy = {
    name: string;
    ref: string;
    number: string;
  };

  export type Enum = {
    name: string;
    fields: {
      name: string;
      bit?: number;
      value?: number;
    }[];
  };

  export type Xidtype = {
    name: string;
  };

  export type Xidunion = {
    name: string;
    types: string[];
  };

  export type Typedef = {
    oldname: string;
    newname: string;
  };

  export type Request = Struct & {
    opcode: number;
    reply?: Struct;
  };

  export type Results = {
    structs: ParseResult.Struct[];
    events: ParseResult.Event[];
    errors: ParseResult.Error[];
    eventCopies: ParseResult.Copy[];
    errorCopies: ParseResult.Copy[];
    enums: ParseResult.Enum[];
    xidtypes: ParseResult.Xidtype[];
    xidunions: ParseResult.Xidunion[];
    typedefs: ParseResult.Typedef[];
    requests: Request[];
  };
}
