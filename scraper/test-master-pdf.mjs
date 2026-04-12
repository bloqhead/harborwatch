#!/usr/bin/env node
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("./node_modules/pdf-parse/lib/pdf-parse.js");

const url = 'https://claalaska.com/wp-content/uploads/2025/05/Alaska-All-Ports-All-Vessels-2025.pdf';
console.log(`Fetching ${url}...`);

const resp = await fetch(url);
const buf = Buffer.from(await resp.arrayBuffer());
console.log(`Parsing PDF (${buf.length} bytes)...\n`);

const { text } = await pdfParse(buf);
const lines = text.split('\n');

console.log(`Total lines: ${lines.length}\n`);
console.log('First 150 lines:\n');
lines.slice(0, 150).forEach((l, i) => {
  console.log(i.toString().padStart(3), l);
});
