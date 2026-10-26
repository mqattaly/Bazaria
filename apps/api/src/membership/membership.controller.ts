import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { MembershipService } from './membership.service';
import {
  AddMembershipDto,
  UpdateMembershipDto,
} from '../company/dto/company.dto';
import { RequirePermission, SubscriptionExempt } from '../common/decorators';

@Controller('memberships')
export class MembershipController {
  constructor(private readonly memberships: MembershipService) {}

  @Get()
  @RequirePermission('membership.view')
  list() {
    return this.memberships.list();
  }

  @Post()
  @RequirePermission('membership.manage')
  add(@Body() body: AddMembershipDto) {
    return this.memberships.add(body);
  }

  @Patch(':membershipId')
  @RequirePermission('membership.manage')
  @SubscriptionExempt()
  update(
    @Param('membershipId') membershipId: string,
    @Body() body: UpdateMembershipDto,
  ) {
    return this.memberships.update(membershipId, body);
  }

  @Post(':membershipId/password-reset')
  @HttpCode(200)
  @RequirePermission('membership.manage')
  @SubscriptionExempt()
  resetPassword(@Param('membershipId') membershipId: string) {
    return this.memberships.issuePasswordReset(membershipId);
  }
}
