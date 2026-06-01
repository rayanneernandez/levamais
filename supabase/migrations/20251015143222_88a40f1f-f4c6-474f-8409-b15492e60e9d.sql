
-- Redefinir senha do usuário bruno@redejb.com.br
UPDATE auth.users 
SET encrypted_password = crypt('Global@2025', gen_salt('bf')),
    email_confirmed_at = NOW()
WHERE email = 'bruno@redejb.com.br';

-- Garantir que deve mudar a senha no primeiro login
UPDATE public.store_managers
SET must_change_password = true
WHERE user_id = '569cc5d3-4a61-4a8c-a268-829ab4e9ad0f';
