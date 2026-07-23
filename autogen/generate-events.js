'use strict';

/**
 * Generate core X11 event parsers from autogen/proto/xproto.xml.
 * Output: lib/generated/core-events.js
 *
 * Wire layout (32 bytes): type(1), detail/pad(1), seq(2), extra(4), body(24).
 * Parsers receive (type, seq, extra, code, raw) where raw is the 24-byte body.
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
  MappingNotify: { first_keycode: 'firstKeyCode' }
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
 * Emit a parser function body for one event.
 * Returns { lines, usesHeaderBuf } or null if unsupported (KeymapNotify lists, etc.).
 */
function genEventParser(typedefs, ev) {
  // Special-case ClientMessage (format-dependent data) and MappingNotify / KeymapNotify
  if (ev.name === 'KeymapNotify')
    return null;
  if (ev.name === 'ClientMessage')
    return genClientMessage();
  if (ev.name === 'MappingNotify')
    return genMappingNotify();

  const lines = [];
  lines.push(`function parse${ev.name}(type, seq, extra, code, raw, headerBuf) {`);
  lines.push('  const event = { type: type & 0x7F, seq, name: \'' + ev.name + '\' };');

  // Walk wire offsets: after type byte at 0. seq at 2..3. Body fields relative to full packet.
  let wire = 1;
  let assignedDetail = false;
  let assignedExtra = false;

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

    if (f.kind === 'list') {
      lines.push(`  // list ${f.name} not auto-generated`);
      continue;
    }

    const sz = fieldSize(typedefs, f);
    const prop = jsName(ev.name, f.name);

    // Align past sequence number if we're about to write into 2..3
    if (wire === 2) {
      wire = 4;
    }
    if (wire > 2 && wire < 4) {
      wire = 4;
    }

    if (wire === 1 && sz === 1) {
      // detail / first byte → code
      if (prop !== 'keycode' && prop !== 'detail' && prop !== 'stackMode') {
        lines.push(`  event.${prop} = code;`);
      } else {
        lines.push(`  event.${prop} = code;`);
      }
      assignedDetail = true;
      wire = 2;
      continue;
    }

    if (wire === 4 && sz === 4) {
      lines.push(`  event.${prop} = extra;`);
      assignedExtra = true;
      wire = 8;
      continue;
    }

    if (wire < 8) {
      // shouldn't happen for well-formed core events
      lines.push(`  // unexpected wire offset ${wire} for ${f.name}`);
      wire += sz;
      continue;
    }

    const rawOff = wire - 8;
    let expr = readExpr(typedefs, f, 'raw', rawOff);
    if (f.type === 'BOOL' || prop === 'overrideRedirect' || prop === 'fromConfigure') {
      // ConfigureNotify historically left overrideRedirect as 0/1 number
      if (ev.name !== 'ConfigureNotify' && (prop === 'overrideRedirect' || prop === 'fromConfigure'))
        expr = `!!${expr}`;
    }
    lines.push(`  event.${prop} = ${expr};`);
    wire += sz;
  }

  // EnterNotify legacy values[] array
  if (ev.name === 'EnterNotify' || ev.name === 'LeaveNotify') {
    lines.push('  event.values = [event.root, event.wid, event.child, event.rootx, event.rooty, event.x, event.y, event.buttons, event.mode];');
  }

  lines.push('  return event;');
  lines.push('}');
  return { name: ev.name, number: ev.number, code: lines.join('\n'), assignedDetail, assignedExtra };
}

function genClientMessage() {
  const lines = [];
  lines.push('function parseClientMessage(type, seq, extra, code, raw, headerBuf) {');
  lines.push('  const event = { type: type & 0x7F, seq, name: \'ClientMessage\' };');
  lines.push('  event.format = code;');
  lines.push('  event.wid = extra;');
  lines.push('  event.message_type = raw.readUInt32LE(0);');
  lines.push('  const data = [];');
  lines.push('  if (code === 32) {');
  lines.push('    for (let i = 0; i < 5; i++) data.push(raw.readUInt32LE(4 + i * 4));');
  lines.push('  } else if (code === 16) {');
  lines.push('    for (let i = 0; i < 10; i++) data.push(raw.readUInt16LE(4 + i * 2));');
  lines.push('  } else {');
  lines.push('    for (let i = 0; i < 20; i++) data.push(raw.readUInt8(4 + i));');
  lines.push('  }');
  lines.push('  event.data = data;');
  lines.push('  return event;');
  lines.push('}');
  return { name: 'ClientMessage', number: 33, code: lines.join('\n') };
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
  return { name: 'MappingNotify', number: 34, code: lines.join('\n') };
}

function main() {
  parseProto((err, { typedefs, events }) => {
    if (err)
      throw err;

    // Generate parsers for events we currently handle in xcore + common ones
    const wanted = [
      'KeyPress', 'KeyRelease', 'ButtonPress', 'ButtonRelease', 'MotionNotify',
      'EnterNotify', 'LeaveNotify', 'FocusIn', 'FocusOut',
      'Expose', 'CreateNotify', 'DestroyNotify', 'UnmapNotify', 'MapNotify',
      'MapRequest', 'ConfigureNotify', 'ConfigureRequest',
      'PropertyNotify', 'SelectionClear', 'SelectionRequest', 'SelectionNotify',
      'ClientMessage', 'MappingNotify'
    ];

    const parsers = [];
    for (const name of wanted) {
      const ev = events[name];
      if (!ev)
        throw new Error(`missing event ${name}`);
      const p = genEventParser(typedefs, ev);
      if (!p)
        continue;
      parsers.push(p);
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

    out.push('const parsers = {');
    for (const p of parsers)
      out.push(`  ${p.number}: parse${p.name},`);
    out.push('};');
    out.push('');
    out.push('function unpackEvent(type, seq, extra, code, raw, headerBuf) {');
    out.push('  const t = type & 0x7F;');
    out.push('  const fn = parsers[t];');
    out.push('  if (fn) return fn(t, seq, extra, code, raw, headerBuf);');
    out.push('  return { type: t, seq };');
    out.push('}');
    out.push('');
    out.push('module.exports = { unpackEvent, parsers };');
    out.push('');

    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, out.join('\n'));
    console.log(`wrote ${OUT} (${parsers.length} event parsers)`);
  });
}

main();
