import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Dive } from '../dives/dive.entity';
import { DiveBuddy } from '../dives/dive-buddy.entity';
import { DiveSighting } from '../dives/dive-sighting.entity';
import { getSpecies } from '../dives/pokedex.catalog';
import { User } from '../users/user.entity';
import { FeedComment } from './feed-comment.entity';
import { FeedReaction } from './feed-reaction.entity';
import { CreateFeedCommentDto } from './dto/create-feed-comment.dto';
import { AchievementsService } from '../achievements/achievements.service';
import { NotificationsService } from '../notifications/notifications.service';

type FeedType = 'all' | 'dives' | 'wildlife' | 'achievements' | 'mine';
type FeedItem = {
  id: string;
  type: 'dive' | 'sighting' | 'achievement';
  createdAt: Date;
  actor: { id: number; name: string };
  dive?: { id: number; location: string; country: string; date: Date; maxDepth: number; duration: number };
  species?: { key: string; name: string; category: string; imageUrl: string };
  achievement?: { id: string; title: string; description: string; icon: string; tier: string; category: string; evidence: string[] };
  commentsPreview: { id: number; body: string; createdAt: Date; user: { id: number; name: string } }[];
  reactionsCount: number;
  commentsCount: number;
  reactedByMe: boolean;
  canOpenDive?: boolean;
};

@Injectable()
export class ActivityFeedService {
  constructor(
    @InjectRepository(Dive) private readonly diveRepo: Repository<Dive>,
    @InjectRepository(DiveBuddy) private readonly buddyRepo: Repository<DiveBuddy>,
    @InjectRepository(DiveSighting) private readonly sightingRepo: Repository<DiveSighting>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(FeedComment) private readonly commentRepo: Repository<FeedComment>,
    @InjectRepository(FeedReaction) private readonly reactionRepo: Repository<FeedReaction>,
    private readonly achievementsService: AchievementsService,
    @Optional() private readonly notificationsService?: NotificationsService,
  ) {}

  private async getActivityRecipient(activityId: string) {
    const achievementMatch = /^achievement-(\d+)-(.+)$/.exec(activityId);
    if (achievementMatch) return Number(achievementMatch[1]);
    const match = /^(dive|sighting)-(\d+)(?:-(\d+))?$/.exec(activityId);
    if (!match) return null;
    if (match[1] === 'sighting') {
      if (match[3]) return Number(match[3]);
      const sighting = await this.sightingRepo.findOne({ where: { id: Number(match[2]) } });
      return sighting?.createdByUserId || null;
    }
    const buddies = await this.buddyRepo.find({ where: { diveId: Number(match[2]) }, order: { joinedAt: 'ASC' } });
    return buddies[0]?.userId || null;
  }

  private async syncFeedNotifications(userId: number, feedItems: FeedItem[]) {
    const notificationsService = this.notificationsService;
    if (!notificationsService) return;
    await Promise.all(feedItems.filter((item) => item.actor.id !== userId).map((item) => {
      const title = item.type === 'dive'
        ? 'New dive in your network'
        : item.type === 'sighting'
          ? 'New marine life sighting'
          : 'New achievement';
      const body = item.type === 'dive'
        ? `${item.actor.name} logged a dive at ${item.dive?.location || 'a dive site'}.`
        : item.type === 'sighting'
          ? `${item.actor.name} spotted ${item.species?.name || 'a new species'}.`
          : `${item.actor.name} unlocked ${item.achievement?.title || 'an achievement'}.`;
      return notificationsService.create({
        recipientId: userId,
        actorId: item.actor.id,
        type: item.type,
        title,
        body,
        entityType: 'activity',
        entityId: item.id,
        dedupeKey: `feed:${userId}:${item.id}`,
      }).catch(() => undefined);
    }));
  }

  private async getNetworkUserIds(userId: number) {
    const memberships = await this.buddyRepo.find({ where: { userId } });
    const ownDiveIds = memberships.map((membership) => membership.diveId);
    if (!ownDiveIds.length) return [userId];
    const sharedBuddies = await this.buddyRepo.find({ where: { diveId: In(ownDiveIds) } });
    const buddyUserIds = [...new Set(sharedBuddies.map((membership) => membership.userId))];
    return [...new Set([userId, ...buddyUserIds])];
  }

  private async getVisibleDiveIds(userId: number) {
    const networkUserIds = await this.getNetworkUserIds(userId);
    const networkMemberships = await this.buddyRepo.find({ where: { userId: In(networkUserIds) } });
    return [...new Set(networkMemberships.map((membership) => membership.diveId))];
  }

  async buddies(userId: number) {
    const networkUserIds = (await this.getNetworkUserIds(userId)).filter((networkUserId) => networkUserId !== userId);
    if (!networkUserIds.length) return [];
    const users = await this.userRepo.find({ where: { id: In(networkUserIds) } });
    return users.map((user) => ({ id: user.id, name: user.name })).sort((a, b) => a.name.localeCompare(b.name));
  }

  private async ensureActivityAccess(activityId: string, userId: number) {
    const match = /^(dive|sighting)-(\d+)(?:-(\d+))?$/.exec(activityId);
    const achievementMatch = /^achievement-(\d+)-(.+)$/.exec(activityId);
    if (achievementMatch) {
      const networkUserIds = await this.getNetworkUserIds(userId);
      if (!networkUserIds.includes(Number(achievementMatch[1]))) throw new ForbiddenException('You cannot interact with this activity');
      return 0;
    }
    if (!match) throw new BadRequestException('Invalid activity');
    if (match[1] === 'dive' && match[3]) throw new BadRequestException('Invalid activity');
    let diveId = Number(match[2]);
    if (match[1] === 'sighting') {
      const sighting = await this.sightingRepo.findOne({ where: { id: diveId } });
      if (!sighting) throw new NotFoundException('Activity not found');
      diveId = sighting.diveId;
      if (match[3]) {
        const actorId = Number(match[3]);
        const network = await this.getNetworkUserIds(userId);
        const membership = await this.buddyRepo.findOne({ where: { diveId, userId: actorId } });
        if (!network.includes(actorId) || !membership || actorId === sighting.createdByUserId) {
          throw new ForbiddenException('You cannot interact with this activity');
        }
      }
    }
    const visibleDiveIds = await this.getVisibleDiveIds(userId);
    if (!visibleDiveIds.includes(diveId)) throw new ForbiddenException('You cannot interact with this activity');
    return diveId;
  }

  async feed(userId: number, type: FeedType = 'all', cursor = 0, limit = 10, mineType: Exclude<FeedType, 'mine'> = 'all', buddyId?: number) {
    const isMine = type === 'mine';
    const activityType = isMine ? mineType : type;
    const networkUserIds = isMine ? [userId] : await this.getNetworkUserIds(userId);
    const selectedBuddyId = buddyId && networkUserIds.includes(buddyId) && buddyId !== userId ? buddyId : undefined;
    const ownMemberships = await this.buddyRepo.find({ where: { userId } });
    const ownDiveIds = ownMemberships.map((membership) => membership.diveId);
    const diveIds = isMine ? [...new Set(ownDiveIds)] : await this.getVisibleDiveIds(userId);
    let dives: Dive[] = [];
    let buddies: DiveBuddy[] = [];
    let sightings: DiveSighting[] = [];
    if (diveIds.length) {
      [dives, buddies, sightings] = await Promise.all([
        this.diveRepo.find({ where: { id: In(diveIds) } }),
        this.buddyRepo.find({ where: { diveId: In(diveIds) } }),
        this.sightingRepo.find({ where: { diveId: In(diveIds) } }),
      ]);
    }
    // Include the author stored on each sighting as well as current dive members.
    // This keeps an event visible when an older sighting was created before a
    // membership row was changed, while access is still restricted by dive membership.
    const actorIds = [...new Set([
      ...buddies.map((buddy) => buddy.userId),
      ...sightings.map((sighting) => sighting.createdByUserId),
    ])];
    const users = actorIds.length ? await this.userRepo.find({ where: { id: In(actorIds) } }) : [];
    const userMap = new Map(users.map((user) => [user.id, user]));
    const diveMap = new Map(dives.map((dive) => [dive.id, dive]));
    const buddiesByDive = new Map<number, DiveBuddy[]>();
    buddies.forEach((buddy) => {
      const existing = buddiesByDive.get(buddy.diveId) || [];
      existing.push(buddy);
      buddiesByDive.set(buddy.diveId, existing);
    });
    const items: FeedItem[] = [];
    if (activityType === 'all' || activityType === 'dives') {
      dives.forEach((dive) => {
        const actorBuddy = (buddiesByDive.get(dive.id) || []).sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime())[0];
        const actor = isMine ? userMap.get(userId) : userMap.get(actorBuddy?.userId || userId);
        const belongsInFeed = isMine ? actor?.id === userId : actor?.id !== userId;
        if (actor && belongsInFeed && (!selectedBuddyId || actor.id === selectedBuddyId)) items.push({ id: `dive-${dive.id}`, type: 'dive', createdAt: dive.createdAt, actor: { id: actor.id, name: actor.name }, dive: { id: dive.id, location: dive.location, country: dive.country, date: dive.date, maxDepth: dive.maxDepth, duration: dive.duration }, reactionsCount: 0, commentsCount: 0, reactedByMe: false, commentsPreview: [] });
      });
    }
    if (activityType === 'all' || activityType === 'wildlife') {
      sightings.forEach((sighting) => {
        const dive = diveMap.get(sighting.diveId);
        const species = getSpecies(sighting.speciesKey);
        if (!dive || !species) return;
        // Sightings belong to every accepted dive participant, as in the Pokedex.
        // Keep the author's legacy event ID so existing conversations survive.
        const participants = new Map((buddiesByDive.get(dive.id) || []).map((buddy) => [buddy.userId, buddy]));
        participants.forEach((membership, actorId) => {
          const actor = userMap.get(actorId);
          if (!actor || !networkUserIds.includes(actorId) || (isMine ? actorId !== userId : actorId === userId) || (selectedBuddyId && actorId !== selectedBuddyId)) return;
          const isAuthor = actorId === sighting.createdByUserId;
          items.push({ id: isAuthor ? `sighting-${sighting.id}` : `sighting-${sighting.id}-${actorId}`, type: 'sighting', createdAt: new Date(Math.max(sighting.createdAt.getTime(), membership.joinedAt.getTime())), actor: { id: actor.id, name: actor.name }, dive: { id: dive.id, location: dive.location, country: dive.country, date: dive.date, maxDepth: dive.maxDepth, duration: dive.duration }, species, reactionsCount: 0, commentsCount: 0, reactedByMe: false, commentsPreview: [] });
        });
      });
    }
    if (activityType === 'all' || activityType === 'achievements') {
      const achievementUserIds = isMine
        ? [userId]
        : networkUserIds.filter((networkUserId) => networkUserId !== userId && (!selectedBuddyId || networkUserId === selectedBuddyId));
      const buddyUsers = achievementUserIds.length
        ? await this.userRepo.find({ where: { id: In(achievementUserIds) } })
        : [];
      const buddyUserMap = new Map(buddyUsers.map((user) => [user.id, user]));
      const buddyAchievements = await Promise.all(achievementUserIds.map(async (networkUserId) => ({ userId: networkUserId, items: await this.achievementsService.list(networkUserId) })));
      buddyAchievements.forEach(({ userId: buddyUserId, items: achievements }) => {
        const actor = buddyUserMap.get(buddyUserId);
        if (!actor) return;
        achievements.filter((achievement) => achievement.unlocked && achievement.unlockedAt).forEach((achievement) => items.push({
          id: `achievement-${buddyUserId}-${achievement.id}`,
          type: 'achievement',
          createdAt: new Date(achievement.unlockedAt as string),
          actor: { id: actor.id, name: actor.name },
          achievement: {
            id: achievement.id,
            title: achievement.title,
            description: achievement.description,
            icon: achievement.icon,
            tier: achievement.tier,
            category: achievement.category,
            evidence: achievement.evidence.slice(0, 3).map((evidence) => evidence.label),
          },
          reactionsCount: 0,
          commentsCount: 0,
          reactedByMe: false,
          commentsPreview: [],
        }));
      });
    }
    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id));
    const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 30);
    const offset = Math.max(Number(cursor) || 0, 0);
    const page = items.slice(offset, offset + safeLimit);
    page.forEach((item) => { if (item.dive) item.canOpenDive = ownDiveIds.includes(item.dive.id); });
    const pageIds = page.map((item) => item.id);
    const [reactions, comments] = pageIds.length ? await Promise.all([
      this.reactionRepo.find({ where: { activityId: In(pageIds) } }),
      this.commentRepo.find({ where: { activityId: In(pageIds) } }),
    ]) : [[], []];
    const reactionCounts = new Map<string, number>();
    reactions.forEach((reaction) => reactionCounts.set(reaction.activityId, (reactionCounts.get(reaction.activityId) || 0) + 1));
    const commentCounts = new Map<string, number>();
    comments.forEach((comment) => commentCounts.set(comment.activityId, (commentCounts.get(comment.activityId) || 0) + 1));
    const commentPreviews = new Map<string, FeedItem['commentsPreview']>();
    comments
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .forEach((comment) => {
        const preview = commentPreviews.get(comment.activityId) || [];
        if (preview.length < 3) preview.push({ id: comment.id, body: comment.body, createdAt: comment.createdAt, user: { id: comment.user?.id || comment.userId, name: comment.user?.name || 'Buddy' } });
        commentPreviews.set(comment.activityId, preview);
      });
    const reacted = new Set(reactions.filter((reaction) => reaction.userId === userId).map((reaction) => reaction.activityId));
    page.forEach((item) => { item.reactionsCount = reactionCounts.get(item.id) || 0; item.commentsCount = commentCounts.get(item.id) || 0; item.reactedByMe = reacted.has(item.id); item.commentsPreview = commentPreviews.get(item.id) || []; });
    const nextOffset = offset + page.length;
    await this.syncFeedNotifications(userId, page);
    return { items: page, nextCursor: nextOffset < items.length ? String(nextOffset) : null, hasMore: nextOffset < items.length };
  }

  async toggleReaction(activityId: string, userId: number) {
    await this.ensureActivityAccess(activityId, userId);
    const existing = await this.reactionRepo.findOne({ where: { activityId, userId } });
    if (existing) {
      await this.reactionRepo.remove(existing);
      return { reacted: false };
    }
    await this.reactionRepo.save(this.reactionRepo.create({ activityId, userId }));
    const recipientId = await this.getActivityRecipient(activityId);
    if (recipientId && recipientId !== userId) {
      try {
        await this.notificationsService?.create({
          recipientId,
          actorId: userId,
          type: 'reaction',
          title: 'New reaction',
          body: 'Someone reacted to your activity.',
          entityType: 'activity',
          entityId: activityId,
          dedupeKey: `reaction:${activityId}:${userId}`,
        });
      } catch {}
    }
    return { reacted: true };
  }

  async comments(activityId: string, userId: number) {
    await this.ensureActivityAccess(activityId, userId);
    const comments = await this.commentRepo.find({ where: { activityId }, order: { createdAt: 'ASC' } });
    return comments.map((comment) => ({ id: comment.id, body: comment.body, createdAt: comment.createdAt, user: { id: comment.user.id, name: comment.user.name } }));
  }

  async addComment(activityId: string, dto: CreateFeedCommentDto, userId: number) {
    await this.ensureActivityAccess(activityId, userId);
    const saved = await this.commentRepo.save(this.commentRepo.create({ activityId, userId, body: dto.body.trim() }));
    const user = await this.userRepo.findOne({ where: { id: userId } });
    const recipientId = await this.getActivityRecipient(activityId);
    if (recipientId && recipientId !== userId) {
      try {
        await this.notificationsService?.create({
          recipientId,
          actorId: userId,
          type: 'comment',
          title: 'New comment',
          body: `${user?.name || 'A buddy'} commented on your activity.`,
          entityType: 'activity',
          entityId: activityId,
        });
      } catch {}
    }
    return { id: saved.id, body: saved.body, createdAt: saved.createdAt, user: { id: userId, name: user?.name || 'Buddy' } };
  }
}
