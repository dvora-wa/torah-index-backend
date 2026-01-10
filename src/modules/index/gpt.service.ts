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
    attempt = 1,
    maxAttempts = 3,
  ): Promise<{ term: string; description?: string; pageHints?: number[] }[]> {

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
        data.output?.[0]?.content?.find(c => c.type === 'output_text')?.text ?? '[]';

      const cleaned = text
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();

      return JSON.parse(cleaned);

    } catch (err) {
      console.error(`Analyze failed (attempt ${attempt})`, err);

      if (attempt < maxAttempts) {
        console.warn(`Retrying analyzeChunk... (${attempt + 1}/${maxAttempts})`);
        return this.analyzeChunk(chunkText, indexType, attempt + 1, maxAttempts);
      }

      return [];
    }
  }


  private getSystemPrompt(indexType: IndexType): string {
    const BASE_PROMPT = `
הטקסט כולל מקטעים בפורמט:
[Page X]
טקסט...

אתה עורך אינדקס מקצועי.
עליך:
 לזהות מונחים רלוונטיים ולהחזיר במערך JSON בלבד:
 החזר פלט בפורמט JSON תקני בלבד.
אין לעטוף את הפלט ב־גרשיים וכו או בבלוק קוד.
      אין להוסיף הסברים, טקסט חופשי או הערות.
      הפלט חייב להיות מערך JSON בלבד, שניתן לפענוח ישיר באמצעות JSON.parse().
              [
        {
          "term": "string",
          "description": "string | null",
          "pageHints": number[]
        }
      ]
        אם אינך בטוח ב־100% שהמונח מתאים לסוג האינדקס – אל תחזיר אותו.
              אסור להחזיר טקסט חופשי.
              אם אין מונחים – החזר[]

העמודים הם רמז בלבד.אל תנחש עמודים שלא מופיעים בטקסט.
`.trim();;

    const prompts: Record<IndexType, string> = {
      [IndexType.SOURCES]: `
אתה מומחה בניתוח טקסטים של ספרי מחברים יהודיים על התנ"ך. 
צור אינדקסים מפורטים של מקורות המוזכרים בטקסט בלבד.

חוקים:
- החזר אך ורק מקורות כתובים (ספרים, פרקים, פסוקים)
- מקורות תנ"כים, מדרשיים או ספרות רבנית בלבד
- אין להחזיר נושאים, רעיונות או שמות אנשים
- כל term חייב להיות שם מקור ברור ומפורש בטקסט
- אם אין מקורות בטקסט – החזר [] בלבד
- אם אינך בטוח שהמונח מתאים – אל תחזיר אותו
`.trim(),

      [IndexType.TOPICS]: `
אתה מומחה בניתוח טקסטים של ספרי מחברים יהודיים על התנ"ך.
צור אינדקס מפורט של נושאים מושגיים בלבד המוזכרים בטקסט.

חוקים מחייבים:
- החזר אך ורק נושאים רעיוניים / מושגיים
- ❌ אסור להחזיר שמות של בני אדם מכל סוג
- ❌ אסור להחזיר שמות של רבנים, מחברים או דמויות מקראיות
- ❌ אסור להחזיר ספרים, מקורות או מקומות
- ❌ אסור להחזיר שמות פרטיים או משפחה
- אם מונח יכול להתפרש כאדם – אל תחזיר אותו
- כל term חייב להיות מושג מופשט (רעיון, עיקרון, תהליך, תכונה)
- אם אין נושאים – החזר [] בלבד
`.trim(),

      [IndexType.PERSONS]: `
אתה מומחה בניתוח טקסטים של ספרי מחברים יהודיים על התנ"ך.
צור אינדקס מפורט של שמות אישים המוזכרים בטקסט בלבד.

חוקים:
- החזר אך ורק שמות של בני אדם המוזכרים בטקסט
- אין להחזיר מושגים, נושאים, מקומות או ספרים
- אין להחזיר תארים כלליים (כגון "המחבר", "הרב")
- אם אין שם פרטי ברור – אל תחזיר אותו
- כל term חייב להיות שם של אדם אחד בלבד
- אם אין אישים בטקסט – החזר [] בלבד
- אם אינך בטוח שהמונח מתאים – אל תחזיר אותו
`.trim()
      ,
    };
    return `${BASE_PROMPT}\n${prompts[indexType]}`;
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
