import React, { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import API from '../api/api';
import { NotificationItem, NotificationsResponse } from '../types';

type NotificationFilter = 'all' | 'unread';

const relativeDate = (value: string) => {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`;
  return `${Math.round(minutes / 1440)}d ago`;
};

const iconFor = (type: NotificationItem['type']) => ({
  dive: '◎', comment: '○', reaction: '♥', invite: '✉', invite_accepted: '✓', invite_rejected: '×', achievement: '★', sighting: '◈',
}[type]);

export default function NotificationsScreen({ navigation }: any) {
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const requestRef = useRef(0);

  const fetchNotifications = useCallback(async (reset = false) => {
    const requestId = ++requestRef.current;
    if (reset) setLoading(true); else setLoadingMore(true);
    setError('');
    try {
      const response = await API.get<NotificationsResponse>('/notifications', {
        params: { unreadOnly: filter === 'unread' ? 'true' : undefined, cursor: reset ? 0 : cursor || 0, limit: 20 },
      });
      if (requestId !== requestRef.current) return;
      const data = response.data || { items: [], unreadCount: 0, nextCursor: null, hasMore: false };
      setItems((current) => reset ? data.items : [...current, ...data.items.filter((item) => !current.some((existing) => existing.id === item.id))]);
      setUnreadCount(data.unreadCount || 0);
      setCursor(data.nextCursor);
      setHasMore(Boolean(data.hasMore));
    } catch {
      if (requestId === requestRef.current) setError('Could not load your notifications.');
    } finally {
      if (requestId === requestRef.current) {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    }
  }, [cursor, filter]);

  useFocusEffect(useCallback(() => {
    fetchNotifications(true);
    return () => { requestRef.current += 1; };
  }, [fetchNotifications]));

  const selectFilter = (next: NotificationFilter) => {
    if (next === filter) return;
    setCursor(null);
    setItems([]);
    setFilter(next);
  };

  const markRead = async (item: NotificationItem) => {
    if (item.readAt) return;
    setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry));
    setUnreadCount((count) => Math.max(0, count - 1));
    try {
      await API.patch(`/notifications/${item.id}/read`);
    } catch {
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, readAt: null } : entry));
      setUnreadCount((count) => count + 1);
    }
  };

  const openNotification = async (item: NotificationItem) => {
    await markRead(item);
    if (item.entityType === 'invite') return navigation.navigate('Invitations');
    if (item.entityType === 'activity') return navigation.navigate('ActivityFeed');
    if (item.entityType === 'achievement') return navigation.navigate('Achievements');
    if (item.entityType === 'dive' && item.entityId) return navigation.navigate('DiveDetail', { diveId: Number(item.entityId) });
  };

  const markAllRead = async () => {
    if (!unreadCount) return;
    const previous = items;
    setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })));
    setUnreadCount(0);
    try {
      await API.post('/notifications/read-all');
    } catch {
      setItems(previous);
      setUnreadCount(previous.filter((item) => !item.readAt).length);
    }
  };

  const refresh = () => { setRefreshing(true); fetchNotifications(true); };

  return (
    <View style={styles.screen}>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: !item.readAt }} onPress={() => openNotification(item)} style={[styles.card, !item.readAt && styles.unreadCard]}>
            <View style={[styles.iconCircle, !item.readAt && styles.unreadIconCircle]}><Text style={styles.icon}>{iconFor(item.type)}</Text></View>
            <View style={styles.copy}><View style={styles.cardHeading}><Text style={styles.title} numberOfLines={1}>{item.title}</Text><Text style={styles.time}>{relativeDate(item.createdAt)}</Text></View><Text style={styles.body}>{item.actor ? `${item.actor.name} · ` : ''}{item.body}</Text></View>
            {!item.readAt ? <View style={styles.unreadDot} /> : null}
          </TouchableOpacity>
        )}
        ListHeaderComponent={<View>
          <View style={styles.hero}><View style={styles.heroCopy}><Text style={styles.eyebrow}>BUDDY NETWORK</Text><Text style={styles.heading}>Notifications</Text><Text style={styles.subtitle}>Keep up with the people and dives that matter to you.</Text></View><View style={styles.countBadge}><Text style={styles.countText}>{unreadCount}</Text><Text style={styles.countLabel}>unread</Text></View></View>
          <View style={styles.toolbar}><View style={styles.filterRow}>{(['all', 'unread'] as NotificationFilter[]).map((value) => <TouchableOpacity key={value} accessibilityRole="button" accessibilityState={{ selected: filter === value }} onPress={() => selectFilter(value)} style={[styles.filterChip, filter === value && styles.filterChipActive]}><Text style={[styles.filterText, filter === value && styles.filterTextActive]}>{value === 'all' ? 'All activity' : 'Unread'}</Text></TouchableOpacity>)}</View><TouchableOpacity accessibilityRole="button" accessibilityLabel="Mark all notifications as read" onPress={markAllRead} style={styles.markAllButton}><Text style={styles.markAllText}>Mark all read</Text></TouchableOpacity></View>
          {error ? <View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text><TouchableOpacity accessibilityRole="button" onPress={() => fetchNotifications(true)}><Text style={styles.retryText}>Retry</Text></TouchableOpacity></View> : null}
        </View>}
        ListEmptyComponent={!loading ? <View style={styles.emptyCard}><Text style={styles.emptyTitle}>{filter === 'unread' ? 'You are all caught up' : 'No notifications yet'}</Text><Text style={styles.emptyText}>{filter === 'unread' ? 'New activity from your buddies will appear here.' : 'Comments, invitations and achievements will appear here.'}</Text></View> : null}
        ListFooterComponent={loading || loadingMore ? <ActivityIndicator color="#0077CC" style={styles.loader} /> : hasMore ? <TouchableOpacity accessibilityRole="button" onPress={() => fetchNotifications(false)} style={styles.loadMore}><Text style={styles.loadMoreText}>Load more</Text></TouchableOpacity> : null}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#0077CC" />}
        onEndReached={() => { if (hasMore && !loadingMore) fetchNotifications(false); }}
        onEndReachedThreshold={0.35}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f7f9fc' },
  content: { width: '100%', maxWidth: 860, alignSelf: 'center', padding: 18, paddingBottom: 50 },
  hero: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#e7f6fb', borderWidth: 1, borderColor: '#c5e9f3', borderRadius: 22, padding: 23 },
  heroCopy: { flex: 1, minWidth: 0 }, eyebrow: { color: '#00A8A8', fontSize: 11, fontWeight: 'bold', letterSpacing: 1.2 }, heading: { color: '#0077CC', fontSize: 30, fontWeight: 'bold', marginTop: 5 }, subtitle: { color: '#425466', lineHeight: 20, marginTop: 7 },
  countBadge: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginLeft: 12 }, countText: { color: '#0077CC', fontSize: 24, fontWeight: 'bold' }, countLabel: { color: '#607986', fontSize: 10, marginTop: 2 },
  toolbar: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe6ee', borderRadius: 15, padding: 13, marginTop: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, filterRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', flex: 1 }, filterChip: { borderWidth: 1, borderColor: '#b8d8ee', borderRadius: 17, paddingHorizontal: 13, paddingVertical: 8 }, filterChipActive: { backgroundColor: '#0077CC', borderColor: '#0077CC' }, filterText: { color: '#0077CC', fontSize: 12, fontWeight: 'bold' }, filterTextActive: { color: '#fff' }, markAllButton: { paddingHorizontal: 8, paddingVertical: 8 }, markAllText: { color: '#007d78', fontSize: 11, fontWeight: 'bold' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe6ee', borderRadius: 16, padding: 14, marginTop: 13, minHeight: 78 }, unreadCard: { borderColor: '#86d6d0', backgroundColor: '#fbffff' }, iconCircle: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#edf2f5', alignItems: 'center', justifyContent: 'center' }, unreadIconCircle: { backgroundColor: '#d9f3ee' }, icon: { color: '#007d78', fontSize: 20, fontWeight: 'bold' }, copy: { flex: 1, minWidth: 0, marginLeft: 11 }, cardHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, title: { flex: 1, color: '#164c67', fontSize: 14, fontWeight: 'bold' }, time: { color: '#7890a0', fontSize: 10 }, body: { color: '#425466', fontSize: 12, lineHeight: 18, marginTop: 4 }, unreadDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#00A8A8', marginLeft: 8 },
  loader: { marginVertical: 22 }, loadMore: { alignSelf: 'center', borderWidth: 1, borderColor: '#b8d8ee', borderRadius: 18, paddingHorizontal: 15, paddingVertical: 9, marginVertical: 18 }, loadMoreText: { color: '#0077CC', fontWeight: 'bold', fontSize: 12 }, emptyCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe6ee', borderRadius: 15, alignItems: 'center', padding: 30, marginTop: 16 }, emptyTitle: { color: '#164c67', fontSize: 19, fontWeight: 'bold' }, emptyText: { color: '#7890a0', textAlign: 'center', marginTop: 6, lineHeight: 19 }, errorCard: { backgroundColor: '#fff4f3', borderColor: '#f2c6c2', borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, errorText: { color: '#a33a33', flex: 1 }, retryText: { color: '#a33a33', fontWeight: 'bold', marginLeft: 10 },
});
