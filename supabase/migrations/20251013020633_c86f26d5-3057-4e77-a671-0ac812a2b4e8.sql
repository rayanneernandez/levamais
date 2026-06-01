-- Add INSERT policy for clients table to allow signup
CREATE POLICY "Users can create own client record"
ON public.clients
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Ensure CPF uniqueness at database level
ALTER TABLE public.clients
ADD CONSTRAINT clients_cpf_unique UNIQUE (cpf);

-- Add INSERT policy for user_roles to allow client role assignment during signup
CREATE POLICY "Users can assign client role to themselves"
ON public.user_roles
FOR INSERT
WITH CHECK (
  auth.uid() = user_id 
  AND role = 'client'::app_role
);