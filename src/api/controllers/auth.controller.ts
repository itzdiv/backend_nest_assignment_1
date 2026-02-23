import { Controller, Post, Body, UsePipes } from '@nestjs/common';

import { AuthService } from '../services/auth.service';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';

import {
  RegisterSchema,
  LoginSchema,
} from '../../zod/auth.zod';
import type {
  RegisterDto,
  LoginDto,
} from '../../zod/auth.zod';

@Controller('v1/auth')
export class AuthController {

  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @UsePipes(new ZodValidationPipe(RegisterSchema))
  async register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  @Post('login')
  @UsePipes(new ZodValidationPipe(LoginSchema))
  async login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }
}
