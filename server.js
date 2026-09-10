const http = require("http");
const fs = require("fs");
const path = require("path");

const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const EMPLEADOS_API = "http://10.10.94.128:9190/api/Siembra/GetEmpleados";
const LOGIN_API = "http://10.10.94.128:8086/api/User/Login";

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function proxyEmpleados(res) {
  const request = http.get(EMPLEADOS_API, { timeout: 10000 }, (apiResponse) => {
    if (apiResponse.statusCode !== 200) {
      apiResponse.resume();
      sendJson(res, 502, {
        error: `La API de empleados respondió con HTTP ${apiResponse.statusCode}`,
      });
      return;
    }

    res.writeHead(200, {
      "Content-Type": apiResponse.headers["content-type"] || "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    apiResponse.pipe(res);
  });

  request.on("timeout", () => request.destroy(new Error("Tiempo de espera agotado")));
  request.on("error", (error) => {
    if (!res.headersSent) {
      sendJson(res, 502, { error: "No fue posible consultar la API de empleados" });
    } else {
      res.end();
    }
    console.error("Error consultando GetEmpleados:", error.message);
  });
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 10_000) {
        reject(new Error("Solicitud demasiado grande"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("JSON inválido"));
      }
    });
    req.on("error", reject);
  });
}

async function proxyLogin(req, res) {
  let datos;
  try {
    datos = await readJsonBody(req);
  } catch (error) {
    sendJson(res, 400, { success: false, message: error.message });
    return;
  }

  const username = String(datos.username || "").trim().toUpperCase();
  const password = String(datos.password || "");
  if (!username || !password) {
    sendJson(res, 400, { success: false, message: "Usuario y contraseña son obligatorios" });
    return;
  }

  const contenido = JSON.stringify({ username, password });
  const target = new URL(LOGIN_API);
  const request = http.request(
    {
      hostname: target.hostname,
      port: target.port,
      path: target.pathname,
      method: "POST",
      timeout: 10000,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(contenido),
      },
    },
    (apiResponse) => {
      res.writeHead(apiResponse.statusCode || 502, {
        "Content-Type": apiResponse.headers["content-type"] || "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      apiResponse.pipe(res);
    },
  );

  request.on("timeout", () => request.destroy(new Error("Tiempo de espera agotado")));
  request.on("error", (error) => {
    if (!res.headersSent) {
      sendJson(res, 502, { success: false, message: "No fue posible consultar el servicio de login" });
    } else {
      res.end();
    }
    console.error("Error consultando Login:", error.message);
  });
  request.end(contenido);
}

function serveStatic(urlPath, res) {
  const requestedPath = urlPath === "/" ? "/index.html" : urlPath;
  const decodedPath = decodeURIComponent(requestedPath);
  const filePath = path.resolve(ROOT, `.${decodedPath}`);
  const isInsideRoot = filePath === ROOT || filePath.startsWith(`${ROOT}${path.sep}`);

  if (!isInsideRoot) {
    sendJson(res, 403, { error: "Ruta no permitida" });
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      sendJson(res, 404, { error: "Archivo no encontrado" });
      return;
    }

    res.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);

  if (req.method === "GET" && url.pathname === "/api/empleados") {
    proxyEmpleados(res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/auth/login") {
    proxyLogin(req, res);
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    sendJson(res, 405, { error: "Método no permitido" });
    return;
  }

  serveStatic(url.pathname, res);
});

server.listen(PORT, HOST, () => {
  console.log(`Evaluación Siembra disponible en http://${HOST}:${PORT}`);
});
