import { createClient } from "https://esm.sh/@supabase/supabase-js";

// Replace with your actual Project URL and Anon Key
const supabaseUrl = "https://cyiudaxtnkittnticroa.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5aXVkYXh0bmtpdHRudGljcm9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2NjUzMDksImV4cCI6MjA4MDI0MTMwOX0.kPaNKPyoaS7fYi1FTpvuK2M6aGzXGAtIGIb9zlL2lgs";

export const supabase = createClient(supabaseUrl, supabaseKey);