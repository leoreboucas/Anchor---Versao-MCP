from mcp.server.mcpserver import MCPServer
import urllib.request as req


NOME = "aggregation_mcp"
mcp = MCPServer(NOME)

URL_AGGREGATION = "http://aggregation:9001"

INFO = {
    "nome": NOME,
    "descricao": "servico MCP com informacoes agregadas sobre a pesquisa de bem estarcorporativo",
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

@mcp.tool(name="aggregate_overall", title="Agregacao geral", description="Retorna um resumo agregado por periodo, regiao, pais, categoria, subcategoria e opcao de resposta. Dados sempre agregados e anonimos.")
def get_aggregate_overall():
    success, content, error = access(f"{URL_AGGREGATION}/aggregate-overall")

    if success:
        return content
    else:
        return f"ocorreu um erro: {error}"

@mcp.tool(name="aggregate_overall_by_period", title="Agregacao geral por periodo", description="Retorna a agregacao geral por periodo. Dados sempre agregados e anonimos.")
def get_aggregate_overall_by_period(period):
    success, content, error = access(f"{URL_AGGREGATION}/aggregate-overall/period/{period}")

    if success:
        return content
    else:
        return f"ocorreu um erro: {error}"

@mcp.tool(name="aggregate_overall_by_region", title="Agregacao geral por regiao", description="Retorna a agregacao geral a partir de uma regiao. Dados sempre agregados e anonimos.")
def get_aggregate_overall_by_region(region):
    success, content, error = access(f"{URL_AGGREGATION}/aggregate-overall/region/{region}")

    if success:
        return content
    else:
        return f"ocorreu um erro: {error}"


if __name__ == "__main__":
    mcp.run(transport="streamable-http", host="0.0.0.0", port=9001, streamable_http_path="/")