import { randomBytes } from "node:crypto";

const key = randomBytes(32);
const base64Key = key.toString("base64");

console.log("Generated AES-256 encryption key (base64-encoded 32 bytes):\n");
console.log(base64Key);
console.log("\nAdd to .dev.vars for local development:");
console.log(`ENCRYPTION_KEY=${base64Key}`);
console.log("\nOr set as a Wrangler secret for production:");
console.log("echo '<key>' | wrangler secret put ENCRYPTION_KEY");
