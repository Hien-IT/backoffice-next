import { Module } from '@nestjs/common';
import { ServerController } from './controllers/server.controller.js';
import { MetricsModule } from './metrics/metrics.module.js';
import { infrastructureProviders, serviceProviders } from './providers.js';

@Module({
	imports: [MetricsModule],
	controllers: [ServerController],
	providers: [...infrastructureProviders, ...serviceProviders],
})
export class AppModule {}
