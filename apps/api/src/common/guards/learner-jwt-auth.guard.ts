import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class LearnerJwtAuthGuard extends AuthGuard('learner-jwt') {}
