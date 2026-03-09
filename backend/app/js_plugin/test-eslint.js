const { ESLint } = require("eslint");

async function main() {
  const eslint = new ESLint();
  const results = await eslint.lintText("const x = 1;", { filePath: "temp.js" });
  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);
