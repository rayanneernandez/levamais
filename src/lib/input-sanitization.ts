import { z } from "zod";

/**
 * Limites padrão de caracteres para campos do sistema.
 * Centralizado para garantir consistência e facilitar ajustes globais.
 */
export const LIMITS = {
  NAME: 100,            // Nome / Razão social
  EMAIL: 100,           // E-mail (RFC permite 254, mas 100 cobre 99,99% dos casos reais)
  PHONE: 15,            // Telefone com máscara: (31) 99999-9999
  CPF_CNPJ: 18,         // CPF/CNPJ com máscara
  SHORT_CODE: 30,       // SKU, código de funcionário, etc.
  ADDRESS: 150,         // Rua / Endereço
  CITY: 60,             // Cidade
  STATE: 60,            // Estado
  CEP: 9,               // 00000-000
  SHORT_TEXT: 200,      // Título, nome de promoção
  MEDIUM_TEXT: 500,     // Observações, comentários
  LONG_TEXT: 2000,      // Descrição completa, mensagem
  URL: 500,             // Links externos
  PASSWORD: 72,         // Limite do bcrypt
} as const;

/**
 * Helper Zod: string com trim automático e limite de caracteres.
 * Use para campos de texto comuns (nome, código, observação, etc.).
 */
export function trimmedString(max: number, opts?: { min?: number; minMessage?: string; maxMessage?: string }) {
  let schema = z
    .string()
    .trim()
    .max(max, opts?.maxMessage ?? `Máximo de ${max} caracteres`);

  if (opts?.min !== undefined && opts.min > 0) {
    schema = schema.min(opts.min, opts.minMessage ?? `Mínimo de ${opts.min} caracteres`);
  }

  return schema;
}

/**
 * Helper Zod: e-mail com trim, lowercase e validação de formato.
 */
export function trimmedEmail(max: number = LIMITS.EMAIL) {
  return z
    .string()
    .trim()
    .toLowerCase()
    .email("E-mail inválido")
    .max(max, `E-mail deve ter no máximo ${max} caracteres`);
}

/**
 * Helper Zod: string opcional (aceita vazio) com trim e limite.
 */
export function trimmedOptional(max: number) {
  return z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres`)
    .optional()
    .or(z.literal(""));
}

/**
 * Função utilitária para uso fora de Zod (ex: limpar valor antes de submit manual).
 * Remove espaços nas pontas e limita o tamanho.
 */
export function cleanText(value: string | null | undefined, max?: number): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (max !== undefined && trimmed.length > max) {
    return trimmed.slice(0, max);
  }
  return trimmed;
}

/**
 * Versão para e-mail: trim + lowercase + limite.
 */
export function cleanEmail(value: string | null | undefined, max: number = LIMITS.EMAIL): string {
  if (!value) return "";
  return cleanText(value.toLowerCase(), max);
}
