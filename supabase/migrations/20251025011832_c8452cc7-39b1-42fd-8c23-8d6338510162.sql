-- Adicionar campo de e-mail para notificações de resgate nas regras de pontos
ALTER TABLE attendant_points_rules 
ADD COLUMN redemption_notification_email text;

-- Comentário explicativo
COMMENT ON COLUMN attendant_points_rules.redemption_notification_email IS 'E-mail que receberá notificações de resgates de recompensas';
