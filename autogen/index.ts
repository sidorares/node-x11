import { parse } from "./parse";
import { CodeGenerator } from "./codegen";

async function main() {
  const parsed = await parse("./proto/xproto.xml");
  await new CodeGenerator(parsed).generate();
}

main()
  .then(() => {
    console.log("done");
  })
  .catch(console.error);
