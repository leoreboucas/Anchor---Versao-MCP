from flask import Flask, jsonify, make_response
import psycopg as data
from psycopg.rows import dict_row as dict_row_factory
from flask_cors import CORS


app = Flask(__name__)
CORS(app)

DESCRICAO = "serviço de consulta a dados de participação e respostas (anônimos) da pesquisa de bem-estar corporativo"
VERSAO = "1.0"

SERVIDOR_BANCO = "database"   # hostname do serviço no compose
PORTA_BANCO = 5432
USUARIO_BANCO = "admin"
SENHA_BANCO = "admin"
NOME_BANCO = "anchor"

def get_connection():
    connection = data.connect(
        host = SERVIDOR_BANCO,
        port = PORTA_BANCO,
        user = USUARIO_BANCO,
        password = SENHA_BANCO,
        dbname = NOME_BANCO,
        row_factory = dict_row_factory
    )

    return connection

@app.route("/", methods=["GET"])
def get_info():
    return make_response(jsonify(descricao=DESCRICAO, versao=VERSAO), 200)

@app.route("/response-counts", methods=["GET"])
def get_response_counts():
    connection = get_connection()
    cursor = connection.cursor()

    query = """
        SELECT * FROM vw_response_counts;
    """

    cursor.execute(query)
    results = cursor.fetchall()

    cursor.close()
    connection.close()

    return make_response(jsonify(results), 200)


@app.route("/response-counts/period/<period>", methods=["GET"])
def get_response_counts_by_period(period):
    connection = get_connection()
    cursor = connection.cursor()

    query = """
        SELECT * FROM vw_response_counts
        WHERE period = %s;
    """

    cursor.execute(query, (period,))
    results = cursor.fetchall()

    cursor.close()
    connection.close()

    return make_response(jsonify(results), 200)

@app.route("/response-counts/region/<region>", methods=["GET"])
def get_response_counts_by_region(region):
    connection = get_connection()
    cursor = connection.cursor()

    query = """
        SELECT * FROM vw_response_counts
        WHERE region = %s;
    """

    cursor.execute(query, (region,))
    results = cursor.fetchall()

    cursor.close()
    connection.close()

    return make_response(jsonify(results), 200)

@app.route("/respondent-counts", methods=["GET"])
def get_respondent_counts():
    connection = get_connection()
    cursor = connection.cursor()

    query = """
        SELECT * FROM vw_respondent_counts;
    """

    cursor.execute(query)
    results = cursor.fetchall()

    cursor.close()
    connection.close()

    return make_response(jsonify(results), 200)

@app.route("/respondent-counts/period/<period>", methods=["GET"])
def get_respondent_counts_by_period(period):
    connection = get_connection()
    cursor = connection.cursor()

    query = """
        SELECT * FROM vw_respondent_counts
        WHERE period = %s;
    """

    cursor.execute(query, (period,))
    results = cursor.fetchall()

    cursor.close()
    connection.close()

    return make_response(jsonify(results), 200)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=9001)