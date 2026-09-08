from mcp.server.mcpserver import MCPServer
import urllib.request as req


NOME = "punctuation_mcp"
mcp = MCPServer(NOME)

URL_PUNCTUATION = "http://punctuation:9001"

INFO = {
    "nome": NOME,
    "descricao": "servico MCP com informacoes sobre os dados brutos sobre a pesquisa de bem estarcorporativo",
    "versao": "1.0"
}

def access(url):
    success, content, error = False, None, None

    try:
        response = req.urlopen(url)
        if response.code == 200:
            content = response.read().decode("utf-8")

            success = True
    except Exception as e:
        error = str(e)

        print(f"ocorreu um erro acessando '{url}': {error}")

    return success, content, error

# nao acentuar os nomes das funcoes, pois o MCP nao aceita acentos
@mcp.tool(name="informacoes", title="informacoes sobre este serviço MCP", description="apresenta lista de informacoes basicas sobre este serviço MCP")
def get_info():
    return INFO

@mcp.tool(name="score_distribution", title="Distribuicao de scores", description="Retorna a distribuicao de scores por periodo, regiao, pais, categoria, subcategoria e opcao de resposta. Dados sempre agregados e anonimos.")
def get_score_distribution():
    success, content, error = access(f"{URL_PUNCTUATION}/score-distribution")

    if success:
        return content
    else:
        return f"ocorreu um erro: {error}"

@mcp.tool(name="score_distribution_by_period", title="Distribuicao de scores por periodo", description="Retorna a distribuicao de scores por periodo. Dados sempre agregados e anonimos.")
def get_score_distribution_by_period(period):
    success, content, error = access(f"{URL_PUNCTUATION}/score-distribution/period/{period}")

    if success:
        return content
    else:
        return f"ocorreu um erro: {error}"

@mcp.tool(name="score_distribution_by_region", title="Distribuicao de scores por regiao", description="Retorna a distribuicao de scores a partir de uma regiao. Dados sempre agregados e anonimos.")
def get_score_distribution_by_region(region):
    success, content, error = access(f"{URL_PUNCTUATION}/score-distribution/region/{region}")

    if success:
        return content
    else:
        return f"ocorreu um erro: {error}"

@mcp.tool(name="score_average", title="Média de scores", description="Retorna a média de scores por período, região, país, categoria, subcategoria e opção de resposta. Dados sempre agregados e anonimos.")
def get_score_average():
    success, content, error = access(f"{URL_PUNCTUATION}/score-average")

    if success:
        return content
    else:
        return f"ocorreu um erro: {error}"

@mcp.tool(name="score_average_by_period", title="Média de scores por período", description="Retorna a média de scores para um período específico. Dados sempre agregados e anônimos.")
def get_score_average_by_period(period):
    success, content, error = access(f"{URL_PUNCTUATION}/score-average/period/{period}")

    if success:
        return content
    else:
        return f"ocorreu um erro: {error}"

@mcp.tool(name="score_average_by_country", title="Média de scores por país", description="Retorna a média de scores para um país específico. Dados sempre agregados e anônimos.")
def get_score_average_by_country(country):
    success, content, error = access(f"{URL_PUNCTUATION}/score-average/country/{country}")

    if success:
        return content
    else:
        return f"ocorreu um erro: {error}"

if __name__ == "__main__":
    mcp.run(transport="streamable-http", host="0.0.0.0", port=9001, streamable_http_path="/")