import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Telegraf } from 'telegraf';
import { TextService } from '../text/text.service';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TelegramService implements OnModuleInit {
  constructor(
    private readonly textService: TextService,
    private readonly configService: ConfigService,
  ) {}
  private readonly logger = new Logger(TelegramService.name);
  private bot: Telegraf;
  private adminId: number;

  private token: string;
  private waitingSupportMessage = new Set<number>();

  private userLanguages = new Map<number, string>();

  onModuleInit() {
    const adminId = this.configService.get<number>('ADMIN_ID');
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      throw new Error(
        'TELEGRAM_BOT_TOKEN is not defined in environment variables',
      );
    }
    if (!adminId) {
      throw new Error('ADMIN_ID is not defined in environment variables');
    }
    this.adminId = adminId;
    this.token = token;
    this.bot = new Telegraf(this.token);
    this.bot.start(async (ctx) => {
      await ctx.reply('سلام! لطفاً زبان متن را انتخاب کنید:', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'فارسی', callback_data: 'fas' }],
            [{ text: 'انگلیسی', callback_data: 'eng' }],
            [{ text: 'انگلیسی + فارسی', callback_data: 'eng_fas' }],
          ],
        },
      });
    });
    this.bot.on('callback_query', async (ctx) => {
      const callbackQuery = ctx.callbackQuery;

      if ('data' in callbackQuery && typeof callbackQuery.data === 'string') {
        const lang = callbackQuery.data;
        const userId = ctx.from.id;

        this.userLanguages.set(userId, lang);

        await ctx.answerCbQuery();

        let langName = '';
        if (lang === 'fas') langName = 'فارسی';
        else if (lang === 'eng') langName = 'انگلیسی';
        else if (lang === 'eng_fas') langName = 'فارسی + انگلیسی';

        await ctx.reply(
          `زبان شما به ${langName} تنظیم شد. حالا لطفاً یک عکس ارسال کن.`,
        );
      } else {
        await ctx.answerCbQuery('خطا: داده‌ای دریافت نشد.');
      }
    });
    this.bot.command('support', async (ctx) => {
      this.waitingSupportMessage.add(ctx.from.id);
      await ctx.reply(
        '✉️ لطفاً پیام، نظر یا پیشنهاد خود را بنویسید تا برای مدیر ارسال شود.',
      );
    });

    this.bot.on('text', async (ctx) => {
      const userId = ctx.from.id;

      if (this.waitingSupportMessage.has(userId)) {
        this.waitingSupportMessage.delete(userId);

        const fullName =
          `${ctx.from.first_name ?? ''} ${ctx.from.last_name ?? ''}`.trim();
        const username = ctx.from.username ? `@${ctx.from.username}` : 'ندارد';
        const messageText = ctx.message.text;

        await ctx.telegram.sendMessage(
          this.adminId,
          `📬 پیام جدید از کاربر:\n\n👤 نام: ${fullName}\n🔗 یوزرنیم: ${username}\n🆔 آیدی: ${userId}\n\n💬 پیام:\n${messageText}`,
        );

        await ctx.reply(
          '✅ پیام شما با موفقیت برای مدیر ارسال شد. ممنون از بازخوردتان!',
        );
      } else {
        await ctx.reply('❓ نمی‌فهمم چی گفتی. اول زبان رو انتخاب کن:', {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'فارسی', callback_data: 'fas' }],
              [{ text: 'انگلیسی', callback_data: 'eng' }],
              [{ text: 'انگلیسی + فارسی', callback_data: 'eng_fas' }],
            ],
          },
        });
      }
    });

    this.bot.on('photo', async (ctx) => {
      try {
        const userId = ctx.from.id;
        const lang = this.userLanguages.get(userId);

        const photos = ctx.message.photo;
        const fileId = photos[photos.length - 1].file_id;
        const fileLink = await ctx.telegram.getFileLink(fileId);

        const response = await axios.get(fileLink.href, {
          responseType: 'arraybuffer',
        });
        const imageBuffer = Buffer.from(response.data, 'binary');

        const ocrResult = await this.textService.ocrImage(imageBuffer, lang);

        if (ocrResult.error) {
          await ctx.reply(`خطا در استخراج متن: ${ocrResult.error}`);
        } else if (ocrResult.warning) {
          await ctx.reply(
            `متن استخراج شده:\n${ocrResult.cleaned}\n\n⚠️ توجه: متن ممکن است ناقص یا کیفیت پایینی داشته باشد. لطفاً عکس واضح‌تری ارسال کنید.`,
          );
        } else {
          await ctx.reply(`متن استخراج شده:\n${ocrResult.cleaned}`);
        }
      } catch (error) {
        this.logger.error('خطا در پردازش عکس', error);
        await ctx.reply('خطا در پردازش تصویر پیش آمد.');
      }
    });

    this.bot.launch();
    this.logger.log('Telegram bot started');
  }
}
