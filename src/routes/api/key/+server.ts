import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { json, error } from "@sveltejs/kit";
import JWT from "@tsndr/cloudflare-worker-jwt";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request, platform }) => {
	const body = await request.json();

	try {
		const { key, allowlist, ttl } = z
			.object({
				key: z.string().min(1).max(1000),
				allowlist: z.array(z.string().min(1)).min(1),
				ttl: z
					.number()
					.min(0)
					.max(60 * 60 * 24 * 365 * 3)
					.optional(),
			})
			.parse(body);

		const KEY = platform?.env?.MAIN_KEY ?? "key";
		if (key !== KEY) {
			throw error(401, "Unauthorized");
		}

		const jti = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

		const jwt = await JWT.sign(
			{
				allowlist,
				exp: Math.floor(Date.now() / 1000) + (ttl || 60 * 60 * 24),
				jti,
			},
			KEY,
		);

		await platform?.env?.STORE.put(jti, jwt);
		return json({ jwt });
	} catch (err) {
		if (err instanceof z.ZodError) {
			throw error(400, fromZodError(err).message);
		}
		if (err && typeof err === "object" && "status" in err) {
			throw err;
		}
		console.error(err);
		throw error(500, "Internal Server Error");
	}
};
