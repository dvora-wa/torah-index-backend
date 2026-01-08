// // import { Injectable } from '@nestjs/common';
// // import * as pdf from 'pdf-parse';
// // import * as fs from 'fs';



// // export interface PdfContent {
// //   text: string;
// //   pageCount: number;
// //   pages: Array<{ pageNumber: number; text: string }>;
// // }

// // @Injectable()
// // export class PdfService {

// //     async extractText(filePath: string): Promise<PdfContent> {
// //     try {
// //       const dataBuffer = fs.readFileSync(filePath);
// //       const data = await pdf(dataBuffer);

// //       const pages: Array<{ pageNumber: number; text: string }> = [];

// //       // Extract text from each page
// //       for (let i = 0; i < data.numpages; i++) {
// //         // pdf-parse doesn't provide per-page text in standard version
// //         // You may need pdf-parse pro or alternative library for this
// //         pages.push({
// //           pageNumber: i + 1,
// //           text: '', // Would need additional processing
// //         });
// //       }

// //       return {
// //         text: data.text,
// //         pageCount: data.numpages,
// //         pages,
// //       };
// //     } catch (error) {
// //       throw new Error(`Failed to extract PDF text: ${error.message}`);
// //     }
// //   }

// //   async extractTextByPage(filePath: string): Promise<PdfContent> {
// //     // For better page-by-page extraction, consider using pdfjs-dist
// //     try {
// //       const dataBuffer = fs.readFileSync(filePath);
// //       const data = await pdf(dataBuffer);

// //       return {
// //         text: data.text,
// //         pageCount: data.numpages,
// //         pages: [],
// //       };
// //     } catch (error) {
// //       throw new Error(`Failed to extract PDF pages: ${error.message}`);
// //     }
// //   }
// // }


// import { Injectable } from '@nestjs/common';
// import * as fs from 'fs';

// // const pdf = require('pdf-parse');

// // const pdfImport = require('pdf-parse');
// // const pdf = (pdfImport.default ?? pdfImport);

// const pdf = require('pdf-parse').default || require('pdf-parse');

// export interface PdfContent {
//   text: string;
//   pageCount: number;
//   pages: Array<{ pageNumber: number; text: string }>;
// }

// @Injectable()
// export class PdfService {
//   // Extract all text from PDF
//   async extractText(filePath: string): Promise<PdfContent> {
//     try {
//       const dataBuffer = fs.readFileSync(filePath);
//       console.log('PDF parse function:', pdf); // לראות אם זה פונקציה
//       const data = await pdf(dataBuffer); // ✅ pdf is callable now
//       console.log('PDF data:', data);

//       const pages: Array<{ pageNumber: number; text: string }> = [];

//       // Extract text per page (pdf-parse רגיל לא נותן per-page)
//       for (let i = 0; i < data.numpages; i++) {
//         pages.push({
//           pageNumber: i + 1,
//           text: '', // ניתן לשדרג בעתיד עם ספרייה מתקדמת יותר
//         });
//       }

//       return {
//         text: data.text,
//         pageCount: data.numpages,
//         pages,
//       };
//     } catch (error: any) {
//       throw new Error(`Failed to extract PDF text: ${error.message}`);
//     }
//   }

//   // Optional: separate method for page-by-page extraction
//   async extractTextByPage(filePath: string): Promise<PdfContent> {
//     try {
//       const dataBuffer = fs.readFileSync(filePath);
//       const data = await pdf(dataBuffer);

//       return {
//         text: data.text,
//         pageCount: data.numpages,
//         pages: [], // לדפים נפרדים יש להשתמש ב-pdfjs-dist או ספרייה אחרת
//       };
//     } catch (error: any) {
//       throw new Error(`Failed to extract PDF pages: ${error.message}`);
//     }
//   }
// }
//------------------------------------------------------------------------------------------------------------------

// import { Injectable } from '@nestjs/common';
// import * as fs from 'fs';
// import * as pdfjsLib from 'pdfjs-dist';

// export interface PdfContent {
//   text: string;
//   pageCount: number;
//   pages: Array<{ pageNumber: number; text: string }>;
// }

// @Injectable()
// export class PdfService {
//   async extractText(filePath: string): Promise<PdfContent> {
//     const data = new Uint8Array(fs.readFileSync(filePath));
//     const loadingTask = pdfjsLib.getDocument({ data });
//     const pdf = await loadingTask.promise;

//     const pages: Array<{ pageNumber: number; text: string }> = [];
//     let fullText = '';

//     for (let i = 1; i <= pdf.numPages; i++) {
//       const page = await pdf.getPage(i);
//       const content = await page.getTextContent();
//       const strings = content.items.map((item: any) => item.str);
//       const pageText = strings.join(' ');
//       pages.push({ pageNumber: i, text: pageText });
//       fullText += pageText + '\n';
//     }

//     return { text: fullText, pageCount: pdf.numPages, pages };
//   }
// }

//-----------------------------------------------------------------------------------------------------------------

import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import path from 'path';
// לגרסה 2.16.105 משתמשים ב-legacy:
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

// 🔥 בשרת – מבטלים worker לחלוטין
pdfjsLib.GlobalWorkerOptions.workerSrc = null;

export interface PdfContent {
  pageCount: number;
  pages: Array<{ pageNumber: number; text: string }>;
}

@Injectable()
export class PdfService {
  async extractText(filePath: string): Promise<PdfContent> {
    const data = new Uint8Array(fs.readFileSync(filePath));
    const loadingTask = pdfjsLib.getDocument({ data });
    const pdf = await loadingTask.promise;

    const pages: Array<{ pageNumber: number; text: string }> = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items.map((item: any) => item.str);
      const pageText = strings.join(' ');
      pages.push({ pageNumber: i, text: pageText });
    }

    return {
      pageCount: pdf.numPages,
      pages,
    }; 
  }
}


