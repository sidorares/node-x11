#!/bin/sh
# Run the test suite against a private Xvfb server (display :99).
# Works on Linux (Xvfb) and macOS (XQuartz's Xvfb). Reuses a running Xvfb.
set -e

DISPLAY_NUM=99
SOCKET="/tmp/.X11-unix/X$DISPLAY_NUM"

find_xvfb() {
    if command -v Xvfb >/dev/null 2>&1; then
        command -v Xvfb
    elif [ -x /opt/X11/bin/Xvfb ]; then
        echo /opt/X11/bin/Xvfb   # XQuartz on macOS
    else
        echo "Xvfb not found. Linux: install xvfb. macOS: install XQuartz." >&2
        exit 1
    fi
}

if [ ! -S "$SOCKET" ]; then
    XVFB=$(find_xvfb)
    # +iglx enables indirect GLX contexts (off by default in modern servers),
    # needed by the GLX tests
    "$XVFB" ":$DISPLAY_NUM" -nolisten tcp +iglx 2>/tmp/xvfb-$DISPLAY_NUM.log &
    for _ in 1 2 3 4 5 6 7 8 9 10; do
        [ -S "$SOCKET" ] && break
        sleep 0.5
    done
    [ -S "$SOCKET" ] || { echo "Xvfb failed to start, see /tmp/xvfb-$DISPLAY_NUM.log" >&2; exit 1; }
fi

if [ "$(uname)" = "Darwin" ]; then
    # On darwin the client only uses a unix socket when DISPLAY is a literal
    # path (XQuartz launchd style), so expose the Xvfb socket under such a name.
    ln -sf "$SOCKET" "$SOCKET:$DISPLAY_NUM"
    DISPLAY="$SOCKET:$DISPLAY_NUM"
else
    DISPLAY=":$DISPLAY_NUM"
fi
export DISPLAY

exec npm test
