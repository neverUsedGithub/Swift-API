"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  createClient: () => createClient,
  createServer: () => createServer,
  defineApi: () => defineApi,
  route: () => route
});
module.exports = __toCommonJS(src_exports);
var import_uWebSockets = require("uWebSockets.js");
var ApiRoute = class {
  constructor(accepts, returns) {
    this.accepts = accepts;
    this.returns = returns;
  }
};
function normalizeRoute(route2) {
  while (route2.startsWith("/"))
    route2 = route2.substring(1);
  return route2;
}
function route(accepts, returns) {
  return new ApiRoute(accepts, returns);
}
function defineApi(obj) {
  return obj;
}
var ApiRequest = class {
  constructor(request, body) {
    this.request = request;
    const query = request.query ?? "";
    for (const part of query.split("&")) {
      if (part.includes("=")) {
        const [name, value] = part.split("=");
        this.query[name] = value;
      } else {
        this.query[part] = "";
      }
    }
    this.body = body;
    this.url = request.url;
    this.method = request.method;
    this.headers = request.headers;
  }
  /**
   * The request headers.
   */
  headers = {};
  /**
   * The query extracted from the url.
   * eg.: `?name=world&test` -> `{ name: "world", test: "" }`
   */
  query = {};
  /**
   * The request's body validated by the defined schema.
   */
  body;
  /**
   * The method of the request.
   */
  method;
  /**
   * The url of the request.
   * eg.: `/api/test`
   */
  url;
  /**
   * Get a header by name.
   * @param name The name of the header.
   * @returns The header or null.
   */
  header(name) {
    return this.request.headers[name.toLowerCase()] ?? null;
  }
};
var UTF8_DECODER = new TextDecoder();
var ApiServer = class {
  constructor(schema) {
    this.schema = schema;
    this.app = (0, import_uWebSockets.App)();
  }
  app;
  handleRequest(res, req, name, callback) {
    return new Promise((resolve) => {
      let stiched = new Uint8Array(0);
      let hasAborted = false;
      res.onAborted(() => {
        hasAborted = true;
      });
      res.onData(async (chunk, isLast) => {
        const temp = new Uint8Array(
          stiched.byteLength + chunk.byteLength
        );
        temp.set(new Uint8Array(stiched), 0);
        temp.set(new Uint8Array(chunk), stiched.byteLength);
        stiched = temp;
        if (isLast) {
          const decoded = UTF8_DECODER.decode(stiched);
          let jsonData;
          try {
            jsonData = JSON.parse(decoded);
          } catch {
            if (hasAborted)
              return resolve();
            res.writeStatus("400 Bad Request");
            res.cork(() => {
              res.end(
                JSON.stringify({
                  success: false,
                  error: "Malformed request body."
                })
              );
              resolve();
            });
            return;
          }
          const tester = this.schema[name].accepts;
          const result = tester.safeParse(jsonData);
          if (!result.success) {
            if (hasAborted)
              return resolve();
            res.writeStatus("400 Bad Request");
            res.cork(() => {
              res.end(
                JSON.stringify({
                  success: false,
                  error: "Request body failed validation."
                })
              );
              resolve();
            });
            return;
          }
          const returned = await callback(
            new ApiRequest(req, jsonData)
          );
          if (hasAborted)
            return resolve();
          res.writeStatus("200 OK");
          res.cork(() => {
            res.end(
              JSON.stringify({
                success: true,
                data: returned
              })
            );
            resolve();
          });
        }
      });
    });
  }
  /**
   * Add an implementation for a route.
   * @param name The route to implement.
   * @param callback The implementation.
   */
  on(name, callback) {
    if (!this.schema[name])
      throw new Error(`Cannot implement route '${name}', as its non existent.`);
    let route2 = normalizeRoute(name);
    this.app.post("/api/" + route2, async (res, req) => {
      const url = req.getUrl();
      const query = req.getQuery() ?? "";
      const method = req.getMethod();
      const headers = {};
      req.forEach((key, value) => headers[key.toLowerCase()] = value);
      await this.handleRequest(
        res,
        { headers, url, query, method },
        name,
        callback
      );
    });
    return this;
  }
  /**
   * Start listening on the specified port.
   * @param port The port to listen on.
   * @param callback Callback to call after successfully starting server.
   */
  listen(port, callback) {
    port = port ?? 3e3;
    this.app.listen(port, (socket) => {
      if (socket && callback)
        callback();
      if (!socket)
        throw new Error(`Failed to listen on port ${port}.`);
    });
  }
};
function createServer(schema) {
  return new ApiServer(schema);
}
var ApiClient = class {
  constructor(schema, baseUrl) {
    this.schema = schema;
    if (typeof window === "undefined" && !baseUrl)
      throw new Error(`createClient(...) baseUrl is required inside Node.`);
    this.baseUrl = baseUrl ?? `${window.location.protocol}//${window.location.hostname}${window.location.port ? `:${window.location.port}` : ""}`;
  }
  baseUrl;
  /**
   * Fetch a route.
   * @param name The route to fetch.
   * @param parameters The arguments to pass to the api.
   * @returns A promise resolving to the received json data.
   */
  async fetch(name, parameters) {
    if (!this.schema[name])
      throw new Error(`Client tried to request non existent route '${name}'.`);
    const resp = await fetch(this.baseUrl + "/api/" + normalizeRoute(name), {
      method: "POST",
      body: JSON.stringify(parameters)
    });
    const data = await resp.json();
    if (!data.success)
      throw new Error(data.error);
    return data.data;
  }
};
function createClient(schema, baseUrl) {
  return new ApiClient(schema, baseUrl);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createClient,
  createServer,
  defineApi,
  route
});
