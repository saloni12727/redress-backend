import fs from "node:fs";

import express, { Router } from "express";
import swaggerUiDist from "swagger-ui-dist";

import { env } from "../../config/env.js";

const router = Router();
const specification = JSON.parse(
  fs.readFileSync(
    new URL("../../docs/openapi/openapi.json", import.meta.url),
    "utf8",
  ),
);

const swaggerUiAssetsPath = swaggerUiDist.getAbsoluteFSPath();

function swaggerPage(docsPath) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="Interactive Redress API documentation" />
    <title>Redress API Documentation</title>
    <link rel="stylesheet" href="${docsPath}/assets/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="${docsPath}/assets/swagger-ui-bundle.js" defer></script>
    <script src="${docsPath}/assets/swagger-ui-standalone-preset.js" defer></script>
    <script src="${docsPath}/swagger-config.js" defer></script>
  </body>
</html>`;
}

router.use(
  "/assets",
  express.static(swaggerUiAssetsPath, {
    index: false,
    immutable: true,
    maxAge: "1y",
  }),
);

router.get("/", (req, res) => {
  res.set("Cache-Control", "no-store");
  return res.type("html").send(swaggerPage(req.baseUrl));
});

router.get("/swagger-config.js", (req, res) => {
  const specificationUrl = `${req.baseUrl}/openapi.json`;

  res.set("Cache-Control", "no-store");
  res.type("application/javascript");

  return res.send(`
window.addEventListener("load", () => {
  window.ui = SwaggerUIBundle({
    url: ${JSON.stringify(specificationUrl)},
    dom_id: "#swagger-ui",
    deepLinking: true,
    displayRequestDuration: true,
    persistAuthorization: true,
    tryItOutEnabled: true,
    presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
    layout: "StandaloneLayout"
  });
});
`);
});

router.get("/openapi.json", (req, res) => {
  res.set("Cache-Control", "no-store");
  return res.status(200).json({
    ...specification,
    servers: [
      {
        url: env.API_PREFIX,
        description: "Current host",
      },
    ],
  });
});

export default router;
