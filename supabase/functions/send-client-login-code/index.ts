import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { sendEmail } from "../_shared/email-provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LoginCodeRequest {
  cpf: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { cpf }: LoginCodeRequest = await req.json();

    if (!cpf) {
      throw new Error("CPF é obrigatório");
    }

    // Limpar CPF (remover pontos e traços)
    const cleanCPF = cpf.replace(/\D/g, '');
    console.log(`🔍 Buscando cliente com CPF: ${cleanCPF}`);

    // Buscar cliente pelo CPF
    const { data: clients, error: clientError } = await supabase
      .from("clients")
      .select("id, full_name, user_id, cpf, email")
      .eq("cpf", cleanCPF)
      .order("favorite_network_id", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1);

    if (clientError) {
      console.error("Erro ao buscar cliente:", clientError);
      throw new Error("Erro ao buscar cliente no sistema");
    }

    if (!clients || clients.length === 0) {
      console.error(`❌ Nenhum cliente encontrado com CPF: ${cleanCPF}`);
      throw new Error("Cliente não encontrado. Verifique se o CPF está correto.");
    }

    const client = clients[0];
    console.log(`✅ Cliente encontrado: ${client.full_name}, user_id: ${client.user_id}`);

    if (!client.user_id) {
      throw new Error("Cliente ainda não possui acesso ao portal. Solicite seu convite primeiro.");
    }

    // Usar email do próprio cliente ou buscar no profile
    let email = client.email;
    
    if (!email) {
      // Buscar email do profile se não estiver no cliente
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", client.user_id)
        .maybeSingle();

      if (profileError || !profile?.email) {
        console.error("Erro ao buscar profile:", profileError);
        throw new Error("Email não cadastrado para este cliente");
      }
      
      email = profile.email;
    }

    console.log(`📧 Email encontrado: ${email}`);

    // Verificar se já existe código recente (últimos 2 minutos) para evitar spam
    const { data: recentCodes, error: recentError } = await supabase
      .from("client_login_verification_codes")
      .select("created_at")
      .eq("cpf", cleanCPF)
      .gte("created_at", new Date(Date.now() - 2 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(1);

    if (recentError) {
      console.error("Erro ao verificar códigos recentes:", recentError);
    }

    if (recentCodes && recentCodes.length > 0) {
      const timeSinceLastCode = Date.now() - new Date(recentCodes[0].created_at).getTime();
      const secondsRemaining = Math.ceil((2 * 60 * 1000 - timeSinceLastCode) / 1000);
      
      throw new Error(`Aguarde ${secondsRemaining} segundos antes de solicitar um novo código.`);
    }

    // Gerar código de 6 dígitos
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Salvar código no banco (expira em 5 minutos)
    const { error: dbError } = await supabase
      .from("client_login_verification_codes")
      .insert({
        cpf: cleanCPF,
        email,
        code,
        ip_address: req.headers.get("x-forwarded-for") || "unknown",
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutos
      });

    if (dbError) {
      console.error("Erro ao salvar código:", dbError);
      throw new Error("Erro ao gerar código de verificação");
    }

    console.log(`💾 Código salvo no banco para CPF ${cleanCPF}`);

    // Enviar email
    const emailResult = await sendEmail(
      {
        to: email,
        subject: "Código de Login - Leva+ Portal",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #40b9d9;">Seu Código de Login</h1>
            <p>Olá, ${client.full_name.split(' ')[0]}!</p>
            <p>Use o código abaixo para fazer login no portal Leva+:</p>
            <div style="background: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 20px 0; border-radius: 8px;">
              ${code}
            </div>
            <p style="color: #666; font-size: 14px;">Este código é válido por 5 minutos.</p>
            <p style="color: #666; font-size: 14px;">Se você não solicitou este código, ignore este email.</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
            <p style="color: #999; font-size: 12px;">Leva+ Fidelidade - Login Simplificado</p>
          </div>
        `,
        from: "Leva+ Login <noreply@updates.levamais.app>",
      },
      "internal_email"
    );

    if (!emailResult.success) {
      console.error("Erro ao enviar email:", emailResult.error);
      throw new Error("Erro ao enviar código por email");
    }

    console.log(`✅ Código enviado para ${email} via ${emailResult.provider}`);

    // Mascarar email melhor (ex: br***@br***.com)
    const [localPart, domain] = email.split('@');
    const [domainName, domainExt] = domain.split('.');
    const maskedEmail = `${localPart.substring(0, 2)}***@${domainName.substring(0, 2)}***.${domainExt}`;

    return new Response(
      JSON.stringify({ 
        success: true,
        email: maskedEmail
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Erro em send-client-login-code:", error);
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
