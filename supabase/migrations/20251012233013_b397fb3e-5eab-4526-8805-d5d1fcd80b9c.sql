-- Criar tabela de perfis de acesso
CREATE TABLE IF NOT EXISTS public.access_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de menus disponíveis no sistema
CREATE TABLE IF NOT EXISTS public.system_menus (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES public.system_menus(id),
  route TEXT,
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de permissões (leitura, edição, etc)
CREATE TYPE public.permission_type AS ENUM ('read', 'create', 'update', 'delete', 'export');

-- Criar tabela que relaciona perfis com menus e suas permissões
CREATE TABLE IF NOT EXISTS public.profile_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.access_profiles(id) ON DELETE CASCADE,
  menu_id UUID NOT NULL REFERENCES public.system_menus(id) ON DELETE CASCADE,
  permissions permission_type[] NOT NULL DEFAULT ARRAY[]::permission_type[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(profile_id, menu_id)
);

-- Adicionar coluna de perfil na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS access_profile_id UUID REFERENCES public.access_profiles(id);

-- Enable RLS
ALTER TABLE public.access_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_permissions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para access_profiles
CREATE POLICY "Admins can view all access profiles"
ON public.access_profiles FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create access profiles"
ON public.access_profiles FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update access profiles"
ON public.access_profiles FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete access profiles"
ON public.access_profiles FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Políticas RLS para system_menus
CREATE POLICY "Everyone can view system menus"
ON public.system_menus FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage system menus"
ON public.system_menus FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Políticas RLS para profile_permissions
CREATE POLICY "Admins can view all profile permissions"
ON public.profile_permissions FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage profile permissions"
ON public.profile_permissions FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Inserir menus padrão do sistema
INSERT INTO public.system_menus (name, display_name, description, route, icon, sort_order) VALUES
('dashboard', 'Dashboard', 'Painel principal com métricas gerais', '/adm/dashboard', 'LayoutDashboard', 1),
('empresas', 'Empresas', 'Gerenciamento de redes de empresas', '/adm/empresas', 'Building2', 2),
('licencas', 'Licenças', 'Configuração de licenças e mensalidades', '/adm/licencas', 'FileText', 3),
('lojas', 'Lojas', 'Gerenciamento de lojas das redes', '/adm/lojas', 'Store', 4),
('usuarios', 'Usuários', 'Gerenciamento de usuários do sistema', '/adm/usuarios', 'Users', 5),
('perfis', 'Perfis de Acesso', 'Gerenciamento de perfis e permissões', '/adm/perfis', 'Shield', 6)
ON CONFLICT (name) DO NOTHING;

-- Criar perfil padrão de Administrador
INSERT INTO public.access_profiles (name, description) VALUES
('Administrador', 'Acesso total ao sistema')
ON CONFLICT (name) DO NOTHING;

-- Dar todas as permissões ao perfil Administrador
INSERT INTO public.profile_permissions (profile_id, menu_id, permissions)
SELECT 
  ap.id,
  sm.id,
  ARRAY['read', 'create', 'update', 'delete', 'export']::permission_type[]
FROM public.access_profiles ap
CROSS JOIN public.system_menus sm
WHERE ap.name = 'Administrador'
ON CONFLICT (profile_id, menu_id) DO NOTHING;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_access_profiles_updated_at
  BEFORE UPDATE ON public.access_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profile_permissions_updated_at
  BEFORE UPDATE ON public.profile_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Comentários
COMMENT ON TABLE public.access_profiles IS 'Perfis de acesso do sistema';
COMMENT ON TABLE public.system_menus IS 'Menus disponíveis no sistema';
COMMENT ON TABLE public.profile_permissions IS 'Permissões de cada perfil por menu';
COMMENT ON TYPE public.permission_type IS 'Tipos de permissão: leitura, criação, edição, exclusão, exportação';