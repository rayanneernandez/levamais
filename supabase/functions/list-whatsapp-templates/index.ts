import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const WHATSAPP_API_BASE = "https://wpp-360dialog-starter.onrender.com";
const DEFAULT_DEPARTMENT_ID = "a9355171-0c38-40e3-9f22-4ed123ddaf69";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Aceita departmentId via body ou usa o padrão
    let departmentId = DEFAULT_DEPARTMENT_ID;
    
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        if (body.departmentId) {
          departmentId = body.departmentId;
        }
      } catch {
        // Usa o padrão se não houver body
      }
    }

    console.log(`Fetching templates from Zap Responder API with departmentId: ${departmentId}`);
    
    const response = await fetch(`${WHATSAPP_API_BASE}/templates?departmentId=${departmentId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error from Zap Responder:', response.status, errorText);
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }

    const responseData = await response.json();
    // API pode retornar { templates: [...] } ou diretamente um array
    const templates = responseData?.templates || responseData || [];
    const templateArray = Array.isArray(templates) ? templates : [];
    console.log(`Found ${templateArray.length} templates`);

    return new Response(JSON.stringify({ templates: templateArray }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error listing templates:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
