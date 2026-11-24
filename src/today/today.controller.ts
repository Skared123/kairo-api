import { CurrentUser } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { toTaskResponse } from '../tasks/tasks.schemas.js';
import { todaySchema, toContactFollowUpResponse, toFollowUpResponse, type TodayResponse } from './today.schemas.js';
import { TodayService } from './today.service.js';

/** The signed-in user's Today, in one answer. Any account may call it, for its own tasks, jobs and contacts only. */
@ApiTags('today')
@Can.Anyone()
@Controller('today')
export class TodayController {
  constructor(private readonly today: TodayService) {}

  @Get()
  @ApiOkResponse({ standardSchema: todaySchema })
  async get(@CurrentUser('id') userId: string): Promise<TodayResponse> {
    const [tasks, followUps, contactFollowUps] = await Promise.all([
      this.today.tasksFor(userId),
      this.today.followUpsFor(userId),
      this.today.contactFollowUpsFor(userId),
    ]);
    return {
      tasks: tasks.map(toTaskResponse),
      followUps: followUps.map(toFollowUpResponse),
      contactFollowUps: contactFollowUps.map(toContactFollowUpResponse),
    };
  }
}
