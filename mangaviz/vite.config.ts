import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import https from "node:https";
import dns from "node:dns";

const MANGA_UPDATES_HOST = "api.mangaupdates.com";
const MANGA_UPDATES_BASE_PATH = "/v1";

// Local router may block api.mangaupdates.com — use public DNS to resolve it
const resolver = new dns.Resolver();
resolver.setServers(["8.8.8.8", "1.1.1.1"]);

let cachedIp: string | null = null;
function resolveHost(): Promise<string> {
  if (cachedIp) return Promise.resolve(cachedIp);
  return new Promise((resolve, reject) =>
    resolver.resolve4(MANGA_UPDATES_HOST, (err, addresses) => {
      if (err) reject(err);
      else {
        cachedIp = addresses[0];
        resolve(cachedIp);
      }
    }),
  );
}

function mangaUpdatesProxyPlugin(): Plugin {
  const handler = (req: any, res: any, next: any) => {
    if (!req.url?.startsWith("/api/mangaupdates")) {
      next();
      return;
    }

    const reqUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const upstreamPath = reqUrl.pathname.replace(/^\/api\/mangaupdates/, "");
    const fullPath = `${MANGA_UPDATES_BASE_PATH}${upstreamPath}${reqUrl.search}`;

    const forwardHeaders: Record<string, string | string[]> = {};
    for (const [key, value] of Object.entries(req.headers as Record<string, string | string[]>)) {
      const k = key.toLowerCase();
      if (k === "host" || k === "connection" || k === "content-length" || k === "cookie") continue;
      forwardHeaders[key] = value;
    }
    forwardHeaders["host"] = MANGA_UPDATES_HOST;
    forwardHeaders["accept"] = (forwardHeaders["accept"] as string) || "application/json";
    forwardHeaders["content-type"] = (forwardHeaders["content-type"] as string) || "application/json";
    forwardHeaders["user-agent"] = "Mozilla/5.0";
    forwardHeaders["origin"] = "https://www.mangaupdates.com";
    forwardHeaders["referer"] = "https://www.mangaupdates.com/";

    resolveHost()
      .then((ip) => {
        const proxyReq = https.request(
          {
            hostname: ip,
            servername: MANGA_UPDATES_HOST, // TLS SNI — must match the certificate
            port: 443,
            path: fullPath,
            method: req.method,
            headers: forwardHeaders,
          },
          (proxyRes) => {
            res.statusCode = proxyRes.statusCode || 502;
            for (const [key, value] of Object.entries(proxyRes.headers)) {
              if (key.toLowerCase() !== "transfer-encoding" && value !== undefined) {
                res.setHeader(key, value as string | string[]);
              }
            }
            proxyRes.pipe(res);
          },
        );

        proxyReq.on("error", (error: Error) => {
          res.statusCode = 502;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: error.message }));
        });

        if (req.method !== "GET" && req.method !== "HEAD") {
          req.pipe(proxyReq);
        } else {
          proxyReq.end();
        }
      })
      .catch((err: Error) => {
        res.statusCode = 502;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ error: `DNS: ${err.message}` }));
      });
  };

  return {
    name: "manga-updates-proxy",
    configureServer(server: any) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server: any) {
      server.middlewares.use(handler);
    },
  };
}

export default defineConfig({
  plugins: [react(), mangaUpdatesProxyPlugin()],
});
