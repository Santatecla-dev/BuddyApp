import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import API from '../api/api';
import { ActivityFeedBuddy, ActivityFeedComment, ActivityFeedItem } from '../types';

type FeedFilter = 'all' | 'dives' | 'wildlife' | 'achievements' | 'mine';
type MineFilter = 'all' | 'dives' | 'wildlife' | 'achievements';
type FeedResponse = { items: ActivityFeedItem[]; nextCursor: string | null; hasMore: boolean };

const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '??';

const relativeDate = (value: string) => {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.round(diff / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(minutes / 1440);
  return `${days}d ago`;
};

export default function ActivityFeedScreen({ navigation }: any) {
  const { width } = useWindowDimensions();
  const narrowLayout = width < 520;
  const [filter, setFilter] = useState<FeedFilter>('all');
  const [mineFilter, setMineFilter] = useState<MineFilter>('all');
  const [buddyId, setBuddyId] = useState<number | null>(null);
  const [buddies, setBuddies] = useState<ActivityFeedBuddy[]>([]);
  const [buddyPickerOpen, setBuddyPickerOpen] = useState(false);
  const [items, setItems] = useState<ActivityFeedItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [selectedActivity, setSelectedActivity] = useState<ActivityFeedItem | null>(null);
  const [comments, setComments] = useState<ActivityFeedComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentError, setCommentError] = useState('');
  const requestRef = useRef(0);

  const fetchFeed = useCallback(async (reset = false) => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError('');
    try {
      const response = await API.get<FeedResponse>('/activity-feed', {
        params: {
          type: filter,
          mineType: filter === 'mine' ? mineFilter : undefined,
          buddyId: filter === 'mine' ? undefined : (buddyId ?? undefined),
          cursor: reset ? 0 : cursor || 0,
          limit: 10,
        },
      });
      if (requestId !== requestRef.current) return;
      const data = response.data || { items: [], nextCursor: null, hasMore: false };
      setItems((current) =>
        reset
          ? data.items
          : [...current, ...data.items.filter((item) => !current.some((existing) => existing.id === item.id))]
      );
      setCursor(data.nextCursor);
      setHasMore(Boolean(data.hasMore));
    } catch {
      if (requestId === requestRef.current) setError('Could not load the buddy feed.');
    } finally {
      if (requestId === requestRef.current) {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    }
  }, [cursor, filter, mineFilter, buddyId]);

  useFocusEffect(
    useCallback(() => {
      API.get<ActivityFeedBuddy[]>('/activity-feed/buddies')
        .then((response) => setBuddies(Array.isArray(response.data) ? response.data : []))
        .catch(() => setBuddies([]));
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      fetchFeed(true);
    }, [filter, mineFilter, buddyId])
  );

  const refresh = () => {
    setRefreshing(true);
    fetchFeed(true);
  };

  const toggleLike = async (item: ActivityFeedItem) => {
    setItems((current) =>
      current.map((entry) =>
        entry.id === item.id
          ? {
              ...entry,
              reactedByMe: !entry.reactedByMe,
              reactionsCount: Math.max(0, entry.reactionsCount + (entry.reactedByMe ? -1 : 1)),
            }
          : entry
      )
    );
    try {
      await API.post(`/activity-feed/${item.id}/like`);
    } catch {
      setItems((current) => current.map((entry) => (entry.id === item.id ? item : entry)));
    }
  };

  const openComments = async (item: ActivityFeedItem) => {
    setSelectedActivity(item);
    setComments([]);
    setCommentText('');
    setCommentError('');
    setCommentsLoading(true);
    try {
      const response = await API.get<ActivityFeedComment[]>(`/activity-feed/${item.id}/comments`);
      const loadedComments = Array.isArray(response.data) ? response.data : [];
      setComments(loadedComments);
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id
            ? { ...entry, commentsPreview: loadedComments.slice(-3), commentsCount: loadedComments.length }
            : entry
        )
      );
    } catch {
      setCommentError('Could not load comments.');
    } finally {
      setCommentsLoading(false);
    }
  };

  const addComment = async () => {
    if (!selectedActivity || !commentText.trim() || commentSubmitting) return;
    const body = commentText.trim();
    setCommentError('');
    setCommentSubmitting(true);
    try {
      const response = await API.post<ActivityFeedComment>(`/activity-feed/${selectedActivity.id}/comments`, { body });
      setCommentText('');
      setComments((current) => [...current, response.data]);
      setItems((current) =>
        current.map((item) =>
          item.id === selectedActivity.id
            ? {
                ...item,
                commentsCount: item.commentsCount + 1,
                commentsPreview: [...(item.commentsPreview || []), response.data].slice(-3),
              }
            : item
        )
      );
    } catch {
      setCommentError('Could not save your comment.');
    } finally {
      setCommentSubmitting(false);
    }
  };

  const header = useMemo(
    () => (
      <View>
        <View style={[styles.hero, narrowLayout && styles.narrowHero]}>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>BUDDY NETWORK</Text>
            <Text style={[styles.title, narrowLayout && styles.narrowTitle]}>Activity feed</Text>
            <Text style={styles.subtitle}>See what your dive buddies have been logging underwater.</Text>
          </View>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>

        <View style={styles.filterCard}>
          <Text style={styles.filterTitle}>Show activity</Text>
          <View style={styles.filterRow}>
            {([
              ['all', 'Everything'],
              ['mine', 'My activity'],
              ['dives', 'Dives'],
              ['wildlife', 'Marine life'],
              ['achievements', 'Achievements'],
            ] as [FeedFilter, string][]).map(([value, label]) => (
              <TouchableOpacity
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected: filter === value }}
                onPress={() => setFilter(value)}
                style={[
                  styles.filterChip,
                  value === 'mine' && styles.myActivityChip,
                  filter === value && (value === 'mine' ? styles.myActivityChipActive : styles.filterChipActive),
                ]}
              >
                <Text
                  style={[
                    styles.filterText,
                    value === 'mine' && styles.myActivityText,
                    filter === value && (value === 'mine' ? styles.myActivityTextActive : styles.filterTextActive),
                  ]}
                >
                  {value === 'mine' ? '★ My activity' : label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {filter === 'mine' ? (
            <View style={styles.mineFilterPanel}>
              <Text style={styles.mineFilterTitle}>Filter my activity</Text>
              <View style={styles.mineFilterRow}>
                {([
                  ['all', 'All'],
                  ['dives', 'Dives'],
                  ['wildlife', 'Marine life'],
                  ['achievements', 'Achievements'],
                ] as [MineFilter, string][]).map(([value, label]) => (
                  <TouchableOpacity
                    key={value}
                    accessibilityRole="button"
                    accessibilityState={{ selected: mineFilter === value }}
                    onPress={() => setMineFilter(value)}
                    style={[styles.mineFilterChip, mineFilter === value && styles.mineFilterChipActive]}
                  >
                    <Text
                      style={[
                        styles.mineFilterText,
                        mineFilter === value && styles.mineFilterTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}

          {filter !== 'mine' ? (
            <View style={styles.buddyFilterPanel}>
              <Text style={styles.buddyFilterTitle}>Filter by buddy</Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Choose a buddy"
                accessibilityState={{ expanded: buddyPickerOpen }}
                onPress={() => setBuddyPickerOpen(true)}
                style={styles.buddySelect}
              >
                <Text numberOfLines={1} style={styles.buddySelectText}>
                  {buddyId === null
                    ? 'All buddies'
                    : buddies.find((buddy) => buddy.id === buddyId)?.name || 'All buddies'}
                </Text>
                <Text style={styles.buddySelectArrow}>▾</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        <Modal
          visible={buddyPickerOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setBuddyPickerOpen(false)}
        >
          <View style={styles.buddyModalBackdrop}>
            <View style={styles.buddyPicker}>
              <View style={styles.buddyPickerHeader}>
                <Text style={styles.buddyPickerTitle}>Choose a buddy</Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Close buddy picker"
                  onPress={() => setBuddyPickerOpen(false)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.closeButton}>×</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={[{ id: null, name: 'All buddies' }, ...buddies]}
                keyExtractor={(buddy) => (buddy.id === null ? 'all' : String(buddy.id))}
                style={styles.buddyPickerList}
                renderItem={({ item: buddy }) => (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityState={{ selected: buddyId === buddy.id }}
                    onPress={() => {
                      setBuddyId(buddy.id);
                      setBuddyPickerOpen(false);
                    }}
                    style={[
                      styles.buddyPickerOption,
                      buddyId === buddy.id && styles.buddyPickerOptionActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.buddyPickerOptionText,
                        buddyId === buddy.id && styles.buddyPickerOptionTextActive,
                      ]}
                    >
                      {buddy.name}
                    </Text>
                    {buddyId === buddy.id ? <Text style={styles.buddyPickerCheck}>✓</Text> : null}
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        </Modal>

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={() => fetchFeed(true)} style={styles.retryButton}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    ),
    [buddies, buddyId, buddyPickerOpen, error, fetchFeed, filter, mineFilter, narrowLayout]
  );

  const renderItem = ({ item }: { item: ActivityFeedItem }) => (
    <View style={styles.activityCard}>
      <View style={styles.activityHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(item.actor.name)}</Text>
        </View>
        <View style={styles.actorCopy}>
          <Text style={styles.actorName}>{item.actor.name}</Text>
          <Text style={styles.activityTime}>
            {item.type === 'dive'
              ? 'logged a dive'
              : item.type === 'sighting'
              ? 'recorded a sighting'
              : 'unlocked an achievement'}{' '}
            · {relativeDate(item.createdAt)}
          </Text>
        </View>
        <View style={[styles.typePill, item.type === 'sighting' ? styles.wildlifePill : item.type === 'achievement' ? styles.achievementPill : null]}>
          <Text
            style={[
              styles.typePillText,
              item.type === 'sighting' ? styles.wildlifePillText : item.type === 'achievement' ? styles.achievementPillText : null,
            ]}
          >
            {item.type === 'dive' ? 'DIVE' : item.type === 'sighting' ? 'SIGHTING' : 'ACHIEVEMENT'}
          </Text>
        </View>
      </View>

      <Text style={styles.activityTitle}>
        {item.type === 'dive'
          ? `Explored ${item.dive?.location || 'a dive site'}`
          : item.type === 'sighting'
          ? `Spotted a ${item.species?.name || 'new species'}`
          : `Unlocked ${item.achievement?.title || 'an achievement'}`}
      </Text>

      {item.dive && item.type === 'dive' ? (
        <TouchableOpacity
          style={styles.diveSummary}
          onPress={() => navigation.navigate('DiveDetail', { diveId: item.dive?.id })}
          accessibilityRole="button"
          accessibilityLabel={`Dive in ${item.dive.location}`}
        >
          <View style={styles.diveSummaryCopy}>
            <Text style={styles.diveLocation}>{item.dive.location}</Text>
            <Text style={styles.diveMeta}>
              {item.dive.country} · {item.dive.maxDepth} m · {item.dive.duration} min
            </Text>
          </View>
          <Text style={styles.diveArrow}>›</Text>
        </TouchableOpacity>
      ) : null}

      {item.species ? (
        <TouchableOpacity
          style={styles.speciesSummary}
          onPress={() => navigation.navigate('Pokedex')}
          accessibilityRole="button"
          accessibilityLabel={`Species ${item.species.name}`}
        >
          {item.species.imageUrl ? (
            <Image
              source={{ uri: item.species.imageUrl }}
              style={styles.speciesThumb}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.speciesPlaceholder}>
              <Text style={styles.speciesEmoji}>🐟</Text>
            </View>
          )}
          <View style={styles.speciesCopy}>
            <Text style={styles.speciesName}>{item.species.name}</Text>
            <Text style={styles.speciesCategory}>{item.species.category}</Text>
            {item.dive ? (
              <Text style={styles.speciesDiveContext}>
                Spotted at {item.dive.location} ({item.dive.country})
              </Text>
            ) : null}
          </View>
          <Text style={styles.speciesArrow}>Open Pokedex ›</Text>
        </TouchableOpacity>
      ) : null}

      {item.achievement ? (
        <TouchableOpacity
          style={styles.achievementSummary}
          onPress={() =>
            navigation.navigate(item.achievement?.category === 'wildlife' ? 'Pokedex' : 'Achievements')
          }
          accessibilityRole="button"
          accessibilityLabel={`Achievement ${item.achievement.title}`}
        >
          <Text style={styles.achievementIcon}>{item.achievement.icon}</Text>
          <View style={styles.achievementCopy}>
            <Text style={styles.achievementName}>{item.achievement.title}</Text>
            <Text style={styles.achievementDescription}>{item.achievement.description}</Text>
            <Text style={styles.achievementContext}>
              {item.achievement.evidence?.length
                ? `Evidence: ${item.achievement.evidence.join(', ')}`
                : `Only dives ${item.actor.name} participated in affect this achievement.`}
            </Text>
          </View>
          <Text style={styles.achievementArrow}>
            {item.achievement.category === 'wildlife' ? 'Pokedex ›' : 'View ›'}
          </Text>
        </TouchableOpacity>
      ) : null}

      {item.commentsPreview?.length ? (
        <View style={styles.commentPreview}>
          <Text style={styles.commentPreviewTitle}>Conversation</Text>
          {item.commentsPreview.map((comment) => (
            <View key={comment.id} style={styles.previewRow}>
              <View style={styles.previewAvatar}>
                <Text style={styles.previewAvatarText}>{initials(comment.user.name)}</Text>
              </View>
              <Text style={styles.previewBody}>
                <Text style={styles.previewAuthor}>{comment.user.name}: </Text>
                {comment.body}
              </Text>
            </View>
          ))}
          {item.commentsCount > item.commentsPreview.length ? (
            <TouchableOpacity accessibilityRole="button" onPress={() => openComments(item)}>
              <Text style={styles.previewMore}>View all {item.commentsCount} comments</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      <View style={styles.actionRow}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={item.reactedByMe ? 'Unlike' : 'Like'}
          onPress={() => toggleLike(item)}
          style={styles.actionButton}
        >
          <Text style={[styles.actionIcon, item.reactedByMe && styles.actionIconActive]}>
            {item.reactedByMe ? '♥' : '♡'}
          </Text>
          <Text style={styles.actionLabel}>{item.reactionsCount || 'Like'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Open comments"
          onPress={() => openComments(item)}
          style={styles.actionButton}
        >
          <Text style={styles.actionIcon}>○</Text>
          <Text style={styles.actionLabel}>{item.commentsCount || 'Comment'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Your feed is quiet</Text>
              <Text style={styles.emptyText}>
                Join a dive with a buddy or log a sighting to start the conversation.
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          loading || loadingMore ? (
            <ActivityIndicator color="#0077CC" style={styles.loader} />
          ) : hasMore ? (
            <TouchableOpacity style={styles.loadMore} onPress={() => fetchFeed(false)}>
              <Text style={styles.loadMoreText}>Load more activity</Text>
            </TouchableOpacity>
          ) : null
        }
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#0077CC" />}
        onEndReached={() => {
          if (hasMore && !loadingMore) fetchFeed(false);
        }}
        onEndReachedThreshold={0.35}
      />

      <Modal
        visible={Boolean(selectedActivity)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedActivity(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.commentModal}>
            <View style={styles.commentHeader}>
              <Text style={styles.commentTitle}>Comments</Text>
              <TouchableOpacity
                onPress={() => setSelectedActivity(null)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Close comments"
              >
                <Text style={styles.closeButton}>×</Text>
              </TouchableOpacity>
            </View>

            {commentsLoading ? (
              <ActivityIndicator color="#0077CC" style={styles.loader} />
            ) : comments.length ? (
              <FlatList
                data={comments}
                keyExtractor={(item) => String(item.id)}
                style={styles.commentsList}
                renderItem={({ item }) => (
                  <View style={styles.commentRow}>
                    <View style={styles.commentAvatar}>
                      <Text style={styles.commentAvatarText}>{initials(item.user.name)}</Text>
                    </View>
                    <View style={styles.commentCopy}>
                      <View style={styles.commentAuthorRow}>
                        <Text style={styles.commentAuthor}>{item.user.name}</Text>
                        {item.createdAt ? (
                          <Text style={styles.commentTime}>{relativeDate(item.createdAt)}</Text>
                        ) : null}
                      </View>
                      <Text style={styles.commentBody}>{item.body}</Text>
                    </View>
                  </View>
                )}
              />
            ) : (
              <Text style={styles.noComments}>No comments yet. Start the conversation.</Text>
            )}

            {commentError ? <Text style={styles.commentError}>{commentError}</Text> : null}

            <View style={styles.commentComposer}>
              <TextInput
                accessibilityLabel="Comment"
                placeholder="Write a comment..."
                value={commentText}
                onChangeText={setCommentText}
                style={styles.commentInput}
                multiline
                maxLength={500}
                editable={!commentSubmitting}
              />
              <TouchableOpacity
                accessibilityLabel="Send comment"
                onPress={addComment}
                disabled={commentSubmitting || !commentText.trim()}
                style={[
                  styles.sendButton,
                  (!commentText.trim() || commentSubmitting) && styles.sendButtonDisabled,
                ]}
              >
                {commentSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.sendButtonText}>Send</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f7f9fc' },
  content: { width: '100%', maxWidth: 860, alignSelf: 'center', padding: 16, paddingBottom: 50 },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#e7f6fb',
    borderWidth: 1,
    borderColor: '#c5e9f3',
    borderRadius: 22,
    padding: 20,
  },
  narrowHero: {
    padding: 16,
  },
  heroCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: '#00A8A8', fontSize: 11, fontWeight: 'bold', letterSpacing: 1.2 },
  title: { color: '#0077CC', fontSize: 28, fontWeight: 'bold', marginTop: 5 },
  narrowTitle: { fontSize: 24 },
  subtitle: { color: '#425466', lineHeight: 20, marginTop: 7 },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingHorizontal: 11,
    paddingVertical: 8,
    marginLeft: 12,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#00a878', marginRight: 6 },
  liveText: { color: '#008d78', fontSize: 10, fontWeight: 'bold' },
  filterCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dbe6ee',
    borderRadius: 15,
    padding: 14,
    marginTop: 15,
  },
  filterTitle: { color: '#164c67', fontWeight: 'bold', fontSize: 13 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  filterChip: { borderWidth: 1, borderColor: '#b8d8ee', borderRadius: 17, paddingHorizontal: 13, paddingVertical: 8 },
  filterChipActive: { backgroundColor: '#0077CC', borderColor: '#0077CC' },
  filterText: { color: '#0077CC', fontSize: 12, fontWeight: 'bold' },
  filterTextActive: { color: '#fff' },
  errorCard: {
    backgroundColor: '#fff4f3',
    borderColor: '#f2c6c2',
    borderWidth: 1,
    borderRadius: 14,
    padding: 15,
    marginTop: 15,
    alignItems: 'center',
  },
  errorText: { color: '#a33a33', textAlign: 'center' },
  retryButton: {
    borderWidth: 1,
    borderColor: '#a33a33',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginTop: 9,
  },
  retryText: { color: '#a33a33', fontWeight: 'bold' },
  activityCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dbe6ee',
    borderRadius: 17,
    padding: 16,
    marginTop: 15,
    shadowColor: '#164c67',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  activityHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#d9f3ee',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#007d78', fontWeight: 'bold', fontSize: 13 },
  actorCopy: { flex: 1, minWidth: 0, marginLeft: 10 },
  actorName: { color: '#164c67', fontWeight: 'bold', fontSize: 14 },
  activityTime: { color: '#7890a0', fontSize: 11, marginTop: 3 },
  typePill: { backgroundColor: '#e7f6fb', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 5 },
  wildlifePill: { backgroundColor: '#fff4d6' },
  achievementPill: { backgroundColor: '#f0ebf8' },
  typePillText: { color: '#0077CC', fontSize: 9, fontWeight: 'bold' },
  wildlifePillText: { color: '#9a741b' },
  achievementPillText: { color: '#62449a' },
  activityTitle: { color: '#164c67', fontSize: 18, fontWeight: 'bold', marginTop: 12 },
  diveSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f7f9fc',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#edf2f5',
  },
  diveSummaryCopy: { flex: 1, minWidth: 0 },
  diveLocation: { color: '#0077CC', fontWeight: 'bold', fontSize: 14 },
  diveMeta: { color: '#657987', fontSize: 11, marginTop: 4 },
  diveArrow: { color: '#0077CC', fontSize: 22, marginLeft: 8 },
  speciesSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eadba8',
    backgroundColor: '#fffaf0',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  speciesThumb: { width: 52, height: 52, borderRadius: 10, backgroundColor: '#dcebf1' },
  speciesPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: '#fdedcf',
    alignItems: 'center',
    justifyContent: 'center',
  },
  speciesEmoji: { fontSize: 24 },
  speciesCopy: { flex: 1, minWidth: 0, marginLeft: 12 },
  speciesName: { color: '#6d5112', fontWeight: 'bold', fontSize: 14 },
  speciesCategory: { color: '#9a741b', fontSize: 12, marginTop: 2 },
  speciesDiveContext: { color: '#7a6021', fontSize: 11, marginTop: 3 },
  speciesArrow: { color: '#9a741b', fontSize: 11, fontWeight: 'bold', marginLeft: 8 },
  achievementSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d9c6f2',
    backgroundColor: '#faf6ff',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  achievementIcon: { fontSize: 26, width: 34, textAlign: 'center' },
  achievementCopy: { flex: 1, minWidth: 0, marginLeft: 10 },
  achievementName: { color: '#62449a', fontWeight: 'bold', fontSize: 14 },
  achievementDescription: { color: '#8069a8', fontSize: 11, marginTop: 3 },
  achievementContext: { color: '#8069a8', fontSize: 10, marginTop: 4, lineHeight: 14 },
  achievementArrow: { color: '#62449a', fontSize: 11, fontWeight: 'bold', marginLeft: 8 },
  actionRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#edf2f5',
    marginTop: 14,
    paddingTop: 11,
    gap: 20,
  },
  actionButton: { flexDirection: 'row', alignItems: 'center', minWidth: 75 },
  actionIcon: { color: '#7890a0', fontSize: 20, marginRight: 6 },
  actionIconActive: { color: '#df5b76' },
  actionLabel: { color: '#657987', fontSize: 12, fontWeight: '500' },
  loader: { marginVertical: 22 },
  loadMore: {
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#b8d8ee',
    borderRadius: 18,
    paddingHorizontal: 15,
    paddingVertical: 9,
    marginVertical: 18,
  },
  loadMoreText: { color: '#0077CC', fontWeight: 'bold', fontSize: 12 },
  emptyCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dbe6ee',
    borderRadius: 15,
    alignItems: 'center',
    padding: 30,
    marginTop: 16,
  },
  emptyTitle: { color: '#164c67', fontSize: 19, fontWeight: 'bold' },
  emptyText: { color: '#7890a0', textAlign: 'center', marginTop: 6, lineHeight: 19 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(12,35,50,0.55)' },
  commentModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    minHeight: 360,
    maxHeight: '85%',
    padding: 18,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#edf2f5',
    paddingBottom: 12,
  },
  commentTitle: { color: '#164c67', fontSize: 20, fontWeight: 'bold' },
  closeButton: { color: '#607986', fontSize: 28, lineHeight: 28 },
  noComments: { color: '#7890a0', textAlign: 'center', marginVertical: 35 },
  commentsList: { maxHeight: 320 },
  commentRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#edf2f5',
  },
  commentAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#e7f6fb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  commentAvatarText: { color: '#0077CC', fontSize: 10, fontWeight: 'bold' },
  commentCopy: { flex: 1, minWidth: 0 },
  commentAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  commentAuthor: { color: '#164c67', fontWeight: 'bold', fontSize: 12 },
  commentTime: { color: '#94a3b8', fontSize: 10 },
  commentBody: { color: '#425466', fontSize: 13, marginTop: 3, lineHeight: 18 },
  commentError: { color: '#a33a33', fontSize: 12, marginTop: 8 },
  commentComposer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#edf2f5',
    paddingTop: 11,
    marginTop: 8,
  },
  commentInput: {
    flex: 1,
    maxHeight: 90,
    minHeight: 38,
    borderWidth: 1,
    borderColor: '#b8d8ee',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#334155',
  },
  sendButton: {
    borderRadius: 12,
    backgroundColor: '#0077CC',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  myActivityChip: { borderColor: '#d3b36a', backgroundColor: '#fffaf0', paddingHorizontal: 15 },
  myActivityChipActive: { backgroundColor: '#b8791f', borderColor: '#b8791f' },
  myActivityText: { color: '#9a6418' },
  myActivityTextActive: { color: '#fff' },
  mineFilterPanel: { borderTopWidth: 1, borderTopColor: '#f0e4c8', marginTop: 13, paddingTop: 11 },
  mineFilterTitle: { color: '#8a5a18', fontSize: 11, fontWeight: 'bold' },
  mineFilterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 8 },
  mineFilterChip: { borderWidth: 1, borderColor: '#e3d4b2', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  mineFilterChipActive: { backgroundColor: '#fff0cf', borderColor: '#c99335' },
  mineFilterText: { color: '#8a6a32', fontSize: 11, fontWeight: 'bold' },
  mineFilterTextActive: { color: '#80500c' },
  buddyFilterPanel: { borderTopWidth: 1, borderTopColor: '#edf2f5', marginTop: 13, paddingTop: 11 },
  buddyFilterTitle: { color: '#164c67', fontSize: 11, fontWeight: 'bold' },
  buddySelect: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#c5dce9',
    borderRadius: 10,
    backgroundColor: '#f8fbfd',
    minHeight: 40,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  buddySelectText: { flex: 1, color: '#164c67', fontSize: 12, fontWeight: 'bold' },
  buddySelectArrow: { color: '#007d78', fontSize: 16, marginLeft: 8 },
  buddyModalBackdrop: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(12,35,50,0.5)' },
  buddyPicker: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '60%',
    alignSelf: 'center',
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
  },
  buddyPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#edf2f5',
    paddingBottom: 10,
  },
  buddyPickerTitle: { color: '#164c67', fontSize: 18, fontWeight: 'bold' },
  buddyPickerList: { marginTop: 8, maxHeight: 260 },
  buddyPickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#edf2f5',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  buddyPickerOptionActive: { backgroundColor: '#e0f4f4', borderRadius: 8 },
  buddyPickerOptionText: { color: '#425466', fontSize: 14 },
  buddyPickerOptionTextActive: { color: '#007d78', fontWeight: 'bold' },
  buddyPickerCheck: { color: '#007d78', fontSize: 17, fontWeight: 'bold' },
  commentPreview: {
    backgroundColor: '#f7f9fc',
    borderRadius: 12,
    padding: 10,
    marginTop: 12,
  },
  commentPreviewTitle: { color: '#607986', fontSize: 11, fontWeight: 'bold', marginBottom: 4 },
  previewRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 4 },
  previewAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#d9f3ee',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 7,
    marginTop: 1,
  },
  previewAvatarText: { color: '#007d78', fontSize: 8, fontWeight: 'bold' },
  previewBody: { flex: 1, color: '#425466', fontSize: 12, lineHeight: 17 },
  previewAuthor: { color: '#164c67', fontWeight: 'bold' },
  previewMore: { color: '#0077CC', fontSize: 11, fontWeight: 'bold', marginTop: 5 },
});
