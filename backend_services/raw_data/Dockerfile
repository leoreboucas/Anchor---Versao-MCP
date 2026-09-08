FROM python:3.12-slim

WORKDIR /backend_services/raw_data

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 9001

CMD ["python", "app.py"]