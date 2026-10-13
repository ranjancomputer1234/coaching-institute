import { ArgumentsHost, Catch, HttpStatus } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

const MAPPED: Record<string, { status: HttpStatus; code: string }> = {
  P2002: { status: HttpStatus.CONFLICT, code: 'ALREADY_EXISTS' },
  P2003: { status: HttpStatus.BAD_REQUEST, code: 'INVALID_REFERENCE' },
  P2025: { status: HttpStatus.NOT_FOUND, code: 'NOT_FOUND' },
};

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter extends BaseExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const mapped = MAPPED[exception.code];
    if (!mapped) {
      return super.catch(exception, host);
    }

    const target = exception.meta?.target;
    const fields = Array.isArray(target)
      ? target.map(String)
      : typeof target === 'string'
        ? [target]
        : [];

    const messages: Record<string, string> = {
      ALREADY_EXISTS: fields.length
        ? `A record with this ${fields.join(', ')} already exists`
        : 'A record with these values already exists',
      INVALID_REFERENCE: 'A referenced record does not exist',
      NOT_FOUND: 'Record not found',
    };

    host
      .switchToHttp()
      .getResponse<Response>()
      .status(mapped.status)
      .json({
        code: mapped.code,
        message: messages[mapped.code],
        fieldErrors: Object.fromEntries(fields.map((f) => [f, 'taken'])),
      });
  }
}
