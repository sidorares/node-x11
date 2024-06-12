/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *\

   This file is automatically translated from X.Org's xproto/keysymdef.h
   Please, do not update this file with your hands, run keysyms.update.sh.

\* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

export const keysyms = {
    /***********************************************************
     Copyright 1987, 1994, 1998  The Open Group

     Permission to use, copy, modify, distribute, and sell this software and its
     documentation for any purpose is hereby granted without fee, provided that
     the above copyright notice appear in all copies and that both that
     copyright notice and this permission notice appear in supporting
     documentation.

     The above copyright notice and this permission notice shall be included
     in all copies or substantial portions of the Software.

     THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
     OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
     MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
     IN NO EVENT SHALL THE OPEN GROUP BE LIABLE FOR ANY CLAIM, DAMAGES OR
     OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
     ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
     OTHER DEALINGS IN THE SOFTWARE.

     Except as contained in this notice, the name of The Open Group shall
     not be used in advertising or otherwise to promote the sale, use or
     other dealings in this Software without prior written authorization
     from The Open Group.


     Copyright 1987 by Digital Equipment Corporation, Maynard, Massachusetts

     All Rights Reserved

     Permission to use, copy, modify, and distribute this software and its
     documentation for any purpose and without fee is hereby granted,
     provided that the above copyright notice appear in all copies and that
     both that copyright notice and this permission notice appear in
     supporting documentation, and that the name of Digital not be
     used in advertising or publicity pertaining to distribution of the
     software without specific, written prior permission.

     DIGITAL DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE, INCLUDING
     ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS, IN NO EVENT SHALL
     DIGITAL BE LIABLE FOR ANY SPECIAL, INDIRECT OR CONSEQUENTIAL DAMAGES OR
     ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS,
     WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION,
     ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS
     SOFTWARE.

     ******************************************************************/

    /*
   * The "X11 Window System Protocol" standard defines in Appendix A the
   * keysym codes. These 29-bit integer values identify characters or
   * functions associated with each key (e.g., via the visible
   * engraving) of a keyboard layout. This file assigns mnemonic macro
   * names for these keysyms.
   *
   * This file is also compiled (by src/util/makekeys.c in libX11) into
   * hash tables that can be accessed with X11 library functions such as
   * XStringToKeysym() and XKeysymToString().
   *
   * Where a keysym corresponds one-to-one to an ISO 10646 / Unicode
   * character, this is noted in a comment that provides both the U+xxxx
   * Unicode position, as well as the official Unicode name of the
   * character.
   *
   * Where the correspondence is either not one-to-one or semantically
   * unclear, the Unicode position and name are enclosed in
   * parentheses. Such legacy keysyms should be considered deprecated
   * and are not recommended for use in future keyboard mappings.
   *
   * For any future extension of the keysyms with characters already
   * found in ISO 10646 / Unicode, the following algorithm shall be
   * used. The new keysym code position will simply be the character's
   * Unicode number plus 0x01000000. The keysym values in the range
   * 0x01000100 to 0x0110ffff are reserved to represent Unicode
   * characters in the range (\u0100) to U+10FFFF.
   *
   * While most newer Unicode-based X11 clients do already accept
   * Unicode-mapped keysyms in the range 0x01000100 to 0x0110ffff, it
   * will remain necessary for clients -- in the interest of
   * compatibility with existing servers -- to also understand the
   * existing legacy keysym values in the range 0x0100 to 0x20ff.
   *
   * Where several mnemonic names are defined for the same keysym in this
   * file, all but the first one listed should be considered deprecated.
   *
   * Mnemonic names for keysyms are defined in this file with lines
   * that match one of these Perl regular expressions:
   *
   *    /^\  XK_([a-zA-Z_0-9]+)\s+0x([0-9a-f]+)\s*\/\*: { code: U+([0-9A-F]{4,6}), description: null }, (.*) \*\/\s*$/
   *    /^\  XK_([a-zA-Z_0-9]+)\s+0x([0-9a-f]+)\s*\/\*\(U+([0-9A-F]{4,6}): { code: (.*)\)\*\/\s*$/, description: null },
   *    /^\#define XK_([a-zA-Z_0-9]+)\s+0x([0-9a-f]+)\s*(\/\*\s*(.*)\s*\*\/)?\s*$/
   *
   * Before adding new keysyms, please do consider the following: In
   * addition to the keysym names defined in this file, the
   * XStringToKeysym() and XKeysymToString() functions will also handle
   * any keysym string of the form "U0020" to "U007E" and "U00A0" to
   * "U10FFFF" for all possible Unicode characters. In other words,
   * every possible Unicode character has already a keysym string
   * defined algorithmically, even if it is not listed here. Therefore,
   * defining an additional keysym macro is only necessary where a
   * non-hexadecimal mnemonic name is needed, or where the new keysym
   * does not represent any existing Unicode character.
   *
   * When adding new keysyms to this file, do not forget to also update the
   * following as needed:
   *
   *   - the mappings in src/KeyBind.c in the repo
   *     git://anongit.freedesktop.org/xorg/lib/libX11.git
   *
   *   - the protocol specification in specs/keysyms.xml
   *     in the repo git://anongit.freedesktop.org/xorg/proto/x11proto.git
   *
   */

    XK_VoidSymbol: { code: 0xffffff, description: "Void symbol" },

    // Group XK_MISCELLANY
    /*
   * TTY function keys, cleverly chosen to map to ASCII, for convenience of
   * programming, but could have been arbitrary (at the cost of lookup
   * tables in client code).
   */

    XK_BackSpace: { code: 0xff08, description: "Back space, back char" },
    XK_Tab: { code: 0xff09, description: null },
    XK_Linefeed: { code: 0xff0a, description: "Linefeed, LF" },
    XK_Clear: { code: 0xff0b, description: null },
    XK_Return: { code: 0xff0d, description: "Return, enter" },
    XK_Pause: { code: 0xff13, description: "Pause, hold" },
    XK_Scroll_Lock: { code: 0xff14, description: null },
    XK_Sys_Req: { code: 0xff15, description: null },
    XK_Escape: { code: 0xff1b, description: null },
    XK_Delete: { code: 0xffff, description: "Delete, rubout" },

    /* International & multi-key character composition */

    XK_Multi_key: { code: 0xff20, description: "Multi-key character compose" },
    XK_Codeinput: { code: 0xff37, description: null },
    XK_SingleCandidate: { code: 0xff3c, description: null },
    XK_MultipleCandidate: { code: 0xff3d, description: null },
    XK_PreviousCandidate: { code: 0xff3e, description: null },

    /* Japanese keyboard support */

    XK_Kanji: { code: 0xff21, description: "Kanji, Kanji convert" },
    XK_Muhenkan: { code: 0xff22, description: "Cancel Conversion" },
    XK_Henkan_Mode: { code: 0xff23, description: "Start/Stop Conversion" },
    XK_Henkan: { code: 0xff23, description: "Alias for Henkan_Mode" },
    XK_Romaji: { code: 0xff24, description: "to Romaji" },
    XK_Hiragana: { code: 0xff25, description: "to Hiragana" },
    XK_Katakana: { code: 0xff26, description: "to Katakana" },
    XK_Hiragana_Katakana: {
        code: 0xff27,
        description: "Hiragana/Katakana toggle",
    },
    XK_Zenkaku: { code: 0xff28, description: "to Zenkaku" },
    XK_Hankaku: { code: 0xff29, description: "to Hankaku" },
    XK_Zenkaku_Hankaku: { code: 0xff2a, description: "Zenkaku/Hankaku toggle" },
    XK_Touroku: { code: 0xff2b, description: "Add to Dictionary" },
    XK_Massyo: { code: 0xff2c, description: "Delete from Dictionary" },
    XK_Kana_Lock: { code: 0xff2d, description: "Kana Lock" },
    XK_Kana_Shift: { code: 0xff2e, description: "Kana Shift" },
    XK_Eisu_Shift: { code: 0xff2f, description: "Alphanumeric Shift" },
    XK_Eisu_toggle: { code: 0xff30, description: "Alphanumeric toggle" },
    XK_Kanji_Bangou: { code: 0xff37, description: "Codeinput" },
    XK_Zen_Koho: { code: 0xff3d, description: "Multiple/All Candidate(s)" },
    XK_Mae_Koho: { code: 0xff3e, description: "Previous Candidate" },

    /* 0xff31 thru 0xff3f are under XK_KOREAN */

    /* Cursor control & motion */

    XK_Home: { code: 0xff50, description: null },
    XK_Left: { code: 0xff51, description: "Move left, left arrow" },
    XK_Up: { code: 0xff52, description: "Move up, up arrow" },
    XK_Right: { code: 0xff53, description: "Move right, right arrow" },
    XK_Down: { code: 0xff54, description: "Move down, down arrow" },
    XK_Prior: { code: 0xff55, description: "Prior, previous" },
    XK_Page_Up: { code: 0xff55, description: null },
    XK_Next: { code: 0xff56, description: "Next" },
    XK_Page_Down: { code: 0xff56, description: null },
    XK_End: { code: 0xff57, description: "EOL" },
    XK_Begin: { code: 0xff58, description: "BOL" },

    /* Misc functions */

    XK_Select: { code: 0xff60, description: "Select, mark" },
    XK_Print: { code: 0xff61, description: null },
    XK_Execute: { code: 0xff62, description: "Execute, run, do" },
    XK_Insert: { code: 0xff63, description: "Insert, insert here" },
    XK_Undo: { code: 0xff65, description: null },
    XK_Redo: { code: 0xff66, description: "Redo, again" },
    XK_Menu: { code: 0xff67, description: null },
    XK_Find: { code: 0xff68, description: "Find, search" },
    XK_Cancel: { code: 0xff69, description: "Cancel, stop, abort, exit" },
    XK_Help: { code: 0xff6a, description: "Help" },
    XK_Break: { code: 0xff6b, description: null },
    XK_Mode_switch: { code: 0xff7e, description: "Character set switch" },
    XK_script_switch: { code: 0xff7e, description: "Alias for mode_switch" },
    XK_Num_Lock: { code: 0xff7f, description: null },

    /* Keypad functions, keypad numbers cleverly chosen to map to ASCII */

    XK_KP_Space: { code: 0xff80, description: "Space" },
    XK_KP_Tab: { code: 0xff89, description: null },
    XK_KP_Enter: { code: 0xff8d, description: "Enter" },
    XK_KP_F1: { code: 0xff91, description: "PF1, KP_A, ..." },
    XK_KP_F2: { code: 0xff92, description: null },
    XK_KP_F3: { code: 0xff93, description: null },
    XK_KP_F4: { code: 0xff94, description: null },
    XK_KP_Home: { code: 0xff95, description: null },
    XK_KP_Left: { code: 0xff96, description: null },
    XK_KP_Up: { code: 0xff97, description: null },
    XK_KP_Right: { code: 0xff98, description: null },
    XK_KP_Down: { code: 0xff99, description: null },
    XK_KP_Prior: { code: 0xff9a, description: null },
    XK_KP_Page_Up: { code: 0xff9a, description: null },
    XK_KP_Next: { code: 0xff9b, description: null },
    XK_KP_Page_Down: { code: 0xff9b, description: null },
    XK_KP_End: { code: 0xff9c, description: null },
    XK_KP_Begin: { code: 0xff9d, description: null },
    XK_KP_Insert: { code: 0xff9e, description: null },
    XK_KP_Delete: { code: 0xff9f, description: null },
    XK_KP_Equal: { code: 0xffbd, description: "Equals" },
    XK_KP_Multiply: { code: 0xffaa, description: null },
    XK_KP_Add: { code: 0xffab, description: null },
    XK_KP_Separator: { code: 0xffac, description: "Separator, often comma" },
    XK_KP_Subtract: { code: 0xffad, description: null },
    XK_KP_Decimal: { code: 0xffae, description: null },
    XK_KP_Divide: { code: 0xffaf, description: null },

    XK_KP_0: { code: 0xffb0, description: null },
    XK_KP_1: { code: 0xffb1, description: null },
    XK_KP_2: { code: 0xffb2, description: null },
    XK_KP_3: { code: 0xffb3, description: null },
    XK_KP_4: { code: 0xffb4, description: null },
    XK_KP_5: { code: 0xffb5, description: null },
    XK_KP_6: { code: 0xffb6, description: null },
    XK_KP_7: { code: 0xffb7, description: null },
    XK_KP_8: { code: 0xffb8, description: null },
    XK_KP_9: { code: 0xffb9, description: null },

    /*
   * Auxiliary functions; note the duplicate definitions for left and right
   * function keys;  Sun keyboards and a few other manufacturers have such
   * function key groups on the left and/or right sides of the keyboard.
   * We've not found a keyboard with more than 35 function keys total.
   */

    XK_F1: { code: 0xffbe, description: null },
    XK_F2: { code: 0xffbf, description: null },
    XK_F3: { code: 0xffc0, description: null },
    XK_F4: { code: 0xffc1, description: null },
    XK_F5: { code: 0xffc2, description: null },
    XK_F6: { code: 0xffc3, description: null },
    XK_F7: { code: 0xffc4, description: null },
    XK_F8: { code: 0xffc5, description: null },
    XK_F9: { code: 0xffc6, description: null },
    XK_F10: { code: 0xffc7, description: null },
    XK_F11: { code: 0xffc8, description: null },
    XK_L1: { code: 0xffc8, description: null },
    XK_F12: { code: 0xffc9, description: null },
    XK_L2: { code: 0xffc9, description: null },
    XK_F13: { code: 0xffca, description: null },
    XK_L3: { code: 0xffca, description: null },
    XK_F14: { code: 0xffcb, description: null },
    XK_L4: { code: 0xffcb, description: null },
    XK_F15: { code: 0xffcc, description: null },
    XK_L5: { code: 0xffcc, description: null },
    XK_F16: { code: 0xffcd, description: null },
    XK_L6: { code: 0xffcd, description: null },
    XK_F17: { code: 0xffce, description: null },
    XK_L7: { code: 0xffce, description: null },
    XK_F18: { code: 0xffcf, description: null },
    XK_L8: { code: 0xffcf, description: null },
    XK_F19: { code: 0xffd0, description: null },
    XK_L9: { code: 0xffd0, description: null },
    XK_F20: { code: 0xffd1, description: null },
    XK_L10: { code: 0xffd1, description: null },
    XK_F21: { code: 0xffd2, description: null },
    XK_R1: { code: 0xffd2, description: null },
    XK_F22: { code: 0xffd3, description: null },
    XK_R2: { code: 0xffd3, description: null },
    XK_F23: { code: 0xffd4, description: null },
    XK_R3: { code: 0xffd4, description: null },
    XK_F24: { code: 0xffd5, description: null },
    XK_R4: { code: 0xffd5, description: null },
    XK_F25: { code: 0xffd6, description: null },
    XK_R5: { code: 0xffd6, description: null },
    XK_F26: { code: 0xffd7, description: null },
    XK_R6: { code: 0xffd7, description: null },
    XK_F27: { code: 0xffd8, description: null },
    XK_R7: { code: 0xffd8, description: null },
    XK_F28: { code: 0xffd9, description: null },
    XK_R8: { code: 0xffd9, description: null },
    XK_F29: { code: 0xffda, description: null },
    XK_R9: { code: 0xffda, description: null },
    XK_F30: { code: 0xffdb, description: null },
    XK_R10: { code: 0xffdb, description: null },
    XK_F31: { code: 0xffdc, description: null },
    XK_R11: { code: 0xffdc, description: null },
    XK_F32: { code: 0xffdd, description: null },
    XK_R12: { code: 0xffdd, description: null },
    XK_F33: { code: 0xffde, description: null },
    XK_R13: { code: 0xffde, description: null },
    XK_F34: { code: 0xffdf, description: null },
    XK_R14: { code: 0xffdf, description: null },
    XK_F35: { code: 0xffe0, description: null },
    XK_R15: { code: 0xffe0, description: null },

    /* Modifiers */

    XK_Shift_L: { code: 0xffe1, description: "Left shift" },
    XK_Shift_R: { code: 0xffe2, description: "Right shift" },
    XK_Control_L: { code: 0xffe3, description: "Left control" },
    XK_Control_R: { code: 0xffe4, description: "Right control" },
    XK_Caps_Lock: { code: 0xffe5, description: "Caps lock" },
    XK_Shift_Lock: { code: 0xffe6, description: "Shift lock" },

    XK_Meta_L: { code: 0xffe7, description: "Left meta" },
    XK_Meta_R: { code: 0xffe8, description: "Right meta" },
    XK_Alt_L: { code: 0xffe9, description: "Left alt" },
    XK_Alt_R: { code: 0xffea, description: "Right alt" },
    XK_Super_L: { code: 0xffeb, description: "Left super" },
    XK_Super_R: { code: 0xffec, description: "Right super" },
    XK_Hyper_L: { code: 0xffed, description: "Left hyper" },
    XK_Hyper_R: { code: 0xffee, description: "Right hyper" },

    /*
   * Keyboard (XKB) Extension function and modifier keys
   * (from Appendix C of "The X Keyboard Extension: Protocol Specification")
   * Byte 3 = 0xfe
   */

    // Group XK_XKB_KEYS
    XK_ISO_Lock: { code: 0xfe01, description: null },
    XK_ISO_Level2_Latch: { code: 0xfe02, description: null },
    XK_ISO_Level3_Shift: { code: 0xfe03, description: null },
    XK_ISO_Level3_Latch: { code: 0xfe04, description: null },
    XK_ISO_Level3_Lock: { code: 0xfe05, description: null },
    XK_ISO_Level5_Shift: { code: 0xfe11, description: null },
    XK_ISO_Level5_Latch: { code: 0xfe12, description: null },
    XK_ISO_Level5_Lock: { code: 0xfe13, description: null },
    XK_ISO_Group_Shift: { code: 0xff7e, description: "Alias for mode_switch" },
    XK_ISO_Group_Latch: { code: 0xfe06, description: null },
    XK_ISO_Group_Lock: { code: 0xfe07, description: null },
    XK_ISO_Next_Group: { code: 0xfe08, description: null },
    XK_ISO_Next_Group_Lock: { code: 0xfe09, description: null },
    XK_ISO_Prev_Group: { code: 0xfe0a, description: null },
    XK_ISO_Prev_Group_Lock: { code: 0xfe0b, description: null },
    XK_ISO_First_Group: { code: 0xfe0c, description: null },
    XK_ISO_First_Group_Lock: { code: 0xfe0d, description: null },
    XK_ISO_Last_Group: { code: 0xfe0e, description: null },
    XK_ISO_Last_Group_Lock: { code: 0xfe0f, description: null },

    XK_ISO_Left_Tab: { code: 0xfe20, description: null },
    XK_ISO_Move_Line_Up: { code: 0xfe21, description: null },
    XK_ISO_Move_Line_Down: { code: 0xfe22, description: null },
    XK_ISO_Partial_Line_Up: { code: 0xfe23, description: null },
    XK_ISO_Partial_Line_Down: { code: 0xfe24, description: null },
    XK_ISO_Partial_Space_Left: { code: 0xfe25, description: null },
    XK_ISO_Partial_Space_Right: { code: 0xfe26, description: null },
    XK_ISO_Set_Margin_Left: { code: 0xfe27, description: null },
    XK_ISO_Set_Margin_Right: { code: 0xfe28, description: null },
    XK_ISO_Release_Margin_Left: { code: 0xfe29, description: null },
    XK_ISO_Release_Margin_Right: { code: 0xfe2a, description: null },
    XK_ISO_Release_Both_Margins: { code: 0xfe2b, description: null },
    XK_ISO_Fast_Cursor_Left: { code: 0xfe2c, description: null },
    XK_ISO_Fast_Cursor_Right: { code: 0xfe2d, description: null },
    XK_ISO_Fast_Cursor_Up: { code: 0xfe2e, description: null },
    XK_ISO_Fast_Cursor_Down: { code: 0xfe2f, description: null },
    XK_ISO_Continuous_Underline: { code: 0xfe30, description: null },
    XK_ISO_Discontinuous_Underline: { code: 0xfe31, description: null },
    XK_ISO_Emphasize: { code: 0xfe32, description: null },
    XK_ISO_Center_Object: { code: 0xfe33, description: null },
    XK_ISO_Enter: { code: 0xfe34, description: null },

    XK_dead_grave: { code: 0xfe50, description: null },
    XK_dead_acute: { code: 0xfe51, description: null },
    XK_dead_circumflex: { code: 0xfe52, description: null },
    XK_dead_tilde: { code: 0xfe53, description: null },
    XK_dead_perispomeni: { code: 0xfe53, description: "alias for dead_tilde" },
    XK_dead_macron: { code: 0xfe54, description: null },
    XK_dead_breve: { code: 0xfe55, description: null },
    XK_dead_abovedot: { code: 0xfe56, description: null },
    XK_dead_diaeresis: { code: 0xfe57, description: null },
    XK_dead_abovering: { code: 0xfe58, description: null },
    XK_dead_doubleacute: { code: 0xfe59, description: null },
    XK_dead_caron: { code: 0xfe5a, description: null },
    XK_dead_cedilla: { code: 0xfe5b, description: null },
    XK_dead_ogonek: { code: 0xfe5c, description: null },
    XK_dead_iota: { code: 0xfe5d, description: null },
    XK_dead_voiced_sound: { code: 0xfe5e, description: null },
    XK_dead_semivoiced_sound: { code: 0xfe5f, description: null },
    XK_dead_belowdot: { code: 0xfe60, description: null },
    XK_dead_hook: { code: 0xfe61, description: null },
    XK_dead_horn: { code: 0xfe62, description: null },
    XK_dead_stroke: { code: 0xfe63, description: null },
    XK_dead_abovecomma: { code: 0xfe64, description: null },
    XK_dead_psili: { code: 0xfe64, description: "alias for dead_abovecomma" },
    XK_dead_abovereversedcomma: { code: 0xfe65, description: null },
    XK_dead_dasia: {
        code: 0xfe65,
        description: "alias for dead_abovereversedcomma",
    },
    XK_dead_doublegrave: { code: 0xfe66, description: null },
    XK_dead_belowring: { code: 0xfe67, description: null },
    XK_dead_belowmacron: { code: 0xfe68, description: null },
    XK_dead_belowcircumflex: { code: 0xfe69, description: null },
    XK_dead_belowtilde: { code: 0xfe6a, description: null },
    XK_dead_belowbreve: { code: 0xfe6b, description: null },
    XK_dead_belowdiaeresis: { code: 0xfe6c, description: null },
    XK_dead_invertedbreve: { code: 0xfe6d, description: null },
    XK_dead_belowcomma: { code: 0xfe6e, description: null },
    XK_dead_currency: { code: 0xfe6f, description: null },

    /* extra dead elements for German T3 layout */
    XK_dead_lowline: { code: 0xfe90, description: null },
    XK_dead_aboveverticalline: { code: 0xfe91, description: null },
    XK_dead_belowverticalline: { code: 0xfe92, description: null },
    XK_dead_longsolidusoverlay: { code: 0xfe93, description: null },

    /* dead vowels for universal syllable entry */
    XK_dead_a: { code: 0xfe80, description: null },
    XK_dead_A: { code: 0xfe81, description: null },
    XK_dead_e: { code: 0xfe82, description: null },
    XK_dead_E: { code: 0xfe83, description: null },
    XK_dead_i: { code: 0xfe84, description: null },
    XK_dead_I: { code: 0xfe85, description: null },
    XK_dead_o: { code: 0xfe86, description: null },
    XK_dead_O: { code: 0xfe87, description: null },
    XK_dead_u: { code: 0xfe88, description: null },
    XK_dead_U: { code: 0xfe89, description: null },
    XK_dead_small_schwa: { code: 0xfe8a, description: null },
    XK_dead_capital_schwa: { code: 0xfe8b, description: null },

    XK_dead_greek: { code: 0xfe8c, description: null },

    XK_First_Virtual_Screen: { code: 0xfed0, description: null },
    XK_Prev_Virtual_Screen: { code: 0xfed1, description: null },
    XK_Next_Virtual_Screen: { code: 0xfed2, description: null },
    XK_Last_Virtual_Screen: { code: 0xfed4, description: null },
    XK_Terminate_Server: { code: 0xfed5, description: null },

    XK_AccessX_Enable: { code: 0xfe70, description: null },
    XK_AccessX_Feedback_Enable: { code: 0xfe71, description: null },
    XK_RepeatKeys_Enable: { code: 0xfe72, description: null },
    XK_SlowKeys_Enable: { code: 0xfe73, description: null },
    XK_BounceKeys_Enable: { code: 0xfe74, description: null },
    XK_StickyKeys_Enable: { code: 0xfe75, description: null },
    XK_MouseKeys_Enable: { code: 0xfe76, description: null },
    XK_MouseKeys_Accel_Enable: { code: 0xfe77, description: null },
    XK_Overlay1_Enable: { code: 0xfe78, description: null },
    XK_Overlay2_Enable: { code: 0xfe79, description: null },
    XK_AudibleBell_Enable: { code: 0xfe7a, description: null },

    XK_Pointer_Left: { code: 0xfee0, description: null },
    XK_Pointer_Right: { code: 0xfee1, description: null },
    XK_Pointer_Up: { code: 0xfee2, description: null },
    XK_Pointer_Down: { code: 0xfee3, description: null },
    XK_Pointer_UpLeft: { code: 0xfee4, description: null },
    XK_Pointer_UpRight: { code: 0xfee5, description: null },
    XK_Pointer_DownLeft: { code: 0xfee6, description: null },
    XK_Pointer_DownRight: { code: 0xfee7, description: null },
    XK_Pointer_Button_Dflt: { code: 0xfee8, description: null },
    XK_Pointer_Button1: { code: 0xfee9, description: null },
    XK_Pointer_Button2: { code: 0xfeea, description: null },
    XK_Pointer_Button3: { code: 0xfeeb, description: null },
    XK_Pointer_Button4: { code: 0xfeec, description: null },
    XK_Pointer_Button5: { code: 0xfeed, description: null },
    XK_Pointer_DblClick_Dflt: { code: 0xfeee, description: null },
    XK_Pointer_DblClick1: { code: 0xfeef, description: null },
    XK_Pointer_DblClick2: { code: 0xfef0, description: null },
    XK_Pointer_DblClick3: { code: 0xfef1, description: null },
    XK_Pointer_DblClick4: { code: 0xfef2, description: null },
    XK_Pointer_DblClick5: { code: 0xfef3, description: null },
    XK_Pointer_Drag_Dflt: { code: 0xfef4, description: null },
    XK_Pointer_Drag1: { code: 0xfef5, description: null },
    XK_Pointer_Drag2: { code: 0xfef6, description: null },
    XK_Pointer_Drag3: { code: 0xfef7, description: null },
    XK_Pointer_Drag4: { code: 0xfef8, description: null },
    XK_Pointer_Drag5: { code: 0xfefd, description: null },

    XK_Pointer_EnableKeys: { code: 0xfef9, description: null },
    XK_Pointer_Accelerate: { code: 0xfefa, description: null },
    XK_Pointer_DfltBtnNext: { code: 0xfefb, description: null },
    XK_Pointer_DfltBtnPrev: { code: 0xfefc, description: null },

    /* Single-Stroke Multiple-Character N-Graph Keysyms For The X Input Method */

    XK_ch: { code: 0xfea0, description: null },
    XK_Ch: { code: 0xfea1, description: null },
    XK_CH: { code: 0xfea2, description: null },
    XK_c_h: { code: 0xfea3, description: null },
    XK_C_h: { code: 0xfea4, description: null },
    XK_C_H: { code: 0xfea5, description: null },

    /*
   * 3270 Terminal Keys
   * Byte 3 = 0xfd
   */

    // Group XK_3270
    XK_3270_Duplicate: { code: 0xfd01, description: null },
    XK_3270_FieldMark: { code: 0xfd02, description: null },
    XK_3270_Right2: { code: 0xfd03, description: null },
    XK_3270_Left2: { code: 0xfd04, description: null },
    XK_3270_BackTab: { code: 0xfd05, description: null },
    XK_3270_EraseEOF: { code: 0xfd06, description: null },
    XK_3270_EraseInput: { code: 0xfd07, description: null },
    XK_3270_Reset: { code: 0xfd08, description: null },
    XK_3270_Quit: { code: 0xfd09, description: null },
    XK_3270_PA1: { code: 0xfd0a, description: null },
    XK_3270_PA2: { code: 0xfd0b, description: null },
    XK_3270_PA3: { code: 0xfd0c, description: null },
    XK_3270_Test: { code: 0xfd0d, description: null },
    XK_3270_Attn: { code: 0xfd0e, description: null },
    XK_3270_CursorBlink: { code: 0xfd0f, description: null },
    XK_3270_AltCursor: { code: 0xfd10, description: null },
    XK_3270_KeyClick: { code: 0xfd11, description: null },
    XK_3270_Jump: { code: 0xfd12, description: null },
    XK_3270_Ident: { code: 0xfd13, description: null },
    XK_3270_Rule: { code: 0xfd14, description: null },
    XK_3270_Copy: { code: 0xfd15, description: null },
    XK_3270_Play: { code: 0xfd16, description: null },
    XK_3270_Setup: { code: 0xfd17, description: null },
    XK_3270_Record: { code: 0xfd18, description: null },
    XK_3270_ChangeScreen: { code: 0xfd19, description: null },
    XK_3270_DeleteWord: { code: 0xfd1a, description: null },
    XK_3270_ExSelect: { code: 0xfd1b, description: null },
    XK_3270_CursorSelect: { code: 0xfd1c, description: null },
    XK_3270_PrintScreen: { code: 0xfd1d, description: null },
    XK_3270_Enter: { code: 0xfd1e, description: null },

    /*
   * Latin 1
   * (ISO/IEC 8859-1 = Unicode (\u0020)..U+00FF)
   * Byte 3 = 0
   */
    // Group XK_LATIN1
    XK_space: { code: 0x0020, description: "(\u0020) SPACE" },
    XK_exclam: { code: 0x0021, description: "(\u0021) EXCLAMATION MARK" },
    XK_quotedbl: { code: 0x0022, description: "(\u0022) QUOTATION MARK" },
    XK_numbersign: { code: 0x0023, description: "(\u0023) NUMBER SIGN" },
    XK_dollar: { code: 0x0024, description: "(\u0024) DOLLAR SIGN" },
    XK_percent: { code: 0x0025, description: "(\u0025) PERCENT SIGN" },
    XK_ampersand: { code: 0x0026, description: "(\u0026) AMPERSAND" },
    XK_apostrophe: { code: 0x0027, description: "(\u0027) APOSTROPHE" },
    XK_quoteright: { code: 0x0027, description: "deprecated" },
    XK_parenleft: { code: 0x0028, description: "(\u0028) LEFT PARENTHESIS" },
    XK_parenright: { code: 0x0029, description: "(\u0029) RIGHT PARENTHESIS" },
    XK_asterisk: { code: 0x002a, description: "(\u002A) ASTERISK" },
    XK_plus: { code: 0x002b, description: "(\u002B) PLUS SIGN" },
    XK_comma: { code: 0x002c, description: "(\u002C) COMMA" },
    XK_minus: { code: 0x002d, description: "(\u002D) HYPHEN-MINUS" },
    XK_period: { code: 0x002e, description: "(\u002E) FULL STOP" },
    XK_slash: { code: 0x002f, description: "(\u002F) SOLIDUS" },
    XK_0: { code: 0x0030, description: "(\u0030) DIGIT ZERO" },
    XK_1: { code: 0x0031, description: "(\u0031) DIGIT ONE" },
    XK_2: { code: 0x0032, description: "(\u0032) DIGIT TWO" },
    XK_3: { code: 0x0033, description: "(\u0033) DIGIT THREE" },
    XK_4: { code: 0x0034, description: "(\u0034) DIGIT FOUR" },
    XK_5: { code: 0x0035, description: "(\u0035) DIGIT FIVE" },
    XK_6: { code: 0x0036, description: "(\u0036) DIGIT SIX" },
    XK_7: { code: 0x0037, description: "(\u0037) DIGIT SEVEN" },
    XK_8: { code: 0x0038, description: "(\u0038) DIGIT EIGHT" },
    XK_9: { code: 0x0039, description: "(\u0039) DIGIT NINE" },
    XK_colon: { code: 0x003a, description: "(\u003A) COLON" },
    XK_semicolon: { code: 0x003b, description: "(\u003B) SEMICOLON" },
    XK_less: { code: 0x003c, description: "(\u003C) LESS-THAN SIGN" },
    XK_equal: { code: 0x003d, description: "(\u003D) EQUALS SIGN" },
    XK_greater: { code: 0x003e, description: "(\u003E) GREATER-THAN SIGN" },
    XK_question: { code: 0x003f, description: "(\u003F) QUESTION MARK" },
    XK_at: { code: 0x0040, description: "(\u0040) COMMERCIAL AT" },
    XK_A: { code: 0x0041, description: "(\u0041) LATIN CAPITAL LETTER A" },
    XK_B: { code: 0x0042, description: "(\u0042) LATIN CAPITAL LETTER B" },
    XK_C: { code: 0x0043, description: "(\u0043) LATIN CAPITAL LETTER C" },
    XK_D: { code: 0x0044, description: "(\u0044) LATIN CAPITAL LETTER D" },
    XK_E: { code: 0x0045, description: "(\u0045) LATIN CAPITAL LETTER E" },
    XK_F: { code: 0x0046, description: "(\u0046) LATIN CAPITAL LETTER F" },
    XK_G: { code: 0x0047, description: "(\u0047) LATIN CAPITAL LETTER G" },
    XK_H: { code: 0x0048, description: "(\u0048) LATIN CAPITAL LETTER H" },
    XK_I: { code: 0x0049, description: "(\u0049) LATIN CAPITAL LETTER I" },
    XK_J: { code: 0x004a, description: "(\u004A) LATIN CAPITAL LETTER J" },
    XK_K: { code: 0x004b, description: "(\u004B) LATIN CAPITAL LETTER K" },
    XK_L: { code: 0x004c, description: "(\u004C) LATIN CAPITAL LETTER L" },
    XK_M: { code: 0x004d, description: "(\u004D) LATIN CAPITAL LETTER M" },
    XK_N: { code: 0x004e, description: "(\u004E) LATIN CAPITAL LETTER N" },
    XK_O: { code: 0x004f, description: "(\u004F) LATIN CAPITAL LETTER O" },
    XK_P: { code: 0x0050, description: "(\u0050) LATIN CAPITAL LETTER P" },
    XK_Q: { code: 0x0051, description: "(\u0051) LATIN CAPITAL LETTER Q" },
    XK_R: { code: 0x0052, description: "(\u0052) LATIN CAPITAL LETTER R" },
    XK_S: { code: 0x0053, description: "(\u0053) LATIN CAPITAL LETTER S" },
    XK_T: { code: 0x0054, description: "(\u0054) LATIN CAPITAL LETTER T" },
    XK_U: { code: 0x0055, description: "(\u0055) LATIN CAPITAL LETTER U" },
    XK_V: { code: 0x0056, description: "(\u0056) LATIN CAPITAL LETTER V" },
    XK_W: { code: 0x0057, description: "(\u0057) LATIN CAPITAL LETTER W" },
    XK_X: { code: 0x0058, description: "(\u0058) LATIN CAPITAL LETTER X" },
    XK_Y: { code: 0x0059, description: "(\u0059) LATIN CAPITAL LETTER Y" },
    XK_Z: { code: 0x005a, description: "(\u005A) LATIN CAPITAL LETTER Z" },
    XK_bracketleft: { code: 0x005b, description: "(\u005B) LEFT SQUARE BRACKET" },
    XK_backslash: { code: 0x005c, description: "(\u005C) REVERSE SOLIDUS" },
    XK_bracketright: {
        code: 0x005d,
        description: "(\u005D) RIGHT SQUARE BRACKET",
    },
    XK_asciicircum: { code: 0x005e, description: "(\u005E) CIRCUMFLEX ACCENT" },
    XK_underscore: { code: 0x005f, description: "(\u005F) LOW LINE" },
    XK_grave: { code: 0x0060, description: "(\u0060) GRAVE ACCENT" },
    XK_quoteleft: { code: 0x0060, description: "deprecated" },
    XK_a: { code: 0x0061, description: "(\u0061) LATIN SMALL LETTER A" },
    XK_b: { code: 0x0062, description: "(\u0062) LATIN SMALL LETTER B" },
    XK_c: { code: 0x0063, description: "(\u0063) LATIN SMALL LETTER C" },
    XK_d: { code: 0x0064, description: "(\u0064) LATIN SMALL LETTER D" },
    XK_e: { code: 0x0065, description: "(\u0065) LATIN SMALL LETTER E" },
    XK_f: { code: 0x0066, description: "(\u0066) LATIN SMALL LETTER F" },
    XK_g: { code: 0x0067, description: "(\u0067) LATIN SMALL LETTER G" },
    XK_h: { code: 0x0068, description: "(\u0068) LATIN SMALL LETTER H" },
    XK_i: { code: 0x0069, description: "(\u0069) LATIN SMALL LETTER I" },
    XK_j: { code: 0x006a, description: "(\u006A) LATIN SMALL LETTER J" },
    XK_k: { code: 0x006b, description: "(\u006B) LATIN SMALL LETTER K" },
    XK_l: { code: 0x006c, description: "(\u006C) LATIN SMALL LETTER L" },
    XK_m: { code: 0x006d, description: "(\u006D) LATIN SMALL LETTER M" },
    XK_n: { code: 0x006e, description: "(\u006E) LATIN SMALL LETTER N" },
    XK_o: { code: 0x006f, description: "(\u006F) LATIN SMALL LETTER O" },
    XK_p: { code: 0x0070, description: "(\u0070) LATIN SMALL LETTER P" },
    XK_q: { code: 0x0071, description: "(\u0071) LATIN SMALL LETTER Q" },
    XK_r: { code: 0x0072, description: "(\u0072) LATIN SMALL LETTER R" },
    XK_s: { code: 0x0073, description: "(\u0073) LATIN SMALL LETTER S" },
    XK_t: { code: 0x0074, description: "(\u0074) LATIN SMALL LETTER T" },
    XK_u: { code: 0x0075, description: "(\u0075) LATIN SMALL LETTER U" },
    XK_v: { code: 0x0076, description: "(\u0076) LATIN SMALL LETTER V" },
    XK_w: { code: 0x0077, description: "(\u0077) LATIN SMALL LETTER W" },
    XK_x: { code: 0x0078, description: "(\u0078) LATIN SMALL LETTER X" },
    XK_y: { code: 0x0079, description: "(\u0079) LATIN SMALL LETTER Y" },
    XK_z: { code: 0x007a, description: "(\u007A) LATIN SMALL LETTER Z" },
    XK_braceleft: { code: 0x007b, description: "(\u007B) LEFT CURLY BRACKET" },
    XK_bar: { code: 0x007c, description: "(\u007C) VERTICAL LINE" },
    XK_braceright: { code: 0x007d, description: "(\u007D) RIGHT CURLY BRACKET" },
    XK_asciitilde: { code: 0x007e, description: "(\u007E) TILDE" },

    XK_nobreakspace: { code: 0x00a0, description: "(\u00A0) NO-BREAK SPACE" },
    XK_exclamdown: {
        code: 0x00a1,
        description: "(\u00A1) INVERTED EXCLAMATION MARK",
    },
    XK_cent: { code: 0x00a2, description: "(\u00A2) CENT SIGN" },
    XK_sterling: { code: 0x00a3, description: "(\u00A3) POUND SIGN" },
    XK_currency: { code: 0x00a4, description: "(\u00A4) CURRENCY SIGN" },
    XK_yen: { code: 0x00a5, description: "(\u00A5) YEN SIGN" },
    XK_brokenbar: { code: 0x00a6, description: "(\u00A6) BROKEN BAR" },
    XK_section: { code: 0x00a7, description: "(\u00A7) SECTION SIGN" },
    XK_diaeresis: { code: 0x00a8, description: "(\u00A8) DIAERESIS" },
    XK_copyright: { code: 0x00a9, description: "(\u00A9) COPYRIGHT SIGN" },
    XK_ordfeminine: {
        code: 0x00aa,
        description: "(\u00AA) FEMININE ORDINAL INDICATOR",
    },
    XK_guillemotleft: {
        code: 0x00ab,
        description: "(\u00AB) LEFT-POINTING DOUBLE ANGLE QUOTATION MARK",
    },
    XK_notsign: { code: 0x00ac, description: "(\u00AC) NOT SIGN" },
    XK_hyphen: { code: 0x00ad, description: "(\u00AD) SOFT HYPHEN" },
    XK_registered: { code: 0x00ae, description: "(\u00AE) REGISTERED SIGN" },
    XK_macron: { code: 0x00af, description: "(\u00AF) MACRON" },
    XK_degree: { code: 0x00b0, description: "(\u00B0) DEGREE SIGN" },
    XK_plusminus: { code: 0x00b1, description: "(\u00B1) PLUS-MINUS SIGN" },
    XK_twosuperior: { code: 0x00b2, description: "(\u00B2) SUPERSCRIPT TWO" },
    XK_threesuperior: { code: 0x00b3, description: "(\u00B3) SUPERSCRIPT THREE" },
    XK_acute: { code: 0x00b4, description: "(\u00B4) ACUTE ACCENT" },
    XK_mu: { code: 0x00b5, description: "(\u00B5) MICRO SIGN" },
    XK_paragraph: { code: 0x00b6, description: "(\u00B6) PILCROW SIGN" },
    XK_periodcentered: { code: 0x00b7, description: "(\u00B7) MIDDLE DOT" },
    XK_cedilla: { code: 0x00b8, description: "(\u00B8) CEDILLA" },
    XK_onesuperior: { code: 0x00b9, description: "(\u00B9) SUPERSCRIPT ONE" },
    XK_masculine: {
        code: 0x00ba,
        description: "(\u00BA) MASCULINE ORDINAL INDICATOR",
    },
    XK_guillemotright: {
        code: 0x00bb,
        description: "(\u00BB) RIGHT-POINTING DOUBLE ANGLE QUOTATION MARK",
    },
    XK_onequarter: {
        code: 0x00bc,
        description: "(\u00BC) VULGAR FRACTION ONE QUARTER",
    },
    XK_onehalf: {
        code: 0x00bd,
        description: "(\u00BD) VULGAR FRACTION ONE HALF",
    },
    XK_threequarters: {
        code: 0x00be,
        description: "(\u00BE) VULGAR FRACTION THREE QUARTERS",
    },
    XK_questiondown: {
        code: 0x00bf,
        description: "(\u00BF) INVERTED QUESTION MARK",
    },
    XK_Agrave: {
        code: 0x00c0,
        description: "(\u00C0) LATIN CAPITAL LETTER A WITH GRAVE",
    },
    XK_Aacute: {
        code: 0x00c1,
        description: "(\u00C1) LATIN CAPITAL LETTER A WITH ACUTE",
    },
    XK_Acircumflex: {
        code: 0x00c2,
        description: "(\u00C2) LATIN CAPITAL LETTER A WITH CIRCUMFLEX",
    },
    XK_Atilde: {
        code: 0x00c3,
        description: "(\u00C3) LATIN CAPITAL LETTER A WITH TILDE",
    },
    XK_Adiaeresis: {
        code: 0x00c4,
        description: "(\u00C4) LATIN CAPITAL LETTER A WITH DIAERESIS",
    },
    XK_Aring: {
        code: 0x00c5,
        description: "(\u00C5) LATIN CAPITAL LETTER A WITH RING ABOVE",
    },
    XK_AE: { code: 0x00c6, description: "(\u00C6) LATIN CAPITAL LETTER AE" },
    XK_Ccedilla: {
        code: 0x00c7,
        description: "(\u00C7) LATIN CAPITAL LETTER C WITH CEDILLA",
    },
    XK_Egrave: {
        code: 0x00c8,
        description: "(\u00C8) LATIN CAPITAL LETTER E WITH GRAVE",
    },
    XK_Eacute: {
        code: 0x00c9,
        description: "(\u00C9) LATIN CAPITAL LETTER E WITH ACUTE",
    },
    XK_Ecircumflex: {
        code: 0x00ca,
        description: "(\u00CA) LATIN CAPITAL LETTER E WITH CIRCUMFLEX",
    },
    XK_Ediaeresis: {
        code: 0x00cb,
        description: "(\u00CB) LATIN CAPITAL LETTER E WITH DIAERESIS",
    },
    XK_Igrave: {
        code: 0x00cc,
        description: "(\u00CC) LATIN CAPITAL LETTER I WITH GRAVE",
    },
    XK_Iacute: {
        code: 0x00cd,
        description: "(\u00CD) LATIN CAPITAL LETTER I WITH ACUTE",
    },
    XK_Icircumflex: {
        code: 0x00ce,
        description: "(\u00CE) LATIN CAPITAL LETTER I WITH CIRCUMFLEX",
    },
    XK_Idiaeresis: {
        code: 0x00cf,
        description: "(\u00CF) LATIN CAPITAL LETTER I WITH DIAERESIS",
    },
    XK_ETH: { code: 0x00d0, description: "(\u00D0) LATIN CAPITAL LETTER ETH" },
    XK_Eth: { code: 0x00d0, description: "deprecated" },
    XK_Ntilde: {
        code: 0x00d1,
        description: "(\u00D1) LATIN CAPITAL LETTER N WITH TILDE",
    },
    XK_Ograve: {
        code: 0x00d2,
        description: "(\u00D2) LATIN CAPITAL LETTER O WITH GRAVE",
    },
    XK_Oacute: {
        code: 0x00d3,
        description: "(\u00D3) LATIN CAPITAL LETTER O WITH ACUTE",
    },
    XK_Ocircumflex: {
        code: 0x00d4,
        description: "(\u00D4) LATIN CAPITAL LETTER O WITH CIRCUMFLEX",
    },
    XK_Otilde: {
        code: 0x00d5,
        description: "(\u00D5) LATIN CAPITAL LETTER O WITH TILDE",
    },
    XK_Odiaeresis: {
        code: 0x00d6,
        description: "(\u00D6) LATIN CAPITAL LETTER O WITH DIAERESIS",
    },
    XK_multiply: { code: 0x00d7, description: "(\u00D7) MULTIPLICATION SIGN" },
    XK_Oslash: {
        code: 0x00d8,
        description: "(\u00D8) LATIN CAPITAL LETTER O WITH STROKE",
    },
    XK_Ooblique: {
        code: 0x00d8,
        description: "(\u00D8) LATIN CAPITAL LETTER O WITH STROKE",
    },
    XK_Ugrave: {
        code: 0x00d9,
        description: "(\u00D9) LATIN CAPITAL LETTER U WITH GRAVE",
    },
    XK_Uacute: {
        code: 0x00da,
        description: "(\u00DA) LATIN CAPITAL LETTER U WITH ACUTE",
    },
    XK_Ucircumflex: {
        code: 0x00db,
        description: "(\u00DB) LATIN CAPITAL LETTER U WITH CIRCUMFLEX",
    },
    XK_Udiaeresis: {
        code: 0x00dc,
        description: "(\u00DC) LATIN CAPITAL LETTER U WITH DIAERESIS",
    },
    XK_Yacute: {
        code: 0x00dd,
        description: "(\u00DD) LATIN CAPITAL LETTER Y WITH ACUTE",
    },
    XK_THORN: {
        code: 0x00de,
        description: "(\u00DE) LATIN CAPITAL LETTER THORN",
    },
    XK_Thorn: { code: 0x00de, description: "deprecated" },
    XK_ssharp: {
        code: 0x00df,
        description: "(\u00DF) LATIN SMALL LETTER SHARP S",
    },
    XK_agrave: {
        code: 0x00e0,
        description: "(\u00E0) LATIN SMALL LETTER A WITH GRAVE",
    },
    XK_aacute: {
        code: 0x00e1,
        description: "(\u00E1) LATIN SMALL LETTER A WITH ACUTE",
    },
    XK_acircumflex: {
        code: 0x00e2,
        description: "(\u00E2) LATIN SMALL LETTER A WITH CIRCUMFLEX",
    },
    XK_atilde: {
        code: 0x00e3,
        description: "(\u00E3) LATIN SMALL LETTER A WITH TILDE",
    },
    XK_adiaeresis: {
        code: 0x00e4,
        description: "(\u00E4) LATIN SMALL LETTER A WITH DIAERESIS",
    },
    XK_aring: {
        code: 0x00e5,
        description: "(\u00E5) LATIN SMALL LETTER A WITH RING ABOVE",
    },
    XK_ae: { code: 0x00e6, description: "(\u00E6) LATIN SMALL LETTER AE" },
    XK_ccedilla: {
        code: 0x00e7,
        description: "(\u00E7) LATIN SMALL LETTER C WITH CEDILLA",
    },
    XK_egrave: {
        code: 0x00e8,
        description: "(\u00E8) LATIN SMALL LETTER E WITH GRAVE",
    },
    XK_eacute: {
        code: 0x00e9,
        description: "(\u00E9) LATIN SMALL LETTER E WITH ACUTE",
    },
    XK_ecircumflex: {
        code: 0x00ea,
        description: "(\u00EA) LATIN SMALL LETTER E WITH CIRCUMFLEX",
    },
    XK_ediaeresis: {
        code: 0x00eb,
        description: "(\u00EB) LATIN SMALL LETTER E WITH DIAERESIS",
    },
    XK_igrave: {
        code: 0x00ec,
        description: "(\u00EC) LATIN SMALL LETTER I WITH GRAVE",
    },
    XK_iacute: {
        code: 0x00ed,
        description: "(\u00ED) LATIN SMALL LETTER I WITH ACUTE",
    },
    XK_icircumflex: {
        code: 0x00ee,
        description: "(\u00EE) LATIN SMALL LETTER I WITH CIRCUMFLEX",
    },
    XK_idiaeresis: {
        code: 0x00ef,
        description: "(\u00EF) LATIN SMALL LETTER I WITH DIAERESIS",
    },
    XK_eth: { code: 0x00f0, description: "(\u00F0) LATIN SMALL LETTER ETH" },
    XK_ntilde: {
        code: 0x00f1,
        description: "(\u00F1) LATIN SMALL LETTER N WITH TILDE",
    },
    XK_ograve: {
        code: 0x00f2,
        description: "(\u00F2) LATIN SMALL LETTER O WITH GRAVE",
    },
    XK_oacute: {
        code: 0x00f3,
        description: "(\u00F3) LATIN SMALL LETTER O WITH ACUTE",
    },
    XK_ocircumflex: {
        code: 0x00f4,
        description: "(\u00F4) LATIN SMALL LETTER O WITH CIRCUMFLEX",
    },
    XK_otilde: {
        code: 0x00f5,
        description: "(\u00F5) LATIN SMALL LETTER O WITH TILDE",
    },
    XK_odiaeresis: {
        code: 0x00f6,
        description: "(\u00F6) LATIN SMALL LETTER O WITH DIAERESIS",
    },
    XK_division: { code: 0x00f7, description: "(\u00F7) DIVISION SIGN" },
    XK_oslash: {
        code: 0x00f8,
        description: "(\u00F8) LATIN SMALL LETTER O WITH STROKE",
    },
    XK_ooblique: {
        code: 0x00f8,
        description: "(\u00F8) LATIN SMALL LETTER O WITH STROKE",
    },
    XK_ugrave: {
        code: 0x00f9,
        description: "(\u00F9) LATIN SMALL LETTER U WITH GRAVE",
    },
    XK_uacute: {
        code: 0x00fa,
        description: "(\u00FA) LATIN SMALL LETTER U WITH ACUTE",
    },
    XK_ucircumflex: {
        code: 0x00fb,
        description: "(\u00FB) LATIN SMALL LETTER U WITH CIRCUMFLEX",
    },
    XK_udiaeresis: {
        code: 0x00fc,
        description: "(\u00FC) LATIN SMALL LETTER U WITH DIAERESIS",
    },
    XK_yacute: {
        code: 0x00fd,
        description: "(\u00FD) LATIN SMALL LETTER Y WITH ACUTE",
    },
    XK_thorn: { code: 0x00fe, description: "(\u00FE) LATIN SMALL LETTER THORN" },
    XK_ydiaeresis: {
        code: 0x00ff,
        description: "(\u00FF) LATIN SMALL LETTER Y WITH DIAERESIS",
    },

    /*
   * Latin 2
   * Byte 3 = 1
   */

    // Group XK_LATIN2
    XK_Aogonek: {
        code: 0x01a1,
        description: "(\u0104) LATIN CAPITAL LETTER A WITH OGONEK",
    },
    XK_breve: { code: 0x01a2, description: "(\u02D8) BREVE" },
    XK_Lstroke: {
        code: 0x01a3,
        description: "(\u0141) LATIN CAPITAL LETTER L WITH STROKE",
    },
    XK_Lcaron: {
        code: 0x01a5,
        description: "(\u013D) LATIN CAPITAL LETTER L WITH CARON",
    },
    XK_Sacute: {
        code: 0x01a6,
        description: "(\u015A) LATIN CAPITAL LETTER S WITH ACUTE",
    },
    XK_Scaron: {
        code: 0x01a9,
        description: "(\u0160) LATIN CAPITAL LETTER S WITH CARON",
    },
    XK_Scedilla: {
        code: 0x01aa,
        description: "(\u015E) LATIN CAPITAL LETTER S WITH CEDILLA",
    },
    XK_Tcaron: {
        code: 0x01ab,
        description: "(\u0164) LATIN CAPITAL LETTER T WITH CARON",
    },
    XK_Zacute: {
        code: 0x01ac,
        description: "(\u0179) LATIN CAPITAL LETTER Z WITH ACUTE",
    },
    XK_Zcaron: {
        code: 0x01ae,
        description: "(\u017D) LATIN CAPITAL LETTER Z WITH CARON",
    },
    XK_Zabovedot: {
        code: 0x01af,
        description: "(\u017B) LATIN CAPITAL LETTER Z WITH DOT ABOVE",
    },
    XK_aogonek: {
        code: 0x01b1,
        description: "(\u0105) LATIN SMALL LETTER A WITH OGONEK",
    },
    XK_ogonek: { code: 0x01b2, description: "(\u02DB) OGONEK" },
    XK_lstroke: {
        code: 0x01b3,
        description: "(\u0142) LATIN SMALL LETTER L WITH STROKE",
    },
    XK_lcaron: {
        code: 0x01b5,
        description: "(\u013E) LATIN SMALL LETTER L WITH CARON",
    },
    XK_sacute: {
        code: 0x01b6,
        description: "(\u015B) LATIN SMALL LETTER S WITH ACUTE",
    },
    XK_caron: { code: 0x01b7, description: "(\u02C7) CARON" },
    XK_scaron: {
        code: 0x01b9,
        description: "(\u0161) LATIN SMALL LETTER S WITH CARON",
    },
    XK_scedilla: {
        code: 0x01ba,
        description: "(\u015F) LATIN SMALL LETTER S WITH CEDILLA",
    },
    XK_tcaron: {
        code: 0x01bb,
        description: "(\u0165) LATIN SMALL LETTER T WITH CARON",
    },
    XK_zacute: {
        code: 0x01bc,
        description: "(\u017A) LATIN SMALL LETTER Z WITH ACUTE",
    },
    XK_doubleacute: { code: 0x01bd, description: "(\u02DD) DOUBLE ACUTE ACCENT" },
    XK_zcaron: {
        code: 0x01be,
        description: "(\u017E) LATIN SMALL LETTER Z WITH CARON",
    },
    XK_zabovedot: {
        code: 0x01bf,
        description: "(\u017C) LATIN SMALL LETTER Z WITH DOT ABOVE",
    },
    XK_Racute: {
        code: 0x01c0,
        description: "(\u0154) LATIN CAPITAL LETTER R WITH ACUTE",
    },
    XK_Abreve: {
        code: 0x01c3,
        description: "(\u0102) LATIN CAPITAL LETTER A WITH BREVE",
    },
    XK_Lacute: {
        code: 0x01c5,
        description: "(\u0139) LATIN CAPITAL LETTER L WITH ACUTE",
    },
    XK_Cacute: {
        code: 0x01c6,
        description: "(\u0106) LATIN CAPITAL LETTER C WITH ACUTE",
    },
    XK_Ccaron: {
        code: 0x01c8,
        description: "(\u010C) LATIN CAPITAL LETTER C WITH CARON",
    },
    XK_Eogonek: {
        code: 0x01ca,
        description: "(\u0118) LATIN CAPITAL LETTER E WITH OGONEK",
    },
    XK_Ecaron: {
        code: 0x01cc,
        description: "(\u011A) LATIN CAPITAL LETTER E WITH CARON",
    },
    XK_Dcaron: {
        code: 0x01cf,
        description: "(\u010E) LATIN CAPITAL LETTER D WITH CARON",
    },
    XK_Dstroke: {
        code: 0x01d0,
        description: "(\u0110) LATIN CAPITAL LETTER D WITH STROKE",
    },
    XK_Nacute: {
        code: 0x01d1,
        description: "(\u0143) LATIN CAPITAL LETTER N WITH ACUTE",
    },
    XK_Ncaron: {
        code: 0x01d2,
        description: "(\u0147) LATIN CAPITAL LETTER N WITH CARON",
    },
    XK_Odoubleacute: {
        code: 0x01d5,
        description: "(\u0150) LATIN CAPITAL LETTER O WITH DOUBLE ACUTE",
    },
    XK_Rcaron: {
        code: 0x01d8,
        description: "(\u0158) LATIN CAPITAL LETTER R WITH CARON",
    },
    XK_Uring: {
        code: 0x01d9,
        description: "(\u016E) LATIN CAPITAL LETTER U WITH RING ABOVE",
    },
    XK_Udoubleacute: {
        code: 0x01db,
        description: "(\u0170) LATIN CAPITAL LETTER U WITH DOUBLE ACUTE",
    },
    XK_Tcedilla: {
        code: 0x01de,
        description: "(\u0162) LATIN CAPITAL LETTER T WITH CEDILLA",
    },
    XK_racute: {
        code: 0x01e0,
        description: "(\u0155) LATIN SMALL LETTER R WITH ACUTE",
    },
    XK_abreve: {
        code: 0x01e3,
        description: "(\u0103) LATIN SMALL LETTER A WITH BREVE",
    },
    XK_lacute: {
        code: 0x01e5,
        description: "(\u013A) LATIN SMALL LETTER L WITH ACUTE",
    },
    XK_cacute: {
        code: 0x01e6,
        description: "(\u0107) LATIN SMALL LETTER C WITH ACUTE",
    },
    XK_ccaron: {
        code: 0x01e8,
        description: "(\u010D) LATIN SMALL LETTER C WITH CARON",
    },
    XK_eogonek: {
        code: 0x01ea,
        description: "(\u0119) LATIN SMALL LETTER E WITH OGONEK",
    },
    XK_ecaron: {
        code: 0x01ec,
        description: "(\u011B) LATIN SMALL LETTER E WITH CARON",
    },
    XK_dcaron: {
        code: 0x01ef,
        description: "(\u010F) LATIN SMALL LETTER D WITH CARON",
    },
    XK_dstroke: {
        code: 0x01f0,
        description: "(\u0111) LATIN SMALL LETTER D WITH STROKE",
    },
    XK_nacute: {
        code: 0x01f1,
        description: "(\u0144) LATIN SMALL LETTER N WITH ACUTE",
    },
    XK_ncaron: {
        code: 0x01f2,
        description: "(\u0148) LATIN SMALL LETTER N WITH CARON",
    },
    XK_odoubleacute: {
        code: 0x01f5,
        description: "(\u0151) LATIN SMALL LETTER O WITH DOUBLE ACUTE",
    },
    XK_rcaron: {
        code: 0x01f8,
        description: "(\u0159) LATIN SMALL LETTER R WITH CARON",
    },
    XK_uring: {
        code: 0x01f9,
        description: "(\u016F) LATIN SMALL LETTER U WITH RING ABOVE",
    },
    XK_udoubleacute: {
        code: 0x01fb,
        description: "(\u0171) LATIN SMALL LETTER U WITH DOUBLE ACUTE",
    },
    XK_tcedilla: {
        code: 0x01fe,
        description: "(\u0163) LATIN SMALL LETTER T WITH CEDILLA",
    },
    XK_abovedot: { code: 0x01ff, description: "(\u02D9) DOT ABOVE" },

    /*
   * Latin 3
   * Byte 3 = 2
   */

    // Group XK_LATIN3
    XK_Hstroke: {
        code: 0x02a1,
        description: "(\u0126) LATIN CAPITAL LETTER H WITH STROKE",
    },
    XK_Hcircumflex: {
        code: 0x02a6,
        description: "(\u0124) LATIN CAPITAL LETTER H WITH CIRCUMFLEX",
    },
    XK_Iabovedot: {
        code: 0x02a9,
        description: "(\u0130) LATIN CAPITAL LETTER I WITH DOT ABOVE",
    },
    XK_Gbreve: {
        code: 0x02ab,
        description: "(\u011E) LATIN CAPITAL LETTER G WITH BREVE",
    },
    XK_Jcircumflex: {
        code: 0x02ac,
        description: "(\u0134) LATIN CAPITAL LETTER J WITH CIRCUMFLEX",
    },
    XK_hstroke: {
        code: 0x02b1,
        description: "(\u0127) LATIN SMALL LETTER H WITH STROKE",
    },
    XK_hcircumflex: {
        code: 0x02b6,
        description: "(\u0125) LATIN SMALL LETTER H WITH CIRCUMFLEX",
    },
    XK_idotless: {
        code: 0x02b9,
        description: "(\u0131) LATIN SMALL LETTER DOTLESS I",
    },
    XK_gbreve: {
        code: 0x02bb,
        description: "(\u011F) LATIN SMALL LETTER G WITH BREVE",
    },
    XK_jcircumflex: {
        code: 0x02bc,
        description: "(\u0135) LATIN SMALL LETTER J WITH CIRCUMFLEX",
    },
    XK_Cabovedot: {
        code: 0x02c5,
        description: "(\u010A) LATIN CAPITAL LETTER C WITH DOT ABOVE",
    },
    XK_Ccircumflex: {
        code: 0x02c6,
        description: "(\u0108) LATIN CAPITAL LETTER C WITH CIRCUMFLEX",
    },
    XK_Gabovedot: {
        code: 0x02d5,
        description: "(\u0120) LATIN CAPITAL LETTER G WITH DOT ABOVE",
    },
    XK_Gcircumflex: {
        code: 0x02d8,
        description: "(\u011C) LATIN CAPITAL LETTER G WITH CIRCUMFLEX",
    },
    XK_Ubreve: {
        code: 0x02dd,
        description: "(\u016C) LATIN CAPITAL LETTER U WITH BREVE",
    },
    XK_Scircumflex: {
        code: 0x02de,
        description: "(\u015C) LATIN CAPITAL LETTER S WITH CIRCUMFLEX",
    },
    XK_cabovedot: {
        code: 0x02e5,
        description: "(\u010B) LATIN SMALL LETTER C WITH DOT ABOVE",
    },
    XK_ccircumflex: {
        code: 0x02e6,
        description: "(\u0109) LATIN SMALL LETTER C WITH CIRCUMFLEX",
    },
    XK_gabovedot: {
        code: 0x02f5,
        description: "(\u0121) LATIN SMALL LETTER G WITH DOT ABOVE",
    },
    XK_gcircumflex: {
        code: 0x02f8,
        description: "(\u011D) LATIN SMALL LETTER G WITH CIRCUMFLEX",
    },
    XK_ubreve: {
        code: 0x02fd,
        description: "(\u016D) LATIN SMALL LETTER U WITH BREVE",
    },
    XK_scircumflex: {
        code: 0x02fe,
        description: "(\u015D) LATIN SMALL LETTER S WITH CIRCUMFLEX",
    },

    /*
   * Latin 4
   * Byte 3 = 3
   */

    // Group XK_LATIN4
    XK_kra: { code: 0x03a2, description: "(\u0138) LATIN SMALL LETTER KRA" },
    XK_kappa: { code: 0x03a2, description: "deprecated" },
    XK_Rcedilla: {
        code: 0x03a3,
        description: "(\u0156) LATIN CAPITAL LETTER R WITH CEDILLA",
    },
    XK_Itilde: {
        code: 0x03a5,
        description: "(\u0128) LATIN CAPITAL LETTER I WITH TILDE",
    },
    XK_Lcedilla: {
        code: 0x03a6,
        description: "(\u013B) LATIN CAPITAL LETTER L WITH CEDILLA",
    },
    XK_Emacron: {
        code: 0x03aa,
        description: "(\u0112) LATIN CAPITAL LETTER E WITH MACRON",
    },
    XK_Gcedilla: {
        code: 0x03ab,
        description: "(\u0122) LATIN CAPITAL LETTER G WITH CEDILLA",
    },
    XK_Tslash: {
        code: 0x03ac,
        description: "(\u0166) LATIN CAPITAL LETTER T WITH STROKE",
    },
    XK_rcedilla: {
        code: 0x03b3,
        description: "(\u0157) LATIN SMALL LETTER R WITH CEDILLA",
    },
    XK_itilde: {
        code: 0x03b5,
        description: "(\u0129) LATIN SMALL LETTER I WITH TILDE",
    },
    XK_lcedilla: {
        code: 0x03b6,
        description: "(\u013C) LATIN SMALL LETTER L WITH CEDILLA",
    },
    XK_emacron: {
        code: 0x03ba,
        description: "(\u0113) LATIN SMALL LETTER E WITH MACRON",
    },
    XK_gcedilla: {
        code: 0x03bb,
        description: "(\u0123) LATIN SMALL LETTER G WITH CEDILLA",
    },
    XK_tslash: {
        code: 0x03bc,
        description: "(\u0167) LATIN SMALL LETTER T WITH STROKE",
    },
    XK_ENG: { code: 0x03bd, description: "(\u014A) LATIN CAPITAL LETTER ENG" },
    XK_eng: { code: 0x03bf, description: "(\u014B) LATIN SMALL LETTER ENG" },
    XK_Amacron: {
        code: 0x03c0,
        description: "(\u0100) LATIN CAPITAL LETTER A WITH MACRON",
    },
    XK_Iogonek: {
        code: 0x03c7,
        description: "(\u012E) LATIN CAPITAL LETTER I WITH OGONEK",
    },
    XK_Eabovedot: {
        code: 0x03cc,
        description: "(\u0116) LATIN CAPITAL LETTER E WITH DOT ABOVE",
    },
    XK_Imacron: {
        code: 0x03cf,
        description: "(\u012A) LATIN CAPITAL LETTER I WITH MACRON",
    },
    XK_Ncedilla: {
        code: 0x03d1,
        description: "(\u0145) LATIN CAPITAL LETTER N WITH CEDILLA",
    },
    XK_Omacron: {
        code: 0x03d2,
        description: "(\u014C) LATIN CAPITAL LETTER O WITH MACRON",
    },
    XK_Kcedilla: {
        code: 0x03d3,
        description: "(\u0136) LATIN CAPITAL LETTER K WITH CEDILLA",
    },
    XK_Uogonek: {
        code: 0x03d9,
        description: "(\u0172) LATIN CAPITAL LETTER U WITH OGONEK",
    },
    XK_Utilde: {
        code: 0x03dd,
        description: "(\u0168) LATIN CAPITAL LETTER U WITH TILDE",
    },
    XK_Umacron: {
        code: 0x03de,
        description: "(\u016A) LATIN CAPITAL LETTER U WITH MACRON",
    },
    XK_amacron: {
        code: 0x03e0,
        description: "(\u0101) LATIN SMALL LETTER A WITH MACRON",
    },
    XK_iogonek: {
        code: 0x03e7,
        description: "(\u012F) LATIN SMALL LETTER I WITH OGONEK",
    },
    XK_eabovedot: {
        code: 0x03ec,
        description: "(\u0117) LATIN SMALL LETTER E WITH DOT ABOVE",
    },
    XK_imacron: {
        code: 0x03ef,
        description: "(\u012B) LATIN SMALL LETTER I WITH MACRON",
    },
    XK_ncedilla: {
        code: 0x03f1,
        description: "(\u0146) LATIN SMALL LETTER N WITH CEDILLA",
    },
    XK_omacron: {
        code: 0x03f2,
        description: "(\u014D) LATIN SMALL LETTER O WITH MACRON",
    },
    XK_kcedilla: {
        code: 0x03f3,
        description: "(\u0137) LATIN SMALL LETTER K WITH CEDILLA",
    },
    XK_uogonek: {
        code: 0x03f9,
        description: "(\u0173) LATIN SMALL LETTER U WITH OGONEK",
    },
    XK_utilde: {
        code: 0x03fd,
        description: "(\u0169) LATIN SMALL LETTER U WITH TILDE",
    },
    XK_umacron: {
        code: 0x03fe,
        description: "(\u016B) LATIN SMALL LETTER U WITH MACRON",
    },

    /*
   * Latin 8
   */
    // Group XK_LATIN8
    XK_Wcircumflex: {
        code: 0x1000174,
        description: "(\u0174) LATIN CAPITAL LETTER W WITH CIRCUMFLEX",
    },
    XK_wcircumflex: {
        code: 0x1000175,
        description: "(\u0175) LATIN SMALL LETTER W WITH CIRCUMFLEX",
    },
    XK_Ycircumflex: {
        code: 0x1000176,
        description: "(\u0176) LATIN CAPITAL LETTER Y WITH CIRCUMFLEX",
    },
    XK_ycircumflex: {
        code: 0x1000177,
        description: "(\u0177) LATIN SMALL LETTER Y WITH CIRCUMFLEX",
    },
    XK_Babovedot: {
        code: 0x1001e02,
        description: "(\u1E02) LATIN CAPITAL LETTER B WITH DOT ABOVE",
    },
    XK_babovedot: {
        code: 0x1001e03,
        description: "(\u1E03) LATIN SMALL LETTER B WITH DOT ABOVE",
    },
    XK_Dabovedot: {
        code: 0x1001e0a,
        description: "(\u1E0A) LATIN CAPITAL LETTER D WITH DOT ABOVE",
    },
    XK_dabovedot: {
        code: 0x1001e0b,
        description: "(\u1E0B) LATIN SMALL LETTER D WITH DOT ABOVE",
    },
    XK_Fabovedot: {
        code: 0x1001e1e,
        description: "(\u1E1E) LATIN CAPITAL LETTER F WITH DOT ABOVE",
    },
    XK_fabovedot: {
        code: 0x1001e1f,
        description: "(\u1E1F) LATIN SMALL LETTER F WITH DOT ABOVE",
    },
    XK_Mabovedot: {
        code: 0x1001e40,
        description: "(\u1E40) LATIN CAPITAL LETTER M WITH DOT ABOVE",
    },
    XK_mabovedot: {
        code: 0x1001e41,
        description: "(\u1E41) LATIN SMALL LETTER M WITH DOT ABOVE",
    },
    XK_Pabovedot: {
        code: 0x1001e56,
        description: "(\u1E56) LATIN CAPITAL LETTER P WITH DOT ABOVE",
    },
    XK_pabovedot: {
        code: 0x1001e57,
        description: "(\u1E57) LATIN SMALL LETTER P WITH DOT ABOVE",
    },
    XK_Sabovedot: {
        code: 0x1001e60,
        description: "(\u1E60) LATIN CAPITAL LETTER S WITH DOT ABOVE",
    },
    XK_sabovedot: {
        code: 0x1001e61,
        description: "(\u1E61) LATIN SMALL LETTER S WITH DOT ABOVE",
    },
    XK_Tabovedot: {
        code: 0x1001e6a,
        description: "(\u1E6A) LATIN CAPITAL LETTER T WITH DOT ABOVE",
    },
    XK_tabovedot: {
        code: 0x1001e6b,
        description: "(\u1E6B) LATIN SMALL LETTER T WITH DOT ABOVE",
    },
    XK_Wgrave: {
        code: 0x1001e80,
        description: "(\u1E80) LATIN CAPITAL LETTER W WITH GRAVE",
    },
    XK_wgrave: {
        code: 0x1001e81,
        description: "(\u1E81) LATIN SMALL LETTER W WITH GRAVE",
    },
    XK_Wacute: {
        code: 0x1001e82,
        description: "(\u1E82) LATIN CAPITAL LETTER W WITH ACUTE",
    },
    XK_wacute: {
        code: 0x1001e83,
        description: "(\u1E83) LATIN SMALL LETTER W WITH ACUTE",
    },
    XK_Wdiaeresis: {
        code: 0x1001e84,
        description: "(\u1E84) LATIN CAPITAL LETTER W WITH DIAERESIS",
    },
    XK_wdiaeresis: {
        code: 0x1001e85,
        description: "(\u1E85) LATIN SMALL LETTER W WITH DIAERESIS",
    },
    XK_Ygrave: {
        code: 0x1001ef2,
        description: "(\u1EF2) LATIN CAPITAL LETTER Y WITH GRAVE",
    },
    XK_ygrave: {
        code: 0x1001ef3,
        description: "(\u1EF3) LATIN SMALL LETTER Y WITH GRAVE",
    },

    /*
   * Latin 9
   * Byte 3 = 0x13
   */

    // Group XK_LATIN9
    XK_OE: { code: 0x13bc, description: "(\u0152) LATIN CAPITAL LIGATURE OE" },
    XK_oe: { code: 0x13bd, description: "(\u0153) LATIN SMALL LIGATURE OE" },
    XK_Ydiaeresis: {
        code: 0x13be,
        description: "(\u0178) LATIN CAPITAL LETTER Y WITH DIAERESIS",
    },

    /*
   * Katakana
   * Byte 3 = 4
   */

    // Group XK_KATAKANA
    XK_overline: { code: 0x047e, description: "(\u203E) OVERLINE" },
    XK_kana_fullstop: {
        code: 0x04a1,
        description: "(\u3002) IDEOGRAPHIC FULL STOP",
    },
    XK_kana_openingbracket: {
        code: 0x04a2,
        description: "(\u300C) LEFT CORNER BRACKET",
    },
    XK_kana_closingbracket: {
        code: 0x04a3,
        description: "(\u300D) RIGHT CORNER BRACKET",
    },
    XK_kana_comma: { code: 0x04a4, description: "(\u3001) IDEOGRAPHIC COMMA" },
    XK_kana_conjunctive: {
        code: 0x04a5,
        description: "(\u30FB) KATAKANA MIDDLE DOT",
    },
    XK_kana_middledot: { code: 0x04a5, description: "deprecated" },
    XK_kana_WO: { code: 0x04a6, description: "(\u30F2) KATAKANA LETTER WO" },
    XK_kana_a: { code: 0x04a7, description: "(\u30A1) KATAKANA LETTER SMALL A" },
    XK_kana_i: { code: 0x04a8, description: "(\u30A3) KATAKANA LETTER SMALL I" },
    XK_kana_u: { code: 0x04a9, description: "(\u30A5) KATAKANA LETTER SMALL U" },
    XK_kana_e: { code: 0x04aa, description: "(\u30A7) KATAKANA LETTER SMALL E" },
    XK_kana_o: { code: 0x04ab, description: "(\u30A9) KATAKANA LETTER SMALL O" },
    XK_kana_ya: {
        code: 0x04ac,
        description: "(\u30E3) KATAKANA LETTER SMALL YA",
    },
    XK_kana_yu: {
        code: 0x04ad,
        description: "(\u30E5) KATAKANA LETTER SMALL YU",
    },
    XK_kana_yo: {
        code: 0x04ae,
        description: "(\u30E7) KATAKANA LETTER SMALL YO",
    },
    XK_kana_tsu: {
        code: 0x04af,
        description: "(\u30C3) KATAKANA LETTER SMALL TU",
    },
    XK_kana_tu: { code: 0x04af, description: "deprecated" },
    XK_prolongedsound: {
        code: 0x04b0,
        description: "(\u30FC) KATAKANA-HIRAGANA PROLONGED SOUND MARK",
    },
    XK_kana_A: { code: 0x04b1, description: "(\u30A2) KATAKANA LETTER A" },
    XK_kana_I: { code: 0x04b2, description: "(\u30A4) KATAKANA LETTER I" },
    XK_kana_U: { code: 0x04b3, description: "(\u30A6) KATAKANA LETTER U" },
    XK_kana_E: { code: 0x04b4, description: "(\u30A8) KATAKANA LETTER E" },
    XK_kana_O: { code: 0x04b5, description: "(\u30AA) KATAKANA LETTER O" },
    XK_kana_KA: { code: 0x04b6, description: "(\u30AB) KATAKANA LETTER KA" },
    XK_kana_KI: { code: 0x04b7, description: "(\u30AD) KATAKANA LETTER KI" },
    XK_kana_KU: { code: 0x04b8, description: "(\u30AF) KATAKANA LETTER KU" },
    XK_kana_KE: { code: 0x04b9, description: "(\u30B1) KATAKANA LETTER KE" },
    XK_kana_KO: { code: 0x04ba, description: "(\u30B3) KATAKANA LETTER KO" },
    XK_kana_SA: { code: 0x04bb, description: "(\u30B5) KATAKANA LETTER SA" },
    XK_kana_SHI: { code: 0x04bc, description: "(\u30B7) KATAKANA LETTER SI" },
    XK_kana_SU: { code: 0x04bd, description: "(\u30B9) KATAKANA LETTER SU" },
    XK_kana_SE: { code: 0x04be, description: "(\u30BB) KATAKANA LETTER SE" },
    XK_kana_SO: { code: 0x04bf, description: "(\u30BD) KATAKANA LETTER SO" },
    XK_kana_TA: { code: 0x04c0, description: "(\u30BF) KATAKANA LETTER TA" },
    XK_kana_CHI: { code: 0x04c1, description: "(\u30C1) KATAKANA LETTER TI" },
    XK_kana_TI: { code: 0x04c1, description: "deprecated" },
    XK_kana_TSU: { code: 0x04c2, description: "(\u30C4) KATAKANA LETTER TU" },
    XK_kana_TU: { code: 0x04c2, description: "deprecated" },
    XK_kana_TE: { code: 0x04c3, description: "(\u30C6) KATAKANA LETTER TE" },
    XK_kana_TO: { code: 0x04c4, description: "(\u30C8) KATAKANA LETTER TO" },
    XK_kana_NA: { code: 0x04c5, description: "(\u30CA) KATAKANA LETTER NA" },
    XK_kana_NI: { code: 0x04c6, description: "(\u30CB) KATAKANA LETTER NI" },
    XK_kana_NU: { code: 0x04c7, description: "(\u30CC) KATAKANA LETTER NU" },
    XK_kana_NE: { code: 0x04c8, description: "(\u30CD) KATAKANA LETTER NE" },
    XK_kana_NO: { code: 0x04c9, description: "(\u30CE) KATAKANA LETTER NO" },
    XK_kana_HA: { code: 0x04ca, description: "(\u30CF) KATAKANA LETTER HA" },
    XK_kana_HI: { code: 0x04cb, description: "(\u30D2) KATAKANA LETTER HI" },
    XK_kana_FU: { code: 0x04cc, description: "(\u30D5) KATAKANA LETTER HU" },
    XK_kana_HU: { code: 0x04cc, description: "deprecated" },
    XK_kana_HE: { code: 0x04cd, description: "(\u30D8) KATAKANA LETTER HE" },
    XK_kana_HO: { code: 0x04ce, description: "(\u30DB) KATAKANA LETTER HO" },
    XK_kana_MA: { code: 0x04cf, description: "(\u30DE) KATAKANA LETTER MA" },
    XK_kana_MI: { code: 0x04d0, description: "(\u30DF) KATAKANA LETTER MI" },
    XK_kana_MU: { code: 0x04d1, description: "(\u30E0) KATAKANA LETTER MU" },
    XK_kana_ME: { code: 0x04d2, description: "(\u30E1) KATAKANA LETTER ME" },
    XK_kana_MO: { code: 0x04d3, description: "(\u30E2) KATAKANA LETTER MO" },
    XK_kana_YA: { code: 0x04d4, description: "(\u30E4) KATAKANA LETTER YA" },
    XK_kana_YU: { code: 0x04d5, description: "(\u30E6) KATAKANA LETTER YU" },
    XK_kana_YO: { code: 0x04d6, description: "(\u30E8) KATAKANA LETTER YO" },
    XK_kana_RA: { code: 0x04d7, description: "(\u30E9) KATAKANA LETTER RA" },
    XK_kana_RI: { code: 0x04d8, description: "(\u30EA) KATAKANA LETTER RI" },
    XK_kana_RU: { code: 0x04d9, description: "(\u30EB) KATAKANA LETTER RU" },
    XK_kana_RE: { code: 0x04da, description: "(\u30EC) KATAKANA LETTER RE" },
    XK_kana_RO: { code: 0x04db, description: "(\u30ED) KATAKANA LETTER RO" },
    XK_kana_WA: { code: 0x04dc, description: "(\u30EF) KATAKANA LETTER WA" },
    XK_kana_N: { code: 0x04dd, description: "(\u30F3) KATAKANA LETTER N" },
    XK_voicedsound: {
        code: 0x04de,
        description: "(\u309B) KATAKANA-HIRAGANA VOICED SOUND MARK",
    },
    XK_semivoicedsound: {
        code: 0x04df,
        description: "(\u309C) KATAKANA-HIRAGANA SEMI-VOICED SOUND MARK",
    },
    XK_kana_switch: { code: 0xff7e, description: "Alias for mode_switch" },

    /*
   * Arabic
   * Byte 3 = 5
   */

    // Group XK_ARABIC
    XK_Farsi_0: {
        code: 0x10006f0,
        description: "(\u06F0) EXTENDED ARABIC-INDIC DIGIT ZERO",
    },
    XK_Farsi_1: {
        code: 0x10006f1,
        description: "(\u06F1) EXTENDED ARABIC-INDIC DIGIT ONE",
    },
    XK_Farsi_2: {
        code: 0x10006f2,
        description: "(\u06F2) EXTENDED ARABIC-INDIC DIGIT TWO",
    },
    XK_Farsi_3: {
        code: 0x10006f3,
        description: "(\u06F3) EXTENDED ARABIC-INDIC DIGIT THREE",
    },
    XK_Farsi_4: {
        code: 0x10006f4,
        description: "(\u06F4) EXTENDED ARABIC-INDIC DIGIT FOUR",
    },
    XK_Farsi_5: {
        code: 0x10006f5,
        description: "(\u06F5) EXTENDED ARABIC-INDIC DIGIT FIVE",
    },
    XK_Farsi_6: {
        code: 0x10006f6,
        description: "(\u06F6) EXTENDED ARABIC-INDIC DIGIT SIX",
    },
    XK_Farsi_7: {
        code: 0x10006f7,
        description: "(\u06F7) EXTENDED ARABIC-INDIC DIGIT SEVEN",
    },
    XK_Farsi_8: {
        code: 0x10006f8,
        description: "(\u06F8) EXTENDED ARABIC-INDIC DIGIT EIGHT",
    },
    XK_Farsi_9: {
        code: 0x10006f9,
        description: "(\u06F9) EXTENDED ARABIC-INDIC DIGIT NINE",
    },
    XK_Arabic_percent: {
        code: 0x100066a,
        description: "(\u066A) ARABIC PERCENT SIGN",
    },
    XK_Arabic_superscript_alef: {
        code: 0x1000670,
        description: "(\u0670) ARABIC LETTER SUPERSCRIPT ALEF",
    },
    XK_Arabic_tteh: {
        code: 0x1000679,
        description: "(\u0679) ARABIC LETTER TTEH",
    },
    XK_Arabic_peh: { code: 0x100067e, description: "(\u067E) ARABIC LETTER PEH" },
    XK_Arabic_tcheh: {
        code: 0x1000686,
        description: "(\u0686) ARABIC LETTER TCHEH",
    },
    XK_Arabic_ddal: {
        code: 0x1000688,
        description: "(\u0688) ARABIC LETTER DDAL",
    },
    XK_Arabic_rreh: {
        code: 0x1000691,
        description: "(\u0691) ARABIC LETTER RREH",
    },
    XK_Arabic_comma: { code: 0x05ac, description: "(\u060C) ARABIC COMMA" },
    XK_Arabic_fullstop: {
        code: 0x10006d4,
        description: "(\u06D4) ARABIC FULL STOP",
    },
    XK_Arabic_0: {
        code: 0x1000660,
        description: "(\u0660) ARABIC-INDIC DIGIT ZERO",
    },
    XK_Arabic_1: {
        code: 0x1000661,
        description: "(\u0661) ARABIC-INDIC DIGIT ONE",
    },
    XK_Arabic_2: {
        code: 0x1000662,
        description: "(\u0662) ARABIC-INDIC DIGIT TWO",
    },
    XK_Arabic_3: {
        code: 0x1000663,
        description: "(\u0663) ARABIC-INDIC DIGIT THREE",
    },
    XK_Arabic_4: {
        code: 0x1000664,
        description: "(\u0664) ARABIC-INDIC DIGIT FOUR",
    },
    XK_Arabic_5: {
        code: 0x1000665,
        description: "(\u0665) ARABIC-INDIC DIGIT FIVE",
    },
    XK_Arabic_6: {
        code: 0x1000666,
        description: "(\u0666) ARABIC-INDIC DIGIT SIX",
    },
    XK_Arabic_7: {
        code: 0x1000667,
        description: "(\u0667) ARABIC-INDIC DIGIT SEVEN",
    },
    XK_Arabic_8: {
        code: 0x1000668,
        description: "(\u0668) ARABIC-INDIC DIGIT EIGHT",
    },
    XK_Arabic_9: {
        code: 0x1000669,
        description: "(\u0669) ARABIC-INDIC DIGIT NINE",
    },
    XK_Arabic_semicolon: {
        code: 0x05bb,
        description: "(\u061B) ARABIC SEMICOLON",
    },
    XK_Arabic_question_mark: {
        code: 0x05bf,
        description: "(\u061F) ARABIC QUESTION MARK",
    },
    XK_Arabic_hamza: {
        code: 0x05c1,
        description: "(\u0621) ARABIC LETTER HAMZA",
    },
    XK_Arabic_maddaonalef: {
        code: 0x05c2,
        description: "(\u0622) ARABIC LETTER ALEF WITH MADDA ABOVE",
    },
    XK_Arabic_hamzaonalef: {
        code: 0x05c3,
        description: "(\u0623) ARABIC LETTER ALEF WITH HAMZA ABOVE",
    },
    XK_Arabic_hamzaonwaw: {
        code: 0x05c4,
        description: "(\u0624) ARABIC LETTER WAW WITH HAMZA ABOVE",
    },
    XK_Arabic_hamzaunderalef: {
        code: 0x05c5,
        description: "(\u0625) ARABIC LETTER ALEF WITH HAMZA BELOW",
    },
    XK_Arabic_hamzaonyeh: {
        code: 0x05c6,
        description: "(\u0626) ARABIC LETTER YEH WITH HAMZA ABOVE",
    },
    XK_Arabic_alef: { code: 0x05c7, description: "(\u0627) ARABIC LETTER ALEF" },
    XK_Arabic_beh: { code: 0x05c8, description: "(\u0628) ARABIC LETTER BEH" },
    XK_Arabic_tehmarbuta: {
        code: 0x05c9,
        description: "(\u0629) ARABIC LETTER TEH MARBUTA",
    },
    XK_Arabic_teh: { code: 0x05ca, description: "(\u062A) ARABIC LETTER TEH" },
    XK_Arabic_theh: { code: 0x05cb, description: "(\u062B) ARABIC LETTER THEH" },
    XK_Arabic_jeem: { code: 0x05cc, description: "(\u062C) ARABIC LETTER JEEM" },
    XK_Arabic_hah: { code: 0x05cd, description: "(\u062D) ARABIC LETTER HAH" },
    XK_Arabic_khah: { code: 0x05ce, description: "(\u062E) ARABIC LETTER KHAH" },
    XK_Arabic_dal: { code: 0x05cf, description: "(\u062F) ARABIC LETTER DAL" },
    XK_Arabic_thal: { code: 0x05d0, description: "(\u0630) ARABIC LETTER THAL" },
    XK_Arabic_ra: { code: 0x05d1, description: "(\u0631) ARABIC LETTER REH" },
    XK_Arabic_zain: { code: 0x05d2, description: "(\u0632) ARABIC LETTER ZAIN" },
    XK_Arabic_seen: { code: 0x05d3, description: "(\u0633) ARABIC LETTER SEEN" },
    XK_Arabic_sheen: {
        code: 0x05d4,
        description: "(\u0634) ARABIC LETTER SHEEN",
    },
    XK_Arabic_sad: { code: 0x05d5, description: "(\u0635) ARABIC LETTER SAD" },
    XK_Arabic_dad: { code: 0x05d6, description: "(\u0636) ARABIC LETTER DAD" },
    XK_Arabic_tah: { code: 0x05d7, description: "(\u0637) ARABIC LETTER TAH" },
    XK_Arabic_zah: { code: 0x05d8, description: "(\u0638) ARABIC LETTER ZAH" },
    XK_Arabic_ain: { code: 0x05d9, description: "(\u0639) ARABIC LETTER AIN" },
    XK_Arabic_ghain: {
        code: 0x05da,
        description: "(\u063A) ARABIC LETTER GHAIN",
    },
    XK_Arabic_tatweel: { code: 0x05e0, description: "(\u0640) ARABIC TATWEEL" },
    XK_Arabic_feh: { code: 0x05e1, description: "(\u0641) ARABIC LETTER FEH" },
    XK_Arabic_qaf: { code: 0x05e2, description: "(\u0642) ARABIC LETTER QAF" },
    XK_Arabic_kaf: { code: 0x05e3, description: "(\u0643) ARABIC LETTER KAF" },
    XK_Arabic_lam: { code: 0x05e4, description: "(\u0644) ARABIC LETTER LAM" },
    XK_Arabic_meem: { code: 0x05e5, description: "(\u0645) ARABIC LETTER MEEM" },
    XK_Arabic_noon: { code: 0x05e6, description: "(\u0646) ARABIC LETTER NOON" },
    XK_Arabic_ha: { code: 0x05e7, description: "(\u0647) ARABIC LETTER HEH" },
    XK_Arabic_heh: { code: 0x05e7, description: "deprecated" },
    XK_Arabic_waw: { code: 0x05e8, description: "(\u0648) ARABIC LETTER WAW" },
    XK_Arabic_alefmaksura: {
        code: 0x05e9,
        description: "(\u0649) ARABIC LETTER ALEF MAKSURA",
    },
    XK_Arabic_yeh: { code: 0x05ea, description: "(\u064A) ARABIC LETTER YEH" },
    XK_Arabic_fathatan: { code: 0x05eb, description: "(\u064B) ARABIC FATHATAN" },
    XK_Arabic_dammatan: { code: 0x05ec, description: "(\u064C) ARABIC DAMMATAN" },
    XK_Arabic_kasratan: { code: 0x05ed, description: "(\u064D) ARABIC KASRATAN" },
    XK_Arabic_fatha: { code: 0x05ee, description: "(\u064E) ARABIC FATHA" },
    XK_Arabic_damma: { code: 0x05ef, description: "(\u064F) ARABIC DAMMA" },
    XK_Arabic_kasra: { code: 0x05f0, description: "(\u0650) ARABIC KASRA" },
    XK_Arabic_shadda: { code: 0x05f1, description: "(\u0651) ARABIC SHADDA" },
    XK_Arabic_sukun: { code: 0x05f2, description: "(\u0652) ARABIC SUKUN" },
    XK_Arabic_madda_above: {
        code: 0x1000653,
        description: "(\u0653) ARABIC MADDAH ABOVE",
    },
    XK_Arabic_hamza_above: {
        code: 0x1000654,
        description: "(\u0654) ARABIC HAMZA ABOVE",
    },
    XK_Arabic_hamza_below: {
        code: 0x1000655,
        description: "(\u0655) ARABIC HAMZA BELOW",
    },
    XK_Arabic_jeh: { code: 0x1000698, description: "(\u0698) ARABIC LETTER JEH" },
    XK_Arabic_veh: { code: 0x10006a4, description: "(\u06A4) ARABIC LETTER VEH" },
    XK_Arabic_keheh: {
        code: 0x10006a9,
        description: "(\u06A9) ARABIC LETTER KEHEH",
    },
    XK_Arabic_gaf: { code: 0x10006af, description: "(\u06AF) ARABIC LETTER GAF" },
    XK_Arabic_noon_ghunna: {
        code: 0x10006ba,
        description: "(\u06BA) ARABIC LETTER NOON GHUNNA",
    },
    XK_Arabic_heh_doachashmee: {
        code: 0x10006be,
        description: "(\u06BE) ARABIC LETTER HEH DOACHASHMEE",
    },
    XK_Farsi_yeh: {
        code: 0x10006cc,
        description: "(\u06CC) ARABIC LETTER FARSI YEH",
    },
    XK_Arabic_farsi_yeh: {
        code: 0x10006cc,
        description: "(\u06CC) ARABIC LETTER FARSI YEH",
    },
    XK_Arabic_yeh_baree: {
        code: 0x10006d2,
        description: "(\u06D2) ARABIC LETTER YEH BARREE",
    },
    XK_Arabic_heh_goal: {
        code: 0x10006c1,
        description: "(\u06C1) ARABIC LETTER HEH GOAL",
    },
    XK_Arabic_switch: { code: 0xff7e, description: "Alias for mode_switch" },

    /*
   * Cyrillic
   * Byte 3 = 6
   */
    // Group XK_CYRILLIC
    XK_Cyrillic_GHE_bar: {
        code: 0x1000492,
        description: "(\u0492) CYRILLIC CAPITAL LETTER GHE WITH STROKE",
    },
    XK_Cyrillic_ghe_bar: {
        code: 0x1000493,
        description: "(\u0493) CYRILLIC SMALL LETTER GHE WITH STROKE",
    },
    XK_Cyrillic_ZHE_descender: {
        code: 0x1000496,
        description: "(\u0496) CYRILLIC CAPITAL LETTER ZHE WITH DESCENDER",
    },
    XK_Cyrillic_zhe_descender: {
        code: 0x1000497,
        description: "(\u0497) CYRILLIC SMALL LETTER ZHE WITH DESCENDER",
    },
    XK_Cyrillic_KA_descender: {
        code: 0x100049a,
        description: "(\u049A) CYRILLIC CAPITAL LETTER KA WITH DESCENDER",
    },
    XK_Cyrillic_ka_descender: {
        code: 0x100049b,
        description: "(\u049B) CYRILLIC SMALL LETTER KA WITH DESCENDER",
    },
    XK_Cyrillic_KA_vertstroke: {
        code: 0x100049c,
        description: "(\u049C) CYRILLIC CAPITAL LETTER KA WITH VERTICAL STROKE",
    },
    XK_Cyrillic_ka_vertstroke: {
        code: 0x100049d,
        description: "(\u049D) CYRILLIC SMALL LETTER KA WITH VERTICAL STROKE",
    },
    XK_Cyrillic_EN_descender: {
        code: 0x10004a2,
        description: "(\u04A2) CYRILLIC CAPITAL LETTER EN WITH DESCENDER",
    },
    XK_Cyrillic_en_descender: {
        code: 0x10004a3,
        description: "(\u04A3) CYRILLIC SMALL LETTER EN WITH DESCENDER",
    },
    XK_Cyrillic_U_straight: {
        code: 0x10004ae,
        description: "(\u04AE) CYRILLIC CAPITAL LETTER STRAIGHT U",
    },
    XK_Cyrillic_u_straight: {
        code: 0x10004af,
        description: "(\u04AF) CYRILLIC SMALL LETTER STRAIGHT U",
    },
    XK_Cyrillic_U_straight_bar: {
        code: 0x10004b0,
        description: "(\u04B0) CYRILLIC CAPITAL LETTER STRAIGHT U WITH STROKE",
    },
    XK_Cyrillic_u_straight_bar: {
        code: 0x10004b1,
        description: "(\u04B1) CYRILLIC SMALL LETTER STRAIGHT U WITH STROKE",
    },
    XK_Cyrillic_HA_descender: {
        code: 0x10004b2,
        description: "(\u04B2) CYRILLIC CAPITAL LETTER HA WITH DESCENDER",
    },
    XK_Cyrillic_ha_descender: {
        code: 0x10004b3,
        description: "(\u04B3) CYRILLIC SMALL LETTER HA WITH DESCENDER",
    },
    XK_Cyrillic_CHE_descender: {
        code: 0x10004b6,
        description: "(\u04B6) CYRILLIC CAPITAL LETTER CHE WITH DESCENDER",
    },
    XK_Cyrillic_che_descender: {
        code: 0x10004b7,
        description: "(\u04B7) CYRILLIC SMALL LETTER CHE WITH DESCENDER",
    },
    XK_Cyrillic_CHE_vertstroke: {
        code: 0x10004b8,
        description: "(\u04B8) CYRILLIC CAPITAL LETTER CHE WITH VERTICAL STROKE",
    },
    XK_Cyrillic_che_vertstroke: {
        code: 0x10004b9,
        description: "(\u04B9) CYRILLIC SMALL LETTER CHE WITH VERTICAL STROKE",
    },
    XK_Cyrillic_SHHA: {
        code: 0x10004ba,
        description: "(\u04BA) CYRILLIC CAPITAL LETTER SHHA",
    },
    XK_Cyrillic_shha: {
        code: 0x10004bb,
        description: "(\u04BB) CYRILLIC SMALL LETTER SHHA",
    },

    XK_Cyrillic_SCHWA: {
        code: 0x10004d8,
        description: "(\u04D8) CYRILLIC CAPITAL LETTER SCHWA",
    },
    XK_Cyrillic_schwa: {
        code: 0x10004d9,
        description: "(\u04D9) CYRILLIC SMALL LETTER SCHWA",
    },
    XK_Cyrillic_I_macron: {
        code: 0x10004e2,
        description: "(\u04E2) CYRILLIC CAPITAL LETTER I WITH MACRON",
    },
    XK_Cyrillic_i_macron: {
        code: 0x10004e3,
        description: "(\u04E3) CYRILLIC SMALL LETTER I WITH MACRON",
    },
    XK_Cyrillic_O_bar: {
        code: 0x10004e8,
        description: "(\u04E8) CYRILLIC CAPITAL LETTER BARRED O",
    },
    XK_Cyrillic_o_bar: {
        code: 0x10004e9,
        description: "(\u04E9) CYRILLIC SMALL LETTER BARRED O",
    },
    XK_Cyrillic_U_macron: {
        code: 0x10004ee,
        description: "(\u04EE) CYRILLIC CAPITAL LETTER U WITH MACRON",
    },
    XK_Cyrillic_u_macron: {
        code: 0x10004ef,
        description: "(\u04EF) CYRILLIC SMALL LETTER U WITH MACRON",
    },

    XK_Serbian_dje: {
        code: 0x06a1,
        description: "(\u0452) CYRILLIC SMALL LETTER DJE",
    },
    XK_Macedonia_gje: {
        code: 0x06a2,
        description: "(\u0453) CYRILLIC SMALL LETTER GJE",
    },
    XK_Cyrillic_io: {
        code: 0x06a3,
        description: "(\u0451) CYRILLIC SMALL LETTER IO",
    },
    XK_Ukrainian_ie: {
        code: 0x06a4,
        description: "(\u0454) CYRILLIC SMALL LETTER UKRAINIAN IE",
    },
    XK_Ukranian_je: { code: 0x06a4, description: "deprecated" },
    XK_Macedonia_dse: {
        code: 0x06a5,
        description: "(\u0455) CYRILLIC SMALL LETTER DZE",
    },
    XK_Ukrainian_i: {
        code: 0x06a6,
        description: "(\u0456) CYRILLIC SMALL LETTER BYELORUSSIAN-UKRAINIAN I",
    },
    XK_Ukranian_i: { code: 0x06a6, description: "deprecated" },
    XK_Ukrainian_yi: {
        code: 0x06a7,
        description: "(\u0457) CYRILLIC SMALL LETTER YI",
    },
    XK_Ukranian_yi: { code: 0x06a7, description: "deprecated" },
    XK_Cyrillic_je: {
        code: 0x06a8,
        description: "(\u0458) CYRILLIC SMALL LETTER JE",
    },
    XK_Serbian_je: { code: 0x06a8, description: "deprecated" },
    XK_Cyrillic_lje: {
        code: 0x06a9,
        description: "(\u0459) CYRILLIC SMALL LETTER LJE",
    },
    XK_Serbian_lje: { code: 0x06a9, description: "deprecated" },
    XK_Cyrillic_nje: {
        code: 0x06aa,
        description: "(\u045A) CYRILLIC SMALL LETTER NJE",
    },
    XK_Serbian_nje: { code: 0x06aa, description: "deprecated" },
    XK_Serbian_tshe: {
        code: 0x06ab,
        description: "(\u045B) CYRILLIC SMALL LETTER TSHE",
    },
    XK_Macedonia_kje: {
        code: 0x06ac,
        description: "(\u045C) CYRILLIC SMALL LETTER KJE",
    },
    XK_Ukrainian_ghe_with_upturn: {
        code: 0x06ad,
        description: "(\u0491) CYRILLIC SMALL LETTER GHE WITH UPTURN",
    },
    XK_Byelorussian_shortu: {
        code: 0x06ae,
        description: "(\u045E) CYRILLIC SMALL LETTER SHORT U",
    },
    XK_Cyrillic_dzhe: {
        code: 0x06af,
        description: "(\u045F) CYRILLIC SMALL LETTER DZHE",
    },
    XK_Serbian_dze: { code: 0x06af, description: "deprecated" },
    XK_numerosign: { code: 0x06b0, description: "(\u2116) NUMERO SIGN" },
    XK_Serbian_DJE: {
        code: 0x06b1,
        description: "(\u0402) CYRILLIC CAPITAL LETTER DJE",
    },
    XK_Macedonia_GJE: {
        code: 0x06b2,
        description: "(\u0403) CYRILLIC CAPITAL LETTER GJE",
    },
    XK_Cyrillic_IO: {
        code: 0x06b3,
        description: "(\u0401) CYRILLIC CAPITAL LETTER IO",
    },
    XK_Ukrainian_IE: {
        code: 0x06b4,
        description: "(\u0404) CYRILLIC CAPITAL LETTER UKRAINIAN IE",
    },
    XK_Ukranian_JE: { code: 0x06b4, description: "deprecated" },
    XK_Macedonia_DSE: {
        code: 0x06b5,
        description: "(\u0405) CYRILLIC CAPITAL LETTER DZE",
    },
    XK_Ukrainian_I: {
        code: 0x06b6,
        description: "(\u0406) CYRILLIC CAPITAL LETTER BYELORUSSIAN-UKRAINIAN I",
    },
    XK_Ukranian_I: { code: 0x06b6, description: "deprecated" },
    XK_Ukrainian_YI: {
        code: 0x06b7,
        description: "(\u0407) CYRILLIC CAPITAL LETTER YI",
    },
    XK_Ukranian_YI: { code: 0x06b7, description: "deprecated" },
    XK_Cyrillic_JE: {
        code: 0x06b8,
        description: "(\u0408) CYRILLIC CAPITAL LETTER JE",
    },
    XK_Serbian_JE: { code: 0x06b8, description: "deprecated" },
    XK_Cyrillic_LJE: {
        code: 0x06b9,
        description: "(\u0409) CYRILLIC CAPITAL LETTER LJE",
    },
    XK_Serbian_LJE: { code: 0x06b9, description: "deprecated" },
    XK_Cyrillic_NJE: {
        code: 0x06ba,
        description: "(\u040A) CYRILLIC CAPITAL LETTER NJE",
    },
    XK_Serbian_NJE: { code: 0x06ba, description: "deprecated" },
    XK_Serbian_TSHE: {
        code: 0x06bb,
        description: "(\u040B) CYRILLIC CAPITAL LETTER TSHE",
    },
    XK_Macedonia_KJE: {
        code: 0x06bc,
        description: "(\u040C) CYRILLIC CAPITAL LETTER KJE",
    },
    XK_Ukrainian_GHE_WITH_UPTURN: {
        code: 0x06bd,
        description: "(\u0490) CYRILLIC CAPITAL LETTER GHE WITH UPTURN",
    },
    XK_Byelorussian_SHORTU: {
        code: 0x06be,
        description: "(\u040E) CYRILLIC CAPITAL LETTER SHORT U",
    },
    XK_Cyrillic_DZHE: {
        code: 0x06bf,
        description: "(\u040F) CYRILLIC CAPITAL LETTER DZHE",
    },
    XK_Serbian_DZE: { code: 0x06bf, description: "deprecated" },
    XK_Cyrillic_yu: {
        code: 0x06c0,
        description: "(\u044E) CYRILLIC SMALL LETTER YU",
    },
    XK_Cyrillic_a: {
        code: 0x06c1,
        description: "(\u0430) CYRILLIC SMALL LETTER A",
    },
    XK_Cyrillic_be: {
        code: 0x06c2,
        description: "(\u0431) CYRILLIC SMALL LETTER BE",
    },
    XK_Cyrillic_tse: {
        code: 0x06c3,
        description: "(\u0446) CYRILLIC SMALL LETTER TSE",
    },
    XK_Cyrillic_de: {
        code: 0x06c4,
        description: "(\u0434) CYRILLIC SMALL LETTER DE",
    },
    XK_Cyrillic_ie: {
        code: 0x06c5,
        description: "(\u0435) CYRILLIC SMALL LETTER IE",
    },
    XK_Cyrillic_ef: {
        code: 0x06c6,
        description: "(\u0444) CYRILLIC SMALL LETTER EF",
    },
    XK_Cyrillic_ghe: {
        code: 0x06c7,
        description: "(\u0433) CYRILLIC SMALL LETTER GHE",
    },
    XK_Cyrillic_ha: {
        code: 0x06c8,
        description: "(\u0445) CYRILLIC SMALL LETTER HA",
    },
    XK_Cyrillic_i: {
        code: 0x06c9,
        description: "(\u0438) CYRILLIC SMALL LETTER I",
    },
    XK_Cyrillic_shorti: {
        code: 0x06ca,
        description: "(\u0439) CYRILLIC SMALL LETTER SHORT I",
    },
    XK_Cyrillic_ka: {
        code: 0x06cb,
        description: "(\u043A) CYRILLIC SMALL LETTER KA",
    },
    XK_Cyrillic_el: {
        code: 0x06cc,
        description: "(\u043B) CYRILLIC SMALL LETTER EL",
    },
    XK_Cyrillic_em: {
        code: 0x06cd,
        description: "(\u043C) CYRILLIC SMALL LETTER EM",
    },
    XK_Cyrillic_en: {
        code: 0x06ce,
        description: "(\u043D) CYRILLIC SMALL LETTER EN",
    },
    XK_Cyrillic_o: {
        code: 0x06cf,
        description: "(\u043E) CYRILLIC SMALL LETTER O",
    },
    XK_Cyrillic_pe: {
        code: 0x06d0,
        description: "(\u043F) CYRILLIC SMALL LETTER PE",
    },
    XK_Cyrillic_ya: {
        code: 0x06d1,
        description: "(\u044F) CYRILLIC SMALL LETTER YA",
    },
    XK_Cyrillic_er: {
        code: 0x06d2,
        description: "(\u0440) CYRILLIC SMALL LETTER ER",
    },
    XK_Cyrillic_es: {
        code: 0x06d3,
        description: "(\u0441) CYRILLIC SMALL LETTER ES",
    },
    XK_Cyrillic_te: {
        code: 0x06d4,
        description: "(\u0442) CYRILLIC SMALL LETTER TE",
    },
    XK_Cyrillic_u: {
        code: 0x06d5,
        description: "(\u0443) CYRILLIC SMALL LETTER U",
    },
    XK_Cyrillic_zhe: {
        code: 0x06d6,
        description: "(\u0436) CYRILLIC SMALL LETTER ZHE",
    },
    XK_Cyrillic_ve: {
        code: 0x06d7,
        description: "(\u0432) CYRILLIC SMALL LETTER VE",
    },
    XK_Cyrillic_softsign: {
        code: 0x06d8,
        description: "(\u044C) CYRILLIC SMALL LETTER SOFT SIGN",
    },
    XK_Cyrillic_yeru: {
        code: 0x06d9,
        description: "(\u044B) CYRILLIC SMALL LETTER YERU",
    },
    XK_Cyrillic_ze: {
        code: 0x06da,
        description: "(\u0437) CYRILLIC SMALL LETTER ZE",
    },
    XK_Cyrillic_sha: {
        code: 0x06db,
        description: "(\u0448) CYRILLIC SMALL LETTER SHA",
    },
    XK_Cyrillic_e: {
        code: 0x06dc,
        description: "(\u044D) CYRILLIC SMALL LETTER E",
    },
    XK_Cyrillic_shcha: {
        code: 0x06dd,
        description: "(\u0449) CYRILLIC SMALL LETTER SHCHA",
    },
    XK_Cyrillic_che: {
        code: 0x06de,
        description: "(\u0447) CYRILLIC SMALL LETTER CHE",
    },
    XK_Cyrillic_hardsign: {
        code: 0x06df,
        description: "(\u044A) CYRILLIC SMALL LETTER HARD SIGN",
    },
    XK_Cyrillic_YU: {
        code: 0x06e0,
        description: "(\u042E) CYRILLIC CAPITAL LETTER YU",
    },
    XK_Cyrillic_A: {
        code: 0x06e1,
        description: "(\u0410) CYRILLIC CAPITAL LETTER A",
    },
    XK_Cyrillic_BE: {
        code: 0x06e2,
        description: "(\u0411) CYRILLIC CAPITAL LETTER BE",
    },
    XK_Cyrillic_TSE: {
        code: 0x06e3,
        description: "(\u0426) CYRILLIC CAPITAL LETTER TSE",
    },
    XK_Cyrillic_DE: {
        code: 0x06e4,
        description: "(\u0414) CYRILLIC CAPITAL LETTER DE",
    },
    XK_Cyrillic_IE: {
        code: 0x06e5,
        description: "(\u0415) CYRILLIC CAPITAL LETTER IE",
    },
    XK_Cyrillic_EF: {
        code: 0x06e6,
        description: "(\u0424) CYRILLIC CAPITAL LETTER EF",
    },
    XK_Cyrillic_GHE: {
        code: 0x06e7,
        description: "(\u0413) CYRILLIC CAPITAL LETTER GHE",
    },
    XK_Cyrillic_HA: {
        code: 0x06e8,
        description: "(\u0425) CYRILLIC CAPITAL LETTER HA",
    },
    XK_Cyrillic_I: {
        code: 0x06e9,
        description: "(\u0418) CYRILLIC CAPITAL LETTER I",
    },
    XK_Cyrillic_SHORTI: {
        code: 0x06ea,
        description: "(\u0419) CYRILLIC CAPITAL LETTER SHORT I",
    },
    XK_Cyrillic_KA: {
        code: 0x06eb,
        description: "(\u041A) CYRILLIC CAPITAL LETTER KA",
    },
    XK_Cyrillic_EL: {
        code: 0x06ec,
        description: "(\u041B) CYRILLIC CAPITAL LETTER EL",
    },
    XK_Cyrillic_EM: {
        code: 0x06ed,
        description: "(\u041C) CYRILLIC CAPITAL LETTER EM",
    },
    XK_Cyrillic_EN: {
        code: 0x06ee,
        description: "(\u041D) CYRILLIC CAPITAL LETTER EN",
    },
    XK_Cyrillic_O: {
        code: 0x06ef,
        description: "(\u041E) CYRILLIC CAPITAL LETTER O",
    },
    XK_Cyrillic_PE: {
        code: 0x06f0,
        description: "(\u041F) CYRILLIC CAPITAL LETTER PE",
    },
    XK_Cyrillic_YA: {
        code: 0x06f1,
        description: "(\u042F) CYRILLIC CAPITAL LETTER YA",
    },
    XK_Cyrillic_ER: {
        code: 0x06f2,
        description: "(\u0420) CYRILLIC CAPITAL LETTER ER",
    },
    XK_Cyrillic_ES: {
        code: 0x06f3,
        description: "(\u0421) CYRILLIC CAPITAL LETTER ES",
    },
    XK_Cyrillic_TE: {
        code: 0x06f4,
        description: "(\u0422) CYRILLIC CAPITAL LETTER TE",
    },
    XK_Cyrillic_U: {
        code: 0x06f5,
        description: "(\u0423) CYRILLIC CAPITAL LETTER U",
    },
    XK_Cyrillic_ZHE: {
        code: 0x06f6,
        description: "(\u0416) CYRILLIC CAPITAL LETTER ZHE",
    },
    XK_Cyrillic_VE: {
        code: 0x06f7,
        description: "(\u0412) CYRILLIC CAPITAL LETTER VE",
    },
    XK_Cyrillic_SOFTSIGN: {
        code: 0x06f8,
        description: "(\u042C) CYRILLIC CAPITAL LETTER SOFT SIGN",
    },
    XK_Cyrillic_YERU: {
        code: 0x06f9,
        description: "(\u042B) CYRILLIC CAPITAL LETTER YERU",
    },
    XK_Cyrillic_ZE: {
        code: 0x06fa,
        description: "(\u0417) CYRILLIC CAPITAL LETTER ZE",
    },
    XK_Cyrillic_SHA: {
        code: 0x06fb,
        description: "(\u0428) CYRILLIC CAPITAL LETTER SHA",
    },
    XK_Cyrillic_E: {
        code: 0x06fc,
        description: "(\u042D) CYRILLIC CAPITAL LETTER E",
    },
    XK_Cyrillic_SHCHA: {
        code: 0x06fd,
        description: "(\u0429) CYRILLIC CAPITAL LETTER SHCHA",
    },
    XK_Cyrillic_CHE: {
        code: 0x06fe,
        description: "(\u0427) CYRILLIC CAPITAL LETTER CHE",
    },
    XK_Cyrillic_HARDSIGN: {
        code: 0x06ff,
        description: "(\u042A) CYRILLIC CAPITAL LETTER HARD SIGN",
    },

    /*
   * Greek
   * (based on an early draft of, and not quite identical to, ISO/IEC 8859-7)
   * Byte 3 = 7
   */

    // Group XK_GREEK
    XK_Greek_ALPHAaccent: {
        code: 0x07a1,
        description: "(\u0386) GREEK CAPITAL LETTER ALPHA WITH TONOS",
    },
    XK_Greek_EPSILONaccent: {
        code: 0x07a2,
        description: "(\u0388) GREEK CAPITAL LETTER EPSILON WITH TONOS",
    },
    XK_Greek_ETAaccent: {
        code: 0x07a3,
        description: "(\u0389) GREEK CAPITAL LETTER ETA WITH TONOS",
    },
    XK_Greek_IOTAaccent: {
        code: 0x07a4,
        description: "(\u038A) GREEK CAPITAL LETTER IOTA WITH TONOS",
    },
    XK_Greek_IOTAdieresis: {
        code: 0x07a5,
        description: "(\u03AA) GREEK CAPITAL LETTER IOTA WITH DIALYTIKA",
    },
    XK_Greek_IOTAdiaeresis: { code: 0x07a5, description: "old typo" },
    XK_Greek_OMICRONaccent: {
        code: 0x07a7,
        description: "(\u038C) GREEK CAPITAL LETTER OMICRON WITH TONOS",
    },
    XK_Greek_UPSILONaccent: {
        code: 0x07a8,
        description: "(\u038E) GREEK CAPITAL LETTER UPSILON WITH TONOS",
    },
    XK_Greek_UPSILONdieresis: {
        code: 0x07a9,
        description: "(\u03AB) GREEK CAPITAL LETTER UPSILON WITH DIALYTIKA",
    },
    XK_Greek_OMEGAaccent: {
        code: 0x07ab,
        description: "(\u038F) GREEK CAPITAL LETTER OMEGA WITH TONOS",
    },
    XK_Greek_accentdieresis: {
        code: 0x07ae,
        description: "(\u0385) GREEK DIALYTIKA TONOS",
    },
    XK_Greek_horizbar: { code: 0x07af, description: "(\u2015) HORIZONTAL BAR" },
    XK_Greek_alphaaccent: {
        code: 0x07b1,
        description: "(\u03AC) GREEK SMALL LETTER ALPHA WITH TONOS",
    },
    XK_Greek_epsilonaccent: {
        code: 0x07b2,
        description: "(\u03AD) GREEK SMALL LETTER EPSILON WITH TONOS",
    },
    XK_Greek_etaaccent: {
        code: 0x07b3,
        description: "(\u03AE) GREEK SMALL LETTER ETA WITH TONOS",
    },
    XK_Greek_iotaaccent: {
        code: 0x07b4,
        description: "(\u03AF) GREEK SMALL LETTER IOTA WITH TONOS",
    },
    XK_Greek_iotadieresis: {
        code: 0x07b5,
        description: "(\u03CA) GREEK SMALL LETTER IOTA WITH DIALYTIKA",
    },
    XK_Greek_iotaaccentdieresis: {
        code: 0x07b6,
        description: "(\u0390) GREEK SMALL LETTER IOTA WITH DIALYTIKA AND TONOS",
    },
    XK_Greek_omicronaccent: {
        code: 0x07b7,
        description: "(\u03CC) GREEK SMALL LETTER OMICRON WITH TONOS",
    },
    XK_Greek_upsilonaccent: {
        code: 0x07b8,
        description: "(\u03CD) GREEK SMALL LETTER UPSILON WITH TONOS",
    },
    XK_Greek_upsilondieresis: {
        code: 0x07b9,
        description: "(\u03CB) GREEK SMALL LETTER UPSILON WITH DIALYTIKA",
    },
    XK_Greek_upsilonaccentdieresis: {
        code: 0x07ba,
        description: "(\u03B0) GREEK SMALL LETTER UPSILON WITH DIALYTIKA AND TONOS",
    },
    XK_Greek_omegaaccent: {
        code: 0x07bb,
        description: "(\u03CE) GREEK SMALL LETTER OMEGA WITH TONOS",
    },
    XK_Greek_ALPHA: {
        code: 0x07c1,
        description: "(\u0391) GREEK CAPITAL LETTER ALPHA",
    },
    XK_Greek_BETA: {
        code: 0x07c2,
        description: "(\u0392) GREEK CAPITAL LETTER BETA",
    },
    XK_Greek_GAMMA: {
        code: 0x07c3,
        description: "(\u0393) GREEK CAPITAL LETTER GAMMA",
    },
    XK_Greek_DELTA: {
        code: 0x07c4,
        description: "(\u0394) GREEK CAPITAL LETTER DELTA",
    },
    XK_Greek_EPSILON: {
        code: 0x07c5,
        description: "(\u0395) GREEK CAPITAL LETTER EPSILON",
    },
    XK_Greek_ZETA: {
        code: 0x07c6,
        description: "(\u0396) GREEK CAPITAL LETTER ZETA",
    },
    XK_Greek_ETA: {
        code: 0x07c7,
        description: "(\u0397) GREEK CAPITAL LETTER ETA",
    },
    XK_Greek_THETA: {
        code: 0x07c8,
        description: "(\u0398) GREEK CAPITAL LETTER THETA",
    },
    XK_Greek_IOTA: {
        code: 0x07c9,
        description: "(\u0399) GREEK CAPITAL LETTER IOTA",
    },
    XK_Greek_KAPPA: {
        code: 0x07ca,
        description: "(\u039A) GREEK CAPITAL LETTER KAPPA",
    },
    XK_Greek_LAMDA: {
        code: 0x07cb,
        description: "(\u039B) GREEK CAPITAL LETTER LAMDA",
    },
    XK_Greek_LAMBDA: {
        code: 0x07cb,
        description: "(\u039B) GREEK CAPITAL LETTER LAMDA",
    },
    XK_Greek_MU: {
        code: 0x07cc,
        description: "(\u039C) GREEK CAPITAL LETTER MU",
    },
    XK_Greek_NU: {
        code: 0x07cd,
        description: "(\u039D) GREEK CAPITAL LETTER NU",
    },
    XK_Greek_XI: {
        code: 0x07ce,
        description: "(\u039E) GREEK CAPITAL LETTER XI",
    },
    XK_Greek_OMICRON: {
        code: 0x07cf,
        description: "(\u039F) GREEK CAPITAL LETTER OMICRON",
    },
    XK_Greek_PI: {
        code: 0x07d0,
        description: "(\u03A0) GREEK CAPITAL LETTER PI",
    },
    XK_Greek_RHO: {
        code: 0x07d1,
        description: "(\u03A1) GREEK CAPITAL LETTER RHO",
    },
    XK_Greek_SIGMA: {
        code: 0x07d2,
        description: "(\u03A3) GREEK CAPITAL LETTER SIGMA",
    },
    XK_Greek_TAU: {
        code: 0x07d4,
        description: "(\u03A4) GREEK CAPITAL LETTER TAU",
    },
    XK_Greek_UPSILON: {
        code: 0x07d5,
        description: "(\u03A5) GREEK CAPITAL LETTER UPSILON",
    },
    XK_Greek_PHI: {
        code: 0x07d6,
        description: "(\u03A6) GREEK CAPITAL LETTER PHI",
    },
    XK_Greek_CHI: {
        code: 0x07d7,
        description: "(\u03A7) GREEK CAPITAL LETTER CHI",
    },
    XK_Greek_PSI: {
        code: 0x07d8,
        description: "(\u03A8) GREEK CAPITAL LETTER PSI",
    },
    XK_Greek_OMEGA: {
        code: 0x07d9,
        description: "(\u03A9) GREEK CAPITAL LETTER OMEGA",
    },
    XK_Greek_alpha: {
        code: 0x07e1,
        description: "(\u03B1) GREEK SMALL LETTER ALPHA",
    },
    XK_Greek_beta: {
        code: 0x07e2,
        description: "(\u03B2) GREEK SMALL LETTER BETA",
    },
    XK_Greek_gamma: {
        code: 0x07e3,
        description: "(\u03B3) GREEK SMALL LETTER GAMMA",
    },
    XK_Greek_delta: {
        code: 0x07e4,
        description: "(\u03B4) GREEK SMALL LETTER DELTA",
    },
    XK_Greek_epsilon: {
        code: 0x07e5,
        description: "(\u03B5) GREEK SMALL LETTER EPSILON",
    },
    XK_Greek_zeta: {
        code: 0x07e6,
        description: "(\u03B6) GREEK SMALL LETTER ZETA",
    },
    XK_Greek_eta: {
        code: 0x07e7,
        description: "(\u03B7) GREEK SMALL LETTER ETA",
    },
    XK_Greek_theta: {
        code: 0x07e8,
        description: "(\u03B8) GREEK SMALL LETTER THETA",
    },
    XK_Greek_iota: {
        code: 0x07e9,
        description: "(\u03B9) GREEK SMALL LETTER IOTA",
    },
    XK_Greek_kappa: {
        code: 0x07ea,
        description: "(\u03BA) GREEK SMALL LETTER KAPPA",
    },
    XK_Greek_lamda: {
        code: 0x07eb,
        description: "(\u03BB) GREEK SMALL LETTER LAMDA",
    },
    XK_Greek_lambda: {
        code: 0x07eb,
        description: "(\u03BB) GREEK SMALL LETTER LAMDA",
    },
    XK_Greek_mu: { code: 0x07ec, description: "(\u03BC) GREEK SMALL LETTER MU" },
    XK_Greek_nu: { code: 0x07ed, description: "(\u03BD) GREEK SMALL LETTER NU" },
    XK_Greek_xi: { code: 0x07ee, description: "(\u03BE) GREEK SMALL LETTER XI" },
    XK_Greek_omicron: {
        code: 0x07ef,
        description: "(\u03BF) GREEK SMALL LETTER OMICRON",
    },
    XK_Greek_pi: { code: 0x07f0, description: "(\u03C0) GREEK SMALL LETTER PI" },
    XK_Greek_rho: {
        code: 0x07f1,
        description: "(\u03C1) GREEK SMALL LETTER RHO",
    },
    XK_Greek_sigma: {
        code: 0x07f2,
        description: "(\u03C3) GREEK SMALL LETTER SIGMA",
    },
    XK_Greek_finalsmallsigma: {
        code: 0x07f3,
        description: "(\u03C2) GREEK SMALL LETTER FINAL SIGMA",
    },
    XK_Greek_tau: {
        code: 0x07f4,
        description: "(\u03C4) GREEK SMALL LETTER TAU",
    },
    XK_Greek_upsilon: {
        code: 0x07f5,
        description: "(\u03C5) GREEK SMALL LETTER UPSILON",
    },
    XK_Greek_phi: {
        code: 0x07f6,
        description: "(\u03C6) GREEK SMALL LETTER PHI",
    },
    XK_Greek_chi: {
        code: 0x07f7,
        description: "(\u03C7) GREEK SMALL LETTER CHI",
    },
    XK_Greek_psi: {
        code: 0x07f8,
        description: "(\u03C8) GREEK SMALL LETTER PSI",
    },
    XK_Greek_omega: {
        code: 0x07f9,
        description: "(\u03C9) GREEK SMALL LETTER OMEGA",
    },
    XK_Greek_switch: { code: 0xff7e, description: "Alias for mode_switch" },

    /*
   * Technical
   * (from the DEC VT330/VT420 Technical Character Set, http://vt100.net/charsets/technical.html)
   * Byte 3 = 8
   */

    // Group XK_TECHNICAL
    XK_leftradical: {
        code: 0x08a1,
        description: "(\u23B7) RADICAL SYMBOL BOTTOM",
    },
    XK_topleftradical: {
        code: 0x08a2,
        description: "((\u250C) BOX DRAWINGS LIGHT DOWN AND RIGHT)",
    },
    XK_horizconnector: {
        code: 0x08a3,
        description: "((\u2500) BOX DRAWINGS LIGHT HORIZONTAL)",
    },
    XK_topintegral: { code: 0x08a4, description: "(\u2320) TOP HALF INTEGRAL" },
    XK_botintegral: {
        code: 0x08a5,
        description: "(\u2321) BOTTOM HALF INTEGRAL",
    },
    XK_vertconnector: {
        code: 0x08a6,
        description: "((\u2502) BOX DRAWINGS LIGHT VERTICAL)",
    },
    XK_topleftsqbracket: {
        code: 0x08a7,
        description: "(\u23A1) LEFT SQUARE BRACKET UPPER CORNER",
    },
    XK_botleftsqbracket: {
        code: 0x08a8,
        description: "(\u23A3) LEFT SQUARE BRACKET LOWER CORNER",
    },
    XK_toprightsqbracket: {
        code: 0x08a9,
        description: "(\u23A4) RIGHT SQUARE BRACKET UPPER CORNER",
    },
    XK_botrightsqbracket: {
        code: 0x08aa,
        description: "(\u23A6) RIGHT SQUARE BRACKET LOWER CORNER",
    },
    XK_topleftparens: {
        code: 0x08ab,
        description: "(\u239B) LEFT PARENTHESIS UPPER HOOK",
    },
    XK_botleftparens: {
        code: 0x08ac,
        description: "(\u239D) LEFT PARENTHESIS LOWER HOOK",
    },
    XK_toprightparens: {
        code: 0x08ad,
        description: "(\u239E) RIGHT PARENTHESIS UPPER HOOK",
    },
    XK_botrightparens: {
        code: 0x08ae,
        description: "(\u23A0) RIGHT PARENTHESIS LOWER HOOK",
    },
    XK_leftmiddlecurlybrace: {
        code: 0x08af,
        description: "(\u23A8) LEFT CURLY BRACKET MIDDLE PIECE",
    },
    XK_rightmiddlecurlybrace: {
        code: 0x08b0,
        description: "(\u23AC) RIGHT CURLY BRACKET MIDDLE PIECE",
    },
    XK_topleftsummation: { code: 0x08b1, description: null },
    XK_botleftsummation: { code: 0x08b2, description: null },
    XK_topvertsummationconnector: { code: 0x08b3, description: null },
    XK_botvertsummationconnector: { code: 0x08b4, description: null },
    XK_toprightsummation: { code: 0x08b5, description: null },
    XK_botrightsummation: { code: 0x08b6, description: null },
    XK_rightmiddlesummation: { code: 0x08b7, description: null },
    XK_lessthanequal: {
        code: 0x08bc,
        description: "(\u2264) LESS-THAN OR EQUAL TO",
    },
    XK_notequal: { code: 0x08bd, description: "(\u2260) NOT EQUAL TO" },
    XK_greaterthanequal: {
        code: 0x08be,
        description: "(\u2265) GREATER-THAN OR EQUAL TO",
    },
    XK_integral: { code: 0x08bf, description: "(\u222B) INTEGRAL" },
    XK_therefore: { code: 0x08c0, description: "(\u2234) THEREFORE" },
    XK_variation: { code: 0x08c1, description: "(\u221D) PROPORTIONAL TO" },
    XK_infinity: { code: 0x08c2, description: "(\u221E) INFINITY" },
    XK_nabla: { code: 0x08c5, description: "(\u2207) NABLA" },
    XK_approximate: { code: 0x08c8, description: "(\u223C) TILDE OPERATOR" },
    XK_similarequal: {
        code: 0x08c9,
        description: "(\u2243) ASYMPTOTICALLY EQUAL TO",
    },
    XK_ifonlyif: {
        code: 0x08cd,
        description: "(\u21D4) LEFT RIGHT DOUBLE ARROW",
    },
    XK_implies: { code: 0x08ce, description: "(\u21D2) RIGHTWARDS DOUBLE ARROW" },
    XK_identical: { code: 0x08cf, description: "(\u2261) IDENTICAL TO" },
    XK_radical: { code: 0x08d6, description: "(\u221A) SQUARE ROOT" },
    XK_includedin: { code: 0x08da, description: "(\u2282) SUBSET OF" },
    XK_includes: { code: 0x08db, description: "(\u2283) SUPERSET OF" },
    XK_intersection: { code: 0x08dc, description: "(\u2229) INTERSECTION" },
    XK_union: { code: 0x08dd, description: "(\u222A) UNION" },
    XK_logicaland: { code: 0x08de, description: "(\u2227) LOGICAL AND" },
    XK_logicalor: { code: 0x08df, description: "(\u2228) LOGICAL OR" },
    XK_partialderivative: {
        code: 0x08ef,
        description: "(\u2202) PARTIAL DIFFERENTIAL",
    },
    XK_function: {
        code: 0x08f6,
        description: "(\u0192) LATIN SMALL LETTER F WITH HOOK",
    },
    XK_leftarrow: { code: 0x08fb, description: "(\u2190) LEFTWARDS ARROW" },
    XK_uparrow: { code: 0x08fc, description: "(\u2191) UPWARDS ARROW" },
    XK_rightarrow: { code: 0x08fd, description: "(\u2192) RIGHTWARDS ARROW" },
    XK_downarrow: { code: 0x08fe, description: "(\u2193) DOWNWARDS ARROW" },

    /*
   * Special
   * (from the DEC VT100 Special Graphics Character Set)
   * Byte 3 = 9
   */

    // Group XK_SPECIAL
    XK_blank: { code: 0x09df, description: null },
    XK_soliddiamond: { code: 0x09e0, description: "(\u25C6) BLACK DIAMOND" },
    XK_checkerboard: { code: 0x09e1, description: "(\u2592) MEDIUM SHADE" },
    XK_ht: {
        code: 0x09e2,
        description: "(\u2409) SYMBOL FOR HORIZONTAL TABULATION",
    },
    XK_ff: { code: 0x09e3, description: "(\u240C) SYMBOL FOR FORM FEED" },
    XK_cr: { code: 0x09e4, description: "(\u240D) SYMBOL FOR CARRIAGE RETURN" },
    XK_lf: { code: 0x09e5, description: "(\u240A) SYMBOL FOR LINE FEED" },
    XK_nl: { code: 0x09e8, description: "(\u2424) SYMBOL FOR NEWLINE" },
    XK_vt: {
        code: 0x09e9,
        description: "(\u240B) SYMBOL FOR VERTICAL TABULATION",
    },
    XK_lowrightcorner: {
        code: 0x09ea,
        description: "(\u2518) BOX DRAWINGS LIGHT UP AND LEFT",
    },
    XK_uprightcorner: {
        code: 0x09eb,
        description: "(\u2510) BOX DRAWINGS LIGHT DOWN AND LEFT",
    },
    XK_upleftcorner: {
        code: 0x09ec,
        description: "(\u250C) BOX DRAWINGS LIGHT DOWN AND RIGHT",
    },
    XK_lowleftcorner: {
        code: 0x09ed,
        description: "(\u2514) BOX DRAWINGS LIGHT UP AND RIGHT",
    },
    XK_crossinglines: {
        code: 0x09ee,
        description: "(\u253C) BOX DRAWINGS LIGHT VERTICAL AND HORIZONTAL",
    },
    XK_horizlinescan1: {
        code: 0x09ef,
        description: "(\u23BA) HORIZONTAL SCAN LINE-1",
    },
    XK_horizlinescan3: {
        code: 0x09f0,
        description: "(\u23BB) HORIZONTAL SCAN LINE-3",
    },
    XK_horizlinescan5: {
        code: 0x09f1,
        description: "(\u2500) BOX DRAWINGS LIGHT HORIZONTAL",
    },
    XK_horizlinescan7: {
        code: 0x09f2,
        description: "(\u23BC) HORIZONTAL SCAN LINE-7",
    },
    XK_horizlinescan9: {
        code: 0x09f3,
        description: "(\u23BD) HORIZONTAL SCAN LINE-9",
    },
    XK_leftt: {
        code: 0x09f4,
        description: "(\u251C) BOX DRAWINGS LIGHT VERTICAL AND RIGHT",
    },
    XK_rightt: {
        code: 0x09f5,
        description: "(\u2524) BOX DRAWINGS LIGHT VERTICAL AND LEFT",
    },
    XK_bott: {
        code: 0x09f6,
        description: "(\u2534) BOX DRAWINGS LIGHT UP AND HORIZONTAL",
    },
    XK_topt: {
        code: 0x09f7,
        description: "(\u252C) BOX DRAWINGS LIGHT DOWN AND HORIZONTAL",
    },
    XK_vertbar: {
        code: 0x09f8,
        description: "(\u2502) BOX DRAWINGS LIGHT VERTICAL",
    },

    /*
   * Publishing
   * (these are probably from a long forgotten DEC Publishing
   * font that once shipped with DECwrite)
   * Byte 3 = 0x0a
   */

    // Group XK_PUBLISHING
    XK_emspace: { code: 0x0aa1, description: "(\u2003) EM SPACE" },
    XK_enspace: { code: 0x0aa2, description: "(\u2002) EN SPACE" },
    XK_em3space: { code: 0x0aa3, description: "(\u2004) THREE-PER-EM SPACE" },
    XK_em4space: { code: 0x0aa4, description: "(\u2005) FOUR-PER-EM SPACE" },
    XK_digitspace: { code: 0x0aa5, description: "(\u2007) FIGURE SPACE" },
    XK_punctspace: { code: 0x0aa6, description: "(\u2008) PUNCTUATION SPACE" },
    XK_thinspace: { code: 0x0aa7, description: "(\u2009) THIN SPACE" },
    XK_hairspace: { code: 0x0aa8, description: "(\u200A) HAIR SPACE" },
    XK_emdash: { code: 0x0aa9, description: "(\u2014) EM DASH" },
    XK_endash: { code: 0x0aaa, description: "(\u2013) EN DASH" },
    XK_signifblank: { code: 0x0aac, description: "((\u2423) OPEN BOX)" },
    XK_ellipsis: { code: 0x0aae, description: "(\u2026) HORIZONTAL ELLIPSIS" },
    XK_doubbaselinedot: { code: 0x0aaf, description: "(\u2025) TWO DOT LEADER" },
    XK_onethird: {
        code: 0x0ab0,
        description: "(\u2153) VULGAR FRACTION ONE THIRD",
    },
    XK_twothirds: {
        code: 0x0ab1,
        description: "(\u2154) VULGAR FRACTION TWO THIRDS",
    },
    XK_onefifth: {
        code: 0x0ab2,
        description: "(\u2155) VULGAR FRACTION ONE FIFTH",
    },
    XK_twofifths: {
        code: 0x0ab3,
        description: "(\u2156) VULGAR FRACTION TWO FIFTHS",
    },
    XK_threefifths: {
        code: 0x0ab4,
        description: "(\u2157) VULGAR FRACTION THREE FIFTHS",
    },
    XK_fourfifths: {
        code: 0x0ab5,
        description: "(\u2158) VULGAR FRACTION FOUR FIFTHS",
    },
    XK_onesixth: {
        code: 0x0ab6,
        description: "(\u2159) VULGAR FRACTION ONE SIXTH",
    },
    XK_fivesixths: {
        code: 0x0ab7,
        description: "(\u215A) VULGAR FRACTION FIVE SIXTHS",
    },
    XK_careof: { code: 0x0ab8, description: "(\u2105) CARE OF" },
    XK_figdash: { code: 0x0abb, description: "(\u2012) FIGURE DASH" },
    XK_leftanglebracket: {
        code: 0x0abc,
        description: "((\u27E8) MATHEMATICAL LEFT ANGLE BRACKET)",
    },
    XK_decimalpoint: { code: 0x0abd, description: "((\u002E) FULL STOP)" },
    XK_rightanglebracket: {
        code: 0x0abe,
        description: "((\u27E9) MATHEMATICAL RIGHT ANGLE BRACKET)",
    },
    XK_marker: { code: 0x0abf, description: null },
    XK_oneeighth: {
        code: 0x0ac3,
        description: "(\u215B) VULGAR FRACTION ONE EIGHTH",
    },
    XK_threeeighths: {
        code: 0x0ac4,
        description: "(\u215C) VULGAR FRACTION THREE EIGHTHS",
    },
    XK_fiveeighths: {
        code: 0x0ac5,
        description: "(\u215D) VULGAR FRACTION FIVE EIGHTHS",
    },
    XK_seveneighths: {
        code: 0x0ac6,
        description: "(\u215E) VULGAR FRACTION SEVEN EIGHTHS",
    },
    XK_trademark: { code: 0x0ac9, description: "(\u2122) TRADE MARK SIGN" },
    XK_signaturemark: { code: 0x0aca, description: "((\u2613) SALTIRE)" },
    XK_trademarkincircle: { code: 0x0acb, description: null },
    XK_leftopentriangle: {
        code: 0x0acc,
        description: "((\u25C1) WHITE LEFT-POINTING TRIANGLE)",
    },
    XK_rightopentriangle: {
        code: 0x0acd,
        description: "((\u25B7) WHITE RIGHT-POINTING TRIANGLE)",
    },
    XK_emopencircle: { code: 0x0ace, description: "((\u25CB) WHITE CIRCLE)" },
    XK_emopenrectangle: {
        code: 0x0acf,
        description: "((\u25AF) WHITE VERTICAL RECTANGLE)",
    },
    XK_leftsinglequotemark: {
        code: 0x0ad0,
        description: "(\u2018) LEFT SINGLE QUOTATION MARK",
    },
    XK_rightsinglequotemark: {
        code: 0x0ad1,
        description: "(\u2019) RIGHT SINGLE QUOTATION MARK",
    },
    XK_leftdoublequotemark: {
        code: 0x0ad2,
        description: "(\u201C) LEFT DOUBLE QUOTATION MARK",
    },
    XK_rightdoublequotemark: {
        code: 0x0ad3,
        description: "(\u201D) RIGHT DOUBLE QUOTATION MARK",
    },
    XK_prescription: { code: 0x0ad4, description: "(\u211E) PRESCRIPTION TAKE" },
    XK_permille: { code: 0x0ad5, description: "(\u2030) PER MILLE SIGN" },
    XK_minutes: { code: 0x0ad6, description: "(\u2032) PRIME" },
    XK_seconds: { code: 0x0ad7, description: "(\u2033) DOUBLE PRIME" },
    XK_latincross: { code: 0x0ad9, description: "(\u271D) LATIN CROSS" },
    XK_hexagram: { code: 0x0ada, description: null },
    XK_filledrectbullet: {
        code: 0x0adb,
        description: "((\u25AC) BLACK RECTANGLE)",
    },
    XK_filledlefttribullet: {
        code: 0x0adc,
        description: "((\u25C0) BLACK LEFT-POINTING TRIANGLE)",
    },
    XK_filledrighttribullet: {
        code: 0x0add,
        description: "((\u25B6) BLACK RIGHT-POINTING TRIANGLE)",
    },
    XK_emfilledcircle: { code: 0x0ade, description: "((\u25CF) BLACK CIRCLE)" },
    XK_emfilledrect: {
        code: 0x0adf,
        description: "((\u25AE) BLACK VERTICAL RECTANGLE)",
    },
    XK_enopencircbullet: { code: 0x0ae0, description: "((\u25E6) WHITE BULLET)" },
    XK_enopensquarebullet: {
        code: 0x0ae1,
        description: "((\u25AB) WHITE SMALL SQUARE)",
    },
    XK_openrectbullet: {
        code: 0x0ae2,
        description: "((\u25AD) WHITE RECTANGLE)",
    },
    XK_opentribulletup: {
        code: 0x0ae3,
        description: "((\u25B3) WHITE UP-POINTING TRIANGLE)",
    },
    XK_opentribulletdown: {
        code: 0x0ae4,
        description: "((\u25BD) WHITE DOWN-POINTING TRIANGLE)",
    },
    XK_openstar: { code: 0x0ae5, description: "((\u2606) WHITE STAR)" },
    XK_enfilledcircbullet: { code: 0x0ae6, description: "((\u2022) BULLET)" },
    XK_enfilledsqbullet: {
        code: 0x0ae7,
        description: "((\u25AA) BLACK SMALL SQUARE)",
    },
    XK_filledtribulletup: {
        code: 0x0ae8,
        description: "((\u25B2) BLACK UP-POINTING TRIANGLE)",
    },
    XK_filledtribulletdown: {
        code: 0x0ae9,
        description: "((\u25BC) BLACK DOWN-POINTING TRIANGLE)",
    },
    XK_leftpointer: {
        code: 0x0aea,
        description: "((\u261C) WHITE LEFT POINTING INDEX)",
    },
    XK_rightpointer: {
        code: 0x0aeb,
        description: "((\u261E) WHITE RIGHT POINTING INDEX)",
    },
    XK_club: { code: 0x0aec, description: "(\u2663) BLACK CLUB SUIT" },
    XK_diamond: { code: 0x0aed, description: "(\u2666) BLACK DIAMOND SUIT" },
    XK_heart: { code: 0x0aee, description: "(\u2665) BLACK HEART SUIT" },
    XK_maltesecross: { code: 0x0af0, description: "(\u2720) MALTESE CROSS" },
    XK_dagger: { code: 0x0af1, description: "(\u2020) DAGGER" },
    XK_doubledagger: { code: 0x0af2, description: "(\u2021) DOUBLE DAGGER" },
    XK_checkmark: { code: 0x0af3, description: "(\u2713) CHECK MARK" },
    XK_ballotcross: { code: 0x0af4, description: "(\u2717) BALLOT X" },
    XK_musicalsharp: { code: 0x0af5, description: "(\u266F) MUSIC SHARP SIGN" },
    XK_musicalflat: { code: 0x0af6, description: "(\u266D) MUSIC FLAT SIGN" },
    XK_malesymbol: { code: 0x0af7, description: "(\u2642) MALE SIGN" },
    XK_femalesymbol: { code: 0x0af8, description: "(\u2640) FEMALE SIGN" },
    XK_telephone: { code: 0x0af9, description: "(\u260E) BLACK TELEPHONE" },
    XK_telephonerecorder: {
        code: 0x0afa,
        description: "(\u2315) TELEPHONE RECORDER",
    },
    XK_phonographcopyright: {
        code: 0x0afb,
        description: "(\u2117) SOUND RECORDING COPYRIGHT",
    },
    XK_caret: { code: 0x0afc, description: "(\u2038) CARET" },
    XK_singlelowquotemark: {
        code: 0x0afd,
        description: "(\u201A) SINGLE LOW-9 QUOTATION MARK",
    },
    XK_doublelowquotemark: {
        code: 0x0afe,
        description: "(\u201E) DOUBLE LOW-9 QUOTATION MARK",
    },
    XK_cursor: { code: 0x0aff, description: null },

    /*
   * APL
   * Byte 3 = 0x0b
   */

    // Group XK_APL
    XK_leftcaret: { code: 0x0ba3, description: "((\u003C) LESS-THAN SIGN)" },
    XK_rightcaret: { code: 0x0ba6, description: "((\u003E) GREATER-THAN SIGN)" },
    XK_downcaret: { code: 0x0ba8, description: "((\u2228) LOGICAL OR)" },
    XK_upcaret: { code: 0x0ba9, description: "((\u2227) LOGICAL AND)" },
    XK_overbar: { code: 0x0bc0, description: "((\u00AF) MACRON)" },
    XK_downtack: { code: 0x0bc2, description: "(\u22A4) DOWN TACK" },
    XK_upshoe: { code: 0x0bc3, description: "((\u2229) INTERSECTION)" },
    XK_downstile: { code: 0x0bc4, description: "(\u230A) LEFT FLOOR" },
    XK_underbar: { code: 0x0bc6, description: "((\u005F) LOW LINE)" },
    XK_jot: { code: 0x0bca, description: "(\u2218) RING OPERATOR" },
    XK_quad: { code: 0x0bcc, description: "(\u2395) APL FUNCTIONAL SYMBOL QUAD" },
    XK_uptack: { code: 0x0bce, description: "(\u22A5) UP TACK" },
    XK_circle: { code: 0x0bcf, description: "(\u25CB) WHITE CIRCLE" },
    XK_upstile: { code: 0x0bd3, description: "(\u2308) LEFT CEILING" },
    XK_downshoe: { code: 0x0bd6, description: "((\u222A) UNION)" },
    XK_rightshoe: { code: 0x0bd8, description: "((\u2283) SUPERSET OF)" },
    XK_leftshoe: { code: 0x0bda, description: "((\u2282) SUBSET OF)" },
    XK_lefttack: { code: 0x0bdc, description: "(\u22A3) LEFT TACK" },
    XK_righttack: { code: 0x0bfc, description: "(\u22A2) RIGHT TACK" },

    /*
   * Hebrew
   * Byte 3 = 0x0c
   */

    // Group XK_HEBREW
    XK_hebrew_doublelowline: {
        code: 0x0cdf,
        description: "(\u2017) DOUBLE LOW LINE",
    },
    XK_hebrew_aleph: { code: 0x0ce0, description: "(\u05D0) HEBREW LETTER ALEF" },
    XK_hebrew_bet: { code: 0x0ce1, description: "(\u05D1) HEBREW LETTER BET" },
    XK_hebrew_beth: { code: 0x0ce1, description: "deprecated" },
    XK_hebrew_gimel: {
        code: 0x0ce2,
        description: "(\u05D2) HEBREW LETTER GIMEL",
    },
    XK_hebrew_gimmel: { code: 0x0ce2, description: "deprecated" },
    XK_hebrew_dalet: {
        code: 0x0ce3,
        description: "(\u05D3) HEBREW LETTER DALET",
    },
    XK_hebrew_daleth: { code: 0x0ce3, description: "deprecated" },
    XK_hebrew_he: { code: 0x0ce4, description: "(\u05D4) HEBREW LETTER HE" },
    XK_hebrew_waw: { code: 0x0ce5, description: "(\u05D5) HEBREW LETTER VAV" },
    XK_hebrew_zain: { code: 0x0ce6, description: "(\u05D6) HEBREW LETTER ZAYIN" },
    XK_hebrew_zayin: { code: 0x0ce6, description: "deprecated" },
    XK_hebrew_chet: { code: 0x0ce7, description: "(\u05D7) HEBREW LETTER HET" },
    XK_hebrew_het: { code: 0x0ce7, description: "deprecated" },
    XK_hebrew_tet: { code: 0x0ce8, description: "(\u05D8) HEBREW LETTER TET" },
    XK_hebrew_teth: { code: 0x0ce8, description: "deprecated" },
    XK_hebrew_yod: { code: 0x0ce9, description: "(\u05D9) HEBREW LETTER YOD" },
    XK_hebrew_finalkaph: {
        code: 0x0cea,
        description: "(\u05DA) HEBREW LETTER FINAL KAF",
    },
    XK_hebrew_kaph: { code: 0x0ceb, description: "(\u05DB) HEBREW LETTER KAF" },
    XK_hebrew_lamed: {
        code: 0x0cec,
        description: "(\u05DC) HEBREW LETTER LAMED",
    },
    XK_hebrew_finalmem: {
        code: 0x0ced,
        description: "(\u05DD) HEBREW LETTER FINAL MEM",
    },
    XK_hebrew_mem: { code: 0x0cee, description: "(\u05DE) HEBREW LETTER MEM" },
    XK_hebrew_finalnun: {
        code: 0x0cef,
        description: "(\u05DF) HEBREW LETTER FINAL NUN",
    },
    XK_hebrew_nun: { code: 0x0cf0, description: "(\u05E0) HEBREW LETTER NUN" },
    XK_hebrew_samech: {
        code: 0x0cf1,
        description: "(\u05E1) HEBREW LETTER SAMEKH",
    },
    XK_hebrew_samekh: { code: 0x0cf1, description: "deprecated" },
    XK_hebrew_ayin: { code: 0x0cf2, description: "(\u05E2) HEBREW LETTER AYIN" },
    XK_hebrew_finalpe: {
        code: 0x0cf3,
        description: "(\u05E3) HEBREW LETTER FINAL PE",
    },
    XK_hebrew_pe: { code: 0x0cf4, description: "(\u05E4) HEBREW LETTER PE" },
    XK_hebrew_finalzade: {
        code: 0x0cf5,
        description: "(\u05E5) HEBREW LETTER FINAL TSADI",
    },
    XK_hebrew_finalzadi: { code: 0x0cf5, description: "deprecated" },
    XK_hebrew_zade: { code: 0x0cf6, description: "(\u05E6) HEBREW LETTER TSADI" },
    XK_hebrew_zadi: { code: 0x0cf6, description: "deprecated" },
    XK_hebrew_qoph: { code: 0x0cf7, description: "(\u05E7) HEBREW LETTER QOF" },
    XK_hebrew_kuf: { code: 0x0cf7, description: "deprecated" },
    XK_hebrew_resh: { code: 0x0cf8, description: "(\u05E8) HEBREW LETTER RESH" },
    XK_hebrew_shin: { code: 0x0cf9, description: "(\u05E9) HEBREW LETTER SHIN" },
    XK_hebrew_taw: { code: 0x0cfa, description: "(\u05EA) HEBREW LETTER TAV" },
    XK_hebrew_taf: { code: 0x0cfa, description: "deprecated" },
    XK_Hebrew_switch: { code: 0xff7e, description: "Alias for mode_switch" },

    /*
   * Thai
   * Byte 3 = 0x0d
   */

    // Group XK_THAI
    XK_Thai_kokai: {
        code: 0x0da1,
        description: "(\u0E01) THAI CHARACTER KO KAI",
    },
    XK_Thai_khokhai: {
        code: 0x0da2,
        description: "(\u0E02) THAI CHARACTER KHO KHAI",
    },
    XK_Thai_khokhuat: {
        code: 0x0da3,
        description: "(\u0E03) THAI CHARACTER KHO KHUAT",
    },
    XK_Thai_khokhwai: {
        code: 0x0da4,
        description: "(\u0E04) THAI CHARACTER KHO KHWAI",
    },
    XK_Thai_khokhon: {
        code: 0x0da5,
        description: "(\u0E05) THAI CHARACTER KHO KHON",
    },
    XK_Thai_khorakhang: {
        code: 0x0da6,
        description: "(\u0E06) THAI CHARACTER KHO RAKHANG",
    },
    XK_Thai_ngongu: {
        code: 0x0da7,
        description: "(\u0E07) THAI CHARACTER NGO NGU",
    },
    XK_Thai_chochan: {
        code: 0x0da8,
        description: "(\u0E08) THAI CHARACTER CHO CHAN",
    },
    XK_Thai_choching: {
        code: 0x0da9,
        description: "(\u0E09) THAI CHARACTER CHO CHING",
    },
    XK_Thai_chochang: {
        code: 0x0daa,
        description: "(\u0E0A) THAI CHARACTER CHO CHANG",
    },
    XK_Thai_soso: { code: 0x0dab, description: "(\u0E0B) THAI CHARACTER SO SO" },
    XK_Thai_chochoe: {
        code: 0x0dac,
        description: "(\u0E0C) THAI CHARACTER CHO CHOE",
    },
    XK_Thai_yoying: {
        code: 0x0dad,
        description: "(\u0E0D) THAI CHARACTER YO YING",
    },
    XK_Thai_dochada: {
        code: 0x0dae,
        description: "(\u0E0E) THAI CHARACTER DO CHADA",
    },
    XK_Thai_topatak: {
        code: 0x0daf,
        description: "(\u0E0F) THAI CHARACTER TO PATAK",
    },
    XK_Thai_thothan: {
        code: 0x0db0,
        description: "(\u0E10) THAI CHARACTER THO THAN",
    },
    XK_Thai_thonangmontho: {
        code: 0x0db1,
        description: "(\u0E11) THAI CHARACTER THO NANGMONTHO",
    },
    XK_Thai_thophuthao: {
        code: 0x0db2,
        description: "(\u0E12) THAI CHARACTER THO PHUTHAO",
    },
    XK_Thai_nonen: {
        code: 0x0db3,
        description: "(\u0E13) THAI CHARACTER NO NEN",
    },
    XK_Thai_dodek: {
        code: 0x0db4,
        description: "(\u0E14) THAI CHARACTER DO DEK",
    },
    XK_Thai_totao: {
        code: 0x0db5,
        description: "(\u0E15) THAI CHARACTER TO TAO",
    },
    XK_Thai_thothung: {
        code: 0x0db6,
        description: "(\u0E16) THAI CHARACTER THO THUNG",
    },
    XK_Thai_thothahan: {
        code: 0x0db7,
        description: "(\u0E17) THAI CHARACTER THO THAHAN",
    },
    XK_Thai_thothong: {
        code: 0x0db8,
        description: "(\u0E18) THAI CHARACTER THO THONG",
    },
    XK_Thai_nonu: { code: 0x0db9, description: "(\u0E19) THAI CHARACTER NO NU" },
    XK_Thai_bobaimai: {
        code: 0x0dba,
        description: "(\u0E1A) THAI CHARACTER BO BAIMAI",
    },
    XK_Thai_popla: {
        code: 0x0dbb,
        description: "(\u0E1B) THAI CHARACTER PO PLA",
    },
    XK_Thai_phophung: {
        code: 0x0dbc,
        description: "(\u0E1C) THAI CHARACTER PHO PHUNG",
    },
    XK_Thai_fofa: { code: 0x0dbd, description: "(\u0E1D) THAI CHARACTER FO FA" },
    XK_Thai_phophan: {
        code: 0x0dbe,
        description: "(\u0E1E) THAI CHARACTER PHO PHAN",
    },
    XK_Thai_fofan: {
        code: 0x0dbf,
        description: "(\u0E1F) THAI CHARACTER FO FAN",
    },
    XK_Thai_phosamphao: {
        code: 0x0dc0,
        description: "(\u0E20) THAI CHARACTER PHO SAMPHAO",
    },
    XK_Thai_moma: { code: 0x0dc1, description: "(\u0E21) THAI CHARACTER MO MA" },
    XK_Thai_yoyak: {
        code: 0x0dc2,
        description: "(\u0E22) THAI CHARACTER YO YAK",
    },
    XK_Thai_rorua: {
        code: 0x0dc3,
        description: "(\u0E23) THAI CHARACTER RO RUA",
    },
    XK_Thai_ru: { code: 0x0dc4, description: "(\u0E24) THAI CHARACTER RU" },
    XK_Thai_loling: {
        code: 0x0dc5,
        description: "(\u0E25) THAI CHARACTER LO LING",
    },
    XK_Thai_lu: { code: 0x0dc6, description: "(\u0E26) THAI CHARACTER LU" },
    XK_Thai_wowaen: {
        code: 0x0dc7,
        description: "(\u0E27) THAI CHARACTER WO WAEN",
    },
    XK_Thai_sosala: {
        code: 0x0dc8,
        description: "(\u0E28) THAI CHARACTER SO SALA",
    },
    XK_Thai_sorusi: {
        code: 0x0dc9,
        description: "(\u0E29) THAI CHARACTER SO RUSI",
    },
    XK_Thai_sosua: {
        code: 0x0dca,
        description: "(\u0E2A) THAI CHARACTER SO SUA",
    },
    XK_Thai_hohip: {
        code: 0x0dcb,
        description: "(\u0E2B) THAI CHARACTER HO HIP",
    },
    XK_Thai_lochula: {
        code: 0x0dcc,
        description: "(\u0E2C) THAI CHARACTER LO CHULA",
    },
    XK_Thai_oang: { code: 0x0dcd, description: "(\u0E2D) THAI CHARACTER O ANG" },
    XK_Thai_honokhuk: {
        code: 0x0dce,
        description: "(\u0E2E) THAI CHARACTER HO NOKHUK",
    },
    XK_Thai_paiyannoi: {
        code: 0x0dcf,
        description: "(\u0E2F) THAI CHARACTER PAIYANNOI",
    },
    XK_Thai_saraa: {
        code: 0x0dd0,
        description: "(\u0E30) THAI CHARACTER SARA A",
    },
    XK_Thai_maihanakat: {
        code: 0x0dd1,
        description: "(\u0E31) THAI CHARACTER MAI HAN-AKAT",
    },
    XK_Thai_saraaa: {
        code: 0x0dd2,
        description: "(\u0E32) THAI CHARACTER SARA AA",
    },
    XK_Thai_saraam: {
        code: 0x0dd3,
        description: "(\u0E33) THAI CHARACTER SARA AM",
    },
    XK_Thai_sarai: {
        code: 0x0dd4,
        description: "(\u0E34) THAI CHARACTER SARA I",
    },
    XK_Thai_saraii: {
        code: 0x0dd5,
        description: "(\u0E35) THAI CHARACTER SARA II",
    },
    XK_Thai_saraue: {
        code: 0x0dd6,
        description: "(\u0E36) THAI CHARACTER SARA UE",
    },
    XK_Thai_sarauee: {
        code: 0x0dd7,
        description: "(\u0E37) THAI CHARACTER SARA UEE",
    },
    XK_Thai_sarau: {
        code: 0x0dd8,
        description: "(\u0E38) THAI CHARACTER SARA U",
    },
    XK_Thai_sarauu: {
        code: 0x0dd9,
        description: "(\u0E39) THAI CHARACTER SARA UU",
    },
    XK_Thai_phinthu: {
        code: 0x0dda,
        description: "(\u0E3A) THAI CHARACTER PHINTHU",
    },
    XK_Thai_maihanakat_maitho: { code: 0x0dde, description: null },
    XK_Thai_baht: {
        code: 0x0ddf,
        description: "(\u0E3F) THAI CURRENCY SYMBOL BAHT",
    },
    XK_Thai_sarae: {
        code: 0x0de0,
        description: "(\u0E40) THAI CHARACTER SARA E",
    },
    XK_Thai_saraae: {
        code: 0x0de1,
        description: "(\u0E41) THAI CHARACTER SARA AE",
    },
    XK_Thai_sarao: {
        code: 0x0de2,
        description: "(\u0E42) THAI CHARACTER SARA O",
    },
    XK_Thai_saraaimaimuan: {
        code: 0x0de3,
        description: "(\u0E43) THAI CHARACTER SARA AI MAIMUAN",
    },
    XK_Thai_saraaimaimalai: {
        code: 0x0de4,
        description: "(\u0E44) THAI CHARACTER SARA AI MAIMALAI",
    },
    XK_Thai_lakkhangyao: {
        code: 0x0de5,
        description: "(\u0E45) THAI CHARACTER LAKKHANGYAO",
    },
    XK_Thai_maiyamok: {
        code: 0x0de6,
        description: "(\u0E46) THAI CHARACTER MAIYAMOK",
    },
    XK_Thai_maitaikhu: {
        code: 0x0de7,
        description: "(\u0E47) THAI CHARACTER MAITAIKHU",
    },
    XK_Thai_maiek: {
        code: 0x0de8,
        description: "(\u0E48) THAI CHARACTER MAI EK",
    },
    XK_Thai_maitho: {
        code: 0x0de9,
        description: "(\u0E49) THAI CHARACTER MAI THO",
    },
    XK_Thai_maitri: {
        code: 0x0dea,
        description: "(\u0E4A) THAI CHARACTER MAI TRI",
    },
    XK_Thai_maichattawa: {
        code: 0x0deb,
        description: "(\u0E4B) THAI CHARACTER MAI CHATTAWA",
    },
    XK_Thai_thanthakhat: {
        code: 0x0dec,
        description: "(\u0E4C) THAI CHARACTER THANTHAKHAT",
    },
    XK_Thai_nikhahit: {
        code: 0x0ded,
        description: "(\u0E4D) THAI CHARACTER NIKHAHIT",
    },
    XK_Thai_leksun: { code: 0x0df0, description: "(\u0E50) THAI DIGIT ZERO" },
    XK_Thai_leknung: { code: 0x0df1, description: "(\u0E51) THAI DIGIT ONE" },
    XK_Thai_leksong: { code: 0x0df2, description: "(\u0E52) THAI DIGIT TWO" },
    XK_Thai_leksam: { code: 0x0df3, description: "(\u0E53) THAI DIGIT THREE" },
    XK_Thai_leksi: { code: 0x0df4, description: "(\u0E54) THAI DIGIT FOUR" },
    XK_Thai_lekha: { code: 0x0df5, description: "(\u0E55) THAI DIGIT FIVE" },
    XK_Thai_lekhok: { code: 0x0df6, description: "(\u0E56) THAI DIGIT SIX" },
    XK_Thai_lekchet: { code: 0x0df7, description: "(\u0E57) THAI DIGIT SEVEN" },
    XK_Thai_lekpaet: { code: 0x0df8, description: "(\u0E58) THAI DIGIT EIGHT" },
    XK_Thai_lekkao: { code: 0x0df9, description: "(\u0E59) THAI DIGIT NINE" },

    /*
   * Korean
   * Byte 3 = 0x0e
   */

    // Group XK_KOREAN

    XK_Hangul: { code: 0xff31, description: "Hangul start/stop(toggle)" },
    XK_Hangul_Start: { code: 0xff32, description: "Hangul start" },
    XK_Hangul_End: { code: 0xff33, description: "Hangul end, English start" },
    XK_Hangul_Hanja: {
        code: 0xff34,
        description: "Start Hangul->Hanja Conversion",
    },
    XK_Hangul_Jamo: { code: 0xff35, description: "Hangul Jamo mode" },
    XK_Hangul_Romaja: { code: 0xff36, description: "Hangul Romaja mode" },
    XK_Hangul_Codeinput: { code: 0xff37, description: "Hangul code input mode" },
    XK_Hangul_Jeonja: { code: 0xff38, description: "Jeonja mode" },
    XK_Hangul_Banja: { code: 0xff39, description: "Banja mode" },
    XK_Hangul_PreHanja: { code: 0xff3a, description: "Pre Hanja conversion" },
    XK_Hangul_PostHanja: { code: 0xff3b, description: "Post Hanja conversion" },
    XK_Hangul_SingleCandidate: { code: 0xff3c, description: "Single candidate" },
    XK_Hangul_MultipleCandidate: {
        code: 0xff3d,
        description: "Multiple candidate",
    },
    XK_Hangul_PreviousCandidate: {
        code: 0xff3e,
        description: "Previous candidate",
    },
    XK_Hangul_Special: { code: 0xff3f, description: "Special symbols" },
    XK_Hangul_switch: { code: 0xff7e, description: "Alias for mode_switch" },

    /* Hangul Consonant Characters */
    XK_Hangul_Kiyeog: { code: 0x0ea1, description: null },
    XK_Hangul_SsangKiyeog: { code: 0x0ea2, description: null },
    XK_Hangul_KiyeogSios: { code: 0x0ea3, description: null },
    XK_Hangul_Nieun: { code: 0x0ea4, description: null },
    XK_Hangul_NieunJieuj: { code: 0x0ea5, description: null },
    XK_Hangul_NieunHieuh: { code: 0x0ea6, description: null },
    XK_Hangul_Dikeud: { code: 0x0ea7, description: null },
    XK_Hangul_SsangDikeud: { code: 0x0ea8, description: null },
    XK_Hangul_Rieul: { code: 0x0ea9, description: null },
    XK_Hangul_RieulKiyeog: { code: 0x0eaa, description: null },
    XK_Hangul_RieulMieum: { code: 0x0eab, description: null },
    XK_Hangul_RieulPieub: { code: 0x0eac, description: null },
    XK_Hangul_RieulSios: { code: 0x0ead, description: null },
    XK_Hangul_RieulTieut: { code: 0x0eae, description: null },
    XK_Hangul_RieulPhieuf: { code: 0x0eaf, description: null },
    XK_Hangul_RieulHieuh: { code: 0x0eb0, description: null },
    XK_Hangul_Mieum: { code: 0x0eb1, description: null },
    XK_Hangul_Pieub: { code: 0x0eb2, description: null },
    XK_Hangul_SsangPieub: { code: 0x0eb3, description: null },
    XK_Hangul_PieubSios: { code: 0x0eb4, description: null },
    XK_Hangul_Sios: { code: 0x0eb5, description: null },
    XK_Hangul_SsangSios: { code: 0x0eb6, description: null },
    XK_Hangul_Ieung: { code: 0x0eb7, description: null },
    XK_Hangul_Jieuj: { code: 0x0eb8, description: null },
    XK_Hangul_SsangJieuj: { code: 0x0eb9, description: null },
    XK_Hangul_Cieuc: { code: 0x0eba, description: null },
    XK_Hangul_Khieuq: { code: 0x0ebb, description: null },
    XK_Hangul_Tieut: { code: 0x0ebc, description: null },
    XK_Hangul_Phieuf: { code: 0x0ebd, description: null },
    XK_Hangul_Hieuh: { code: 0x0ebe, description: null },

    /* Hangul Vowel Characters */
    XK_Hangul_A: { code: 0x0ebf, description: null },
    XK_Hangul_AE: { code: 0x0ec0, description: null },
    XK_Hangul_YA: { code: 0x0ec1, description: null },
    XK_Hangul_YAE: { code: 0x0ec2, description: null },
    XK_Hangul_EO: { code: 0x0ec3, description: null },
    XK_Hangul_E: { code: 0x0ec4, description: null },
    XK_Hangul_YEO: { code: 0x0ec5, description: null },
    XK_Hangul_YE: { code: 0x0ec6, description: null },
    XK_Hangul_O: { code: 0x0ec7, description: null },
    XK_Hangul_WA: { code: 0x0ec8, description: null },
    XK_Hangul_WAE: { code: 0x0ec9, description: null },
    XK_Hangul_OE: { code: 0x0eca, description: null },
    XK_Hangul_YO: { code: 0x0ecb, description: null },
    XK_Hangul_U: { code: 0x0ecc, description: null },
    XK_Hangul_WEO: { code: 0x0ecd, description: null },
    XK_Hangul_WE: { code: 0x0ece, description: null },
    XK_Hangul_WI: { code: 0x0ecf, description: null },
    XK_Hangul_YU: { code: 0x0ed0, description: null },
    XK_Hangul_EU: { code: 0x0ed1, description: null },
    XK_Hangul_YI: { code: 0x0ed2, description: null },
    XK_Hangul_I: { code: 0x0ed3, description: null },

    /* Hangul syllable-final (JongSeong) Characters */
    XK_Hangul_J_Kiyeog: { code: 0x0ed4, description: null },
    XK_Hangul_J_SsangKiyeog: { code: 0x0ed5, description: null },
    XK_Hangul_J_KiyeogSios: { code: 0x0ed6, description: null },
    XK_Hangul_J_Nieun: { code: 0x0ed7, description: null },
    XK_Hangul_J_NieunJieuj: { code: 0x0ed8, description: null },
    XK_Hangul_J_NieunHieuh: { code: 0x0ed9, description: null },
    XK_Hangul_J_Dikeud: { code: 0x0eda, description: null },
    XK_Hangul_J_Rieul: { code: 0x0edb, description: null },
    XK_Hangul_J_RieulKiyeog: { code: 0x0edc, description: null },
    XK_Hangul_J_RieulMieum: { code: 0x0edd, description: null },
    XK_Hangul_J_RieulPieub: { code: 0x0ede, description: null },
    XK_Hangul_J_RieulSios: { code: 0x0edf, description: null },
    XK_Hangul_J_RieulTieut: { code: 0x0ee0, description: null },
    XK_Hangul_J_RieulPhieuf: { code: 0x0ee1, description: null },
    XK_Hangul_J_RieulHieuh: { code: 0x0ee2, description: null },
    XK_Hangul_J_Mieum: { code: 0x0ee3, description: null },
    XK_Hangul_J_Pieub: { code: 0x0ee4, description: null },
    XK_Hangul_J_PieubSios: { code: 0x0ee5, description: null },
    XK_Hangul_J_Sios: { code: 0x0ee6, description: null },
    XK_Hangul_J_SsangSios: { code: 0x0ee7, description: null },
    XK_Hangul_J_Ieung: { code: 0x0ee8, description: null },
    XK_Hangul_J_Jieuj: { code: 0x0ee9, description: null },
    XK_Hangul_J_Cieuc: { code: 0x0eea, description: null },
    XK_Hangul_J_Khieuq: { code: 0x0eeb, description: null },
    XK_Hangul_J_Tieut: { code: 0x0eec, description: null },
    XK_Hangul_J_Phieuf: { code: 0x0eed, description: null },
    XK_Hangul_J_Hieuh: { code: 0x0eee, description: null },

    /* Ancient Hangul Consonant Characters */
    XK_Hangul_RieulYeorinHieuh: { code: 0x0eef, description: null },
    XK_Hangul_SunkyeongeumMieum: { code: 0x0ef0, description: null },
    XK_Hangul_SunkyeongeumPieub: { code: 0x0ef1, description: null },
    XK_Hangul_PanSios: { code: 0x0ef2, description: null },
    XK_Hangul_KkogjiDalrinIeung: { code: 0x0ef3, description: null },
    XK_Hangul_SunkyeongeumPhieuf: { code: 0x0ef4, description: null },
    XK_Hangul_YeorinHieuh: { code: 0x0ef5, description: null },

    /* Ancient Hangul Vowel Characters */
    XK_Hangul_AraeA: { code: 0x0ef6, description: null },
    XK_Hangul_AraeAE: { code: 0x0ef7, description: null },

    /* Ancient Hangul syllable-final (JongSeong) Characters */
    XK_Hangul_J_PanSios: { code: 0x0ef8, description: null },
    XK_Hangul_J_KkogjiDalrinIeung: { code: 0x0ef9, description: null },
    XK_Hangul_J_YeorinHieuh: { code: 0x0efa, description: null },

    /* Korean currency symbol */
    XK_Korean_Won: { code: 0x0eff, description: "((\u20A9) WON SIGN)" },

    /*
   * Armenian
   */

    // Group XK_ARMENIAN
    XK_Armenian_ligature_ew: {
        code: 0x1000587,
        description: "(\u0587) ARMENIAN SMALL LIGATURE ECH YIWN",
    },
    XK_Armenian_full_stop: {
        code: 0x1000589,
        description: "(\u0589) ARMENIAN FULL STOP",
    },
    XK_Armenian_verjaket: {
        code: 0x1000589,
        description: "(\u0589) ARMENIAN FULL STOP",
    },
    XK_Armenian_separation_mark: {
        code: 0x100055d,
        description: "(\u055D) ARMENIAN COMMA",
    },
    XK_Armenian_but: { code: 0x100055d, description: "(\u055D) ARMENIAN COMMA" },
    XK_Armenian_hyphen: {
        code: 0x100058a,
        description: "(\u058A) ARMENIAN HYPHEN",
    },
    XK_Armenian_yentamna: {
        code: 0x100058a,
        description: "(\u058A) ARMENIAN HYPHEN",
    },
    XK_Armenian_exclam: {
        code: 0x100055c,
        description: "(\u055C) ARMENIAN EXCLAMATION MARK",
    },
    XK_Armenian_amanak: {
        code: 0x100055c,
        description: "(\u055C) ARMENIAN EXCLAMATION MARK",
    },
    XK_Armenian_accent: {
        code: 0x100055b,
        description: "(\u055B) ARMENIAN EMPHASIS MARK",
    },
    XK_Armenian_shesht: {
        code: 0x100055b,
        description: "(\u055B) ARMENIAN EMPHASIS MARK",
    },
    XK_Armenian_question: {
        code: 0x100055e,
        description: "(\u055E) ARMENIAN QUESTION MARK",
    },
    XK_Armenian_paruyk: {
        code: 0x100055e,
        description: "(\u055E) ARMENIAN QUESTION MARK",
    },
    XK_Armenian_AYB: {
        code: 0x1000531,
        description: "(\u0531) ARMENIAN CAPITAL LETTER AYB",
    },
    XK_Armenian_ayb: {
        code: 0x1000561,
        description: "(\u0561) ARMENIAN SMALL LETTER AYB",
    },
    XK_Armenian_BEN: {
        code: 0x1000532,
        description: "(\u0532) ARMENIAN CAPITAL LETTER BEN",
    },
    XK_Armenian_ben: {
        code: 0x1000562,
        description: "(\u0562) ARMENIAN SMALL LETTER BEN",
    },
    XK_Armenian_GIM: {
        code: 0x1000533,
        description: "(\u0533) ARMENIAN CAPITAL LETTER GIM",
    },
    XK_Armenian_gim: {
        code: 0x1000563,
        description: "(\u0563) ARMENIAN SMALL LETTER GIM",
    },
    XK_Armenian_DA: {
        code: 0x1000534,
        description: "(\u0534) ARMENIAN CAPITAL LETTER DA",
    },
    XK_Armenian_da: {
        code: 0x1000564,
        description: "(\u0564) ARMENIAN SMALL LETTER DA",
    },
    XK_Armenian_YECH: {
        code: 0x1000535,
        description: "(\u0535) ARMENIAN CAPITAL LETTER ECH",
    },
    XK_Armenian_yech: {
        code: 0x1000565,
        description: "(\u0565) ARMENIAN SMALL LETTER ECH",
    },
    XK_Armenian_ZA: {
        code: 0x1000536,
        description: "(\u0536) ARMENIAN CAPITAL LETTER ZA",
    },
    XK_Armenian_za: {
        code: 0x1000566,
        description: "(\u0566) ARMENIAN SMALL LETTER ZA",
    },
    XK_Armenian_E: {
        code: 0x1000537,
        description: "(\u0537) ARMENIAN CAPITAL LETTER EH",
    },
    XK_Armenian_e: {
        code: 0x1000567,
        description: "(\u0567) ARMENIAN SMALL LETTER EH",
    },
    XK_Armenian_AT: {
        code: 0x1000538,
        description: "(\u0538) ARMENIAN CAPITAL LETTER ET",
    },
    XK_Armenian_at: {
        code: 0x1000568,
        description: "(\u0568) ARMENIAN SMALL LETTER ET",
    },
    XK_Armenian_TO: {
        code: 0x1000539,
        description: "(\u0539) ARMENIAN CAPITAL LETTER TO",
    },
    XK_Armenian_to: {
        code: 0x1000569,
        description: "(\u0569) ARMENIAN SMALL LETTER TO",
    },
    XK_Armenian_ZHE: {
        code: 0x100053a,
        description: "(\u053A) ARMENIAN CAPITAL LETTER ZHE",
    },
    XK_Armenian_zhe: {
        code: 0x100056a,
        description: "(\u056A) ARMENIAN SMALL LETTER ZHE",
    },
    XK_Armenian_INI: {
        code: 0x100053b,
        description: "(\u053B) ARMENIAN CAPITAL LETTER INI",
    },
    XK_Armenian_ini: {
        code: 0x100056b,
        description: "(\u056B) ARMENIAN SMALL LETTER INI",
    },
    XK_Armenian_LYUN: {
        code: 0x100053c,
        description: "(\u053C) ARMENIAN CAPITAL LETTER LIWN",
    },
    XK_Armenian_lyun: {
        code: 0x100056c,
        description: "(\u056C) ARMENIAN SMALL LETTER LIWN",
    },
    XK_Armenian_KHE: {
        code: 0x100053d,
        description: "(\u053D) ARMENIAN CAPITAL LETTER XEH",
    },
    XK_Armenian_khe: {
        code: 0x100056d,
        description: "(\u056D) ARMENIAN SMALL LETTER XEH",
    },
    XK_Armenian_TSA: {
        code: 0x100053e,
        description: "(\u053E) ARMENIAN CAPITAL LETTER CA",
    },
    XK_Armenian_tsa: {
        code: 0x100056e,
        description: "(\u056E) ARMENIAN SMALL LETTER CA",
    },
    XK_Armenian_KEN: {
        code: 0x100053f,
        description: "(\u053F) ARMENIAN CAPITAL LETTER KEN",
    },
    XK_Armenian_ken: {
        code: 0x100056f,
        description: "(\u056F) ARMENIAN SMALL LETTER KEN",
    },
    XK_Armenian_HO: {
        code: 0x1000540,
        description: "(\u0540) ARMENIAN CAPITAL LETTER HO",
    },
    XK_Armenian_ho: {
        code: 0x1000570,
        description: "(\u0570) ARMENIAN SMALL LETTER HO",
    },
    XK_Armenian_DZA: {
        code: 0x1000541,
        description: "(\u0541) ARMENIAN CAPITAL LETTER JA",
    },
    XK_Armenian_dza: {
        code: 0x1000571,
        description: "(\u0571) ARMENIAN SMALL LETTER JA",
    },
    XK_Armenian_GHAT: {
        code: 0x1000542,
        description: "(\u0542) ARMENIAN CAPITAL LETTER GHAD",
    },
    XK_Armenian_ghat: {
        code: 0x1000572,
        description: "(\u0572) ARMENIAN SMALL LETTER GHAD",
    },
    XK_Armenian_TCHE: {
        code: 0x1000543,
        description: "(\u0543) ARMENIAN CAPITAL LETTER CHEH",
    },
    XK_Armenian_tche: {
        code: 0x1000573,
        description: "(\u0573) ARMENIAN SMALL LETTER CHEH",
    },
    XK_Armenian_MEN: {
        code: 0x1000544,
        description: "(\u0544) ARMENIAN CAPITAL LETTER MEN",
    },
    XK_Armenian_men: {
        code: 0x1000574,
        description: "(\u0574) ARMENIAN SMALL LETTER MEN",
    },
    XK_Armenian_HI: {
        code: 0x1000545,
        description: "(\u0545) ARMENIAN CAPITAL LETTER YI",
    },
    XK_Armenian_hi: {
        code: 0x1000575,
        description: "(\u0575) ARMENIAN SMALL LETTER YI",
    },
    XK_Armenian_NU: {
        code: 0x1000546,
        description: "(\u0546) ARMENIAN CAPITAL LETTER NOW",
    },
    XK_Armenian_nu: {
        code: 0x1000576,
        description: "(\u0576) ARMENIAN SMALL LETTER NOW",
    },
    XK_Armenian_SHA: {
        code: 0x1000547,
        description: "(\u0547) ARMENIAN CAPITAL LETTER SHA",
    },
    XK_Armenian_sha: {
        code: 0x1000577,
        description: "(\u0577) ARMENIAN SMALL LETTER SHA",
    },
    XK_Armenian_VO: {
        code: 0x1000548,
        description: "(\u0548) ARMENIAN CAPITAL LETTER VO",
    },
    XK_Armenian_vo: {
        code: 0x1000578,
        description: "(\u0578) ARMENIAN SMALL LETTER VO",
    },
    XK_Armenian_CHA: {
        code: 0x1000549,
        description: "(\u0549) ARMENIAN CAPITAL LETTER CHA",
    },
    XK_Armenian_cha: {
        code: 0x1000579,
        description: "(\u0579) ARMENIAN SMALL LETTER CHA",
    },
    XK_Armenian_PE: {
        code: 0x100054a,
        description: "(\u054A) ARMENIAN CAPITAL LETTER PEH",
    },
    XK_Armenian_pe: {
        code: 0x100057a,
        description: "(\u057A) ARMENIAN SMALL LETTER PEH",
    },
    XK_Armenian_JE: {
        code: 0x100054b,
        description: "(\u054B) ARMENIAN CAPITAL LETTER JHEH",
    },
    XK_Armenian_je: {
        code: 0x100057b,
        description: "(\u057B) ARMENIAN SMALL LETTER JHEH",
    },
    XK_Armenian_RA: {
        code: 0x100054c,
        description: "(\u054C) ARMENIAN CAPITAL LETTER RA",
    },
    XK_Armenian_ra: {
        code: 0x100057c,
        description: "(\u057C) ARMENIAN SMALL LETTER RA",
    },
    XK_Armenian_SE: {
        code: 0x100054d,
        description: "(\u054D) ARMENIAN CAPITAL LETTER SEH",
    },
    XK_Armenian_se: {
        code: 0x100057d,
        description: "(\u057D) ARMENIAN SMALL LETTER SEH",
    },
    XK_Armenian_VEV: {
        code: 0x100054e,
        description: "(\u054E) ARMENIAN CAPITAL LETTER VEW",
    },
    XK_Armenian_vev: {
        code: 0x100057e,
        description: "(\u057E) ARMENIAN SMALL LETTER VEW",
    },
    XK_Armenian_TYUN: {
        code: 0x100054f,
        description: "(\u054F) ARMENIAN CAPITAL LETTER TIWN",
    },
    XK_Armenian_tyun: {
        code: 0x100057f,
        description: "(\u057F) ARMENIAN SMALL LETTER TIWN",
    },
    XK_Armenian_RE: {
        code: 0x1000550,
        description: "(\u0550) ARMENIAN CAPITAL LETTER REH",
    },
    XK_Armenian_re: {
        code: 0x1000580,
        description: "(\u0580) ARMENIAN SMALL LETTER REH",
    },
    XK_Armenian_TSO: {
        code: 0x1000551,
        description: "(\u0551) ARMENIAN CAPITAL LETTER CO",
    },
    XK_Armenian_tso: {
        code: 0x1000581,
        description: "(\u0581) ARMENIAN SMALL LETTER CO",
    },
    XK_Armenian_VYUN: {
        code: 0x1000552,
        description: "(\u0552) ARMENIAN CAPITAL LETTER YIWN",
    },
    XK_Armenian_vyun: {
        code: 0x1000582,
        description: "(\u0582) ARMENIAN SMALL LETTER YIWN",
    },
    XK_Armenian_PYUR: {
        code: 0x1000553,
        description: "(\u0553) ARMENIAN CAPITAL LETTER PIWR",
    },
    XK_Armenian_pyur: {
        code: 0x1000583,
        description: "(\u0583) ARMENIAN SMALL LETTER PIWR",
    },
    XK_Armenian_KE: {
        code: 0x1000554,
        description: "(\u0554) ARMENIAN CAPITAL LETTER KEH",
    },
    XK_Armenian_ke: {
        code: 0x1000584,
        description: "(\u0584) ARMENIAN SMALL LETTER KEH",
    },
    XK_Armenian_O: {
        code: 0x1000555,
        description: "(\u0555) ARMENIAN CAPITAL LETTER OH",
    },
    XK_Armenian_o: {
        code: 0x1000585,
        description: "(\u0585) ARMENIAN SMALL LETTER OH",
    },
    XK_Armenian_FE: {
        code: 0x1000556,
        description: "(\u0556) ARMENIAN CAPITAL LETTER FEH",
    },
    XK_Armenian_fe: {
        code: 0x1000586,
        description: "(\u0586) ARMENIAN SMALL LETTER FEH",
    },
    XK_Armenian_apostrophe: {
        code: 0x100055a,
        description: "(\u055A) ARMENIAN APOSTROPHE",
    },

    /*
   * Georgian
   */

    // Group XK_GEORGIAN
    XK_Georgian_an: {
        code: 0x10010d0,
        description: "(\u10D0) GEORGIAN LETTER AN",
    },
    XK_Georgian_ban: {
        code: 0x10010d1,
        description: "(\u10D1) GEORGIAN LETTER BAN",
    },
    XK_Georgian_gan: {
        code: 0x10010d2,
        description: "(\u10D2) GEORGIAN LETTER GAN",
    },
    XK_Georgian_don: {
        code: 0x10010d3,
        description: "(\u10D3) GEORGIAN LETTER DON",
    },
    XK_Georgian_en: {
        code: 0x10010d4,
        description: "(\u10D4) GEORGIAN LETTER EN",
    },
    XK_Georgian_vin: {
        code: 0x10010d5,
        description: "(\u10D5) GEORGIAN LETTER VIN",
    },
    XK_Georgian_zen: {
        code: 0x10010d6,
        description: "(\u10D6) GEORGIAN LETTER ZEN",
    },
    XK_Georgian_tan: {
        code: 0x10010d7,
        description: "(\u10D7) GEORGIAN LETTER TAN",
    },
    XK_Georgian_in: {
        code: 0x10010d8,
        description: "(\u10D8) GEORGIAN LETTER IN",
    },
    XK_Georgian_kan: {
        code: 0x10010d9,
        description: "(\u10D9) GEORGIAN LETTER KAN",
    },
    XK_Georgian_las: {
        code: 0x10010da,
        description: "(\u10DA) GEORGIAN LETTER LAS",
    },
    XK_Georgian_man: {
        code: 0x10010db,
        description: "(\u10DB) GEORGIAN LETTER MAN",
    },
    XK_Georgian_nar: {
        code: 0x10010dc,
        description: "(\u10DC) GEORGIAN LETTER NAR",
    },
    XK_Georgian_on: {
        code: 0x10010dd,
        description: "(\u10DD) GEORGIAN LETTER ON",
    },
    XK_Georgian_par: {
        code: 0x10010de,
        description: "(\u10DE) GEORGIAN LETTER PAR",
    },
    XK_Georgian_zhar: {
        code: 0x10010df,
        description: "(\u10DF) GEORGIAN LETTER ZHAR",
    },
    XK_Georgian_rae: {
        code: 0x10010e0,
        description: "(\u10E0) GEORGIAN LETTER RAE",
    },
    XK_Georgian_san: {
        code: 0x10010e1,
        description: "(\u10E1) GEORGIAN LETTER SAN",
    },
    XK_Georgian_tar: {
        code: 0x10010e2,
        description: "(\u10E2) GEORGIAN LETTER TAR",
    },
    XK_Georgian_un: {
        code: 0x10010e3,
        description: "(\u10E3) GEORGIAN LETTER UN",
    },
    XK_Georgian_phar: {
        code: 0x10010e4,
        description: "(\u10E4) GEORGIAN LETTER PHAR",
    },
    XK_Georgian_khar: {
        code: 0x10010e5,
        description: "(\u10E5) GEORGIAN LETTER KHAR",
    },
    XK_Georgian_ghan: {
        code: 0x10010e6,
        description: "(\u10E6) GEORGIAN LETTER GHAN",
    },
    XK_Georgian_qar: {
        code: 0x10010e7,
        description: "(\u10E7) GEORGIAN LETTER QAR",
    },
    XK_Georgian_shin: {
        code: 0x10010e8,
        description: "(\u10E8) GEORGIAN LETTER SHIN",
    },
    XK_Georgian_chin: {
        code: 0x10010e9,
        description: "(\u10E9) GEORGIAN LETTER CHIN",
    },
    XK_Georgian_can: {
        code: 0x10010ea,
        description: "(\u10EA) GEORGIAN LETTER CAN",
    },
    XK_Georgian_jil: {
        code: 0x10010eb,
        description: "(\u10EB) GEORGIAN LETTER JIL",
    },
    XK_Georgian_cil: {
        code: 0x10010ec,
        description: "(\u10EC) GEORGIAN LETTER CIL",
    },
    XK_Georgian_char: {
        code: 0x10010ed,
        description: "(\u10ED) GEORGIAN LETTER CHAR",
    },
    XK_Georgian_xan: {
        code: 0x10010ee,
        description: "(\u10EE) GEORGIAN LETTER XAN",
    },
    XK_Georgian_jhan: {
        code: 0x10010ef,
        description: "(\u10EF) GEORGIAN LETTER JHAN",
    },
    XK_Georgian_hae: {
        code: 0x10010f0,
        description: "(\u10F0) GEORGIAN LETTER HAE",
    },
    XK_Georgian_he: {
        code: 0x10010f1,
        description: "(\u10F1) GEORGIAN LETTER HE",
    },
    XK_Georgian_hie: {
        code: 0x10010f2,
        description: "(\u10F2) GEORGIAN LETTER HIE",
    },
    XK_Georgian_we: {
        code: 0x10010f3,
        description: "(\u10F3) GEORGIAN LETTER WE",
    },
    XK_Georgian_har: {
        code: 0x10010f4,
        description: "(\u10F4) GEORGIAN LETTER HAR",
    },
    XK_Georgian_hoe: {
        code: 0x10010f5,
        description: "(\u10F5) GEORGIAN LETTER HOE",
    },
    XK_Georgian_fi: {
        code: 0x10010f6,
        description: "(\u10F6) GEORGIAN LETTER FI",
    },

    /*
   * Azeri (and other Turkic or Caucasian languages)
   */

    // Group XK_CAUCASUS
    /* latin */
    XK_Xabovedot: {
        code: 0x1001e8a,
        description: "(\u1E8A) LATIN CAPITAL LETTER X WITH DOT ABOVE",
    },
    XK_Ibreve: {
        code: 0x100012c,
        description: "(\u012C) LATIN CAPITAL LETTER I WITH BREVE",
    },
    XK_Zstroke: {
        code: 0x10001b5,
        description: "(\u01B5) LATIN CAPITAL LETTER Z WITH STROKE",
    },
    XK_Gcaron: {
        code: 0x10001e6,
        description: "(\u01E6) LATIN CAPITAL LETTER G WITH CARON",
    },
    XK_Ocaron: {
        code: 0x10001d1,
        description: "(\u01D2) LATIN CAPITAL LETTER O WITH CARON",
    },
    XK_Obarred: {
        code: 0x100019f,
        description: "(\u019F) LATIN CAPITAL LETTER O WITH MIDDLE TILDE",
    },
    XK_xabovedot: {
        code: 0x1001e8b,
        description: "(\u1E8B) LATIN SMALL LETTER X WITH DOT ABOVE",
    },
    XK_ibreve: {
        code: 0x100012d,
        description: "(\u012D) LATIN SMALL LETTER I WITH BREVE",
    },
    XK_zstroke: {
        code: 0x10001b6,
        description: "(\u01B6) LATIN SMALL LETTER Z WITH STROKE",
    },
    XK_gcaron: {
        code: 0x10001e7,
        description: "(\u01E7) LATIN SMALL LETTER G WITH CARON",
    },
    XK_ocaron: {
        code: 0x10001d2,
        description: "(\u01D2) LATIN SMALL LETTER O WITH CARON",
    },
    XK_obarred: {
        code: 0x1000275,
        description: "(\u0275) LATIN SMALL LETTER BARRED O",
    },
    XK_SCHWA: {
        code: 0x100018f,
        description: "(\u018F) LATIN CAPITAL LETTER SCHWA",
    },
    XK_schwa: {
        code: 0x1000259,
        description: "(\u0259) LATIN SMALL LETTER SCHWA",
    },
    XK_EZH: { code: 0x10001b7, description: "(\u01B7) LATIN CAPITAL LETTER EZH" },
    XK_ezh: { code: 0x1000292, description: "(\u0292) LATIN SMALL LETTER EZH" },
    /* those are not really Caucasus */
    /* For Inupiak */
    XK_Lbelowdot: {
        code: 0x1001e36,
        description: "(\u1E36) LATIN CAPITAL LETTER L WITH DOT BELOW",
    },
    XK_lbelowdot: {
        code: 0x1001e37,
        description: "(\u1E37) LATIN SMALL LETTER L WITH DOT BELOW",
    },

    /*
   * Vietnamese
   */

    // Group XK_VIETNAMESE
    XK_Abelowdot: {
        code: 0x1001ea0,
        description: "(\u1EA0) LATIN CAPITAL LETTER A WITH DOT BELOW",
    },
    XK_abelowdot: {
        code: 0x1001ea1,
        description: "(\u1EA1) LATIN SMALL LETTER A WITH DOT BELOW",
    },
    XK_Ahook: {
        code: 0x1001ea2,
        description: "(\u1EA2) LATIN CAPITAL LETTER A WITH HOOK ABOVE",
    },
    XK_ahook: {
        code: 0x1001ea3,
        description: "(\u1EA3) LATIN SMALL LETTER A WITH HOOK ABOVE",
    },
    XK_Acircumflexacute: {
        code: 0x1001ea4,
        description: "(\u1EA4) LATIN CAPITAL LETTER A WITH CIRCUMFLEX AND ACUTE",
    },
    XK_acircumflexacute: {
        code: 0x1001ea5,
        description: "(\u1EA5) LATIN SMALL LETTER A WITH CIRCUMFLEX AND ACUTE",
    },
    XK_Acircumflexgrave: {
        code: 0x1001ea6,
        description: "(\u1EA6) LATIN CAPITAL LETTER A WITH CIRCUMFLEX AND GRAVE",
    },
    XK_acircumflexgrave: {
        code: 0x1001ea7,
        description: "(\u1EA7) LATIN SMALL LETTER A WITH CIRCUMFLEX AND GRAVE",
    },
    XK_Acircumflexhook: {
        code: 0x1001ea8,
        description:
            "(\u1EA8) LATIN CAPITAL LETTER A WITH CIRCUMFLEX AND HOOK ABOVE",
    },
    XK_acircumflexhook: {
        code: 0x1001ea9,
        description: "(\u1EA9) LATIN SMALL LETTER A WITH CIRCUMFLEX AND HOOK ABOVE",
    },
    XK_Acircumflextilde: {
        code: 0x1001eaa,
        description: "(\u1EAA) LATIN CAPITAL LETTER A WITH CIRCUMFLEX AND TILDE",
    },
    XK_acircumflextilde: {
        code: 0x1001eab,
        description: "(\u1EAB) LATIN SMALL LETTER A WITH CIRCUMFLEX AND TILDE",
    },
    XK_Acircumflexbelowdot: {
        code: 0x1001eac,
        description:
            "(\u1EAC) LATIN CAPITAL LETTER A WITH CIRCUMFLEX AND DOT BELOW",
    },
    XK_acircumflexbelowdot: {
        code: 0x1001ead,
        description: "(\u1EAD) LATIN SMALL LETTER A WITH CIRCUMFLEX AND DOT BELOW",
    },
    XK_Abreveacute: {
        code: 0x1001eae,
        description: "(\u1EAE) LATIN CAPITAL LETTER A WITH BREVE AND ACUTE",
    },
    XK_abreveacute: {
        code: 0x1001eaf,
        description: "(\u1EAF) LATIN SMALL LETTER A WITH BREVE AND ACUTE",
    },
    XK_Abrevegrave: {
        code: 0x1001eb0,
        description: "(\u1EB0) LATIN CAPITAL LETTER A WITH BREVE AND GRAVE",
    },
    XK_abrevegrave: {
        code: 0x1001eb1,
        description: "(\u1EB1) LATIN SMALL LETTER A WITH BREVE AND GRAVE",
    },
    XK_Abrevehook: {
        code: 0x1001eb2,
        description: "(\u1EB2) LATIN CAPITAL LETTER A WITH BREVE AND HOOK ABOVE",
    },
    XK_abrevehook: {
        code: 0x1001eb3,
        description: "(\u1EB3) LATIN SMALL LETTER A WITH BREVE AND HOOK ABOVE",
    },
    XK_Abrevetilde: {
        code: 0x1001eb4,
        description: "(\u1EB4) LATIN CAPITAL LETTER A WITH BREVE AND TILDE",
    },
    XK_abrevetilde: {
        code: 0x1001eb5,
        description: "(\u1EB5) LATIN SMALL LETTER A WITH BREVE AND TILDE",
    },
    XK_Abrevebelowdot: {
        code: 0x1001eb6,
        description: "(\u1EB6) LATIN CAPITAL LETTER A WITH BREVE AND DOT BELOW",
    },
    XK_abrevebelowdot: {
        code: 0x1001eb7,
        description: "(\u1EB7) LATIN SMALL LETTER A WITH BREVE AND DOT BELOW",
    },
    XK_Ebelowdot: {
        code: 0x1001eb8,
        description: "(\u1EB8) LATIN CAPITAL LETTER E WITH DOT BELOW",
    },
    XK_ebelowdot: {
        code: 0x1001eb9,
        description: "(\u1EB9) LATIN SMALL LETTER E WITH DOT BELOW",
    },
    XK_Ehook: {
        code: 0x1001eba,
        description: "(\u1EBA) LATIN CAPITAL LETTER E WITH HOOK ABOVE",
    },
    XK_ehook: {
        code: 0x1001ebb,
        description: "(\u1EBB) LATIN SMALL LETTER E WITH HOOK ABOVE",
    },
    XK_Etilde: {
        code: 0x1001ebc,
        description: "(\u1EBC) LATIN CAPITAL LETTER E WITH TILDE",
    },
    XK_etilde: {
        code: 0x1001ebd,
        description: "(\u1EBD) LATIN SMALL LETTER E WITH TILDE",
    },
    XK_Ecircumflexacute: {
        code: 0x1001ebe,
        description: "(\u1EBE) LATIN CAPITAL LETTER E WITH CIRCUMFLEX AND ACUTE",
    },
    XK_ecircumflexacute: {
        code: 0x1001ebf,
        description: "(\u1EBF) LATIN SMALL LETTER E WITH CIRCUMFLEX AND ACUTE",
    },
    XK_Ecircumflexgrave: {
        code: 0x1001ec0,
        description: "(\u1EC0) LATIN CAPITAL LETTER E WITH CIRCUMFLEX AND GRAVE",
    },
    XK_ecircumflexgrave: {
        code: 0x1001ec1,
        description: "(\u1EC1) LATIN SMALL LETTER E WITH CIRCUMFLEX AND GRAVE",
    },
    XK_Ecircumflexhook: {
        code: 0x1001ec2,
        description:
            "(\u1EC2) LATIN CAPITAL LETTER E WITH CIRCUMFLEX AND HOOK ABOVE",
    },
    XK_ecircumflexhook: {
        code: 0x1001ec3,
        description: "(\u1EC3) LATIN SMALL LETTER E WITH CIRCUMFLEX AND HOOK ABOVE",
    },
    XK_Ecircumflextilde: {
        code: 0x1001ec4,
        description: "(\u1EC4) LATIN CAPITAL LETTER E WITH CIRCUMFLEX AND TILDE",
    },
    XK_ecircumflextilde: {
        code: 0x1001ec5,
        description: "(\u1EC5) LATIN SMALL LETTER E WITH CIRCUMFLEX AND TILDE",
    },
    XK_Ecircumflexbelowdot: {
        code: 0x1001ec6,
        description:
            "(\u1EC6) LATIN CAPITAL LETTER E WITH CIRCUMFLEX AND DOT BELOW",
    },
    XK_ecircumflexbelowdot: {
        code: 0x1001ec7,
        description: "(\u1EC7) LATIN SMALL LETTER E WITH CIRCUMFLEX AND DOT BELOW",
    },
    XK_Ihook: {
        code: 0x1001ec8,
        description: "(\u1EC8) LATIN CAPITAL LETTER I WITH HOOK ABOVE",
    },
    XK_ihook: {
        code: 0x1001ec9,
        description: "(\u1EC9) LATIN SMALL LETTER I WITH HOOK ABOVE",
    },
    XK_Ibelowdot: {
        code: 0x1001eca,
        description: "(\u1ECA) LATIN CAPITAL LETTER I WITH DOT BELOW",
    },
    XK_ibelowdot: {
        code: 0x1001ecb,
        description: "(\u1ECB) LATIN SMALL LETTER I WITH DOT BELOW",
    },
    XK_Obelowdot: {
        code: 0x1001ecc,
        description: "(\u1ECC) LATIN CAPITAL LETTER O WITH DOT BELOW",
    },
    XK_obelowdot: {
        code: 0x1001ecd,
        description: "(\u1ECD) LATIN SMALL LETTER O WITH DOT BELOW",
    },
    XK_Ohook: {
        code: 0x1001ece,
        description: "(\u1ECE) LATIN CAPITAL LETTER O WITH HOOK ABOVE",
    },
    XK_ohook: {
        code: 0x1001ecf,
        description: "(\u1ECF) LATIN SMALL LETTER O WITH HOOK ABOVE",
    },
    XK_Ocircumflexacute: {
        code: 0x1001ed0,
        description: "(\u1ED0) LATIN CAPITAL LETTER O WITH CIRCUMFLEX AND ACUTE",
    },
    XK_ocircumflexacute: {
        code: 0x1001ed1,
        description: "(\u1ED1) LATIN SMALL LETTER O WITH CIRCUMFLEX AND ACUTE",
    },
    XK_Ocircumflexgrave: {
        code: 0x1001ed2,
        description: "(\u1ED2) LATIN CAPITAL LETTER O WITH CIRCUMFLEX AND GRAVE",
    },
    XK_ocircumflexgrave: {
        code: 0x1001ed3,
        description: "(\u1ED3) LATIN SMALL LETTER O WITH CIRCUMFLEX AND GRAVE",
    },
    XK_Ocircumflexhook: {
        code: 0x1001ed4,
        description:
            "(\u1ED4) LATIN CAPITAL LETTER O WITH CIRCUMFLEX AND HOOK ABOVE",
    },
    XK_ocircumflexhook: {
        code: 0x1001ed5,
        description: "(\u1ED5) LATIN SMALL LETTER O WITH CIRCUMFLEX AND HOOK ABOVE",
    },
    XK_Ocircumflextilde: {
        code: 0x1001ed6,
        description: "(\u1ED6) LATIN CAPITAL LETTER O WITH CIRCUMFLEX AND TILDE",
    },
    XK_ocircumflextilde: {
        code: 0x1001ed7,
        description: "(\u1ED7) LATIN SMALL LETTER O WITH CIRCUMFLEX AND TILDE",
    },
    XK_Ocircumflexbelowdot: {
        code: 0x1001ed8,
        description:
            "(\u1ED8) LATIN CAPITAL LETTER O WITH CIRCUMFLEX AND DOT BELOW",
    },
    XK_ocircumflexbelowdot: {
        code: 0x1001ed9,
        description: "(\u1ED9) LATIN SMALL LETTER O WITH CIRCUMFLEX AND DOT BELOW",
    },
    XK_Ohornacute: {
        code: 0x1001eda,
        description: "(\u1EDA) LATIN CAPITAL LETTER O WITH HORN AND ACUTE",
    },
    XK_ohornacute: {
        code: 0x1001edb,
        description: "(\u1EDB) LATIN SMALL LETTER O WITH HORN AND ACUTE",
    },
    XK_Ohorngrave: {
        code: 0x1001edc,
        description: "(\u1EDC) LATIN CAPITAL LETTER O WITH HORN AND GRAVE",
    },
    XK_ohorngrave: {
        code: 0x1001edd,
        description: "(\u1EDD) LATIN SMALL LETTER O WITH HORN AND GRAVE",
    },
    XK_Ohornhook: {
        code: 0x1001ede,
        description: "(\u1EDE) LATIN CAPITAL LETTER O WITH HORN AND HOOK ABOVE",
    },
    XK_ohornhook: {
        code: 0x1001edf,
        description: "(\u1EDF) LATIN SMALL LETTER O WITH HORN AND HOOK ABOVE",
    },
    XK_Ohorntilde: {
        code: 0x1001ee0,
        description: "(\u1EE0) LATIN CAPITAL LETTER O WITH HORN AND TILDE",
    },
    XK_ohorntilde: {
        code: 0x1001ee1,
        description: "(\u1EE1) LATIN SMALL LETTER O WITH HORN AND TILDE",
    },
    XK_Ohornbelowdot: {
        code: 0x1001ee2,
        description: "(\u1EE2) LATIN CAPITAL LETTER O WITH HORN AND DOT BELOW",
    },
    XK_ohornbelowdot: {
        code: 0x1001ee3,
        description: "(\u1EE3) LATIN SMALL LETTER O WITH HORN AND DOT BELOW",
    },
    XK_Ubelowdot: {
        code: 0x1001ee4,
        description: "(\u1EE4) LATIN CAPITAL LETTER U WITH DOT BELOW",
    },
    XK_ubelowdot: {
        code: 0x1001ee5,
        description: "(\u1EE5) LATIN SMALL LETTER U WITH DOT BELOW",
    },
    XK_Uhook: {
        code: 0x1001ee6,
        description: "(\u1EE6) LATIN CAPITAL LETTER U WITH HOOK ABOVE",
    },
    XK_uhook: {
        code: 0x1001ee7,
        description: "(\u1EE7) LATIN SMALL LETTER U WITH HOOK ABOVE",
    },
    XK_Uhornacute: {
        code: 0x1001ee8,
        description: "(\u1EE8) LATIN CAPITAL LETTER U WITH HORN AND ACUTE",
    },
    XK_uhornacute: {
        code: 0x1001ee9,
        description: "(\u1EE9) LATIN SMALL LETTER U WITH HORN AND ACUTE",
    },
    XK_Uhorngrave: {
        code: 0x1001eea,
        description: "(\u1EEA) LATIN CAPITAL LETTER U WITH HORN AND GRAVE",
    },
    XK_uhorngrave: {
        code: 0x1001eeb,
        description: "(\u1EEB) LATIN SMALL LETTER U WITH HORN AND GRAVE",
    },
    XK_Uhornhook: {
        code: 0x1001eec,
        description: "(\u1EEC) LATIN CAPITAL LETTER U WITH HORN AND HOOK ABOVE",
    },
    XK_uhornhook: {
        code: 0x1001eed,
        description: "(\u1EED) LATIN SMALL LETTER U WITH HORN AND HOOK ABOVE",
    },
    XK_Uhorntilde: {
        code: 0x1001eee,
        description: "(\u1EEE) LATIN CAPITAL LETTER U WITH HORN AND TILDE",
    },
    XK_uhorntilde: {
        code: 0x1001eef,
        description: "(\u1EEF) LATIN SMALL LETTER U WITH HORN AND TILDE",
    },
    XK_Uhornbelowdot: {
        code: 0x1001ef0,
        description: "(\u1EF0) LATIN CAPITAL LETTER U WITH HORN AND DOT BELOW",
    },
    XK_uhornbelowdot: {
        code: 0x1001ef1,
        description: "(\u1EF1) LATIN SMALL LETTER U WITH HORN AND DOT BELOW",
    },
    XK_Ybelowdot: {
        code: 0x1001ef4,
        description: "(\u1EF4) LATIN CAPITAL LETTER Y WITH DOT BELOW",
    },
    XK_ybelowdot: {
        code: 0x1001ef5,
        description: "(\u1EF5) LATIN SMALL LETTER Y WITH DOT BELOW",
    },
    XK_Yhook: {
        code: 0x1001ef6,
        description: "(\u1EF6) LATIN CAPITAL LETTER Y WITH HOOK ABOVE",
    },
    XK_yhook: {
        code: 0x1001ef7,
        description: "(\u1EF7) LATIN SMALL LETTER Y WITH HOOK ABOVE",
    },
    XK_Ytilde: {
        code: 0x1001ef8,
        description: "(\u1EF8) LATIN CAPITAL LETTER Y WITH TILDE",
    },
    XK_ytilde: {
        code: 0x1001ef9,
        description: "(\u1EF9) LATIN SMALL LETTER Y WITH TILDE",
    },
    XK_Ohorn: {
        code: 0x10001a0,
        description: "(\u01A0) LATIN CAPITAL LETTER O WITH HORN",
    },
    XK_ohorn: {
        code: 0x10001a1,
        description: "(\u01A1) LATIN SMALL LETTER O WITH HORN",
    },
    XK_Uhorn: {
        code: 0x10001af,
        description: "(\u01AF) LATIN CAPITAL LETTER U WITH HORN",
    },
    XK_uhorn: {
        code: 0x10001b0,
        description: "(\u01B0) LATIN SMALL LETTER U WITH HORN",
    },

    // Group XK_CURRENCY
    XK_EcuSign: { code: 0x10020a0, description: "(\u20A0) EURO-CURRENCY SIGN" },
    XK_ColonSign: { code: 0x10020a1, description: "(\u20A1) COLON SIGN" },
    XK_CruzeiroSign: { code: 0x10020a2, description: "(\u20A2) CRUZEIRO SIGN" },
    XK_FFrancSign: { code: 0x10020a3, description: "(\u20A3) FRENCH FRANC SIGN" },
    XK_LiraSign: { code: 0x10020a4, description: "(\u20A4) LIRA SIGN" },
    XK_MillSign: { code: 0x10020a5, description: "(\u20A5) MILL SIGN" },
    XK_NairaSign: { code: 0x10020a6, description: "(\u20A6) NAIRA SIGN" },
    XK_PesetaSign: { code: 0x10020a7, description: "(\u20A7) PESETA SIGN" },
    XK_RupeeSign: { code: 0x10020a8, description: "(\u20A8) RUPEE SIGN" },
    XK_WonSign: { code: 0x10020a9, description: "(\u20A9) WON SIGN" },
    XK_NewSheqelSign: {
        code: 0x10020aa,
        description: "(\u20AA) NEW SHEQEL SIGN",
    },
    XK_DongSign: { code: 0x10020ab, description: "(\u20AB) DONG SIGN" },
    XK_EuroSign: { code: 0x20ac, description: "(\u20AC) EURO SIGN" },

    // Group XK_MATHEMATICAL
    /* one, two and three are defined above. */
    XK_zerosuperior: {
        code: 0x1002070,
        description: "(\u2070) SUPERSCRIPT ZERO",
    },
    XK_foursuperior: {
        code: 0x1002074,
        description: "(\u2074) SUPERSCRIPT FOUR",
    },
    XK_fivesuperior: {
        code: 0x1002075,
        description: "(\u2075) SUPERSCRIPT FIVE",
    },
    XK_sixsuperior: { code: 0x1002076, description: "(\u2076) SUPERSCRIPT SIX" },
    XK_sevensuperior: {
        code: 0x1002077,
        description: "(\u2077) SUPERSCRIPT SEVEN",
    },
    XK_eightsuperior: {
        code: 0x1002078,
        description: "(\u2078) SUPERSCRIPT EIGHT",
    },
    XK_ninesuperior: {
        code: 0x1002079,
        description: "(\u2079) SUPERSCRIPT NINE",
    },
    XK_zerosubscript: { code: 0x1002080, description: "(\u2080) SUBSCRIPT ZERO" },
    XK_onesubscript: { code: 0x1002081, description: "(\u2081) SUBSCRIPT ONE" },
    XK_twosubscript: { code: 0x1002082, description: "(\u2082) SUBSCRIPT TWO" },
    XK_threesubscript: {
        code: 0x1002083,
        description: "(\u2083) SUBSCRIPT THREE",
    },
    XK_foursubscript: { code: 0x1002084, description: "(\u2084) SUBSCRIPT FOUR" },
    XK_fivesubscript: { code: 0x1002085, description: "(\u2085) SUBSCRIPT FIVE" },
    XK_sixsubscript: { code: 0x1002086, description: "(\u2086) SUBSCRIPT SIX" },
    XK_sevensubscript: {
        code: 0x1002087,
        description: "(\u2087) SUBSCRIPT SEVEN",
    },
    XK_eightsubscript: {
        code: 0x1002088,
        description: "(\u2088) SUBSCRIPT EIGHT",
    },
    XK_ninesubscript: { code: 0x1002089, description: "(\u2089) SUBSCRIPT NINE" },
    XK_partdifferential: {
        code: 0x1002202,
        description: "(\u2202) PARTIAL DIFFERENTIAL",
    },
    XK_emptyset: { code: 0x1002205, description: "(\u2205) NULL SET" },
    XK_elementof: { code: 0x1002208, description: "(\u2208) ELEMENT OF" },
    XK_notelementof: {
        code: 0x1002209,
        description: "(\u2209) NOT AN ELEMENT OF",
    },
    XK_containsas: {
        code: 0x100220b,
        description: "(\u220B) CONTAINS AS MEMBER",
    },
    XK_squareroot: { code: 0x100221a, description: "(\u221A) SQUARE ROOT" },
    XK_cuberoot: { code: 0x100221b, description: "(\u221B) CUBE ROOT" },
    XK_fourthroot: { code: 0x100221c, description: "(\u221C) FOURTH ROOT" },
    XK_dintegral: { code: 0x100222c, description: "(\u222C) DOUBLE INTEGRAL" },
    XK_tintegral: { code: 0x100222d, description: "(\u222D) TRIPLE INTEGRAL" },
    XK_because: { code: 0x1002235, description: "(\u2235) BECAUSE" },
    XK_approxeq: { code: 0x1002248, description: "(\u2245) ALMOST EQUAL TO" },
    XK_notapproxeq: {
        code: 0x1002247,
        description: "(\u2247) NOT ALMOST EQUAL TO",
    },
    XK_notidentical: {
        code: 0x1002262,
        description: "(\u2262) NOT IDENTICAL TO",
    },
    XK_stricteq: {
        code: 0x1002263,
        description: "(\u2263) STRICTLY EQUIVALENT TO",
    },

    // Group XK_BRAILLE
    XK_braille_dot_1: { code: 0xfff1, description: null },
    XK_braille_dot_2: { code: 0xfff2, description: null },
    XK_braille_dot_3: { code: 0xfff3, description: null },
    XK_braille_dot_4: { code: 0xfff4, description: null },
    XK_braille_dot_5: { code: 0xfff5, description: null },
    XK_braille_dot_6: { code: 0xfff6, description: null },
    XK_braille_dot_7: { code: 0xfff7, description: null },
    XK_braille_dot_8: { code: 0xfff8, description: null },
    XK_braille_dot_9: { code: 0xfff9, description: null },
    XK_braille_dot_10: { code: 0xfffa, description: null },
    XK_braille_blank: {
        code: 0x1002800,
        description: "(\u2800) BRAILLE PATTERN BLANK",
    },
    XK_braille_dots_1: {
        code: 0x1002801,
        description: "(\u2801) BRAILLE PATTERN DOTS-1",
    },
    XK_braille_dots_2: {
        code: 0x1002802,
        description: "(\u2802) BRAILLE PATTERN DOTS-2",
    },
    XK_braille_dots_12: {
        code: 0x1002803,
        description: "(\u2803) BRAILLE PATTERN DOTS-12",
    },
    XK_braille_dots_3: {
        code: 0x1002804,
        description: "(\u2804) BRAILLE PATTERN DOTS-3",
    },
    XK_braille_dots_13: {
        code: 0x1002805,
        description: "(\u2805) BRAILLE PATTERN DOTS-13",
    },
    XK_braille_dots_23: {
        code: 0x1002806,
        description: "(\u2806) BRAILLE PATTERN DOTS-23",
    },
    XK_braille_dots_123: {
        code: 0x1002807,
        description: "(\u2807) BRAILLE PATTERN DOTS-123",
    },
    XK_braille_dots_4: {
        code: 0x1002808,
        description: "(\u2808) BRAILLE PATTERN DOTS-4",
    },
    XK_braille_dots_14: {
        code: 0x1002809,
        description: "(\u2809) BRAILLE PATTERN DOTS-14",
    },
    XK_braille_dots_24: {
        code: 0x100280a,
        description: "(\u280a) BRAILLE PATTERN DOTS-24",
    },
    XK_braille_dots_124: {
        code: 0x100280b,
        description: "(\u280b) BRAILLE PATTERN DOTS-124",
    },
    XK_braille_dots_34: {
        code: 0x100280c,
        description: "(\u280c) BRAILLE PATTERN DOTS-34",
    },
    XK_braille_dots_134: {
        code: 0x100280d,
        description: "(\u280d) BRAILLE PATTERN DOTS-134",
    },
    XK_braille_dots_234: {
        code: 0x100280e,
        description: "(\u280e) BRAILLE PATTERN DOTS-234",
    },
    XK_braille_dots_1234: {
        code: 0x100280f,
        description: "(\u280f) BRAILLE PATTERN DOTS-1234",
    },
    XK_braille_dots_5: {
        code: 0x1002810,
        description: "(\u2810) BRAILLE PATTERN DOTS-5",
    },
    XK_braille_dots_15: {
        code: 0x1002811,
        description: "(\u2811) BRAILLE PATTERN DOTS-15",
    },
    XK_braille_dots_25: {
        code: 0x1002812,
        description: "(\u2812) BRAILLE PATTERN DOTS-25",
    },
    XK_braille_dots_125: {
        code: 0x1002813,
        description: "(\u2813) BRAILLE PATTERN DOTS-125",
    },
    XK_braille_dots_35: {
        code: 0x1002814,
        description: "(\u2814) BRAILLE PATTERN DOTS-35",
    },
    XK_braille_dots_135: {
        code: 0x1002815,
        description: "(\u2815) BRAILLE PATTERN DOTS-135",
    },
    XK_braille_dots_235: {
        code: 0x1002816,
        description: "(\u2816) BRAILLE PATTERN DOTS-235",
    },
    XK_braille_dots_1235: {
        code: 0x1002817,
        description: "(\u2817) BRAILLE PATTERN DOTS-1235",
    },
    XK_braille_dots_45: {
        code: 0x1002818,
        description: "(\u2818) BRAILLE PATTERN DOTS-45",
    },
    XK_braille_dots_145: {
        code: 0x1002819,
        description: "(\u2819) BRAILLE PATTERN DOTS-145",
    },
    XK_braille_dots_245: {
        code: 0x100281a,
        description: "(\u281a) BRAILLE PATTERN DOTS-245",
    },
    XK_braille_dots_1245: {
        code: 0x100281b,
        description: "(\u281b) BRAILLE PATTERN DOTS-1245",
    },
    XK_braille_dots_345: {
        code: 0x100281c,
        description: "(\u281c) BRAILLE PATTERN DOTS-345",
    },
    XK_braille_dots_1345: {
        code: 0x100281d,
        description: "(\u281d) BRAILLE PATTERN DOTS-1345",
    },
    XK_braille_dots_2345: {
        code: 0x100281e,
        description: "(\u281e) BRAILLE PATTERN DOTS-2345",
    },
    XK_braille_dots_12345: {
        code: 0x100281f,
        description: "(\u281f) BRAILLE PATTERN DOTS-12345",
    },
    XK_braille_dots_6: {
        code: 0x1002820,
        description: "(\u2820) BRAILLE PATTERN DOTS-6",
    },
    XK_braille_dots_16: {
        code: 0x1002821,
        description: "(\u2821) BRAILLE PATTERN DOTS-16",
    },
    XK_braille_dots_26: {
        code: 0x1002822,
        description: "(\u2822) BRAILLE PATTERN DOTS-26",
    },
    XK_braille_dots_126: {
        code: 0x1002823,
        description: "(\u2823) BRAILLE PATTERN DOTS-126",
    },
    XK_braille_dots_36: {
        code: 0x1002824,
        description: "(\u2824) BRAILLE PATTERN DOTS-36",
    },
    XK_braille_dots_136: {
        code: 0x1002825,
        description: "(\u2825) BRAILLE PATTERN DOTS-136",
    },
    XK_braille_dots_236: {
        code: 0x1002826,
        description: "(\u2826) BRAILLE PATTERN DOTS-236",
    },
    XK_braille_dots_1236: {
        code: 0x1002827,
        description: "(\u2827) BRAILLE PATTERN DOTS-1236",
    },
    XK_braille_dots_46: {
        code: 0x1002828,
        description: "(\u2828) BRAILLE PATTERN DOTS-46",
    },
    XK_braille_dots_146: {
        code: 0x1002829,
        description: "(\u2829) BRAILLE PATTERN DOTS-146",
    },
    XK_braille_dots_246: {
        code: 0x100282a,
        description: "(\u282a) BRAILLE PATTERN DOTS-246",
    },
    XK_braille_dots_1246: {
        code: 0x100282b,
        description: "(\u282b) BRAILLE PATTERN DOTS-1246",
    },
    XK_braille_dots_346: {
        code: 0x100282c,
        description: "(\u282c) BRAILLE PATTERN DOTS-346",
    },
    XK_braille_dots_1346: {
        code: 0x100282d,
        description: "(\u282d) BRAILLE PATTERN DOTS-1346",
    },
    XK_braille_dots_2346: {
        code: 0x100282e,
        description: "(\u282e) BRAILLE PATTERN DOTS-2346",
    },
    XK_braille_dots_12346: {
        code: 0x100282f,
        description: "(\u282f) BRAILLE PATTERN DOTS-12346",
    },
    XK_braille_dots_56: {
        code: 0x1002830,
        description: "(\u2830) BRAILLE PATTERN DOTS-56",
    },
    XK_braille_dots_156: {
        code: 0x1002831,
        description: "(\u2831) BRAILLE PATTERN DOTS-156",
    },
    XK_braille_dots_256: {
        code: 0x1002832,
        description: "(\u2832) BRAILLE PATTERN DOTS-256",
    },
    XK_braille_dots_1256: {
        code: 0x1002833,
        description: "(\u2833) BRAILLE PATTERN DOTS-1256",
    },
    XK_braille_dots_356: {
        code: 0x1002834,
        description: "(\u2834) BRAILLE PATTERN DOTS-356",
    },
    XK_braille_dots_1356: {
        code: 0x1002835,
        description: "(\u2835) BRAILLE PATTERN DOTS-1356",
    },
    XK_braille_dots_2356: {
        code: 0x1002836,
        description: "(\u2836) BRAILLE PATTERN DOTS-2356",
    },
    XK_braille_dots_12356: {
        code: 0x1002837,
        description: "(\u2837) BRAILLE PATTERN DOTS-12356",
    },
    XK_braille_dots_456: {
        code: 0x1002838,
        description: "(\u2838) BRAILLE PATTERN DOTS-456",
    },
    XK_braille_dots_1456: {
        code: 0x1002839,
        description: "(\u2839) BRAILLE PATTERN DOTS-1456",
    },
    XK_braille_dots_2456: {
        code: 0x100283a,
        description: "(\u283a) BRAILLE PATTERN DOTS-2456",
    },
    XK_braille_dots_12456: {
        code: 0x100283b,
        description: "(\u283b) BRAILLE PATTERN DOTS-12456",
    },
    XK_braille_dots_3456: {
        code: 0x100283c,
        description: "(\u283c) BRAILLE PATTERN DOTS-3456",
    },
    XK_braille_dots_13456: {
        code: 0x100283d,
        description: "(\u283d) BRAILLE PATTERN DOTS-13456",
    },
    XK_braille_dots_23456: {
        code: 0x100283e,
        description: "(\u283e) BRAILLE PATTERN DOTS-23456",
    },
    XK_braille_dots_123456: {
        code: 0x100283f,
        description: "(\u283f) BRAILLE PATTERN DOTS-123456",
    },
    XK_braille_dots_7: {
        code: 0x1002840,
        description: "(\u2840) BRAILLE PATTERN DOTS-7",
    },
    XK_braille_dots_17: {
        code: 0x1002841,
        description: "(\u2841) BRAILLE PATTERN DOTS-17",
    },
    XK_braille_dots_27: {
        code: 0x1002842,
        description: "(\u2842) BRAILLE PATTERN DOTS-27",
    },
    XK_braille_dots_127: {
        code: 0x1002843,
        description: "(\u2843) BRAILLE PATTERN DOTS-127",
    },
    XK_braille_dots_37: {
        code: 0x1002844,
        description: "(\u2844) BRAILLE PATTERN DOTS-37",
    },
    XK_braille_dots_137: {
        code: 0x1002845,
        description: "(\u2845) BRAILLE PATTERN DOTS-137",
    },
    XK_braille_dots_237: {
        code: 0x1002846,
        description: "(\u2846) BRAILLE PATTERN DOTS-237",
    },
    XK_braille_dots_1237: {
        code: 0x1002847,
        description: "(\u2847) BRAILLE PATTERN DOTS-1237",
    },
    XK_braille_dots_47: {
        code: 0x1002848,
        description: "(\u2848) BRAILLE PATTERN DOTS-47",
    },
    XK_braille_dots_147: {
        code: 0x1002849,
        description: "(\u2849) BRAILLE PATTERN DOTS-147",
    },
    XK_braille_dots_247: {
        code: 0x100284a,
        description: "(\u284a) BRAILLE PATTERN DOTS-247",
    },
    XK_braille_dots_1247: {
        code: 0x100284b,
        description: "(\u284b) BRAILLE PATTERN DOTS-1247",
    },
    XK_braille_dots_347: {
        code: 0x100284c,
        description: "(\u284c) BRAILLE PATTERN DOTS-347",
    },
    XK_braille_dots_1347: {
        code: 0x100284d,
        description: "(\u284d) BRAILLE PATTERN DOTS-1347",
    },
    XK_braille_dots_2347: {
        code: 0x100284e,
        description: "(\u284e) BRAILLE PATTERN DOTS-2347",
    },
    XK_braille_dots_12347: {
        code: 0x100284f,
        description: "(\u284f) BRAILLE PATTERN DOTS-12347",
    },
    XK_braille_dots_57: {
        code: 0x1002850,
        description: "(\u2850) BRAILLE PATTERN DOTS-57",
    },
    XK_braille_dots_157: {
        code: 0x1002851,
        description: "(\u2851) BRAILLE PATTERN DOTS-157",
    },
    XK_braille_dots_257: {
        code: 0x1002852,
        description: "(\u2852) BRAILLE PATTERN DOTS-257",
    },
    XK_braille_dots_1257: {
        code: 0x1002853,
        description: "(\u2853) BRAILLE PATTERN DOTS-1257",
    },
    XK_braille_dots_357: {
        code: 0x1002854,
        description: "(\u2854) BRAILLE PATTERN DOTS-357",
    },
    XK_braille_dots_1357: {
        code: 0x1002855,
        description: "(\u2855) BRAILLE PATTERN DOTS-1357",
    },
    XK_braille_dots_2357: {
        code: 0x1002856,
        description: "(\u2856) BRAILLE PATTERN DOTS-2357",
    },
    XK_braille_dots_12357: {
        code: 0x1002857,
        description: "(\u2857) BRAILLE PATTERN DOTS-12357",
    },
    XK_braille_dots_457: {
        code: 0x1002858,
        description: "(\u2858) BRAILLE PATTERN DOTS-457",
    },
    XK_braille_dots_1457: {
        code: 0x1002859,
        description: "(\u2859) BRAILLE PATTERN DOTS-1457",
    },
    XK_braille_dots_2457: {
        code: 0x100285a,
        description: "(\u285a) BRAILLE PATTERN DOTS-2457",
    },
    XK_braille_dots_12457: {
        code: 0x100285b,
        description: "(\u285b) BRAILLE PATTERN DOTS-12457",
    },
    XK_braille_dots_3457: {
        code: 0x100285c,
        description: "(\u285c) BRAILLE PATTERN DOTS-3457",
    },
    XK_braille_dots_13457: {
        code: 0x100285d,
        description: "(\u285d) BRAILLE PATTERN DOTS-13457",
    },
    XK_braille_dots_23457: {
        code: 0x100285e,
        description: "(\u285e) BRAILLE PATTERN DOTS-23457",
    },
    XK_braille_dots_123457: {
        code: 0x100285f,
        description: "(\u285f) BRAILLE PATTERN DOTS-123457",
    },
    XK_braille_dots_67: {
        code: 0x1002860,
        description: "(\u2860) BRAILLE PATTERN DOTS-67",
    },
    XK_braille_dots_167: {
        code: 0x1002861,
        description: "(\u2861) BRAILLE PATTERN DOTS-167",
    },
    XK_braille_dots_267: {
        code: 0x1002862,
        description: "(\u2862) BRAILLE PATTERN DOTS-267",
    },
    XK_braille_dots_1267: {
        code: 0x1002863,
        description: "(\u2863) BRAILLE PATTERN DOTS-1267",
    },
    XK_braille_dots_367: {
        code: 0x1002864,
        description: "(\u2864) BRAILLE PATTERN DOTS-367",
    },
    XK_braille_dots_1367: {
        code: 0x1002865,
        description: "(\u2865) BRAILLE PATTERN DOTS-1367",
    },
    XK_braille_dots_2367: {
        code: 0x1002866,
        description: "(\u2866) BRAILLE PATTERN DOTS-2367",
    },
    XK_braille_dots_12367: {
        code: 0x1002867,
        description: "(\u2867) BRAILLE PATTERN DOTS-12367",
    },
    XK_braille_dots_467: {
        code: 0x1002868,
        description: "(\u2868) BRAILLE PATTERN DOTS-467",
    },
    XK_braille_dots_1467: {
        code: 0x1002869,
        description: "(\u2869) BRAILLE PATTERN DOTS-1467",
    },
    XK_braille_dots_2467: {
        code: 0x100286a,
        description: "(\u286a) BRAILLE PATTERN DOTS-2467",
    },
    XK_braille_dots_12467: {
        code: 0x100286b,
        description: "(\u286b) BRAILLE PATTERN DOTS-12467",
    },
    XK_braille_dots_3467: {
        code: 0x100286c,
        description: "(\u286c) BRAILLE PATTERN DOTS-3467",
    },
    XK_braille_dots_13467: {
        code: 0x100286d,
        description: "(\u286d) BRAILLE PATTERN DOTS-13467",
    },
    XK_braille_dots_23467: {
        code: 0x100286e,
        description: "(\u286e) BRAILLE PATTERN DOTS-23467",
    },
    XK_braille_dots_123467: {
        code: 0x100286f,
        description: "(\u286f) BRAILLE PATTERN DOTS-123467",
    },
    XK_braille_dots_567: {
        code: 0x1002870,
        description: "(\u2870) BRAILLE PATTERN DOTS-567",
    },
    XK_braille_dots_1567: {
        code: 0x1002871,
        description: "(\u2871) BRAILLE PATTERN DOTS-1567",
    },
    XK_braille_dots_2567: {
        code: 0x1002872,
        description: "(\u2872) BRAILLE PATTERN DOTS-2567",
    },
    XK_braille_dots_12567: {
        code: 0x1002873,
        description: "(\u2873) BRAILLE PATTERN DOTS-12567",
    },
    XK_braille_dots_3567: {
        code: 0x1002874,
        description: "(\u2874) BRAILLE PATTERN DOTS-3567",
    },
    XK_braille_dots_13567: {
        code: 0x1002875,
        description: "(\u2875) BRAILLE PATTERN DOTS-13567",
    },
    XK_braille_dots_23567: {
        code: 0x1002876,
        description: "(\u2876) BRAILLE PATTERN DOTS-23567",
    },
    XK_braille_dots_123567: {
        code: 0x1002877,
        description: "(\u2877) BRAILLE PATTERN DOTS-123567",
    },
    XK_braille_dots_4567: {
        code: 0x1002878,
        description: "(\u2878) BRAILLE PATTERN DOTS-4567",
    },
    XK_braille_dots_14567: {
        code: 0x1002879,
        description: "(\u2879) BRAILLE PATTERN DOTS-14567",
    },
    XK_braille_dots_24567: {
        code: 0x100287a,
        description: "(\u287a) BRAILLE PATTERN DOTS-24567",
    },
    XK_braille_dots_124567: {
        code: 0x100287b,
        description: "(\u287b) BRAILLE PATTERN DOTS-124567",
    },
    XK_braille_dots_34567: {
        code: 0x100287c,
        description: "(\u287c) BRAILLE PATTERN DOTS-34567",
    },
    XK_braille_dots_134567: {
        code: 0x100287d,
        description: "(\u287d) BRAILLE PATTERN DOTS-134567",
    },
    XK_braille_dots_234567: {
        code: 0x100287e,
        description: "(\u287e) BRAILLE PATTERN DOTS-234567",
    },
    XK_braille_dots_1234567: {
        code: 0x100287f,
        description: "(\u287f) BRAILLE PATTERN DOTS-1234567",
    },
    XK_braille_dots_8: {
        code: 0x1002880,
        description: "(\u2880) BRAILLE PATTERN DOTS-8",
    },
    XK_braille_dots_18: {
        code: 0x1002881,
        description: "(\u2881) BRAILLE PATTERN DOTS-18",
    },
    XK_braille_dots_28: {
        code: 0x1002882,
        description: "(\u2882) BRAILLE PATTERN DOTS-28",
    },
    XK_braille_dots_128: {
        code: 0x1002883,
        description: "(\u2883) BRAILLE PATTERN DOTS-128",
    },
    XK_braille_dots_38: {
        code: 0x1002884,
        description: "(\u2884) BRAILLE PATTERN DOTS-38",
    },
    XK_braille_dots_138: {
        code: 0x1002885,
        description: "(\u2885) BRAILLE PATTERN DOTS-138",
    },
    XK_braille_dots_238: {
        code: 0x1002886,
        description: "(\u2886) BRAILLE PATTERN DOTS-238",
    },
    XK_braille_dots_1238: {
        code: 0x1002887,
        description: "(\u2887) BRAILLE PATTERN DOTS-1238",
    },
    XK_braille_dots_48: {
        code: 0x1002888,
        description: "(\u2888) BRAILLE PATTERN DOTS-48",
    },
    XK_braille_dots_148: {
        code: 0x1002889,
        description: "(\u2889) BRAILLE PATTERN DOTS-148",
    },
    XK_braille_dots_248: {
        code: 0x100288a,
        description: "(\u288a) BRAILLE PATTERN DOTS-248",
    },
    XK_braille_dots_1248: {
        code: 0x100288b,
        description: "(\u288b) BRAILLE PATTERN DOTS-1248",
    },
    XK_braille_dots_348: {
        code: 0x100288c,
        description: "(\u288c) BRAILLE PATTERN DOTS-348",
    },
    XK_braille_dots_1348: {
        code: 0x100288d,
        description: "(\u288d) BRAILLE PATTERN DOTS-1348",
    },
    XK_braille_dots_2348: {
        code: 0x100288e,
        description: "(\u288e) BRAILLE PATTERN DOTS-2348",
    },
    XK_braille_dots_12348: {
        code: 0x100288f,
        description: "(\u288f) BRAILLE PATTERN DOTS-12348",
    },
    XK_braille_dots_58: {
        code: 0x1002890,
        description: "(\u2890) BRAILLE PATTERN DOTS-58",
    },
    XK_braille_dots_158: {
        code: 0x1002891,
        description: "(\u2891) BRAILLE PATTERN DOTS-158",
    },
    XK_braille_dots_258: {
        code: 0x1002892,
        description: "(\u2892) BRAILLE PATTERN DOTS-258",
    },
    XK_braille_dots_1258: {
        code: 0x1002893,
        description: "(\u2893) BRAILLE PATTERN DOTS-1258",
    },
    XK_braille_dots_358: {
        code: 0x1002894,
        description: "(\u2894) BRAILLE PATTERN DOTS-358",
    },
    XK_braille_dots_1358: {
        code: 0x1002895,
        description: "(\u2895) BRAILLE PATTERN DOTS-1358",
    },
    XK_braille_dots_2358: {
        code: 0x1002896,
        description: "(\u2896) BRAILLE PATTERN DOTS-2358",
    },
    XK_braille_dots_12358: {
        code: 0x1002897,
        description: "(\u2897) BRAILLE PATTERN DOTS-12358",
    },
    XK_braille_dots_458: {
        code: 0x1002898,
        description: "(\u2898) BRAILLE PATTERN DOTS-458",
    },
    XK_braille_dots_1458: {
        code: 0x1002899,
        description: "(\u2899) BRAILLE PATTERN DOTS-1458",
    },
    XK_braille_dots_2458: {
        code: 0x100289a,
        description: "(\u289a) BRAILLE PATTERN DOTS-2458",
    },
    XK_braille_dots_12458: {
        code: 0x100289b,
        description: "(\u289b) BRAILLE PATTERN DOTS-12458",
    },
    XK_braille_dots_3458: {
        code: 0x100289c,
        description: "(\u289c) BRAILLE PATTERN DOTS-3458",
    },
    XK_braille_dots_13458: {
        code: 0x100289d,
        description: "(\u289d) BRAILLE PATTERN DOTS-13458",
    },
    XK_braille_dots_23458: {
        code: 0x100289e,
        description: "(\u289e) BRAILLE PATTERN DOTS-23458",
    },
    XK_braille_dots_123458: {
        code: 0x100289f,
        description: "(\u289f) BRAILLE PATTERN DOTS-123458",
    },
    XK_braille_dots_68: {
        code: 0x10028a0,
        description: "(\u28a0) BRAILLE PATTERN DOTS-68",
    },
    XK_braille_dots_168: {
        code: 0x10028a1,
        description: "(\u28a1) BRAILLE PATTERN DOTS-168",
    },
    XK_braille_dots_268: {
        code: 0x10028a2,
        description: "(\u28a2) BRAILLE PATTERN DOTS-268",
    },
    XK_braille_dots_1268: {
        code: 0x10028a3,
        description: "(\u28a3) BRAILLE PATTERN DOTS-1268",
    },
    XK_braille_dots_368: {
        code: 0x10028a4,
        description: "(\u28a4) BRAILLE PATTERN DOTS-368",
    },
    XK_braille_dots_1368: {
        code: 0x10028a5,
        description: "(\u28a5) BRAILLE PATTERN DOTS-1368",
    },
    XK_braille_dots_2368: {
        code: 0x10028a6,
        description: "(\u28a6) BRAILLE PATTERN DOTS-2368",
    },
    XK_braille_dots_12368: {
        code: 0x10028a7,
        description: "(\u28a7) BRAILLE PATTERN DOTS-12368",
    },
    XK_braille_dots_468: {
        code: 0x10028a8,
        description: "(\u28a8) BRAILLE PATTERN DOTS-468",
    },
    XK_braille_dots_1468: {
        code: 0x10028a9,
        description: "(\u28a9) BRAILLE PATTERN DOTS-1468",
    },
    XK_braille_dots_2468: {
        code: 0x10028aa,
        description: "(\u28aa) BRAILLE PATTERN DOTS-2468",
    },
    XK_braille_dots_12468: {
        code: 0x10028ab,
        description: "(\u28ab) BRAILLE PATTERN DOTS-12468",
    },
    XK_braille_dots_3468: {
        code: 0x10028ac,
        description: "(\u28ac) BRAILLE PATTERN DOTS-3468",
    },
    XK_braille_dots_13468: {
        code: 0x10028ad,
        description: "(\u28ad) BRAILLE PATTERN DOTS-13468",
    },
    XK_braille_dots_23468: {
        code: 0x10028ae,
        description: "(\u28ae) BRAILLE PATTERN DOTS-23468",
    },
    XK_braille_dots_123468: {
        code: 0x10028af,
        description: "(\u28af) BRAILLE PATTERN DOTS-123468",
    },
    XK_braille_dots_568: {
        code: 0x10028b0,
        description: "(\u28b0) BRAILLE PATTERN DOTS-568",
    },
    XK_braille_dots_1568: {
        code: 0x10028b1,
        description: "(\u28b1) BRAILLE PATTERN DOTS-1568",
    },
    XK_braille_dots_2568: {
        code: 0x10028b2,
        description: "(\u28b2) BRAILLE PATTERN DOTS-2568",
    },
    XK_braille_dots_12568: {
        code: 0x10028b3,
        description: "(\u28b3) BRAILLE PATTERN DOTS-12568",
    },
    XK_braille_dots_3568: {
        code: 0x10028b4,
        description: "(\u28b4) BRAILLE PATTERN DOTS-3568",
    },
    XK_braille_dots_13568: {
        code: 0x10028b5,
        description: "(\u28b5) BRAILLE PATTERN DOTS-13568",
    },
    XK_braille_dots_23568: {
        code: 0x10028b6,
        description: "(\u28b6) BRAILLE PATTERN DOTS-23568",
    },
    XK_braille_dots_123568: {
        code: 0x10028b7,
        description: "(\u28b7) BRAILLE PATTERN DOTS-123568",
    },
    XK_braille_dots_4568: {
        code: 0x10028b8,
        description: "(\u28b8) BRAILLE PATTERN DOTS-4568",
    },
    XK_braille_dots_14568: {
        code: 0x10028b9,
        description: "(\u28b9) BRAILLE PATTERN DOTS-14568",
    },
    XK_braille_dots_24568: {
        code: 0x10028ba,
        description: "(\u28ba) BRAILLE PATTERN DOTS-24568",
    },
    XK_braille_dots_124568: {
        code: 0x10028bb,
        description: "(\u28bb) BRAILLE PATTERN DOTS-124568",
    },
    XK_braille_dots_34568: {
        code: 0x10028bc,
        description: "(\u28bc) BRAILLE PATTERN DOTS-34568",
    },
    XK_braille_dots_134568: {
        code: 0x10028bd,
        description: "(\u28bd) BRAILLE PATTERN DOTS-134568",
    },
    XK_braille_dots_234568: {
        code: 0x10028be,
        description: "(\u28be) BRAILLE PATTERN DOTS-234568",
    },
    XK_braille_dots_1234568: {
        code: 0x10028bf,
        description: "(\u28bf) BRAILLE PATTERN DOTS-1234568",
    },
    XK_braille_dots_78: {
        code: 0x10028c0,
        description: "(\u28c0) BRAILLE PATTERN DOTS-78",
    },
    XK_braille_dots_178: {
        code: 0x10028c1,
        description: "(\u28c1) BRAILLE PATTERN DOTS-178",
    },
    XK_braille_dots_278: {
        code: 0x10028c2,
        description: "(\u28c2) BRAILLE PATTERN DOTS-278",
    },
    XK_braille_dots_1278: {
        code: 0x10028c3,
        description: "(\u28c3) BRAILLE PATTERN DOTS-1278",
    },
    XK_braille_dots_378: {
        code: 0x10028c4,
        description: "(\u28c4) BRAILLE PATTERN DOTS-378",
    },
    XK_braille_dots_1378: {
        code: 0x10028c5,
        description: "(\u28c5) BRAILLE PATTERN DOTS-1378",
    },
    XK_braille_dots_2378: {
        code: 0x10028c6,
        description: "(\u28c6) BRAILLE PATTERN DOTS-2378",
    },
    XK_braille_dots_12378: {
        code: 0x10028c7,
        description: "(\u28c7) BRAILLE PATTERN DOTS-12378",
    },
    XK_braille_dots_478: {
        code: 0x10028c8,
        description: "(\u28c8) BRAILLE PATTERN DOTS-478",
    },
    XK_braille_dots_1478: {
        code: 0x10028c9,
        description: "(\u28c9) BRAILLE PATTERN DOTS-1478",
    },
    XK_braille_dots_2478: {
        code: 0x10028ca,
        description: "(\u28ca) BRAILLE PATTERN DOTS-2478",
    },
    XK_braille_dots_12478: {
        code: 0x10028cb,
        description: "(\u28cb) BRAILLE PATTERN DOTS-12478",
    },
    XK_braille_dots_3478: {
        code: 0x10028cc,
        description: "(\u28cc) BRAILLE PATTERN DOTS-3478",
    },
    XK_braille_dots_13478: {
        code: 0x10028cd,
        description: "(\u28cd) BRAILLE PATTERN DOTS-13478",
    },
    XK_braille_dots_23478: {
        code: 0x10028ce,
        description: "(\u28ce) BRAILLE PATTERN DOTS-23478",
    },
    XK_braille_dots_123478: {
        code: 0x10028cf,
        description: "(\u28cf) BRAILLE PATTERN DOTS-123478",
    },
    XK_braille_dots_578: {
        code: 0x10028d0,
        description: "(\u28d0) BRAILLE PATTERN DOTS-578",
    },
    XK_braille_dots_1578: {
        code: 0x10028d1,
        description: "(\u28d1) BRAILLE PATTERN DOTS-1578",
    },
    XK_braille_dots_2578: {
        code: 0x10028d2,
        description: "(\u28d2) BRAILLE PATTERN DOTS-2578",
    },
    XK_braille_dots_12578: {
        code: 0x10028d3,
        description: "(\u28d3) BRAILLE PATTERN DOTS-12578",
    },
    XK_braille_dots_3578: {
        code: 0x10028d4,
        description: "(\u28d4) BRAILLE PATTERN DOTS-3578",
    },
    XK_braille_dots_13578: {
        code: 0x10028d5,
        description: "(\u28d5) BRAILLE PATTERN DOTS-13578",
    },
    XK_braille_dots_23578: {
        code: 0x10028d6,
        description: "(\u28d6) BRAILLE PATTERN DOTS-23578",
    },
    XK_braille_dots_123578: {
        code: 0x10028d7,
        description: "(\u28d7) BRAILLE PATTERN DOTS-123578",
    },
    XK_braille_dots_4578: {
        code: 0x10028d8,
        description: "(\u28d8) BRAILLE PATTERN DOTS-4578",
    },
    XK_braille_dots_14578: {
        code: 0x10028d9,
        description: "(\u28d9) BRAILLE PATTERN DOTS-14578",
    },
    XK_braille_dots_24578: {
        code: 0x10028da,
        description: "(\u28da) BRAILLE PATTERN DOTS-24578",
    },
    XK_braille_dots_124578: {
        code: 0x10028db,
        description: "(\u28db) BRAILLE PATTERN DOTS-124578",
    },
    XK_braille_dots_34578: {
        code: 0x10028dc,
        description: "(\u28dc) BRAILLE PATTERN DOTS-34578",
    },
    XK_braille_dots_134578: {
        code: 0x10028dd,
        description: "(\u28dd) BRAILLE PATTERN DOTS-134578",
    },
    XK_braille_dots_234578: {
        code: 0x10028de,
        description: "(\u28de) BRAILLE PATTERN DOTS-234578",
    },
    XK_braille_dots_1234578: {
        code: 0x10028df,
        description: "(\u28df) BRAILLE PATTERN DOTS-1234578",
    },
    XK_braille_dots_678: {
        code: 0x10028e0,
        description: "(\u28e0) BRAILLE PATTERN DOTS-678",
    },
    XK_braille_dots_1678: {
        code: 0x10028e1,
        description: "(\u28e1) BRAILLE PATTERN DOTS-1678",
    },
    XK_braille_dots_2678: {
        code: 0x10028e2,
        description: "(\u28e2) BRAILLE PATTERN DOTS-2678",
    },
    XK_braille_dots_12678: {
        code: 0x10028e3,
        description: "(\u28e3) BRAILLE PATTERN DOTS-12678",
    },
    XK_braille_dots_3678: {
        code: 0x10028e4,
        description: "(\u28e4) BRAILLE PATTERN DOTS-3678",
    },
    XK_braille_dots_13678: {
        code: 0x10028e5,
        description: "(\u28e5) BRAILLE PATTERN DOTS-13678",
    },
    XK_braille_dots_23678: {
        code: 0x10028e6,
        description: "(\u28e6) BRAILLE PATTERN DOTS-23678",
    },
    XK_braille_dots_123678: {
        code: 0x10028e7,
        description: "(\u28e7) BRAILLE PATTERN DOTS-123678",
    },
    XK_braille_dots_4678: {
        code: 0x10028e8,
        description: "(\u28e8) BRAILLE PATTERN DOTS-4678",
    },
    XK_braille_dots_14678: {
        code: 0x10028e9,
        description: "(\u28e9) BRAILLE PATTERN DOTS-14678",
    },
    XK_braille_dots_24678: {
        code: 0x10028ea,
        description: "(\u28ea) BRAILLE PATTERN DOTS-24678",
    },
    XK_braille_dots_124678: {
        code: 0x10028eb,
        description: "(\u28eb) BRAILLE PATTERN DOTS-124678",
    },
    XK_braille_dots_34678: {
        code: 0x10028ec,
        description: "(\u28ec) BRAILLE PATTERN DOTS-34678",
    },
    XK_braille_dots_134678: {
        code: 0x10028ed,
        description: "(\u28ed) BRAILLE PATTERN DOTS-134678",
    },
    XK_braille_dots_234678: {
        code: 0x10028ee,
        description: "(\u28ee) BRAILLE PATTERN DOTS-234678",
    },
    XK_braille_dots_1234678: {
        code: 0x10028ef,
        description: "(\u28ef) BRAILLE PATTERN DOTS-1234678",
    },
    XK_braille_dots_5678: {
        code: 0x10028f0,
        description: "(\u28f0) BRAILLE PATTERN DOTS-5678",
    },
    XK_braille_dots_15678: {
        code: 0x10028f1,
        description: "(\u28f1) BRAILLE PATTERN DOTS-15678",
    },
    XK_braille_dots_25678: {
        code: 0x10028f2,
        description: "(\u28f2) BRAILLE PATTERN DOTS-25678",
    },
    XK_braille_dots_125678: {
        code: 0x10028f3,
        description: "(\u28f3) BRAILLE PATTERN DOTS-125678",
    },
    XK_braille_dots_35678: {
        code: 0x10028f4,
        description: "(\u28f4) BRAILLE PATTERN DOTS-35678",
    },
    XK_braille_dots_135678: {
        code: 0x10028f5,
        description: "(\u28f5) BRAILLE PATTERN DOTS-135678",
    },
    XK_braille_dots_235678: {
        code: 0x10028f6,
        description: "(\u28f6) BRAILLE PATTERN DOTS-235678",
    },
    XK_braille_dots_1235678: {
        code: 0x10028f7,
        description: "(\u28f7) BRAILLE PATTERN DOTS-1235678",
    },
    XK_braille_dots_45678: {
        code: 0x10028f8,
        description: "(\u28f8) BRAILLE PATTERN DOTS-45678",
    },
    XK_braille_dots_145678: {
        code: 0x10028f9,
        description: "(\u28f9) BRAILLE PATTERN DOTS-145678",
    },
    XK_braille_dots_245678: {
        code: 0x10028fa,
        description: "(\u28fa) BRAILLE PATTERN DOTS-245678",
    },
    XK_braille_dots_1245678: {
        code: 0x10028fb,
        description: "(\u28fb) BRAILLE PATTERN DOTS-1245678",
    },
    XK_braille_dots_345678: {
        code: 0x10028fc,
        description: "(\u28fc) BRAILLE PATTERN DOTS-345678",
    },
    XK_braille_dots_1345678: {
        code: 0x10028fd,
        description: "(\u28fd) BRAILLE PATTERN DOTS-1345678",
    },
    XK_braille_dots_2345678: {
        code: 0x10028fe,
        description: "(\u28fe) BRAILLE PATTERN DOTS-2345678",
    },
    XK_braille_dots_12345678: {
        code: 0x10028ff,
        description: "(\u28ff) BRAILLE PATTERN DOTS-12345678",
    },

    /*
   * Sinhala (http://unicode.org/charts/PDF/U0D80.pdf)
   * http://www.nongnu.org/sinhala/doc/transliteration/sinhala-transliteration_6.html
   */

    // Group XK_SINHALA
    XK_Sinh_ng: { code: 0x1000d82, description: "(\u0D82) SINHALA ANUSVARAYA" },
    XK_Sinh_h2: { code: 0x1000d83, description: "(\u0D83) SINHALA VISARGAYA" },
    XK_Sinh_a: { code: 0x1000d85, description: "(\u0D85) SINHALA AYANNA" },
    XK_Sinh_aa: { code: 0x1000d86, description: "(\u0D86) SINHALA AAYANNA" },
    XK_Sinh_ae: { code: 0x1000d87, description: "(\u0D87) SINHALA AEYANNA" },
    XK_Sinh_aee: { code: 0x1000d88, description: "(\u0D88) SINHALA AEEYANNA" },
    XK_Sinh_i: { code: 0x1000d89, description: "(\u0D89) SINHALA IYANNA" },
    XK_Sinh_ii: { code: 0x1000d8a, description: "(\u0D8A) SINHALA IIYANNA" },
    XK_Sinh_u: { code: 0x1000d8b, description: "(\u0D8B) SINHALA UYANNA" },
    XK_Sinh_uu: { code: 0x1000d8c, description: "(\u0D8C) SINHALA UUYANNA" },
    XK_Sinh_ri: { code: 0x1000d8d, description: "(\u0D8D) SINHALA IRUYANNA" },
    XK_Sinh_rii: { code: 0x1000d8e, description: "(\u0D8E) SINHALA IRUUYANNA" },
    XK_Sinh_lu: { code: 0x1000d8f, description: "(\u0D8F) SINHALA ILUYANNA" },
    XK_Sinh_luu: { code: 0x1000d90, description: "(\u0D90) SINHALA ILUUYANNA" },
    XK_Sinh_e: { code: 0x1000d91, description: "(\u0D91) SINHALA EYANNA" },
    XK_Sinh_ee: { code: 0x1000d92, description: "(\u0D92) SINHALA EEYANNA" },
    XK_Sinh_ai: { code: 0x1000d93, description: "(\u0D93) SINHALA AIYANNA" },
    XK_Sinh_o: { code: 0x1000d94, description: "(\u0D94) SINHALA OYANNA" },
    XK_Sinh_oo: { code: 0x1000d95, description: "(\u0D95) SINHALA OOYANNA" },
    XK_Sinh_au: { code: 0x1000d96, description: "(\u0D96) SINHALA AUYANNA" },
    XK_Sinh_ka: { code: 0x1000d9a, description: "(\u0D9A) SINHALA KAYANNA" },
    XK_Sinh_kha: {
        code: 0x1000d9b,
        description: "(\u0D9B) SINHALA MAHA. KAYANNA",
    },
    XK_Sinh_ga: { code: 0x1000d9c, description: "(\u0D9C) SINHALA GAYANNA" },
    XK_Sinh_gha: {
        code: 0x1000d9d,
        description: "(\u0D9D) SINHALA MAHA. GAYANNA",
    },
    XK_Sinh_ng2: {
        code: 0x1000d9e,
        description: "(\u0D9E) SINHALA KANTAJA NAASIKYAYA",
    },
    XK_Sinh_nga: {
        code: 0x1000d9f,
        description: "(\u0D9F) SINHALA SANYAKA GAYANNA",
    },
    XK_Sinh_ca: { code: 0x1000da0, description: "(\u0DA0) SINHALA CAYANNA" },
    XK_Sinh_cha: {
        code: 0x1000da1,
        description: "(\u0DA1) SINHALA MAHA. CAYANNA",
    },
    XK_Sinh_ja: { code: 0x1000da2, description: "(\u0DA2) SINHALA JAYANNA" },
    XK_Sinh_jha: {
        code: 0x1000da3,
        description: "(\u0DA3) SINHALA MAHA. JAYANNA",
    },
    XK_Sinh_nya: {
        code: 0x1000da4,
        description: "(\u0DA4) SINHALA TAALUJA NAASIKYAYA",
    },
    XK_Sinh_jnya: {
        code: 0x1000da5,
        description: "(\u0DA5) SINHALA TAALUJA SANYOOGA NAASIKYAYA",
    },
    XK_Sinh_nja: {
        code: 0x1000da6,
        description: "(\u0DA6) SINHALA SANYAKA JAYANNA",
    },
    XK_Sinh_tta: { code: 0x1000da7, description: "(\u0DA7) SINHALA TTAYANNA" },
    XK_Sinh_ttha: {
        code: 0x1000da8,
        description: "(\u0DA8) SINHALA MAHA. TTAYANNA",
    },
    XK_Sinh_dda: { code: 0x1000da9, description: "(\u0DA9) SINHALA DDAYANNA" },
    XK_Sinh_ddha: {
        code: 0x1000daa,
        description: "(\u0DAA) SINHALA MAHA. DDAYANNA",
    },
    XK_Sinh_nna: {
        code: 0x1000dab,
        description: "(\u0DAB) SINHALA MUURDHAJA NAYANNA",
    },
    XK_Sinh_ndda: {
        code: 0x1000dac,
        description: "(\u0DAC) SINHALA SANYAKA DDAYANNA",
    },
    XK_Sinh_tha: { code: 0x1000dad, description: "(\u0DAD) SINHALA TAYANNA" },
    XK_Sinh_thha: {
        code: 0x1000dae,
        description: "(\u0DAE) SINHALA MAHA. TAYANNA",
    },
    XK_Sinh_dha: { code: 0x1000daf, description: "(\u0DAF) SINHALA DAYANNA" },
    XK_Sinh_dhha: {
        code: 0x1000db0,
        description: "(\u0DB0) SINHALA MAHA. DAYANNA",
    },
    XK_Sinh_na: {
        code: 0x1000db1,
        description: "(\u0DB1) SINHALA DANTAJA NAYANNA",
    },
    XK_Sinh_ndha: {
        code: 0x1000db3,
        description: "(\u0DB3) SINHALA SANYAKA DAYANNA",
    },
    XK_Sinh_pa: { code: 0x1000db4, description: "(\u0DB4) SINHALA PAYANNA" },
    XK_Sinh_pha: {
        code: 0x1000db5,
        description: "(\u0DB5) SINHALA MAHA. PAYANNA",
    },
    XK_Sinh_ba: { code: 0x1000db6, description: "(\u0DB6) SINHALA BAYANNA" },
    XK_Sinh_bha: {
        code: 0x1000db7,
        description: "(\u0DB7) SINHALA MAHA. BAYANNA",
    },
    XK_Sinh_ma: { code: 0x1000db8, description: "(\u0DB8) SINHALA MAYANNA" },
    XK_Sinh_mba: {
        code: 0x1000db9,
        description: "(\u0DB9) SINHALA AMBA BAYANNA",
    },
    XK_Sinh_ya: { code: 0x1000dba, description: "(\u0DBA) SINHALA YAYANNA" },
    XK_Sinh_ra: { code: 0x1000dbb, description: "(\u0DBB) SINHALA RAYANNA" },
    XK_Sinh_la: {
        code: 0x1000dbd,
        description: "(\u0DBD) SINHALA DANTAJA LAYANNA",
    },
    XK_Sinh_va: { code: 0x1000dc0, description: "(\u0DC0) SINHALA VAYANNA" },
    XK_Sinh_sha: {
        code: 0x1000dc1,
        description: "(\u0DC1) SINHALA TAALUJA SAYANNA",
    },
    XK_Sinh_ssha: {
        code: 0x1000dc2,
        description: "(\u0DC2) SINHALA MUURDHAJA SAYANNA",
    },
    XK_Sinh_sa: {
        code: 0x1000dc3,
        description: "(\u0DC3) SINHALA DANTAJA SAYANNA",
    },
    XK_Sinh_ha: { code: 0x1000dc4, description: "(\u0DC4) SINHALA HAYANNA" },
    XK_Sinh_lla: {
        code: 0x1000dc5,
        description: "(\u0DC5) SINHALA MUURDHAJA LAYANNA",
    },
    XK_Sinh_fa: { code: 0x1000dc6, description: "(\u0DC6) SINHALA FAYANNA" },
    XK_Sinh_al: { code: 0x1000dca, description: "(\u0DCA) SINHALA AL-LAKUNA" },
    XK_Sinh_aa2: { code: 0x1000dcf, description: "(\u0DCF) SINHALA AELA-PILLA" },
    XK_Sinh_ae2: { code: 0x1000dd0, description: "(\u0DD0) SINHALA AEDA-PILLA" },
    XK_Sinh_aee2: {
        code: 0x1000dd1,
        description: "(\u0DD1) SINHALA DIGA AEDA-PILLA",
    },
    XK_Sinh_i2: { code: 0x1000dd2, description: "(\u0DD2) SINHALA IS-PILLA" },
    XK_Sinh_ii2: {
        code: 0x1000dd3,
        description: "(\u0DD3) SINHALA DIGA IS-PILLA",
    },
    XK_Sinh_u2: { code: 0x1000dd4, description: "(\u0DD4) SINHALA PAA-PILLA" },
    XK_Sinh_uu2: {
        code: 0x1000dd6,
        description: "(\u0DD6) SINHALA DIGA PAA-PILLA",
    },
    XK_Sinh_ru2: {
        code: 0x1000dd8,
        description: "(\u0DD8) SINHALA GAETTA-PILLA",
    },
    XK_Sinh_e2: { code: 0x1000dd9, description: "(\u0DD9) SINHALA KOMBUVA" },
    XK_Sinh_ee2: {
        code: 0x1000dda,
        description: "(\u0DDA) SINHALA DIGA KOMBUVA",
    },
    XK_Sinh_ai2: { code: 0x1000ddb, description: "(\u0DDB) SINHALA KOMBU DEKA" },
    XK_Sinh_o2: {
        code: 0x1000ddc,
        description: "(\u0DDC) SINHALA KOMBUVA HAA AELA-PILLA",
    },
    XK_Sinh_oo2: {
        code: 0x1000ddd,
        description: "(\u0DDD) SINHALA KOMBUVA HAA DIGA AELA-PILLA",
    },
    XK_Sinh_au2: {
        code: 0x1000dde,
        description: "(\u0DDE) SINHALA KOMBUVA HAA GAYANUKITTA",
    },
    XK_Sinh_lu2: { code: 0x1000ddf, description: "(\u0DDF) SINHALA GAYANUKITTA" },
    XK_Sinh_ruu2: {
        code: 0x1000df2,
        description: "(\u0DF2) SINHALA DIGA GAETTA-PILLA",
    },
    XK_Sinh_luu2: {
        code: 0x1000df3,
        description: "(\u0DF3) SINHALA DIGA GAYANUKITTA",
    },
    XK_Sinh_kunddaliya: {
        code: 0x1000df4,
        description: "(\u0DF4) SINHALA KUNDDALIYA",
    },

    NoSymbol: 0,
};
