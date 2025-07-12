import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TextDocument } from 'src/database/text.model';
import * as Tesseract from 'tesseract.js';

@Injectable()
export class TextService {
  private readonly logger = new Logger(TextService.name);
  constructor(
    @InjectModel(TextDocument.name)
    private readonly textModel: Model<TextDocument>,
  ) {}

  private readonly supportedLanguages = {
    eng: 'English',
    fas: 'Persian (Farsi)',
    'eng+fas': 'English + Persian',
  };

  async ocrImage(image: Buffer | string, lang: string = 'eng'): Promise<any> {
    const start = Date.now();

    if (!this.supportedLanguages[lang]) {
      return {
        error: 'Unsupported language',
        supportedLanguages: Object.keys(this.supportedLanguages),
        details: `Language '${lang}' is not supported`,
      };
    }

    try {
      const { data } = await Tesseract.recognize(image, lang);
      const duration = Date.now() - start;

      const rawText = data.text;

      const cleanedText = this.cleanText(rawText, lang);

      try {
        const savedText = await this.textModel.create({
          text: data.text,
          cleaned: cleanedText,
          confidence: data.confidence,
          durationMs: duration,
          lang,
          languageName: this.supportedLanguages[lang],
        });
        this.logger.log(`Text saved to database with ID: ${savedText._id}`);
      } catch (dbError) {
        this.logger.error('Database save error:', dbError);
      }

      return {
        text: data.text,
        cleaned: cleanedText,
        confidence: data.confidence,
        durationMs: duration,
        lang,
        languageName: this.supportedLanguages[lang],
      };
    } catch (error) {
      this.logger.error('OCR Error', error);
      return { error: 'OCR failed', details: error.message };
    }
  }

  private cleanText(text: string, lang: string): string {
    if (lang === 'fas' || lang.includes('fas')) {
      return text
        .replace(
          /[^\u0600-\u06FF\u0750-\u077F\u06F0-\u06F9\u0660-\u0669A-Za-z0-9\s\n]/g,
          '',
        )
        .replace(/\n+/g, ' ')
        .replace(/[ \t]+/g, ' ')
        .trim();
    } else if (lang === 'eng+fas') {
      return text
        .replace(
          /[^\u0600-\u06FF\u0750-\u077F\u06F0-\u06F9\u0660-\u0669A-Za-z0-9\s\n]/g,
          '',
        )
        .replace(/\n+/g, ' ')
        .replace(/[ \t]+/g, ' ')
        .trim();
    } else {
      return text
        .replace(/[^A-Za-z0-9\s\n]/g, '')
        .replace(/\n+/g, ' ')
        .replace(/[ \t]+/g, ' ')
        .trim();
    }
  }

  getSupportedLanguages(): Record<string, string> {
    return this.supportedLanguages;
  }
}
