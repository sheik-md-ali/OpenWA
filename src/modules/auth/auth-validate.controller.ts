import { Controller, Post, Headers, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthValidateController {
  constructor(private readonly authService: AuthService) {}

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate an API key' })
  @ApiHeader({ name: 'X-API-Key', description: 'API key to validate' })
  @ApiResponse({ status: 200, description: 'API key is valid' })
  @ApiResponse({ status: 401, description: 'Invalid or missing API key' })
  async validate(@Headers('x-api-key') apiKey?: string): Promise<{ valid: boolean; role?: string }> {
    if (!apiKey) {
      return { valid: false };
    }

    try {
      const keyEntity = await this.authService.validateApiKey(apiKey);
      if (keyEntity && keyEntity.isActive) {
        return { valid: true, role: keyEntity.role };
      }
      return { valid: false };
    } catch {
      return { valid: false };
    }
  }
}
