import { ActivityFeedService } from './activity-feed.service';

describe('shared sighting activity', () => {
  const date = new Date('2026-09-01');
  const joinedAt = new Date('2026-09-20');
  let service: ActivityFeedService;
  let members: any[];
  let comments: any;
  let reactions: any;
  beforeEach(() => {
    members = [
      { diveId: 10, userId: 1, joinedAt: date },
      { diveId: 10, userId: 2, joinedAt },
    ];
    const matches = (value: any, condition: any) =>
      typeof condition === 'object'
        ? condition.value.includes(value)
        : value === condition;
    const buddyRepo = {
      find: jest.fn(async ({ where }) =>
        members.filter((m) =>
          Object.entries(where).every(([key, value]) => matches(m[key], value)),
        ),
      ),
      findOne: jest.fn(async ({ where }) =>
        members.find(
          (m) => m.diveId === where.diveId && m.userId === where.userId,
        ),
      ),
    };
    const users = [
      { id: 1, name: 'Account A' },
      { id: 2, name: 'Tami' },
    ];
    const sighting = {
      id: 7,
      diveId: 10,
      createdByUserId: 1,
      speciesKey: 'great-white-shark',
      createdAt: date,
    };
    comments = {
      find: jest.fn(async () => []),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => ({ ...x, id: 9, createdAt: joinedAt })),
    };
    reactions = {
      find: jest.fn(async () => []),
      findOne: jest.fn(async () => null),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => x),
    };
    service = new ActivityFeedService(
      {
        find: jest.fn(async () => [
          { id: 10, createdAt: date, location: 'Shark Point' },
        ]),
      } as any,
      buddyRepo as any,
      {
        find: jest.fn(async () => [sighting]),
        findOne: jest.fn(async () => sighting),
      } as any,
      {
        find: jest.fn(async () => users),
        findOne: jest.fn(async ({ where }) =>
          users.find((u) => u.id === where.id),
        ),
      } as any,
      comments,
      reactions,
      { list: jest.fn(async () => []) } as any,
    );
  });

  it('credits B in their own marine feed and A’s buddy filter after acceptance', async () => {
    const mine = await service.feed(2, 'mine', 0, 10, 'wildlife');
    const buddy = await service.feed(1, 'wildlife', 0, 10, 'all', 2);
    expect(mine.items).toHaveLength(1);
    expect(buddy.items).toEqual(mine.items);
    expect(mine.items[0]).toMatchObject({
      id: 'sighting-7-2',
      actor: { id: 2 },
      createdAt: joinedAt,
      canOpenDive: true,
    });
  });

  it('preserves the author’s legacy ID and credits each participant once', async () => {
    expect((await service.feed(1, 'mine', 0, 10, 'wildlife')).items[0].id).toBe(
      'sighting-7',
    );
    expect((await service.feed(2, 'wildlife')).items.map((i) => i.id)).toEqual([
      'sighting-7',
    ]);
  });

  it('does not credit a pending or removed participant', async () => {
    members = members.filter((m) => m.userId !== 2);
    expect((await service.feed(2, 'mine', 0, 10, 'wildlife')).items).toEqual(
      [],
    );
    await expect(service.comments('sighting-7-2', 1)).rejects.toThrow();
  });

  it('supports comments and likes on accepted participant events', async () => {
    await expect(
      service.addComment('sighting-7-2', { body: 'Amazing shark!' }, 1),
    ).resolves.toMatchObject({ body: 'Amazing shark!' });
    await expect(service.toggleReaction('sighting-7-2', 2)).resolves.toEqual({
      reacted: true,
    });
    await expect(service.comments('sighting-7-999', 1)).rejects.toThrow();
    await expect(service.comments('sighting-7-1', 1)).rejects.toThrow();
    await expect(service.comments('sighting-7-2', 999)).rejects.toThrow();
  });

  it('keeps filters and pagination consistent', async () => {
    expect(
      (await service.feed(1, 'achievements', 0, 10, 'all', 2)).items,
    ).toEqual([]);
    expect((await service.feed(1, 'dives', 0, 10, 'all', 2)).items).toEqual([]);
    const page = await service.feed(2, 'mine', 0, 1);
    expect(page.items[0].type).toBe('sighting');
    expect(page.nextCursor).toBe('1');
    expect((await service.feed(2, 'mine', 1, 1)).items[0].type).toBe('dive');
  });
});
