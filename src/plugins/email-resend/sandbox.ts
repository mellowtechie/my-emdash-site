import { definePlugin } from "emdash";
import type { PluginContext } from "emdash";
import { env as cfEnv } from "cloudflare:workers";

interface EmailMessage {
	to: string | string[];
	from?: string;
	subject: string;
	text?: string;
	html?: string;
}

/**
 * Send an email via Resend API directly using global fetch().
 * Used by both the email:deliver hook and the test route.
 */
async function sendViaResend(
	apiKey: string,
	from: string,
	message: { to: string | string[]; subject: string; text?: string; html?: string },
): Promise<{ id: string }> {
	const response = await fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			from,
			to: message.to,
			subject: message.subject,
			text: message.text,
			html: message.html,
		}),
	});

	if (!response.ok) {
		const errorData = (await response.json().catch(() => null)) as Record<string, unknown> | null;
		const msg = (errorData?.message as string) || `Resend API error: ${response.status} ${response.statusText}`;
		throw new Error(msg);
	}

	return (await response.json()) as { id: string };
}

/**
 * Read the API key from Cloudflare Workers secrets (not D1).
 * Set via: npx wrangler secret put RESEND_API_KEY
 */
function getApiKey(): string | null {
	return (cfEnv as Record<string, unknown>).RESEND_API_KEY as string | null;
}

export default definePlugin({
	hooks: {
		// Seed default from/fromName into KV on first install
		"plugin:install": {
			handler: async (_event: unknown, ctx: PluginContext) => {
				await ctx.kv.set("resend:from", "noreply@mellowtechie.com");
				await ctx.kv.set("resend:fromName", "MellowTechie");
				ctx.log.info("[Resend Email] Plugin installed. Set RESEND_API_KEY via wrangler secret.");
			},
		},

		// Email delivery transport — exclusive provider
		"email:deliver": {
			exclusive: true,
			handler: async (event: { message: EmailMessage; source: string }, ctx: PluginContext) => {
				const apiKey = getApiKey();
				if (!apiKey) {
					ctx.log.error("[Resend Email] RESEND_API_KEY secret not set. Run: npx wrangler secret put RESEND_API_KEY");
					throw new Error("RESEND_API_KEY not configured. Set it via wrangler secret.");
				}

				const fromEmail = (await ctx.kv.get<string>("resend:from")) || "noreply@mellowtechie.com";
				const fromName = (await ctx.kv.get<string>("resend:fromName")) || "MellowTechie";
				const message = event.message;
				const from = message.from || `${fromName} <${fromEmail}>`;

				ctx.log.info(`[Resend Email] Sending to ${message.to} (source: ${event.source})`);

				const result = await sendViaResend(apiKey, from, message);
				ctx.log.info(`[Resend Email] Sent successfully`, { messageId: result.id });
			},
		},
	},

	routes: {
		// GET: return current config (no secrets). POST: update from/fromName only.
		settings: {
			handler: async (routeCtx: any, ctx: PluginContext) => {
				if (!routeCtx.user || routeCtx.user.role < 50) {
					return { error: "Unauthorized", status: 403 };
				}

				const method = routeCtx.request.method;

				if (method === "GET") {
					const hasApiKey = !!getApiKey();
					const from = (await ctx.kv.get<string>("resend:from")) || "noreply@mellowtechie.com";
					const fromName = (await ctx.kv.get<string>("resend:fromName")) || "MellowTechie";
					return { configured: hasApiKey, from, fromName };
				}

				if (method === "POST") {
					const body = await routeCtx.request.json();
					// Only from/fromName can be set via the API. API key is set via wrangler secret.
					if (typeof body.from === "string" && body.from.length > 0) {
						await ctx.kv.set("resend:from", body.from);
					}
					if (typeof body.fromName === "string" && body.fromName.length > 0) {
						await ctx.kv.set("resend:fromName", body.fromName);
					}
					return { success: true };
				}

				return { error: "Method not allowed" };
			},
		},

		// POST: send a test email directly via Resend
		test: {
			handler: async (routeCtx: any, ctx: PluginContext) => {
				if (!routeCtx.user || routeCtx.user.role < 50) {
					return { error: "Unauthorized", status: 403 };
				}

				// Test emails always go to the authenticated user — no arbitrary recipients
				const to = routeCtx.user?.email;
				if (!to) {
					return { success: false, error: "No email on authenticated user" };
				}

				const apiKey = getApiKey();
				if (!apiKey) {
					return { success: false, error: "RESEND_API_KEY secret not set. Run: npx wrangler secret put RESEND_API_KEY" };
				}

				const fromEmail = (await ctx.kv.get<string>("resend:from")) || "noreply@mellowtechie.com";
				const fromName = (await ctx.kv.get<string>("resend:fromName")) || "MellowTechie";

				try {
					const result = await sendViaResend(
						apiKey,
						`${fromName} <${fromEmail}>`,
						{
							to,
							subject: `Test Email from ${fromName}`,
							html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
								<h1 style="color:#333">Test Email</h1>
								<p>This is a test email from your EmDash site at mellowtechie.com.</p>
								<p>If you received this, email is configured correctly.</p>
								<p style="color:#999;font-size:12px;margin-top:24px">Sent ${new Date().toISOString()}</p>
							</div>`,
							text: `Test Email\n\nThis is a test email from your EmDash site at mellowtechie.com.\nIf you received this, email is configured correctly.\n\nSent ${new Date().toISOString()}`,
						},
					);
					return { success: true, message: `Test email sent to ${to}`, messageId: result.id };
				} catch (error) {
					return { success: false, error: error instanceof Error ? error.message : String(error) };
				}
			},
		},
	},
});
