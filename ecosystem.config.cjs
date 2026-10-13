const path = require("node:path");

const projectRoot = __dirname;
const nodeInterpreter = process.execPath;

/**
 * Run every command below from the project root. PM2 commands are deliberately
 * kept here (not in package.json) so there is one canonical deployment guide.
 *
 * First start — development API:
 *   pm2 start ecosystem.config.cjs --only redress-backend-development
 *
 * First start — persistent test API (.env.test):
 *   pm2 start ecosystem.config.cjs --only redress-backend-test
 *
 * First start — production API (.env.production):
 *   pm2 start ecosystem.config.cjs --only redress-backend-production --env production
 *
 * After pulling new code or changing environment variables:
 *   pm2 restart redress-backend-test --update-env
 *   pm2 restart redress-backend-production --update-env
 *
 * Useful commands:
 *   pm2 logs redress-backend-test --lines 100
 *   pm2 status
 *   pm2 save
 */

module.exports = {
  apps: [
    {
      // Development
      // Direct: npm run dev
      name: "redress-backend-development",
      cwd: projectRoot,
      script: path.join(
        projectRoot,
        "node_modules",
        "nodemon",
        "bin",
        "nodemon.js",
      ),
      args: ["src/server.js"],
      interpreter: nodeInterpreter,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "development",
      },
    },
    {
      // Persistent test API. Uses .env.test and starts with NODE_ENV=test.
      // Direct: npm run test
      name: "redress-backend-test",
      cwd: projectRoot,
      script: path.join(projectRoot, "src", "scripts", "start-test-server.js"),
      interpreter: nodeInterpreter,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      listen_timeout: 10000,
      kill_timeout: 15000,
      env: {
        NODE_ENV: "test",
      },
    },
    {
      // Production
      // Build/validation: npm run build
      // Direct: npm run prod
      name: "redress-backend-production",
      cwd: projectRoot,
      script: path.join(projectRoot, "src", "server.js"),
      interpreter: nodeInterpreter,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      listen_timeout: 10000,
      kill_timeout: 15000,
      env: {
        NODE_ENV: "production",
      },
      env_production: {
        NODE_ENV: "production",
      },
    },
  ],
};
