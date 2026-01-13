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
    fromPage?: number,
    toPage?: number,
  ): Promise<GeneratedIndex> {
    try {
      const pdfContent = await this.pdfService.extractText(filePath);
      const pages = this.filterPagesByRange(pdfContent.pages, fromPage, toPage);
      const overlapPages = indexType === IndexType.TOPICS ? 1 : 0;
      const chunks = this.buildChunks(pages, overlapPages);

      const indexMap = new Map<
        string,
        { term: string; description?: string; pages: Set<number> }
      >();

      await this.runWithConcurrency(
        chunks,
        3, // 👈 מספר קריאות מקביליות (2–4 זה sweet spot)
        async (chunk) => {
          const terms = await this.gptService.analyzeChunk(
            chunk.text,
            indexType,
          );

          this.mergeTerms(
            indexMap,
            terms,
            chunk.pageNumbers,
            chunk.pageMap
          );
        }
      );

      // for (const chunk of chunks) {
      //   const terms = await this.gptService.analyzeChunk(// ----------צריך להוסיף כאן קוד כדי שיעבוד יותר יעיל-------
      //     chunk.text,
      //     indexType,
      //   );
      //   this.mergeTerms(indexMap, terms, chunk.pageNumbers, chunk.pageMap);
      // }

      return this.buildFinalIndex(indexMap, indexType);
    }
    finally {
      this.cleanupFile(filePath);
    }
  }

  private filterPagesByRange(
    pages: { pageNumber: number; text: string }[],
    fromPage?: number,
    toPage?: number
  ) {
    if (!fromPage && !toPage) return pages;

    if (fromPage && toPage && fromPage > toPage) {
      throw new Error('fromPage cannot be greater than toPage');
    }

    return pages.filter(p => {
      if (fromPage && p.pageNumber < fromPage) return false;
      if (toPage && p.pageNumber > toPage) return false;
      return true;
    });
  }


  private buildChunks(
    pages: { pageNumber: number; text: string }[],
    overlapPages = 0 // כמה עמודים לחפיפה
  ): Array<{ text: string; pageNumbers: number[]; pageMap: { [key: number]: string } }> {

    const totalPages = pages.length;

    // חישוב ראשוני של מספר עמודים לכל chunk לפי אחוז דינמי
    let desiredChunkPercent = this.getDynamicChunkPercent(totalPages);
    let pagesPerChunk = Math.ceil((desiredChunkPercent / 100) * totalPages);

    // הגבלת מינימום ומקסימום כדי לשמור chunks הגיוניים
    const MIN_PAGES_PER_CHUNK = 5;
    const MAX_PAGES_PER_CHUNK = 20;
    pagesPerChunk = Math.max(MIN_PAGES_PER_CHUNK, pagesPerChunk);
    pagesPerChunk = Math.min(MAX_PAGES_PER_CHUNK, pagesPerChunk);

    const chunks: Array<{ text: string; pageNumbers: number[]; pageMap: { [key: number]: string } }> = [];

    let start = 0;

    while (start < totalPages) {
      const end = Math.min(start + pagesPerChunk, totalPages);
      const chunkPages = pages.slice(start, end);

      const pageNumbers = chunkPages.map(p => p.pageNumber);
      const pageMap: { [key: number]: string } = {};
      chunkPages.forEach(p => pageMap[p.pageNumber] = p.text);

      const text = chunkPages
        .map(p => `[Page ${p.pageNumber}]\n${p.text}`)
        .join("\n\n");

      chunks.push({ text, pageNumbers, pageMap });

      // מתקדמים ל-chunk הבא עם overlap
      const nextStart = end - overlapPages;
      start = nextStart > start ? nextStart : end; // מונע לולאה אינסופית
    }

    return chunks;
  }

  // פונקציה לאחוז דינמי לפי מספר העמודים בספר
  private getDynamicChunkPercent(totalPages: number): number {
    if (totalPages <= 30) return 25;   // ספרים קטנים – אחוז גדול
    if (totalPages <= 100) return 10;  // ספרים בינוניים – אחוז סביר
    if (totalPages <= 500) return 5;   // ספרים גדולים – אחוז קטן
    return 3;                          // ספרים ענקיים – אחוז קטן מאוד
  }

  async runWithConcurrency<T>(
    items: T[],
    limit: number,
    worker: (item: T) => Promise<void>
  ) {
    const queue = [...items];
    const workers: Promise<void>[] = [];

    async function run() {
      while (queue.length) {
        const item = queue.shift();
        if (!item) return;
        await worker(item);
      }
    }

    for (let i = 0; i < limit; i++) {
      workers.push(run());
    }

    await Promise.all(workers);
  }



  private mergeTerms(
    indexMap: Map<
      string,
      { term: string; description?: string; pages: Set<number> }
    >,
    terms: { term: string; description?: string; pageHints?: number[] }[],
    pageNumbers: number[],
    pageMap: { [key: number]: string },
  ) {
    for (const t of terms) {
      // ⛔ דילוג על מונח ריק או לא תקין
      if (!t || typeof t.term !== 'string' || !t.term.trim()) continue;

      const normalizedKey = this.normalize(t.term);
      if (!normalizedKey) continue;

      // אם המונח לא קיים במפה – צור חדש
      if (!indexMap.has(normalizedKey)) {
        indexMap.set(normalizedKey, {
          term: t.term.trim(),
          description: typeof t.description === 'string' ? t.description : undefined,
          pages: new Set<number>(),
        });
      }

      const entry = indexMap.get(normalizedKey)!;

      let pagesToAdd: number[] = [];
      // ===============================
      // 1️⃣ יש pageHints → מאמתים מול pageNumbers
      // ===============================
      if (Array.isArray(t.pageHints) && t.pageHints.length > 0) {
        const validPages = new Set(pageNumbers);

        pagesToAdd = t.pageHints.filter(
          p => typeof p === 'number' && validPages.has(p)
        );
      }

      // ===============================
      // 2️⃣ אין pageHints בכלל → fallback חיפוש בטקסט
      // ===============================
      else {
        for (const [pageNumStr, text] of Object.entries(pageMap)) {
          if (!text) continue;

          if (text.includes(t.term)) {
            const pageNum = Number(pageNumStr);
            pagesToAdd.push(pageNum);
          }
        }
      }

      // מוסיפים את העמודים ל-Set
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
