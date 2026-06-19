import { allCells, buildUrl, partitionSlices } from "../shared/matrix.ts";
import { classify } from "../shared/classify.ts";
import { probe } from "../worker/fetcher.ts";

const sliceIdx = parseInt(process.argv[2] ?? "0", 10);
const slice = partitionSlices(allCells())[sliceIdx] ?? [];

const results = await Promise.allSettled(
  slice.map(async (cell) => {
    const { chain, finalStatus, finalHeaders } = await probe(buildUrl(cell));
    const o = classify(finalStatus, finalHeaders, chain);
    return `${cell.env}/${cell.host_variant} ${cell.market} ${cell.concern} -> ${o.backend} (${o.finalStatus})`;
  })
);
for (const r of results) console.log(r.status === "fulfilled" ? r.value : `ERROR ${r.reason}`);
