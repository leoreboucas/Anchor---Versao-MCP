from mcp.server.mcpserver import MCPServer
import urllib.request as req


NOME = "raw_data_mcp"
mcp = MCPServer(NOME)

URL_RAW_DATA = "http://raw_data:9001"

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

@mcp.tool(name="response_counts", title="contagem de respostas", description="Retorna a contagem de respostas por periodo, regiao, pais, categoria, subcategoria e opcao de resposta. Dados sempre agregados e anonimos.")
def get_response_counts():
    success, content, error = access(f"{URL_RAW_DATA}/response-counts")

    if success:
        return content
    else:
        return f"ocorreu um erro: {error}"

@mcp.tool(name="response_counts_by_period", title="Retorna a contagem de respostas a partir de um periodo. Dados sempre agregados e anonimos.")
def get_response_counts_by_period(period):
    success, content, error = access(f"{URL_RAW_DATA}/response-counts/period/{period}")

    if success:
        return content
    else:
        return f"ocorreu um erro: {error}"

@mcp.tool(name="response_counts_by_region", title="Retorna a contagem de respostas a partir de uma regiao. Dados sempre agregados e anonimos.")
def get_response_counts_by_region(region):
    success, content, error = access(f"{URL_RAW_DATA}/response-counts/region/{region}")

    if success:
        return content
    else:
        return f"ocorreu um erro: {error}"

@mcp.tool(name="respondent_counts", title="Contagem de respondentes", description="Retorna a quantidade de respondentes (pessoas) por período, região, país e departamento. Combinações com menos de 5 respondentes são omitidas para preservar anonimato. Dados sempre agregados e anônimos.")
def get_respondent_counts():
    success, content, error = access(f"{URL_RAW_DATA}/respondent-counts")

    if success:
        return content
    else:
        return f"ocorreu um erro: {error}"

@mcp.tool(name="respondent_counts_by_period", title="Contagem de respondentes por período", description="Retorna a quantidade de respondentes para um período específico. Dados sempre agregados e anônimos.")
def get_respondent_counts_by_period(period):
    success, content, error = access(f"{URL_RAW_DATA}/respondent-counts/period/{period}")

    if success:
        return content
    else:
        return f"ocorreu um erro: {error}"

if __name__ == "__main__":
    mcp.run(transport="streamable-http", host="0.0.0.0", port=9001, streamable_http_path="/")