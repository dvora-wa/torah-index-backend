export enum IndexType {
  SOURCES = 'sources',
  TOPICS = 'topics',
  PERSONS = 'persons',
}

export interface IndexEntry {
  term: string;
  pageNumbers: (number | string)[];
  description?: string;
}

export interface GeneratedIndex {
  type: IndexType;
  entries: IndexEntry[];
  generatedAt: Date;
  bookName?: string;
}

export class CreateIndexDto {
  type: IndexType;
  pdfContent: string;
}

export class IndexResponseDto {
  success: boolean;
  data: GeneratedIndex;
  message: string;
  previewEntries: IndexEntry[]; // First few entries for preview
}

export interface TextChunk {
  fromPage: number;
  toPage: number;
  text: string;
}