import { mockTranslate, translate } from "../src/index.js";

const req = {
  sourceLang: "auto",
  targetLang: "zh-CN",
  segments: [
    { id: "p1", text: "Hello world" },
    { id: "p2", text: "Immersive translate" },
  ],
};

const viaMock = await mockTranslate(req);
const viaDefault = await translate(req);

const ok =
  viaMock.segments[0].text === "⟦Hello world⟧" &&
  viaMock.segments[1].id === "p2" &&
  viaDefault.segments[0].text === viaMock.segments[0].text;

console.log(JSON.stringify(viaMock, null, 2));
if (!ok) {
  console.error("smoke failed: unexpected mock output");
  process.exit(1);
}
console.log("smoke ok: batch mockTranslate / translate");
