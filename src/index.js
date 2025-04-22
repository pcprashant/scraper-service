import fastify from 'fastify';
import pino from 'pino';
import { startKafka, consumer, publishResponse } from './kafka.js';
import { createCluster, scrapeJob } from './scraper.js';
import { exposeMetrics } from './metrics.js';
import { cfg } from './config.js';
import crypto from 'crypto';

const log = pino();
const app = fastify({ logger: true });

exposeMetrics(app);                       // GET /metrics for Prometheus

// Add health check endpoint
app.get('/health', async (req, reply) => {
  reply.code(200).send({ status: 'ok' });
});

const cluster = await createCluster();
await startKafka();

/* cluster task definition */
cluster.task(async ({ page, data }) => scrapeJob(page, data.url));

/* consume requests */
await consumer.run({
  eachMessage: async ({ message }) => {
    try {
      const payload = JSON.parse(message.value.toString());
      const { url, correlationId = crypto.randomUUID() } = payload;
      
      if (!url) {
        log.warn({ correlationId }, 'Scrape request missing URL');
        await publishResponse({ 
          correlationId, 
          code: 400, 
          error: 'Missing required field: url' 
        });
        return;
      }
      
      log.info({ correlationId, url }, 'Processing scrape request');
      cluster.execute({ url })
        .then(res => publishResponse({ correlationId, ...res }))
        .catch(err => publishResponse({ correlationId, code: 500, error: err.message }));
    } catch (err) {
      log.error({ err }, 'Failed to process message');
      const correlationId = crypto.randomUUID();
      await publishResponse({ 
        correlationId, 
        code: 400, 
        error: 'Invalid message format' 
      });
    }
  }
});

process.on('SIGTERM', async () => {
  await consumer.disconnect();
  await cluster.close();
  process.exit(0);
});

app.listen({ port: cfg.http.metricsPort, host: '0.0.0.0' }); 