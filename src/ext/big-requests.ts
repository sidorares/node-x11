interface Extension {
  present: boolean;
  majorOpcode: number;
  Enable: (cb: (result: number) => void) => void;
}

export function requireExt(
  display: any,
  callback: (err: Error | null, ext?: Extension) => void,
) {
  const X: any = display.client;
  X.QueryExtension(
    "BIG-REQUESTS",
    function (err: Error | null, ext: Extension) {
      if (!ext.present) return callback(new Error("extension not available"));

      ext.Enable = function (cb: (result: number) => void) {
        X.seq_num++;
        X.pack_stream.pack("CCS", [ext.majorOpcode, 0, 1]);
        X.replies[X.seq_num] = [
          function (buf: Buffer, opt: any) {
            return buf.unpack("L")[0];
          },
          cb,
        ];
        X.pack_stream.flush();
      };
      callback(null, ext);
    },
  );
}
