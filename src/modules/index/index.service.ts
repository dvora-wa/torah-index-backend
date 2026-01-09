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
        this.mergeTerms(indexMap, terms, chunk.pageNumbers, chunk.pageMap);
      }

      return this.buildFinalIndex(indexMap, indexType);
    }
    finally {
      this.cleanupFile(filePath);
    }
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

      const text = chunkPages.map(p => p.text).join("\n\n");

      chunks.push({ text, pageNumbers, pageMap });

      // חפיפה – מעבירים את התחלת ה־chunk הבא אחורה לפי overlapPages
      start = end - overlapPages;
      if (start < 0) start = 0; // הגנה על ספרים קטנים מאוד
      if (start >= totalPages) break;
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

  // private buildChunks(
  //   pages: { pageNumber: number; text: string }[],
  //   overlapPages = 0, // כמה עמודים לחפיפה בין chunks
  //   desiredChunkPercent = 10,  // אחוז ספר לכל chunk       
  // ): Array<{ text: string; pageNumbers: number[]; pageMap: { [key: number]: string } }> {

  //   const totalPages = pages.length;
  //   // חישוב מספר עמודים לכל chunk לפי אחוז
  //   let pagesPerChunk = Math.ceil((desiredChunkPercent / 100) * totalPages);
  //   if (pagesPerChunk < 1) pagesPerChunk = 1;

  //   var chunks: Array<{ text: string; pageNumbers: number[]; pageMap: { [key: number]: string } }> = [];
  //   let start = 0;

  //   while (start < totalPages) {
  //     const end = Math.min(start + pagesPerChunk, totalPages);
  //     const slice = pages.slice(start, end);

  //     // מחזיקים מיפוי של עמודים למילים שלהם
  //     const pageMap: { [key: number]: string } = {};
  //     slice.forEach(p => (pageMap[p.pageNumber] = p.text));

  //     const chunkText = slice.map(p => `${p.pageNumber}: ${p.text}`).join('\n\n');

  //     const pageNumbers = slice.map(p => p.pageNumber);

  //     chunks.push({ text: chunkText, pageNumbers, pageMap });

  //     // מתקדמים ל-chunk הבא עם overlap
  //     const nextStart = end - overlapPages;
  //     start = nextStart > start ? nextStart : end; // מונע לולאה אינסופית
  //   }
  //   return chunks;
  // }

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

      // // 1️⃣ קודם משתמשים ב-pageHints אם קיימים
      // if (Array.isArray(t.pageHints) && t.pageHints.length > 0) {
      //   pagesToAdd = t.pageHints.filter(p => typeof p === 'number');
      // }
      // // 2️⃣ אחרת – עוברים על pageMap כדי למצוא את העמודים בהם מופיע המונח
      // else if (pageMap && Object.keys(pageMap).length > 0) {
      //   for (const [pageNumStr, text] of Object.entries(pageMap)) {
      //     const pageNum = parseInt(pageNumStr, 10);
      //     if (!text) continue;
      //     if (text.includes(t.term)) {
      //       pagesToAdd.push(pageNum);
      //     }
      //   }
      // }

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
