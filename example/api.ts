import { defineApi, route } from "../src";
import { z } from "zod";

export default defineApi({
    "/auth": route(
        z.object({
            username: z.string(),
            password: z.string()
        }),
        
        z.object({
            loggedIn: z.boolean()
        })
    ),
    "/greet": route(
        z.object({ name: z.string().optional() }),
        z.object({ msg: z.string() })
    )
})