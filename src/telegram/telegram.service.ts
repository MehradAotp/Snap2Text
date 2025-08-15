import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Telegraf } from 'telegraf';
import { TextService } from '../text/text.service';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { ExtraReplyMessage } from 'telegraf/typings/telegram-types';
import moment from 'moment-jalaali';

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
  private waitingAdminReply = new Map<number, number>();
  private waitingAdminReplyMessageId = new Map<number, number>();
  private waitingBroadcastMessage = new Set<number>();
  private waitingSingleMessage = new Map<number, number>();
  private userLanguages = new Map<number, string>();
  private supportMessages = new Map<
    number,
    {
      userId: number;
      fullName: string;
      username: string;
      message: string;
      timestamp: Date;
      isRead: boolean;
    }
  >();
  private userInfos = new Map<
    number,
    {
      fullName: string;
      username: string | undefined;
      firstStartDate: Date;
    }
  >();

  onModuleInit() {
    const adminId = this.configService.get<string>('ADMIN_ID');
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      throw new Error(
        'TELEGRAM_BOT_TOKEN is not defined in environment variables',
      );
    }
    if (!adminId) {
      throw new Error('ADMIN_ID is not defined in environment variables');
    }
    this.adminId = parseInt(adminId);
    this.token = token;
    this.bot = new Telegraf(this.token);

    this.setupBotHandlers();
    this.bot.launch();
    this.logger.log('Telegram bot started');
  }

  private setupBotHandlers() {
    // Start command
    this.bot.start(this.handleStart.bind(this));

    // Admin panel command
    this.bot.command('panel', this.handleAdminPanel.bind(this));

    // Support command
    this.bot.command('support', this.handleSupport.bind(this));

    // Callback queries
    this.bot.on('callback_query', this.handleCallbackQuery.bind(this));

    // Text messages
    this.bot.on('text', this.handleTextMessage.bind(this));

    // Photo messages
    this.bot.on('photo', this.handlePhotoMessage.bind(this));
  }

  private async handleStart(ctx: any) {
    const messageId = ctx.update.message?.message_id;
    const firstName = ctx.from?.first_name;
    const userId = ctx.from.id;
    const fullName =
      `${ctx.from.first_name ?? ''} ${ctx.from.last_name ?? ''}`.trim();
    const username = ctx.from.username ? `@${ctx.from.username}` : 'ندارد';

    if (!this.userInfos.has(userId)) {
      this.userInfos.set(userId, {
        fullName,
        username,
        firstStartDate: new Date(),
      });
    }

    await ctx.telegram.sendMessage(
      ctx.chat.id,
      `سلام ${firstName}! خوش اومدی 😊\n\nلطفاً زبانی که می‌خواید متن ازش استخراج بشه رو انتخاب کنید:`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'فارسی', callback_data: 'lang:fas' }],
            [{ text: 'انگلیسی', callback_data: 'lang:eng' }],
            [{ text: 'انگلیسی + فارسی', callback_data: 'lang:eng+fas' }],
          ],
        },
        reply_to_message_id: messageId,
      } as ExtraReplyMessage,
    );
  }

  private async handleAdminPanel(ctx: any) {
    if (ctx.from.id !== this.adminId) {
      await ctx.reply('⛔ فقط ادمین به این بخش دسترسی دارد.');
      return;
    }

    await ctx.reply('🔧 پنل مدیریت', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📊 آمار کلی', callback_data: 'admin:stats' }],
          [{ text: '👥 لیست کاربران', callback_data: 'admin:users' }],
          [{ text: '📢 ارسال پیام همگانی', callback_data: 'admin:broadcast' }],
          [{ text: '💬 ارسال پیام تکی', callback_data: 'admin:single' }],
          [{ text: '📬 پیام‌های پشتیبانی', callback_data: 'admin:support' }],
        ],
      },
    });
  }

  private async handleSupport(ctx: any) {
    this.waitingSupportMessage.add(ctx.from.id);
    const messageId = ctx.update.message?.message_id;
    await ctx.telegram.sendMessage(
      ctx.chat.id,
      '✉️ لطفاً پیام، نظر یا پیشنهاد خود را بنویسید تا برای مدیر ارسال شود.',
      {
        reply_to_message_id: messageId,
      } as ExtraReplyMessage,
    );
  }

  private async handleCallbackQuery(ctx: any) {
    const callbackQuery = ctx.callbackQuery;
    if (!('data' in callbackQuery) || typeof callbackQuery.data !== 'string') {
      await ctx.answerCbQuery('خطا: داده‌ای دریافت نشد.');
      return;
    }

    const data = callbackQuery.data;

    // Language selection
    if (data.startsWith('lang:')) {
      await this.handleLanguageSelection(ctx, data);
      return;
    }

    // Admin panel actions
    if (data.startsWith('admin:')) {
      await this.handleAdminAction(ctx, data);
      return;
    }

    // User info
    if (data.startsWith('userinfo:')) {
      await this.handleUserInfo(ctx, data);
      return;
    }

    // Reply to user
    if (data.startsWith('reply:')) {
      await this.handleReplyToUser(ctx, data);
      return;
    }

    // Single message
    if (data.startsWith('single:')) {
      await this.handleSingleMessageSelection(ctx, data);
      return;
    }

    // Support message
    if (data.startsWith('support:')) {
      await this.handleSupportMessageView(ctx, data);
      return;
    }

    // Ignore support message
    if (data.startsWith('ignore:')) {
      await this.handleIgnoreSupportMessage(ctx, data);
      return;
    }

    // Cancel actions
    if (
      data === 'cancel_reply' ||
      data === 'cancel_broadcast' ||
      data === 'cancel_single'
    ) {
      await this.handleCancelAction(ctx, data);
      return;
    }

    // Back to admin panel
    if (data === 'back_to_panel') {
      await this.showAdminPanel(ctx);
      return;
    }

    await ctx.answerCbQuery('عملیات نامعتبر');
  }

  private async handleLanguageSelection(ctx: any, data: string) {
    const lang = data.split(':')[1];
    const userId = ctx.from.id;
    this.userLanguages.set(userId, lang);

    let langName = '';
    if (lang === 'fas') langName = 'فارسی';
    else if (lang === 'eng') langName = 'انگلیسی';
    else if (lang === 'eng+fas') langName = 'فارسی + انگلیسی';

    await ctx.answerCbQuery();
    if (ctx.callbackQuery.message) {
      await ctx.editMessageText(
        `✅ زبان شما به ${langName} تنظیم شد.\n\n📸 حالا لطفاً یک عکس ارسال کنید تا متن آن را استخراج کنم.`,
        {
          reply_markup: { inline_keyboard: [] },
        },
      );
    }
  }

  private async handleAdminAction(ctx: any, data: string) {
    if (ctx.from.id !== this.adminId) {
      await ctx.answerCbQuery('⛔ فقط ادمین به این بخش دسترسی دارد.');
      return;
    }

    const action = data.split(':')[1];

    switch (action) {
      case 'stats':
        await this.showStats(ctx);
        break;
      case 'users':
        await this.showUsersList(ctx);
        break;
      case 'broadcast':
        await this.startBroadcast(ctx);
        break;
      case 'single':
        await this.startSingleMessage(ctx);
        break;
      case 'support':
        await this.showSupportMessages(ctx);
        break;
      default:
        await ctx.answerCbQuery('عملیات نامعتبر');
    }
  }

  private async showStats(ctx: any) {
    const totalUsers = this.userInfos.size;
    const activeUsers = this.userLanguages.size;
    const today = new Date();
    const todayUsers = Array.from(this.userInfos.values()).filter(
      (info) => info.firstStartDate.toDateString() === today.toDateString(),
    ).length;

    await ctx.answerCbQuery();
    await ctx.editMessageText(
      `📊 آمار کلی:\n\n` +
        `👥 کل کاربران: ${totalUsers}\n` +
        `✅ کاربران فعال: ${activeUsers}\n` +
        `📅 کاربران امروز: ${todayUsers}`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 بازگشت به پنل', callback_data: 'back_to_panel' }],
          ],
        },
      },
    );
  }

  private async showUsersList(ctx: any) {
    const buttons = Array.from(this.userInfos.entries()).map(
      ([userId, info]) => {
        const label =
          info.fullName.length > 20
            ? info.fullName.slice(0, 17) + '…'
            : info.fullName;
        return [
          {
            text: `${label}${info.username ? ` (${info.username})` : ''}`,
            callback_data: `userinfo:${userId}`,
          },
        ];
      },
    );

    if (buttons.length === 0) {
      await ctx.answerCbQuery();
      await ctx.editMessageText('❌ هیچ کاربری تا حالا ثبت نشده.', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 بازگشت به پنل', callback_data: 'back_to_panel' }],
          ],
        },
      });
      return;
    }

    // Add pagination if needed (for now, just show all)
    buttons.push([
      { text: '🔙 بازگشت به پنل', callback_data: 'back_to_panel' },
    ]);

    await ctx.answerCbQuery();
    await ctx.editMessageText('📋 لیست کاربران ثبت‌شده:', {
      reply_markup: {
        inline_keyboard: buttons,
      },
    });
  }

  private async startBroadcast(ctx: any) {
    this.waitingBroadcastMessage.add(ctx.from.id);
    await ctx.answerCbQuery();
    await ctx.editMessageText(
      '📢 ارسال پیام همگانی\n\nلطفاً پیام خود را بنویسید تا برای همه کاربران ارسال شود:',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '❌ لغو', callback_data: 'cancel_broadcast' }],
          ],
        },
      },
    );
  }

  private async startSingleMessage(ctx: any) {
    const buttons = Array.from(this.userInfos.entries()).map(
      ([userId, info]) => {
        const label =
          info.fullName.length > 20
            ? info.fullName.slice(0, 17) + '…'
            : info.fullName;
        return [
          {
            text: `${label}${info.username ? ` (${info.username})` : ''}`,
            callback_data: `single:${userId}`,
          },
        ];
      },
    );

    buttons.push([
      { text: '🔙 بازگشت به پنل', callback_data: 'back_to_panel' },
    ]);

    await ctx.answerCbQuery();
    await ctx.editMessageText('💬 انتخاب کاربر برای ارسال پیام:', {
      reply_markup: {
        inline_keyboard: buttons,
      },
    });
  }

  private async showSupportMessages(ctx: any) {
    const unreadMessages = Array.from(this.supportMessages.values()).filter(
      (msg) => !msg.isRead,
    );
    const readMessages = Array.from(this.supportMessages.values()).filter(
      (msg) => msg.isRead,
    );

    let messageText = '📬 پیام‌های پشتیبانی\n\n';

    if (unreadMessages.length === 0 && readMessages.length === 0) {
      messageText += 'در حال حاضر هیچ پیام پشتیبانی وجود ندارد.';
    } else {
      if (unreadMessages.length > 0) {
        messageText += `📥 پیام‌های جدید: ${unreadMessages.length}\n`;
      }
      if (readMessages.length > 0) {
        messageText += `📤 پیام‌های خوانده شده: ${readMessages.length}\n`;
      }
    }

    const buttons: any[] = [];

    // Add unread messages first
    unreadMessages.slice(0, 5).forEach((msg, index) => {
      const shortMessage =
        msg.message.length > 30
          ? msg.message.slice(0, 27) + '...'
          : msg.message;
      buttons.push([
        {
          text: `📥 ${msg.fullName}: ${shortMessage}`,
          callback_data: `support:${Array.from(this.supportMessages.keys())[index]}`,
        },
      ]);
    });

    // Add read messages
    readMessages.slice(0, 3).forEach((msg, index) => {
      const shortMessage =
        msg.message.length > 30
          ? msg.message.slice(0, 27) + '...'
          : msg.message;
      buttons.push([
        {
          text: `📤 ${msg.fullName}: ${shortMessage}`,
          callback_data: `support:${Array.from(this.supportMessages.keys())[unreadMessages.length + index]}`,
        },
      ]);
    });

    buttons.push([
      { text: '🔙 بازگشت به پنل', callback_data: 'back_to_panel' },
    ]);

    await ctx.answerCbQuery();
    await ctx.editMessageText(messageText, {
      reply_markup: {
        inline_keyboard: buttons,
      },
    });
  }

  private async handleUserInfo(ctx: any, data: string) {
    if (ctx.from.id !== this.adminId) {
      await ctx.answerCbQuery('⛔ فقط ادمین به این اطلاعات دسترسی دارد.');
      return;
    }

    const targetId = parseInt(data.split(':')[1]);
    const info = this.userInfos.get(targetId);

    if (!info) {
      await ctx.answerCbQuery('❌ اطلاعاتی برای این کاربر پیدا نشد.');
      return;
    }

    const formattedDate = info.firstStartDate.toLocaleDateString('fa-IR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    await ctx.answerCbQuery();
    await ctx.editMessageText(
      `ℹ️ اطلاعات کاربر ${targetId}:\n` +
        `👤 نام: ${info.fullName}\n` +
        `🔗 یوزرنیم: ${info.username}\n` +
        `📅 تاریخ ورود: ${formattedDate}`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '💬 ارسال پیام', callback_data: `single:${targetId}` },
              { text: '🔙 بازگشت', callback_data: 'admin:users' },
            ],
          ],
        },
      },
    );
  }

  private async handleReplyToUser(ctx: any, data: string) {
    if (ctx.from.id !== this.adminId) {
      await ctx.answerCbQuery('⛔ شما مجاز به این عملیات نیستید.');
      return;
    }

    const parts = data.split(':');
    const userId = parseInt(parts[1]);
    const messageId = parts.length > 2 ? parseInt(parts[2]) : null;

    this.waitingAdminReply.set(ctx.from.id, userId);
    if (messageId) {
      this.waitingAdminReplyMessageId.set(ctx.from.id, messageId);
    }

    await ctx.answerCbQuery();
    await ctx.editMessageText(
      `📝 در حال پاسخ به کاربر ${userId}\n\nلطفاً پیام پاسخ خود را بنویسید:`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '❌ لغو پاسخ', callback_data: 'cancel_reply' }],
          ],
        },
      },
    );
  }

  private async handleSingleMessageSelection(ctx: any, data: string) {
    if (ctx.from.id !== this.adminId) {
      await ctx.answerCbQuery('⛔ شما مجاز به این عملیات نیستید.');
      return;
    }

    const userId = parseInt(data.split(':')[1]);
    this.waitingSingleMessage.set(ctx.from.id, userId);

    await ctx.answerCbQuery();
    await ctx.editMessageText(
      `💬 در حال ارسال پیام به کاربر ${userId}\n\nلطفاً پیام خود را بنویسید:`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '❌ لغو', callback_data: 'cancel_single' }],
          ],
        },
      },
    );
  }

  private async handleSupportMessageView(ctx: any, data: string) {
    if (ctx.from.id !== this.adminId) {
      await ctx.answerCbQuery('⛔ شما مجاز به این عملیات نیستید.');
      return;
    }

    const messageId = parseInt(data.split(':')[1]);
    const message = this.supportMessages.get(messageId);

    if (!message) {
      await ctx.answerCbQuery('❌ پیام پیدا نشد.');
      return;
    }

    // Mark as read
    message.isRead = true;
    this.supportMessages.set(messageId, message);

    const formattedDate = message.timestamp.toLocaleDateString('fa-IR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    await ctx.answerCbQuery();
    await ctx.editMessageText(
      `📬 پیام پشتیبانی\n\n👤 نام: ${message.fullName}\n🔗 یوزرنیم: ${message.username}\n🆔 آیدی: ${message.userId}\n📅 تاریخ: ${formattedDate}\n\n💬 پیام:\n${message.message}`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '📝 پاسخ دادن',
                callback_data: `reply:${message.userId}:${messageId}`,
              },
              { text: '❌ اهمیت ندادن', callback_data: `ignore:${messageId}` },
            ],
            [{ text: '🔙 بازگشت', callback_data: 'admin:support' }],
          ],
        },
      },
    );
  }

  private async handleIgnoreSupportMessage(ctx: any, data: string) {
    if (ctx.from.id !== this.adminId) {
      await ctx.answerCbQuery('⛔ شما مجاز به این عملیات نیستید.');
      return;
    }

    const messageId = parseInt(data.split(':')[1]);
    const message = this.supportMessages.get(messageId);

    if (!message) {
      await ctx.answerCbQuery('❌ پیام پیدا نشد.');
      return;
    }

    // Delete the message
    this.supportMessages.delete(messageId);

    await ctx.answerCbQuery('✅ پیام نادیده گرفته شد و حذف شد.');
    await this.showSupportMessages(ctx);
  }

  private async handleCancelAction(ctx: any, data: string) {
    switch (data) {
      case 'cancel_reply':
        this.waitingAdminReply.delete(ctx.from.id);
        this.waitingAdminReplyMessageId.delete(ctx.from.id);
        break;
      case 'cancel_broadcast':
        this.waitingBroadcastMessage.delete(ctx.from.id);
        break;
      case 'cancel_single':
        this.waitingSingleMessage.delete(ctx.from.id);
        break;
    }

    await ctx.answerCbQuery('❌ عملیات لغو شد');
    await this.showAdminPanel(ctx);
  }

  private async showAdminPanel(ctx: any) {
    await ctx.editMessageText('🔧 پنل مدیریت', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📊 آمار کلی', callback_data: 'admin:stats' }],
          [{ text: '👥 لیست کاربران', callback_data: 'admin:users' }],
          [{ text: '📢 ارسال پیام همگانی', callback_data: 'admin:broadcast' }],
          [{ text: '💬 ارسال پیام تکی', callback_data: 'admin:single' }],
          [{ text: '📬 پیام‌های پشتیبانی', callback_data: 'admin:support' }],
        ],
      },
    });
  }

  private async handleTextMessage(ctx: any) {
    const userId = ctx.from.id;

    // Handle admin reply
    if (userId === this.adminId && this.waitingAdminReply.has(userId)) {
      await this.handleAdminReply(ctx);
      return;
    }

    // Handle broadcast message
    if (userId === this.adminId && this.waitingBroadcastMessage.has(userId)) {
      await this.handleBroadcastMessage(ctx);
      return;
    }

    // Handle single message
    if (userId === this.adminId && this.waitingSingleMessage.has(userId)) {
      await this.handleSingleMessage(ctx);
      return;
    }

    // Handle support message
    if (this.waitingSupportMessage.has(userId)) {
      await this.handleSupportMessage(ctx);
      return;
    }

    // Default: ask for language selection
    const messageId = ctx.update.message?.message_id;
    await ctx.telegram.sendMessage(
      ctx.chat.id,
      '❓ نمی‌فهمم چی گفتی. اول زبان رو انتخاب کن:',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'فارسی', callback_data: 'lang:fas' }],
            [{ text: 'انگلیسی', callback_data: 'lang:eng' }],
            [{ text: 'انگلیسی + فارسی', callback_data: 'lang:eng+fas' }],
          ],
        },
        reply_to_message_id: messageId,
      } as ExtraReplyMessage,
    );
  }

  private async handleAdminReply(ctx: any) {
    const targetUserId = this.waitingAdminReply.get(ctx.from.id);
    if (!targetUserId) return;

    const messageId = this.waitingAdminReplyMessageId.get(ctx.from.id);
    this.waitingAdminReply.delete(ctx.from.id);
    this.waitingAdminReplyMessageId.delete(ctx.from.id);

    const replyText = ctx.message.text;

    if (!replyText?.trim()) {
      await ctx.reply('⚠️ پیام نمی‌تونه خالی باشه.');
      return;
    }

    try {
      await ctx.telegram.sendMessage(
        targetUserId,
        `📬 پاسخ از مدیر:\n\n${replyText}`,
      );

      // Delete the support message if it exists
      if (messageId) {
        this.supportMessages.delete(messageId);
      }

      await ctx.reply('✅ پاسخ شما با موفقیت ارسال شد و پیام پشتیبانی حذف شد.');
    } catch (error) {
      this.logger.error('خطا در ارسال پاسخ ادمین', error);
      await ctx.reply('❌ خطا در ارسال پاسخ. ممکن است کاربر بلاک کرده باشد.');
    }
  }

  private async handleBroadcastMessage(ctx: any) {
    this.waitingBroadcastMessage.delete(ctx.from.id);
    const messageText = ctx.message.text;

    if (!messageText?.trim()) {
      await ctx.reply('⚠️ پیام نمی‌تونه خالی باشه.');
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const [userId] of this.userInfos) {
      try {
        await ctx.telegram.sendMessage(
          userId,
          `📢 پیام همگانی از مدیر:\n\n${messageText}`,
        );
        successCount++;
      } catch (error) {
        failCount++;
        this.logger.error(`خطا در ارسال پیام همگانی به کاربر ${userId}`, error);
      }
    }

    await ctx.reply(
      `✅ پیام همگانی ارسال شد:\n` +
        `✅ موفق: ${successCount}\n` +
        `❌ ناموفق: ${failCount}`,
    );
  }

  private async handleSingleMessage(ctx: any) {
    const targetUserId = this.waitingSingleMessage.get(ctx.from.id);
    if (!targetUserId) return;

    this.waitingSingleMessage.delete(ctx.from.id);
    const messageText = ctx.message.text;

    if (!messageText?.trim()) {
      await ctx.reply('⚠️ پیام نمی‌تونه خالی باشه.');
      return;
    }

    try {
      await ctx.telegram.sendMessage(
        targetUserId,
        `📬 پیام از مدیر:\n\n${messageText}`,
      );
      await ctx.reply('✅ پیام شما با موفقیت ارسال شد.');
    } catch (error) {
      this.logger.error('خطا در ارسال پیام تکی', error);
      await ctx.reply('❌ خطا در ارسال پیام. ممکن است کاربر بلاک کرده باشد.');
    }
  }

  private async handleSupportMessage(ctx: any) {
    this.waitingSupportMessage.delete(ctx.from.id);

    const fullName =
      `${ctx.from.first_name ?? ''} ${ctx.from.last_name ?? ''}`.trim();
    const username = ctx.from.username ? `@${ctx.from.username}` : 'ندارد';
    const messageText = ctx.message.text;

    // Save support message
    const messageId = Date.now();
    this.supportMessages.set(messageId, {
      userId: ctx.from.id,
      fullName,
      username,
      message: messageText,
      timestamp: new Date(),
      isRead: false,
    });

    await ctx.telegram.sendMessage(
      this.adminId,
      `📬 پیام جدید از کاربر:\n\n👤 نام: ${fullName}\n🔗 یوزرنیم: ${username}\n🆔 آیدی: ${ctx.from.id}\n\n💬 پیام:\n${messageText}`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '📝 پاسخ دادن به کاربر',
                callback_data: `reply:${ctx.from.id}`,
              },
            ],
          ],
        },
      },
    );

    const msgId = ctx.update.message?.message_id;
    await ctx.telegram.sendMessage(
      ctx.chat.id,
      '✅ پیام شما با موفقیت برای مدیر ارسال شد. ممنون از بازخوردتان!',
      {
        reply_to_message_id: msgId,
      } as ExtraReplyMessage,
    );
  }

  private async handlePhotoMessage(ctx: any) {
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
                [{ text: 'فارسی', callback_data: 'lang:fas' }],
                [{ text: 'انگلیسی', callback_data: 'lang:eng' }],
                [{ text: 'انگلیسی + فارسی', callback_data: 'lang:eng+fas' }],
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
        await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id);
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
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
