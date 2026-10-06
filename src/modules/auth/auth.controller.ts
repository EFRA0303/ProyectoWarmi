import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface.js';
import { requestMetadata } from '../../common/interfaces/request-metadata.interface.js';
import { UpdatePersonaDto } from '../personas/dto/update-persona.dto.js';
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
        expires_in: 3600,
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Credenciales invalidas o cuenta no disponible.',
  })
  login(@Body() _dto: LoginDto, @CurrentUser() user: JwtPayload) {
    return this.service.login(user);
  }
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Cerrar la sesion actual' })
  @Post('logout')
  @HttpCode(200)
  logout(@CurrentUser() user: JwtPayload) {
    return this.service.logout(user);
  }
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Registrar actividad de la sesion actual',
    description:
      'Actualiza la presencia del usuario. Se considera en linea durante los dos minutos posteriores a su ultima actividad.',
  })
  @Post('activity')
  @HttpCode(200)
  activity(@CurrentUser() user: JwtPayload) {
    return this.service.recordActivity(user.sub);
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
  resetPassword(@Body() dto: ResetPasswordDto, @Req() request: Request) {
    return this.service.resetPassword(
      dto.token,
      dto.nueva_contrasena,
      requestMetadata(request),
    );
  }
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Consultar la sesion actual' })
  @ApiUnauthorizedResponse({ description: 'JWT ausente, invalido o expirado.' })
  @Get('me')
  profile(@CurrentUser() user: JwtPayload) {
    return this.service.profile(user.sub);
  }
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Actualizar los datos personales de la sesion actual',
    description:
      'Solo permite modificar la persona vinculada al usuario autenticado.',
  })
  @Patch('me/personal')
  updateOwnProfile(
    @Body() dto: UpdatePersonaDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updateOwnProfile(user.sub, dto);
  }
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Actualizar la foto de perfil de la sesión actual' })
  @Post('me/foto-perfil')
  @UseInterceptors(FileInterceptor('foto', { limits: { fileSize: 5 * 1024 * 1024 } }))
  updateOwnProfilePhoto(
    @UploadedFile() file: { buffer: Buffer; size: number } | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updateOwnProfilePhoto(user.sub, file);
  }
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Cambiar la contrasena de la sesion actual' })
  @ApiUnauthorizedResponse({
    description: 'JWT invalido o contrasena actual incorrecta.',
  })
  @Post('change-password')
  @HttpCode(200)
  change(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: JwtPayload,
    @Req() request: Request,
  ) {
    return this.service.changePassword(
      user.sub,
      dto.contrasena_actual,
      dto.nueva_contrasena,
      requestMetadata(request),
    );
  }
}
