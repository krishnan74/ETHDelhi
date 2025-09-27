-- Create users table for wallet management
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet VARCHAR(42) NOT NULL UNIQUE, -- Ethereum address (42 characters)
    telegram_id VARCHAR(50) NOT NULL UNIQUE, -- Telegram user ID
    telegram_name VARCHAR(255), -- Telegram username or display name
    private_key TEXT NOT NULL, -- Encrypted private key
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_last_active ON users(last_active);

-- Add comments for documentation
COMMENT ON TABLE users IS 'Stores user wallet information and Telegram data';
COMMENT ON COLUMN users.wallet IS 'Ethereum wallet address (42 characters starting with 0x)';
COMMENT ON COLUMN users.telegram_id IS 'Unique Telegram user ID';
COMMENT ON COLUMN users.telegram_name IS 'Telegram username or display name';
COMMENT ON COLUMN users.private_key IS 'AES encrypted private key for security';
COMMENT ON COLUMN users.created_at IS 'When the wallet was created';
COMMENT ON COLUMN users.last_active IS 'Last time the user accessed their wallet';

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows users to only access their own data
-- Note: This is a basic policy - you may want to adjust based on your needs
CREATE POLICY "Users can view own data" ON users
    FOR ALL USING (true); -- Adjust this based on your authentication needs

-- Optional: Create a function to update last_active timestamp
CREATE OR REPLACE FUNCTION update_last_active()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_active = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update last_active
CREATE TRIGGER update_users_last_active
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_last_active();
