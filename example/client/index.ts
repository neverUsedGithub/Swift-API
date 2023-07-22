import { createClient } from "../../src";
import apiDef from "../api";

const client = createClient(apiDef, "http://localhost:3000");

client.fetch("/greet", { name: "Swift Api" })
    .then(({ msg }) => console.log(msg));

async function main() {
    const { loggedIn } = await client.fetch("/auth", {
        username: "admin",
        password: "password"
    });

    if (loggedIn)
        console.log("Login was successful");
    else
        console.log("Login failed");
}

main();