import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyCodeRequest {
  cpf: string;
  code: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { cpf, code }: VerifyCodeRequest = await req.json();

    if (!cpf || !code) {
      throw new Error("CPF e código são obrigatórios");
    }

    // Limpar CPF
    const cleanCPF = cpf.replace(/\D/g, '');
    console.log(`🔍 Verificando código para CPF: ${cleanCPF}`);

    // Buscar código válido
    const { data: verification, error: verificationError } = await supabaseAdmin
      .from("client_login_verification_codes")
      .select("*")
      .eq("cpf", cleanCPF)
      .eq("code", code)
      .eq("used", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (verificationError || !verification) {
      console.error("Código não encontrado ou inválido:", verificationError);
      throw new Error("Código inválido ou expirado");
    }

    console.log(`✅ Código válido encontrado`);

    // Marcar código como usado
    await supabaseAdmin
      .from("client_login_verification_codes")
      .update({ 
        used: true, 
        used_at: new Date().toISOString() 
      })
      .eq("id", verification.id);

    // Buscar cliente
    const { data: clients, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("id, full_name, user_id, cpf, email")
      .eq("cpf", cleanCPF)
      .order("favorite_network_id", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1);

    if (clientError || !clients || clients.length === 0) {
      console.error("Erro ao buscar cliente:", clientError);
      throw new Error("Cliente não encontrado");
    }

    const client = clients[0];
    
    if (!client.user_id) {
      throw new Error("Cliente sem acesso ao portal");
    }

    console.log(`✅ Cliente encontrado: ${client.full_name}`);

    // Usar email do próprio cliente ou buscar no profile
    let email = client.email;
    
    if (!email) {
      // Buscar email do profile se não estiver no cliente
      const { data: profile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .eq("id", client.user_id)
        .maybeSingle();

      if (profileError || !profile?.email) {
        console.error("Erro ao buscar profile:", profileError);
        throw new Error("Email não encontrado");
      }

      email = profile.email;
    }

    // Verificar se usuário tem role de cliente
    const { data: role } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", client.user_id)
      .eq("role", "client")
      .maybeSingle();

    if (!role) {
      throw new Error("Acesso não autorizado");
    }

    // Criar um link de login mágico
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: email
    });

    if (linkError) {
      console.error("Erro ao gerar link:", linkError);
      throw new Error("Erro ao criar sessão de login");
    }

    console.log(`✅ Login passwordless bem-sucedido para ${email}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        email,
        name: client.full_name,
        magicLink: linkData.properties.action_link
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Erro em verify-client-login-code:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
