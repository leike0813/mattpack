import { loadUpstreamCatalog } from "../src/catalog/upstream.js";

const catalog = await loadUpstreamCatalog(process.cwd());
const stable = catalog.byBucket.engineering.length + catalog.byBucket.productivity.length;

process.stdout.write(
  `${JSON.stringify({
    commit: catalog.lock.upstreams["mattpocock/skills"].commit,
    stable,
    beta: catalog.byBucket["in-progress"].length,
    misc: catalog.byBucket.misc.length,
    total: catalog.skills.size
  })}\n`
);
