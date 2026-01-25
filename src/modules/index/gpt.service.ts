import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IndexType, IndexEntry, GeneratedIndex } from './types';
import { PromptConfigService } from '../../config/prompt-config.service';

@Injectable()
export class GptService {
  private openaiApiKey: string;
  private apiEndpoint = 'https://api.openai.com/v1/responses';

  constructor(
    private configService: ConfigService,
    private promptConfig: PromptConfigService,
  ) {
    this.openaiApiKey = this.configService.get<string>('OPENAI_API_KEY')!;
    if (!this.openaiApiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
  }

  async analyzeChunk(
    chunkText: string,
    indexType: IndexType,
    attempt = 1,
    maxAttempts = 3,
  ): Promise<{ term: string; description?: string; pageHints?: number[] }[]> {
    const systemPrompt =
      this.promptConfig.getBasePrompt() +
      '\n\n' +
      this.promptConfig.getPromptByType(indexType.toLowerCase() as any);
    try {
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
              content: [{ type: 'input_text', text: systemPrompt }],
            },
            {
              role: 'user',
              content: [{ type: 'input_text', text: chunkText }],
            },
          ],
          temperature: 0,
          max_output_tokens: 1000,
          text: {
            format: {
              name: "index_terms",                // <-- חייב להיות כאן
              type: "json_schema",
              schema: this.getResponseFormat(indexType)
                // .items 
                ? this.getResponseFormat(indexType) : undefined,
              strict: true
            }
          }
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenAI error: ${response.status} - ${errText}`);
      }

      const data = await response.json();

      // מנסה להחזיר את התוצאה parsed לפי schema
      if (data.output_parsed?.index_terms) {
        return data.output_parsed.index_terms;
      }

      // fallback: אם output_parsed לא קיים או לא parse-able
      const rawText =
        data.output?.[0]?.content?.find(c => c.type === 'output_text')?.text ?? '{}';
      try {
        const parsed = JSON.parse(rawText);

        if (parsed?.index_terms) {
          return parsed.index_terms;
        }

        return [];
      } catch {
        console.warn(`Fallback JSON parsing failed on attempt ${attempt}`);
        return [];
      }

    } catch (err) {
      console.error(`Analyze failed (attempt ${attempt})`, err);

      if (attempt < maxAttempts) {
        console.warn(`Retrying analyzeChunk... (${attempt + 1}/${maxAttempts})`);
        return this.analyzeChunk(chunkText, indexType, attempt + 1, maxAttempts);
      }

      // אחרי כל הניסיונות: החזרת מערך ריק
      return [];
    }
  }

  private getResponseFormat(indexType: IndexType) {
    return {
      name: "index_terms",
      type: "object",
      properties: {
        index_terms: {
          type: "array",
          items: {
            type: "object",
            properties: {
              term: { type: "string" },
              description: { type: ["string", "null"] },
              pageHints: { type: ["array", "null"], items: { type: "number" } }
            },
            required: ["term", "description", "pageHints"],
            additionalProperties: false
          }
        }
      },
      required: ["index_terms"],
      additionalProperties: false
    };
  }
}





//   private buildPrompt(pages: Array<{ pageNumber: number; text: string }>, indexType: IndexType): string {

//     const prompts: Record<IndexType, string> = {
//       [IndexType.SOURCES]: `אנא נתחו את מערך תוכן עמודי הספר הבא וצרו אינדקס מקיף של מקורות(מקורות תנ"ך, מקורות תלמודיים וכו').

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
