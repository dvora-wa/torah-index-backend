import { Module } from '@nestjs/common';
import { PromptConfigService } from './prompt-config.service';
import { PromptConfigController } from './prompt-config.controller';

@Module({
  providers: [PromptConfigService],
  controllers: [PromptConfigController],
  exports: [PromptConfigService],
})
export class PromptConfigModule {

}
