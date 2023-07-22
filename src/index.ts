import { z, ZodSchema } from "zod";
import { App } from "uWebSockets.js";
import type { HttpRequest, HttpResponse, TemplatedApp } from "uWebSockets.js";

type ApiSchema = Record<string, ApiRoute<any, any>>;

class ApiRoute<T extends ZodSchema, E extends ZodSchema> {
    constructor(public accepts: T, public returns: E) {}
}

function normalizeRoute(route: string) {
    while (route.startsWith("/")) route = route.substring(1);

    return route;
}

/**
 * Create a new route.
 */
export function route<T extends ZodSchema, E extends ZodSchema>(
    accepts: T,
    returns: E
) {
    return new ApiRoute(accepts, returns);
}

/**
 * Define a new api.
 */
export function defineApi<T extends ApiSchema>(obj: T) {
    return obj;
}

class ApiRequest<T extends ZodSchema> {
    /**
     * The request headers.
     */
    headers: Record<string, string> = {};
    /**
     * The query extracted from the url.
     * eg.: `?name=world&test` -> `{ name: "world", test: "" }`
     */
    query: Record<string, string> = {};
    /**
     * The request's body validated by the defined schema.
     */
    body: z.infer<T>;
    /**
     * The method of the request.
     */
    method: string;
    /**
     * The url of the request.
     * eg.: `/api/test`
     */
    url: string;

    constructor(
        private request: {
            query: string;
            url: string;
            headers: Record<string, string>;
            method: string;
        },
        body: any
    ) {
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
     * Get a header by name.
     * @param name The name of the header.
     * @returns The header or null.
     */
    header(name: string) {
        return this.request.headers[name.toLowerCase()] ?? null;
    }
}

const UTF8_DECODER = new TextDecoder();

class ApiServer<T extends ApiSchema> {
    private app: TemplatedApp;

    constructor(private schema: T) {
        this.app = App();
    }

    private handleRequest(
        res: HttpResponse,
        req: {
            query: string;
            url: string;
            headers: Record<string, string>;
            method: string;
        },
        name: string,
        callback: (request: any) => any
    ) {
        return new Promise<void>((resolve) => {
            let stiched: Uint8Array = new Uint8Array(0);
            let hasAborted: boolean = false;

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
                        if (hasAborted) return resolve();

                        res.writeStatus("400 Bad Request");
                        res.cork(() => {
                            res.end(
                                JSON.stringify({
                                    success: false,
                                    error: "Malformed request body.",
                                })
                            );
                            resolve();
                        });

                        return;
                    }

                    const tester = this.schema[name].accepts as ZodSchema;
                    const result = tester.safeParse(jsonData);

                    if (!result.success) {
                        if (hasAborted) return resolve();

                        res.writeStatus("400 Bad Request");
                        res.cork(() => {
                            res.end(
                                JSON.stringify({
                                    success: false,
                                    error: "Request body failed validation.",
                                })
                            );
                            resolve();
                        });

                        return;
                    }

                    const returned = await callback(
                        new ApiRequest(req, jsonData)
                    );

                    if (hasAborted) return resolve();

                    res.writeStatus("200 OK");
                    res.cork(() => {
                        res.end(
                            JSON.stringify({
                                success: true,
                                data: returned,
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
    on<E extends keyof T>(
        name: E,
        callback: (
            request: ApiRequest<T[E]["accepts"]>
        ) => z.infer<T[E]["returns"]>
    ) {
        if (!this.schema[name])
            throw new Error(`Cannot implement route '${name as string}', as its non existent.`);
        
        let route: string = normalizeRoute(name as string);
        
        this.app.post("/api/" + route, async (res, req) => {
            const url = req.getUrl();
            const query = req.getQuery() ?? "";
            const method = req.getMethod();
            const headers: Record<string, string> = {};
            req.forEach((key, value) => (headers[key.toLowerCase()] = value));

            await this.handleRequest(
                res,
                { headers, url, query, method },
                name as string,
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
    listen(port?: number, callback?: () => void) {
        port = port ?? 3000;

        this.app.listen(port, (socket) => {
            if (socket && callback) callback();
            if (!socket) throw new Error(`Failed to listen on port ${port}.`);
        });
    }
}

/**
 * Create a new server based on a schema.
 * @param schema The schema defined with `defineApi`.
 * @returns The created server.
 */
export function createServer<T extends ApiSchema>(schema: T): ApiServer<T> {
    return new ApiServer(schema);
}

class ApiClient<T extends ApiSchema> {
    private baseUrl: string;

    constructor(private schema: T, baseUrl?: string) {
        if (typeof window === "undefined" && !baseUrl)
            throw new Error(`createClient(...) baseUrl is required inside Node.`);
        
        this.baseUrl = baseUrl ?? `${window.location.protocol}//${window.location.hostname}${window.location.port ? `:${window.location.port}` : ""}`;
    }

    /**
     * Fetch a route.
     * @param name The route to fetch.
     * @param parameters The arguments to pass to the api.
     * @returns A promise resolving to the received json data.
     */
    async fetch<E extends keyof T>(name: E, parameters: z.infer<T[E]["accepts"]>): Promise<z.infer<T[E]["returns"]>> {
        if (!this.schema[name])
            throw new Error(`Client tried to request non existent route '${name as string}'.`);
        
        const resp = await fetch(this.baseUrl + "/api/" + normalizeRoute(name as string), {
            method: "POST",
            body: JSON.stringify(parameters)
        });

        const data = await resp.json();

        if (!data.success)
            throw new Error(data.error);
        
        return data.data;
    }
}

/**
 * Create a new client based on a schema.
 * @param schema The schema defined with `defineApi`.
 * @param baseUrl The url where the Swift API server is located. Only required inside Node.
 * @returns The created client.
 */
export function createClient<T extends ApiSchema>(schema: T, baseUrl?: string): ApiClient<T> {
    return new ApiClient(schema, baseUrl);
}
