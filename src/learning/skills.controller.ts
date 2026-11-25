import { CurrentUser } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  renameSkillSchema,
  skillSchema,
  toSkillResponse,
  type RenameSkillDto,
  type SkillResponse,
} from './skills.schemas.js';
import { SkillsService } from './skills.service.js';

/** The signed-in user's skills (decision 040). Another user's skill answers 404, never 403. */
@ApiTags('learning')
@Can.Anyone()
@Controller('skills')
export class SkillsController {
  constructor(private readonly skills: SkillsService) {}

  @Get()
  @ApiOkResponse({ standardSchema: skillSchema, isArray: true })
  async list(@CurrentUser('id') userId: string): Promise<SkillResponse[]> {
    return (await this.skills.list(userId)).map(({ skill, itemCount }) => toSkillResponse(skill, itemCount));
  }

  @Patch(':id')
  @ApiOkResponse({ standardSchema: skillSchema })
  @ApiNotFoundResponse({ description: 'Skill not found' })
  @ApiConflictResponse({ description: "Another of the user's skills has that name (skill_exists)" })
  async rename(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body({ schema: renameSkillSchema }) { name }: RenameSkillDto,
  ): Promise<SkillResponse> {
    const { skill, itemCount } = await this.skills.rename(userId, id, name);
    return toSkillResponse(skill, itemCount);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Skill not found' })
  async remove(@CurrentUser('id') userId: string, @Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.skills.remove(userId, id);
  }
}
