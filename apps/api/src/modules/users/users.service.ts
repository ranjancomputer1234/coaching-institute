import { Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import type { Permission } from '../../common/permissions/permissions';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findByEmail(email: string) {
    return this.prisma.adminUser.findUnique({
      where: { email },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });
  }

  findById(id: string) {
    return this.prisma.adminUser.findUnique({
      where: { id },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });
  }

  toAuthUser(user: NonNullable<Awaited<ReturnType<UsersService['findById']>>>) {
    const roles = user.roles.map((r) => r.role.key);
    const permissions = Array.from(
      new Set(
        user.roles.flatMap((r) =>
          r.role.permissions.map((p) => p.permission.key as Permission),
        ),
      ),
    );
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      roles,
      permissions,
    };
  }

  async getAuthProfile(id: string) {
    const user = await this.findById(id);
    if (!user || !user.isActive) {
      throw new NotFoundException('Admin user not found');
    }
    return this.toAuthUser(user);
  }

  listStaff() {
    return this.prisma.adminUser.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        createdAt: true,
        roles: { select: { role: { select: { key: true, name: true } } } },
      },
    });
  }

  listRoles() {
    return this.prisma.role.findMany({
      orderBy: { key: 'asc' },
      select: { id: true, key: true, name: true, description: true },
    });
  }

  async createStaff(
    input: { email: string; name: string; password: string; roleKey: string },
    actor: { userId: string; email?: string },
  ) {
    const role = await this.prisma.role.findUnique({
      where: { key: input.roleKey },
    });
    if (!role) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Role ${input.roleKey} not found`,
        fieldErrors: {},
      });
    }
    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await this.prisma.adminUser.create({
      data: {
        email: input.email.toLowerCase(),
        name: input.name,
        passwordHash,
        roles: { create: { roleId: role.id } },
      },
      select: { id: true, email: true, name: true, isActive: true },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'admin.create',
      resourceType: 'AdminUser',
      resourceId: user.id,
      after: { email: user.email, roleKey: input.roleKey },
    });
    return user;
  }

  async updateStaff(
    id: string,
    input: { isActive?: boolean; roleKey?: string },
    actor: { userId: string; email?: string },
  ) {
    const existing = await this.prisma.adminUser.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Staff user not found',
        fieldErrors: {},
      });
    }
    if (input.roleKey) {
      const role = await this.prisma.role.findUnique({
        where: { key: input.roleKey },
      });
      if (!role) {
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: `Role ${input.roleKey} not found`,
          fieldErrors: {},
        });
      }
      await this.prisma.adminRoleAssignment.deleteMany({ where: { adminId: id } });
      await this.prisma.adminRoleAssignment.create({
        data: { adminId: id, roleId: role.id },
      });
    }
    const user = await this.prisma.adminUser.update({
      where: { id },
      data: { isActive: input.isActive },
      select: { id: true, email: true, name: true, isActive: true },
    });
    await this.audit.write({
      actorId: actor.userId,
      actorDisplay: actor.email,
      action: 'admin.update',
      resourceType: 'AdminUser',
      resourceId: id,
      after: input,
    });
    return user;
  }
}
