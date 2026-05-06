// js/supabase.js

const SUPABASE_URL = 'https://ktyubtkzayscohmokpuk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0eXVidGt6YXlzY29obW9rcHVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4OTIyNjEsImV4cCI6MjA5MzQ2ODI2MX0.f-cn925OO2Qjh4xuCGIUhaUYkfKmk35_759GZ6zLOk8';

// Initialisation du client Supabase
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// Export global
window.supabaseClient = db;
