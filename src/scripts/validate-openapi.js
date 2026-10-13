import fs from "node:fs";

const specification = JSON.parse(
  fs.readFileSync(
    new URL("../docs/openapi/openapi.json", import.meta.url),
    "utf8",
  ),
);

if (!/^3\./.test(specification.openapi ?? "")) {
  throw new Error("OpenAPI version must be 3.x");
}

if (!specification.info?.title || !specification.info?.version) {
  throw new Error("OpenAPI info.title and info.version are required");
}

if (!specification.paths || Object.keys(specification.paths).length === 0) {
  throw new Error("OpenAPI paths are required");
}

function resolveLocalReference(reference) {
  if (!reference.startsWith("#/")) {
    throw new Error(`Only local OpenAPI references are supported: ${reference}`);
  }

  let current = specification;

  for (const encodedPart of reference.slice(2).split("/")) {
    const part = encodedPart.replaceAll("~1", "/").replaceAll("~0", "~");
    current = current?.[part];
  }

  if (current === undefined) {
    throw new Error(`Unresolved OpenAPI reference: ${reference}`);
  }
}

function visit(value) {
  if (Array.isArray(value)) {
    for (const item of value) {
      visit(item);
    }
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  if (typeof value.$ref === "string") {
    resolveLocalReference(value.$ref);
  }

  for (const child of Object.values(value)) {
    visit(child);
  }
}

visit(specification);

console.log(
  `OpenAPI contract valid: ${Object.keys(specification.paths).length} paths`,
);
