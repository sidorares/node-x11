// GL render-command encoding. Unit-level: the pipeline is driven with a fake
// GLX object, so no server and no display are involved.
//
// The *fv commands are variable length — the float count is fixed by the
// pname, and a real X server answers BadLength on the whole GLX request when
// the command does not match (glLightfv(GL_SPOT_CUTOFF) carries one float,
// not four). That made spot lights and light attenuation unusable.
const should = require('should');
const renderPipeline = require('../lib/ext/glxrender');

function pipeline() {
    const commands = [];
    const glx = {
        Render(ctx, buffers) {
            commands.push(...buffers);
        }
    };
    for (const name of ['NewList', 'EndList', 'DeleteLists', 'GenLists',
        'GenTextures', 'DeleteTextures', 'IsTexture', 'SwapBuffers', 'Finish',
        'Flush'])
        glx[name] = () => {};
    return { gl: renderPipeline(glx, 1), commands };
}

// [length, opcode] of every command emitted by `draw`
function encode(draw) {
    const { gl, commands } = pipeline();
    draw(gl);
    gl.Render();
    return commands.map(b => [b.readUInt16LE(0), b.readUInt16LE(2)]);
}

describe('GLX render command encoding', function() {
    it('sizes glLightfv by its pname', function() {
        const { gl } = pipeline();
        encode(g => g.Lightfv(gl.LIGHT0, gl.POSITION, [1, 2, 3, 1]))
            .should.eql([[28, 87]]);
        encode(g => g.Lightfv(gl.LIGHT0, gl.DIFFUSE, [1, 1, 1, 1]))
            .should.eql([[28, 87]]);
        encode(g => g.Lightfv(gl.LIGHT0, gl.SPOT_DIRECTION, 0, -1, 0, 0))
            .should.eql([[24, 87]]);
        for (const pname of ['SPOT_CUTOFF', 'SPOT_EXPONENT',
            'CONSTANT_ATTENUATION', 'LINEAR_ATTENUATION',
            'QUADRATIC_ATTENUATION'])
            encode(g => g.Lightfv(gl.LIGHT0, gl[pname], 25, 0, 0, 0))
                .should.eql([[16, 87]], pname);
    });

    it('sizes glMaterialfv by its pname', function() {
        const { gl } = pipeline();
        encode(g => g.Materialfv(gl.FRONT_AND_BACK, gl.AMBIENT_AND_DIFFUSE,
            [0.1, 0.2, 0.3, 1])).should.eql([[28, 97]]);
        encode(g => g.Materialfv(gl.FRONT_AND_BACK, gl.SHININESS, 40))
            .should.eql([[16, 97]]);
        // the scalar entry point keeps its own opcode
        encode(g => g.Materialf(gl.FRONT_AND_BACK, gl.SHININESS, 40))
            .should.eql([[16, 96]]);
    });

    it('writes the values it was given, array or varargs', function() {
        const { gl, commands } = pipeline();
        gl.Lightfv(gl.LIGHT0, gl.POSITION, [4, 5, 6, 1]);
        gl.Lightfv(gl.LIGHT0, gl.SPOT_CUTOFF, 25, 0, 0, 0);
        gl.Render();

        const position = commands[0];
        position.readUInt32LE(4).should.equal(gl.LIGHT0);
        position.readUInt32LE(8).should.equal(gl.POSITION);
        [12, 16, 20, 24].map(o => position.readFloatLE(o))
            .should.eql([4, 5, 6, 1]);

        const cutoff = commands[1];
        cutoff.readUInt32LE(8).should.equal(gl.SPOT_CUTOFF);
        cutoff.readFloatLE(12).should.equal(25);
        cutoff.length.should.equal(16);
    });

    it('keeps every command a whole number of 4-byte words', function() {
        const { gl, commands } = pipeline();
        gl.Lightfv(gl.LIGHT0, gl.SPOT_DIRECTION, 0, -1, 0, 0);
        gl.Materialfv(gl.FRONT_AND_BACK, gl.SHININESS, 40);
        gl.Render();
        for (const command of commands)
            (command.length % 4).should.equal(0);
    });
});
