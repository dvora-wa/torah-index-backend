import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IndexType, IndexEntry, GeneratedIndex } from './types';

@Injectable()
export class GptService {
  private openaiApiKey: string;
  private apiEndpoint = 'https://api.openai.com/v1/responses';

  constructor(private configService: ConfigService) {
    this.openaiApiKey = this.configService.get<string>('OPENAI_API_KEY')!;
    if (!this.openaiApiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
  }

  async analyzeChunk(
    chunkText: string,
    indexType: IndexType,
  ): Promise<{ term: string; description?: string }[]> {

    const response = await fetch(this.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        input: [
          {
            role: 'system',
            content: [{ type: 'input_text', text: this.getSystemPrompt(indexType) }],
          },
          {
            role: 'user',
            content: [{ type: 'input_text', text: chunkText }],
          },
        ],
        temperature: 0,
        max_output_tokens: 1000,
      }),
    });

    const data = await response.json();
    const text =
      data.output?.[0]?.content?.find(c => c.type === 'output_text')?.text || '[]';

    try {
      return JSON.parse(text);
    } catch {
      return [];
    }
  }

  //   private buildPrompt(pages: Array<{ pageNumber: number; text: string }>, indexType: IndexType): string {

  //     const prompts: Record<IndexType, string> = {
  //       [IndexType.SOURCES]: `אנא נתחו את מערך תוכן עמודי הספר הבא וצרו אינדקס מקיף של מקורות (מקורות תנ"ך, מקורות תלמודיים וכו').

  // עצבו את התשובה כמערך JSON עם אובייקטים המכילים: term (המקור), pageNumbers (מערך מספרי העמודים היכן שהוא מופיע) ותיאור (הקשר קצר).

  //       לפי עמודים מערך תוכן הספר: ${JSON.stringify(pages)}`,

  //       [IndexType.TOPICS]: `אנא נתחו את מערך תוכן עמודי הספר הבא וצרו אינדקס מקיף של נושאים.

  // עצבו את התשובה כמערך JSON עם אובייקטים המכילים: term (המקור), pageNumbers (מערך מספרי העמודים היכן שהוא מופיע) ותיאור (הקשר קצר).

  //       לפי עמודים מערך תוכן הספר: ${JSON.stringify(pages)}`,

  //       [IndexType.PERSONS]: `אנא נתחו את מערך תוכן עמודי הספר הבא וצרו אינדקס מקיף של אישיים.

  // עצבו את התשובה כמערך JSON עם אובייקטים המכילים: term (המקור), pageNumbers (מערך מספרי העמודים היכן שהוא מופיע) ותיאור (הקשר קצר).

  //       לפי עמודים מערך תוכן הספר: ${JSON.stringify(pages)}`,
  //     };

  //     return prompts[indexType];
  //   }

  private getSystemPrompt(indexType: IndexType): string {
    const BASE_PROMPT = `
הטקסט כולל מקטעים בפורמט:
[Page X]
טקסט...

עליך:
- לזהות מונחים רלוונטיים
- להחזיר מערך JSON בלבד
- לכל מונח לצרף:
  - term
  - description (אם יש)
  - pageHints: מערך מספרי עמודים שבהם המונח מופיע

העמודים הם רמז בלבד. אל תנחש עמודים שלא מופיעים בטקסט.
`.trim();;

    const prompts: Record<IndexType, string> = {
      [IndexType.SOURCES]: 'אתה מומחה בניתוח טקסטים של ספרי מחברים יהודיים על התנך. צור אינדקסים מפורטים של מקורות תנכיים מהספר הנבחר.',
      [IndexType.TOPICS]: 'אתה מומחה בניתוח טקסטים של ספרי מחברים יהודיים על התנך. צור אינדקסים מפורטים של נושאים מהספר הנבחר.',
      [IndexType.PERSONS]: 'אתה מומחה בניתוח טקסטים של ספרי מחברים יהודיים על התנך. צור אינדקסים מפורטים של אישיים מהספר הנבחר.',
    };
    return `${BASE_PROMPT}\n${prompts[indexType]}`;

  }

}

