import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import API from '../api/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Achievement, AchievementCategory, AchievementTier } from '../types';

type Filter = 'all' | 'unlocked' | 'locked';
const CATEGORY_LABELS: Record<AchievementCategory, string> = { dives: 'Dive milestones', wildlife: 'Marine life', exploration: 'Exploration' };
const TIER_LABELS: Record<AchievementTier, string> = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', platinum: 'Platinum' };

export default function AchievementsScreen({ route, navigation }: any) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const closeRef = useRef<any>(null);
  const pinPending = useRef(false);
  const [savingPins, setSavingPins] = useState(false);
  const [noticeVersion, setNoticeVersion] = useState(0);
  const narrowLayout = width < 520;

  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [history, setHistory] = useState<Achievement[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [category, setCategory] = useState<'all' | AchievementCategory>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<Achievement | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [toast, setToast] = useState<Achievement | null>(null);
  const [toastQueue, setToastQueue] = useState<Achievement[]>([]);
  const celebrationRef = useRef('');

  const loadAchievements = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [response, historyResponse] = await Promise.all([
        API.get<Achievement[]>('/achievements'),
        API.get<Achievement[]>('/achievements/history').catch(() => null),
      ]);
      const next = Array.isArray(response.data) ? response.data : [];
      setAchievements(next);
      setHistory(historyResponse && Array.isArray(historyResponse.data) ? historyResponse.data : next.filter((item) => item.everUnlocked));
    } catch {
      setError('Could not load your achievements.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadAchievements(); }, [loadAchievements]));

  useEffect(() => {
    const ids = Array.isArray(route?.params?.celebrateIds) ? route.params.celebrateIds as string[] : [];
    if (!ids.length || !achievements.length) return;
    const key = `${route?.params?.celebrationKey || ''}:${ids.join('|')}`;
    if (celebrationRef.current === key) return;
    celebrationRef.current = key;
    setToastQueue(achievements.filter((achievement) => ids.includes(achievement.id)));
    navigation.setParams({ celebrateIds: undefined, celebrationKey: undefined });
  }, [achievements, navigation, route?.params?.celebrateIds, route?.params?.celebrationKey]);

  useEffect(() => {
    if (toast || !toastQueue.length) return undefined;
    setToast(toastQueue[0]);
    setToastQueue((current) => current.slice(1));
    return undefined;
  }, [toast, toastQueue]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(timeout);
  }, [notice, noticeVersion]);

  const visibleAchievements = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return achievements.filter((achievement) => {
      const matchesFilter = filter === 'all' || (filter === 'unlocked' ? achievement.unlocked : !achievement.unlocked);
      const matchesCategory = category === 'all' || achievement.category === category;
      const matchesQuery = !normalized || `${achievement.title} ${achievement.description}`.toLocaleLowerCase().includes(normalized);
      return matchesFilter && matchesCategory && matchesQuery;
    });
  }, [achievements, category, filter, query]);

  const unlockedCount = achievements.filter((achievement) => achievement.unlocked).length;
  const completion = achievements.length ? Math.round((unlockedCount / achievements.length) * 100) : 0;
  const pinnedAchievements = achievements.filter((achievement) => achievement.pinned);
  const nearUnlock = achievements.filter((achievement) => !achievement.unlocked).sort((a, b) => (a.target - a.progress) - (b.target - b.progress)).slice(0, 3);
  const unlockDays = useMemo(() => {
    const days: Record<string, number> = {};
    history.forEach((achievement) => {
      if (!achievement.unlockedAt) return;
      const date = new Date(achievement.unlockedAt);
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      days[key] = (days[key] || 0) + 1;
    });
    return days;
  }, [history]);
  const calendarCells = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const leading = (new Date(year, month, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return [...Array(leading).fill(null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)];
  }, [calendarMonth]);
  const calendarMonthKey = `${calendarMonth.getFullYear()}-${calendarMonth.getMonth()}`;
  const currentMonthKey = `${new Date().getFullYear()}-${new Date().getMonth()}`;
  const calendarMonthUnlocks = Object.entries(unlockDays).filter(([key]) => key.startsWith(`${calendarMonthKey}-`)).reduce((total, [, count]) => total + count, 0);

  useEffect(() => {
    const latest = history.find((achievement) => achievement.unlockedAt)?.unlockedAt;
    if (latest) setCalendarMonth(new Date(latest));
  }, [history]);

  // History contains snapshots; details should show the current pin and progress state.
  useEffect(() => {
    setSelected((current) => current ? achievements.find((item) => item.id === current.id) || current : null);
  }, [achievements, selected?.id]);

  const togglePin = async (achievement: Achievement) => {
    if (pinPending.current) return;
    setNoticeVersion((value) => value + 1);
    const previous = achievements;
    const currentlyPinned = achievements.filter((item) => item.pinned).map((item) => item.id);
    const nextIds = currentlyPinned.includes(achievement.id) ? currentlyPinned.filter((id) => id !== achievement.id) : [...currentlyPinned, achievement.id];
    if (nextIds.length > 3) {
      setNotice('You can pin up to three achievements.');
      return;
    }
    pinPending.current = true;
    setSavingPins(true);
    setNotice('');
    setAchievements((current) => current.map((item) => ({ ...item, pinned: nextIds.includes(item.id) })));
    setSelected((current) => current && current.id === achievement.id ? { ...current, pinned: nextIds.includes(current.id) } : current);
    try {
      await API.put('/achievements/pins', { achievementIds: nextIds });
    } catch {
      setNotice('Could not save your pinned achievements.');
      setAchievements(previous);
      setSelected((current) => current ? previous.find((item) => item.id === current.id) || current : null);
    } finally {
      pinPending.current = false;
      setSavingPins(false);
    }
  };

  const openEvidence = (evidence: { kind: string; id?: number }) => {
    setSelected(null);
    if (evidence.kind === 'dive' && evidence.id) navigation.navigate('DiveDetail', { diveId: evidence.id });
    if (evidence.kind === 'species') navigation.navigate('Pokedex');
  };

  const pinNotice = notice ? (
    <View style={styles.notice} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Text style={styles.noticeText}>{notice}</Text>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Dismiss pin message" style={styles.touchTarget} onPress={() => setNotice('')}><Text style={styles.closeButton}>×</Text></TouchableOpacity>
    </View>
  ) : null;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, narrowLayout && styles.narrowContent]} keyboardShouldPersistTaps="handled">
        <View style={[styles.hero, narrowLayout && styles.narrowHero]}><View style={styles.heroCopy}><Text style={styles.eyebrow}>DIVE MILESTONES</Text><Text style={styles.title}>Achievements</Text><Text style={styles.subtitle}>Collect badges as your logbook and marine life album grow.</Text></View><View style={styles.completion}><Text style={styles.completionValue}>{completion}%</Text><Text style={styles.completionLabel}>complete</Text></View></View>
        <View style={styles.progressCard}><View style={styles.progressHeader}><Text style={styles.progressTitle}>{unlockedCount} of {achievements.length} unlocked</Text><Text style={styles.progressHint}>Keep exploring</Text></View><View style={styles.progressTrack}><View style={[styles.progressBar, { width: `${completion}%` }]} /></View></View>

        {pinnedAchievements.length ? <View style={styles.section}><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Pinned achievements</Text><Text style={styles.sectionHint}>{pinnedAchievements.length}/3</Text></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pinnedRow}>{pinnedAchievements.map((achievement) => <TouchableOpacity key={achievement.id} style={styles.pinnedItem} onPress={() => setSelected(achievement)}><Text style={styles.pinnedIcon}>{achievement.unlocked ? achievement.icon : '🔒'}</Text><View style={styles.pinnedCopy}><Text style={styles.pinnedTitle} numberOfLines={1}>{achievement.title}</Text><Text style={styles.pinnedProgress}>{achievement.progress}/{achievement.target}</Text></View><Text style={styles.unpinMark}>★</Text></TouchableOpacity>)}</ScrollView></View> : null}
        {nearUnlock.length ? <View style={styles.section}><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Almost there</Text><Text style={styles.sectionHint}>Closest to unlocking</Text></View><View style={styles.nearGrid}>{nearUnlock.map((achievement) => <TouchableOpacity key={achievement.id} style={styles.nearCard} onPress={() => setSelected(achievement)}><Text style={styles.nearIcon}>{achievement.icon}</Text><View style={styles.nearCopy}><Text style={styles.nearTitle} numberOfLines={1}>{achievement.title}</Text><Text style={styles.nearProgress}>{achievement.target - achievement.progress} to go</Text><View style={styles.nearTrack}><View style={[styles.nearBar, { width: `${Math.min(100, achievement.progress / achievement.target * 100)}%` }]} /></View></View></TouchableOpacity>)}</View></View> : null}

        <TextInput accessibilityLabel="Search achievements" placeholder="Search achievements" placeholderTextColor="#7890a0" value={query} onChangeText={setQuery} style={styles.searchInput} />
        <View style={styles.filterRow}>{([['all', 'All'], ['unlocked', 'Unlocked'], ['locked', 'Locked']] as [Filter, string][]).map(([value, label]) => <TouchableOpacity key={value} accessibilityRole="button" accessibilityState={{ selected: filter === value }} onPress={() => setFilter(value)} style={[styles.filterChip, filter === value && styles.filterChipActive]}><Text style={[styles.filterText, filter === value && styles.filterTextActive]}>{label}</Text></TouchableOpacity>)}<View style={styles.divider} />{([['all', 'Every category'], ['dives', 'Dives'], ['wildlife', 'Wildlife'], ['exploration', 'Exploration']] as ['all' | AchievementCategory, string][]).map(([value, label]) => <TouchableOpacity key={value} accessibilityRole="button" accessibilityState={{ selected: category === value }} onPress={() => setCategory(value)} style={[styles.filterChip, category === value && styles.categoryChipActive]}><Text style={[styles.filterText, category === value && styles.categoryTextActive]}>{label}</Text></TouchableOpacity>)}</View>
        {loading ? <ActivityIndicator accessibilityLabel="Loading achievements" color="#0077CC" style={styles.loader} /> : null}
        {!loading && error ? <View style={styles.errorCard}><Text accessibilityRole="alert" style={styles.errorText}>{error}</Text><TouchableOpacity style={styles.retryButton} onPress={loadAchievements}><Text style={styles.retryText}>Retry</Text></TouchableOpacity></View> : null}
        {!loading && !error && visibleAchievements.length === 0 ? <View style={styles.emptyCard}><Text style={styles.emptyTitle}>No achievements match</Text><Text style={styles.emptyText}>Try another filter or search term.</Text></View> : null}

        <View style={styles.grid}>{visibleAchievements.map((achievement) => <TouchableOpacity key={achievement.id} accessibilityRole="button" accessibilityLabel={`View ${achievement.title} details`} activeOpacity={0.85} onPress={() => setSelected(achievement)} style={[styles.card, narrowLayout && styles.singleCard, !achievement.unlocked && styles.lockedCard]}><View style={styles.cardTop}><View style={[styles.iconCircle, achievement.unlocked && styles.iconCircleUnlocked]}><Text style={styles.icon}>{achievement.unlocked ? achievement.icon : '🔒'}</Text></View><View style={styles.cardBadges}><Text style={styles.tierBadge}>{TIER_LABELS[achievement.tier]}</Text><Text style={achievement.unlocked ? styles.unlockedLabel : achievement.everUnlocked ? styles.relockedLabel : styles.lockedLabel}>{achievement.unlocked ? 'UNLOCKED' : achievement.everUnlocked ? 'RELOCKED' : 'LOCKED'}</Text></View></View><Text style={styles.cardTitle}>{achievement.title}</Text><Text style={styles.cardDescription}>{achievement.description}</Text><View style={styles.cardProgressHeader}><Text style={styles.cardProgress}>{achievement.progress} / {achievement.target}</Text><Text style={styles.categoryLabel}>{CATEGORY_LABELS[achievement.category]}</Text></View><View style={styles.cardTrack}><View style={[styles.cardBar, achievement.unlocked && styles.cardBarUnlocked, { width: `${Math.min(100, achievement.progress / achievement.target * 100)}%` }]} /></View><View style={styles.cardFooter}><Text style={styles.detailHint}>View details</Text><TouchableOpacity accessibilityLabel={achievement.pinned ? `Unpin ${achievement.title}` : `Pin ${achievement.title}`} accessibilityRole="button" disabled={savingPins} style={styles.touchTarget} onPress={(event) => { event.stopPropagation(); togglePin(achievement); }}><Text style={[styles.pinButton, achievement.pinned && styles.pinButtonActive]}>{achievement.pinned ? '★' : '☆'}</Text></TouchableOpacity></View></TouchableOpacity>)}</View>
        {history.length ? <View style={styles.historyCard}><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Unlock history</Text><Text style={styles.sectionHint}>{history.length} recorded</Text></View><View style={styles.calendarToolbar}><TouchableOpacity accessibilityLabel="Previous unlock month" style={styles.calendarNav} onPress={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}><Text style={styles.calendarNavText}>‹</Text></TouchableOpacity><View style={styles.calendarHeading}><Text style={styles.calendarMonth}>{calendarMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text><Text style={styles.calendarSummary}>{calendarMonthUnlocks} unlock{calendarMonthUnlocks === 1 ? '' : 's'} this month</Text></View><TouchableOpacity accessibilityLabel="Next unlock month" disabled={calendarMonthKey === currentMonthKey} style={[styles.calendarNav, calendarMonthKey === currentMonthKey && styles.calendarNavDisabled]} onPress={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}><Text style={styles.calendarNavText}>›</Text></TouchableOpacity></View><View style={styles.calendarWeek}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, index) => <Text key={`${label}-${index}`} style={styles.calendarWeekLabel}>{label}</Text>)}</View><View style={styles.calendarGrid}>{calendarCells.map((day, index) => { if (!day) return <View key={`empty-${index}`} style={styles.calendarCell} />; const key = `${calendarMonth.getFullYear()}-${calendarMonth.getMonth()}-${day}`; const count = unlockDays[key] || 0; const dayAchievement = count ? history.find((achievement) => achievement.unlockedAt && (() => { const date = new Date(achievement.unlockedAt); return date.getFullYear() === calendarMonth.getFullYear() && date.getMonth() === calendarMonth.getMonth() && date.getDate() === day; })()) : null; return <TouchableOpacity key={key} accessibilityLabel={`${day} ${calendarMonth.toLocaleDateString(undefined, { month: 'long' })}${count ? `, ${count} unlocks` : ''}`} disabled={!count} onPress={() => dayAchievement && setSelected(dayAchievement)} style={[styles.calendarCell, count === 1 && styles.calendarCellLow, count === 2 && styles.calendarCellMedium, count >= 3 && styles.calendarCellHigh]}><Text style={[styles.calendarDay, count > 0 && styles.calendarDayActive]}>{day}</Text>{count ? <Text style={styles.calendarCount}>{count}</Text> : null}</TouchableOpacity>; })}</View><Text style={styles.historyListTitle}>Recent unlocks</Text>{history.slice(0, 8).map((achievement) => <TouchableOpacity key={`${achievement.id}-${achievement.unlockedAt}`} style={styles.historyRow} onPress={() => setSelected(achievement)}><Text style={styles.historyIcon}>{achievement.icon}</Text><View style={styles.historyCopy}><Text style={styles.historyTitle}>{achievement.title}</Text><Text style={styles.historyDate}>{achievement.unlockedAt ? new Date(achievement.unlockedAt).toLocaleDateString() : 'Previously unlocked'}</Text></View><Text style={styles.historyArrow}>›</Text></TouchableOpacity>)}</View> : null}
      </ScrollView>

      <Modal onShow={() => { if (Platform.OS === 'web') closeRef.current?.focus(); }} visible={Boolean(selected)} transparent animationType="fade" onRequestClose={() => setSelected(null)}><View style={[styles.modalBackdrop, { paddingTop: Math.max(16, insets.top), paddingBottom: Math.max(16, insets.bottom) }]}><View style={[styles.detailModal, { maxHeight: height - Math.max(16, insets.top) - Math.max(16, insets.bottom) }]}>{selected ? <><View style={styles.detailHeader}><Text style={styles.detailEyebrow}>{TIER_LABELS[selected.tier]} · {CATEGORY_LABELS[selected.category]}</Text><TouchableOpacity ref={closeRef} accessibilityRole="button" style={styles.touchTarget} accessibilityLabel="Close achievement details" onPress={() => setSelected(null)}><Text style={styles.closeButton}>×</Text></TouchableOpacity></View>{pinNotice}<ScrollView style={styles.detailScroll} contentContainerStyle={styles.detailContent}><View style={styles.detailIconCircle}><Text style={styles.detailIcon}>{selected.unlocked ? selected.icon : '🔒'}</Text></View><Text style={styles.detailTitle}>{selected.title}</Text><Text style={styles.detailDescription}>{selected.description}</Text><View style={styles.detailProgressRow}><Text style={styles.detailProgress}>{selected.progress} / {selected.target}</Text><Text style={selected.unlocked ? styles.unlockedLabel : styles.lockedLabel}>{selected.unlocked ? 'UNLOCKED' : selected.everUnlocked ? 'RELOCKED' : 'LOCKED'}</Text></View><View style={styles.detailTrack}><View style={[styles.detailBar, selected.unlocked && styles.cardBarUnlocked, { width: `${Math.min(100, selected.progress / selected.target * 100)}%` }]} /></View>{selected.unlockedAt ? <Text style={styles.unlockedDate}>Last unlocked {new Date(selected.unlockedAt).toLocaleDateString()}</Text> : null}<TouchableOpacity accessibilityRole="button" disabled={savingPins} style={styles.pinDetailButton} onPress={() => togglePin(selected)}><Text style={styles.pinDetailText}>{selected.pinned ? '★ Remove from pinned' : '☆ Pin achievement'}</Text></TouchableOpacity><Text style={styles.evidenceTitle}>Evidence ({selected.evidenceCount || selected.evidence?.length || 0})</Text>{selected.evidence?.length ? selected.evidence.map((evidence, index) => <TouchableOpacity key={`${evidence.label}-${index}`} disabled={!evidence.id && evidence.kind !== 'species'} style={styles.evidenceRow} onPress={() => openEvidence(evidence)}><Text style={styles.evidenceKind}>{evidence.kind === 'dive' ? '◎' : evidence.kind === 'country' ? '⌖' : '◈'}</Text><Text style={styles.evidenceLabel}>{evidence.label}</Text>{evidence.id || evidence.kind === 'species' ? <Text style={styles.evidenceArrow}>›</Text> : null}</TouchableOpacity>) : <Text style={styles.noEvidence}>No qualifying evidence yet. Keep exploring.</Text>}</ScrollView></> : null}</View></View></Modal>
      {notice && !selected ? <View style={[styles.noticeOverlay, { bottom: Math.max(16, insets.bottom) }]}>{pinNotice}</View> : null}
      {toast ? <View style={[styles.toast, { top: 16, right: Math.max(16, insets.right), width: Math.min(400, width - Math.max(16, insets.right) - Math.max(16, insets.left)), maxHeight: height - insets.top - insets.bottom - 32 }]} accessibilityRole="alert" accessibilityLiveRegion="polite"><View style={styles.toastIcon}><Text style={styles.toastIconText}>{toast.icon}</Text></View><View style={styles.toastCopy}><Text style={styles.toastEyebrow}>ACHIEVEMENT UNLOCKED</Text><Text style={styles.toastTitle}>{toast.title}</Text><Text style={styles.toastDescription}>{toast.description}</Text></View><TouchableOpacity accessibilityLabel="Dismiss achievement notification" accessibilityRole="button" style={styles.touchTarget} onPress={() => setToast(null)}><Text style={styles.toastClose}>×</Text></TouchableOpacity></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f7f9fc' }, content: { width: '100%', maxWidth: 1120, alignSelf: 'center', padding: 20, paddingBottom: 60 }, narrowContent: { padding: 12, paddingBottom: 40 },
  hero: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#e7f6fb', borderWidth: 1, borderColor: '#c5e9f3', borderRadius: 22, padding: 24 }, narrowHero: { flexDirection: 'column', alignItems: 'flex-start', gap: 16, padding: 18 }, heroCopy: { flex: 1, minWidth: 0 }, eyebrow: { color: '#00A8A8', letterSpacing: 1.2, fontSize: 11, fontWeight: 'bold' }, title: { color: '#0077CC', fontSize: 30, fontWeight: 'bold', marginTop: 5 }, subtitle: { color: '#425466', fontSize: 15, lineHeight: 21, marginTop: 7 }, completion: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginLeft: 15 }, completionValue: { color: '#0077CC', fontSize: 22, fontWeight: 'bold' }, completionLabel: { color: '#6a7d8d', fontSize: 11 },
  progressCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe6ee', borderRadius: 15, padding: 15, marginTop: 16 }, progressHeader: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'space-between', alignItems: 'center' }, progressTitle: { color: '#164c67', fontWeight: 'bold' }, progressHint: { color: '#6a7d8d', fontSize: 12 }, progressTrack: { height: 11, borderRadius: 6, backgroundColor: '#e6f0f4', overflow: 'hidden', marginTop: 11 }, progressBar: { height: '100%', borderRadius: 6, backgroundColor: '#00A8A8' },
  section: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe6ee', borderRadius: 15, padding: 15, marginTop: 16 }, sectionHeader: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }, sectionTitle: { color: '#164c67', fontSize: 16, fontWeight: 'bold' }, sectionHint: { color: '#6a7d8d', fontSize: 11 }, pinnedRow: { gap: 10 }, pinnedItem: { width: 190, minHeight: 70, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#eadba8', borderRadius: 12, backgroundColor: '#fffaf0', padding: 10 }, pinnedIcon: { fontSize: 26, marginRight: 8 }, pinnedCopy: { flex: 1, minWidth: 0 }, pinnedTitle: { color: '#164c67', fontWeight: 'bold', fontSize: 12 }, pinnedProgress: { color: '#9a741b', fontSize: 11, marginTop: 3 }, unpinMark: { color: '#d5aa43', fontSize: 18, marginLeft: 5 }, nearGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, nearCard: { flexGrow: 1, flexBasis: 230, minWidth: 0, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#dbe6ee', borderRadius: 12, padding: 10 }, nearIcon: { fontSize: 24, marginRight: 9 }, nearCopy: { flex: 1, minWidth: 0 }, nearTitle: { color: '#164c67', fontWeight: 'bold', fontSize: 12 }, nearProgress: { color: '#6a7d8d', fontSize: 11, marginTop: 3 }, nearTrack: { height: 5, backgroundColor: '#e7f0f4', borderRadius: 3, overflow: 'hidden', marginTop: 6 }, nearBar: { height: '100%', backgroundColor: '#d5aa43' },
  searchInput: { height: 48, borderWidth: 1, borderColor: '#b8d8ee', borderRadius: 13, paddingHorizontal: 14, color: '#334155', backgroundColor: '#fff', marginTop: 18 }, filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', paddingVertical: 13 }, filterChip: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: '#b8d8ee', borderRadius: 18, paddingHorizontal: 13, paddingVertical: 9, backgroundColor: '#fff' }, filterChipActive: { backgroundColor: '#0077CC', borderColor: '#0077CC' }, categoryChipActive: { backgroundColor: '#e6f7f3', borderColor: '#00A8A8' }, filterText: { color: '#0077CC', fontSize: 12, fontWeight: 'bold' }, filterTextActive: { color: '#fff' }, categoryTextActive: { color: '#008d8d' }, divider: { height: 26, width: 1, backgroundColor: '#dbe6ee', marginHorizontal: 3 }, noticeOverlay: { position: 'absolute', left: 16, right: 16, maxWidth: 540, alignSelf: 'center', zIndex: 60, elevation: 20 }, touchTarget: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, notice: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff9e7', borderWidth: 1, borderColor: '#eadba8', borderRadius: 10, padding: 10 }, noticeText: { flex: 1, color: '#8c6814', fontSize: 12, textAlign: 'center' }, loader: { marginTop: 30 }, errorCard: { backgroundColor: '#fff4f3', borderWidth: 1, borderColor: '#f2c6c2', borderRadius: 16, alignItems: 'center', padding: 25 }, errorText: { color: '#a33a33', fontWeight: '600', textAlign: 'center' }, retryButton: { borderWidth: 1, borderColor: '#a33a33', borderRadius: 18, paddingHorizontal: 15, paddingVertical: 9, marginTop: 13 }, retryText: { color: '#a33a33', fontWeight: 'bold' }, emptyCard: { backgroundColor: '#fff', borderRadius: 16, alignItems: 'center', padding: 30 }, emptyTitle: { color: '#164c67', fontSize: 18, fontWeight: 'bold' }, emptyText: { color: '#6a7d8d', textAlign: 'center', marginTop: 7 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 2 }, singleCard: { flexBasis: '100%' }, card: { flexGrow: 1, flexBasis: 300, minWidth: 0, backgroundColor: '#fff', borderRadius: 17, borderWidth: 1, borderColor: '#dbe6ee', padding: 17, shadowColor: '#164c67', shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 }, lockedCard: { backgroundColor: '#fbfcfd' }, cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, iconCircle: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: '#edf3f5' }, iconCircleUnlocked: { backgroundColor: '#e5f7f3' }, icon: { fontSize: 28 }, cardBadges: { alignItems: 'flex-end', gap: 5 }, tierBadge: { color: '#9a741b', backgroundColor: '#fff4d6', borderRadius: 9, paddingHorizontal: 7, paddingVertical: 3, fontSize: 9, fontWeight: 'bold' }, unlockedLabel: { color: '#008d78', fontSize: 10, fontWeight: 'bold' }, relockedLabel: { color: '#b36b35', fontSize: 10, fontWeight: 'bold' }, lockedLabel: { color: '#82939d', fontSize: 10, fontWeight: 'bold' }, cardTitle: { color: '#164c67', fontSize: 19, fontWeight: 'bold', marginTop: 13 }, cardDescription: { color: '#657987', minHeight: 40, marginTop: 5, lineHeight: 18 }, cardProgressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }, cardProgress: { color: '#0077CC', fontSize: 12, fontWeight: 'bold' }, categoryLabel: { color: '#7a8e9c', fontSize: 10, textTransform: 'uppercase', marginLeft: 8, flexShrink: 1, textAlign: 'right' }, cardTrack: { height: 8, borderRadius: 4, backgroundColor: '#e7f0f4', overflow: 'hidden', marginTop: 7 }, cardBar: { height: '100%', backgroundColor: '#aac4d0' }, cardBarUnlocked: { backgroundColor: '#00A8A8' }, cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }, detailHint: { color: '#7890a0', fontSize: 11 }, pinButton: { color: '#b7c6cd', fontSize: 25, lineHeight: 25 }, pinButtonActive: { color: '#d5aa43' },
  historyCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe6ee', borderRadius: 15, padding: 15, marginTop: 18, overflow: 'hidden' }, calendarToolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }, calendarNav: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#e7f6fb', alignItems: 'center', justifyContent: 'center' }, calendarNavDisabled: { opacity: 0.35 }, calendarNavText: { color: '#0077CC', fontSize: 27, lineHeight: 29 }, calendarHeading: { alignItems: 'center' }, calendarMonth: { color: '#164c67', fontSize: 15, fontWeight: 'bold', textTransform: 'capitalize' }, calendarSummary: { color: '#7890a0', fontSize: 11, marginTop: 2 }, calendarWeek: { flexDirection: 'row', marginTop: 15 }, calendarWeekLabel: { flex: 1, textAlign: 'center', color: '#8ba0aa', fontSize: 10, fontWeight: 'bold' }, calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 5, width: '100%' }, calendarCell: { width: '14.285714%', minHeight: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 9, marginBottom: 3 }, calendarCellLow: { backgroundColor: '#d9f3ee' }, calendarCellMedium: { backgroundColor: '#91ded0' }, calendarCellHigh: { backgroundColor: '#00a8a8' }, calendarDay: { color: '#647b87', fontSize: 12 }, calendarDayActive: { color: '#164c67', fontWeight: 'bold' }, calendarCount: { color: '#164c67', fontSize: 9, fontWeight: 'bold', marginTop: 1 }, historyListTitle: { color: '#164c67', fontSize: 13, fontWeight: 'bold', marginTop: 17, marginBottom: 5 }, historyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderTopWidth: 1, borderTopColor: '#edf2f5' }, historyIcon: { fontSize: 23, width: 34 }, historyCopy: { flex: 1, minWidth: 0 }, historyTitle: { color: '#164c67', fontWeight: 'bold', fontSize: 13 }, historyDate: { color: '#7a8e9c', fontSize: 11, marginTop: 2 }, historyArrow: { color: '#0077CC', fontSize: 23, marginLeft: 8 },
  modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(12, 35, 50, 0.62)', padding: 16 }, detailModal: { width: '100%', maxWidth: 620, flexShrink: 1, borderRadius: 18, backgroundColor: '#fff', overflow: 'hidden' }, detailScroll: { flexShrink: 1 }, detailContent: { padding: 20, paddingBottom: 30 }, detailHeader: { paddingHorizontal: 16, paddingTop: 8, flexShrink: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, detailEyebrow: { flex: 1, color: '#008d8d', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.7 }, closeButton: { color: '#607986', fontSize: 30, lineHeight: 30, paddingHorizontal: 5 }, detailIconCircle: { width: 82, height: 82, borderRadius: 41, backgroundColor: '#e5f7f3', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginTop: 12 }, detailIcon: { fontSize: 42 }, detailTitle: { color: '#164c67', fontSize: 25, fontWeight: 'bold', textAlign: 'center', marginTop: 13 }, detailDescription: { color: '#657987', lineHeight: 20, textAlign: 'center', marginTop: 6 }, detailProgressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }, detailProgress: { color: '#0077CC', fontWeight: 'bold' }, detailTrack: { height: 10, borderRadius: 5, backgroundColor: '#e7f0f4', overflow: 'hidden', marginTop: 8 }, detailBar: { height: '100%', backgroundColor: '#aac4d0' }, unlockedDate: { color: '#7a8e9c', fontSize: 11, marginTop: 8 }, pinDetailButton: { alignSelf: 'center', borderWidth: 1, borderColor: '#d5aa43', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, marginTop: 14 }, pinDetailText: { color: '#9a741b', fontWeight: 'bold', fontSize: 12 }, evidenceTitle: { color: '#164c67', fontSize: 16, fontWeight: 'bold', marginTop: 23, marginBottom: 8 }, evidenceRow: { minHeight: 40, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#edf2f5', paddingVertical: 8 }, evidenceKind: { color: '#00A8A8', fontSize: 18, width: 28 }, evidenceLabel: { color: '#425466', flex: 1, fontSize: 13 }, evidenceArrow: { color: '#0077CC', fontSize: 22, marginLeft: 8 }, noEvidence: { color: '#7890a0', fontSize: 13, paddingVertical: 10 },
  toast: { position: 'absolute', minHeight: 92, flexDirection: 'row', alignItems: 'center', backgroundColor: '#123c57', borderRadius: 14, padding: 13, shadowColor: '#0b2535', shadowOpacity: 0.35, shadowRadius: 14, elevation: 12, zIndex: 50 }, toastIcon: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#e8bb55', alignItems: 'center', justifyContent: 'center', marginRight: 12 }, toastIconText: { fontSize: 29 }, toastCopy: { flex: 1, minWidth: 0 }, toastEyebrow: { color: '#8fe1d4', fontSize: 9, fontWeight: 'bold', letterSpacing: 1 }, toastTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginTop: 3 }, toastDescription: { color: '#d1e3eb', fontSize: 11, marginTop: 3 }, toastClose: { color: '#fff', fontSize: 24, marginLeft: 8 },
});
