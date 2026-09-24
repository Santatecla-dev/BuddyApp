import React, { useCallback, useMemo, useRef, useState } from 'react';
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

type ActivityKind = 'logged' | 'planned' | 'trip';
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
  tripId?: number;
  endDate?: string;
  isTrip?: boolean;
};

const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const dateKeyFromDate = (date: Date) => {
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Date-only values represent a calendar day, not midnight UTC.
const parseDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
  ? new Date(`${value}T00:00:00`) : new Date(value);

const dateKey = (value: string) => {
  const date = parseDate(value);
  return Number.isNaN(date.getTime()) ? value.slice(0, 10) : dateKeyFromDate(date);
};

const formatDate = (value: string) => {
  const date = parseDate(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
};

const monthTitle = (value: Date) => value.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

const sameMonth = (value: string, month: Date) => {
  const date = parseDate(value);
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
  const scrollRef = useRef<ScrollView>(null);
  const requestVersion = useRef(0);
  const [contentWidth, setContentWidth] = useState(0);
  const compact = contentWidth < 600;
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
    const version = ++requestVersion.current;
    setLoading(true);
    setError('');
    try {
      const [divesResponse, plannedResponse, tripsResponse] = await Promise.all([
        API.get<Dive[]>('/dives/my'),
        API.get<PlannedDive[]>('/planned-dives'),
        API.get<DiveTrip[]>('/dive-trips'),
      ]);
      if (version !== requestVersion.current) return;
      setDives(Array.isArray(divesResponse.data) ? divesResponse.data : []);
      setPlannedDives(Array.isArray(plannedResponse.data) ? plannedResponse.data : []);
      setTrips(Array.isArray(tripsResponse.data) ? tripsResponse.data : []);
    } catch {
      if (version !== requestVersion.current) return;
      setError('We could not load your dive activity.');
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadActivity();
    return () => { requestVersion.current += 1; };
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
    ...trips.map((trip) => ({
      key: `trip-${trip.id}`,
      id: trip.id,
      kind: 'trip' as const,
      date: trip.startDate,
      dateKey: dateKey(trip.startDate),
      location: trip.name,
      country: trip.destination,
      maxDepth: Math.max(0, ...(trip.plannedDives || []).map((plan) => Number(plan.maxDepth || 0))),
      duration: (trip.plannedDives || []).reduce((total, plan) => total + Number(plan.duration || 0), 0),
      status: trip.status,
      tripName: trip.name,
      tripId: trip.id,
      endDate: trip.endDate,
    })),
  ], [dives, plannedDives, tripNames, trips]);

  const visibleActivities = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return activities
      .filter((item) => filter === 'all' || item.kind === filter)
      .filter((item) => !normalized || `${item.location} ${item.country} ${item.buddy || ''} ${item.tripName || ''}`.toLocaleLowerCase().includes(normalized))
      .sort((a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime());
  }, [activities, filter, query]);

  const monthActivities = useMemo(() => {
    const monthStart = new Date(month.getFullYear(), month.getMonth(), 1).getTime();
    const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59).getTime();
    return visibleActivities.filter((item) => {
      if (item.kind !== 'trip') return sameMonth(item.date, month);
      const start = parseDate(item.date).getTime();
      const end = parseDate(item.endDate || item.date).getTime();
      return start <= monthEnd && end >= monthStart;
    });
  }, [month, visibleActivities]);
  const byDate = useMemo(() => {
    const result: Record<string, ActivityItem[]> = {};
    visibleActivities.forEach((item) => {
      if (item.kind !== 'trip') {
        (result[item.dateKey] ||= []).push(item);
        return;
      }
      const start = parseDate(item.date);
      const end = parseDate(item.endDate || item.date);
      const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      while (cursor <= last) {
        const key = dateKeyFromDate(cursor);
        (result[key] ||= []).push({ ...item, key: `${item.key}-${key}`, date: key, dateKey: key });
        cursor.setDate(cursor.getDate() + 1);
      }
    });
    return result;
  }, [visibleActivities]);
  const monthLogged = monthActivities.filter((item) => item.kind === 'logged').length;
  const monthPlanned = monthActivities.filter((item) => item.kind === 'planned').length;
  const monthTrips = monthActivities.filter((item) => item.kind === 'trip').length;
  const maxDepth = monthActivities.reduce((max, item) => Math.max(max, item.maxDepth), 0);
  const totalMinutes = monthActivities.reduce((total, item) => total + item.duration, 0);
  const weeks = useMemo(() => getCalendarWeeks(month), [month]);
  // The day detail reuses the calendar entries, but a trip is not a logged dive.
  // Give it its own human-readable state in this compact list while preserving
  // the trip id so tapping it still opens the trip workspace.
  const selectedDayItems = selectedDay
    ? (byDate[selectedDay.key] || []).map((item) => item.tripId
      ? { ...item, kind: 'planned' as const, buddy: 'Dive trip', isTrip: true }
      : item)
    : [];

  const changeMonth = (next: Date) => {
    setMonth(next);
    setSelectedDay(null);
    setSelected(null);
  };
  const moveMonth = (amount: number) => changeMonth(new Date(month.getFullYear(), month.getMonth() + amount, 1));
  const openActivity = (item: ActivityItem) => {
    if (item.tripId) {
      navigation.navigate('DiveTripWorkspace', { tripId: item.tripId });
      return;
    }
    setSelected(item);
  };

  return (
    <View style={styles.screen} onLayout={(event) => setContentWidth(event.nativeEvent.layout.width)}>
      <ScrollView ref={scrollRef} contentContainerStyle={[styles.content, compact && styles.contentCompact]} keyboardShouldPersistTaps="handled">
        <View style={[styles.hero, compact && styles.heroCompact]}>
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
          <TextInput accessibilityLabel="Search dive activity" placeholder="Search site, country, buddy or trip" placeholderTextColor="#7890a0" value={query} onChangeText={(value) => { setQuery(value); setSelected(null); }} style={styles.searchInput} />
          <View style={styles.modeToggle}>
            <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: mode === 'calendar' }} onPress={() => setMode('calendar')} style={[styles.modeButton, mode === 'calendar' && styles.modeButtonActive]}><Text style={[styles.modeText, mode === 'calendar' && styles.modeTextActive]}>Calendar</Text></TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: mode === 'list' }} onPress={() => setMode('list')} style={[styles.modeButton, mode === 'list' && styles.modeButtonActive]}><Text style={[styles.modeText, mode === 'list' && styles.modeTextActive]}>List</Text></TouchableOpacity>
          </View>
          <View style={styles.filterRow}>
            {([['all', 'Everything'], ['logged', 'Logged'], ['planned', 'Planned'], ['trip', 'Trips']] as [ActivityFilter, string][]).map(([value, label]) => (
              <TouchableOpacity key={value} accessibilityRole="button" accessibilityState={{ selected: filter === value }} onPress={() => { setFilter(value); setSelected(null); }} style={[styles.filterChip, filter === value && styles.filterChipActive]}><Text style={[styles.filterText, filter === value && styles.filterTextActive]}>{label}</Text></TouchableOpacity>
            ))}
          </View>
        </View>

        {loading ? <ActivityIndicator accessibilityLabel="Loading dive activity" color="#0077CC" style={styles.loader} /> : null}
        {!loading && error ? <View style={styles.errorCard}><Text accessibilityRole="alert" style={styles.errorText}>{error}</Text><TouchableOpacity accessibilityRole="button" style={styles.retryButton} onPress={loadActivity}><Text style={styles.retryText}>Retry</Text></TouchableOpacity></View> : null}

        {!loading && !error && <>
          <View style={styles.summaryRow}>
            <View style={[styles.summaryCard, compact && styles.summaryCardCompact]}><Text style={styles.summaryValue}>{monthLogged}</Text><Text style={styles.summaryLabel}>Logged this month</Text></View>
            <View style={[styles.summaryCard, compact && styles.summaryCardCompact]}><Text style={styles.summaryValue}>{monthPlanned}</Text><Text style={styles.summaryLabel}>Planned this month</Text></View>
            <View style={[styles.summaryCard, compact && styles.summaryCardCompact]}><Text style={styles.summaryValue}>{monthTrips}</Text><Text style={styles.summaryLabel}>Trips this month</Text></View>
            <View style={[styles.summaryCard, compact && styles.summaryCardCompact]}><Text style={styles.summaryValue}>{maxDepth}m</Text><Text style={styles.summaryLabel}>Deepest</Text></View>
            <View style={[styles.summaryCard, compact && styles.summaryCardCompact]}><Text style={styles.summaryValue}>{Math.round(totalMinutes / 60)}h</Text><Text style={styles.summaryLabel}>Underwater time</Text></View>
          </View>

          {mode === 'calendar' ? <View style={styles.calendarCard}>
            <View style={[styles.calendarToolbar, compact && styles.calendarToolbarCompact]}>
              {compact && <Text accessibilityRole="header" style={[styles.monthTitle, styles.monthTitleCompact]}>{monthTitle(month)}</Text>}
              <TouchableOpacity accessibilityLabel="Previous month" accessibilityRole="button" style={styles.monthButton} onPress={() => moveMonth(-1)}><Text style={styles.monthButtonText}>‹</Text></TouchableOpacity>
              {!compact && <Text accessibilityRole="header" style={styles.monthTitle}>{monthTitle(month)}</Text>}
              <View style={styles.monthActions}><TouchableOpacity accessibilityRole="button" style={styles.todayButton} onPress={() => changeMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}><Text style={styles.todayText}>Today</Text></TouchableOpacity><TouchableOpacity accessibilityLabel="Next month" accessibilityRole="button" style={styles.monthButton} onPress={() => moveMonth(1)}><Text style={styles.monthButtonText}>›</Text></TouchableOpacity></View>
            </View>
            <View style={styles.weekdayRow}>{weekdayLabels.map((day) => <Text key={day} style={styles.weekday}>{day}</Text>)}</View>
            {weeks.map((week, weekIndex) => <View key={`week-${weekIndex}`} style={styles.calendarWeek}>
              {week.map(({ date, inMonth }) => {
                const key = dateKeyFromDate(date);
                const dayItems = byDate[key] || [];
                return <TouchableOpacity key={key} accessibilityRole="button" accessibilityLabel={`Show activity for ${date.toLocaleDateString()}: ${dayItems.filter(item => item.kind === 'logged').length} logged, ${dayItems.filter(item => item.kind === 'planned').length} planned, ${dayItems.filter(item => item.kind === 'trip').length} trips`} accessibilityState={{ selected: selectedDay?.key === key }} onPress={() => setSelectedDay({ key, date })} style={[styles.dayCell, !inMonth && styles.dayCellMuted, selectedDay?.key === key && styles.dayCellSelected]}>
                  <Text style={[styles.dayNumber, !inMonth && styles.dayNumberMuted]}>{date.getDate()}</Text>
                  {compact ? (['logged', 'planned', 'trip'] as ActivityKind[]).map(kind => {
                    const count = dayItems.filter(item => item.kind === kind).length;
                    return count ? <View key={kind} style={[styles.activityCount, kind === 'planned' ? styles.plannedPill : kind === 'trip' ? styles.tripPill : styles.loggedPill]}><Text style={styles.activityPillText}>{kind === 'logged' ? 'L' : kind === 'planned' ? 'P' : 'T'} {count}</Text></View> : null;
                  }) : <>
                    {dayItems.slice(0, 2).map((item) => <View key={item.key} style={[styles.activityPill, item.kind === 'planned' ? styles.plannedPill : item.kind === 'trip' ? styles.tripPill : styles.loggedPill]}><Text numberOfLines={1} style={styles.activityPillText}>{item.kind === 'trip' ? `Trip · ${item.location}` : item.location}</Text></View>)}
                    {dayItems.length > 2 ? <Text style={styles.moreText}>+{dayItems.length - 2} more</Text> : null}
                  </>}
                </TouchableOpacity>;
              })}
            </View>)}
            {selectedDay ? <View style={styles.dayDetailCard}>
              <View style={styles.dayDetailHeader}><View style={styles.detailCopy}><Text style={styles.detailEyebrow}>Selected day</Text><Text style={styles.dayDetailTitle}>{selectedDay.date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</Text></View><TouchableOpacity accessibilityLabel="Close selected day" accessibilityRole="button" style={styles.closeButton} onPress={() => setSelectedDay(null)}><Text style={styles.closeText}>×</Text></TouchableOpacity></View>
              {selectedDayItems.length ? <View style={styles.dayDetailList}>{selectedDayItems.map((item) => <TouchableOpacity key={item.key} accessibilityRole="button" style={[styles.dayActivityRow, item.kind === 'planned' && styles.dayActivityRowPlanned, item.isTrip && styles.dayActivityRowTrip]} onPress={() => openActivity(item)}><View style={styles.dayActivityCopy}><Text style={styles.dayActivityLocation}>{item.location}</Text><Text style={styles.dayActivityMeta}>{item.country} · {item.maxDepth}m · {item.duration} min</Text><Text style={[styles.dayActivityStatus, item.isTrip && styles.dayActivityStatusTrip]}>{item.isTrip ? 'Dive trip' : item.kind === 'planned' ? `Planned${item.buddy ? ` with ${item.buddy}` : ''}` : 'Logged dive'}</Text></View><Text style={styles.dayActivityArrow}>›</Text></TouchableOpacity>)}</View> : <View style={styles.noDayActivity}><Text style={styles.noDayTitle}>No matching dives for this day</Text><Text style={styles.noDayText}>There are no logged or planned dives matching the current filters.</Text><TouchableOpacity accessibilityRole="button" style={styles.noDayButton} onPress={() => navigation.navigate('PlanDive')}><Text style={styles.noDayButtonText}>Plan a dive</Text></TouchableOpacity></View>}
            </View> : null}
            <View style={styles.legend}><View style={styles.legendItem}><View style={[styles.legendDot, styles.loggedDot]} /><Text style={styles.legendText}>{compact ? 'L · Logged' : 'Logged'}</Text></View><View style={styles.legendItem}><View style={[styles.legendDot, styles.plannedDot]} /><Text style={styles.legendText}>{compact ? 'P · Planned' : 'Planned'}</Text></View><View style={styles.legendItem}><View style={[styles.legendDot, styles.tripDot]} /><Text style={styles.legendText}>{compact ? 'T · Trip' : 'Dive trip'}</Text></View></View>
          </View> : <View style={styles.list}>
            {visibleActivities.length === 0 ? <View style={styles.emptyCard}><Text style={styles.emptyTitle}>Nothing matches these filters</Text><Text style={styles.emptyText}>Try another search or switch the activity type.</Text></View> : visibleActivities.map((item) => <TouchableOpacity key={item.key} accessibilityRole="button" style={[styles.listCard, item.kind === 'planned' && styles.listCardPlanned, item.kind === 'trip' && styles.listCardTrip]} onPress={() => openActivity(item)}>
              <View style={[styles.listDate, compact && styles.listDateCompact]}><Text style={styles.listDateDay}>{parseDate(item.date).getDate()}</Text><Text style={styles.listDateMonth}>{parseDate(item.date).toLocaleDateString(undefined, { month: 'short' })}</Text></View>{item.kind === 'trip' ? <View style={styles.tripLabelOverlay}><Text style={styles.tripLabel}>DIVE TRIP</Text></View> : null}
              <View style={styles.listMain}><View style={[styles.listTitleRow, compact && styles.listTitleRowCompact]}><Text style={[styles.listLocation, compact && styles.listLocationCompact]}>{item.location}</Text><Text style={item.kind === 'planned' ? styles.plannedLabel : styles.loggedLabel}>{item.kind === 'planned' ? 'PLANNED' : 'LOGGED'}</Text></View><Text style={styles.listCountry}>{item.country} · {formatDate(item.date)}</Text><Text style={styles.listMeta}>{item.maxDepth}m max · {item.duration} min{item.buddy ? ` · ${item.buddy}` : ''}{item.tripName ? ` · ${item.tripName}` : ''}</Text></View>
              <Text style={styles.listChevron}>›</Text>
            </TouchableOpacity>)}
          </View>}

          {selected ? <View style={styles.detailCard} onLayout={(event) => scrollRef.current?.scrollTo({ y: event.nativeEvent.layout.y, animated: true })}>
            <View style={styles.detailHeader}><View style={styles.detailCopy}><Text style={styles.detailEyebrow}>{selected.kind === 'planned' ? 'Planned dive' : 'Logged dive'}</Text><Text style={styles.detailTitle}>{selected.location}</Text></View><TouchableOpacity accessibilityLabel="Close activity details" accessibilityRole="button" style={styles.closeButton} onPress={() => setSelected(null)}><Text style={styles.closeText}>×</Text></TouchableOpacity></View>
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
  contentCompact: { padding: 12, paddingBottom: 32 },
  heroCompact: { padding: 18 },
  summaryCardCompact: { flexBasis: '45%' },
  calendarToolbarCompact: { flexWrap: 'wrap' },
  monthTitleCompact: { flexBasis: '100%', flexGrow: 0, flexShrink: 0, fontSize: 18 },
  dayCellSelected: { backgroundColor: '#edf8fb', borderColor: '#0077CC', borderWidth: 1 },
  activityCount: { borderRadius: 4, alignItems: 'center', paddingVertical: 4, marginBottom: 3 },
  listTitleRowCompact: { flexDirection: 'column', alignItems: 'flex-start', gap: 6 },
  listLocationCompact: { flex: 0, width: '100%' },
  listDateCompact: { width: 40, marginRight: 10, paddingRight: 8 },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

  screen: { flex: 1, backgroundColor: '#f7f9fc' },
  content: { width: '100%', maxWidth: 1160, alignSelf: 'center', padding: 20, paddingBottom: 48 },
  hero: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16, backgroundColor: '#e7f6fb', borderWidth: 1, borderColor: '#c5e9f3', borderRadius: 22, padding: 24, marginBottom: 18, overflow: 'hidden' },
  heroCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 420, minWidth: 0 },
  eyebrow: { color: '#008080', fontSize: 11, fontWeight: 'bold', letterSpacing: 2, marginBottom: 6 },
  title: { color: '#0077CC', fontSize: 28, fontWeight: 'bold' },
  subtitle: { color: '#425466', fontSize: 15, marginTop: 8, lineHeight: 22, maxWidth: 520 },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, alignItems: 'center' },
  primaryAction: { backgroundColor: '#0077CC', borderRadius: 22, paddingHorizontal: 17, paddingVertical: 12 },
  primaryActionText: { color: '#fff', fontWeight: 'bold' },
  secondaryAction: { borderWidth: 1, borderColor: '#00A8A8', borderRadius: 22, paddingHorizontal: 15, paddingVertical: 11, backgroundColor: '#fff' },
  secondaryActionText: { color: '#008d8d', fontWeight: 'bold' },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe6ee', borderRadius: 16, padding: 14, marginBottom: 18 },
  searchInput: { flexGrow: 1, flexShrink: 1, flexBasis: 320, minWidth: 0, minHeight: 46, borderWidth: 1, borderColor: '#b8d8ee', borderRadius: 13, paddingHorizontal: 13, color: '#334155', backgroundColor: '#fff', fontSize: 15 },
  modeToggle: { flexDirection: 'row', borderRadius: 12, backgroundColor: '#e5f0f4', padding: 3 },
  modeButton: { minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 9 },
  modeButtonActive: { backgroundColor: '#fff' },
  modeText: { color: '#5b7280', fontWeight: '600' },
  modeTextActive: { color: '#0077CC' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: { minHeight: 44, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#b8d8ee', borderRadius: 22, paddingHorizontal: 12, paddingVertical: 10 },
  filterChipActive: { backgroundColor: '#0077CC', borderColor: '#0077CC' },
  filterText: { color: '#0077CC', fontWeight: 'bold', fontSize: 13, letterSpacing: -0.4 },
  filterTextActive: { color: '#fff' },
  loader: { marginTop: 32 },
  errorCard: { backgroundColor: '#fff4f3', borderWidth: 1, borderColor: '#f2c6c2', borderRadius: 16, alignItems: 'center', padding: 24 },
  errorText: { color: '#a33a33', textAlign: 'center', fontWeight: '600' },
  retryButton: { marginTop: 14, borderWidth: 1, borderColor: '#a33a33', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 9 },
  retryText: { color: '#a33a33', fontWeight: 'bold' },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 18 },
  summaryCard: { flexGrow: 1, flexBasis: 170, minWidth: 0, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e1ecf2', borderRadius: 14, padding: 14 },
  summaryValue: { color: '#0077CC', fontSize: 21, fontWeight: 'bold' },
  summaryLabel: { color: '#6a7d8d', fontSize: 11, marginTop: 4 },
  calendarCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe6ee', borderRadius: 18, padding: 10 },
  calendarToolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  monthTitle: { flex: 1, color: '#164c67', fontSize: 20, fontWeight: 'bold', textAlign: 'center' },
  monthActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  monthButton: { width: 44, height: 44, borderRadius: 11, backgroundColor: '#edf7fa', alignItems: 'center', justifyContent: 'center' },
  monthButtonText: { color: '#0077CC', fontSize: 28, lineHeight: 28 },
  todayButton: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: '#b8d8ee', borderRadius: 11, paddingHorizontal: 10, paddingVertical: 9 },
  todayText: { color: '#0077CC', fontSize: 12, fontWeight: 'bold' },
  weekdayRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e7eef3', paddingBottom: 8 },
  weekday: { flex: 1, minWidth: 0, textAlign: 'center', color: '#526a79', fontSize: 11, fontWeight: 'bold' },
  calendarWeek: { flexDirection: 'row' },
  dayCell: { flex: 1, minWidth: 0, minHeight: 100, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#e7eef3', padding: 3 },
  dayCellMuted: { backgroundColor: '#fbfcfd' },
  dayNumber: { alignSelf: 'flex-end', color: '#526a79', fontSize: 12, marginBottom: 4 },
  dayNumberMuted: { color: '#becbd2' },
  activityPill: { borderRadius: 6, paddingHorizontal: 5, paddingVertical: 5, marginBottom: 4, maxWidth: '100%' },
  loggedPill: { backgroundColor: '#e5f4fb' },
  plannedPill: { backgroundColor: '#e6f7f3' },
  tripPill: { backgroundColor: '#fff1d8' },
  activityPillText: { color: '#25627d', fontSize: 10, fontWeight: '600' },
  moreText: { color: '#0077CC', fontSize: 10, marginTop: 2 },
  dayDetailCard: { marginTop: 18, padding: 14, backgroundColor: '#f9feff', borderWidth: 1, borderColor: '#d9eaf0', borderTopWidth: 3, borderTopColor: '#00A8A8', borderRadius: 12 },
  dayDetailHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 },
  dayDetailTitle: { color: '#164c67', fontSize: 19, fontWeight: 'bold', marginTop: 3, textTransform: 'capitalize' },
  dayDetailList: { gap: 12 },
  dayActivityRow: { minHeight: 80, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 11, borderWidth: 1, borderColor: '#d9eaf0', paddingHorizontal: 13, paddingVertical: 12 },
  dayActivityRowPlanned: { borderLeftWidth: 5, borderLeftColor: '#55c6ad' },
  dayActivityRowTrip: { borderLeftWidth: 5, borderLeftColor: '#d99a3d' },
  dayActivityCopy: { flex: 1, minWidth: 0 },
  dayActivityLocation: { color: '#164c67', fontSize: 15, fontWeight: 'bold' },
  dayActivityMeta: { color: '#6a7d8d', fontSize: 12, marginTop: 4 },
  dayActivityStatus: { color: '#008d8d', fontSize: 11, marginTop: 5 },
  dayActivityStatusTrip: { color: '#b36b12' },
  dayActivityArrow: { color: '#0077CC', fontSize: 26, marginLeft: 12 },
  noDayActivity: { minHeight: 120, alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderStyle: 'dashed', borderColor: '#b8d8ee' },
  noDayTitle: { color: '#164c67', fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
  noDayText: { color: '#6a7d8d', textAlign: 'center', marginTop: 5, maxWidth: 420 },
  noDayButton: { backgroundColor: '#0077CC', borderRadius: 18, paddingHorizontal: 15, paddingVertical: 8, marginTop: 12 },
  noDayButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, paddingTop: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  loggedDot: { backgroundColor: '#56acd2' },
  plannedDot: { backgroundColor: '#55c6ad' },
  tripDot: { backgroundColor: '#d99a3d' },
  legendText: { color: '#6a7d8d', fontSize: 12 },
  list: { gap: 16 },
  listCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe6ee', borderRadius: 16, padding: 15 },
  listCardPlanned: { borderLeftWidth: 4, borderLeftColor: '#55c6ad' },
  listCardTrip: { borderLeftWidth: 4, borderLeftColor: '#d99a3d', backgroundColor: '#fffdf7', position: 'relative' },
  listDate: { width: 76, alignItems: 'center', borderRightWidth: 1, borderRightColor: '#e7eef3', marginRight: 13, paddingRight: 12 },
  listDateDay: { color: '#0077CC', fontSize: 22, fontWeight: 'bold' },
  listDateMonth: { color: '#6a7d8d', textTransform: 'uppercase', fontSize: 11, fontWeight: 'bold' },
  listMain: { flex: 1, minWidth: 0 },
  listTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  listLocation: { flex: 1, color: '#164c67', fontSize: 16, fontWeight: 'bold' },
  listCountry: { color: '#6a7d8d', fontSize: 12, marginTop: 5 },
  listMeta: { color: '#7c8f9c', fontSize: 12, marginTop: 8 },
  loggedLabel: { color: '#0077CC', backgroundColor: '#e5f4fb', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 4, fontSize: 9, fontWeight: 'bold' },
  plannedLabel: { color: '#008d78', backgroundColor: '#e6f7f3', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 4, fontSize: 9, fontWeight: 'bold' },
  tripLabel: { color: '#9a6418', backgroundColor: '#fff1d8', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 4, fontSize: 9, fontWeight: 'bold' },
  tripLabelOverlay: { position: 'absolute', top: 9, right: 42 },
  listChevron: { color: '#0077CC', fontSize: 26, marginLeft: 8 },
  emptyCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe6ee', borderRadius: 16, alignItems: 'center', padding: 28 },
  emptyTitle: { color: '#164c67', fontSize: 18, fontWeight: 'bold' },
  emptyText: { color: '#6a7d8d', textAlign: 'center', marginTop: 7 },
  detailCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe6ee', borderRadius: 17, borderLeftWidth: 5, borderLeftColor: '#00A8A8', padding: 17, marginTop: 18 },
  detailHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  detailCopy: { flex: 1, minWidth: 0 },
  detailEyebrow: { color: '#00A8A8', textTransform: 'uppercase', fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
  detailTitle: { color: '#164c67', fontSize: 21, fontWeight: 'bold', marginTop: 3 },
  closeText: { color: '#6e8794', fontSize: 26, lineHeight: 23, paddingHorizontal: 4 },
  detailSub: { color: '#6e8794', marginTop: 7 },
  detailMetrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  detailMetric: { flexShrink: 1, color: '#0077CC', backgroundColor: '#edf8fb', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 7, fontSize: 12 },
  detailButton: { alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center', marginTop: 15, backgroundColor: '#0077CC', borderRadius: 10, paddingHorizontal: 15, paddingVertical: 9 },
  detailButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
});
