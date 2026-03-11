import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import next from "next";

const { loadEnvConfig } = nextEnv;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
loadEnvConfig(__dirname);

function resolveConfigPath(filePath, fallbackPath) {
  const targetPath = filePath || fallbackPath;
  return path.isAbsolute(targetPath)
    ? targetPath
    : path.join(__dirname, targetPath);
}

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = Number(process.env.PORT || 4000);
const publicHost = process.env.PUBLIC_HOST || "10.210.190.242";
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const pfxPath = resolveConfigPath(
  process.env.SSL_PFX_PATH,
  `certs/${publicHost}.pfx`,
);
const pfxPassphrase = process.env.SSL_PFX_PASSPHRASE || "smart-air-local";
const keyPath = resolveConfigPath(
  process.env.SSL_KEY_PATH,
  "certs/localhost-key.pem",
);
const certPath = resolveConfigPath(
  process.env.SSL_CERT_PATH,
  "certs/localhost.pem",
);

function readTlsFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `${label} not found at ${filePath}. Create the certificate files before running npm run start.`,
    );
  }

  return fs.readFileSync(filePath);
}

function getTlsOptions() {
  if (fs.existsSync(pfxPath)) {
    return {
      pfx: fs.readFileSync(pfxPath),
      passphrase: pfxPassphrase,
    };
  }

  return {
    key: readTlsFile(keyPath, "SSL key"),
    cert: readTlsFile(certPath, "SSL certificate"),
  };
}

app
  .prepare()
  .then(() => {
    const options = getTlsOptions();

    https
      .createServer(options, (req, res) => {
        handle(req, res);
      })
      .listen(port, hostname, () => {
        console.log(`> HTTPS ready on https://${publicHost}:${port}`);
      });
  })
  .catch((error) => {
    console.error("Failed to start HTTPS server", error);
    process.exit(1);
  });
