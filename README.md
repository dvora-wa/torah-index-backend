# Book Index Generator — Backend

An AI-powered backend service that automatically generates indexes for books from PDF files, built with NestJS and the OpenAI API.

**Maintained by:** dvora-wa
**Type:** Client project

## Overview

This service takes a book as a PDF and automatically produces a structured index. It extracts the text from the PDF, splits it into overlapping chunks, sends each chunk to an AI model to identify index terms, merges the results, and can export the final index as a Word document.

It supports three types of index:

- **Sources** — references and citations
- **Topics** — subjects and themes
- **Persons** — names of people

## How It Works

1. **PDF text extraction** — the uploaded PDF is parsed and its text extracted per page (a dedicated PDF module), with support for selecting a page range.
2. **Chunking** — the text is split into chunks with overlap between pages, so terms that fall on the boundary between chunks are not missed.
3. **AI analysis** — each chunk is sent to the OpenAI API. The request uses a strict JSON Schema (Structured Outputs) so the model returns clean, structured data for the requested index type.
4. **Merging** — results from all chunks are merged; duplicate terms are combined and each term is mapped to the page numbers where it appears.
5. **Export** — the final index can be exported as a Word (`.docx`) document.

## Engineering Highlights

- **Structured Outputs** — uses OpenAI JSON Schema with `strict: true` for reliable, well-formed responses.
- **Retry mechanism** — failed AI calls are retried up to a maximum number of attempts, with a fallback for unparseable responses.
- **Parallel processing** — chunks are analyzed with limited concurrency to speed up processing of large documents.
- **Deterministic extraction** — `temperature: 0` is used, since the goal is accurate extraction rather than creative output.
- **Configurable prompts** — a dedicated configuration module allows editing the AI prompts through an API, instead of hard-coding them.
- **Modular architecture** — clear separation into `index`, `pdf`, and `config` modules, following NestJS conventions.

## API Endpoints

- `POST /index/generate` — accepts a PDF file, an index type, and an optional page range; returns the generated index.
- `POST /index/export-word` — accepts index entries and returns a Word document.
- Configuration endpoints for viewing and updating the AI prompts.

## Technical Stack

- **Framework:** NestJS 11
- **Language:** TypeScript
- **AI:** OpenAI API (Structured Outputs)
- **PDF processing:** pdfjs-dist
- **Document generation:** docx
- **Validation:** class-validator / class-transformer

## Setup

```bash
# install dependencies
npm install

# run in development
npm run start:dev
```

### Environment Variables

The service requires an OpenAI API key, provided via an environment variable (never commit it to the repository):

```
OPENAI_API_KEY=your-key-here
```

## Related Repository

- **Frontend:** [torah-index-frontend](https://github.com/dvora-wa/torah-index-frontend) — the Angular client for this service.

## Future Development / Roadmap

Ideas for continuing the project:

- Support for additional export formats (PDF, Excel).
- Caching of processed documents to avoid re-analyzing the same book.
- A job queue for very large documents instead of processing in a single request.
- Automated tests covering the chunking and merging logic.
