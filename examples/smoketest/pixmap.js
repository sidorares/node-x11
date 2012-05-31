function Pixmap(depth, width, height, buffer)
{
    this.depth = depth;
    this.width = width;
    this.height = height;
    this.data = buffer;    
}

module.exports.Pixmap = Pixmap;