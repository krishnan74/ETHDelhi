const crypto = require("crypto");

console.log("🚀 Setting up Telegram Wallet Bot...\n");

console.log("📦 Install dependencies with:");
console.log("npm install\n");

console.log("🔑 Generate a secure encryption key:");
const encryptionKey = crypto.randomBytes(32).toString("hex");
console.log(`ENCRYPTION_KEY=${encryptionKey}\n`);

console.log("📋 Next steps:");
console.log("1. Copy .env.example to .env");
console.log("2. Fill in your Supabase URL and anon key");
console.log("3. Add the generated encryption key to your .env file");
console.log("4. Set up your Supabase database table (see README.md)");
console.log("5. Add your Telegram bot token to .env");
console.log("6. Run: npm start\n");

console.log("✅ Setup complete! Check README.md for detailed instructions.");
