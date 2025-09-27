# Telegram Wallet Bot with Supabase Integration

This project implements a Telegram bot that creates and manages Ethereum wallets with secure private key storage using Supabase and encryption.

## Features

- 🔐 **Secure Private Key Storage**: Private keys are encrypted using AES encryption before being stored in Supabase
- 🏦 **Supabase Integration**: Uses Supabase for database operations with proper error handling
- 💼 **Wallet Management**: Create and retrieve wallets by Telegram ID
- 🤖 **Telegram Bot**: Interactive bot commands for wallet operations

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Fill in your configuration:

```env
# Supabase Configuration
SUPABASE_URL=your-supabase-project-url
SUPABASE_ANON_KEY=your-supabase-anon-key

# Encryption Key (32 characters recommended)
ENCRYPTION_KEY=your-32-character-secret-key-here!

# Telegram Bot Token
BOT_TOKEN=your-telegram-bot-token
```

### 3. Supabase Database Setup

Create a `users` table in your Supabase database with the following schema:

```sql
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet TEXT NOT NULL,
  telegram_id TEXT UNIQUE NOT NULL,
  telegram_name TEXT,
  private_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active TIMESTAMPTZ DEFAULT NOW()
);
```

### 4. Generate Encryption Key

You can generate a secure encryption key using the crypto utility:

```javascript
import { generateEncryptionKey } from "./lib/crypto";
console.log(generateEncryptionKey());
```

## Usage

### Bot Commands

- `/start` - Create a new wallet or access existing wallet
- `/wallet` - View your wallet details
- `/help` - Show available commands

### Programmatic Usage

```typescript
import { Wallet } from "./lib/Wallet";

const walletService = new Wallet();

// Create a new wallet
const newWallet = await walletService.createWallet("123456789", "username");

// Get existing wallet
const wallet = await walletService.getWallet("123456789");

// Check if wallet exists
const exists = await walletService.walletExists("123456789");
```

## File Structure

```
├── lib/
│   ├── Wallet.ts          # Main wallet service class
│   └── crypto.ts          # Encryption/decryption utilities
├── supabaseClient.ts      # Supabase client configuration
├── index.js              # Telegram bot implementation
├── package.json          # Dependencies
└── .env.example          # Environment variables template
```

## Security Features

- **AES Encryption**: Private keys are encrypted using AES before database storage
- **Environment Variables**: Sensitive configuration stored in environment variables
- **Error Handling**: Comprehensive error handling for database and encryption operations
- **Type Safety**: TypeScript implementation with proper type definitions

## API Reference

### Wallet Class Methods

#### `createWallet(telegramId: string, telegramName: string)`

Creates a new Ethereum wallet and stores it encrypted in Supabase.

**Returns:**

```typescript
{
  address: string;
  privateKey: string;
}
```

#### `getWallet(telegramId: string)`

Retrieves and decrypts a wallet for the given Telegram ID.

**Returns:**

```typescript
{
  address: string;
  privateKey: string;
  wallet: ethers.Wallet;
  telegramName: string;
  createdAt: string;
  lastActive: string;
}
```

#### `walletExists(telegramId: string)`

Checks if a wallet exists for the given Telegram ID.

**Returns:** `Promise<boolean>`

## Development

### Build and Run

To build the TypeScript code:

```bash
npm run build
```

To run the bot:

```bash
npm start
```

To run in development mode (with ts-node):

```bash
npm run dev
```

### Setup

Run the setup script to generate encryption keys:

```bash
npm run setup
```

## Security Considerations

1. **Encryption Key**: Store your encryption key securely and never commit it to version control
2. **Database Security**: Use Supabase RLS (Row Level Security) policies for additional security
3. **Environment Variables**: Keep sensitive data in environment variables
4. **Private Key Handling**: Private keys are only decrypted when needed and never logged

## License

MIT License
