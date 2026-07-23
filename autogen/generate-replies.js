'use strict';

/**
 * Generate selected core + extension reply unpackers from xcb-proto XML.
 * Output:
 *   lib/generated/core-replies.js
 *   lib/generated/dpms.js
 */

const fs = require('fs');
const path = require('path');
const sax = require('sax');

const PROTO_DIR = path.join(__dirname, 'proto');
const OUT_DIR = path.join(__dirname, '..', 'lib', 'generated');

const TYPE_SIZE = {
  BOOL: 1, BYTE: 1, CARD8: 1, INT8: 1,
  CARD16: 2, INT16: 2,
  CARD32: 4, INT32: 4, TIMESTAMP: 4, WINDOW: 4, DRAWABLE: 4, ATOM: 4,
  COLORMAP: 4, PIXMAP: 4, CURSOR: 4, FONT: 4, GCONTEXT: 4, VISUALID: 4
};

const TYPE_READ = {
  BOOL: 'readUInt8', BYTE: 'readUInt8', CARD8: 'readUInt8', INT8: 'readInt8',
  CARD16: 'readUInt16LE', INT16: 'readInt16LE',
  CARD32: 'readUInt32LE', INT32: 'readInt32LE',
  TIMESTAMP: 'readUInt32LE', WINDOW: 'readUInt32LE', DRAWABLE: 'readUInt32LE',
  ATOM: 'readUInt32LE', COLORMAP: 'readUInt32LE', PIXMAP: 'readUInt32LE',
  CURSOR: 'readUInt32LE', FONT: 'readUInt32LE', GCONTEXT: 'readUInt32LE',
  VISUALID: 'readUInt32LE'
};

/** Reply field aliases to match existing corereqs / ext APIs. */
const REPLY_ALIASES = {
  GetWindowAttributes: {
    backing_store: 'backingStore',
    class: 'klass',
    bit_gravity: 'bitGravity',
    win_gravity: 'winGravity',
    backing_planes: 'backingPlanes',
    backing_pixel: 'backingPixel',
    save_under: 'saveUnder',
    map_is_installed: 'mapIsInstalled',
    map_state: 'mapState',
    override_redirect: 'overrideRedirect',
    all_event_masks: 'allEventMasks',
    your_event_mask: 'myEventMasks',
    do_not_propagate_mask: 'doNotPropogateMask'
  },
  QueryPointer: {
    root_x: 'rootX', root_y: 'rootY',
    win_x: 'childX', win_y: 'childY',
    mask: 'keyMask', same_screen: 'sameScreen'
  },
  GetGeometry: {
    root: 'windowid', x: 'xPos', y: 'yPos',
    border_width: 'borderWidth'
  },
  QueryExtension: {
    major_opcode: 'majorOpcode',
    first_event: 'firstEvent',
    first_error: 'firstError'
  },
  GetInputFocus: { revert_to: 'revertTo' },
  TranslateCoordinates: {
    same_screen: 'sameScreen',
    dst_x: 'destX',
    dst_y: 'destY'
  }
};

function camel(name) {
  return name.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function jsField(reqName, xmlName) {
  const map = REPLY_ALIASES[reqName] || {};
  if (map[xmlName])
    return map[xmlName];
  return camel(xmlName);
}

function parseFile(file, cb) {
  const typedefs = {};
  const requests = {};
  let current = null;
  let inReply = false;
  let inDoc = false;

  const parser = sax.createStream(true);
  fs.createReadStream(file).pipe(parser);

  parser.on('opentag', tag => {
    if (tag.name === 'doc') { inDoc = true; return; }
    if (inDoc) return;

    if (tag.name === 'typedef') {
      typedefs[tag.attributes.newname] = tag.attributes.oldname;
      return;
    }
    if (tag.name === 'xidtype' || tag.name === 'xidunion') {
      typedefs[tag.attributes.name] = 'CARD32';
      return;
    }
    if (tag.name === 'request') {
      current = {
        name: tag.attributes.name,
        opcode: parseInt(tag.attributes.opcode, 10),
        reply: []
      };
      inReply = false;
      return;
    }
    if (tag.name === 'reply') {
      inReply = true;
      return;
    }
    if (!current || !inReply) return;
    if (tag.name === 'field') {
      current.reply.push({ kind: 'field', name: tag.attributes.name, type: tag.attributes.type });
    } else if (tag.name === 'pad') {
      current.reply.push({ kind: 'pad', bytes: parseInt(tag.attributes.bytes, 10) });
    } else if (tag.name === 'list') {
      current.reply.push({ kind: 'list', name: tag.attributes.name, type: tag.attributes.type });
    }
  });

  parser.on('closetag', name => {
    if (name === 'doc') { inDoc = false; return; }
    if (name === 'reply') { inReply = false; return; }
    if (name === 'request' && current) {
      if (current.reply.length)
        requests[current.name] = current;
      current = null;
    }
  });

  parser.on('end', () => cb(null, { typedefs, requests }));
}

function resolve(typedefs, name) {
  while (typedefs[name]) name = typedefs[name];
  return name;
}

/**
 * Reply wire layout after the 8-byte header is already consumed by the client:
 *   header: type=1, detail (often first CARD8 of reply), seq, length
 *   body buf starts at what was byte 8 of the reply.
 * First reply field if CARD8/BOOL/BYTE was in header detail → passed as opt_data.
 */
function genReplyFn(typedefs, req) {
  const fields = req.reply;
  const lines = [];
  const fnName = `unpack${req.name}`;

  // Detect header detail field
  let start = 0;
  let detailName = null;
  if (fields[0] && fields[0].kind === 'field') {
    const t = resolve(typedefs, fields[0].type);
    if (TYPE_SIZE[t] === 1) {
      detailName = jsField(req.name, fields[0].name);
      start = 1;
    }
  } else if (fields[0] && fields[0].kind === 'pad') {
    start = 1; // pad was in detail byte
  }

  const params = detailName ? '(buf, ' + detailName + ')' : '(buf)';
  lines.push(`function ${fnName}${params} {`);
  lines.push('  const result = {};');
  if (detailName)
    lines.push(`  result.${detailName} = ${detailName};`);

  // Body buffer offset 0 == wire offset 8.
  // Sequence was at 2..3; length at 4..7 of full reply — already stripped.
  // Remaining reply fields after the first byte start at full-wire offset 8.
  let wire = 8;
  for (let i = start; i < fields.length; i++) {
    const f = fields[i];
    if (f.kind === 'pad') {
      wire += f.bytes;
      continue;
    }
    if (f.kind === 'list') {
      lines.push(`  // list ${f.name}: not auto-generated`);
      continue;
    }
    const t = resolve(typedefs, f.type);
    const sz = TYPE_SIZE[t];
    const method = TYPE_READ[t];
    if (!sz || !method) {
      lines.push(`  // unsupported type ${f.type}`);
      continue;
    }
    const prop = jsField(req.name, f.name);
    const off = wire - 8;
    lines.push(`  result.${prop} = buf.${method}(${off});`);
    wire += sz;
  }
  lines.push('  return result;');
  lines.push('}');
  return { name: req.name, fnName, code: lines.join('\n'), detailName };
}

function writeModule(filename, exportsMap, parsers) {
  const out = [];
  out.push('// AUTO-GENERATED by autogen/generate-replies.js — do not edit by hand.');
  out.push('\'use strict\';');
  out.push('');
  for (const p of parsers) {
    out.push(p.code);
    out.push('');
  }
  out.push('module.exports = {');
  for (const [key, fn] of Object.entries(exportsMap))
    out.push(`  ${key}: ${fn},`);
  out.push('};');
  out.push('');
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const dest = path.join(OUT_DIR, filename);
  fs.writeFileSync(dest, out.join('\n'));
  console.log(`wrote ${dest}`);
}

function main() {
  parseFile(path.join(PROTO_DIR, 'xproto.xml'), (err, core) => {
    if (err) throw err;

    const coreWanted = [
      'GetWindowAttributes',
      'QueryPointer',
      'GetGeometry',
      'QueryExtension',
      'GetInputFocus',
      'TranslateCoordinates'
    ];

    const coreParsers = [];
    const coreExports = {};
    for (const name of coreWanted) {
      const req = core.requests[name];
      if (!req) throw new Error('missing ' + name);
      // Skip replies with lists for now (none of these have lists in simple form)
      const hasList = req.reply.some(f => f.kind === 'list');
      if (hasList) {
        console.warn('skip', name, '(has list)');
        continue;
      }
      const p = genReplyFn(core.typedefs, req);
      coreParsers.push(p);
      coreExports[name] = p.fnName;
    }
    writeModule('core-replies.js', coreExports, coreParsers);

    parseFile(path.join(PROTO_DIR, 'dpms.xml'), (err2, dpms) => {
      if (err2) throw err2;
      const dpmsWanted = ['GetVersion', 'Capable', 'GetTimeouts', 'Info'];
      // DPMS request names in XML may differ — list what's available
      const dpmsParsers = [];
      const dpmsExports = {};
      for (const name of Object.keys(dpms.requests)) {
        if (!dpmsWanted.includes(name) && !name.startsWith('Get') && name !== 'Capable' && name !== 'Info')
          continue;
        if (!dpmsWanted.includes(name))
          continue;
        const req = dpms.requests[name];
        if (req.reply.some(f => f.kind === 'list')) continue;
        // Prefix to avoid collisions
        const tagged = Object.assign({}, req, { name: 'DPMS' + name });
        const p = genReplyFn(dpms.typedefs, tagged);
        // Keep export name without DPMS prefix for ext usage
        p.fnName = `unpack${name}`;
        p.code = p.code.replace(`unpackDPMS${name}`, `unpack${name}`);
        dpmsParsers.push(p);
        dpmsExports[name] = p.fnName;
      }
      writeModule('dpms-replies.js', dpmsExports, dpmsParsers);
    });
  });
}

main();
