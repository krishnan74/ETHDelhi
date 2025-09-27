import { createClient } from "@supabase/supabase-js";

// Supabase configuration
const supabaseUrl =
  process.env.SUPABASE_URL || "https://atcazqgvtdhohuroyuuv.supabase.co";
const supabaseKey =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0Y2F6cWd2dGRob2h1cm95dXV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5NzQ0NjksImV4cCI6MjA3NDU1MDQ2OX0.TdciRX4MMzI_sFKyx9ZYzudPbKAnErxHkQnb6oxyCSA";

// Create Supabase client
export const supabase = createClient(
  "https://atcazqgvtdhohuroyuuv.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0Y2F6cWd2dGRob2h1cm95dXV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5NzQ0NjksImV4cCI6MjA3NDU1MDQ2OX0.TdciRX4MMzI_sFKyx9ZYzudPbKAnErxHkQnb6oxyCSA"
);

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
