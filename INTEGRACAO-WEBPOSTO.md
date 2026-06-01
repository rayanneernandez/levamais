# Integração Leva+ com webPosto - Endpoints da API

## Informações Gerais

**Base URL:** `https://auivszkscfcpczrkecoc.supabase.co/functions/v1`

**Autenticação:** Bearer Token (API Key)

Todas as requisições (exceto `/auth-token`) devem incluir o header:
```
Authorization: Bearer {sua_api_key}
```

---

## 1. Autenticação (Gerar Token)

**Endpoint:** `POST /auth-token`

**Descrição:** Gera um bearer token para usar nos demais endpoints (opcional se usar API Key fixa)

**Request Body:**
```json
{
  "usuario": "parceiro.webposto",
  "senha": "S3nh@F0rte!",
  "codigoEmpresa": "10.825.333/0002-91"
}
```

**Response (200):**
```json
{
  "bearerToken": "leva_live_sk_..."
}
```

**Headers da Response:**
```
Authorization: Bearer leva_live_sk_...
```

---

## 2. Pré-Venda (Validar Voucher/CPF)

**Endpoint:** `POST /venda-validar`

**Descrição:** Valida o voucher/CPF do cliente e retorna o `idTransacao` para usar no pós-venda. Determina se é pontuação (P), desconto (D) ou resgate de cashback (R).

**Request Body:**
```json
{
  "codigoEmpresa": "10.353.336/0001-91",
  "codigoVoucher": "123.456.789-09",
  "horaVenda": "14:13:50",
  "dataVenda": "08/12/2023",
  "codigoVenda": "6978",
  "produtos": [
    {
      "codigoSequencia": 1,
      "codigoColaborador": 2,
      "nomeColaborador": "ANTONIO CARLOS",
      "codigoProduto": "00001",
      "nomeProduto": "GASOLINA COMUM",
      "valorVenda": 50.0,
      "quantidade": 10.225,
      "valorUnitario": 4.89
    }
  ]
}
```

**Response (200) - Pontuação:**
```json
{
  "idTransacao": "19640141abc123",
  "tipoCodigo": "P",
  "valorCashBack": null,
  "valorPorUnidadeDesconto": null,
  "mensagemErro": null,
  "tipoPagamento": [0],
  "produtos": [
    {
      "codigoSequencia": 1,
      "codigoColaborador": 2,
      "nomeColaborador": "ANTONIO CARLOS",
      "codigoProduto": "00001",
      "nomeProduto": "GASOLINA COMUM",
      "valorVenda": 50.0,
      "quantidade": 10.225,
      "valorUnitario": 4.89
    }
  ]
}
```

**Response (200) - Resgate de Cashback:**
```json
{
  "idTransacao": "19640141abc123",
  "tipoCodigo": "R",
  "valorCashBack": 5.0,
  "valorPorUnidadeDesconto": null,
  "mensagemErro": null,
  "tipoPagamento": [1, 3],
  "produtos": []
}
```

**Tipos de Código:**
- `P` = Pontuação (acúmulo de pontos/cashback)
- `R` = Resgate de cashback
- `D` = Desconto (não implementado nesta versão)

**Tipos de Pagamento:**
- 0 = Todos
- 1 = Dinheiro
- 2 = Crédito (TEF)
- 3 = Débito (TEF)
- 11 = Transferência/PIX

---

## 3. Pós-Venda (Confirmar Venda)

**Endpoint:** `POST /venda-enviar`

**Descrição:** Confirma a venda e efetiva o acúmulo de pontos/cashback ou o resgate. Deve ser chamado após finalizar a venda no PDV.

**Request Body:**
```json
{
  "codigoEmpresa": "10.333.333/0001-00",
  "codigoVenda": "6978",
  "idTransacao": "19640141abc123",
  "produtos": [
    {
      "codigoSequencia": 1,
      "codigoColaborador": 2,
      "nomeColaborador": "ANTONIO CARLOS",
      "codigoProduto": "00001",
      "nomeProduto": "GASOLINA COMUM",
      "valorVenda": 50.0,
      "quantidade": 10.225,
      "valorUnitario": 4.89
    }
  ],
  "pagamentos": [
    {
      "descricaoFormaPagamento": "DINHEIRO",
      "tipoPagamento": 1,
      "valorPagamento": 38.5,
      "idTransacao": ""
    }
  ]
}
```

**Response (202):**
Sem corpo. Status 202 indica que a venda foi recebida e processada.

**Response (409):**
Venda já foi confirmada anteriormente (idempotência).

---

## 4. Cancelamento

**Endpoint:** `POST /venda-cancelar`

**Descrição:** Cancela uma transação e reverte os pontos/cashback acumulados ou resgatados.

**Request Body:**
```json
{
  "codigoEmpresa": "10.825.333/0002-91",
  "codigoVenda": "6978",
  "idTransacao": "19640141abc123"
}
```

**Response (200):**
```json
{
  "codigoEmpresa": "10.825.333/0002-91",
  "codigoVenda": "6978",
  "idTransacao": "19640141abc123"
}
```

**Response (404):**
```json
{
  "code": "NOT_FOUND",
  "message": "Transação não encontrada"
}
```

---

## Fluxo Completo de Integração

### 1. Autenticação (opcional)
```bash
curl -X POST https://auivszkscfcpczrkecoc.supabase.co/functions/v1/auth-token \
  -H "Content-Type: application/json" \
  -d '{
    "usuario": "parceiro.webposto",
    "senha": "S3nh@F0rte!",
    "codigoEmpresa": "10.825.333/0002-91"
  }'
```

### 2. Pré-Venda (ao clicar em Fidelidade no PDV)
```bash
curl -X POST https://auivszkscfcpczrkecoc.supabase.co/functions/v1/venda-validar \
  -H "Authorization: Bearer {api_key}" \
  -H "Content-Type: application/json" \
  -d '{
    "codigoEmpresa": "10.353.336/0001-91",
    "codigoVoucher": "123.456.789-09",
    "horaVenda": "14:13:50",
    "dataVenda": "08/12/2023",
    "codigoVenda": "6978",
    "produtos": [...]
  }'
```

### 3. Pós-Venda (após finalizar venda)
```bash
curl -X POST https://auivszkscfcpczrkecoc.supabase.co/functions/v1/venda-enviar \
  -H "Authorization: Bearer {api_key}" \
  -H "Content-Type: application/json" \
  -d '{
    "codigoEmpresa": "10.333.333/0001-00",
    "codigoVenda": "6978",
    "idTransacao": "19640141abc123",
    "produtos": [...],
    "pagamentos": [...]
  }'
```

### 4. Cancelamento (se necessário)
```bash
curl -X POST https://auivszkscfcpczrkecoc.supabase.co/functions/v1/venda-cancelar \
  -H "Authorization: Bearer {api_key}" \
  -H "Content-Type: application/json" \
  -d '{
    "codigoEmpresa": "10.825.333/0002-91",
    "codigoVenda": "6978",
    "idTransacao": "19640141abc123"
  }'
```

---

## Códigos de Erro Comuns

| Código | Descrição |
|--------|-----------|
| 400 | Dados inválidos ou faltando campos obrigatórios |
| 401 | Token de autenticação inválido |
| 404 | Transação, loja ou cliente não encontrado |
| 409 | Venda já confirmada (idempotência) |

---

## Ambiente de Teste

Para testes, os endpoints já estão preparados para receber vendas de teste. Recomendamos:

1. Usar CPFs de teste na pré-venda
2. Validar o `idTransacao` retornado
3. Confirmar que os pontos/cashback são acumulados corretamente
4. Testar o fluxo de cancelamento

---

## Suporte

Para dúvidas sobre a integração:
- Email: suporte@levamaisfidelidade.com.br
- Documentação: Acesse o painel em "Integração Checkout"
