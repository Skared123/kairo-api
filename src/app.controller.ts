import { Public } from '@nestjs/authentication';
import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // Placeholder from the Nest CLI, kept public until it is replaced.
  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
