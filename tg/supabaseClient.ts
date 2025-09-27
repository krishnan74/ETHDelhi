import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || "your-supabase-url";
const supabaseKey = process.env.SUPABASE_ANON_KEY || "your-supabase-anon-key";

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseKey);

// Database types (you should generate these from your Supabase schema)
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          wallet: string;
          telegram_id: string;
          telegram_name: string;
          private_key: string; // This will be encrypted
          created_at: string;
          last_active: string;
        };
        Insert: {
          id?: string;
          wallet: string;
          telegram_id: string;
          telegram_name: string;
          private_key: string;
          created_at?: string;
          last_active?: string;
        };
        Update: {
          id?: string;
          wallet?: string;
          telegram_id?: string;
          telegram_name?: string;
          private_key?: string;
          created_at?: string;
          last_active?: string;
        };
      };
    };
  };
}
