function padded_length(len: number) {
  return ((len + 3) >> 2) << 2;
}

function padded_string(str: string) {
  if (str.length === 0) return "";
  const dst = Buffer.alloc(padded_length(str.length));
  const src = Buffer.from(str);
  src.copy(dst);
  return dst.toString();
}

export { padded_length, padded_string };
