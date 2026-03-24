FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-fra \
    tesseract-ocr-spa \
    tesseract-ocr-ara \
    poppler-utils \
    libgl1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --shell /bin/bash appuser

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

USER appuser

EXPOSE 8000
CMD ["gunicorn", "main:app", "-k", "uvicorn.workers.UvicornWorker", "--workers", "3", "--timeout", "120", "--bind", "0.0.0.0:8000"]
