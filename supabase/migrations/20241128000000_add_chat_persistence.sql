-- Add chat persistence functionality (No RLS Version)
-- This will allow chat messages to be stored and retrieved from the database

-- Create chat_messages table for persistent chat history (if it doesn't exist)
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_name TEXT NOT NULL,
  content TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for optimal performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_room ON chat_messages(room_name);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages(user_id);

-- Drop existing trigger and function if they exist (to avoid conflicts)
DROP TRIGGER IF EXISTS update_chat_messages_updated_at ON chat_messages;
DROP FUNCTION IF EXISTS update_chat_updated_at_column();

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_chat_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_chat_messages_updated_at
  BEFORE UPDATE ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_updated_at_column();

-- Grant necessary permissions
GRANT ALL ON chat_messages TO authenticated;
GRANT ALL ON chat_messages TO service_role;
