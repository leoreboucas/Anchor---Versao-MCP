FROM python:3.12-slim

WORKDIR /mcp_servers/raw_data

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 9001

CMD ["python", "tools.py"]