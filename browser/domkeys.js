'use strict';

// DOM KeyboardEvent → X keysym. The browser presentation layer resolves the
// keysym to a keycode by reverse lookup in the server's keymap, so this file
// stays independent of any particular keycode numbering.

const SPECIAL = {
    Escape: 0xff1b,
    Tab: 0xff09,
    Backspace: 0xff08,
    Enter: 0xff0d,
    NumpadEnter: 0xff8d,
    Delete: 0xffff,
    Insert: 0xff63,
    Home: 0xff50,
    End: 0xff57,
    PageUp: 0xff55,
    PageDown: 0xff56,
    ArrowLeft: 0xff51,
    ArrowUp: 0xff52,
    ArrowRight: 0xff53,
    ArrowDown: 0xff54,
    ShiftLeft: 0xffe1,
    ShiftRight: 0xffe2,
    ControlLeft: 0xffe3,
    ControlRight: 0xffe4,
    AltLeft: 0xffe9,
    AltRight: 0xffea,
    MetaLeft: 0xffeb,
    MetaRight: 0xffec,
    CapsLock: 0xffe5,
    NumLock: 0xff7f,
    ScrollLock: 0xff14,
    Pause: 0xff13,
    PrintScreen: 0xff61,
    ContextMenu: 0xff67,
    F1: 0xffbe, F2: 0xffbf, F3: 0xffc0, F4: 0xffc1, F5: 0xffc2, F6: 0xffc3,
    F7: 0xffc4, F8: 0xffc5, F9: 0xffc6, F10: 0xffc7, F11: 0xffc8, F12: 0xffc9
};

// Latin-1 printable characters map 1:1 to keysyms. Everything else printable
// gets the Unicode keysym convention (0x01000000 | codepoint).
function charKeysym(ch) {
    const code = ch.codePointAt(0);
    if (code >= 0x20 && code <= 0xff)
        return code;
    return 0x01000000 | code;
}

// ev: a DOM KeyboardEvent (uses .code for specials, .key for printables).
// Returns an X keysym, or 0 if the event carries nothing mappable.
function keyboardEventToKeysym(ev) {
    if (SPECIAL[ev.code] !== undefined)
        return SPECIAL[ev.code];
    if (ev.key && ev.key.length === 1)
        return charKeysym(ev.key);
    if (SPECIAL[ev.key] !== undefined)
        return SPECIAL[ev.key];
    return 0;
}

module.exports = { keyboardEventToKeysym, charKeysym, SPECIAL };
