# Use Python 3.11 slim for a smaller footprint
FROM python:3.11-slim as builder

# Set build environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Install system dependencies for some Python packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Create and set the working directory
WORKDIR /app

# Install dependencies separately to leverage Docker cache
COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

# --- Final Stage ---
FROM python:3.11-slim

WORKDIR /app

# Copy only the installed packages from the builder stage
COPY --from=builder /root/.local /root/.local
COPY . .

# Update PATH to include the user-level bin
ENV PATH=/root/.local/bin:$PATH

# Expose the API port
EXPOSE 8787

# Use uvicorn for production
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8787"]
