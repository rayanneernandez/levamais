import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/sms-provider.ts";
import { sendEmail } from "../_shared/email-provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TransactionMessageRequest {
  transaction_id: string;
  message_type: "resgate" | "acumulo";
}

// Helper para substituir variáveis na mensagem
function replaceVariables(template: string, variables: Record<string, string>): string {
  let result = template;
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, value);
  });
  return result;
}

// Helper para formatar valor monetário
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { transaction_id, message_type }: TransactionMessageRequest = await req.json();

    console.log(`📨 Processando mensagem de ${message_type} para transação ${transaction_id}`);

    // Buscar dados da transação
    const { data: transaction, error: transactionError } = await supabase
      .from("transactions")
      .select(`
        *,
        client:clients(id, full_name, phone, email, network_id, favorite_network_id, user_id),
        store:stores(network_id, loyalty_type)
      `)
      .eq("id", transaction_id)
      .single();

    if (transactionError || !transaction) {
      console.error("Erro ao buscar transação:", transactionError);
      throw new Error("Transação não encontrada");
    }

    const client = transaction.client;
    const networkId = transaction.store.network_id;
    
    // Buscar dados da rede favorita do cliente para saber o loyalty_type correto
    const { data: favoriteNetwork } = await supabase
      .from("networks")
      .select("loyalty_type")
      .eq("id", client.favorite_network_id)
      .single();
    
    const favoriteNetworkLoyaltyType = favoriteNetwork?.loyalty_type || transaction.store.loyalty_type;

    // Buscar templates habilitados para envio automático
    const { data: templates, error: templatesError } = await supabase
      .from("marketing_message_templates")
      .select("*")
      .eq("network_id", networkId)
      .eq("template_type", message_type)
      .eq("auto_send_enabled", true)
      .eq("is_active", true);

    if (templatesError) {
      console.error("Erro ao buscar templates:", templatesError);
      throw templatesError;
    }

    if (!templates || templates.length === 0) {
      console.log(`Nenhum template automático configurado para ${message_type}`);
      return new Response(
        JSON.stringify({ message: "Nenhum template automático configurado", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // 🔐 VERIFICAR CRÉDITOS DISPONÍVEIS PARA CADA CANAL
    const { data: networkData, error: networkError } = await supabase
      .from("networks")
      .select("sms_marketing_limit, sms_marketing_used, email_marketing_limit, email_marketing_used, whatsapp_marketing_limit, whatsapp_marketing_used")
      .eq("id", networkId)
      .single();

    if (networkError || !networkData) {
      console.error("Erro ao buscar dados da rede:", networkError);
      throw new Error("Erro ao verificar créditos disponíveis");
    }

    // Preparar variáveis para substituição
    // Usar 'points' que contém o valor correto (positivo ou negativo)
    const valorTransacao = Math.abs(Number(transaction.points) || 0);
    
    // Buscar saldo da rede FAVORITA do cliente
    const { data: favoriteClientData, error: favoriteError } = await supabase
      .from("clients")
      .select("total_points, network_id")
      .eq("user_id", client.user_id)
      .eq("network_id", client.favorite_network_id)
      .single();

    if (favoriteError) {
      console.error("Erro ao buscar saldo favorito:", favoriteError);
    }

    const saldoFavorito = Number(favoriteClientData?.total_points) || 0;
    
    console.log(`💰 Saldo da rede favorita (${client.favorite_network_id}): ${saldoFavorito}`);
    
    // Extrair apenas o primeiro nome
    const primeiroNome = (client.full_name || "Cliente").split(" ")[0];
    
    // Formatar valores baseado no tipo de fidelidade da rede FAVORITA
    const valor = favoriteNetworkLoyaltyType === 'points' 
      ? `${valorTransacao.toFixed(0)} pontos`
      : formatCurrency(valorTransacao);
      
    const saldo = favoriteNetworkLoyaltyType === 'points'
      ? `${saldoFavorito.toFixed(0)} pontos`
      : formatCurrency(saldoFavorito);

    const variables = {
      nome: primeiroNome,
      valor: valor,
      saldo: saldo,
    };
    
    console.log('📊 Variáveis da mensagem:', variables);

    const messagesSent = [];

    // Enviar mensagem para cada canal configurado
    for (const template of templates) {
      try {
        // 🔐 VERIFICAR CRÉDITO ANTES DE ENVIAR
        let hasCredit = false;
        let limitField = '';
        let usedField = '';
        
        if (template.channel === "sms") {
          hasCredit = (networkData.sms_marketing_limit - networkData.sms_marketing_used) > 0;
          limitField = 'sms_marketing_used';
        } else if (template.channel === "email") {
          hasCredit = (networkData.email_marketing_limit - networkData.email_marketing_used) > 0;
          limitField = 'email_marketing_used';
        } else if (template.channel === "whatsapp") {
          hasCredit = (networkData.whatsapp_marketing_limit - networkData.whatsapp_marketing_used) > 0;
          limitField = 'whatsapp_marketing_used';
        }

        if (!hasCredit) {
          console.error(`❌ Crédito esgotado para ${template.channel}! Rede: ${networkId}`);
          messagesSent.push({ 
            channel: template.channel, 
            success: false, 
            error: `Crédito de ${template.channel} esgotado. Não é possível enviar mensagens até recarregar.`
          });
          continue; // Pula para o próximo template
        }

        const message = replaceVariables(template.message_content, variables);
        
        console.log(`Enviando via ${template.channel} para ${client.full_name}`);
        
        // Enviar por canal
        if (template.channel === "email" && client.email) {
          // Enviar email usando o provider configurado
          try {
            const emailResult = await sendEmail(
              {
                to: client.email,
                subject: `Leva+ - ${message_type === "acumulo" ? "Pontos acumulados!" : "Resgate realizado!"}`,
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h1>Olá, ${primeiroNome}!</h1>
                    <p>${message}</p>
                    <hr />
                    <p style="color: #666; font-size: 12px;">Leva+ Fidelidade</p>
                  </div>
                `,
              },
              "client_email"
            );

            if (!emailResult.success) {
              throw new Error(emailResult.error || "Falha ao enviar email");
            }

            console.log(`📧 Email enviado com sucesso via ${emailResult.provider}:`, emailResult.emailId);
            messagesSent.push({ 
              channel: "email", 
              success: true, 
              emailId: emailResult.emailId,
              provider: emailResult.provider
            });
            
            // Incrementar consumo
            await supabase
              .from("networks")
              .update({ email_marketing_used: networkData.email_marketing_used + 1 })
              .eq("id", networkId);
            
            // 📝 REGISTRAR DISPARO NO HISTÓRICO
            const campaignName = message_type === "acumulo" 
              ? "Email Transacional - Acúmulo" 
              : "Email Transacional - Resgate";
            
            await supabase
              .from("marketing_campaigns")
              .insert({
                network_id: networkId,
                campaign_name: campaignName,
                campaign_type: "email",
                sent_count: 1,
                status: "completed"
              });
              
          } catch (emailError) {
            console.error("Erro ao enviar email:", emailError);
            messagesSent.push({ 
              channel: "email", 
              success: false, 
              error: emailError instanceof Error ? emailError.message : String(emailError)
            });
          }
            
        } else if (template.channel === "whatsapp" && client.phone) {
          // TODO: Integrar com Twilio WhatsApp
          console.log(`📱 WhatsApp: ${message}`);
          messagesSent.push({ channel: "whatsapp", success: true });
          
          // Incrementar consumo
          await supabase
            .from("networks")
            .update({ whatsapp_marketing_used: networkData.whatsapp_marketing_used + 1 })
            .eq("id", networkId);
          
          // 📝 REGISTRAR DISPARO NO HISTÓRICO
          const campaignName = message_type === "acumulo" 
            ? "WhatsApp Transacional - Acúmulo" 
            : "WhatsApp Transacional - Resgate";
          
          await supabase
            .from("marketing_campaigns")
            .insert({
              network_id: networkId,
              campaign_name: campaignName,
              campaign_type: "whatsapp",
              sent_count: 1,
              status: "completed"
            });
            
        } else if (template.channel === "sms" && client.phone) {
          // Enviar SMS usando o provider configurado
          try {
            const smsResult = await sendSMS(client.phone, message, "client_sms");

            if (!smsResult.success) {
              throw new Error(smsResult.error || "Falha ao enviar SMS");
            }

            console.log(`💬 SMS enviado com sucesso via ${smsResult.provider}:`, smsResult.messageId);
            messagesSent.push({ 
              channel: "sms", 
              success: true, 
              messageId: smsResult.messageId,
              provider: smsResult.provider 
            });
            
            // ✅ INCREMENTAR CONSUMO DE SMS
            await supabase
              .from("networks")
              .update({ sms_marketing_used: networkData.sms_marketing_used + 1 })
              .eq("id", networkId);
            
            console.log(`📊 Consumo atualizado: ${networkData.sms_marketing_used + 1}/${networkData.sms_marketing_limit}`);
            
            // 📝 REGISTRAR DISPARO NO HISTÓRICO
            const campaignName = message_type === "acumulo" 
              ? "SMS Transacional - Acúmulo" 
              : "SMS Transacional - Resgate";
            
            await supabase
              .from("marketing_campaigns")
              .insert({
                network_id: networkId,
                campaign_name: campaignName,
                campaign_type: "sms",
                sent_count: 1,
                status: "completed"
              });
            
          } catch (smsError) {
            console.error("Erro ao enviar SMS:", smsError);
            messagesSent.push({ 
              channel: "sms", 
              success: false, 
              error: smsError instanceof Error ? smsError.message : String(smsError)
            });
          }
        }
      } catch (error) {
        console.error(`Erro ao enviar via ${template.channel}:`, error);
        messagesSent.push({ 
          channel: template.channel, 
          success: false, 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }

    return new Response(
      JSON.stringify({
        message: `Mensagens processadas para ${client.full_name}`,
        transaction_id,
        message_type,
        sent: messagesSent,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    console.error("Erro geral:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
