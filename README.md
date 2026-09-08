# Anchor — Indicadores de Bem-Estar Corporativo via MCP

Anchor é uma solução de back-end orientada a serviços que expõe indicadores anônimos e agregados de uma pesquisa de bem-estar corporativo (participação, pontuação e visão executiva) para uma empresa multinacional organizada em 4 regiões de negócio (Brasil → LATAM, EUA → NA, Inglaterra e Espanha → EMEA).

A solução é composta por **3 serviços web RESTful**, **3 servidores MCP** (um por serviço), um **banco de dados PostgreSQL**, e um **cliente** disponível em duas versões: uma aplicação web (dashboard + chat) e um cliente de linha de comando. Todos os dados retornados são sempre agregados e anônimos.

## Sumário

- [Arquitetura](#arquitetura)
- [Serviços web](#serviços-web)
- [Servidores MCP](#servidores-mcp)
- [Banco de dados](#banco-de-dados)
- [Cliente web](#cliente-web)
- [Cliente de linha de comando](#cliente-de-linha-de-comando)
- [Pré-requisitos](#pré-requisitos)
- [Configuração](#configuração)
- [Como executar](#como-executar)
- [Testando os serviços](#testando-os-serviços)
- [Resiliência a falhas](#resiliência-a-falhas)
- [Estrutura do projeto](#estrutura-do-projeto)

## Arquitetura

```
                         ┌──────────────────────┐
                         │   Cliente Web / CLI   │
                         │ (dashboard + chat IA) │
                         └──────────┬────────────┘
                    consome REST    │    consome MCP
             ┌───────────────────────────────────────────┐
             │                                            │
   ┌─────────▼─────────┐  ┌────────────────────┐  ┌───────▼──────────┐
   │   raw_data (9001)  │  │ punctuation (9002) │  │ aggregation (9003)│
   │  serviço web REST  │  │  serviço web REST  │  │  serviço web REST │
   └─────────┬─────────┘  └──────────┬──────────┘  └────────┬─────────┘
             │                       │                       │
   ┌─────────▼─────────┐  ┌──────────▼──────────┐  ┌────────▼─────────┐
   │ raw_data_mcp (7001)│  │punctuation_mcp(7002)│  │aggregation_mcp(7003)│
   └────────────────────┘  └──────────────────────┘  └────────────────┘
             │                       │                       │
             └───────────────┬───────┴───────────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │  database (7004)   │
                    │     PostgreSQL     │
                    └─────────────────────┘
```

Cada serviço web, cada servidor MCP e o banco de dados rodam em seu **próprio container Docker**, isolados entre si e conectados pela rede `mcp_network`.

## Serviços web

Cada serviço realiza apenas uma responsabilidade (modularização) e expõe endpoints RESTful em JSON.

| Serviço | Porta | Responsabilidade | Principais endpoints |
|---|---|---|---|
| `raw_data` | `9001` | Contagem de respostas e de respondentes | `GET /response-counts`, `GET /response-counts/period/<period>`, `GET /response-counts/region/<region>`, `GET /respondent-counts`, `GET /respondent-counts/period/<period>` |
| `punctuation` | `9002` | Pontuação (score) de bem-estar, de 1 a 5 | `GET /score-distribution`, `GET /score-distribution/period/<period>`, `GET /score-distribution/region/<region>`, `GET /score-average`, `GET /score-average/period/<period>`, `GET /score-average/country/<country>` |
| `aggregation` | `9003` | Visão executiva/agregada geral | `GET /aggregate-overall`, `GET /aggregate-overall/period/<period>`, `GET /aggregate-overall/region/<region>` |

Todos os serviços também expõem `GET /` retornando descrição e versão do serviço.

## Servidores MCP

Cada serviço web possui um servidor MCP dedicado, que externaliza suas rotas como *tools* utilizáveis por uma IA conversacional.

| Servidor MCP | Porta | Consome | Ferramentas expostas |
|---|---|---|---|
| `raw_data_mcp` | `7001` | `raw_data` (9001) | `informacoes`, `response_counts`, `response_counts_by_period`, `response_counts_by_region`, `respondent_counts`, `respondent_counts_by_period` |
| `punctuation_mcp` | `7002` | `punctuation` (9002) | `informacoes`, `score_distribution`, `score_distribution_by_period`, `score_distribution_by_region`, `score_average`, `score_average_by_period`, `score_average_by_country` |
| `aggregation_mcp` | `7003` | `aggregation` (9003) | `informacoes`, `aggregate_overall`, `aggregate_overall_by_period`, `aggregate_overall_by_region` |

Os servidores MCP usam transporte `streamable-http` e servem como ponte entre a IA (Google Gemini) e os serviços REST internos.

## Banco de dados

Um container PostgreSQL (`database`, porta externa `7004`) armazena os dados da pesquisa. O schema é inicializado automaticamente a partir de `anchor_db/`:

- `01_schema.sql` — tabelas (`respondents`, `questionnaires`, `questions`, `response_options`, `responses`);
- `02_views.sql` — views usadas pelos serviços (`vw_response_counts`, `vw_respondent_counts`, `vw_score_distribution`, `vw_score_average`, `vw_aggregate_overall`);
- `03_seed.sql` — dados de exemplo.

## Cliente web

Localizado em `frontend_client/`, é uma aplicação Flask (porta `8000`) com duas partes:

- **Dashboard** (`/`) — consome diretamente os três serviços web (`/api/status`) e exibe indicadores em tempo real, com verificação periódica de disponibilidade de cada serviço.
- **Chat com IA** (`/api/chat`) — conecta-se aos três servidores MCP via protocolo MCP, disponibiliza as ferramentas para o modelo **Google Gemini** e permite consultar os indicadores de forma conversacional, com anonimização e regras de segurança reforçadas via prompt de sistema.

## Cliente de linha de comando

O arquivo `frontend_client/chat_ia.py` é uma versão alternativa do chat, para uso via terminal, com a mesma lógica de conexão aos servidores MCP e ao modelo Gemini, sem depender do dashboard web.

Para executá-lo:

```bash
cd frontend_client
python chat_ia.py
```

## Pré-requisitos

- [Docker](https://www.docker.com/) e Docker Compose;
- Uma chave de API do **Google AI (Gemini)** — necessária para o chat funcionar.

## Configuração

1. Clone o repositório.
2. Crie um arquivo `.env` na raiz do projeto (ele **não** é versionado) com o conteúdo:

   ```env
   GOOGLE_API_KEY=SUA_CHAVE_AQUI
   ```

3. Crie a rede Docker externa usada pelo `docker-compose.yml` (só precisa ser feito uma vez):

   ```bash
   docker network create mcp_network
   ```

## Como executar

Na raiz do projeto:

```bash
docker compose up --build
```

Isso sobe, cada um em seu próprio container:

- `database` (PostgreSQL, com schema/views/seed já carregados);
- `raw_data`, `punctuation`, `aggregation` (serviços web);
- `raw_data_mcp`, `punctuation_mcp`, `aggregation_mcp` (servidores MCP).

Em seguida, execute o cliente web fora do compose (ou adapte para rodar containerizado, se preferir):

```bash
cd frontend_client
pip install -r requirements.txt
python app.py
```

O dashboard e o chat ficam disponíveis em `http://localhost:8000`.

## Testando os serviços

Exemplos com `curl`, direto nos serviços web:

```bash
curl http://localhost:9001/response-counts
curl http://localhost:9002/score-average
curl http://localhost:9003/aggregate-overall/region/LATAM
```

## Resiliência a falhas

O dashboard web consulta os serviços periodicamente e trata timeouts e erros de conexão sem interromper a aplicação: cada indicador exibe seu próprio status (`ok`, `error` ou `unavailable`). Caso um serviço seja interrompido (`docker stop <serviço>`), o dashboard continua funcionando normalmente com os demais indicadores ativos e retoma automaticamente a exibição dos dados assim que o serviço voltar a responder — sem necessidade de recarregar a página.

## Estrutura do projeto

```
Anchor - Versao MCP/
├── docker-compose.yml
├── requirements.txt
├── .env                      # não versionado
├── anchor_db/
│   ├── 01_schema.sql
│   ├── 02_views.sql
│   └── 03_seed.sql
├── backend_services/
│   ├── raw_data/
│   ├── punctuation/
│   └── aggregation/
├── mcp_servers/
│   ├── raw_data/
│   ├── punctuation/
│   └── aggregation/
└── frontend_client/
    ├── app.py                # dashboard web + chat
    ├── chat_ia.py            # chat via terminal
    ├── static/
    └── templates/
```

---

Projeto desenvolvido para a disciplina **Programação Orientada a Serviços** — IFBA Campus Vitória da Conquista.