// supabase/functions/_shared/cors.ts
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Allow requests from any origin
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', // Specify allowed methods
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', // Specify allowed headers
};
