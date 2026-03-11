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

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = Number(process.env.PORT || 4000);
const publicHost = process.env.PUBLIC_HOST || "10.210.190.242";
const trustProxy = process.env.TRUST_PROXY === "true";
const sslPfxPath = process.env.SSL_PFX_PATH || `certs/${publicHost}.pfx`;
const sslPfxPassphrase =
  process.env.SSL_PFX_PASSPHRASE || "smart-air-local";
const requestLimitPerMinute = Number(process.env.RATE_LIMIT_PER_MINUTE || 60);
const maxRequestBodyBytes = Number(process.env.MAX_BODY_BYTES || 10485760);
const headerTimeoutMs = Number(process.env.HEADER_TIMEOUT_MS || 15000);
const requestTimeoutMs = Number(process.env.REQUEST_TIMEOUT_MS || 30000);
const keepAliveTimeoutMs = Number(process.env.KEEP_ALIVE_TIMEOUT_MS || 15000);
const maxRequestsPerSocket = Number(
  process.env.MAX_REQUESTS_PER_SOCKET || 100,
);
const allowedHosts = new Set(
  (process.env.ALLOWED_HOSTS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const requestBuckets = new Map();

function resolveConfigPath(filePath) {
  return path.isAbsolute(filePath)
    ? filePath
    : path.join(__dirname, filePath);
}

function getClientIp(req) {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (trustProxy && typeof forwardedFor === "string" && forwardedFor.length > 0) {
    return forwardedFor.split(",")[0].trim();
  }

  return req.socket.remoteAddress || "unknown";
}

function isAllowedHost(req) {
  const hostHeader = req.headers.host;
  if (typeof hostHeader !== "string" || hostHeader.length === 0) {
    return false;
  }

  const requestedHost = hostHeader.split(":")[0].trim().toLowerCase();
  const defaults = [
    publicHost,
    hostname,
    "localhost",
    "127.0.0.1",
    "[::1]",
  ]
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  for (const value of defaults) {
    allowedHosts.add(value);
  }

  return allowedHosts.has(requestedHost);
}

function applyHostValidation(req, res) {
  if (isAllowedHost(req)) {
    return true;
  }

  res.statusCode = 421;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ message: "Misdirected request" }));
  return false;
}

function buildContentSecurityPolicy() {
  const scriptSrc = ["'self'", "'unsafe-inline'"];
  const connectSrc = ["'self'"];

  if (dev) {
    scriptSrc.push("'unsafe-eval'");
    connectSrc.push("ws:", "wss:");
  }

  return [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "img-src 'self' data: blob: https://media.discordapp.net https://*.tile.openstreetmap.org",
    `connect-src ${connectSrc.join(" ")}`,
    "frame-src 'none'",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    "upgrade-insecure-requests",
  ].join("; ");
}

function applyRateLimit(req, res) {
  const ip = getClientIp(req);
  const now = Date.now();
  const windowStart = now - 60_000;
  const existingBucket = requestBuckets.get(ip);
  const bucket =
    existingBucket && existingBucket.resetAt > windowStart
      ? existingBucket
      : { count: 0, resetAt: now + 60_000 };

  bucket.count += 1;
  requestBuckets.set(ip, bucket);

  res.setHeader("X-RateLimit-Limit", String(requestLimitPerMinute));
  res.setHeader("X-RateLimit-Remaining", String(Math.max(0, requestLimitPerMinute - bucket.count)));
  res.setHeader("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

  if (bucket.count > requestLimitPerMinute) {
    res.statusCode = 429;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ message: "Too many requests" }));
    return false;
  }

  return true;
}

function applySecurityHeaders(res) {
  res.removeHeader("X-Powered-By");
  res.removeHeader("Server");
  res.setHeader("Strict-Transport-Security", "max-age=31536000");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("Origin-Agent-Cluster", "?1");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  res.setHeader("Content-Security-Policy", buildContentSecurityPolicy());
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
}

function isBodyTooLarge(req, res) {
  const contentLength = req.headers["content-length"];
  if (!contentLength) {
    return false;
  }

  const size = Number(contentLength);
  if (!Number.isFinite(size) || size <= maxRequestBodyBytes) {
    return false;
  }

  res.statusCode = 413;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ message: "Payload too large" }));
  return true;
}

function pruneRateLimitBuckets() {
  const now = Date.now();
  for (const [ip, bucket] of requestBuckets.entries()) {
    if (bucket.resetAt <= now) {
      requestBuckets.delete(ip);
    }
  }
}

app
  .prepare()
  .then(() => {
    const httpsOptions = {
      pfx: fs.readFileSync(resolveConfigPath(sslPfxPath)),
      passphrase: sslPfxPassphrase,
      minVersion: "TLSv1.2",
    };

    const server = https.createServer(httpsOptions, (req, res) => {
      applySecurityHeaders(res);

      if (!applyHostValidation(req, res)) {
        return;
      }

      if (!applyRateLimit(req, res)) {
        return;
      }

      if (isBodyTooLarge(req, res)) {
        return;
      }

      handle(req, res);
    });

    server.headersTimeout = headerTimeoutMs;
    server.requestTimeout = requestTimeoutMs;
    server.keepAliveTimeout = keepAliveTimeoutMs;
    server.maxRequestsPerSocket = maxRequestsPerSocket;

    setInterval(pruneRateLimitBuckets, 60_000).unref();

    server.listen(port, hostname, () => {
      console.log(`> HTTPS ready on https://${publicHost}:${port}`);
    });
  })
  .catch((error) => {
    console.error("Failed to start HTTPS server", error);
    process.exit(1);
  });
