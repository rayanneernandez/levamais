-- Resetar senhas de todos os atendentes existentes para Leva+2025
-- Marcar que precisam trocar senha

-- Atualizar profiles para forçar troca de senha
UPDATE public.profiles
SET force_password_change = true
WHERE id IN (
  SELECT DISTINCT user_id 
  FROM store_managers 
  WHERE is_attendant = true
);

-- Gerar códigos para atendentes que não têm
-- (Trigger vai gerar automaticamente ao atualizar)
UPDATE public.store_managers
SET is_attendant = true
WHERE is_attendant = true AND attendant_code IS NULL;