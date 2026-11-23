import { CurrentUser } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CriteriaService } from './criteria.service.js';
import {
  criteriaSchema,
  saveCriteriaSchema,
  toCriteriaResponse,
  type CriteriaResponse,
  type SaveCriteriaDto,
} from './jobs.schemas.js';

/** The signed-in user's job criteria (decision 029). Any account, for its own criteria only. */
@ApiTags('jobs')
@Can.Anyone()
@Controller('criteria')
export class CriteriaController {
  constructor(private readonly criteria: CriteriaService) {}

  @Get()
  @ApiOkResponse({ standardSchema: criteriaSchema })
  async get(@CurrentUser('id') userId: string): Promise<CriteriaResponse> {
    return toCriteriaResponse(await this.criteria.get(userId));
  }

  @Put()
  @ApiOkResponse({ standardSchema: criteriaSchema })
  @ApiBadRequestResponse({ description: 'A target salary without its currency and period, or invalid fields' })
  async save(
    @CurrentUser('id') userId: string,
    @Body({ schema: saveCriteriaSchema }) body: SaveCriteriaDto,
  ): Promise<CriteriaResponse> {
    return toCriteriaResponse(await this.criteria.save(userId, body));
  }
}
