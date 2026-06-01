-- Criar tabelas de referência geográfica do Brasil
CREATE TABLE IF NOT EXISTS public.br_estados (
  id SERIAL PRIMARY KEY,
  sigla TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.br_cidades (
  id SERIAL PRIMARY KEY,
  estado_sigla TEXT NOT NULL,
  nome TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(estado_sigla, nome)
);

CREATE TABLE IF NOT EXISTS public.br_municipios (
  id SERIAL PRIMARY KEY,
  estado_sigla TEXT NOT NULL,
  cidade_nome TEXT NOT NULL,
  nome TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(estado_sigla, cidade_nome, nome)
);

-- Inserir todos os estados do Brasil
INSERT INTO public.br_estados (sigla, nome) VALUES
  ('AC', 'Acre'),
  ('AL', 'Alagoas'),
  ('AP', 'Amapá'),
  ('AM', 'Amazonas'),
  ('BA', 'Bahia'),
  ('CE', 'Ceará'),
  ('DF', 'Distrito Federal'),
  ('ES', 'Espírito Santo'),
  ('GO', 'Goiás'),
  ('MA', 'Maranhão'),
  ('MT', 'Mato Grosso'),
  ('MS', 'Mato Grosso do Sul'),
  ('MG', 'Minas Gerais'),
  ('PA', 'Pará'),
  ('PB', 'Paraíba'),
  ('PR', 'Paraná'),
  ('PE', 'Pernambuco'),
  ('PI', 'Piauí'),
  ('RJ', 'Rio de Janeiro'),
  ('RN', 'Rio Grande do Norte'),
  ('RS', 'Rio Grande do Sul'),
  ('RO', 'Rondônia'),
  ('RR', 'Roraima'),
  ('SC', 'Santa Catarina'),
  ('SP', 'São Paulo'),
  ('SE', 'Sergipe'),
  ('TO', 'Tocantins')
ON CONFLICT (sigla) DO NOTHING;

-- Inserir cidades principais do Brasil (exemplo com capitais e principais cidades)
INSERT INTO public.br_cidades (estado_sigla, nome) VALUES
  -- Rio de Janeiro
  ('RJ', 'Rio de Janeiro'),
  ('RJ', 'Niterói'),
  ('RJ', 'São Gonçalo'),
  ('RJ', 'Duque de Caxias'),
  ('RJ', 'Nova Iguaçu'),
  ('RJ', 'Campos dos Goytacazes'),
  ('RJ', 'Petrópolis'),
  ('RJ', 'Volta Redonda'),
  -- São Paulo
  ('SP', 'São Paulo'),
  ('SP', 'Campinas'),
  ('SP', 'Santos'),
  ('SP', 'São Bernardo do Campo'),
  ('SP', 'Guarulhos'),
  ('SP', 'Ribeirão Preto'),
  ('SP', 'Sorocaba'),
  ('SP', 'São José dos Campos'),
  -- Minas Gerais
  ('MG', 'Belo Horizonte'),
  ('MG', 'Uberlândia'),
  ('MG', 'Contagem'),
  ('MG', 'Juiz de Fora'),
  -- Demais capitais
  ('AC', 'Rio Branco'),
  ('AL', 'Maceió'),
  ('AP', 'Macapá'),
  ('AM', 'Manaus'),
  ('BA', 'Salvador'),
  ('CE', 'Fortaleza'),
  ('DF', 'Brasília'),
  ('ES', 'Vitória'),
  ('GO', 'Goiânia'),
  ('MA', 'São Luís'),
  ('MT', 'Cuiabá'),
  ('MS', 'Campo Grande'),
  ('PA', 'Belém'),
  ('PB', 'João Pessoa'),
  ('PR', 'Curitiba'),
  ('PE', 'Recife'),
  ('PI', 'Teresina'),
  ('RN', 'Natal'),
  ('RS', 'Porto Alegre'),
  ('RO', 'Porto Velho'),
  ('RR', 'Boa Vista'),
  ('SC', 'Florianópolis'),
  ('SE', 'Aracaju'),
  ('TO', 'Palmas')
ON CONFLICT (estado_sigla, nome) DO NOTHING;

-- Inserir alguns municípios/bairros de exemplo (Rio de Janeiro)
INSERT INTO public.br_municipios (estado_sigla, cidade_nome, nome) VALUES
  ('RJ', 'Rio de Janeiro', 'Centro'),
  ('RJ', 'Rio de Janeiro', 'Copacabana'),
  ('RJ', 'Rio de Janeiro', 'Ipanema'),
  ('RJ', 'Rio de Janeiro', 'Leblon'),
  ('RJ', 'Rio de Janeiro', 'Barra da Tijuca'),
  ('RJ', 'Rio de Janeiro', 'Tijuca'),
  ('RJ', 'Rio de Janeiro', 'Botafogo'),
  ('RJ', 'Rio de Janeiro', 'Flamengo'),
  ('RJ', 'Rio de Janeiro', 'Jacarepaguá'),
  ('RJ', 'Rio de Janeiro', 'Campo Grande'),
  ('RJ', 'Rio de Janeiro', 'Bangu'),
  ('RJ', 'Rio de Janeiro', 'Santa Cruz'),
  ('RJ', 'Niterói', 'Centro'),
  ('RJ', 'Niterói', 'Icaraí'),
  ('RJ', 'Niterói', 'São Francisco'),
  ('SP', 'São Paulo', 'Centro'),
  ('SP', 'São Paulo', 'Pinheiros'),
  ('SP', 'São Paulo', 'Vila Mariana'),
  ('SP', 'São Paulo', 'Mooca'),
  ('MG', 'Belo Horizonte', 'Centro'),
  ('MG', 'Belo Horizonte', 'Savassi')
ON CONFLICT (estado_sigla, cidade_nome, nome) DO NOTHING;

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_br_cidades_estado ON public.br_cidades(estado_sigla);
CREATE INDEX IF NOT EXISTS idx_br_municipios_estado_cidade ON public.br_municipios(estado_sigla, cidade_nome);

-- Habilitar RLS
ALTER TABLE public.br_estados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.br_cidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.br_municipios ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso (todos podem ler, apenas admins podem modificar)
CREATE POLICY "Todos podem visualizar estados"
  ON public.br_estados FOR SELECT
  USING (true);

CREATE POLICY "Todos podem visualizar cidades"
  ON public.br_cidades FOR SELECT
  USING (true);

CREATE POLICY "Todos podem visualizar municípios"
  ON public.br_municipios FOR SELECT
  USING (true);

CREATE POLICY "Admins podem gerenciar estados"
  ON public.br_estados FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem gerenciar cidades"
  ON public.br_cidades FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem gerenciar municípios"
  ON public.br_municipios FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));