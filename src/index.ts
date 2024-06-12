export { createClient } from "./xcore";
export { createServer } from "./xserver";
export { eventMask } from "./statics/eventmask";
export { keysyms as keySyms } from "./statics/keysyms";
export { GCFunction as gcFunction } from "./statics/gcfunction";

//TODO:
// keepe everything in namespace for consistensy (eventMask, keySyms, class, destination ...
// or put most used constants to top namespace? (currently class and destination in top)

// basic constants

// class
export const CopyFromParent: number = 0;
export const InputOutput: number = 1;
export const InputOnly: number = 2;

// destination
export const PointerWindow: number = 0;
export const InputFocus: number = 1;

// TODO
export const bitGravity: any = {};
export const winGravity: any = {};
