#!/bin/bash -e

keysymdef_url=http://cgit.freedesktop.org/xorg/proto/xproto/plain/keysymdef.h
keysymdef=$(mktemp)

wget $keysymdef_url -O $keysymdef

(
echo "
/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *\\

   This file is automatically translated from X.Org's xproto/keysymdef.h
   Please, do not update this file with your hands, run $(basename "$0").

\\* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

module.exports = {
"

sed -r '
  s/#ifdef\s+/\/\/ Group /
  s/#endif.*//
  s/#define\s+([^ ]+)(\s+)([^ ]+)\s*\/\*\s*([^\*]+[^ ])\s*\*\//  \1:\2{ code: \3, description: "\4" },/
  s/(\b)U\+([0-9A-F]+)(\b)/\1(\\u\2)\3/i
  s/#define\s+([^ ]+)(\s+)([^ ]+)/  \1:\2{ code: \3, description: null },/
  #s/#define\s+([^ ]+)(\s+[^ ]+)/  \1:\2,/
' $keysymdef

echo -n '
  NoSymbol: 0
};'

) > "$(dirname "$0")/keysyms.js"

rm $keysymdef
