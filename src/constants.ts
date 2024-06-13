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

export enum ComposeType {
  List = "List",
  ValueMap = "ValueMap",
}
const CHAR2B: Definitions.Field[] = [
  { type: NumberType.UInt8, name: "byte1" },
  { type: NumberType.UInt8, name: "byte2" },
];
const POINT: Definitions.Field[] = [
  { type: NumberType.Int16, name: "x" },
  { type: NumberType.Int16, name: "y" },
];
const RECTANGLE: Definitions.Field[] = [
  { type: NumberType.Int16, name: "x" },
  { type: NumberType.Int16, name: "y" },
  { type: NumberType.UInt16, name: "width" },
  { type: NumberType.UInt16, name: "height" },
];
const ARC: Definitions.Field[] = [
  { type: NumberType.Int16, name: "x" },
  { type: NumberType.Int16, name: "y" },
  { type: NumberType.UInt16, name: "width" },
  { type: NumberType.UInt16, name: "height" },
  { type: NumberType.Int16, name: "angle1" },
  { type: NumberType.Int16, name: "angle2" },
];
const FORMAT: Definitions.Field[] = [
  { type: NumberType.UInt8, name: "depth" },
  { type: NumberType.UInt8, name: "bitsPerPixel" },
  { type: NumberType.UInt8, name: "scanlinePad" },
  { bytes: 5 },
];
const VISUALTYPE: Definitions.Field[] = [
  { type: NumberType.UInt32, name: "visualId" },
  { type: NumberType.UInt8, name: "class", enum: "VisualClass" },
  { type: NumberType.UInt8, name: "bitsPerRgbValue" },
  { type: NumberType.UInt16, name: "colormapEntries" },
  { type: NumberType.UInt32, name: "redMask" },
  { type: NumberType.UInt32, name: "greenMask" },
  { type: NumberType.UInt32, name: "blueMask" },
  { bytes: 4 },
];
const DEPTH: Definitions.Field[] = [
  { type: NumberType.UInt8, name: "depth" },
  { bytes: 1 },
  { type: NumberType.UInt16, name: "visualsLen" },
  { bytes: 4 },
  {
    name: "visuals",
    itemType: "VISUALTYPE",
    type: ComposeType.List,
    fieldref: "visualsLen",
  },
];
const SCREEN: Definitions.Field[] = [
  { type: NumberType.UInt32, name: "root" },
  { type: NumberType.UInt32, name: "defaultColormap" },
  { type: NumberType.UInt32, name: "whitePixel" },
  { type: NumberType.UInt32, name: "blackPixel" },
  { type: NumberType.UInt32, name: "currentInputMasks", mask: "EventMask" },
  { type: NumberType.UInt16, name: "widthInPixels" },
  { type: NumberType.UInt16, name: "heightInPixels" },
  { type: NumberType.UInt16, name: "widthInMillimeters" },
  { type: NumberType.UInt16, name: "heightInMillimeters" },
  { type: NumberType.UInt16, name: "minInstalledMaps" },
  { type: NumberType.UInt16, name: "maxInstalledMaps" },
  { type: NumberType.UInt32, name: "rootVisual" },
  { type: NumberType.Int8, name: "backingStores", enum: "BackingStore" },
  { type: NumberType.UInt8, name: "saveUnders" },
  { type: NumberType.UInt8, name: "rootDepth" },
  { type: NumberType.UInt8, name: "allowedDepthsLen" },
  {
    name: "allowed_depths",
    itemType: "DEPTH",
    type: ComposeType.List,
    fieldref: "allowedDepthsLen",
  },
];
const SetupRequest: Definitions.Field[] = [
  { type: NumberType.UInt8, name: "byteOrder" },
  { bytes: 1 },
  { type: NumberType.UInt16, name: "protocolMajorVersion" },
  { type: NumberType.UInt16, name: "protocolMinorVersion" },
  { type: NumberType.UInt16, name: "authorizationProtocolNameLen" },
  { type: NumberType.UInt16, name: "authorizationProtocolDataLen" },
  { bytes: 2 },
  {
    name: "authorization_protocol_name",
    itemType: "char",
    type: ComposeType.List,
    fieldref: "authorizationProtocolNameLen",
  },
  {
    name: "authorization_protocol_data",
    itemType: "char",
    type: ComposeType.List,
    fieldref: "authorizationProtocolDataLen",
  },
];
const SetupFailed: Definitions.Field[] = [
  { type: NumberType.UInt8, name: "status" },
  { type: NumberType.UInt8, name: "reasonLen" },
  { type: NumberType.UInt16, name: "protocolMajorVersion" },
  { type: NumberType.UInt16, name: "protocolMinorVersion" },
  { type: NumberType.UInt16, name: "length" },
  {
    name: "reason",
    itemType: "char",
    type: ComposeType.List,
    fieldref: "reasonLen",
  },
];
const SetupAuthenticate: Definitions.Field[] = [
  { type: NumberType.UInt8, name: "status" },
  { bytes: 5 },
  { type: NumberType.UInt16, name: "length" },
  {
    name: "reason",
    itemType: "char",
    type: ComposeType.List,
    fieldref: undefined,
  },
];
const Setup: Definitions.Field[] = [
  { type: NumberType.UInt8, name: "status" },
  { bytes: 1 },
  { type: NumberType.UInt16, name: "protocolMajorVersion" },
  { type: NumberType.UInt16, name: "protocolMinorVersion" },
  { type: NumberType.UInt16, name: "length" },
  { type: NumberType.UInt32, name: "releaseNumber" },
  { type: NumberType.UInt32, name: "resourceIdBase" },
  { type: NumberType.UInt32, name: "resourceIdMask" },
  { type: NumberType.UInt32, name: "motionBufferSize" },
  { type: NumberType.UInt16, name: "vendorLen" },
  { type: NumberType.UInt16, name: "maximumRequestLength" },
  { type: NumberType.UInt8, name: "rootsLen" },
  { type: NumberType.UInt8, name: "pixmapFormatsLen" },
  { type: NumberType.UInt8, name: "imageByteOrder", enum: "ImageOrder" },
  { type: NumberType.UInt8, name: "bitmapFormatBitOrder", enum: "ImageOrder" },
  { type: NumberType.UInt8, name: "bitmapFormatScanlineUnit" },
  { type: NumberType.UInt8, name: "bitmapFormatScanlinePad" },
  { type: NumberType.UInt8, name: "minKeycode" },
  { type: NumberType.UInt8, name: "maxKeycode" },
  { bytes: 4 },
  {
    name: "vendor",
    itemType: "char",
    type: ComposeType.List,
    fieldref: "vendorLen",
  },
  {
    name: "pixmap_formats",
    itemType: "FORMAT",
    type: ComposeType.List,
    fieldref: "pixmapFormatsLen",
  },
  {
    name: "roots",
    itemType: "SCREEN",
    type: ComposeType.List,
    fieldref: "rootsLen",
  },
];
const TIMECOORD: Definitions.Field[] = [
  { type: NumberType.UInt32, name: "time" },
  { type: NumberType.Int16, name: "x" },
  { type: NumberType.Int16, name: "y" },
];
const FONTPROP: Definitions.Field[] = [
  { type: NumberType.UInt32, name: "name" },
  { type: NumberType.UInt32, name: "value" },
];
const CHARINFO: Definitions.Field[] = [
  { type: NumberType.Int16, name: "leftSideBearing" },
  { type: NumberType.Int16, name: "rightSideBearing" },
  { type: NumberType.Int16, name: "characterWidth" },
  { type: NumberType.Int16, name: "ascent" },
  { type: NumberType.Int16, name: "descent" },
  { type: NumberType.UInt16, name: "attributes" },
];
const STR: Definitions.Field[] = [
  { type: NumberType.UInt8, name: "nameLen" },
  {
    name: "name",
    itemType: "char",
    type: ComposeType.List,
    fieldref: "nameLen",
  },
];
const SEGMENT: Definitions.Field[] = [
  { type: NumberType.Int16, name: "x1" },
  { type: NumberType.Int16, name: "y1" },
  { type: NumberType.Int16, name: "x2" },
  { type: NumberType.Int16, name: "y2" },
];
const COLORITEM: Definitions.Field[] = [
  { type: NumberType.UInt32, name: "pixel" },
  { type: NumberType.UInt16, name: "red" },
  { type: NumberType.UInt16, name: "green" },
  { type: NumberType.UInt16, name: "blue" },
  { type: NumberType.Int8, name: "flags", mask: "ColorFlag" },
  { bytes: 1 },
];
const RGB: Definitions.Field[] = [
  { type: NumberType.UInt16, name: "red" },
  { type: NumberType.UInt16, name: "green" },
  { type: NumberType.UInt16, name: "blue" },
  { bytes: 2 },
];
const HOST: Definitions.Field[] = [
  { type: NumberType.UInt8, name: "family", enum: "Family" },
  { bytes: 1 },
  { type: NumberType.UInt16, name: "addressLen" },
  {
    name: "address",
    itemType: "BYTE",
    type: ComposeType.List,
    fieldref: "addressLen",
  },
];
export const structs: Record<string, Definitions.Field[]> = {
  CHAR2B,
  POINT,
  RECTANGLE,
  ARC,
  FORMAT,
  VISUALTYPE,
  DEPTH,
  SCREEN,
  SetupRequest,
  SetupFailed,
  SetupAuthenticate,
  Setup,
  TIMECOORD,
  FONTPROP,
  CHARINFO,
  STR,
  SEGMENT,
  COLORITEM,
  RGB,
  HOST,
};
export const requestNameToOpcodeMapping = {
  CreateWindow: 1,
  ChangeWindowAttributes: 2,
  GetWindowAttributes: 3,
  DestroyWindow: 4,
  DestroySubwindows: 5,
  ChangeSaveSet: 6,
  ReparentWindow: 7,
  MapWindow: 8,
  MapSubwindows: 9,
  UnmapWindow: 10,
  UnmapSubwindows: 11,
  ConfigureWindow: 12,
  CirculateWindow: 13,
  GetGeometry: 14,
  QueryTree: 15,
  InternAtom: 16,
  GetAtomName: 17,
  ChangeProperty: 18,
  DeleteProperty: 19,
  GetProperty: 20,
  ListProperties: 21,
  SetSelectionOwner: 22,
  GetSelectionOwner: 23,
  ConvertSelection: 24,
  SendEvent: 25,
  GrabPointer: 26,
  UngrabPointer: 27,
  GrabButton: 28,
  UngrabButton: 29,
  ChangeActivePointerGrab: 30,
  GrabKeyboard: 31,
  UngrabKeyboard: 32,
  GrabKey: 33,
  UngrabKey: 34,
  AllowEvents: 35,
  GrabServer: 36,
  UngrabServer: 37,
  QueryPointer: 38,
  GetMotionEvents: 39,
  TranslateCoordinates: 40,
  WarpPointer: 41,
  SetInputFocus: 42,
  GetInputFocus: 43,
  QueryKeymap: 44,
  OpenFont: 45,
  CloseFont: 46,
  QueryFont: 47,
  QueryTextExtents: 48,
  ListFonts: 49,
  ListFontsWithInfo: 50,
  SetFontPath: 51,
  GetFontPath: 52,
  CreatePixmap: 53,
  FreePixmap: 54,
  CreateGC: 55,
  ChangeGC: 56,
  CopyGC: 57,
  SetDashes: 58,
  SetClipRectangles: 59,
  FreeGC: 60,
  ClearArea: 61,
  CopyArea: 62,
  CopyPlane: 63,
  PolyPoint: 64,
  PolyLine: 65,
  PolySegment: 66,
  PolyRectangle: 67,
  PolyArc: 68,
  FillPoly: 69,
  PolyFillRectangle: 70,
  PolyFillArc: 71,
  PutImage: 72,
  GetImage: 73,
  PolyText8: 74,
  PolyText16: 75,
  ImageText8: 76,
  ImageText16: 77,
  CreateColormap: 78,
  FreeColormap: 79,
  CopyColormapAndFree: 80,
  InstallColormap: 81,
  UninstallColormap: 82,
  ListInstalledColormaps: 83,
  AllocColor: 84,
  AllocNamedColor: 85,
  AllocColorCells: 86,
  AllocColorPlanes: 87,
  FreeColors: 88,
  StoreColors: 89,
  StoreNamedColor: 90,
  QueryColors: 91,
  LookupColor: 92,
  CreateCursor: 93,
  CreateGlyphCursor: 94,
  FreeCursor: 95,
  RecolorCursor: 96,
  QueryBestSize: 97,
  QueryExtension: 98,
  ListExtensions: 99,
  ChangeKeyboardMapping: 100,
  GetKeyboardMapping: 101,
  ChangeKeyboardControl: 102,
  GetKeyboardControl: 103,
  Bell: 104,
  ChangePointerControl: 105,
  GetPointerControl: 106,
  SetScreenSaver: 107,
  GetScreenSaver: 108,
  ChangeHosts: 109,
  ListHosts: 110,
  SetAccessControl: 111,
  SetCloseDownMode: 112,
  KillClient: 113,
  RotateProperties: 114,
  ForceScreenSaver: 115,
  SetPointerMapping: 116,
  GetPointerMapping: 117,
  SetModifierMapping: 118,
  GetModifierMapping: 119,
  NoOperation: 127,
};
export const requestOpcodeToNameMapping = Object.fromEntries(
  Object.entries(requestNameToOpcodeMapping).map(
    ([key, value]: [string, number]) => [value, key],
  ),
);
const CreateWindow: Definitions.Field[] = [
  { type: NumberType.UInt8, name: "depth" },
  { type: NumberType.UInt32, name: "wid" },
  { type: NumberType.UInt32, name: "parent" },
  { type: NumberType.Int16, name: "x" },
  { type: NumberType.Int16, name: "y" },
  { type: NumberType.UInt16, name: "width" },
  { type: NumberType.UInt16, name: "height" },
  { type: NumberType.UInt16, name: "borderWidth" },
  { type: NumberType.UInt16, name: "class", enum: "WindowClass" },
  { type: NumberType.UInt32, name: "visual" },
];
const ChangeWindowAttributes: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "window" },
];
const GetWindowAttributes: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "window" },
];
const DestroyWindow: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "window" },
];
const DestroySubwindows: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "window" },
];
const ChangeSaveSet: Definitions.Field[] = [
  { type: NumberType.Int8, name: "mode", enum: "SetMode" },
  { type: NumberType.UInt32, name: "window" },
];
const ReparentWindow: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "window" },
  { type: NumberType.UInt32, name: "parent" },
  { type: NumberType.Int16, name: "x" },
  { type: NumberType.Int16, name: "y" },
];
const MapWindow: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "window" },
];
const MapSubwindows: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "window" },
];
const UnmapWindow: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "window" },
];
const UnmapSubwindows: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "window" },
];
const ConfigureWindow: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "window" },
  { type: NumberType.UInt16, name: "valueMask" },
  { bytes: 2 },
];
const CirculateWindow: Definitions.Field[] = [
  { type: NumberType.UInt8, name: "direction", enum: "Circulate" },
  { type: NumberType.UInt32, name: "window" },
];
const GetGeometry: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "drawable" },
];
const QueryTree: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "window" },
];
const InternAtom: Definitions.Field[] = [
  { type: NumberType.UInt8, name: "onlyIfExists" },
  { type: NumberType.UInt16, name: "nameLen", expression: "args.name.length" },
  { bytes: 2 },
  { type: "STRING8", name: "name" },
];
const GetAtomName: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "atom" },
];
const ChangeProperty: Definitions.Field[] = [
  { type: NumberType.UInt8, name: "mode", enum: "PropMode" },
  { type: NumberType.UInt32, name: "window" },
  { type: NumberType.UInt32, name: "property" },
  { type: NumberType.UInt32, name: "type" },
  { type: NumberType.UInt8, name: "format" },
  { bytes: 3 },
  { type: NumberType.UInt32, name: "dataLen" },
  {
    name: "data",
    itemType: "void",
    type: ComposeType.List,
    fieldref: undefined,
  },
];
const DeleteProperty: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "window" },
  { type: NumberType.UInt32, name: "property" },
];
const GetProperty: Definitions.Field[] = [
  { type: NumberType.UInt8, name: "delete" },
  { type: NumberType.UInt32, name: "window" },
  { type: NumberType.UInt32, name: "property" },
  { type: NumberType.UInt32, name: "type", altenum: "GetPropertyType" },
  { type: NumberType.UInt32, name: "longOffset" },
  { type: NumberType.UInt32, name: "longLength" },
];
const ListProperties: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "window" },
];
const SetSelectionOwner: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "owner", altenum: "Window" },
  { type: NumberType.UInt32, name: "selection" },
  { type: NumberType.UInt32, name: "time", altenum: "Time" },
];
const GetSelectionOwner: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "selection" },
];
const ConvertSelection: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "requestor" },
  { type: NumberType.UInt32, name: "selection" },
  { type: NumberType.UInt32, name: "target" },
  { type: NumberType.UInt32, name: "property", altenum: "Atom" },
  { type: NumberType.UInt32, name: "time", altenum: "Time" },
];
const SendEvent: Definitions.Field[] = [
  { type: NumberType.UInt8, name: "propagate" },
  { type: NumberType.UInt32, name: "destination", altenum: "SendEventDest" },
  { type: NumberType.UInt32, name: "eventMask", mask: "EventMask" },
  { name: "event", itemType: "char", type: ComposeType.List, length: 32 },
];
const GrabPointer: Definitions.Field[] = [
  { type: NumberType.UInt8, name: "ownerEvents" },
  { type: NumberType.UInt32, name: "grabWindow" },
  { type: NumberType.UInt16, name: "eventMask", mask: "EventMask" },
  { type: NumberType.Int8, name: "pointerMode", enum: "GrabMode" },
  { type: NumberType.Int8, name: "keyboardMode", enum: "GrabMode" },
  { type: NumberType.UInt32, name: "confineTo", altenum: "Window" },
  { type: NumberType.UInt32, name: "cursor", altenum: "Cursor" },
  { type: NumberType.UInt32, name: "time", altenum: "Time" },
];
const UngrabPointer: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "time", altenum: "Time" },
];
const GrabButton: Definitions.Field[] = [
  { type: NumberType.UInt8, name: "ownerEvents" },
  { type: NumberType.UInt32, name: "grabWindow" },
  { type: NumberType.UInt16, name: "eventMask", mask: "EventMask" },
  { type: NumberType.UInt8, name: "pointerMode", enum: "GrabMode" },
  { type: NumberType.UInt8, name: "keyboardMode", enum: "GrabMode" },
  { type: NumberType.UInt32, name: "confineTo", altenum: "Window" },
  { type: NumberType.UInt32, name: "cursor", altenum: "Cursor" },
  { type: NumberType.UInt8, name: "button", enum: "ButtonIndex" },
  { bytes: 1 },
  { type: NumberType.UInt16, name: "modifiers", mask: "ModMask" },
];
const UngrabButton: Definitions.Field[] = [
  { type: NumberType.UInt8, name: "button", enum: "ButtonIndex" },
  { type: NumberType.UInt32, name: "grabWindow" },
  { type: NumberType.UInt16, name: "modifiers", mask: "ModMask" },
  { bytes: 2 },
];
const ChangeActivePointerGrab: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "cursor", altenum: "Cursor" },
  { type: NumberType.UInt32, name: "time", altenum: "Time" },
  { type: NumberType.UInt16, name: "eventMask", mask: "EventMask" },
  { bytes: 2 },
];
const GrabKeyboard: Definitions.Field[] = [
  { type: NumberType.UInt8, name: "ownerEvents" },
  { type: NumberType.UInt32, name: "grabWindow" },
  { type: NumberType.UInt32, name: "time", altenum: "Time" },
  { type: NumberType.Int8, name: "pointerMode", enum: "GrabMode" },
  { type: NumberType.Int8, name: "keyboardMode", enum: "GrabMode" },
  { bytes: 2 },
];
const UngrabKeyboard: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "time", altenum: "Time" },
];
const GrabKey: Definitions.Field[] = [
  { type: NumberType.UInt8, name: "ownerEvents" },
  { type: NumberType.UInt32, name: "grabWindow" },
  { type: NumberType.UInt16, name: "modifiers", mask: "ModMask" },
  { type: NumberType.UInt8, name: "key", altenum: "Grab" },
  { type: NumberType.UInt8, name: "pointerMode", enum: "GrabMode" },
  { type: NumberType.UInt8, name: "keyboardMode", enum: "GrabMode" },
  { bytes: 3 },
];
const UngrabKey: Definitions.Field[] = [
  { type: NumberType.UInt8, name: "key", altenum: "Grab" },
  { type: NumberType.UInt32, name: "grabWindow" },
  { type: NumberType.UInt16, name: "modifiers", mask: "ModMask" },
  { bytes: 2 },
];
const AllowEvents: Definitions.Field[] = [
  { type: NumberType.UInt8, name: "mode", enum: "Allow" },
  { type: NumberType.UInt32, name: "time", altenum: "Time" },
];
const GrabServer: Definitions.Field[] = [];
const UngrabServer: Definitions.Field[] = [];
const QueryPointer: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "window" },
];
const GetMotionEvents: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "window" },
  { type: NumberType.UInt32, name: "start", altenum: "Time" },
  { type: NumberType.UInt32, name: "stop", altenum: "Time" },
];
const TranslateCoordinates: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "srcWindow" },
  { type: NumberType.UInt32, name: "dstWindow" },
  { type: NumberType.Int16, name: "srcX" },
  { type: NumberType.Int16, name: "srcY" },
];
const WarpPointer: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "srcWindow", altenum: "Window" },
  { type: NumberType.UInt32, name: "dstWindow", altenum: "Window" },
  { type: NumberType.Int16, name: "srcX" },
  { type: NumberType.Int16, name: "srcY" },
  { type: NumberType.UInt16, name: "srcWidth" },
  { type: NumberType.UInt16, name: "srcHeight" },
  { type: NumberType.Int16, name: "dstX" },
  { type: NumberType.Int16, name: "dstY" },
];
const SetInputFocus: Definitions.Field[] = [
  { type: NumberType.UInt8, name: "revertTo", enum: "InputFocus" },
  { type: NumberType.UInt32, name: "focus", altenum: "InputFocus" },
  { type: NumberType.UInt32, name: "time", altenum: "Time" },
];
const GetInputFocus: Definitions.Field[] = [];
const QueryKeymap: Definitions.Field[] = [];
const OpenFont: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "fid" },
  { type: NumberType.UInt16, name: "nameLen" },
  { bytes: 2 },
  {
    name: "name",
    itemType: "char",
    type: ComposeType.List,
    fieldref: "nameLen",
  },
];
const CloseFont: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "font" },
];
const QueryFont: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "font" },
];
const QueryTextExtents: Definitions.Field[] = [
  { type: NumberType.UInt32, name: "font" },
  {
    name: "string",
    itemType: "CHAR2B",
    type: ComposeType.List,
    fieldref: "//todo",
  },
];
const ListFonts: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt16, name: "maxNames" },
  { type: NumberType.UInt16, name: "patternLen" },
  {
    name: "pattern",
    itemType: "char",
    type: ComposeType.List,
    fieldref: "patternLen",
  },
];
const ListFontsWithInfo: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt16, name: "maxNames" },
  { type: NumberType.UInt16, name: "patternLen" },
  {
    name: "pattern",
    itemType: "char",
    type: ComposeType.List,
    fieldref: "patternLen",
  },
];
const SetFontPath: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt16, name: "fontQty" },
  { bytes: 2 },
  {
    name: "font",
    itemType: "STR",
    type: ComposeType.List,
    fieldref: "fontQty",
  },
];
const GetFontPath: Definitions.Field[] = [];
const CreatePixmap: Definitions.Field[] = [
  { type: NumberType.UInt8, name: "depth" },
  { type: NumberType.UInt32, name: "pid" },
  { type: NumberType.UInt32, name: "drawable" },
  { type: NumberType.UInt16, name: "width" },
  { type: NumberType.UInt16, name: "height" },
];
const FreePixmap: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "pixmap" },
];
const CreateGC: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "cid" },
  { type: NumberType.UInt32, name: "drawable" },
];
const ChangeGC: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "gc" },
];
const CopyGC: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "srcGc" },
  { type: NumberType.UInt32, name: "dstGc" },
  { type: NumberType.UInt32, name: "valueMask", mask: "GC" },
];
const SetDashes: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "gc" },
  { type: NumberType.UInt16, name: "dashOffset" },
  { type: NumberType.UInt16, name: "dashesLen" },
  {
    name: "dashes",
    itemType: "CARD8",
    type: ComposeType.List,
    fieldref: "dashesLen",
  },
];
const SetClipRectangles: Definitions.Field[] = [
  { type: NumberType.Int8, name: "ordering", enum: "ClipOrdering" },
  { type: NumberType.UInt32, name: "gc" },
  { type: NumberType.Int16, name: "clipXOrigin" },
  { type: NumberType.Int16, name: "clipYOrigin" },
  {
    name: "rectangles",
    itemType: "RECTANGLE",
    type: ComposeType.List,
    fieldref: "//todo",
  },
];
const FreeGC: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "gc" },
];
const ClearArea: Definitions.Field[] = [
  { type: NumberType.UInt8, name: "exposures" },
  { type: NumberType.UInt32, name: "window" },
  { type: NumberType.Int16, name: "x" },
  { type: NumberType.Int16, name: "y" },
  { type: NumberType.UInt16, name: "width" },
  { type: NumberType.UInt16, name: "height" },
];
const CopyArea: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "srcDrawable" },
  { type: NumberType.UInt32, name: "dstDrawable" },
  { type: NumberType.UInt32, name: "gc" },
  { type: NumberType.Int16, name: "srcX" },
  { type: NumberType.Int16, name: "srcY" },
  { type: NumberType.Int16, name: "dstX" },
  { type: NumberType.Int16, name: "dstY" },
  { type: NumberType.UInt16, name: "width" },
  { type: NumberType.UInt16, name: "height" },
];
const CopyPlane: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "srcDrawable" },
  { type: NumberType.UInt32, name: "dstDrawable" },
  { type: NumberType.UInt32, name: "gc" },
  { type: NumberType.Int16, name: "srcX" },
  { type: NumberType.Int16, name: "srcY" },
  { type: NumberType.Int16, name: "dstX" },
  { type: NumberType.Int16, name: "dstY" },
  { type: NumberType.UInt16, name: "width" },
  { type: NumberType.UInt16, name: "height" },
  { type: NumberType.UInt32, name: "bitPlane" },
];
const PolyPoint: Definitions.Field[] = [
  { type: NumberType.Int8, name: "coordinateMode", enum: "CoordMode" },
  { type: NumberType.UInt32, name: "drawable" },
  { type: NumberType.UInt32, name: "gc" },
  {
    name: "points",
    itemType: "POINT",
    type: ComposeType.List,
    fieldref: "//todo",
  },
];
const PolyLine: Definitions.Field[] = [
  { type: NumberType.Int8, name: "coordinateMode", enum: "CoordMode" },
  { type: NumberType.UInt32, name: "drawable" },
  { type: NumberType.UInt32, name: "gc" },
  {
    name: "points",
    itemType: "POINT",
    type: ComposeType.List,
    fieldref: "//todo",
  },
];
const PolySegment: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "drawable" },
  { type: NumberType.UInt32, name: "gc" },
  {
    name: "segments",
    itemType: "SEGMENT",
    type: ComposeType.List,
    fieldref: "//todo",
  },
];
const PolyRectangle: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "drawable" },
  { type: NumberType.UInt32, name: "gc" },
  {
    name: "rectangles",
    itemType: "RECTANGLE",
    type: ComposeType.List,
    fieldref: "//todo",
  },
];
const PolyArc: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "drawable" },
  { type: NumberType.UInt32, name: "gc" },
  { name: "arcs", itemType: "ARC", type: ComposeType.List, fieldref: "//todo" },
];
const FillPoly: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "drawable" },
  { type: NumberType.UInt32, name: "gc" },
  { type: NumberType.UInt8, name: "shape", enum: "PolyShape" },
  { type: NumberType.UInt8, name: "coordinateMode", enum: "CoordMode" },
  { bytes: 2 },
  {
    name: "points",
    itemType: "POINT",
    type: ComposeType.List,
    fieldref: "//todo",
  },
];
const PolyFillRectangle: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "drawable" },
  { type: NumberType.UInt32, name: "gc" },
  {
    name: "rectangles",
    itemType: "RECTANGLE",
    type: ComposeType.List,
    fieldref: "//todo",
  },
];
const PolyFillArc: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "drawable" },
  { type: NumberType.UInt32, name: "gc" },
  { name: "arcs", itemType: "ARC", type: ComposeType.List, fieldref: "//todo" },
];
const PutImage: Definitions.Field[] = [
  { type: NumberType.UInt8, name: "format", enum: "ImageFormat" },
  { type: NumberType.UInt32, name: "drawable" },
  { type: NumberType.UInt32, name: "gc" },
  { type: NumberType.UInt16, name: "width" },
  { type: NumberType.UInt16, name: "height" },
  { type: NumberType.Int16, name: "dstX" },
  { type: NumberType.Int16, name: "dstY" },
  { type: NumberType.UInt8, name: "leftPad" },
  { type: NumberType.UInt8, name: "depth" },
  { bytes: 2 },
  {
    name: "data",
    itemType: "BYTE",
    type: ComposeType.List,
    fieldref: "//todo",
  },
];
const GetImage: Definitions.Field[] = [
  { type: NumberType.UInt8, name: "format", enum: "ImageFormat" },
  { type: NumberType.UInt32, name: "drawable" },
  { type: NumberType.Int16, name: "x" },
  { type: NumberType.Int16, name: "y" },
  { type: NumberType.UInt16, name: "width" },
  { type: NumberType.UInt16, name: "height" },
  { type: NumberType.UInt32, name: "planeMask" },
];
const PolyText8: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "drawable" },
  { type: NumberType.UInt32, name: "gc" },
  { type: NumberType.Int16, name: "x" },
  { type: NumberType.Int16, name: "y" },
  {
    name: "items",
    itemType: "BYTE",
    type: ComposeType.List,
    fieldref: "//todo",
  },
];
const PolyText16: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "drawable" },
  { type: NumberType.UInt32, name: "gc" },
  { type: NumberType.Int16, name: "x" },
  { type: NumberType.Int16, name: "y" },
  {
    name: "items",
    itemType: "BYTE",
    type: ComposeType.List,
    fieldref: "//todo",
  },
];
const ImageText8: Definitions.Field[] = [
  { type: NumberType.Int8, name: "stringLen" },
  { type: NumberType.UInt32, name: "drawable" },
  { type: NumberType.UInt32, name: "gc" },
  { type: NumberType.Int16, name: "x" },
  { type: NumberType.Int16, name: "y" },
  {
    name: "string",
    itemType: "char",
    type: ComposeType.List,
    fieldref: "stringLen",
  },
];
const ImageText16: Definitions.Field[] = [
  { type: NumberType.Int8, name: "stringLen" },
  { type: NumberType.UInt32, name: "drawable" },
  { type: NumberType.UInt32, name: "gc" },
  { type: NumberType.Int16, name: "x" },
  { type: NumberType.Int16, name: "y" },
  {
    name: "string",
    itemType: "CHAR2B",
    type: ComposeType.List,
    fieldref: "stringLen",
  },
];
const CreateColormap: Definitions.Field[] = [
  { type: NumberType.Int8, name: "alloc", enum: "ColormapAlloc" },
  { type: NumberType.UInt32, name: "mid" },
  { type: NumberType.UInt32, name: "window" },
  { type: NumberType.UInt32, name: "visual" },
];
const FreeColormap: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "cmap" },
];
const CopyColormapAndFree: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "mid" },
  { type: NumberType.UInt32, name: "srcCmap" },
];
const InstallColormap: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "cmap" },
];
const UninstallColormap: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "cmap" },
];
const ListInstalledColormaps: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "window" },
];
const AllocColor: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "cmap" },
  { type: NumberType.UInt16, name: "red" },
  { type: NumberType.UInt16, name: "green" },
  { type: NumberType.UInt16, name: "blue" },
  { bytes: 2 },
];
const AllocNamedColor: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "cmap" },
  { type: NumberType.UInt16, name: "nameLen" },
  { bytes: 2 },
  {
    name: "name",
    itemType: "char",
    type: ComposeType.List,
    fieldref: "nameLen",
  },
];
const AllocColorCells: Definitions.Field[] = [
  { type: NumberType.UInt8, name: "contiguous" },
  { type: NumberType.UInt32, name: "cmap" },
  { type: NumberType.UInt16, name: "colors" },
  { type: NumberType.UInt16, name: "planes" },
];
const AllocColorPlanes: Definitions.Field[] = [
  { type: NumberType.UInt8, name: "contiguous" },
  { type: NumberType.UInt32, name: "cmap" },
  { type: NumberType.UInt16, name: "colors" },
  { type: NumberType.UInt16, name: "reds" },
  { type: NumberType.UInt16, name: "greens" },
  { type: NumberType.UInt16, name: "blues" },
];
const FreeColors: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "cmap" },
  { type: NumberType.UInt32, name: "planeMask" },
  {
    name: "pixels",
    itemType: "CARD32",
    type: ComposeType.List,
    fieldref: "//todo",
  },
];
const StoreColors: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "cmap" },
  {
    name: "items",
    itemType: "COLORITEM",
    type: ComposeType.List,
    fieldref: "//todo",
  },
];
const StoreNamedColor: Definitions.Field[] = [
  { type: NumberType.UInt8, name: "flags", mask: "ColorFlag" },
  { type: NumberType.UInt32, name: "cmap" },
  { type: NumberType.UInt32, name: "pixel" },
  { type: NumberType.UInt16, name: "nameLen" },
  { bytes: 2 },
  {
    name: "name",
    itemType: "char",
    type: ComposeType.List,
    fieldref: "nameLen",
  },
];
const QueryColors: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "cmap" },
  {
    name: "pixels",
    itemType: "CARD32",
    type: ComposeType.List,
    fieldref: "//todo",
  },
];
const LookupColor: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "cmap" },
  { type: NumberType.UInt16, name: "nameLen" },
  { bytes: 2 },
  {
    name: "name",
    itemType: "char",
    type: ComposeType.List,
    fieldref: "nameLen",
  },
];
const CreateCursor: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "cid" },
  { type: NumberType.UInt32, name: "source" },
  { type: NumberType.UInt32, name: "mask", altenum: "Pixmap" },
  { type: NumberType.UInt16, name: "foreRed" },
  { type: NumberType.UInt16, name: "foreGreen" },
  { type: NumberType.UInt16, name: "foreBlue" },
  { type: NumberType.UInt16, name: "backRed" },
  { type: NumberType.UInt16, name: "backGreen" },
  { type: NumberType.UInt16, name: "backBlue" },
  { type: NumberType.UInt16, name: "x" },
  { type: NumberType.UInt16, name: "y" },
];
const CreateGlyphCursor: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "cid" },
  { type: NumberType.UInt32, name: "sourceFont" },
  { type: NumberType.UInt32, name: "maskFont", altenum: "Font" },
  { type: NumberType.UInt16, name: "sourceChar" },
  { type: NumberType.UInt16, name: "maskChar" },
  { type: NumberType.UInt16, name: "foreRed" },
  { type: NumberType.UInt16, name: "foreGreen" },
  { type: NumberType.UInt16, name: "foreBlue" },
  { type: NumberType.UInt16, name: "backRed" },
  { type: NumberType.UInt16, name: "backGreen" },
  { type: NumberType.UInt16, name: "backBlue" },
];
const FreeCursor: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "cursor" },
];
const RecolorCursor: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "cursor" },
  { type: NumberType.UInt16, name: "foreRed" },
  { type: NumberType.UInt16, name: "foreGreen" },
  { type: NumberType.UInt16, name: "foreBlue" },
  { type: NumberType.UInt16, name: "backRed" },
  { type: NumberType.UInt16, name: "backGreen" },
  { type: NumberType.UInt16, name: "backBlue" },
];
const QueryBestSize: Definitions.Field[] = [
  { type: NumberType.UInt8, name: "class", enum: "QueryShapeOf" },
  { type: NumberType.UInt32, name: "drawable" },
  { type: NumberType.UInt16, name: "width" },
  { type: NumberType.UInt16, name: "height" },
];
const QueryExtension: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt16, name: "nameLen" },
  { bytes: 2 },
  {
    name: "name",
    itemType: "char",
    type: ComposeType.List,
    fieldref: "nameLen",
  },
];
const ListExtensions: Definitions.Field[] = [];
const ChangeKeyboardMapping: Definitions.Field[] = [
  { type: NumberType.UInt8, name: "keycodeCount" },
  { type: NumberType.UInt8, name: "firstKeycode" },
  { type: NumberType.UInt8, name: "keysymsPerKeycode" },
  { bytes: 2 },
  {
    name: "keysyms",
    itemType: "KEYSYM",
    type: ComposeType.List,
    fieldref: undefined,
  },
];
const GetKeyboardMapping: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt8, name: "firstKeycode" },
  { type: NumberType.UInt8, name: "count" },
];
const ChangeKeyboardControl: Definitions.Field[] = [{ bytes: 1 }];
const GetKeyboardControl: Definitions.Field[] = [];
const Bell: Definitions.Field[] = [{ type: NumberType.Int8, name: "percent" }];
const ChangePointerControl: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.Int16, name: "accelerationNumerator" },
  { type: NumberType.Int16, name: "accelerationDenominator" },
  { type: NumberType.Int16, name: "threshold" },
  { type: NumberType.UInt8, name: "doAcceleration" },
  { type: NumberType.UInt8, name: "doThreshold" },
];
const GetPointerControl: Definitions.Field[] = [];
const SetScreenSaver: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.Int16, name: "timeout" },
  { type: NumberType.Int16, name: "interval" },
  { type: NumberType.UInt8, name: "preferBlanking", enum: "Blanking" },
  { type: NumberType.UInt8, name: "allowExposures", enum: "Exposures" },
];
const GetScreenSaver: Definitions.Field[] = [];
const ChangeHosts: Definitions.Field[] = [
  { type: NumberType.UInt8, name: "mode", enum: "HostMode" },
  { type: NumberType.UInt8, name: "family", enum: "Family" },
  { bytes: 1 },
  { type: NumberType.UInt16, name: "addressLen" },
  {
    name: "address",
    itemType: "BYTE",
    type: ComposeType.List,
    fieldref: "addressLen",
  },
];
const ListHosts: Definitions.Field[] = [];
const SetAccessControl: Definitions.Field[] = [
  { type: NumberType.UInt8, name: "mode", enum: "AccessControl" },
];
const SetCloseDownMode: Definitions.Field[] = [
  { type: NumberType.UInt8, name: "mode", enum: "CloseDown" },
];
const KillClient: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "resource", altenum: "Kill" },
];
const RotateProperties: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "window" },
  { type: NumberType.UInt16, name: "atomsLen" },
  { type: NumberType.Int16, name: "delta" },
  {
    name: "atoms",
    itemType: "ATOM",
    type: ComposeType.List,
    fieldref: "atomsLen",
  },
];
const ForceScreenSaver: Definitions.Field[] = [
  { type: NumberType.UInt8, name: "mode", enum: "ScreenSaver" },
];
const SetPointerMapping: Definitions.Field[] = [
  { type: NumberType.UInt8, name: "mapLen" },
  {
    name: "map",
    itemType: "CARD8",
    type: ComposeType.List,
    fieldref: "mapLen",
  },
];
const GetPointerMapping: Definitions.Field[] = [];
const SetModifierMapping: Definitions.Field[] = [
  { type: NumberType.UInt8, name: "keycodesPerModifier" },
  {
    name: "keycodes",
    itemType: "KEYCODE",
    type: ComposeType.List,
    fieldref: undefined,
  },
];
const GetModifierMapping: Definitions.Field[] = [];
const NoOperation: Definitions.Field[] = [];
const GetWindowAttributesReply: Definitions.Field[] = [
  { type: NumberType.UInt8, name: "backingStore", enum: "BackingStore" },
  { type: NumberType.UInt32, name: "visual" },
  { type: NumberType.UInt16, name: "class", enum: "WindowClass" },
  { type: NumberType.UInt8, name: "bitGravity", enum: "Gravity" },
  { type: NumberType.UInt8, name: "winGravity", enum: "Gravity" },
  { type: NumberType.UInt32, name: "backingPlanes" },
  { type: NumberType.UInt32, name: "backingPixel" },
  { type: NumberType.UInt8, name: "saveUnder" },
  { type: NumberType.UInt8, name: "mapIsInstalled" },
  { type: NumberType.UInt8, name: "mapState", enum: "MapState" },
  { type: NumberType.UInt8, name: "overrideRedirect" },
  { type: NumberType.UInt32, name: "colormap", altenum: "Colormap" },
  { type: NumberType.UInt32, name: "allEventMasks", mask: "EventMask" },
  { type: NumberType.UInt32, name: "yourEventMask", mask: "EventMask" },
  { type: NumberType.UInt16, name: "doNotPropagateMask", mask: "EventMask" },
  { bytes: 2 },
];
const GetGeometryReply: Definitions.Field[] = [
  { type: NumberType.UInt8, name: "depth" },
  { type: NumberType.UInt32, name: "root" },
  { type: NumberType.Int16, name: "x" },
  { type: NumberType.Int16, name: "y" },
  { type: NumberType.UInt16, name: "width" },
  { type: NumberType.UInt16, name: "height" },
  { type: NumberType.UInt16, name: "borderWidth" },
  { bytes: 2 },
];
const QueryTreeReply: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "root" },
  { type: NumberType.UInt32, name: "parent", altenum: "Window" },
  { type: NumberType.UInt16, name: "childrenLen" },
  { bytes: 14 },
  {
    name: "children",
    itemType: "WINDOW",
    type: ComposeType.List,
    fieldref: "childrenLen",
  },
];
const InternAtomReply: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "atom", altenum: "Atom" },
];
const GetAtomNameReply: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt16, name: "nameLen", expression: "args.name.length" },
  { bytes: 22 },
  { type: "STRING8", name: "name" },
];
const GetPropertyReply: Definitions.Field[] = [
  { type: NumberType.UInt8, name: "format" },
  { type: NumberType.UInt32, name: "type" },
  { type: NumberType.UInt32, name: "bytesAfter" },
  { type: NumberType.UInt32, name: "valueLen" },
  { bytes: 12 },
  {
    name: "value",
    itemType: "void",
    type: ComposeType.List,
    fieldref: undefined,
  },
];
const ListPropertiesReply: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt16, name: "atomsLen" },
  { bytes: 22 },
  {
    name: "atoms",
    itemType: "ATOM",
    type: ComposeType.List,
    fieldref: "atomsLen",
  },
];
const GetSelectionOwnerReply: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "owner", altenum: "Window" },
];
const GrabPointerReply: Definitions.Field[] = [
  { type: NumberType.Int8, name: "status", enum: "GrabStatus" },
];
const GrabKeyboardReply: Definitions.Field[] = [
  { type: NumberType.Int8, name: "status", enum: "GrabStatus" },
];
const QueryPointerReply: Definitions.Field[] = [
  { type: NumberType.UInt8, name: "sameScreen" },
  { type: NumberType.UInt32, name: "root" },
  { type: NumberType.UInt32, name: "child", altenum: "Window" },
  { type: NumberType.Int16, name: "rootX" },
  { type: NumberType.Int16, name: "rootY" },
  { type: NumberType.Int16, name: "winX" },
  { type: NumberType.Int16, name: "winY" },
  { type: NumberType.UInt16, name: "mask", mask: "KeyButMask" },
  { bytes: 2 },
];
const GetMotionEventsReply: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "eventsLen" },
  { bytes: 20 },
  {
    name: "events",
    itemType: "TIMECOORD",
    type: ComposeType.List,
    fieldref: "eventsLen",
  },
];
const TranslateCoordinatesReply: Definitions.Field[] = [
  { type: NumberType.UInt8, name: "sameScreen" },
  { type: NumberType.UInt32, name: "child", altenum: "Window" },
  { type: NumberType.Int16, name: "dstX" },
  { type: NumberType.Int16, name: "dstY" },
];
const GetInputFocusReply: Definitions.Field[] = [
  { type: NumberType.UInt8, name: "revertTo", enum: "InputFocus" },
  { type: NumberType.UInt32, name: "focus", altenum: "InputFocus" },
];
const QueryKeymapReply: Definitions.Field[] = [
  { bytes: 1 },
  { name: "keys", itemType: "CARD8", type: ComposeType.List, length: 32 },
];
const QueryFontReply: Definitions.Field[] = [
  { bytes: 1 },
  { type: "CHARINFO", name: "minBounds" },
  { bytes: 4 },
  { type: "CHARINFO", name: "maxBounds" },
  { bytes: 4 },
  { type: NumberType.UInt16, name: "minCharOrByte2" },
  { type: NumberType.UInt16, name: "maxCharOrByte2" },
  { type: NumberType.UInt16, name: "defaultChar" },
  { type: NumberType.UInt16, name: "propertiesLen" },
  { type: NumberType.Int8, name: "drawDirection", enum: "FontDraw" },
  { type: NumberType.UInt8, name: "minByte1" },
  { type: NumberType.UInt8, name: "maxByte1" },
  { type: NumberType.UInt8, name: "allCharsExist" },
  { type: NumberType.Int16, name: "fontAscent" },
  { type: NumberType.Int16, name: "fontDescent" },
  { type: NumberType.UInt32, name: "charInfosLen" },
  {
    name: "properties",
    itemType: "FONTPROP",
    type: ComposeType.List,
    fieldref: "propertiesLen",
  },
  {
    name: "char_infos",
    itemType: "CHARINFO",
    type: ComposeType.List,
    fieldref: "charInfosLen",
  },
];
const QueryTextExtentsReply: Definitions.Field[] = [
  { type: NumberType.Int8, name: "drawDirection", enum: "FontDraw" },
  { type: NumberType.Int16, name: "fontAscent" },
  { type: NumberType.Int16, name: "fontDescent" },
  { type: NumberType.Int16, name: "overallAscent" },
  { type: NumberType.Int16, name: "overallDescent" },
  { type: NumberType.Int32, name: "overallWidth" },
  { type: NumberType.Int32, name: "overallLeft" },
  { type: NumberType.Int32, name: "overallRight" },
];
const ListFontsReply: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt16, name: "namesLen" },
  { bytes: 22 },
  {
    name: "names",
    itemType: "STR",
    type: ComposeType.List,
    fieldref: "namesLen",
  },
];
const ListFontsWithInfoReply: Definitions.Field[] = [
  { type: NumberType.UInt8, name: "nameLen" },
  { type: "CHARINFO", name: "minBounds" },
  { bytes: 4 },
  { type: "CHARINFO", name: "maxBounds" },
  { bytes: 4 },
  { type: NumberType.UInt16, name: "minCharOrByte2" },
  { type: NumberType.UInt16, name: "maxCharOrByte2" },
  { type: NumberType.UInt16, name: "defaultChar" },
  { type: NumberType.UInt16, name: "propertiesLen" },
  { type: NumberType.Int8, name: "drawDirection", enum: "FontDraw" },
  { type: NumberType.UInt8, name: "minByte1" },
  { type: NumberType.UInt8, name: "maxByte1" },
  { type: NumberType.UInt8, name: "allCharsExist" },
  { type: NumberType.Int16, name: "fontAscent" },
  { type: NumberType.Int16, name: "fontDescent" },
  { type: NumberType.UInt32, name: "repliesHint" },
  {
    name: "properties",
    itemType: "FONTPROP",
    type: ComposeType.List,
    fieldref: "propertiesLen",
  },
  {
    name: "name",
    itemType: "char",
    type: ComposeType.List,
    fieldref: "nameLen",
  },
];
const GetFontPathReply: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt16, name: "pathLen" },
  { bytes: 22 },
  {
    name: "path",
    itemType: "STR",
    type: ComposeType.List,
    fieldref: "pathLen",
  },
];
const GetImageReply: Definitions.Field[] = [
  { type: NumberType.UInt8, name: "depth" },
  { type: NumberType.UInt32, name: "visual" },
  { bytes: 20 },
  {
    name: "data",
    itemType: "BYTE",
    type: ComposeType.List,
    fieldref: undefined,
  },
];
const ListInstalledColormapsReply: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt16, name: "cmapsLen" },
  { bytes: 22 },
  {
    name: "cmaps",
    itemType: "COLORMAP",
    type: ComposeType.List,
    fieldref: "cmapsLen",
  },
];
const AllocColorReply: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt16, name: "red" },
  { type: NumberType.UInt16, name: "green" },
  { type: NumberType.UInt16, name: "blue" },
  { bytes: 2 },
  { type: NumberType.UInt32, name: "pixel" },
];
const AllocNamedColorReply: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt32, name: "pixel" },
  { type: NumberType.UInt16, name: "exactRed" },
  { type: NumberType.UInt16, name: "exactGreen" },
  { type: NumberType.UInt16, name: "exactBlue" },
  { type: NumberType.UInt16, name: "visualRed" },
  { type: NumberType.UInt16, name: "visualGreen" },
  { type: NumberType.UInt16, name: "visualBlue" },
];
const AllocColorCellsReply: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt16, name: "pixelsLen" },
  { type: NumberType.UInt16, name: "masksLen" },
  { bytes: 20 },
  {
    name: "pixels",
    itemType: "CARD32",
    type: ComposeType.List,
    fieldref: "pixelsLen",
  },
  {
    name: "masks",
    itemType: "CARD32",
    type: ComposeType.List,
    fieldref: "masksLen",
  },
];
const AllocColorPlanesReply: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt16, name: "pixelsLen" },
  { bytes: 2 },
  { type: NumberType.UInt32, name: "redMask" },
  { type: NumberType.UInt32, name: "greenMask" },
  { type: NumberType.UInt32, name: "blueMask" },
  { bytes: 8 },
  {
    name: "pixels",
    itemType: "CARD32",
    type: ComposeType.List,
    fieldref: "pixelsLen",
  },
];
const QueryColorsReply: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt16, name: "colorsLen" },
  { bytes: 22 },
  {
    name: "colors",
    itemType: "RGB",
    type: ComposeType.List,
    fieldref: "colorsLen",
  },
];
const LookupColorReply: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt16, name: "exactRed" },
  { type: NumberType.UInt16, name: "exactGreen" },
  { type: NumberType.UInt16, name: "exactBlue" },
  { type: NumberType.UInt16, name: "visualRed" },
  { type: NumberType.UInt16, name: "visualGreen" },
  { type: NumberType.UInt16, name: "visualBlue" },
];
const QueryBestSizeReply: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt16, name: "width" },
  { type: NumberType.UInt16, name: "height" },
];
const QueryExtensionReply: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt8, name: "present" },
  { type: NumberType.UInt8, name: "majorOpcode" },
  { type: NumberType.UInt8, name: "firstEvent" },
  { type: NumberType.UInt8, name: "firstError" },
];
const ListExtensionsReply: Definitions.Field[] = [
  { type: NumberType.UInt8, name: "namesLen" },
  { bytes: 24 },
  {
    name: "names",
    itemType: "STR",
    type: ComposeType.List,
    fieldref: "namesLen",
  },
];
const GetKeyboardMappingReply: Definitions.Field[] = [
  { type: NumberType.Int8, name: "keysymsPerKeycode" },
  { bytes: 24 },
  {
    name: "keysyms",
    itemType: "KEYSYM",
    type: ComposeType.List,
    fieldref: "length",
  },
];
const GetKeyboardControlReply: Definitions.Field[] = [
  { type: NumberType.Int8, name: "globalAutoRepeat", enum: "AutoRepeatMode" },
  { type: NumberType.UInt32, name: "ledMask" },
  { type: NumberType.UInt8, name: "keyClickPercent" },
  { type: NumberType.UInt8, name: "bellPercent" },
  { type: NumberType.UInt16, name: "bellPitch" },
  { type: NumberType.UInt16, name: "bellDuration" },
  { bytes: 2 },
  {
    name: "auto_repeats",
    itemType: "CARD8",
    type: ComposeType.List,
    length: 32,
  },
];
const GetPointerControlReply: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt16, name: "accelerationNumerator" },
  { type: NumberType.UInt16, name: "accelerationDenominator" },
  { type: NumberType.UInt16, name: "threshold" },
  { bytes: 18 },
];
const GetScreenSaverReply: Definitions.Field[] = [
  { bytes: 1 },
  { type: NumberType.UInt16, name: "timeout" },
  { type: NumberType.UInt16, name: "interval" },
  { type: NumberType.Int8, name: "preferBlanking", enum: "Blanking" },
  { type: NumberType.Int8, name: "allowExposures", enum: "Exposures" },
  { bytes: 18 },
];
const ListHostsReply: Definitions.Field[] = [
  { type: NumberType.Int8, name: "mode", enum: "AccessControl" },
  { type: NumberType.UInt16, name: "hostsLen" },
  { bytes: 22 },
  {
    name: "hosts",
    itemType: "HOST",
    type: ComposeType.List,
    fieldref: "hostsLen",
  },
];
const SetPointerMappingReply: Definitions.Field[] = [
  { type: NumberType.Int8, name: "status", enum: "MappingStatus" },
];
const GetPointerMappingReply: Definitions.Field[] = [
  { type: NumberType.UInt8, name: "mapLen" },
  { bytes: 24 },
  {
    name: "map",
    itemType: "CARD8",
    type: ComposeType.List,
    fieldref: "mapLen",
  },
];
const SetModifierMappingReply: Definitions.Field[] = [
  { type: NumberType.Int8, name: "status", enum: "MappingStatus" },
];
const GetModifierMappingReply: Definitions.Field[] = [
  { type: NumberType.UInt8, name: "keycodesPerModifier" },
  { bytes: 24 },
  {
    name: "keycodes",
    itemType: "KEYCODE",
    type: ComposeType.List,
    fieldref: undefined,
  },
];
export const requests: Record<string, Definitions.Field[]> = {
  CreateWindow,
  ChangeWindowAttributes,
  GetWindowAttributes,
  DestroyWindow,
  DestroySubwindows,
  ChangeSaveSet,
  ReparentWindow,
  MapWindow,
  MapSubwindows,
  UnmapWindow,
  UnmapSubwindows,
  ConfigureWindow,
  CirculateWindow,
  GetGeometry,
  QueryTree,
  InternAtom,
  GetAtomName,
  ChangeProperty,
  DeleteProperty,
  GetProperty,
  ListProperties,
  SetSelectionOwner,
  GetSelectionOwner,
  ConvertSelection,
  SendEvent,
  GrabPointer,
  UngrabPointer,
  GrabButton,
  UngrabButton,
  ChangeActivePointerGrab,
  GrabKeyboard,
  UngrabKeyboard,
  GrabKey,
  UngrabKey,
  AllowEvents,
  GrabServer,
  UngrabServer,
  QueryPointer,
  GetMotionEvents,
  TranslateCoordinates,
  WarpPointer,
  SetInputFocus,
  GetInputFocus,
  QueryKeymap,
  OpenFont,
  CloseFont,
  QueryFont,
  QueryTextExtents,
  ListFonts,
  ListFontsWithInfo,
  SetFontPath,
  GetFontPath,
  CreatePixmap,
  FreePixmap,
  CreateGC,
  ChangeGC,
  CopyGC,
  SetDashes,
  SetClipRectangles,
  FreeGC,
  ClearArea,
  CopyArea,
  CopyPlane,
  PolyPoint,
  PolyLine,
  PolySegment,
  PolyRectangle,
  PolyArc,
  FillPoly,
  PolyFillRectangle,
  PolyFillArc,
  PutImage,
  GetImage,
  PolyText8,
  PolyText16,
  ImageText8,
  ImageText16,
  CreateColormap,
  FreeColormap,
  CopyColormapAndFree,
  InstallColormap,
  UninstallColormap,
  ListInstalledColormaps,
  AllocColor,
  AllocNamedColor,
  AllocColorCells,
  AllocColorPlanes,
  FreeColors,
  StoreColors,
  StoreNamedColor,
  QueryColors,
  LookupColor,
  CreateCursor,
  CreateGlyphCursor,
  FreeCursor,
  RecolorCursor,
  QueryBestSize,
  QueryExtension,
  ListExtensions,
  ChangeKeyboardMapping,
  GetKeyboardMapping,
  ChangeKeyboardControl,
  GetKeyboardControl,
  Bell,
  ChangePointerControl,
  GetPointerControl,
  SetScreenSaver,
  GetScreenSaver,
  ChangeHosts,
  ListHosts,
  SetAccessControl,
  SetCloseDownMode,
  KillClient,
  RotateProperties,
  ForceScreenSaver,
  SetPointerMapping,
  GetPointerMapping,
  SetModifierMapping,
  GetModifierMapping,
  NoOperation,
};
export const replies: Record<string, Definitions.Field[]> = {
  GetWindowAttributes: GetWindowAttributesReply,
  GetGeometry: GetGeometryReply,
  QueryTree: QueryTreeReply,
  InternAtom: InternAtomReply,
  GetAtomName: GetAtomNameReply,
  GetProperty: GetPropertyReply,
  ListProperties: ListPropertiesReply,
  GetSelectionOwner: GetSelectionOwnerReply,
  GrabPointer: GrabPointerReply,
  GrabKeyboard: GrabKeyboardReply,
  QueryPointer: QueryPointerReply,
  GetMotionEvents: GetMotionEventsReply,
  TranslateCoordinates: TranslateCoordinatesReply,
  GetInputFocus: GetInputFocusReply,
  QueryKeymap: QueryKeymapReply,
  QueryFont: QueryFontReply,
  QueryTextExtents: QueryTextExtentsReply,
  ListFonts: ListFontsReply,
  ListFontsWithInfo: ListFontsWithInfoReply,
  GetFontPath: GetFontPathReply,
  GetImage: GetImageReply,
  ListInstalledColormaps: ListInstalledColormapsReply,
  AllocColor: AllocColorReply,
  AllocNamedColor: AllocNamedColorReply,
  AllocColorCells: AllocColorCellsReply,
  AllocColorPlanes: AllocColorPlanesReply,
  QueryColors: QueryColorsReply,
  LookupColor: LookupColorReply,
  QueryBestSize: QueryBestSizeReply,
  QueryExtension: QueryExtensionReply,
  ListExtensions: ListExtensionsReply,
  GetKeyboardMapping: GetKeyboardMappingReply,
  GetKeyboardControl: GetKeyboardControlReply,
  GetPointerControl: GetPointerControlReply,
  GetScreenSaver: GetScreenSaverReply,
  ListHosts: ListHostsReply,
  SetPointerMapping: SetPointerMappingReply,
  GetPointerMapping: GetPointerMappingReply,
  SetModifierMapping: SetModifierMappingReply,
  GetModifierMapping: GetModifierMappingReply,
};
