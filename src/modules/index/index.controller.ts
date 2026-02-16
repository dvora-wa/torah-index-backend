
import { Controller, Post, Body, UseInterceptors, UploadedFile, BadRequestException, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { IndexService } from './index.service';
import { IndexType, IndexResponseDto, IndexEntry } from './types';
import { Document, Packer, Paragraph, AlignmentType, TextRun } from 'docx';
import type { Response } from 'express';

@Controller('api/index')
export class IndexController {
  constructor(private indexService: IndexService) { }

  @Post('generate')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({ destination: './uploads', filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`) }),
      fileFilter: (req, file, cb) => {
        if (file.mimetype !== 'application/pdf') cb(new BadRequestException('Only PDF files are allowed'), false);
        else cb(null, true);
      },
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  @HttpCode(HttpStatus.OK)
  async generateIndex(@UploadedFile() file: any,
    @Body('indexType') indexType: IndexType,
    @Body('fromPage') fromPage?: string,
    @Body('toPage') toPage?: string,): Promise<IndexResponseDto> {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!Object.values(IndexType).includes(indexType)) throw new BadRequestException('Invalid index type');

    try {
      const generatedIndex = await this.indexService.generateIndexFromFile(
        file.path,
        indexType,
        fromPage ? Number(fromPage) : undefined,
        toPage ? Number(toPage) : undefined,);
      const previewEntries = this.indexService.getPreviewEntries(generatedIndex.entries, 5);

      return { success: true, data: generatedIndex, message: `${indexType} index generated successfully`, previewEntries };
    } catch (err) {
      throw new BadRequestException(`Failed to generate index: ${err.message}`);
    }
  }

  @Post('export-word')
  @HttpCode(HttpStatus.OK)
  async exportToWord(
    @Body() body: { entries: IndexEntry[]; indexType: string },
    @Res() res: Response,
  ) {
    if (!body?.entries || !Array.isArray(body.entries)) {
      throw new BadRequestException('Invalid entries payload');
    }

    const paragraphs: Paragraph[] = [
      // כותרת ראשית
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        bidirectional: true,
        spacing: { after: 400 },
        children: [
          new TextRun({
            text: `מפתח ${body.indexType}`,
            bold: true,
            size: 32,
            rightToLeft: true
          }),
        ],
      }),
    ];

    for (const entry of body.entries) {
      const pageInfo =
        entry.pageNumbers && entry.pageNumbers.length
          ? ` (${entry.pageNumbers.join(', ')})`
          : '';

      // שם הערך
      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          bidirectional: true,
          spacing: { after: 120 },
          children: [
            new TextRun({
              text: entry.term + pageInfo,
              bold: true,
            }),
          ],
        }),
      );

      // תיאור (אם קיים)
      if (entry.description) {
        paragraphs.push(
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            bidirectional: true,
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: entry.description,
                italics: true,
              }),
            ],
          }),
        );
      }
    }

    const doc = new Document({
      sections: [
        {
          // properties: {
          //   bidi: true,  // ✅ RTL ברמת section
          // },
          children: paragraphs,
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="index-${body.indexType}.docx"`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }

}
