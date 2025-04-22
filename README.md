# Scraper Service

A robust, scalable web scraping service built with Puppeteer, KafkaJS, and Prometheus monitoring.

## Architecture

This service:
- Consumes scrape requests from Kafka topic `scrape.requests`
- Performs the scraping with Puppeteer using anti-bot measures
- Publishes results to Kafka topic `scrape.responses`
- Exposes Prometheus metrics at `/metrics`
- Includes a health check endpoint at `/health`

## Features

- **Async Processing**: Uses Kafka for back-pressure friendly processing
- **Anti-Bot Measures**: Includes puppeteer-extra-plugin-stealth for bot detection avoidance
- **Rate Limiting**: Domain-based rate limiting to avoid overloading target websites
- **Monitoring**: Prometheus metrics for scrape duration, success/failure rates, and active jobs
- **Scalable**: Kubernetes-ready with graceful shutdown handling
- **Context Isolation**: Uses puppeteer-cluster for efficient browser session management
- **Smart Error Handling**: Provides HTTP-style error codes and descriptive messages

## Configuration

Configure via environment variables:
- `KAFKA_BROKERS`: Comma-separated Kafka broker addresses (default: `kafka:9092`)
- `KAFKA_REQ_TOPIC`: Request topic (default: `scrape.requests`)
- `KAFKA_RES_TOPIC`: Response topic (default: `scrape.responses`)
- `WORKERS`: Max concurrent scrape jobs (default: `6`)
- `TASK_TIMEOUT_MS`: Timeout for scrape jobs in ms (default: `180000`)
- `METRICS_PORT`: Port for Prometheus metrics (default: `9090`)
- `DOMAIN_COOLDOWN_MS`: Minimum delay between requests to the same domain (default: `2000`)
- `RESPECT_ROBOTS_TXT`: Whether to respect robots.txt (default: `true`)

## Usage

### Build and Run with Docker

```bash
docker build -t scraper-service .
docker run -p 9090:9090 -e KAFKA_BROKERS=your-kafka:9092 scraper-service
```

### Run in Development Mode

```bash
npm install
npm run dev
```

### Request Format (Kafka)

```json
{
  "url": "https://example.com/page-to-scrape",
  "correlationId": "optional-correlation-id"
}
```

### Response Format (Kafka)

For successful scrape:
```json
{
  "correlationId": "same-correlation-id",
  "code": 200,
  "body": "<html>scraped content</html>"
}
```

For errors:
```json
{
  "correlationId": "same-correlation-id",
  "code": 500,
  "error": "Error message"
}
```

Error codes follow HTTP convention:
- `400`: Bad request (missing URL, invalid message format)
- `404`: Domain not found
- `408`: Request timeout
- `500`: Internal error
- `503`: Service unavailable