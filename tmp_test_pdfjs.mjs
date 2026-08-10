import fs from 'node:fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
const bytes = new Uint8Array(fs.readFileSync('/mnt/data/FRETE (2)(2).pdf'));
const doc = await getDocument({data:bytes, disableWorker:true}).promise;
const page = await doc.getPage(1);
const content = await page.getTextContent();
console.log('items', content.items.length);
console.log(content.items.slice(0,30).map(i=>({str:i.str,x:i.transform?.[4],y:i.transform?.[5],w:i.width})))
await doc.destroy();
