import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = 'https://mlgtlirrhlftjgfdsajy.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sZ3RsaXJyaGxmdGpnZmRzYWp5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM0NzUxMSwiZXhwIjoyMDkyOTIzNTExfQ.yxGJs_XPV6PqVxfsp65G56A0TZrYW0QkxmgdvI8765k';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { key } = await req.json();
    
    if (!key) {
      return new Response(
        JSON.stringify({ error: 'License key required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(SUPABASE_URL, SERVICE_KEY);

    // First check if license exists and is valid
    const { data: licenseCheck, error: checkError } = await supabaseClient
      .from('licenses')
      .select('*')
      .eq('key', key)
      .single();

    if (checkError || !licenseCheck) {
      return new Response(
        JSON.stringify({ error: 'Invalid license key' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (licenseCheck.status !== 'active') {
      return new Response(
        JSON.stringify({ error: 'License revoked' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (licenseCheck.use_count >= licenseCheck.max_uses) {
      return new Response(
        JSON.stringify({ error: 'License exhausted' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Increment use count manually
    const { error: updateError } = await supabaseClient
      .from('licenses')
      .update({ 
        use_count: licenseCheck.use_count + 1,
        last_used_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('key', key);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: 'Failed to update license' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get junk list data
    const { data: junkData, error: junkError } = await supabaseClient
      .from('master_junk_list')
      .select('data, version')
      .eq('version', '2.0.0')
      .single();

    if (junkError || !junkData) {
      return new Response(
        JSON.stringify({ error: 'Data unavailable' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        valid: true,
        license: {
          id: licenseCheck.id,
          key: licenseCheck.key,
          email: licenseCheck.user_email,
          status: licenseCheck.status,
          uses: licenseCheck.use_count + 1,
          maxUses: licenseCheck.max_uses
        },
        data: junkData.data,
        version: junkData.version
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Invalid request', details: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});