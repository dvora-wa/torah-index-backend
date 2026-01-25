import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PromptConfigService {
  private config: any;
  private readonly filePath = path.join(
    process.cwd(),
    'src/config/prompt-config.json',
  );

  constructor() {
    this.config = JSON.parse(
      fs.readFileSync(this.filePath, 'utf-8'),
    );
  }

  getBasePrompt(): string {
    return this.config.basePrompt.join('\n');
  }

  getPromptByType(type: 'sources' | 'topics' | 'persons'): string {
    const key = `${type}Prompt`;
    return this.config[key].join('\n');
  }

  getChunkSize(): number {
    return this.config.chunkSize;
  }

  getOverlapPages(): number {
    return this.config.overlapPages;
  }

  getAll() {
    return this.config;
  }

  update(partial: any) {
    this.config = {
      ...this.config,
      ...partial,
    };

    fs.writeFileSync(
      this.filePath,
      JSON.stringify(this.config, null, 2),
      'utf-8',
    );
  }

}
