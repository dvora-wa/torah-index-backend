import { Module } from '@nestjs/common';
import { IndexController } from './index.controller';
import { IndexService } from './index.service';
import { PdfModule } from '../pdf/pdf.module';
import { GptService } from './gpt.service';
import { PromptConfigModule } from 'src/config/prompt-config.module';


@Module({
  imports: [PdfModule, PromptConfigModule],
  providers: [IndexService, GptService],
  controllers: [IndexController],
  exports: [IndexService],
})

export class IndexModule {}
