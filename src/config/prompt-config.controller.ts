import { Controller, Get, Put, Body } from '@nestjs/common';
import { PromptConfigService } from './prompt-config.service';

@Controller('api/admin/prompts')
export class PromptConfigController {
  constructor(private readonly promptConfigService: PromptConfigService) {}

  @Get()
  getAll() {
    return this.promptConfigService.getAll();
  }

  @Put()
  update(@Body() body: any) {
    this.promptConfigService.update(body);
    return { success: true };
  }
}
