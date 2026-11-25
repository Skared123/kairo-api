import { CurrentUser } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { toTaskResponse } from '../tasks/tasks.schemas.js';
import {
  todaySchema,
  toContactFollowUpResponse,
  toFocusResponse,
  toFollowUpResponse,
  type TodayResponse,
} from './today.schemas.js';
import { TodayService } from './today.service.js';

/**
 * The signed-in user's Today, in one answer. Any account may call it, for its own tasks, jobs, contacts and learning
 * only.
 */
@ApiTags('today')
@Can.Anyone()
@Controller('today')
export class TodayController {
  constructor(private readonly today: TodayService) {}

  @Get()
  @ApiOkResponse({ standardSchema: todaySchema })
  async get(@CurrentUser('id') userId: string): Promise<TodayResponse> {
    const [tasks, followUps, contactFollowUps, focus] = await Promise.all([
      this.today.tasksFor(userId),
      this.today.followUpsFor(userId),
      this.today.contactFollowUpsFor(userId),
      this.today.focusFor(userId),
    ]);
    return {
      tasks: tasks.map(toTaskResponse),
      followUps: followUps.map(toFollowUpResponse),
      contactFollowUps: contactFollowUps.map(toContactFollowUpResponse),
      focus: focus && toFocusResponse(focus),
    };
  }
}
