export enum ByteOrder {
  LE = "LE",
  BE = "BE",
}
export enum VisualClass {
  StaticGray = 0,
  GrayScale = 1,
  StaticColor = 2,
  PseudoColor = 3,
  TrueColor = 4,
  DirectColor = 5,
}
export enum EventMask {
  NoEvent = 0,
  KeyPress = 1,
  KeyRelease = 2,
  ButtonPress = 4,
  ButtonRelease = 8,
  EnterWindow = 16,
  LeaveWindow = 32,
  PointerMotion = 64,
  PointerMotionHint = 128,
  Button1Motion = 256,
  Button2Motion = 512,
  Button3Motion = 1024,
  Button4Motion = 2048,
  Button5Motion = 4096,
  ButtonMotion = 8192,
  KeymapState = 16384,
  Exposure = 32768,
  VisibilityChange = 65536,
  StructureNotify = 131072,
  ResizeRedirect = 262144,
  SubstructureNotify = 524288,
  SubstructureRedirect = 1048576,
  FocusChange = 2097152,
  PropertyChange = 4194304,
  ColorMapChange = 8388608,
  OwnerGrabButton = 16777216,
}
export enum BackingStore {
  NotUseful = 0,
  WhenMapped = 1,
  Always = 2,
}
export enum ImageOrder {
  LSBFirst = 0,
  MSBFirst = 1,
}
export enum ModMask {
  _1 = 8,
  _2 = 16,
  _3 = 32,
  _4 = 64,
  _5 = 128,
  Shift = 1,
  Lock = 2,
  Control = 4,
  Any = 32768,
}
export enum KeyButMask {
  Shift = 1,
  Lock = 2,
  Control = 4,
  Mod1 = 8,
  Mod2 = 16,
  Mod3 = 32,
  Mod4 = 64,
  Mod5 = 128,
  Button1 = 256,
  Button2 = 512,
  Button3 = 1024,
  Button4 = 2048,
  Button5 = 4096,
}
export enum Window {
  None = 0,
}
export enum ButtonMask {
  _1 = 256,
  _2 = 512,
  _3 = 1024,
  _4 = 2048,
  _5 = 4096,
  Any = 32768,
}
export enum Motion {
  Normal = 0,
  Hint = 1,
}
export enum NotifyDetail {
  Ancestor = 0,
  Virtual = 1,
  Inferior = 2,
  Nonlinear = 3,
  NonlinearVirtual = 4,
  Pointer = 5,
  PointerRoot = 6,
  None = 7,
}
export enum NotifyMode {
  Normal = 0,
  Grab = 1,
  Ungrab = 2,
  WhileGrabbed = 3,
}
export enum Visibility {
  Unobscured = 0,
  PartiallyObscured = 1,
  FullyObscured = 2,
}
export enum Place {
  OnTop = 0,
  OnBottom = 1,
}
export enum Property {
  NewValue = 0,
  Delete = 1,
}
export enum Time {
  CurrentTime = 0,
}
export enum Atom {
  None = 0,
  Any = 0,
  PRIMARY = "PRIMARY",
  SECONDARY = "SECONDARY",
  ARC = "ARC",
  ATOM = "ATOM",
  BITMAP = "BITMAP",
  CARDINAL = "CARDINAL",
  COLORMAP = "COLORMAP",
  CURSOR = "CURSOR",
  CUT_BUFFER0 = "CUT_BUFFER0",
  CUT_BUFFER1 = "CUT_BUFFER1",
  CUT_BUFFER2 = "CUT_BUFFER2",
  CUT_BUFFER3 = "CUT_BUFFER3",
  CUT_BUFFER4 = "CUT_BUFFER4",
  CUT_BUFFER5 = "CUT_BUFFER5",
  CUT_BUFFER6 = "CUT_BUFFER6",
  CUT_BUFFER7 = "CUT_BUFFER7",
  DRAWABLE = "DRAWABLE",
  FONT = "FONT",
  INTEGER = "INTEGER",
  PIXMAP = "PIXMAP",
  POINT = "POINT",
  RECTANGLE = "RECTANGLE",
  RESOURCE_MANAGER = "RESOURCE_MANAGER",
  RGB_COLOR_MAP = "RGB_COLOR_MAP",
  RGB_BEST_MAP = "RGB_BEST_MAP",
  RGB_BLUE_MAP = "RGB_BLUE_MAP",
  RGB_DEFAULT_MAP = "RGB_DEFAULT_MAP",
  RGB_GRAY_MAP = "RGB_GRAY_MAP",
  RGB_GREEN_MAP = "RGB_GREEN_MAP",
  RGB_RED_MAP = "RGB_RED_MAP",
  STRING = "STRING",
  VISUALID = "VISUALID",
  WINDOW = "WINDOW",
  WM_COMMAND = "WM_COMMAND",
  WM_HINTS = "WM_HINTS",
  WM_CLIENT_MACHINE = "WM_CLIENT_MACHINE",
  WM_ICON_NAME = "WM_ICON_NAME",
  WM_ICON_SIZE = "WM_ICON_SIZE",
  WM_NAME = "WM_NAME",
  WM_NORMAL_HINTS = "WM_NORMAL_HINTS",
  WM_SIZE_HINTS = "WM_SIZE_HINTS",
  WM_ZOOM_HINTS = "WM_ZOOM_HINTS",
  MIN_SPACE = "MIN_SPACE",
  NORM_SPACE = "NORM_SPACE",
  MAX_SPACE = "MAX_SPACE",
  END_SPACE = "END_SPACE",
  SUPERSCRIPT_X = "SUPERSCRIPT_X",
  SUPERSCRIPT_Y = "SUPERSCRIPT_Y",
  SUBSCRIPT_X = "SUBSCRIPT_X",
  SUBSCRIPT_Y = "SUBSCRIPT_Y",
  UNDERLINE_POSITION = "UNDERLINE_POSITION",
  UNDERLINE_THICKNESS = "UNDERLINE_THICKNESS",
  STRIKEOUT_ASCENT = "STRIKEOUT_ASCENT",
  STRIKEOUT_DESCENT = "STRIKEOUT_DESCENT",
  ITALIC_ANGLE = "ITALIC_ANGLE",
  X_HEIGHT = "X_HEIGHT",
  QUAD_WIDTH = "QUAD_WIDTH",
  WEIGHT = "WEIGHT",
  POINT_SIZE = "POINT_SIZE",
  RESOLUTION = "RESOLUTION",
  COPYRIGHT = "COPYRIGHT",
  NOTICE = "NOTICE",
  FONT_NAME = "FONT_NAME",
  FAMILY_NAME = "FAMILY_NAME",
  FULL_NAME = "FULL_NAME",
  CAP_HEIGHT = "CAP_HEIGHT",
  WM_CLASS = "WM_CLASS",
  WM_TRANSIENT_FOR = "WM_TRANSIENT_FOR",
}
export enum ColormapState {
  Uninstalled = 0,
  Installed = 1,
}
export enum Colormap {
  None = 0,
}
export enum Mapping {
  Modifier = 0,
  Keyboard = 1,
  Pointer = 2,
}
export enum WindowClass {
  CopyFromParent = 0,
  InputOutput = 1,
  InputOnly = 2,
}
export enum CW {
  BackPixmap = 1,
  BackPixel = 2,
  BorderPixmap = 4,
  BorderPixel = 8,
  BitGravity = 16,
  WinGravity = 32,
  BackingStore = 64,
  BackingPlanes = 128,
  BackingPixel = 256,
  OverrideRedirect = 512,
  SaveUnder = 1024,
  EventMask = 2048,
  DontPropagate = 4096,
  Colormap = 8192,
  Cursor = 16384,
}
export enum BackPixmap {
  None = 0,
  ParentRelative = 1,
}
export enum Gravity {
  BitForget = 0,
  WinUnmap = 0,
  NorthWest = 1,
  North = 2,
  NorthEast = 3,
  West = 4,
  Center = 5,
  East = 6,
  SouthWest = 7,
  South = 8,
  SouthEast = 9,
  Static = 10,
}
export enum MapState {
  Unmapped = 0,
  Unviewable = 1,
  Viewable = 2,
}
export enum SetMode {
  Insert = 0,
  Delete = 1,
}
export enum ConfigWindow {
  X = 1,
  Y = 2,
  Width = 4,
  Height = 8,
  BorderWidth = 16,
  Sibling = 32,
  StackMode = 64,
}
export enum StackMode {
  Above = 0,
  Below = 1,
  TopIf = 2,
  BottomIf = 3,
  Opposite = 4,
}
export enum Circulate {
  RaiseLowest = 0,
  LowerHighest = 1,
}
export enum PropMode {
  Replace = 0,
  Prepend = 1,
  Append = 2,
}
export enum GetPropertyType {
  Any = 0,
}
export enum SendEventDest {
  PointerWindow = 0,
  ItemFocus = 1,
}
export enum GrabMode {
  Sync = 0,
  Async = 1,
}
export enum GrabStatus {
  Success = 0,
  AlreadyGrabbed = 1,
  InvalidTime = 2,
  NotViewable = 3,
  Frozen = 4,
}
export enum Cursor {
  None = 0,
}
export enum ButtonIndex {
  _1 = 1,
  _2 = 2,
  _3 = 3,
  _4 = 4,
  _5 = 5,
  Any = 0,
}
export enum Grab {
  Any = 0,
}
export enum Allow {
  AsyncPointer = 0,
  SyncPointer = 1,
  ReplayPointer = 2,
  AsyncKeyboard = 3,
  SyncKeyboard = 4,
  ReplayKeyboard = 5,
  AsyncBoth = 6,
  SyncBoth = 7,
}
export enum InputFocus {
  None = 0,
  PointerRoot = 1,
  Parent = 2,
  FollowKeyboard = 3,
}
export enum FontDraw {
  LeftToRight = 0,
  RightToLeft = 1,
}
export enum GC {
  Function = 1,
  PlaneMask = 2,
  Foreground = 4,
  Background = 8,
  LineWidth = 16,
  LineStyle = 32,
  CapStyle = 64,
  JoinStyle = 128,
  FillStyle = 256,
  FillRule = 512,
  Tile = 1024,
  Stipple = 2048,
  TileStippleOriginX = 4096,
  TileStippleOriginY = 8192,
  Font = 16384,
  SubwindowMode = 32768,
  GraphicsExposures = 65536,
  ClipOriginX = 131072,
  ClipOriginY = 262144,
  ClipMask = 524288,
  DashOffset = 1048576,
  DashList = 2097152,
  ArcMode = 4194304,
}
export enum GX {
  clear = 0,
  and = 1,
  andReverse = 2,
  copy = 3,
  andInverted = 4,
  noop = 5,
  xor = 6,
  or = 7,
  nor = 8,
  equiv = 9,
  invert = 10,
  orReverse = 11,
  copyInverted = 12,
  orInverted = 13,
  nand = 14,
  set = 15,
}
export enum LineStyle {
  Solid = 0,
  OnOffDash = 1,
  DoubleDash = 2,
}
export enum CapStyle {
  NotLast = 0,
  Butt = 1,
  Round = 2,
  Projecting = 3,
}
export enum JoinStyle {
  Miter = 0,
  Round = 1,
  Bevel = 2,
}
export enum FillStyle {
  Solid = 0,
  Tiled = 1,
  Stippled = 2,
  OpaqueStippled = 3,
}
export enum FillRule {
  EvenOdd = 0,
  Winding = 1,
}
export enum SubwindowMode {
  ClipByChildren = 0,
  IncludeInferiors = 1,
}
export enum ArcMode {
  Chord = 0,
  PieSlice = 1,
}
export enum ClipOrdering {
  Unsorted = 0,
  YSorted = 1,
  YXSorted = 2,
  YXBanded = 3,
}
export enum CoordMode {
  Origin = 0,
  Previous = 1,
}
export enum PolyShape {
  Complex = 0,
  Nonconvex = 1,
  Convex = 2,
}
export enum ImageFormat {
  XYBitmap = 0,
  XYPixmap = 1,
  ZPixmap = 2,
}
export enum ColormapAlloc {
  None = 0,
  All = 1,
}
export enum ColorFlag {
  Red = 1,
  Green = 2,
  Blue = 4,
}
export enum Pixmap {
  None = 0,
}
export enum Font {
  None = 0,
}
export enum QueryShapeOf {
  LargestCursor = 0,
  FastestTile = 1,
  FastestStipple = 2,
}
export enum KB {
  KeyClickPercent = 1,
  BellPercent = 2,
  BellPitch = 4,
  BellDuration = 8,
  Led = 16,
  LedMode = 32,
  Key = 64,
  AutoRepeatMode = 128,
}
export enum LedMode {
  Off = 0,
  On = 1,
}
export enum AutoRepeatMode {
  Off = 0,
  On = 1,
  Default = 2,
}
export enum Blanking {
  NotPreferred = 0,
  Preferred = 1,
  Default = 2,
}
export enum Exposures {
  NotAllowed = 0,
  Allowed = 1,
  Default = 2,
}
export enum HostMode {
  Insert = 0,
  Delete = 1,
}
export enum Family {
  Internet = 0,
  DECnet = 1,
  Chaos = 2,
  ServerInterpreted = 5,
  Internet6 = 6,
}
export enum AccessControl {
  Disable = 0,
  Enable = 1,
}
export enum CloseDown {
  DestroyAll = 0,
  RetainPermanent = 1,
  RetainTemporary = 2,
}
export enum Kill {
  AllTemporary = 0,
}
export enum ScreenSaver {
  Reset = 0,
  Active = 1,
}
export enum MappingStatus {
  Success = 0,
  Busy = 1,
  Failure = 2,
}
export enum MapIndex {
  _1 = 3,
  _2 = 4,
  _3 = 5,
  _4 = 6,
  _5 = 7,
  Shift = 0,
  Lock = 1,
  Control = 2,
}
