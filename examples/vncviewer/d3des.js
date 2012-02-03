/*
  d3des.c translated to JavaScript 
  Andrey Sidorov <andrey.sidorov@gmail.com>
*/

/* D3DES (V5.09) -
 *
 * A portable, public domain, version of the Data Encryption Standard.
 *
 * Written with Symantec's THINK (Lightspeed) C by Richard Outerbridge.
 * Thanks to: Dan Hoey for his excellent Initial and Inverse permutation
 * code;  Jim Gillogly & Phil Karn for the DES key schedule code; Dennis
 * Ferguson, Eric Young and Dana How for comparing notes; and Ray Lau,
 * for humouring me on.
 *
 * Copyright (c) 1988,1989,1990,1991,1992 by Richard Outerbridge.
 * (GEnie : OUTER; CIS : [71755,204]) Graven Imagery, 1992.
 */

/* D2_DES and D3_DES code removed, by Constantin Kaplinsky */

var KnL = new Array(32);
var EN0 = 0;
var DE1 = 1; 

/* The following array is reversed for VNC compatibility,
   by Constantin Kaplinsky */

var bytebit = [01, 02, 04, 010, 020, 040, 0100, 0200];

var bigbyte = [
	0x800000,	0x400000,	0x200000,	0x100000,
	0x80000,	0x40000,	0x20000,	0x10000,
	0x8000,	0x4000,	0x2000,	0x1000,
	0x800, 	0x400, 	0x200, 	0x100,
	0x80,		0x40,		0x20,		0x10,
	0x8,		0x4,		0x2,		0x1	];

/* Use the key schedule specified in the Standard (ANSI X3.92-1981). */

var pc1 = [
	56, 48, 40, 32, 24, 16,  8,	 0, 57, 49, 41, 33, 25, 17,
	 9,  1, 58, 50, 42, 34, 26,	18, 10,  2, 59, 51, 43, 35,
	62, 54, 46, 38, 30, 22, 14,	 6, 61, 53, 45, 37, 29, 21,
	13,  5, 60, 52, 44, 36, 28,	20, 12,  4, 27, 19, 11,  3 ];

var totrot = [
	1,2,4,6,8,10,12,14,15,17,19,21,23,25,27,28 ];

var pc2 = [
	13, 16, 10, 23,  0,  4,  2, 27, 14,  5, 20,  9,
	22, 18, 11,  3, 25,  7, 15,  6, 26, 19, 12,  1,
	40, 51, 30, 36, 46, 54, 29, 39, 50, 44, 32, 47,
	43, 48, 38, 55, 33, 52, 45, 41, 49, 35, 28, 31 ];

function deskey(key, edf)
{
	var i, j, l, m, n;
        var pc1m = new Buffer(56);
        var pcr = new Buffer(56);
	var kn = new Array(32);

	for ( j = 0; j < 56; j++ ) {
		l = pc1[j];
		m = l & 07;
		pc1m[j] = (key[l >>> 3] & bytebit[m]) ? 1 : 0;
		}

	for( i = 0; i < 16; i++ ) {
            
		if( edf == DE1 ) m = (15 - i) << 1;
		else m = i << 1;


		n = m + 1;
		kn[m] = kn[n] = 0;
		for( j = 0; j < 28; j++ ) {
			l = j + totrot[i];
			if( l < 28 ) pcr[j] = pc1m[l];
			else pcr[j] = pc1m[l - 28];
			}
		for( j = 28; j < 56; j++ ) {
		    l = j + totrot[i];
		    if( l < 56 ) pcr[j] = pc1m[l];
		    else pcr[j] = pc1m[l - 28];
		    }
		for( j = 0; j < 24; j++ ) {
			if( pcr[pc2[j]] ) kn[m] |= bigbyte[j];
			if( pcr[pc2[j+24]] ) kn[n] |= bigbyte[j];
			}
		}
	cookey(kn);
	return;
}


function cookey(_raw1)
{
        var raw1 = 0;
	var cook, raw0;
	var i;

	cook = 0;
	for( i = 0; i < 16; i++, raw1++ ) {
		raw0 = raw1++;
		KnL[cook] = (_raw1[raw0] & 0x00fc0000) << 6;
		KnL[cook]	|= (_raw1[raw0] & 0x00000fc0) << 10;
		KnL[cook]	|= (_raw1[raw1] & 0x00fc0000) >>> 10;
		KnL[cook++] |= (_raw1[raw1] & 0x00000fc0) >>> 6;
		KnL[cook]	 = (_raw1[raw0] & 0x0003f000) << 12;
		KnL[cook]	|= (_raw1[raw0] & 0x0000003f) << 16;
		KnL[cook]	|= (_raw1[raw1] & 0x0003f000) >>> 4;
		KnL[cook++] |= (_raw1[raw1] & 0x0000003f);
		}
	return;
	}

function des(inblock, outblock)
{
	var work = new Array(2);
	scrunch(inblock, work);
	desfunc(work, KnL);
	unscrun(work, outblock);
	return;
}

function scrunch(outof, into)
{
        into[0] = 0;
        into[1] = 0;

	into[0]	 = (outof[0] & 0xff) << 24;
	into[0]	|= (outof[1] & 0xff) << 16;
	into[0]	|= (outof[2] & 0xff) << 8;
	into[0] |= (outof[3] & 0xff);
	into[1]	 = (outof[4] & 0xff) << 24;
	into[1]	|= (outof[5] & 0xff) << 16;
	into[1]	|= (outof[6] & 0xff) << 8;
	into[1]	|= (outof[7]   & 0xff);
	
        return;
	}

function unscrun(outof, into)
{
	into[0] = (outof[0] >>> 24) & 0xff;
	into[1] = (outof[0] >>> 16) & 0xff;
	into[2] = (outof[0] >>>  8) & 0xff;
	into[3] =  outof[0]	 & 0xff;
	into[4] = (outof[1] >>> 24) & 0xff;
	into[5] = (outof[1] >>> 16) & 0xff;
	into[6] = (outof[1] >>>  8) & 0xff;
	into[7]	=  outof[1]	 & 0xff;
	return;
	}

var SP1 = [
	0x01010400, 0x00000000, 0x00010000, 0x01010404,
	0x01010004, 0x00010404, 0x00000004, 0x00010000,
	0x00000400, 0x01010400, 0x01010404, 0x00000400,
	0x01000404, 0x01010004, 0x01000000, 0x00000004,
	0x00000404, 0x01000400, 0x01000400, 0x00010400,
	0x00010400, 0x01010000, 0x01010000, 0x01000404,
	0x00010004, 0x01000004, 0x01000004, 0x00010004,
	0x00000000, 0x00000404, 0x00010404, 0x01000000,
	0x00010000, 0x01010404, 0x00000004, 0x01010000,
	0x01010400, 0x01000000, 0x01000000, 0x00000400,
	0x01010004, 0x00010000, 0x00010400, 0x01000004,
	0x00000400, 0x00000004, 0x01000404, 0x00010404,
	0x01010404, 0x00010004, 0x01010000, 0x01000404,
	0x01000004, 0x00000404, 0x00010404, 0x01010400,
	0x00000404, 0x01000400, 0x01000400, 0x00000000,
	0x00010004, 0x00010400, 0x00000000, 0x01010004 ];

var SP2 = [
	0x80108020, 0x80008000, 0x00008000, 0x00108020,
	0x00100000, 0x00000020, 0x80100020, 0x80008020,
	0x80000020, 0x80108020, 0x80108000, 0x80000000,
	0x80008000, 0x00100000, 0x00000020, 0x80100020,
	0x00108000, 0x00100020, 0x80008020, 0x00000000,
	0x80000000, 0x00008000, 0x00108020, 0x80100000,
	0x00100020, 0x80000020, 0x00000000, 0x00108000,
	0x00008020, 0x80108000, 0x80100000, 0x00008020,
	0x00000000, 0x00108020, 0x80100020, 0x00100000,
	0x80008020, 0x80100000, 0x80108000, 0x00008000,
	0x80100000, 0x80008000, 0x00000020, 0x80108020,
	0x00108020, 0x00000020, 0x00008000, 0x80000000,
	0x00008020, 0x80108000, 0x00100000, 0x80000020,
	0x00100020, 0x80008020, 0x80000020, 0x00100020,
	0x00108000, 0x00000000, 0x80008000, 0x00008020,
	0x80000000, 0x80100020, 0x80108020, 0x00108000 ];

var SP3 = [
	0x00000208, 0x08020200, 0x00000000, 0x08020008,
	0x08000200, 0x00000000, 0x00020208, 0x08000200,
	0x00020008, 0x08000008, 0x08000008, 0x00020000,
	0x08020208, 0x00020008, 0x08020000, 0x00000208,
	0x08000000, 0x00000008, 0x08020200, 0x00000200,
	0x00020200, 0x08020000, 0x08020008, 0x00020208,
	0x08000208, 0x00020200, 0x00020000, 0x08000208,
	0x00000008, 0x08020208, 0x00000200, 0x08000000,
	0x08020200, 0x08000000, 0x00020008, 0x00000208,
	0x00020000, 0x08020200, 0x08000200, 0x00000000,
	0x00000200, 0x00020008, 0x08020208, 0x08000200,
	0x08000008, 0x00000200, 0x00000000, 0x08020008,
	0x08000208, 0x00020000, 0x08000000, 0x08020208,
	0x00000008, 0x00020208, 0x00020200, 0x08000008,
	0x08020000, 0x08000208, 0x00000208, 0x08020000,
	0x00020208, 0x00000008, 0x08020008, 0x00020200 ];

var SP4 = [
	0x00802001, 0x00002081, 0x00002081, 0x00000080,
	0x00802080, 0x00800081, 0x00800001, 0x00002001,
	0x00000000, 0x00802000, 0x00802000, 0x00802081,
	0x00000081, 0x00000000, 0x00800080, 0x00800001,
	0x00000001, 0x00002000, 0x00800000, 0x00802001,
	0x00000080, 0x00800000, 0x00002001, 0x00002080,
	0x00800081, 0x00000001, 0x00002080, 0x00800080,
	0x00002000, 0x00802080, 0x00802081, 0x00000081,
	0x00800080, 0x00800001, 0x00802000, 0x00802081,
	0x00000081, 0x00000000, 0x00000000, 0x00802000,
	0x00002080, 0x00800080, 0x00800081, 0x00000001,
	0x00802001, 0x00002081, 0x00002081, 0x00000080,
	0x00802081, 0x00000081, 0x00000001, 0x00002000,
	0x00800001, 0x00002001, 0x00802080, 0x00800081,
	0x00002001, 0x00002080, 0x00800000, 0x00802001,
	0x00000080, 0x00800000, 0x00002000, 0x00802080 ];

var SP5 = [
	0x00000100, 0x02080100, 0x02080000, 0x42000100,
	0x00080000, 0x00000100, 0x40000000, 0x02080000,
	0x40080100, 0x00080000, 0x02000100, 0x40080100,
	0x42000100, 0x42080000, 0x00080100, 0x40000000,
	0x02000000, 0x40080000, 0x40080000, 0x00000000,
	0x40000100, 0x42080100, 0x42080100, 0x02000100,
	0x42080000, 0x40000100, 0x00000000, 0x42000000,
	0x02080100, 0x02000000, 0x42000000, 0x00080100,
	0x00080000, 0x42000100, 0x00000100, 0x02000000,
	0x40000000, 0x02080000, 0x42000100, 0x40080100,
	0x02000100, 0x40000000, 0x42080000, 0x02080100,
	0x40080100, 0x00000100, 0x02000000, 0x42080000,
	0x42080100, 0x00080100, 0x42000000, 0x42080100,
	0x02080000, 0x00000000, 0x40080000, 0x42000000,
	0x00080100, 0x02000100, 0x40000100, 0x00080000,
	0x00000000, 0x40080000, 0x02080100, 0x40000100 ];

var SP6 = [
	0x20000010, 0x20400000, 0x00004000, 0x20404010,
	0x20400000, 0x00000010, 0x20404010, 0x00400000,
	0x20004000, 0x00404010, 0x00400000, 0x20000010,
	0x00400010, 0x20004000, 0x20000000, 0x00004010,
	0x00000000, 0x00400010, 0x20004010, 0x00004000,
	0x00404000, 0x20004010, 0x00000010, 0x20400010,
	0x20400010, 0x00000000, 0x00404010, 0x20404000,
	0x00004010, 0x00404000, 0x20404000, 0x20000000,
	0x20004000, 0x00000010, 0x20400010, 0x00404000,
	0x20404010, 0x00400000, 0x00004010, 0x20000010,
	0x00400000, 0x20004000, 0x20000000, 0x00004010,
	0x20000010, 0x20404010, 0x00404000, 0x20400000,
	0x00404010, 0x20404000, 0x00000000, 0x20400010,
	0x00000010, 0x00004000, 0x20400000, 0x00404010,
	0x00004000, 0x00400010, 0x20004010, 0x00000000,
	0x20404000, 0x20000000, 0x00400010, 0x20004010 ];

var SP7 = [
	0x00200000, 0x04200002, 0x04000802, 0x00000000,
	0x00000800, 0x04000802, 0x00200802, 0x04200800,
	0x04200802, 0x00200000, 0x00000000, 0x04000002,
	0x00000002, 0x04000000, 0x04200002, 0x00000802,
	0x04000800, 0x00200802, 0x00200002, 0x04000800,
	0x04000002, 0x04200000, 0x04200800, 0x00200002,
	0x04200000, 0x00000800, 0x00000802, 0x04200802,
	0x00200800, 0x00000002, 0x04000000, 0x00200800,
	0x04000000, 0x00200800, 0x00200000, 0x04000802,
	0x04000802, 0x04200002, 0x04200002, 0x00000002,
	0x00200002, 0x04000000, 0x04000800, 0x00200000,
	0x04200800, 0x00000802, 0x00200802, 0x04200800,
	0x00000802, 0x04000002, 0x04200802, 0x04200000,
	0x00200800, 0x00000000, 0x00000002, 0x04200802,
	0x00000000, 0x00200802, 0x04200000, 0x00000800,
	0x04000002, 0x04000800, 0x00000800, 0x00200002 ];

var SP8 = [
	0x10001040, 0x00001000, 0x00040000, 0x10041040,
	0x10000000, 0x10001040, 0x00000040, 0x10000000,
	0x00040040, 0x10040000, 0x10041040, 0x00041000,
	0x10041000, 0x00041040, 0x00001000, 0x00000040,
	0x10040000, 0x10000040, 0x10001000, 0x00001040,
	0x00041000, 0x00040040, 0x10040040, 0x10041000,
	0x00001040, 0x00000000, 0x00000000, 0x10040040,
	0x10000040, 0x10001000, 0x00041040, 0x00040000,
	0x00041040, 0x00040000, 0x10041000, 0x00001000,
	0x00000040, 0x10040040, 0x00001000, 0x00041040,
	0x10001000, 0x00000040, 0x10000040, 0x10040000,
	0x10040040, 0x10000000, 0x00040000, 0x10001040,
	0x00000000, 0x10041040, 0x00040040, 0x10000040,
	0x10040000, 0x10001000, 0x10001040, 0x00000000,
	0x10041040, 0x00041000, 0x00041000, 0x00001040,
	0x00001040, 0x00040040, 0x10000000, 0x10041000 ];

function desfunc(block, keys)
{
	var  fval, work, right, leftt;
	var round;

        var keysi=0;

	leftt = block[0];
	right = block[1];

	work = ((leftt >>> 4) ^ right) & 0x0f0f0f0f;
        right ^= work;
	leftt ^= (work << 4);
	work = ((leftt >>> 16) ^ right) & 0x0000ffff;
	right ^= work;
        leftt ^= (work << 16);
	work = ((right >>> 2) ^ leftt) & 0x33333333;
	leftt ^= work;
	right ^= (work << 2);
	work = ((right >>> 8) ^ leftt) & 0x00ff00ff;
	leftt ^= work;
	right ^= (work << 8);
	right = ((right << 1) | ((right >>> 31) & 1)) & 0xffffffff;
	work = (leftt ^ right) & 0xaaaaaaaa;
	leftt ^= work;
	right ^= work;
	leftt = ((leftt << 1) | ((leftt >>> 31) & 1)) & 0xffffffff;

	for( round = 0; round < 8; round++ ) {
		work  = (right << 28) | (right >>> 4);
		work ^= keys[keysi++];
		fval  = SP7[ work &        0x3f];
		fval |= SP5[(work >>>  8) & 0x3f];
		fval |= SP3[(work >>> 16) & 0x3f];
		fval |= SP1[(work >>> 24) & 0x3f];
		work  = right ^ keys[keysi++];
		fval |= SP8[ work		 & 0x3f];
		fval |= SP6[(work >>>  8) & 0x3f];
		fval |= SP4[(work >>> 16) & 0x3f];
		fval |= SP2[(work >>> 24) & 0x3f];
		leftt ^= fval;
		work  = (leftt << 28) | (leftt >>> 4);
		work ^= keys[keysi++];
		fval  = SP7[ work		 & 0x3f];
		fval |= SP5[(work >>>  8) & 0x3f];
		fval |= SP3[(work >>> 16) & 0x3f];
		fval |= SP1[(work >>> 24) & 0x3f];
		work  = leftt ^ keys[keysi++];
		fval |= SP8[ work		 & 0x3f];
		fval |= SP6[(work >>>  8) & 0x3f];
		fval |= SP4[(work >>> 16) & 0x3f];
		fval |= SP2[(work >>> 24) & 0x3f];
		right ^= fval;
		}

	right = (right << 31) | (right >>> 1);
	work = (leftt ^ right) & 0xaaaaaaaa;
	leftt ^= work;
	right ^= work;
	leftt = (leftt << 31) | (leftt >>> 1);
	work = ((leftt >>> 8) ^ right) & 0x00ff00ff;
	right ^= work;
	leftt ^= (work << 8);
	work = ((leftt >>> 2) ^ right) & 0x33333333;
	right ^= work;
	leftt ^= (work << 2);
	work = ((right >>> 16) ^ leftt) & 0x0000ffff;
	leftt ^= work;
	right ^= (work << 16);
	work = ((right >>> 4) ^ leftt) & 0x0f0f0f0f;
	leftt ^= work;
	right ^= (work << 4);
	block[0] = right;
	block[1] = leftt;
	return;
	}

/* Validation sets:
 *
 * Single-length key, single-length plaintext -
 * Key	  : 0123 4567 89ab cdef
 * Plain  : 0123 4567 89ab cde7
 * Cipher : c957 4425 6a5e d31d
 *
 * d3des V5.0a rwo 9208.07 18:44 Graven Imagery
 **********************************************************************/


module.exports.response = function(challenge, password)
{
    var key = new Buffer(8);
    key.fill(0);
    key.write(password.substring(0,8));
    var in1 = challenge.slice(0,8);
    var in2 = challenge.slice(8,16);
    var res1 = new Buffer(8);
    var res2 = new Buffer(8);
    deskey(key, EN0);
    des(in1, res1);
    des(in2, res2);
    var resp = new Buffer(16);
    res1.copy(resp);
    res2.copy(resp, 8);
    return resp;
}

// TODO switch to libssl-based 3DES provided by node crypto module
// the code below does not work atm

/*
// array to flip bits in byte
var flip = [ 0, 128, 64, 192, 32, 160, 96, 224, 16, 144, 80, 208, 48, 176, 112, 240,
             8, 136, 72, 200, 40, 168, 104, 232, 24, 152, 88, 216, 56, 184, 120, 248,
             4, 132, 68, 196, 36, 164, 100, 228, 20, 148, 84, 212, 52, 180, 116, 244,
             12, 140, 76, 204, 44, 172, 108, 236, 28, 156, 92, 220, 60, 188, 124, 252,
             2,  130, 66, 194, 34, 162, 98,  226, 18, 146, 82, 210, 50, 178, 114, 242,
             10, 138, 74, 202, 42, 170, 106, 234, 26, 154, 90, 218, 58, 186, 122, 250,
              6, 134, 70, 198, 38, 166, 102, 230, 22, 150, 86, 214, 54, 182, 118, 246,
             14, 142, 78, 206, 46, 174, 110, 238, 30, 158, 94, 222, 62, 190, 126, 254,
              1, 129, 65, 193, 33, 161, 97, 225, 17, 145, 81, 209, 49, 177, 113, 241,
              9, 137, 73, 201, 41, 169, 105, 233, 25, 153, 89, 217, 57, 185, 121, 249,
              5, 133, 69, 197, 37, 165, 101, 229, 21, 149, 85, 213, 53, 181, 117, 245,
             13, 141, 77, 205, 45, 173, 109, 237, 29, 157, 93, 221, 61, 189, 125, 253,
              3, 131, 67, 195, 35, 163, 99, 227, 19, 147, 83, 211, 51, 179, 115, 243,
             11, 139, 75, 203, 43, 171, 107, 235, 27, 155, 91, 219, 59, 187, 123, 251,
              7, 135, 71, 199, 39, 167, 103, 231, 23, 151, 87, 215, 55, 183, 119, 247,
             15, 143, 79, 207, 47, 175, 111, 239, 31, 159, 95, 223, 63, 191, 127, 255 ];

*/
        /* =========

           from rfb protocol spec, responce = DES(challenge, password).

           In reality (from http://bytecrafter.blogspot.com/2010/09/des-encryption-as-used-in-vnc.html)

           1) DES is used in ECB mode.
           2) The ECB Key is based upon an ASCII password. 
              The key must be 8 bytes long. The password is either 
              truncated to 8 bytes, or else zeros are added to the end
              to bring it up to 8 bytes. As an additional twist, each byte 
              in flipped. So, if the ASCII password was "pword" [0x 70 77 6F 72 64],
              the resulting key would be [0x 0E EE F6 4E 26 00 00 00].
           3) The VNC Authentication scheme sends a 16 byte challenge. This challenge 
              should be encrypted with the key that was just described, but DES in ECB
              mode can only encrypt an 8 byte message. So, the challenge is split 
              into two messages, encrypted separately, and then jammed back together.

           =========
        *
/
            /*
            var crypto = require('crypto');

            // prepare password
            var passwd = '';
            for (var i=0; i < 8; ++i)
            {
                if (i < cli.params.password.length)
                    passwd += String.fromCharCode(flip[cli.params.password.charCodeAt(i)]);
                else
                    passwd += String.fromCharCode(0);
            }

            var des1 = crypto.createCipher('DES-ECB', passwd);
            var response1 = des1.update(challenge.slice(0, 8), 'binary');
            var des2 = crypto.createCipher('DES-ECB', passwd);
            var response2 = des1.update(challenge.slice(8,16), 'binary');
            var response = response1 + response2;

            console.log(['response = ', response]);
            */
