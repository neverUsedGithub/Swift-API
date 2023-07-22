<div align="center">
    <h1>Swift Api</h1>
    <h3>⚡️ Blazingly fast • 🔒 Type safe • 🔨 Easy-to-use</h3>
</div>
<hr />

Create blazingly fast, type safe and easy-to-use APIs with a simple interface in typescript. Powered by the amazing [uWebSockets.js](https://github.com/uNetworking/uWebSockets.js) for ⚡️ blazingly fast ⚡️ performance.

# Examples

> api.ts
```ts
import { defineApi, route } from "swift-api";
import { z } from "zod";

export default defineApi({
    "/greet": route(
        z.object({ name: z.string().optional() }),
        z.object({ msg: z.string() })
    )
});
```
> server.ts
```ts
import apiDef from "./api";
import { createServer } from "swift-api";

const app = createServer(apiDef);

app.on("/greet", (req) => {
    const name = req.body.name ?? "World";

    return { msg: `Hello, ${name}!` };
});

app.listen(3000, () => {
    console.log("Swift Api server is listening on port: 3000");
});
```
> client.ts
```ts
import apiDef from "./api";
import { createClient } from "swift-api";

// Url is not required in client-side.
const client = createClient(apiDef, "http://localhost:3000");

client
    .fetch("/greet", { name: "Swift Api" })
    .then(({ msg }) => console.log(msg));
```