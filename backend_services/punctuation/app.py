from flask import Flask, jsonify, make_response
import psycopg as data
from psycopg.rows import dict_row as dict_row_factory
from flask_cors import CORS


app = Flask(__name__)
CORS(app)

DESCRICAO = "serviço de consulta a dados de score(anônimos) da pesquisa de bem-estar corporativo"
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

@app.route("/score-distribution", methods=["GET"])
def get_score_distribution():
    connection = get_connection()
    cursor = connection.cursor()

    query = """
        SELECT * FROM vw_score_distribution;
    """

    cursor.execute(query)
    results = cursor.fetchall()

    cursor.close()
    connection.close()

    return make_response(jsonify(results), 200)

@app.route("/score-distribution/period/<period>", methods=["GET"])
def get_score_distribution_by_period(period):   
    connection = get_connection()
    cursor = connection.cursor()

    query = """
        SELECT * FROM vw_score_distribution
        WHERE period = %s;
    """

    cursor.execute(query, (period,))
    results = cursor.fetchall()

    cursor.close()
    connection.close()

    return make_response(jsonify(results), 200)

@app.route("/score-distribution/region/<region>", methods=["GET"])
def get_score_distribution_by_region(region):
    connection = get_connection()
    cursor = connection.cursor()

    query = """
        SELECT * FROM vw_score_distribution
        WHERE region = %s;
    """

    cursor.execute(query, (region,))
    results = cursor.fetchall()

    cursor.close()
    connection.close()

    return make_response(jsonify(results), 200)

@app.route("/score-average", methods=["GET"])
def get_score_average():
    connection = get_connection()
    cursor = connection.cursor()

    query = """
        SELECT * FROM vw_score_average;
    """

    cursor.execute(query)
    results = cursor.fetchall()

    cursor.close()
    connection.close()

    return make_response(jsonify(results), 200)

@app.route("/score-average/period/<period>", methods=["GET"])
def get_score_average_by_period(period):
    connection = get_connection()
    cursor = connection.cursor()

    query = """
        SELECT * FROM vw_score_average
        WHERE period = %s;
    """

    cursor.execute(query, (period,))
    results = cursor.fetchall()

    cursor.close()
    connection.close()

    return make_response(jsonify(results), 200)

@app.route("/score-average/country/<country>", methods=["GET"])
def get_score_average_by_country(country):
    connection = get_connection()
    cursor = connection.cursor()

    query = """
        SELECT * FROM vw_score_average
        WHERE country = %s;
    """

    cursor.execute(query, (country,))
    results = cursor.fetchall()

    cursor.close()
    connection.close()

    return make_response(jsonify(results), 200)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=9001)