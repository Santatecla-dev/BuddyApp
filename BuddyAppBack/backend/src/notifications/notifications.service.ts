import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, IsNull, Repository } from 'typeorm';
import { Notification, NotificationType } from './notification.entity';

type CreateNotificationInput = {
  recipientId: number;
  type: NotificationType;
  title: string;
  body: string;
  actorId?: number | null;
  entityType?: string | null;
  entityId?: string | null;
  dedupeKey?: string | null;
};

@Injectable()
export class NotificationsService {
  constructor(@InjectRepository(Notification) private readonly notificationRepo: Repository<Notification>) {}

  async create(input: CreateNotificationInput) {
    if (input.dedupeKey) {
      const existing = await this.notificationRepo.findOne({ where: { recipientId: input.recipientId, dedupeKey: input.dedupeKey } });
      if (existing) return existing;
    }
    return this.notificationRepo.save(this.notificationRepo.create({
      ...input,
      actorId: input.actorId ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      dedupeKey: input.dedupeKey ?? null,
      readAt: null,
    }));
  }

  async list(userId: number, unreadOnly = false, cursor = 0, limit = 20) {
    const where: FindOptionsWhere<Notification> = { recipientId: userId };
    if (unreadOnly) where.readAt = IsNull();
    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
    const offset = Math.max(Number(cursor) || 0, 0);
    const [items, total] = await this.notificationRepo.findAndCount({ where, order: { createdAt: 'DESC' }, skip: offset, take: safeLimit });
    const unreadCount = await this.notificationRepo.count({ where: { recipientId: userId, readAt: IsNull() } });
    return {
      items: items.map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        body: item.body,
        createdAt: item.createdAt,
        readAt: item.readAt,
        entityType: item.entityType,
        entityId: item.entityId,
        actor: item.actor ? { id: item.actor.id, name: item.actor.name } : null,
      })),
      unreadCount,
      nextCursor: offset + items.length < total ? String(offset + items.length) : null,
      hasMore: offset + items.length < total,
    };
  }

  async unreadCount(userId: number) {
    return { unreadCount: await this.notificationRepo.count({ where: { recipientId: userId, readAt: IsNull() } }) };
  }

  async markRead(id: number, userId: number) {
    const notification = await this.notificationRepo.findOne({ where: { id, recipientId: userId } });
    if (!notification) throw new NotFoundException('Notification not found');
    if (!notification.readAt) {
      notification.readAt = new Date();
      await this.notificationRepo.save(notification);
    }
    return { ok: true };
  }

  async markAllRead(userId: number) {
    await this.notificationRepo.update({ recipientId: userId, readAt: IsNull() }, { readAt: new Date() });
    return { ok: true };
  }
}
