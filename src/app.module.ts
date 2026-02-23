import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule} from '@nestjs/config';
import { ApiModule } from './api/api.module';

@Module({
  imports: [ 
    ConfigModule.forRoot({
      isGlobal: true, // makes config available everywhere (env)
    }),
    //typeorm setup
    TypeOrmModule.forRoot({
      type: 'postgres',

      // Use modern connection string
      url: process.env.DATABASE_URL,

      ssl:
        process.env.DATABASE_SSL === 'true'
          ? { rejectUnauthorized: false }
          : false,

      /*
        autoLoadEntities automatically registers
        all entities decorated with @Entity()
      */
      autoLoadEntities: true,

      synchronize: false, // NEVER true in production
      logging: true,      // Keep true while learning
    }),
    ApiModule,],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
