import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import API from '../api/api';
import { Dive, DiveTrip, PlannedDive } from '../types';
import { diveDate } from '../utils/diveStats';

type ActivityKind = 'logged' | 'planned';
type ActivityFilter = 'all' | ActivityKind;
type DisplayMode = 'calendar' | 'list';

type ActivityItem = {
  key: string;
  id: number;
  kind: ActivityKind;
  date: string;
  dateKey: string;
  location: string;
  country: string;
  maxDepth: number;
  duration: number;
  buddy?: string;
  condition?: string;
  status?: string;
  tripName?: string;
};

const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const dateKeyFromDate = (date: Date) => {
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const dateKey = (value: string) => {
  const date = diveDate(value);
  return Number.isNaN(date.getTime()) ? value.slice(0, 10) : dateKeyFromDate(date);
};

const formatDate = (value: string) => {
  const date = diveDate(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
};

const monthTitle = (value: Date) => value.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

const sameMonth = (value: string, month: Date) => {
  const date = diveDate(value);
  return date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth();
};

const getCalendarWeeks = (month: Date) => {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: Array<{ date: Date; inMonth: boolean }> = [];
  for (let index = 0; index < offset; index += 1) {
    cells.push({ date: new Date(month.getFullYear(), month.getMonth(), index - offset + 1), inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ date: new Date(month.getFullYear(), month.getMonth(), day), inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].date;
    cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), inMonth: false });
  }
  const weeks: Array<Array<{ date: Date; inMonth: boolean }>> = [];
  for (let index = 0; index < cells.length; index += 7) weeks.push(cells.slice(index, index + 7));
  return weeks;
};

export default function DiveActivityScreen({ navigation }: any) {
  const [dives, setDives] = useState<Dive[]>([]);
  const [plannedDives, setPlannedDives] = useState<PlannedDive[]>([]);
  const [trips, setTrips] = useState<DiveTrip[]>([]);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [mode, setMode] = useState<DisplayMode>('calendar');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ActivityItem | null>(null);
  const [selectedDay, setSelectedDay] = useState<{ key: string; date: Date } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadActivity = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [divesResponse, plannedResponse, tripsResponse] = await Promise.all([
        API.get<Dive[]>('/dives/my'),
        API.get<PlannedDive[]>('/planned-dives'),
        API.get<DiveTrip[]>('/dive-trips'),
      ]);
      setDives(Array.isArray(divesResponse.data) ? divesResponse.data : []);
      setPlannedDives(Array.isArray(plannedResponse.data) ? plannedResponse.data : []);
      setTrips(Array.isArray(tripsResponse.data) ? tripsResponse.data : []);
    } catch {
      setError('We could not load your dive activity.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadActivity();
  }, [loadActivity]));

  const tripNames = useMemo(() => {
    const names = new Map<number, string>();
    trips.forEach((trip) => (trip.plannedDives || []).forEach((plan) => names.set(plan.id, trip.name)));
    return names;
  }, [trips]);

  const activities = useMemo<ActivityItem[]>(() => [
    ...dives.map((dive) => ({
      key: `logged-${dive.id}`,
      id: dive.id,
      kind: 'logged' as const,
      date: dive.date,
      dateKey: dateKey(dive.date),
      location: dive.location,
      country: dive.country,
      maxDepth: Number(dive.maxDepth || 0),
      duration: Number(dive.duration || 0),
      status: 'logged',
    })),
    ...plannedDives.filter((plan) => plan.status !== 'logged').map((plan) => ({
      key: `planned-${plan.id}`,
      id: plan.id,
      kind: 'planned' as const,
      date: plan.date,
      dateKey: dateKey(plan.date),
      location: plan.location,
      country: plan.country,
      maxDepth: Number(plan.maxDepth || 0),
      duration: Number(plan.duration || 0),
      buddy: plan.buddy,
      condition: plan.condition,
      status: plan.status,
      tripName: tripNames.get(plan.id),
    })),
  ], [dives, plannedDives, tripNames]);

  const visibleActivities = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return activities
      .filter((item) => filter === 'all' || item.kind === filter)
      .filter((item) => !normalized || `${item.location} ${item.country} ${item.buddy || ''} ${item.tripName || ''}`.toLocaleLowerCase().includes(normalized))
      .sort((a, b) => diveDate(a.date).getTime() - diveDate(b.date).getTime());
  }, [activities, filter, query]);

  const monthActivities = useMemo(() => visibleActivities.filter((item) => sameMonth(item.date, month)), [month, visibleActivities]);
  const byDate = useMemo(() => monthActivities.reduce<Record<string, ActivityItem[]>>((result, item) => {
    result[item.dateKey] = [...(result[item.dateKey] || []), item];
    return result;
  }, {}), [monthActivities]);
  const monthLogged = monthActivities.filter((item) => item.kind === 'logged').length;
  const monthPlanned = monthActivities.filter((item) => item.kind === 'planned').length;
  const maxDepth = monthActivities.reduce((max, item) => Math.max(max, item.maxDepth), 0);
  const totalMinutes = monthActivities.reduce((total, item) => total + item.duration, 0);
  const weeks = useMemo(() => getCalendarWeeks(month), [month]);
  const selectedDayItems = selectedDay ? (byDate[selectedDay.key] || []) : [];

  const moveMonth = (amount: number) => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  const openActivity = (item: ActivityItem) => {
    setSelected(item);
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>DIVE ACTIVITY</Text>
            <Text style={styles.title}>Your dive rhythm</Text>
            <Text style={styles.subtitle}>See logged dives, upcoming plans and trips together in one timeline.</Text>
          </View>
          <View style={styles.heroActions}>
            <TouchableOpacity accessibilityRole="button" style={styles.secondaryAction} onPress={() => navigation.navigate('PlanDive')}><Text style={styles.secondaryActionText}>+ Plan a dive</Text></TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" style={styles.primaryAction} onPress={() => navigation.navigate('CreateDive')}><Text style={styles.primaryActionText}>Log a dive</Text></TouchableOpacity>
          </View>
        </View>

        <View style={styles.toolbar}>
          <TextInput accessibilityLabel="Search dive activity" placeholder="Search site, country, buddy or trip" placeholderTextColor="#7890a0" value={query} onChangeText={setQuery} style={styles.searchInput} />
          <View style={styles.modeToggle}>
            <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: mode === 'calendar' }} onPress={() => setMode('calendar')} style={[styles.modeButton, mode === 'calendar' && styles.modeButtonActive]}><Text style={[styles.modeText, mode === 'calendar' && styles.modeTextActive]}>Calendar</Text></TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: mode === 'list' }} onPress={() => setMode('list')} style={[styles.modeButton, mode === 'list' && styles.modeButtonActive]}><Text style={[styles.modeText, mode === 'list' && styles.modeTextActive]}>List</Text></TouchableOpacity>
          </View>
          <View style={styles.filterRow}>
            {([['all', 'Everything'], ['logged', 'Logged'], ['planned', 'Planned']] as [ActivityFilter, string][]).map(([value, label]) => (
              <TouchableOpacity key={value} accessibilityRole="button" accessibilityState={{ selected: filter === value }} onPress={() => setFilter(value)} style={[styles.filterChip, filter === value && styles.filterChipActive]}><Text numberOfLines={1} style={[styles.filterText, filter === value && styles.filterTextActive]}>{label}</Text></TouchableOpacity>
            ))}
          </View>
        </View>

        {loading ? <ActivityIndicator accessibilityLabel="Loading dive activity" color="#0077CC" style={styles.loader} /> : null}
        {!loading && error ? <View style={styles.errorCard}><Text accessibilityRole="alert" style={styles.errorText}>{error}</Text><TouchableOpacity accessibilityRole="button" style={styles.retryButton} onPress={loadActivity}><Text style={styles.retryText}>Retry</Text></TouchableOpacity></View> : null}

        {!loading && !error && <>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}><Text style={styles.summaryValue}>{monthLogged}</Text><Text style={styles.summaryLabel}>Logged this month</Text></View>
            <View style={styles.summaryCard}><Text style={styles.summaryValue}>{monthPlanned}</Text><Text style={styles.summaryLabel}>Planned this month</Text></View>
            <View style={styles.summaryCard}><Text style={styles.summaryValue}>{maxDepth}m</Text><Text style={styles.summaryLabel}>Deepest</Text></View>
            <View style={styles.summaryCard}><Text style={styles.summaryValue}>{Math.round(totalMinutes / 60)}h</Text><Text style={styles.summaryLabel}>Underwater time</Text></View>
          </View>

            {mode === 'calendar' ? <View style={styles.calendarCard}>
              <View style={styles.calendarToolbar}>
                <TouchableOpacity accessibilityLabel="Previous month" accessibilityRole="button" style={styles.monthButton} onPress={() => moveMonth(-1)}><Text style={styles.monthButtonText}>‹</Text></TouchableOpacity>
                <Text accessibilityRole="header" style={styles.monthTitle}>{monthTitle(month)}</Text>
                <View style={styles.monthActions}><TouchableOpacity accessibilityRole="button" style={styles.todayButton} onPress={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}><Text style={styles.todayText}>Today</Text></TouchableOpacity><TouchableOpacity accessibilityLabel="Next month" accessibilityRole="button" style={styles.monthButton} onPress={() => moveMonth(1)}><Text style={styles.monthButtonText}>›</Text></TouchableOpacity></View>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.calendarScrollContent}>
                <View style={styles.calendarGridContainer}>
                  <View style={styles.weekdayRow}>{weekdayLabels.map((day) => <Text key={day} style={styles.weekday}>{day}</Text>)}</View>
                  {weeks.map((week, weekIndex) => <View key={`week-${weekIndex}`} style={styles.calendarWeek}>
                    {week.map(({ date, inMonth }) => {
                      const key = dateKeyFromDate(date);
                      const dayItems = byDate[key] || [];
                      const isSelected = selectedDay?.key === key;
                      return <TouchableOpacity key={key} accessibilityRole="button" accessibilityLabel={`Show activity for ${date.toLocaleDateString()}`} onPress={() => setSelectedDay({ key, date })} style={[styles.dayCell, !inMonth && styles.dayCellMuted, isSelected && styles.dayCellSelected]}>
                        <Text style={[styles.dayNumber, !inMonth && styles.dayNumberMuted, isSelected && styles.dayNumberSelected]}>{date.getDate()}</Text>
                        <View style={styles.pillsContainer}>
                          {dayItems.slice(0, 2).map((item) => <TouchableOpacity key={item.key} accessibilityRole="button" onPress={() => openActivity(item)} style={[styles.activityPill, item.kind === 'planned' ? styles.plannedPill : styles.loggedPill]}><Text numberOfLines={1} style={styles.activityPillText}>{item.location}</Text></TouchableOpacity>)}
                          {dayItems.length > 2 ? <Text style={styles.moreText}>+{dayItems.length - 2} more</Text> : null}
                        </View>
                      </TouchableOpacity>;
                    })}
                  </View>)}
                </View>
              </ScrollView>
              <View style={styles.legend}><View style={styles.legendItem}><View style={[styles.legendDot, styles.loggedDot]} /><Text style={styles.legendText}>Logged</Text></View><View style={styles.legendItem}><View style={[styles.legendDot, styles.plannedDot]} /><Text style={styles.legendText}>Planned</Text></View></View>
              {selectedDay ? <View style={styles.dayDetailCard}>
                <View style={styles.dayDetailHeader}><View style={styles.dayDetailHeaderCopy}><Text style={styles.detailEyebrow}>Selected day</Text><Text style={styles.dayDetailTitle}>{selectedDay.date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</Text></View><TouchableOpacity accessibilityRole="button" accessibilityLabel="Close selected day" onPress={() => setSelectedDay(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.closeButton}><Text style={styles.closeText}>×</Text></TouchableOpacity></View>
                {selectedDayItems.length ? <View style={styles.dayDetailList}>{selectedDayItems.map((item) => <TouchableOpacity key={item.key} accessibilityRole="button" style={[styles.dayActivityRow, item.kind === 'planned' && styles.dayActivityRowPlanned]} onPress={() => openActivity(item)}><View style={styles.dayActivityCopy}><Text style={styles.dayActivityLocation} numberOfLines={1}>{item.location}</Text><Text style={styles.dayActivityMeta}>{item.country} · {item.maxDepth}m · {item.duration} min</Text><Text style={styles.dayActivityStatus}>{item.kind === 'planned' ? `Planned${item.buddy ? ` with ${item.buddy}` : ''}` : 'Logged dive'}</Text></View><Text style={styles.dayActivityArrow}>›</Text></TouchableOpacity>)}</View> : <View style={styles.noDayActivity}><Text style={styles.noDayTitle}>Nothing planned for this day</Text><Text style={styles.noDayText}>There are no logged or planned dives matching the current filters.</Text><TouchableOpacity accessibilityRole="button" style={styles.noDayButton} onPress={() => navigation.navigate('PlanDive')}><Text style={styles.noDayButtonText}>Plan a dive</Text></TouchableOpacity></View>}
              </View> : null}
            </View> : <View style={styles.list}>
            {visibleActivities.length === 0 ? <View style={styles.emptyCard}><Text style={styles.emptyTitle}>Nothing matches these filters</Text><Text style={styles.emptyText}>Try another search or switch the activity type.</Text></View> : visibleActivities.map((item) => {
              const itemDate = diveDate(item.date);
              return (
                <TouchableOpacity key={item.key} accessibilityRole="button" style={[styles.listCard, item.kind === 'planned' && styles.listCardPlanned]} onPress={() => openActivity(item)}>
                  <View style={styles.listDate}>
                    <Text style={styles.listDateDay}>{Number.isNaN(itemDate.getTime()) ? '-' : itemDate.getDate()}</Text>
                    <Text style={styles.listDateMonth}>{Number.isNaN(itemDate.getTime()) ? '' : itemDate.toLocaleDateString(undefined, { month: 'short' })}</Text>
                  </View>
                  <View style={styles.listMain}>
                    <View style={styles.listTitleRow}>
                      <Text style={styles.listLocation} numberOfLines={1}>{item.location}</Text>
                      <Text style={item.kind === 'planned' ? styles.plannedLabel : styles.loggedLabel}>{item.kind === 'planned' ? 'PLANNED' : 'LOGGED'}</Text>
                    </View>
                    <Text style={styles.listCountry}>{item.country} · {formatDate(item.date)}</Text>
                    <Text style={styles.listMeta}>{item.maxDepth}m max · {item.duration} min{item.buddy ? ` · ${item.buddy}` : ''}{item.tripName ? ` · ${item.tripName}` : ''}</Text>
                  </View>
                  <Text style={styles.listChevron}>›</Text>
                </TouchableOpacity>
              );
            })}
          </View>}

          {selected ? <View style={styles.detailCard}>
            <View style={styles.detailHeader}><View style={styles.detailCopy}><Text style={styles.detailEyebrow}>{selected.kind === 'planned' ? 'Upcoming plan' : 'Logged dive'}</Text><Text style={styles.detailTitle} numberOfLines={1}>{selected.location}</Text></View><TouchableOpacity accessibilityRole="button" accessibilityLabel="Close activity details" onPress={() => setSelected(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.closeButton}><Text style={styles.closeText}>×</Text></TouchableOpacity></View>
            <Text style={styles.detailSub}>{selected.country} · {formatDate(selected.date)}</Text>
            <View style={styles.detailMetrics}><Text style={styles.detailMetric}>{selected.maxDepth}m max</Text><Text style={styles.detailMetric}>{selected.duration} minutes</Text>{selected.tripName ? <Text style={styles.detailMetric}>{selected.tripName}</Text> : null}</View>
            <TouchableOpacity accessibilityRole="button" style={styles.detailButton} onPress={() => selected.kind === 'planned' ? navigation.navigate('PlannedDiveDetail', { planId: selected.id }) : navigation.navigate('DiveDetail', { diveId: selected.id })}><Text style={styles.detailButtonText}>{selected.kind === 'planned' ? 'Open planned dive' : 'Open dive log'}</Text></TouchableOpacity>
          </View> : null}
        </>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f7f9fc' },
  content: { width: '100%', maxWidth: 1160, alignSelf: 'center', padding: 20, paddingBottom: 48 },
  hero: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16, backgroundColor: '#e7f6fb', borderWidth: 1, borderColor: '#c5e9f3', borderRadius: 22, padding: 24, marginBottom: 18 },
  heroCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 320, minWidth: 0 },
  eyebrow: { color: '#00A8A8', fontSize: 11, fontWeight: 'bold', letterSpacing: 1.5, marginBottom: 6 },
  title: { color: '#0077CC', fontSize: 28, fontWeight: 'bold' },
  subtitle: { color: '#425466', fontSize: 15, marginTop: 6, lineHeight: 21, maxWidth: 540 },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  primaryAction: { backgroundColor: '#0077CC', borderRadius: 22, paddingHorizontal: 18, paddingVertical: 12 },
  primaryActionText: { color: '#fff', fontWeight: 'bold' },
  secondaryAction: { borderWidth: 1, borderColor: '#00A8A8', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 11, backgroundColor: '#fff' },
  secondaryActionText: { color: '#008d8d', fontWeight: 'bold' },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe6ee', borderRadius: 16, padding: 14, marginBottom: 18 },
  searchInput: { flexGrow: 1, flexShrink: 1, flexBasis: 260, minWidth: 0, minHeight: 44, borderWidth: 1, borderColor: '#b8d8ee', borderRadius: 12, paddingHorizontal: 14, color: '#334155', backgroundColor: '#fff', fontSize: 14 },
  modeToggle: { flexDirection: 'row', borderRadius: 12, backgroundColor: '#e5f0f4', padding: 3, alignItems: 'center' },
  modeButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 9 },
  modeButtonActive: { backgroundColor: '#fff', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
  modeText: { color: '#5b7280', fontWeight: '600', fontSize: 13 },
  modeTextActive: { color: '#0077CC' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  filterChip: { minHeight: 34, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#b8d8ee', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: '#fff' },
  filterChipActive: { backgroundColor: '#0077CC', borderColor: '#0077CC' },
  filterText: { color: '#0077CC', fontWeight: 'bold', fontSize: 13 },
  filterTextActive: { color: '#fff' },
  loader: { marginTop: 32 },
  errorCard: { backgroundColor: '#fff4f3', borderWidth: 1, borderColor: '#f2c6c2', borderRadius: 16, alignItems: 'center', padding: 24 },
  errorText: { color: '#a33a33', textAlign: 'center', fontWeight: '600' },
  retryButton: { marginTop: 14, borderWidth: 1, borderColor: '#a33a33', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 9 },
  retryText: { color: '#a33a33', fontWeight: 'bold' },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 18 },
  summaryCard: { flex: 1, minWidth: 140, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e1ecf2', borderRadius: 14, padding: 14, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  summaryValue: { color: '#0077CC', fontSize: 22, fontWeight: 'bold' },
  summaryLabel: { color: '#6a7d8d', fontSize: 12, marginTop: 4 },
  calendarCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe6ee', borderRadius: 18, padding: 16, overflow: 'hidden' },
  calendarToolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 },
  monthTitle: { color: '#164c67', fontSize: 20, fontWeight: 'bold', textTransform: 'capitalize' },
  monthActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  monthButton: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#edf7fa', alignItems: 'center', justifyContent: 'center' },
  monthButtonText: { color: '#0077CC', fontSize: 22, lineHeight: 24, fontWeight: 'bold' },
  todayButton: { borderWidth: 1, borderColor: '#b8d8ee', borderRadius: 11, paddingHorizontal: 12, paddingVertical: 7 },
  todayText: { color: '#0077CC', fontSize: 13, fontWeight: 'bold' },
  calendarScrollContent: { minWidth: '100%' },
  calendarGridContainer: { minWidth: 640, width: '100%' },
  weekdayRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e7eef3', paddingBottom: 10, marginBottom: 2 },
  weekday: { flex: 1, textAlign: 'center', color: '#7a8e9c', fontSize: 12, fontWeight: 'bold' },
  calendarWeek: { flexDirection: 'row' },
  dayCell: { flex: 1, minHeight: 90, borderWidth: 0.5, borderColor: '#e7eef3', padding: 6, backgroundColor: '#fff' },
  dayCellMuted: { backgroundColor: '#fbfcfd' },
  dayCellSelected: { backgroundColor: '#f0f9ff', borderColor: '#0077CC', borderWidth: 1.5 },
  dayNumber: { alignSelf: 'flex-end', color: '#526a79', fontSize: 12, fontWeight: '600', marginBottom: 4 },
  dayNumberMuted: { color: '#becbd2' },
  dayNumberSelected: { color: '#0077CC', fontWeight: 'bold' },
  pillsContainer: { gap: 4, width: '100%' },
  activityPill: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 4, height: 24, justifyContent: 'center', width: '100%' },
  loggedPill: { backgroundColor: '#e5f4fb', borderWidth: 1, borderColor: '#b8d8ee' },
  plannedPill: { backgroundColor: '#e6f7f3', borderWidth: 1, borderColor: '#b6e9de' },
  activityPillText: { color: '#164c67', fontSize: 10, fontWeight: '600' },
  moreText: { color: '#0077CC', fontSize: 10, fontWeight: '600', marginTop: 2, paddingLeft: 2 },
  legend: { flexDirection: 'row', gap: 16, paddingTop: 14, marginTop: 10, borderTopWidth: 1, borderTopColor: '#edf2f5', alignItems: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  loggedDot: { backgroundColor: '#0077CC' },
  plannedDot: { backgroundColor: '#00A8A8' },
  legendText: { color: '#6a7d8d', fontSize: 12 },
  dayDetailCard: { marginTop: 16, padding: 18, backgroundColor: '#f8fcfe', borderRadius: 14, borderWidth: 1, borderColor: '#c5e9f3', borderTopWidth: 3, borderTopColor: '#00A8A8' },
  dayDetailHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, gap: 10 },
  dayDetailHeaderCopy: { flex: 1, minWidth: 0 },
  dayDetailTitle: { color: '#164c67', fontSize: 18, fontWeight: 'bold', marginTop: 3 },
  dayDetailList: { gap: 10 },
  dayActivityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#d9eaf0', paddingHorizontal: 14, paddingVertical: 12, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  dayActivityRowPlanned: { borderLeftWidth: 4, borderLeftColor: '#00A8A8' },
  dayActivityCopy: { flex: 1, minWidth: 0 },
  dayActivityLocation: { color: '#164c67', fontSize: 15, fontWeight: 'bold' },
  dayActivityMeta: { color: '#6a7d8d', fontSize: 12, marginTop: 4 },
  dayActivityStatus: { color: '#008d8d', fontSize: 11, fontWeight: '600', marginTop: 4 },
  dayActivityArrow: { color: '#0077CC', fontSize: 22, marginLeft: 10, fontWeight: 'bold' },
  noDayActivity: { minHeight: 110, alignItems: 'center', justifyContent: 'center', padding: 20, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderStyle: 'dashed', borderColor: '#b8d8ee' },
  noDayTitle: { color: '#164c67', fontSize: 15, fontWeight: 'bold' },
  noDayText: { color: '#6a7d8d', textAlign: 'center', marginTop: 4, fontSize: 13, maxWidth: 380 },
  noDayButton: { backgroundColor: '#0077CC', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 8, marginTop: 12 },
  noDayButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  list: { gap: 12 },
  listCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe6ee', borderRadius: 16, padding: 14, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  listCardPlanned: { borderLeftWidth: 4, borderLeftColor: '#00A8A8' },
  listDate: { width: 64, alignItems: 'center', borderRightWidth: 1, borderRightColor: '#e7eef3', marginRight: 12, paddingRight: 10 },
  listDateDay: { color: '#0077CC', fontSize: 20, fontWeight: 'bold' },
  listDateMonth: { color: '#6a7d8d', textTransform: 'uppercase', fontSize: 11, fontWeight: 'bold' },
  listMain: { flex: 1, minWidth: 0 },
  listTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  listLocation: { flex: 1, minWidth: 120, color: '#164c67', fontSize: 16, fontWeight: 'bold' },
  listCountry: { color: '#6a7d8d', fontSize: 12, marginTop: 4 },
  listMeta: { color: '#7c8f9c', fontSize: 12, marginTop: 6 },
  loggedLabel: { color: '#0077CC', backgroundColor: '#e5f4fb', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, fontSize: 10, fontWeight: 'bold' },
  plannedLabel: { color: '#008d78', backgroundColor: '#e6f7f3', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, fontSize: 10, fontWeight: 'bold' },
  listChevron: { color: '#0077CC', fontSize: 22, marginLeft: 8, fontWeight: 'bold' },
  emptyCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe6ee', borderRadius: 16, alignItems: 'center', padding: 28 },
  emptyTitle: { color: '#164c67', fontSize: 18, fontWeight: 'bold' },
  emptyText: { color: '#6a7d8d', textAlign: 'center', marginTop: 7 },
  detailCard: { backgroundColor: '#fff', borderRadius: 16, borderLeftWidth: 4, borderLeftColor: '#00A8A8', padding: 18, marginTop: 18, borderWidth: 1, borderColor: '#dbe6ee', shadowColor: '#0f172a', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  detailHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  detailCopy: { flex: 1, minWidth: 0 },
  detailEyebrow: { color: '#00A8A8', textTransform: 'uppercase', fontSize: 11, fontWeight: 'bold', letterSpacing: 1 },
  detailTitle: { color: '#164c67', fontSize: 20, fontWeight: 'bold', marginTop: 4 },
  closeButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#475569', fontSize: 22, lineHeight: 22, fontWeight: 'bold' },
  detailSub: { color: '#6e8794', marginTop: 6, fontSize: 13 },
  detailMetrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  detailMetric: { color: '#0077CC', backgroundColor: '#edf8fb', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 12, fontWeight: '600' },
  detailButton: { alignSelf: 'flex-start', marginTop: 16, backgroundColor: '#0077CC', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  detailButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
});
