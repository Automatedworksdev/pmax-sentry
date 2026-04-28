// Supabase Edge Function: Validate License Key
// File: supabase/functions/validate-license/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  key: string;
  version?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse request
    const { key }: RequestBody = await req.json();
    
    if (!key) {
      return new Response(
        JSON.stringify({ error: 'License key required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check license and increment use_count atomically
    const { data: licenseData, error: licenseError } = await supabaseClient
      .rpc('increment_license_use', { license_key: key });

    if (licenseError) {
      console.error('License check error:', licenseError);
      return new Response(
        JSON.stringify({ error: 'Internal error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!licenseData || licenseData.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid or exhausted license key' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const license = licenseData[0];

    // Fetch master junk list
    const { data: junkData, error: junkError } = await supabaseClient
      .from('master_junk_list')
      .select('data, version')
      .eq('version', '2.0.0')
      .single();

    if (junkError || !junkData) {
      console.error('Junk list fetch error:', junkError);
      return new Response(
        JSON.stringify({ error: 'Data unavailable' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return success with data
    return new Response(
      JSON.stringify({
        valid: true,
        license: {
          id: license.id,
          key: license.key,
          email: license.user_email,
          status: license.status,
          uses: license.use_count,
          maxUses: license.max_uses
        },
        data: junkData.data,
        version: junkData.version
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Validation error:', error);
    return new Response(
      JSON.stringify({ error: 'Invalid request' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});