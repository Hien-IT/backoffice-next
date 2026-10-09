import { Module } from '@nestjs/common';
import { ServerController } from './controllers/server.controller.js';
import { infrastructureProviders, serviceProviders } from './providers.js';

@Module({
	controllers: [ServerController],
	providers: [...infrastructureProviders, ...serviceProviders],
})
export class AppModule {}
