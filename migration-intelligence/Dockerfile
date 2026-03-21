FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY pyproject.toml .
RUN pip install --no-cache-dir .

# Copy application
COPY . .

EXPOSE 8101

CMD ["uvicorn", "service:app", "--host", "0.0.0.0", "--port", "8101"]
