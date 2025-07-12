import {
  Controller,
  Post,
  Get,
  UploadedFile,
  UseInterceptors,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TextService } from './text.service';
import {
  ApiConsumes,
  ApiBody,
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';

@ApiTags('Text Recognition')
@Controller('text')
export class TextController {
  constructor(private readonly textService: TextService) {}

  @Get('languages')
  @ApiOperation({ summary: 'Get supported languages for OCR' })
  @ApiResponse({ status: 200, description: 'List of supported languages' })
  getSupportedLanguages() {
    return this.textService.getSupportedLanguages();
  }

  @Post('ocr')
  @UseInterceptors(FileInterceptor('image'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Extract text from image using OCR' })
  @ApiResponse({ status: 200, description: 'OCR result with extracted text' })
  @ApiResponse({
    status: 400,
    description: 'No file uploaded or invalid language',
  })
  @ApiResponse({ status: 500, description: 'OCR processing failed' })
  @ApiBody({
    description:
      'Image OCR form - Upload an image file and optionally specify language',
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
          description: 'Image file to process',
        },
        lang: {
          type: 'string',
          example: 'fas',
          description: 'Language code for OCR (eng, fas, eng+fas)',
          enum: ['eng', 'fas', 'eng+fas'],
        },
      },
      required: ['image'],
    },
  })
  async ocrImage(@UploadedFile() file: Express.Multer.File, @Body() body: any) {
    if (!file) {
      throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
    }

    const lang = body.lang || 'eng';
    const result = await this.textService.ocrImage(file.buffer, lang);

    if (result.error) {
      const status =
        result.error === 'Unsupported language'
          ? HttpStatus.BAD_REQUEST
          : HttpStatus.INTERNAL_SERVER_ERROR;
      throw new HttpException(result, status);
    }

    return result;
  }
}
