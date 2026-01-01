import { Injectable } from '@nestjs/common';
import { GptService } from './gpt.service';
import { IndexType, IndexEntry, GeneratedIndex, TextChunk } from './types';
import * as fs from 'fs';
import { PdfContent, PdfService } from '../pdf/pdf.service';

@Injectable()
export class IndexService {
  constructor(
    private gptService: GptService,
    private pdfService: PdfService,
  ) { }

  async generateIndexFromFile(
    filePath: string,
    indexType: IndexType,
  ): Promise<GeneratedIndex> {
    try {
      const pdfContent = await this.pdfService.extractText(filePath);
      const overlapPages = indexType === IndexType.TOPICS ? 1 : 0;
      const chunks = this.buildChunks(pdfContent.pages, overlapPages);

      const indexMap = new Map<
        string,
        { term: string; description?: string; pages: Set<number> }
      >();

      for (const chunk of chunks) {
        const terms = await this.gptService.analyzeChunk(// ----------צריך להוסיף כאן קוד כדי שיעבוד יותר יעיל-------
          chunk.text,
          indexType,
        );

        this.mergeTerms(indexMap, terms, chunk.pageNumbers);
      }

      return this.buildFinalIndex(indexMap, indexType);
    }
    finally {
      this.cleanupFile(filePath);
    }
  }

  private buildChunks(
    pages: { pageNumber: number; text: string }[],
    overlapPages = 0, // כמה עמודים לחפיפה בין chunks
    desiredChunkPercent = 10,  // אחוז ספר לכל chunk       
  ): Array<{ text: string; pageNumbers: number[]; pageMap: { [key: number]: string } }> {

    const totalPages = pages.length;
    // חישוב מספר עמודים לכל chunk לפי אחוז
    let pagesPerChunk = Math.ceil((desiredChunkPercent / 100) * totalPages);
    if (pagesPerChunk < 1) pagesPerChunk = 1;

    const chunks: Array<{ text: string; pageNumbers: number[]; pageMap: { [key: number]: string } }> = [];
    let start = 0;

    while (start < totalPages) {
      const end = Math.min(start + pagesPerChunk, totalPages);
      const slice = pages.slice(start, end);

      // מחזיקים מיפוי של עמודים למילים שלהם
      const pageMap: { [key: number]: string } = {};
      slice.forEach(p => (pageMap[p.pageNumber] = p.text));

      const chunkText = slice.map(p => `${p.pageNumber}: ${p.text}`).join('\n\n');

      const pageNumbers = slice.map(p => p.pageNumber);

      chunks.push({ text: chunkText, pageNumbers, pageMap });

      // מתקדמים ל-chunk הבא עם overlap
      const nextStart = end - overlapPages;
      start = nextStart > start ? nextStart : end; // מונע לולאה אינסופית
    }

    return chunks;
  }

  private mergeTerms(
    indexMap: Map<
      string,
      { term: string; description?: string; pages: Set<number> }
    >,
    terms: { term: string; description?: string; pageHints?: number[] }[],
    fallbackPages: number[],
  ) {

    for (const t of terms) {
      const key = this.normalize(t.term);

      if (!indexMap.has(key)) {
        indexMap.set(key, {
          term: t.term,
          description: t.description,
          pages: new Set(),
        });
      }

      const entry = indexMap.get(key)!;

      // אם יש pageHints – נשתמש בהם
      const pagesToAdd =
        t.pageHints && t.pageHints.length > 0
          ? t.pageHints
          : fallbackPages;//----------------------לא נכון לעשות כך - אם הוא לא משתמש במה ש AI הביא הוא צריך לעבור עמוד עמוד ולבדוק איפה זה נמצא
      // --------------------וגם אם ה AI הביא - כדי לבדוק --- כאן צריך להשתמש ב- ------pageMap-----

      for (const p of pagesToAdd) {
        entry.pages.add(p);
      }
    }
  }


  private buildFinalIndex(
    indexMap: Map<string, { term: string; description?: string; pages: Set<number> }>,
    indexType: IndexType,
  ): GeneratedIndex {
    const entries: IndexEntry[] = Array.from(indexMap.values()).map(v => ({
      term: v.term,
      description: v.description,
      pageNumbers: this.compressPageRanges(
        Array.from(v.pages).sort((a, b) => a - b),
      ),
    }));

    return {
      type: indexType,
      entries: entries.sort((a, b) =>
        a.term.localeCompare(b.term, 'he-IL'),
      ),
      generatedAt: new Date(),
    };
  }

  private compressPageRanges(pages: number[]): (number | string)[] {
    if (pages.length === 0) return [];

    const result: (number | string)[] = [];
    let start = pages[0];
    let prev = pages[0];

    for (let i = 1; i < pages.length; i++) {
      if (pages[i] === prev + 1) {
        prev = pages[i];
      } else {
        result.push(
          start === prev ? start : `${start}-${prev}`
        );
        start = prev = pages[i];
      }
    }

    result.push(
      start === prev ? start : `${start}-${prev}`
    );

    return result;
  }


  private normalize(term: string): string {
    return term
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();
  }

  getPreviewEntries(entries: IndexEntry[], previewCount = 5): IndexEntry[] {
    return entries.slice(0, previewCount);
  }

  private cleanupFile(filePath: string) {
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (err) {
      console.error('Failed to cleanup file:', err);
    }
  }

}
