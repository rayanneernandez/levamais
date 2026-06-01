/**
 * Configuração de versionamento da plataforma
 * Formato: YY.MM.PATCH
 *
 * A cada deploy/atualização, incremente apenas o número PATCH:
 * - Início do mês: 25.10.1
 * - Segunda atualização: 25.10.2
 * - Terceira atualização: 25.10.3
 * - Próximo mês: 25.11.1 (resetar PATCH)
 */

const now = new Date();
const year = now.getFullYear().toString().slice(-2);
const month = String(now.getMonth() + 1).padStart(2, "0");

// Incrementar este número a cada deploy
const PATCH_VERSION = 5;

export const APP_VERSION = `${year}.${month}.${PATCH_VERSION}`;
export const APP_VERSION_DATE = now.toISOString().split("T")[0];
