FROM python:3.11-slim

WORKDIR /app

COPY . /app

RUN python -m pip install --no-cache-dir -r requirements.txt

EXPOSE 8080

CMD ["sh", "-c", "python -m uvicorn app:app --host 0.0.0.0 --port ${PORT:-8080}"]