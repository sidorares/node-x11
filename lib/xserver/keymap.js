'use strict';

// Default US keymap for the JS X server: keycodes 8..255, two keysyms per
// keycode (unshifted, shifted), standard evdev-style keycode assignments so
// browser KeyboardEvent.code mappings and the client's keysyms.js line up.

const keysyms = require('../keysyms');

function sym(name) {
    const entry = keysyms[name];
    return entry ? entry.code : 0;
}

// keycode: [unshifted, shifted] (single-entry rows repeat the keysym)
const LAYOUT = {
    9: ['XK_Escape'],
    10: ['XK_1', 'XK_exclam'],
    11: ['XK_2', 'XK_at'],
    12: ['XK_3', 'XK_numbersign'],
    13: ['XK_4', 'XK_dollar'],
    14: ['XK_5', 'XK_percent'],
    15: ['XK_6', 'XK_asciicircum'],
    16: ['XK_7', 'XK_ampersand'],
    17: ['XK_8', 'XK_asterisk'],
    18: ['XK_9', 'XK_parenleft'],
    19: ['XK_0', 'XK_parenright'],
    20: ['XK_minus', 'XK_underscore'],
    21: ['XK_equal', 'XK_plus'],
    22: ['XK_BackSpace'],
    23: ['XK_Tab', 'XK_ISO_Left_Tab'],
    24: ['XK_q', 'XK_Q'],
    25: ['XK_w', 'XK_W'],
    26: ['XK_e', 'XK_E'],
    27: ['XK_r', 'XK_R'],
    28: ['XK_t', 'XK_T'],
    29: ['XK_y', 'XK_Y'],
    30: ['XK_u', 'XK_U'],
    31: ['XK_i', 'XK_I'],
    32: ['XK_o', 'XK_O'],
    33: ['XK_p', 'XK_P'],
    34: ['XK_bracketleft', 'XK_braceleft'],
    35: ['XK_bracketright', 'XK_braceright'],
    36: ['XK_Return'],
    37: ['XK_Control_L'],
    38: ['XK_a', 'XK_A'],
    39: ['XK_s', 'XK_S'],
    40: ['XK_d', 'XK_D'],
    41: ['XK_f', 'XK_F'],
    42: ['XK_g', 'XK_G'],
    43: ['XK_h', 'XK_H'],
    44: ['XK_j', 'XK_J'],
    45: ['XK_k', 'XK_K'],
    46: ['XK_l', 'XK_L'],
    47: ['XK_semicolon', 'XK_colon'],
    48: ['XK_apostrophe', 'XK_quotedbl'],
    49: ['XK_grave', 'XK_asciitilde'],
    50: ['XK_Shift_L'],
    51: ['XK_backslash', 'XK_bar'],
    52: ['XK_z', 'XK_Z'],
    53: ['XK_x', 'XK_X'],
    54: ['XK_c', 'XK_C'],
    55: ['XK_v', 'XK_V'],
    56: ['XK_b', 'XK_B'],
    57: ['XK_n', 'XK_N'],
    58: ['XK_m', 'XK_M'],
    59: ['XK_comma', 'XK_less'],
    60: ['XK_period', 'XK_greater'],
    61: ['XK_slash', 'XK_question'],
    62: ['XK_Shift_R'],
    63: ['XK_KP_Multiply'],
    64: ['XK_Alt_L'],
    65: ['XK_space'],
    66: ['XK_Caps_Lock'],
    67: ['XK_F1'],
    68: ['XK_F2'],
    69: ['XK_F3'],
    70: ['XK_F4'],
    71: ['XK_F5'],
    72: ['XK_F6'],
    73: ['XK_F7'],
    74: ['XK_F8'],
    75: ['XK_F9'],
    76: ['XK_F10'],
    77: ['XK_Num_Lock'],
    82: ['XK_KP_Subtract'],
    86: ['XK_KP_Add'],
    95: ['XK_F11'],
    96: ['XK_F12'],
    104: ['XK_KP_Enter'],
    105: ['XK_Control_R'],
    106: ['XK_KP_Divide'],
    107: ['XK_Print'],
    108: ['XK_Alt_R'],
    110: ['XK_Home'],
    111: ['XK_Up'],
    112: ['XK_Prior'],
    113: ['XK_Left'],
    114: ['XK_Right'],
    115: ['XK_End'],
    116: ['XK_Down'],
    117: ['XK_Next'],
    118: ['XK_Insert'],
    119: ['XK_Delete'],
    127: ['XK_Pause'],
    133: ['XK_Super_L'],
    134: ['XK_Super_R'],
    135: ['XK_Menu']
};

const MIN_KEYCODE = 8;
const MAX_KEYCODE = 255;

// default modifier map: 2 keycodes per modifier
// rows: Shift, Lock, Control, Mod1(Alt), Mod2(NumLock), Mod3, Mod4(Super), Mod5
const DEFAULT_MODIFIERS = [
    [50, 62],   // Shift_L, Shift_R
    [66, 0],    // Caps_Lock
    [37, 105],  // Control_L, Control_R
    [64, 108],  // Alt_L, Alt_R
    [77, 0],    // Num_Lock
    [0, 0],
    [133, 134], // Super_L, Super_R
    [0, 0]
];

// Fresh mutable keymap state for one server instance.
function create() {
    const syms = new Array(MAX_KEYCODE + 1);
    for (let kc = 0; kc <= MAX_KEYCODE; kc++)
        syms[kc] = [0, 0];
    for (const kc of Object.keys(LAYOUT)) {
        const names = LAYOUT[kc];
        const s1 = sym(names[0]);
        const s2 = names.length > 1 ? sym(names[1]) : s1;
        syms[kc] = [s1, s2];
    }

    return {
        minKeycode: MIN_KEYCODE,
        maxKeycode: MAX_KEYCODE,
        keysymsPerKeycode: 2,
        syms,
        modifiers: DEFAULT_MODIFIERS.map(row => row.slice()),
        keycodesPerModifier: 2,

        // reverse lookup, unshifted column preferred
        keycodeForKeysym(keysym) {
            for (let kc = MIN_KEYCODE; kc <= MAX_KEYCODE; kc++)
                if (this.syms[kc][0] === keysym)
                    return kc;
            for (let kc = MIN_KEYCODE; kc <= MAX_KEYCODE; kc++)
                if (this.syms[kc].indexOf(keysym) !== -1)
                    return kc;
            return 0;
        },

        // modifier bit (1 << row) for a keycode, or 0
        modifierBit(keycode) {
            for (let row = 0; row < 8; row++)
                if (this.modifiers[row].indexOf(keycode) !== -1)
                    return 1 << row;
            return 0;
        }
    };
}

module.exports = { create, MIN_KEYCODE, MAX_KEYCODE };
