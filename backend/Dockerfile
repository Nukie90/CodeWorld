# Use the official Python base image
FROM python:3.13-slim

# Set the working directory
WORKDIR /app

# Install system dependencies (e.g. for building C-extensions or git requirements if any)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    git \
 && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# Copy the entire backend source code
COPY . .

# Expose the API port
EXPOSE 8000

# Start the uvicorn server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
