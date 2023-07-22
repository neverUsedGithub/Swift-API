import { createServer } from "../../src";
import apiDef from "../api";

const app = createServer(apiDef);

app.on("/auth", (req) => {
    let loggedIn = false;

    if (req.body.username === "admin" &&
        req.body.password === "password")
        loggedIn = true;

    return { loggedIn };
});

app.on("/greet", (req) => {
    const name = req.body.name ?? "World";

    return { msg: `Hello, ${name}!` };
});

app.listen(3000, () => {
    console.log("Listening on port 3000");
});