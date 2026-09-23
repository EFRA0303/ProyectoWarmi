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
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface.js';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

@ApiTags('Autenticacion')
@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly service: AuthService) {}
  @Public()
  @UseGuards(AuthGuard('local'))
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Iniciar sesion' })
  @ApiOkResponse({
    description: 'Sesion iniciada.',
    schema: {
      example: {
        access_token: 'eyJhbGciOiJIUzI1NiIs...',
        token_type: 'Bearer',
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Credenciales invalidas o cuenta no disponible.',
  })
  login(@Body() _dto: LoginDto, @CurrentUser() user: JwtPayload) {
    return this.service.login(user);
  }
  @Public()
  @Post('forgot-password')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Solicitar recuperacion de contrasena',
    description:
      'Si existe una cuenta activa, genera un token valido durante 15 minutos y lo envia por correo. En desarrollo puede consultarse en Mailpit.',
  })
  @ApiOkResponse({
    description: 'Respuesta generica para no revelar si el correo existe.',
    schema: {
      example: {
        message:
          'Si la cuenta existe, recibiras un correo con las instrucciones.',
      },
    },
  })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.service.forgotPassword(dto.correo_acceso);
  }
  @Public()
  @Post('reset-password')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Restablecer la contrasena',
    description:
      'Usa el token original recibido por correo. Al completarse, el token queda invalidado y se elimina el bloqueo temporal de la cuenta.',
  })
  @ApiOkResponse({
    schema: {
      example: {
        message: 'Contrasena restablecida. Ya puedes iniciar sesion.',
      },
    },
  })
  @ApiBadRequestResponse({ description: 'El token es invalido o ha expirado.' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.service.resetPassword(dto.token, dto.nueva_contrasena);
  }
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Consultar la sesion actual' })
  @ApiUnauthorizedResponse({ description: 'JWT ausente, invalido o expirado.' })
  @Get('me')
  profile(@CurrentUser() user: JwtPayload) {
    return this.service.profile(user.sub);
  }
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Cambiar la contrasena de la sesion actual' })
  @ApiUnauthorizedResponse({
    description: 'JWT invalido o contrasena actual incorrecta.',
  })
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
