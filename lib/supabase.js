import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://zmjfjekpoezltgudyvqg.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptamZqZWtwb2V6bHRndWR5dnFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3NTY3MDYsImV4cCI6MjA3NTMzMjcwNn0.mSO44GRiedNTgUx5E2FtsWxjxvX0cQwDhqm4geiKKIs'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)