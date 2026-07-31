'use strict';

/**
 * Generate core X11 event parsers and packers from autogen/proto/xproto.xml.
 * Output: lib/generated/core-events.js
 *
 * Wire layout (32 bytes): type(1), detail/pad(1), seq(2), extra(4), body(24).
 * Parsers receive (type, seq, extra, code, raw) where raw is the 24-byte body.
 * Packers take the parsed object back to the 32 bytes it came from.
 *
 * Both emitters read the same field descriptor (`describeEvent`), so a
 * parser and its packer can never disagree about an offset.
 */

const fs = require('fs');
const path = require('path');
const sax = require('sax');

const PROTO = path.join(__dirname, 'proto', 'xproto.xml');
const OUT = path.join(__dirname, '..', 'lib', 'generated', 'core-events.js');

/** XML field name → public JS property name (legacy API). */
const FIELD_ALIAS = {
  event: 'wid',
  root_x: 'rootx',
  root_y: 'rooty',
  event_x: 'x',
  event_y: 'y',
  same_screen: 'sameScreen',
  same_screen_focus: 'sameScreenFocus',
  window: 'wid',
  border_width: 'borderWidth',
  override_redirect: 'overrideRedirect',
  from_configure: 'fromConfigure',
  above_sibling: 'aboveSibling',
  stack_mode: 'stackMode',
  value_mask: 'mask',
  message_type: 'message_type',
  first_keycode: 'firstKeyCode'
};

/** Per-event overrides for detail / event / window naming. */
const EVENT_FIELD_ALIAS = {
  KeyPress: { detail: 'keycode', state: 'buttons' },
  KeyRelease: { detail: 'keycode', state: 'buttons' },
  ButtonPress: { detail: 'keycode', state: 'buttons' },
  ButtonRelease: { detail: 'keycode', state: 'buttons' },
  MotionNotify: { detail: 'keycode', state: 'buttons' },
  EnterNotify: { detail: 'detail', state: 'buttons' },
  LeaveNotify: { detail: 'detail', state: 'buttons' },
  FocusIn: { detail: 'detail', event: 'wid' },
  FocusOut: { detail: 'detail', event: 'wid' },
  Expose: { window: 'wid' },
  CreateNotify: { window: 'wid' },
  DestroyNotify: { event: 'event', window: 'wid' },
  UnmapNotify: { event: 'event', window: 'wid' },
  MapNotify: { event: 'event', window: 'wid' },
  MapRequest: { window: 'wid' },
  ConfigureNotify: { event: 'wid', window: 'wid1' },
  ConfigureRequest: { window: 'wid', value_mask: 'mask', stack_mode: 'stackMode' },
  PropertyNotify: { window: 'wid' },
  ClientMessage: { window: 'wid' },
  MappingNotify: { first_keycode: 'firstKeyCode' },
  VisibilityNotify: { window: 'wid' },
  ReparentNotify: { event: 'event', window: 'wid' },
  GravityNotify: { event: 'event', window: 'wid' },
  ResizeRequest: { window: 'wid' },
  CirculateNotify: { event: 'event', window: 'wid' },
  CirculateRequest: { event: 'event', window: 'wid' },
  ColormapNotify: { window: 'wid' }
};

const TYPE_SIZE = {
  BOOL: 1, BYTE: 1, CARD8: 1, INT8: 1, KEYCODE: 1, BUTTON: 1,
  CARD16: 2, INT16: 2,
  CARD32: 4, INT32: 4, TIMESTAMP: 4, WINDOW: 4, DRAWABLE: 4, ATOM: 4,
  COLORMAP: 4, PIXMAP: 4, CURSOR: 4, FONT: 4, GCONTEXT: 4, VISUALID: 4
};

const TYPE_READ = {
  BOOL: 'readUInt8',
  BYTE: 'readUInt8',
  CARD8: 'readUInt8',
  INT8: 'readInt8',
  KEYCODE: 'readUInt8',
  BUTTON: 'readUInt8',
  CARD16: 'readUInt16LE',
  INT16: 'readInt16LE',
  CARD32: 'readUInt32LE',
  INT32: 'readInt32LE',
  TIMESTAMP: 'readUInt32LE',
  WINDOW: 'readUInt32LE',
  DRAWABLE: 'readUInt32LE',
  ATOM: 'readUInt32LE',
  COLORMAP: 'readUInt32LE',
  PIXMAP: 'readUInt32LE',
  CURSOR: 'readUInt32LE',
  FONT: 'readUInt32LE',
  GCONTEXT: 'readUInt32LE',
  VISUALID: 'readUInt32LE'
};

/**
 * Inverse of TYPE_READ. Each entry writes into the full 32-byte packet at an
 * absolute offset and normalises the value first, so packing a field is total:
 * out-of-range and negative numbers wrap the way the wire does instead of
 * throwing ERR_OUT_OF_RANGE from Buffer.write*.
 */
const TYPE_WRITE = {
  BOOL: v => `buf[%d] = ${v} ? 1 : 0;`,
  BYTE: v => `buf[%d] = ${v} & 0xff;`,
  CARD8: v => `buf[%d] = ${v} & 0xff;`,
  INT8: v => `buf[%d] = ${v} & 0xff;`,
  KEYCODE: v => `buf[%d] = ${v} & 0xff;`,
  BUTTON: v => `buf[%d] = ${v} & 0xff;`,
  // signed fields go out through the unsigned writers so that a negative
  // coordinate wraps to its two's complement instead of throwing
  CARD16: v => `buf.writeUInt16LE(${v} & 0xffff, %d);`,
  INT16: v => `buf.writeUInt16LE(${v} & 0xffff, %d);`,
  CARD32: v => `buf.writeUInt32LE(${v} >>> 0, %d);`,
  INT32: v => `buf.writeUInt32LE(${v} >>> 0, %d);`,
  TIMESTAMP: v => `buf.writeUInt32LE(${v} >>> 0, %d);`,
  WINDOW: v => `buf.writeUInt32LE(${v} >>> 0, %d);`,
  DRAWABLE: v => `buf.writeUInt32LE(${v} >>> 0, %d);`,
  ATOM: v => `buf.writeUInt32LE(${v} >>> 0, %d);`,
  COLORMAP: v => `buf.writeUInt32LE(${v} >>> 0, %d);`,
  PIXMAP: v => `buf.writeUInt32LE(${v} >>> 0, %d);`,
  CURSOR: v => `buf.writeUInt32LE(${v} >>> 0, %d);`,
  FONT: v => `buf.writeUInt32LE(${v} >>> 0, %d);`,
  GCONTEXT: v => `buf.writeUInt32LE(${v} >>> 0, %d);`,
  VISUALID: v => `buf.writeUInt32LE(${v} >>> 0, %d);`
};

/**
 * ClientMessage bodies are one of three views over the same 20 bytes; the
 * parser and the packer both branch off this table so they cannot diverge.
 */
const CLIENT_MESSAGE_DATA = [
  { format: 32, count: 5, size: 4, read: 'readUInt32LE', write: 'writeUInt32LE' },
  { format: 16, count: 10, size: 2, read: 'readUInt16LE', write: 'writeUInt16LE' },
  { format: 8, count: 20, size: 1, read: 'readUInt8', write: 'writeUInt8' }
];

/** Keys the parser puts on every event object; no wire field may claim them. */
const RESERVED_PROPS = new Set(['type', 'seq', 'name', 'values', 'rawData']);

/** Property names of the three hand-written events, for the same uniqueness check. */
const SPECIAL_PROPS = {
  KeymapNotify: ['keys'],
  ClientMessage: ['format', 'wid', 'message_type', 'data'],
  MappingNotify: ['request', 'firstKeyCode', 'count']
};

function resolveTypes(typedefs, name) {
  while (typedefs[name])
    name = typedefs[name];
  return name;
}

function jsName(eventName, xmlName) {
  const per = EVENT_FIELD_ALIAS[eventName] || {};
  if (per[xmlName])
    return per[xmlName];
  if (FIELD_ALIAS[xmlName])
    return FIELD_ALIAS[xmlName];
  // camelCase
  return xmlName.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function parseProto(cb) {
  const typedefs = {};
  const events = {};
  const eventCopies = [];
  let current = null;
  let inDoc = false;

  const parser = sax.createStream(true);
  fs.createReadStream(PROTO).pipe(parser);

  parser.on('opentag', tag => {
    if (tag.name === 'doc') {
      inDoc = true;
      return;
    }
    if (inDoc)
      return;

    if (tag.name === 'typedef') {
      typedefs[tag.attributes.newname] = tag.attributes.oldname;
      return;
    }
    if (tag.name === 'xidtype' || tag.name === 'xidunion') {
      typedefs[tag.attributes.name] = 'CARD32';
      return;
    }
    if (tag.name === 'event') {
      current = {
        name: tag.attributes.name,
        number: parseInt(tag.attributes.number, 10),
        fields: [],
        noSeq: tag.attributes['no-sequence-number'] === 'true'
      };
      return;
    }
    if (tag.name === 'eventcopy') {
      eventCopies.push({
        name: tag.attributes.name,
        number: parseInt(tag.attributes.number, 10),
        ref: tag.attributes.ref
      });
      return;
    }
    if (!current)
      return;
    if (tag.name === 'field') {
      current.fields.push({
        kind: 'field',
        name: tag.attributes.name,
        type: tag.attributes.type
      });
    } else if (tag.name === 'pad') {
      current.fields.push({
        kind: 'pad',
        bytes: parseInt(tag.attributes.bytes, 10)
      });
    } else if (tag.name === 'list') {
      current.fields.push({
        kind: 'list',
        name: tag.attributes.name,
        type: tag.attributes.type
      });
    }
  });

  parser.on('closetag', name => {
    if (name === 'doc') {
      inDoc = false;
      return;
    }
    if (name === 'event' && current) {
      events[current.name] = current;
      current = null;
    }
  });

  parser.on('end', () => {
    for (const ec of eventCopies) {
      const ref = events[ec.ref];
      if (!ref)
        throw new Error(`eventcopy ${ec.name} refs missing ${ec.ref}`);
      events[ec.name] = {
        name: ec.name,
        number: ec.number,
        fields: ref.fields.slice(),
        noSeq: ref.noSeq,
        copyOf: ec.ref
      };
    }
    cb(null, { typedefs, events });
  });
}

function fieldSize(typedefs, f) {
  if (f.kind === 'pad')
    return f.bytes;
  if (f.kind === 'list')
    return null; // variable / special
  const t = resolveTypes(typedefs, f.type);
  const sz = TYPE_SIZE[t];
  if (!sz)
    throw new Error(`unknown type ${f.type}→${t}`);
  return sz;
}

function readExpr(typedefs, f, bufExpr, offset) {
  const t = resolveTypes(typedefs, f.type);
  const method = TYPE_READ[t];
  if (!method)
    throw new Error(`no reader for ${t}`);
  return `${bufExpr}.${method}(${offset})`;
}

/**
 * Walk one event's wire layout once and describe where every field lives.
 * Both emitters below read this, so the parser and the packer cannot end up
 * disagreeing about an offset.
 *
 * Returns { name, number, detail, extra, body[], derived[] } where
 * `detail` is the byte at absolute offset 1, `extra` the 32-bit slot at 4..7
 * and each `body` entry carries both the absolute offset and the offset
 * relative to `raw` (the 24-byte body the parsers are handed).
 */
function describeEvent(typedefs, ev) {
  if (ev.noSeq) {
    // The header's sequence number slot is payload for these; both emitters
    // assume bytes 2-3 are the sequence number. KeymapNotify is the only one
    // in xproto.xml and is hand-written below.
    throw new Error(`${ev.name}: no-sequence-number events need a hand-written parser/packer pair`);
  }

  const desc = {
    name: ev.name,
    number: ev.number,
    detail: null,
    extra: null,
    body: [],
    derived: []
  };

  // Walk wire offsets: after type byte at 0. seq at 2..3. Body fields relative to full packet.
  let wire = 1;

  for (const f of ev.fields) {
    if (f.kind === 'pad') {
      // If pad is at offset 1 (replacing detail), skip; sequence occupies 2-3
      if (wire === 1 && f.bytes >= 1) {
        wire = 2;
        // sequence
        wire = 4;
        const remaining = f.bytes - 1;
        if (remaining > 0)
          wire += remaining;
        continue;
      }
      if (wire === 2) {
        wire = 4;
        wire += f.bytes;
        continue;
      }
      wire += f.bytes;
      continue;
    }

    if (f.kind === 'list')
      throw new Error(`${ev.name}: list field ${f.name} needs a hand-written parser/packer pair`);

    const sz = fieldSize(typedefs, f);
    const prop = jsName(ev.name, f.name);
    const type = resolveTypes(typedefs, f.type);

    // Align past sequence number if we're about to write into 2..3
    if (wire === 2)
      wire = 4;

    if (wire === 1 && sz === 1) {
      desc.detail = { prop, type, size: sz };
      wire = 2;
      continue;
    }

    if (wire === 4 && sz === 4) {
      desc.extra = { prop, type, size: sz };
      wire = 8;
      continue;
    }

    if (wire < 8)
      throw new Error(`${ev.name}: field ${f.name} (${sz}b) lands at offset ${wire}, inside the header; it needs a hand-written parser/packer pair`);

    desc.body.push({
      prop,
      type,
      size: sz,
      absOff: wire,
      rawOff: wire - 8,
      // ConfigureNotify historically left overrideRedirect as a 0/1 number
      parserCoerces: (prop === 'overrideRedirect' || prop === 'fromConfigure') && ev.name !== 'ConfigureNotify'
    });
    wire += sz;
  }

  // EnterNotify/LeaveNotify carry a legacy values[] copy of nine fields it
  // already reported individually — synthesised on parse, never packed.
  if (ev.name === 'EnterNotify' || ev.name === 'LeaveNotify')
    desc.derived.push('values');

  const seen = new Set();
  for (const prop of propsOf(desc)) {
    if (RESERVED_PROPS.has(prop))
      throw new Error(`${ev.name}: field maps to reserved property '${prop}' — add an EVENT_FIELD_ALIAS entry`);
    if (seen.has(prop))
      throw new Error(`${ev.name}: two wire fields both map to '${prop}' — add an EVENT_FIELD_ALIAS entry`);
    seen.add(prop);
  }

  return desc;
}

function propsOf(desc) {
  const props = desc.body.map(f => f.prop);
  if (desc.detail)
    props.unshift(desc.detail.prop);
  if (desc.extra)
    props.push(desc.extra.prop);
  return props;
}

/** Emit the parser function for one described event. */
function emitParser(desc) {
  const lines = [];
  lines.push(`function parse${desc.name}(type, seq, extra, code, raw, headerBuf) {`);
  lines.push(`  const event = { type: type & 0x7F, seq, name: '${desc.name}' };`);

  if (desc.detail)
    lines.push(`  event.${desc.detail.prop} = code;`);
  if (desc.extra)
    lines.push(`  event.${desc.extra.prop} = extra;`);

  for (const f of desc.body) {
    const method = TYPE_READ[f.type];
    if (!method)
      throw new Error(`no reader for ${f.type}`);
    const expr = `raw.${method}(${f.rawOff})`;
    lines.push(`  event.${f.prop} = ${f.parserCoerces ? `!!${expr}` : expr};`);
  }

  if (desc.derived.includes('values'))
    lines.push('  event.values = [event.root, event.wid, event.child, event.rootx, event.rooty, event.x, event.y, event.buttons, event.mode];');

  lines.push('  return event;');
  lines.push('}');
  return lines.join('\n');
}

/**
 * Emit the packer function for one described event: the same field map, run
 * backwards into a zero-filled 32-byte buffer. Offsets are absolute, so no
 * raw/headerBuf split is needed on this side.
 */
function emitPacker(desc) {
  const lines = [];
  lines.push(`function pack${desc.name}(ev, buf) {`);
  lines.push(`  buf[0] = ${desc.number};`);
  if (desc.detail)
    lines.push('  ' + writeExpr(desc.detail.type, `ev.${desc.detail.prop}`, 1));
  else
    lines.push('  buf[1] = 0;');
  lines.push('  buf.writeUInt16LE(ev.seq & 0xffff, 2);');
  if (desc.extra)
    lines.push('  ' + writeExpr(desc.extra.type, `ev.${desc.extra.prop}`, 4));

  for (const f of desc.body)
    lines.push('  ' + writeExpr(f.type, `ev.${f.prop}`, f.absOff));

  if (desc.derived.includes('values'))
    lines.push('  // values[] duplicates fields already written above; derived on parse, not packed');

  lines.push('  return buf;');
  lines.push('}');
  return lines.join('\n');
}

function writeExpr(type, valueExpr, absOff) {
  const write = TYPE_WRITE[type];
  if (!write)
    throw new Error(`no writer for ${type}`);
  return write(valueExpr).replace('%d', absOff);
}

function genClientMessage() {
  const lines = [];
  lines.push('function parseClientMessage(type, seq, extra, code, raw, headerBuf) {');
  lines.push('  const event = { type: type & 0x7F, seq, name: \'ClientMessage\' };');
  lines.push('  event.format = code;');
  lines.push('  event.wid = extra;');
  lines.push('  event.message_type = raw.readUInt32LE(0);');
  lines.push('  const data = [];');
  CLIENT_MESSAGE_DATA.forEach((v, i) => {
    const head = i === 0 ? `  if (code === ${v.format}) {`
      : i === CLIENT_MESSAGE_DATA.length - 1 ? '  } else {'
        : `  } else if (code === ${v.format}) {`;
    lines.push(head);
    lines.push(`    for (let i = 0; i < ${v.count}; i++) data.push(raw.${v.read}(4 + i${v.size === 1 ? '' : ` * ${v.size}`}));`);
  });
  lines.push('  }');
  lines.push('  event.data = data;');
  lines.push('  return event;');
  lines.push('}');

  const p = [];
  p.push('function packClientMessage(ev, buf) {');
  p.push('  buf[0] = 33;');
  p.push('  buf[1] = ev.format & 0xff;');
  p.push('  buf.writeUInt16LE(ev.seq & 0xffff, 2);');
  p.push('  buf.writeUInt32LE(ev.wid >>> 0, 4);');
  p.push('  buf.writeUInt32LE(ev.message_type >>> 0, 8);');
  p.push('  const data = ev.data || [];');
  CLIENT_MESSAGE_DATA.forEach((v, i) => {
    const head = i === 0 ? `  if (ev.format === ${v.format}) {`
      : i === CLIENT_MESSAGE_DATA.length - 1 ? '  } else {'
        : `  } else if (ev.format === ${v.format}) {`;
    // masked, not range-checked: XDND and friends compose data words like
    // (x << 16) | y, which is a negative number in JS
    const norm = v.size === 4 ? 'data[i] >>> 0' : `data[i] & 0x${'ff'.repeat(v.size)}`;
    p.push(head);
    p.push(`    for (let i = 0; i < ${v.count}; i++) buf.${v.write}(${norm}, 12 + i${v.size === 1 ? '' : ` * ${v.size}`});`);
  });
  p.push('  }');
  p.push('  return buf;');
  p.push('}');

  return { name: 'ClientMessage', number: 33, code: lines.join('\n'), packCode: p.join('\n') };
}

function genMappingNotify() {
  const lines = [];
  lines.push('function parseMappingNotify(type, seq, extra, code, raw, headerBuf) {');
  lines.push('  const event = { type: type & 0x7F, seq, name: \'MappingNotify\' };');
  lines.push('  event.request = headerBuf[4];');
  lines.push('  event.firstKeyCode = headerBuf[5];');
  lines.push('  event.count = headerBuf[6];');
  lines.push('  return event;');
  lines.push('}');

  // Three byte-granular fields inside the 32-bit "extra" slot, so they are
  // written at absolute offsets rather than through the generic body walk.
  const p = [];
  p.push('function packMappingNotify(ev, buf) {');
  p.push('  buf[0] = 34;');
  p.push('  buf[1] = 0;');
  p.push('  buf.writeUInt16LE(ev.seq & 0xffff, 2);');
  p.push('  buf[4] = ev.request & 0xff;');
  p.push('  buf[5] = ev.firstKeyCode & 0xff;');
  p.push('  buf[6] = ev.count & 0xff;');
  p.push('  return buf;');
  p.push('}');

  return { name: 'MappingNotify', number: 34, code: lines.join('\n'), packCode: p.join('\n') };
}

function genKeymapNotify() {
  // no-sequence-number event: bytes 1..31 are the key bit vector
  // (keys for keycodes 8..255; QueryKeymap byte K corresponds to keys[K-1])
  const lines = [];
  lines.push('function parseKeymapNotify(type, seq, extra, code, raw, headerBuf) {');
  lines.push('  const event = { type: type & 0x7F, name: \'KeymapNotify\' };');
  lines.push('  event.keys = Buffer.concat([headerBuf.slice(1, 8), raw]);');
  lines.push('  return event;');
  lines.push('}');

  // The only event with no sequence number: bytes 2-3 are key bits, so this
  // packer must not stamp them. `keys` is the 31 bytes from offset 1 on,
  // matching what the parser hands back (keys[i] is wire byte i + 1).
  const p = [];
  p.push('function packKeymapNotify(ev, buf) {');
  p.push('  buf[0] = 11;');
  p.push('  if (ev.keys) Buffer.from(ev.keys).copy(buf, 1, 0, 31);');
  p.push('  return buf;');
  p.push('}');

  return { name: 'KeymapNotify', number: 11, code: lines.join('\n'), packCode: p.join('\n') };
}

/** Emitted verbatim: the packer counterpart of unpackEvent. */
const PACK_EVENT = `
/**
 * Build the 32-byte wire form of an event, ready to hand to SendEvent.
 *
 * \`ev\` is shaped like the objects unpackEvent produces: \`name\` (or \`type\`)
 * selects the layout and the remaining properties are the fields; anything
 * left out packs as zero. The sequence number at bytes 2-3 and the 0x80
 * "came from SendEvent" bit are filled in by the server, so callers do not
 * need to supply them. Pass \`buf\` to pack into an existing 32-byte buffer
 * (it is zeroed first) instead of allocating a new one.
 */
function packEvent(ev, buf) {
  if (!ev || typeof ev !== 'object')
    throw new TypeError('packEvent: expected an event object, got ' + typeof ev);

  let type;
  const named = ev.name === undefined ? undefined : eventTypes[ev.name];
  if (ev.name !== undefined && named === undefined)
    throw new TypeError('packEvent: unknown event name ' + JSON.stringify(ev.name));

  if (typeof ev.type === 'number') {
    type = ev.type & 0x7f;
    // Extension events reuse core event names (XFixes has its own
    // SelectionNotify); trusting the name alone would pack one as the other.
    if (named !== undefined && named !== type) {
      throw new TypeError('packEvent: ' + JSON.stringify(ev.name) + ' is core event ' +
        named + ' but this event has type ' + type +
        ' — extension events are not packed by name');
    }
  } else if (named !== undefined) {
    type = named;
  } else {
    throw new TypeError('packEvent: event needs a name or a numeric type');
  }

  const fn = packers[type];
  if (!fn) {
    throw new TypeError(type === 35
      ? 'packEvent: GenericEvent (35) has no fixed 32-byte form and cannot be sent with SendEvent'
      : 'packEvent: no packer for event type ' + type);
  }

  if (type === 33) {
    // The server rejects any other format with BadValue, and the format
    // decides how it byte-swaps the 20 data bytes for the recipient.
    if (ev.format !== 8 && ev.format !== 16 && ev.format !== 32)
      throw new TypeError('packEvent: ClientMessage format must be 8, 16 or 32, got ' + ev.format);
    const room = ev.format === 32 ? 5 : ev.format === 16 ? 10 : 20;
    if (ev.data && ev.data.length > room) {
      throw new TypeError('packEvent: ClientMessage data holds ' + room + ' values at format ' +
        ev.format + ', got ' + ev.data.length);
    }
  }

  if (buf === undefined) {
    buf = Buffer.alloc(32);
  } else {
    if (!Buffer.isBuffer(buf))
      throw new TypeError('packEvent: target must be a Buffer');
    if (buf.length < 32)
      throw new TypeError('packEvent: target buffer must be at least 32 bytes, got ' + buf.length);
    // Return exactly the event's 32 bytes even when packing into a larger
    // slot, so the result can go straight to SendEvent. Unused bytes must be
    // zero: every convention built on ClientMessage (EWMH, XEmbed, XDND)
    // requires that of the sender.
    buf = buf.length === 32 ? buf : buf.subarray(0, 32);
    buf.fill(0);
  }
  return fn(ev, buf);
}
`;

function main() {
  parseProto((err, { typedefs, events }) => {
    if (err)
      throw err;

    // Generate parsers for events we currently handle in xcore + common ones
    const wanted = [
      'KeyPress', 'KeyRelease', 'ButtonPress', 'ButtonRelease', 'MotionNotify',
      'EnterNotify', 'LeaveNotify', 'FocusIn', 'FocusOut', 'KeymapNotify',
      'Expose', 'GraphicsExposure', 'NoExposure', 'VisibilityNotify',
      'CreateNotify', 'DestroyNotify', 'UnmapNotify', 'MapNotify',
      'MapRequest', 'ReparentNotify', 'ConfigureNotify', 'ConfigureRequest',
      'GravityNotify', 'ResizeRequest', 'CirculateNotify', 'CirculateRequest',
      'PropertyNotify', 'SelectionClear', 'SelectionRequest', 'SelectionNotify',
      'ColormapNotify', 'ClientMessage', 'MappingNotify'
    ];

    // Hand-written pairs: format-dependent body, byte fields inside the
    // header, and the one event with no sequence number.
    const SPECIAL = {
      ClientMessage: genClientMessage,
      MappingNotify: genMappingNotify,
      KeymapNotify: genKeymapNotify
    };

    const parsers = [];
    for (const name of wanted) {
      const ev = events[name];
      if (!ev)
        throw new Error(`missing event ${name}`);

      if (SPECIAL[name]) {
        const p = SPECIAL[name]();
        for (const prop of SPECIAL_PROPS[name]) {
          if (RESERVED_PROPS.has(prop))
            throw new Error(`${name}: field maps to reserved property '${prop}'`);
        }
        parsers.push(p);
        continue;
      }

      const desc = describeEvent(typedefs, ev);
      parsers.push({
        name: desc.name,
        number: desc.number,
        code: emitParser(desc),
        packCode: emitPacker(desc)
      });
    }

    const out = [];
    out.push('// AUTO-GENERATED by autogen/generate-events.js — do not edit by hand.');
    out.push('// Source: autogen/proto/xproto.xml');
    out.push('\'use strict\';');
    out.push('');
    for (const p of parsers) {
      out.push(p.code);
      out.push('');
    }
    for (const p of parsers) {
      out.push(p.packCode);
      out.push('');
    }

    out.push('const parsers = {');
    for (const p of parsers)
      out.push(`  ${p.number}: parse${p.name},`);
    out.push('};');
    out.push('');
    out.push('const packers = {');
    for (const p of parsers)
      out.push(`  ${p.number}: pack${p.name},`);
    out.push('};');
    out.push('');
    out.push('const eventTypes = {');
    for (const p of parsers)
      out.push(`  ${p.name}: ${p.number},`);
    out.push('};');
    out.push('');
    out.push('function unpackEvent(type, seq, extra, code, raw, headerBuf) {');
    out.push('  const t = type & 0x7F;');
    out.push('  const fn = parsers[t];');
    out.push('  if (fn) return fn(t, seq, extra, code, raw, headerBuf);');
    out.push('  return { type: t, seq };');
    out.push('}');
    out.push('');
    out.push(PACK_EVENT.trim());
    out.push('');
    out.push('module.exports = { unpackEvent, parsers, packEvent, packers, eventTypes };');
    out.push('');

    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, out.join('\n'));
    console.log(`wrote ${OUT} (${parsers.length} event parsers + packers)`);
  });
}

main();
