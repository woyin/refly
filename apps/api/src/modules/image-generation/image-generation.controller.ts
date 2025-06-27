import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { ImageGenerationService } from './image-generation.service';
import { ImageGenerationTestRequest, GenerationResponse } from './image-generation.dto';

@ApiTags('Image Generation')
@Controller('api/v1/image-generation')
export class ImageGenerationController {
  constructor(private readonly imageGenerationService: ImageGenerationService) {}

  @Post('generate')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Generate image using AI providers' })
  @ApiResponse({
    status: 200,
    description: 'Image generated successfully',
    type: Object, // Using Object type since we're using interfaces
  })
  async generateImage(@Body() dto: ImageGenerationTestRequest): Promise<GenerationResponse> {
    return this.imageGenerationService.generateImage(dto);
  }

  @Post('test')
  @ApiOperation({ summary: 'Test image generation (no auth required)' })
  @ApiResponse({
    status: 200,
    description: 'Test image generation',
    type: Object, // Using Object type since we're using interfaces
  })
  async testGenerateImage(@Body() dto: ImageGenerationTestRequest): Promise<GenerationResponse> {
    // For testing purposes, we'll use a mock API key
    return this.imageGenerationService.generateImage({
      ...dto,
      apiKey: dto.apiKey || 'test-key',
    });
  }
}
