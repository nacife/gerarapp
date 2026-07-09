import { Controller, Get } from '@nestjs/common';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators';
import { HomeService } from './home.service';

/** Home do criador (RF-08). */
@Controller('me')
export class HomeController {
  constructor(private readonly home: HomeService) {}

  @Get('home')
  getHome(@CurrentUser() user: AuthenticatedUser) {
    return this.home.getHome(user.id);
  }
}
