import { ZodSchema, z } from 'zod';

type ApiSchema = Record<string, ApiRoute<any, any>>;
declare class ApiRoute<T extends ZodSchema, E extends ZodSchema> {
    accepts: T;
    returns: E;
    constructor(accepts: T, returns: E);
}
/**
 * Create a new route.
 */
declare function route<T extends ZodSchema, E extends ZodSchema>(accepts: T, returns: E): ApiRoute<T, E>;
/**
 * Define a new api.
 */
declare function defineApi<T extends ApiSchema>(obj: T): T;
declare class ApiRequest<T extends ZodSchema> {
    private request;
    /**
     * The request headers.
     */
    headers: Record<string, string>;
    /**
     * The query extracted from the url.
     * eg.: `?name=world&test` -> `{ name: "world", test: "" }`
     */
    query: Record<string, string>;
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
    constructor(request: {
        query: string;
        url: string;
        headers: Record<string, string>;
        method: string;
    }, body: any);
    /**
     * Get a header by name.
     * @param name The name of the header.
     * @returns The header or null.
     */
    header(name: string): string;
}
declare class ApiServer<T extends ApiSchema> {
    private schema;
    private app;
    constructor(schema: T);
    private handleRequest;
    /**
     * Add an implementation for a route.
     * @param name The route to implement.
     * @param callback The implementation.
     */
    on<E extends keyof T>(name: E, callback: (request: ApiRequest<T[E]["accepts"]>) => z.infer<T[E]["returns"]>): this;
    /**
     * Start listening on the specified port.
     * @param port The port to listen on.
     * @param callback Callback to call after successfully starting server.
     */
    listen(port?: number, callback?: () => void): void;
}
/**
 * Create a new server based on a schema.
 * @param schema The schema defined with `defineApi`.
 * @returns The created server.
 */
declare function createServer<T extends ApiSchema>(schema: T): ApiServer<T>;
declare class ApiClient<T extends ApiSchema> {
    private schema;
    private baseUrl;
    constructor(schema: T, baseUrl?: string);
    /**
     * Fetch a route.
     * @param name The route to fetch.
     * @param parameters The arguments to pass to the api.
     * @returns A promise resolving to the received json data.
     */
    fetch<E extends keyof T>(name: E, parameters: z.infer<T[E]["accepts"]>): Promise<z.infer<T[E]["returns"]>>;
}
/**
 * Create a new client based on a schema.
 * @param schema The schema defined with `defineApi`.
 * @param baseUrl The url where the Swift API server is located. Only required inside Node.
 * @returns The created client.
 */
declare function createClient<T extends ApiSchema>(schema: T, baseUrl?: string): ApiClient<T>;

export { createClient, createServer, defineApi, route };
