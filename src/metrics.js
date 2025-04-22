import prom from 'prom-client';
const register = new prom.Registry();
prom.collectDefaultMetrics({ register });

export const scrapeDuration = new prom.Histogram({
  name: 'scrape_duration_seconds',
  help: 'Time spent scraping a single URL',
  buckets: [0.5, 2, 5, 10, 20, 40],
});
export const scrapeSuccess = new prom.Counter({
  name: 'scrape_success_total',
  help: 'Successful scrapes',
});
export const scrapeFailure = new prom.Counter({
  name: 'scrape_failure_total',
  help: 'Failed scrapes',
});
export const activeJobs = new prom.Gauge({
  name: 'scrape_active_jobs',
  help: 'Jobs in progress',
});

register.registerMetric(scrapeDuration);
register.registerMetric(scrapeSuccess);
register.registerMetric(scrapeFailure);
register.registerMetric(activeJobs);

export function exposeMetrics(app) {
  app.get('/metrics', async (req, reply) => {
    reply.header('Content-Type', register.contentType);
    reply.send(await register.metrics());
  });
} 