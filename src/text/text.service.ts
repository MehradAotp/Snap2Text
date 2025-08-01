import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as path from 'path';
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
      const langPath = path.resolve(process.cwd(), 'traineddata');
      const { data } = await Tesseract.recognize(image, lang, {
        langPath,
      });
      const duration = Date.now() - start;

      const rawText = data.text;

      const cleanedText = this.cleanText(rawText, lang);
      if (!cleanedText || cleanedText.length < 5 || data.confidence < 50) {
        this.logger.warn(
          'Text is empty or confidence too low, skipping DB save.',
        );
        return {
          text: rawText,
          cleaned: cleanedText,
          confidence: data.confidence,
          durationMs: duration,
          lang,
          languageName: this.supportedLanguages[lang],
          warning:
            'Text is empty, too short, or confidence is low; not saved to DB.',
        };
      }
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
    let cleaned = '';

    if (lang === 'fas' || lang.includes('fas')) {
      cleaned = text
        .replace(
          /[^\u0600-\u06FF\u0750-\u077F\u06F0-\u06F9\u0660-\u0669A-Za-z0-9\s\n]/g,
          '',
        )
        .replace(/\n+/g, ' ')
        .replace(/[ \t]+/g, ' ')
        .trim();
    } else if (lang === 'eng+fas') {
      cleaned = text
        .replace(
          /[^\u0600-\u06FF\u0750-\u077F\u06F0-\u06F9\u0660-\u0669A-Za-z0-9\s\n]/g,
          '',
        )
        .replace(/\n+/g, ' ')
        .replace(/[ \t]+/g, ' ')
        .trim();
    } else {
      cleaned = text
        .replace(/[^A-Za-z0-9\s\n]/g, '')
        .replace(/\n+/g, ' ')
        .replace(/[ \t]+/g, ' ')
        .trim();
    }

    const blacklist = new Set(['=', 'u', 'U', '[', ']']);

    const words = cleaned.split(' ').filter((word) => {
      const lower = word.toLowerCase();

      if (blacklist.has(lower)) return false;

      if (word.length === 1 && !/[a-z0-9]/i.test(word)) return false;

      return true;
    });

    return words.join(' ');
  }

  getSupportedLanguages(): Record<string, string> {
    return this.supportedLanguages;
  }
}
