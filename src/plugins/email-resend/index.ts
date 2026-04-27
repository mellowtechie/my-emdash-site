import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import type { PluginDescriptor } from "emdash";

/**
 * Resend Email Provider Plugin for EmDash
 * Implements the email:deliver hook to send emails via Resend API
 */

interface ResendEmailPluginOptions {
	from?: string;
	fromName?: string;
}

// Resolve the sandbox entrypoint as an absolute path so the virtual module can find it
const __dirname = dirname(fileURLToPath(import.meta.url));
const sandboxEntrypoint = resolve(__dirname, "sandbox.ts");

export function resendEmailPlugin(options: ResendEmailPluginOptions = {}): PluginDescriptor {
	return {
		id: "resend-email",
		version: "1.0.0",
		format: "standard",
		entrypoint: sandboxEntrypoint,
		options: options,
		capabilities: ["email:provide", "network:fetch"],
		allowedHosts: ["api.resend.com"],
	};
}
