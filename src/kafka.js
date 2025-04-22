import { Kafka, logLevel } from 'kafkajs';
import { cfg } from './config.js';
import pino from 'pino';

const log = pino();

const kafka = new Kafka({
  brokers: cfg.kafka.brokers,
  clientId: cfg.kafka.clientId,
  logLevel: logLevel.ERROR
});

export const producer = kafka.producer();
export const consumer = kafka.consumer({ groupId: cfg.kafka.groupId });

export async function startKafka() {
  await producer.connect();
  await consumer.connect();
  await consumer.subscribe({ topic: cfg.kafka.requestTopic, fromBeginning: false });
  log.info('Kafka ready');
}

/* helper to publish response */
export async function publishResponse({ correlationId, code, body, error }) {
  await producer.send({
    topic: cfg.kafka.responseTopic,
    messages: [{
      key: correlationId,
      value: JSON.stringify({ correlationId, code, body, error })
    }]
  });
} 