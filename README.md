# 📸 OCR Text Recognition API

<div align="center">

![OCR Banner](https://img.shields.io/badge/OCR-Text%20Recognition-blue?style=for-the-badge&logo=text&logoColor=white)
![Persian Support](https://img.shields.io/badge/Persian-Supported-green?style=for-the-badge&logo=language&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-Framework-red?style=for-the-badge&logo=nestjs&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Database-green?style=for-the-badge&logo=mongodb&logoColor=white)

**🌟 Advanced OCR Service with Persian Language Support 🌟**

</div>

---

## 🇮🇷 فارسی | Persian

### 🔥 ویژگی‌های کلیدی

- 🚀 **تشخیص متن سریع** - استخراج متن از تصاویر با سرعت بالا
- 🌍 **پشتیبانی چندزبانه** - انگلیسی، فارسی و ترکیبی
- 🎯 **دقت بالا** - با استفاده از Tesseract.js
- 💾 **ذخیره در دیتابیس** - MongoDB برای نگهداری نتایج
- 📊 **API مستندسازی** - Swagger UI برای تست آسان
- 🔧 **پیکربندی آسان** - Environment variables
- 📈 **گزارش عملکرد** - زمان پردازش و درصد اطمینان

### 🛠️ نصب و راه‌اندازی

<div align="left">

```bash
# کلون کردن پروژه
git clone <your-repo-url>
cd Snap2Text

# نصب وابستگی‌ها
npm install

# تنظیم متغیرهای محیطی
cp .env.example .env
# .env را ویرایش کنید
```

</div>

### ⚙️ پیکربندی

فایل `.env` را ایجاد کنید:

```env
MONGO_URI=mongodb://localhost:27017/
PORT=3000
```

### 🚀 اجرای پروژه

<div align="left">

```bash
# محیط توسعه
npm run start:dev

# محیط تولید
npm run build
npm run start:prod
```

</div>

### 📡 API Endpoints

#### 1. تشخیص متن از تصویر

```http
POST /text/ocr
Content-Type: multipart/form-data

Parameters:
- image: فایل تصویر (اجباری)
- lang: زبان (اختیاری) - "eng" | "fas" | "eng+fas"
```

#### 2. دریافت زبان‌های پشتیبانی‌شده

```http
GET /text/languages
```

### 💡 مثال‌های استفاده

<div align="left">

```bash
# تشخیص متن فارسی
curl -X POST http://localhost:3000/text/ocr \
  -F "image=@sample.jpg" \
  -F "lang=fas"

# تشخیص متن انگلیسی
curl -X POST http://localhost:3000/text/ocr \
  -F "image=@sample.jpg" \
  -F "lang=eng"
```

</div>

### 📊 نمونه پاسخ

```json
{
  "text": "خرید بهترین خدمات پزشکی\nخدمات با کیفیت پزشکی",
  "cleaned": "خرید بهترین خدمات پزشکی خدمات با کیفیت پزشکی",
  "confidence": 88,
  "durationMs": 309,
  "lang": "fas",
  "languageName": "Persian (Farsi)"
}
```

---

## 🇺🇸 English

### 🔥 Key Features

- 🚀 **Lightning Fast OCR** - Extract text from images with high speed
- 🌍 **Multi-language Support** - English, Persian, and mixed
- 🎯 **High Accuracy** - Powered by Tesseract.js
- 💾 **Database Storage** - MongoDB for result persistence
- 📊 **API Documentation** - Swagger UI for easy testing
- 🔧 **Easy Configuration** - Environment variables
- 📈 **Performance Metrics** - Processing time and confidence scores

### 🛠️ Installation & Setup

```bash
# Clone the repository
git clone <your-repo-url>
cd learning-test

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env file
```

### ⚙️ Configuration

Create `.env` file:

```env
MONGO_URI=mongodb://localhost:27017
PORT=3000
```

### 🚀 Running the Application

```bash
# Development mode
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

### 📡 API Endpoints

#### 1. OCR Text Recognition

```http
POST /text/ocr
Content-Type: multipart/form-data

Parameters:
- image: Image file (required)
- lang: Language (optional) - "eng" | "fas" | "eng+fas"
```

#### 2. Get Supported Languages

```http
GET /text/languages
```

### 💡 Usage Examples

```bash
# Persian text recognition
curl -X POST http://localhost:3000/text/ocr \
  -F "image=@sample.jpg" \
  -F "lang=fas"

# English text recognition
curl -X POST http://localhost:3000/text/ocr \
  -F "image=@sample.jpg" \
  -F "lang=eng"
```

### 📊 Sample Response

```json
{
  "text": "Best medical services\nHigh quality medical services",
  "cleaned": "Best medical services High quality medical services",
  "confidence": 92,
  "durationMs": 245,
  "lang": "eng",
  "languageName": "English"
}
```

---

## 🏗️ Architecture | معماری

```
├── src/
│   ├── app.module.ts           # Main application module
│   ├── main.ts                 # Application entry point
│   ├── text/                   # OCR module
│   │   ├── text.controller.ts  # REST API endpoints
│   │   ├── text.service.ts     # OCR business logic
│   │   └── text.module.ts      # Text module configuration
│   └── database/               # Database models
│       └── text.model.ts       # MongoDB schema
├── eng.traineddata             # English language model
├── fas.traineddata             # Persian language model
└── package.json                # Dependencies
```

## 🔧 Tech Stack | فناوری‌ها

<div align="center">

| Technology       | Version | Purpose           |
| ---------------- | ------- | ----------------- |
| **NestJS**       | ^11.0.1 | Backend Framework |
| **Tesseract.js** | ^6.0.1  | OCR Engine        |
| **MongoDB**      | ^8.16.1 | Database          |
| **Swagger**      | ^11.2.0 | API Documentation |
| **TypeScript**   | ^5.7.3  | Language          |

</div>

## 🌟 Supported Languages | زبان‌های پشتیبانی‌شده

| Language        | Code      | Support |
| --------------- | --------- | ------- |
| English         | `eng`     | ✅ Full |
| Persian (Farsi) | `fas`     | ✅ Full |
| Mixed           | `eng+fas` | ✅ Full |

## 📚 API Documentation | مستندات API

After running the application, visit:
بعد از اجرای اپلیکیشن، این آدرس را باز کنید:

```
http://localhost:3000/swagger
```

## 🔍 Requirements | پیش‌نیازها

- **Node.js** >= 18.0.0
- **npm** >= 8.0.0
- **MongoDB** >= 4.4.0

## 🚀 Quick Start | شروع سریع

<div align="left">

```bash
# 1. Install MongoDB
# نصب MongoDB

# 2. Start MongoDB
mongod

# 3. Clone & Install
git clone <repo-url>
cd Snap2Text
npm install

# 4. Configure
echo "MONGO_URI=mongodb://localhost:27017/" > .env

# 5. Run
npm run start:dev

# 6. Test
curl -X POST http://localhost:3000/text/ocr \
  -F "image=@your-image.jpg" \
  -F "lang=fas"
```

</div>

## 📝 License | مجوز

This project is licensed under the MIT License.
<br>
این پروژه تحت مجوز MIT منتشر شده است.

---

<div align="center">

**Made with ❤️ by [Mehrad Shadmand]**

**ساخته شده با ❤️ توسط [مهراد شادمند]**

</div>

## 🤝 Contributing | مشارکت

Contributions are welcome! Please feel free to submit a Pull Request.

<br>
مشارکت‌ها استقبال می‌شود! لطفاً Pull Request ارسال کنید.

## 📞 Support | پشتیبانی

If you have any questions, please open an issue.
<br>
اگر سوالی دارید، لطفاً یک Issue باز کنید.

---

### 🌟 Star this repo if you find it useful!

### اگر این پروژه برایتان مفید بود، ستاره بدهید! 🌟
