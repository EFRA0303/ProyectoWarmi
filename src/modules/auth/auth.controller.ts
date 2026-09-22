import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface.js';

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly service: AuthService) {}
  @Public()
  @UseGuards(AuthGuard('local'))
  @Post('login')
  @HttpCode(200)
  login(@Body() _dto: LoginDto, @CurrentUser() user: JwtPayload) {
    return this.service.login(user);
  }
  @Get('me')
  profile(@CurrentUser() user: JwtPayload) {
    return this.service.profile(user.sub);
  }
  @Post('change-password')
  @HttpCode(200)
  change(@Body() dto: ChangePasswordDto, @CurrentUser() user: JwtPayload) {
    return this.service.changePassword(
      user.sub,
      dto.contrasena_actual,
      dto.nueva_contrasena,
    );
  }
}
