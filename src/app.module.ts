import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { IndexModule } from './modules/index/index.module';
import { PdfModule } from './modules/pdf/pdf.module';


@Module({
  imports: [
        ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    IndexModule,
    PdfModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}





