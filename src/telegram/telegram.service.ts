import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Telegraf } from 'telegraf';
import { TextService } from '../text/text.service';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { ExtraReplyMessage } from 'telegraf/typings/telegram-types';

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
      const messageId = ctx.update.message?.message_id;
      const firstName = ctx.from?.first_name;

      await ctx.telegram.sendMessage(
        ctx.chat.id,
        `سلام ${firstName}! خوش اومدی 😊\n\nلطفاً زبانی که می‌خواید متن ازش استخراج بشه رو انتخاب کنید:`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'فارسی', callback_data: 'fas' }],
              [{ text: 'انگلیسی', callback_data: 'eng' }],
              [{ text: 'انگلیسی + فارسی', callback_data: 'eng+fas' }],
            ],
          },
          reply_to_message_id: messageId,
        } as ExtraReplyMessage,
      );
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
        else if (lang === 'eng+fas') langName = 'فارسی + انگلیسی';

        if (ctx.callbackQuery.message) {
          await ctx.editMessageText(
            `✅ زبان شما به ${langName} تنظیم شد.\n\n📸 حالا لطفاً یک عکس ارسال کنید تا متن آن را استخراج کنم.`,
            {
              reply_markup: { inline_keyboard: [] },
            },
          );
        }
      } else {
        await ctx.answerCbQuery('خطا: داده‌ای دریافت نشد.');
      }
    });
    this.bot.command('support', async (ctx) => {
      this.waitingSupportMessage.add(ctx.from.id);
      const messageId = ctx.update.message?.message_id;
      await ctx.telegram.sendMessage(
        ctx.chat.id,
        '✉️ لطفاً پیام، نظر یا پیشنهاد خود را بنویسید تا برای مدیر ارسال شود.',
        {
          reply_to_message_id: messageId,
        } as ExtraReplyMessage,
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

        const messageId = ctx.update.message?.message_id;
        await ctx.telegram.sendMessage(
          ctx.chat.id,
          '✅ پیام شما با موفقیت برای مدیر ارسال شد. ممنون از بازخوردتان!',
          {
            reply_to_message_id: messageId,
          } as ExtraReplyMessage,
        );
      } else {
        const messageId = ctx.update.message?.message_id;
        await ctx.telegram.sendMessage(
          ctx.chat.id,
          '❓ نمی‌فهمم چی گفتی. اول زبان رو انتخاب کن:',
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: 'فارسی', callback_data: 'fas' }],
                [{ text: 'انگلیسی', callback_data: 'eng' }],
                [{ text: 'انگلیسی + فارسی', callback_data: 'eng+fas' }],
              ],
            },
            reply_to_message_id: messageId,
          } as ExtraReplyMessage,
        );
      }
    });

    this.bot.on('photo', async (ctx) => {
      try {
        const userId = ctx.from.id;
        const lang = this.userLanguages.get(userId);
        if (!lang) {
          const messageId = ctx.update.message?.message_id;
          await ctx.telegram.sendMessage(
            ctx.chat.id,
            '❗ لطفاً اول زبان رو انتخاب کن و بعد عکس رو ارسال کن.',
            {
              reply_to_message_id: messageId,
              reply_markup: {
                inline_keyboard: [
                  [{ text: 'فارسی', callback_data: 'fas' }],
                  [{ text: 'انگلیسی', callback_data: 'eng' }],
                  [{ text: 'انگلیسی + فارسی', callback_data: 'eng+fas' }],
                ],
              },
            } as ExtraReplyMessage,
          );
          return;
        }
        const photos = ctx.message.photo;
        const fileId = photos[photos.length - 1].file_id;
        const fileLink = await ctx.telegram.getFileLink(fileId);
        const processingMsg = await ctx.reply('🔄 در حال پردازش تصویر...');
        const response = await axios.get(fileLink.href, {
          responseType: 'arraybuffer',
        });
        const imageBuffer = Buffer.from(response.data, 'binary');
        const ocrResult = await this.textService.ocrImage(imageBuffer, lang);
        const messageId = ctx.update.message?.message_id;
        if (ocrResult.error) {
          await ctx.telegram.sendMessage(
            ctx.chat.id,
            `خطا در استخراج متن: ${ocrResult.error}`,
            {
              reply_to_message_id: messageId,
            } as ExtraReplyMessage,
          );
        } else if (ocrResult.warning) {
          await ctx.telegram.sendMessage(
            ctx.chat.id,
            `متن استخراج شده:\n${ocrResult.cleaned}\n\n⚠️ توجه: متن ممکن است ناقص یا کیفیت پایینی داشته باشد. لطفاً عکس واضح‌تری ارسال کنید.`,
            {
              reply_to_message_id: messageId,
            } as ExtraReplyMessage,
          );
        } else {
          await sleep(1000);
          await ctx.telegram.deleteMessage(
            ctx.chat.id,
            processingMsg.message_id,
          );
          await ctx.telegram.sendMessage(
            ctx.chat.id,
            `متن استخراج شده:\n${ocrResult.cleaned}`,
            {
              reply_to_message_id: messageId,
            } as ExtraReplyMessage,
          );
        }
      } catch (error) {
        this.logger.error('خطا در پردازش عکس', error);
        const messageId = ctx.update.message?.message_id;
        await ctx.telegram.sendMessage(
          ctx.chat.id,
          'خطا در پردازش تصویر پیش آمد.',
          {
            reply_to_message_id: messageId,
          } as ExtraReplyMessage,
        );
      }
    });

    this.bot.launch();
    this.logger.log('Telegram bot started');
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
