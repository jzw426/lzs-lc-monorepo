import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { NodeSDK } from '@opentelemetry/sdk-node';
import type { ServerConfig } from './environment.js';

export interface TelemetryHandle {
  shutdown(): Promise<void>;
}

export function startTelemetry(config: ServerConfig): TelemetryHandle {
  if (config.otlpEndpoint === null) {
    return { shutdown: async () => undefined };
  }
  const sdk = new NodeSDK({
    serviceName: config.serviceName,
    traceExporter: new OTLPTraceExporter({
      url: new URL('/v1/traces', config.otlpEndpoint).toString(),
    }),
    instrumentations: [getNodeAutoInstrumentations()],
  });
  sdk.start();
  return { shutdown: () => sdk.shutdown() };
}
