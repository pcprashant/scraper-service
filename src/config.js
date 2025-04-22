export const cfg = {
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'kafka:9092').split(','),
    clientId: 'scraper-service',
    groupId:  'scraper-workers',
    requestTopic:  process.env.KAFKA_REQ_TOPIC  || 'scrape.requests',
    responseTopic: process.env.KAFKA_RES_TOPIC || 'scrape.responses',
  },
  cluster: {
    maxConcurrency: Number(process.env.WORKERS) || 6,
    timeoutMs:      Number(process.env.TASK_TIMEOUT_MS) || 180_000
  },
  http: {
    metricsPort: Number(process.env.METRICS_PORT) || 9090
  },
  scraper: {
    // Add minimum delay between requests to the same domain (ms)
    domainCooldown: Number(process.env.DOMAIN_COOLDOWN_MS) || 2000,
    // Whether to respect robots.txt
    respectRobotsTxt: process.env.RESPECT_ROBOTS_TXT !== 'false'
  }
}; 