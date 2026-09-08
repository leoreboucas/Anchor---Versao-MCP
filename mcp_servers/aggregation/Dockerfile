FROM python:3.12-slim

WORKDIR /mcp_servers/aggregation

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 9001

CMD ["python", "tools.py"]