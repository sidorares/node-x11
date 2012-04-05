module.exports = packValueMask

function orderValueMask(a, b) {
  return a[0] < b[0] ? -1
  : a[0] > b[0] ? 1
  : 0
}

function getValue(item) {
  return item[1]
}

function packValueMask(list, values)
{
  var bitmask = 0
    , masksList = []
    , v
    , valueBit
    , args

  for (var v in values) {
    valueBit = list[v]
    if (valueBit == null) throw new Error(': incorrect value param ' + v);
    masksList.push([valueBit, values[v]]);
    bitmask |= valueBit;
  }
  args = masksList.sort(orderValueMask).map(getValue);
  return [bitmask, args]
}

