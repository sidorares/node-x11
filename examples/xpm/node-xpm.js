/* Extracted from https://github.com/klepthys/node-xpm
 * This code is available as a standalone module named xpm
/*
The MIT License (MIT)

Copyright (c) 2015 Sebastien Dumetz

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
  */

const fs = require('fs');


function PixmapFromFile (path,options){
  if(!options && typeof path == "object"){
    this.options = path;
    path = null;
  }else{
    this.options = options||{};
  }
  if(path){
    return this.parse(fs.readFileSync(path, {encoding:"utf-8"}));
  }
}
/**
 *
 * @param  {[type]}   data     utf-8 file data
 * @param  {Function} callback optionnal callback.
 */
PixmapFromFile.prototype.parse = function (data) {
  if(!/^\/\*\s*XPM\s*\*\/$/m.test(data)){
    throw new Error("Not an XPM file");
  }
  const size = this.getSize(data);
  const content = this.getArray(data,size);
  const colors = this.mapColors(data,size);
  size.data = this.toBuffer(colors,content,size);
  return size;
};
PixmapFromFile.prototype.getSize = data => {
  const match = /{\n?"([0-9\s]*)\s?"/.exec(data);
  if(!match){
    throw new Error("can't parse size infos");
  }
  const values = match[1].split(" ").map(i => parseInt(i));
  return {width:values[0],height:values[1],count:values[2],length:values[3]}
}

PixmapFromFile.prototype.getArray = (data, size) => {
  //var reg = new RegExp('"((?!(?:[0-9]+\\s?){4}).{'+size.length+'}(?!\\sc\\s).*)"',"g"); //Works also but much less simple
  const reg = new RegExp(`"(.{${size.width*size.length}})"`,"g");
  let res;
  const rows = [];
  while((res = reg.exec(data)) !== null){
    rows.push(res[1]);
  }
  if(rows.length != size.height){
    throw new Error(`found : ${rows.length} rows. Should have found :${size.height} rows.`);
  }
  return rows;
}
// return RGBA color
PixmapFromFile.prototype.mapColors = (content, size) => {
  const reg = new RegExp(`"(.${(size.length > 1)? `{${size.length}}` : ""})\\s+c\\s+#?(None|[0-9a-fA-F]{6})"`,"gm");
  let res;
  const colors = {};
  while((res = reg.exec(content)) !== null){
    if(res[2] === "None"){
      colors[res[1]] = "00000000"
    }else{
        colors[res[1]] = `${res[2]}FF`;//RGBA
    }

  }
  if(Object.keys(colors).length != size.count){
    throw new Error(`found : ${Object.keys(colors).length} colors. Should have found :${size.count} colors.`);
  }
  return colors;
}

PixmapFromFile.prototype.toBuffer = function (colors,content,size) {
  const buf = Buffer.alloc(size.width*size.height*4);
  let offset = 0, byte, color;
  let copy;
  if( !this.options.format || this.options.format.toUpperCase() === "BGRA"){
    copy = this.copyBGRABuffer;
  }else if(this.options.format && this.options.format.toUpperCase() === "RGBA"){
    copy = this.copyRGBABuffer;
  }else{
    throw new Error("invalid format option : ",this.options.format," valid values are BGRA (default) or RGBA")
  }
  content.forEach(row => {
    //console.log("parsing : ",row)
    while(row && row.length >0){
      const code = row.slice(0,size.length);
      row = row.slice(size.length);
      if(!colors[code]){
        throw new Error("unknown color : ",code);
      }
      offset = copy(buf,offset,colors[code]);;
    }
  });
  return buf;
};

/**
 * Takes an array of rows. Each char/sequence represents a colored pixel
 * @param  {[type]} content [description]
 * @return {Buffer}         A 1d array of pixels in RGBA
 */
PixmapFromFile.prototype.copyBGRABuffer = (buf, offset, color) => {
  [4,2,0,6].forEach(i => {
    buf.writeUInt8(parseInt(color[i]+color[i+1],16),offset);
    offset ++;
  });
  return offset;
}
PixmapFromFile.prototype.copyRGBABuffer = (buf, offset, color) => {
  buf.writeUInt32BE(parseInt(color,16),offset);
  return offset+4;
}
PixmapFromFile.prototype.open = function(path,callback){
  const self = this;
  fs.readFile(path, {encoding:"utf-8"}, (err, data) => {
    if(err){
      return callback(err);
    }else{
      callback(null,self.parse(data));
    }
  });


}

module.exports = PixmapFromFile;
