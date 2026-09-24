import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Svg, { Circle } from 'react-native-svg';
import { useFocusEffect, useNavigation, usePreventRemove } from '@react-navigation/native';
import API from '../api/api';
import { CenterProfile } from '../types';
import { COUNTRIES } from './CreateDiveScreen';

const fields = {
  name: { label: 'Center name', max: 120 },
  description: { label: 'Center description', max: 1600 },
  legalName: { label: 'Legal company name', max: 180 },
  taxId: { label: 'Tax registration ID', max: 40 },
  contactName: { label: 'Primary contact', max: 120 },
  email: { label: 'Center email', max: 254 },
  phone: { label: 'Center phone', max: 40 },
  website: { label: 'Center website', max: 240 },
  address: { label: 'Center address', max: 120 },
  postalCode: { label: 'Postal code', max: 20 },
  city: { label: 'Center city', max: 100 },
  country: { label: 'Center country', max: 100 },
  timezone: { label: 'Center timezone', max: 80 },
  openingHours: { label: 'Opening hours', max: 1200 },
  instagram: { label: 'Instagram profile', max: 120 },
  facebook: { label: 'Facebook profile', max: 120 },
};
type Field = keyof typeof fields;
type Form = Record<Field, string>;
const keys = Object.keys(fields) as Field[];
const toForm = (center: Partial<CenterProfile['center']>): Form =>
  Object.fromEntries(keys.map(key => [key, center[key] || ''])) as Form;
type FieldErrors = Partial<Record<Field, string>>;

function validate(form: Form): FieldErrors {
  const errors: FieldErrors = {};
  keys.forEach(key => {
    if (form[key].length > fields[key].max) errors[key] = `Use at most ${fields[key].max} characters.`;
  });
  if (form.name.length < 2) errors.name = 'Enter a center name with at least 2 characters.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Enter a valid contact email address.';
  if (!COUNTRIES.includes(form.country)) errors.country = 'Select a country.';
  return errors;
}

function requestError(err: any, fallback: string) {
  const status = err?.response?.status;
  if (status === 401) return 'Your session has expired. Sign in again to continue.';
  if (status === 403) return 'Your account does not have permission to update this center.';
  if (status === 400 || status === 422) {
    const message = err?.response?.data?.message;
    const messages = (Array.isArray(message) ? message : [message]).filter((value): value is string => typeof value === 'string');
    if (messages.length) return messages.join(' ');
  }
  return fallback;
}

export default function CenterProfileScreen() {
  const [profile, setProfile] = useState<CenterProfile | null>(null);
  const [form, setForm] = useState<Form>(() => toForm({}));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [expanded, setExpanded] = useState(false);
  const [retry, setRetry] = useState(0);
  const savedForm = useRef<Form>(toForm({}));
  const draft = useRef(form);
  const savingRef = useRef(false);
  const mounted = useRef(true);
  const inputs = useRef<Partial<Record<Field, TextInput | null>>>({});
  const countryPicker = useRef<Picker<string>>(null);
  const scroll = useRef<ScrollView>(null);
  const sectionOffsets = useRef<Record<string, number>>({});
  const { width } = useWindowDimensions();
  const narrow = width < 600;
  const navigation = useNavigation();
  const dirty = keys.some(key => form[key] !== savedForm.current[key]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  usePreventRemove(dirty || saving, ({ data }) => {
    if (savingRef.current) {
      if (Platform.OS === 'web') window.alert('Please wait for the profile save to finish.');
      else Alert.alert('Saving profile', 'Please wait for the save to finish.');
      return;
    }
    const leave = () => navigation.dispatch(data.action);
    if (Platform.OS === 'web') {
      if (window.confirm('Discard your unsaved profile changes?')) leave();
    } else {
      Alert.alert('Discard changes?', 'Your profile has unsaved changes.', [
        { text: 'Keep editing', style: 'cancel' }, { text: 'Discard', style: 'destructive', onPress: leave },
      ]);
    }
  });
  useEffect(() => {
    if (Platform.OS !== 'web' || (!dirty && !saving)) return;
    const preventUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', preventUnload);
    return () => window.removeEventListener('beforeunload', preventUnload);
  }, [dirty, saving]);

  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError('');
    API.get<CenterProfile>('/center/profile', { signal: controller.signal }).then(({ data }) => {
      if (controller.signal.aborted) return;
      setProfile(data);
      // Refresh statistics on return without replacing an unfinished draft.
      if (!keys.some(key => draft.current[key] !== savedForm.current[key]) && !savingRef.current) {
        const next = toForm(data.center);
        savedForm.current = next;
        draft.current = next;
        setForm(next);
      }
    }).catch(err => {
      if (!controller.signal.aborted) setLoadError(requestError(err, 'Could not load the center profile. Please retry.'));
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [retry]));

  const set = (key: Field, value: string) => {
    if (savingRef.current) return;
    const next = { ...draft.current, [key]: value };
    draft.current = next;
    setForm(next);
    setNotice('');
    setError('');
    setFieldErrors(current => ({ ...current, [key]: undefined }));
  };
  const save = async () => {
    if (savingRef.current || loading) return;
    setError('');
    setNotice('');
    const payload = Object.fromEntries(keys.map(key => [key, draft.current[key].trim()])) as Form;
    const errors = validate(payload);
    setFieldErrors(errors);
    const first = keys.find(key => errors[key]);
    if (first) {
      setError('Please correct the highlighted fields before saving.');
      const section = ['name', 'description'].includes(first) ? 'identity'
        : ['legalName', 'taxId', 'contactName', 'email', 'phone', 'website'].includes(first) ? 'company'
        : ['instagram', 'facebook'].includes(first) ? 'online' : 'location';
      scroll.current?.scrollTo({ y: Math.max(0, (sectionOffsets.current[section] || 0) - 20), animated: false });
      if (first === 'country') countryPicker.current?.focus();
      else inputs.current[first]?.focus();
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      const { data } = await API.patch<CenterProfile['center'] & { updatedAt: string }>('/center/profile', payload);
      if (!mounted.current) return;
      const next = toForm(data);
      savedForm.current = next;
      draft.current = next;
      setForm(next);
      setProfile(current => current ? { ...current, center: data, updatedAt: data.updatedAt } : current);
      setNotice('Profile saved successfully.');
    } catch (err) {
      if (mounted.current) setError(requestError(err, 'Could not save the profile. Your changes are still here. Please try again.'));
    } finally {
      savingRef.current = false;
      if (mounted.current) setSaving(false);
    }
  };

  const field = (key: Field, section: string, label = fields[key].label, multiline = false, placeholder?: string) => (
    <View key={key} style={[styles.field, (section === 'company' || section === 'online' || ['address', 'postalCode', 'city', 'country'].includes(key)) && { flexGrow: 1, flexBasis: narrow ? '100%' : '45%' }]}>
      <Text nativeID={`label-${key}`} style={styles.label}>{label}{['name', 'email', 'country'].includes(key) ? ' *' : ''}</Text>
      {key === 'country' ? <View style={[styles.pickerWrap, fieldErrors[key] && styles.invalid]}>
        <Picker ref={countryPicker} accessibilityLabel={fields[key].label} accessibilityHint={fieldErrors[key]} enabled={!saving} selectedValue={form.country}
          onValueChange={value => set('country', String(value))} style={styles.picker}>
          <Picker.Item label="Select country" value="" />
          {COUNTRIES.map(country => <Picker.Item key={country} label={country} value={country} />)}
        </Picker>
      </View> : <TextInput ref={input => { inputs.current[key] = input; }}
        accessibilityLabel={fields[key].label} accessibilityHint={fieldErrors[key]}
        aria-invalid={!!fieldErrors[key]} aria-describedby={fieldErrors[key] ? `error-${key}` : undefined}
        editable={!saving} value={form[key]} onChangeText={value => set(key, value)}
        multiline={multiline} placeholder={placeholder}
        keyboardType={key === 'email' ? 'email-address' : key === 'phone' ? 'phone-pad' : key === 'website' ? 'url' : 'default'}
        autoCapitalize={['email', 'website', 'instagram', 'facebook'].includes(key) ? 'none' : 'sentences'}
        style={[styles.input, multiline && styles.multiline, fieldErrors[key] && styles.invalid]} />}
      {fieldErrors[key] ? <Text nativeID={`error-${key}`} accessibilityRole="alert" style={styles.fieldError}>{fieldErrors[key]}</Text> : null}
    </View>
  );
  const sectionLayout = (name: string) => (event: any) => { sectionOffsets.current[name] = event.nativeEvent.layout.y; };

  if (loading && !profile) return <View style={styles.center}><ActivityIndicator accessibilityLabel="Loading center profile" color="#123b52" /><Text style={styles.hint}>Loading center profile…</Text></View>;
  if (!profile) return <View style={styles.center}><Text accessibilityRole="alert" style={styles.error}>{loadError}</Text><TouchableOpacity accessibilityRole="button" style={styles.secondaryButton} onPress={() => setRetry(value => value + 1)}><Text style={styles.link}>Retry</Text></TouchableOpacity></View>;

  const statCards = [
    { label: 'Logged dives', value: profile.stats.loggedDives },
    { label: 'Upcoming dives', value: profile.stats.plannedDives },
    { label: 'Diver clients', value: profile.stats.clients },
    { label: 'Inventory units', value: profile.stats.inventoryUnits },
    { label: 'Available units', value: profile.stats.availableUnits },
    { label: 'Asset types', value: profile.stats.assetTypes },
  ];
  const chartMax = Math.max(1, ...statCards.map(stat => stat.value));
  const total = profile.stats.inventoryUnits;
  const available = Math.min(total, Math.max(0, profile.stats.availableUnits));
  // The API combines maintenance and retired units in the remainder.
  const pieData = [{ label: 'Available', value: available, color: '#0b777b' }, { label: 'Unavailable', value: total - available, color: '#123b52' }];
  const circumference = 2 * Math.PI * 42;
  const checklist = [
    { label: 'Center name', complete: form.name.trim().length >= 2 },
    ...(['description', 'legalName', 'taxId', 'contactName', 'email', 'phone', 'address'] as Field[]).map(key => ({ label: fields[key].label, complete: !!form[key].trim() })),
    { label: 'City and country', complete: !!form.city.trim() && !!form.country },
    ...(['postalCode', 'timezone', 'openingHours', 'website'] as Field[]).map(key => ({ label: fields[key].label, complete: !!form[key].trim() })),
    { label: 'Social channels', complete: !!form.instagram.trim() || !!form.facebook.trim() },
    { label: 'Inventory started', complete: profile.stats.assetTypes > 0 },
    { label: 'First dive planned', complete: profile.stats.plannedDives > 0 },
    { label: 'First dive logged', complete: profile.stats.loggedDives > 0 },
    { label: 'First diver client', complete: profile.stats.clients > 0 },
  ];
  const updated = new Date(profile.updatedAt);
  return <ScrollView ref={scroll} style={styles.screen} contentContainerStyle={[styles.content, narrow && styles.contentNarrow]} keyboardShouldPersistTaps="handled">
    <View style={[styles.hero, narrow && styles.heroNarrow]}>
      <View style={[styles.heroCopy, narrow && { flexBasis: 'auto' }]}><Text style={styles.eyebrow}>CENTER ADMINISTRATION</Text><Text accessibilityRole="header" style={styles.title}>{form.name || 'Dive center profile'}</Text><Text style={styles.subtitle}>Keep the public identity, legal details and operating information your divers need in one place.</Text></View>
      <View style={styles.status}><View style={[styles.statusDot, { backgroundColor: profile.center.verified ? '#176b5d' : '#b98222' }]} /><Text style={styles.statusText}>{profile.center.verified ? 'Verified center' : 'Verification pending'}</Text></View>
    </View>
    {loadError ? <View><Text accessibilityRole="alert" style={styles.error}>{loadError}</Text><TouchableOpacity accessibilityRole="button" onPress={() => setRetry(value => value + 1)} style={styles.secondaryButton}><Text style={styles.link}>Retry loading</Text></TouchableOpacity></View> : null}
    <View style={styles.stats}>{statCards.map(stat => <View style={styles.stat} key={stat.label}><Text style={styles.statValue}>{stat.value}</Text><Text style={styles.hint}>{stat.label}</Text></View>)}</View>
    <View style={styles.insightGrid}>
      <View style={[styles.insightCard, styles.operations]}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Operations at a glance</Text><Text style={styles.hint}>Current center activity and capacity.</Text>
        <View style={styles.chart}>{statCards.map(stat => <View key={stat.label} accessible accessibilityLabel={`${stat.label}: ${stat.value}`} style={styles.barRow}>
          <Text style={styles.barLabel}>{stat.label}</Text><View style={styles.barTrack}><View testID={`bar-${stat.label.replace(/ /g, '-')}`} style={[styles.bar, { width: `${(stat.value / chartMax) * 100}%` }]} /></View><Text style={styles.barValue}>{stat.value}</Text>
        </View>)}</View>
        {statCards.every(stat => stat.value === 0) ? <Text style={styles.hint}>No activity recorded yet.</Text> : null}
      </View>
      <View style={styles.insightCard}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Inventory mix</Text><Text style={styles.hint}>Units split by availability.</Text>
        <View style={styles.pieWrap} accessible accessibilityLabel={`${total} inventory units: ${available} available, ${total - available} unavailable.`}>
          <Svg width={144} height={144} viewBox="0 0 100 100" aria-hidden>
            <Circle cx="50" cy="50" r="42" fill="none" stroke="#edf3f4" strokeWidth="16" />
            {total > 0 && pieData.map((slice, index) => slice.value > 0 ? <Circle key={slice.label} cx="50" cy="50" r="42" fill="none" stroke={slice.color} strokeWidth="16"
              strokeDasharray={`${slice.value / total * circumference} ${circumference}`}
              strokeDashoffset={-(index === 0 ? 0 : available / total * circumference)} rotation="-90" origin="50, 50" /> : null)}
          </Svg>
          <View style={styles.pieCenter}><Text style={styles.statValue}>{total}</Text><Text style={styles.hint}>units</Text></View>
        </View>
        {pieData.map(slice => <View style={styles.legendRow} key={slice.label}><View style={[styles.swatch, { backgroundColor: slice.color }]} /><Text style={styles.legendLabel}>{slice.label}</Text><Text style={styles.barValue}>{slice.value}</Text></View>)}
        <Text style={styles.hint}>{total === 0 ? 'No inventory units yet.' : 'Unavailable includes maintenance and retired units.'}</Text>
      </View>
    </View>
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>Profile readiness</Text><Text style={styles.hint}>Complete the essentials before publishing your center widely.</Text>
      <Text style={styles.progress}>{checklist.filter(item => item.complete).length}/{checklist.length} essentials complete{dirty ? ' · Includes unsaved edits' : ''}</Text>
      <View style={styles.checklist}>{(expanded ? checklist : checklist.slice(0, 4)).map(item => <View key={item.label} style={[styles.checkItem, narrow && styles.checkItemNarrow]} accessible accessibilityLabel={`${item.label}: ${item.complete ? 'complete' : 'incomplete'}`}>
        <View style={[styles.checkIcon, item.complete && styles.checkIconDone]}><Text style={styles.link}>{item.complete ? '✓' : '—'}</Text></View><Text style={styles.checkLabel}>{item.label}</Text>
      </View>)}</View>
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} style={styles.secondaryButton}><Text style={styles.link}>{expanded ? 'Show fewer items' : 'Show all 18 items'}</Text></TouchableOpacity>
    </View>
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>Top diver clients</Text><Text style={styles.hint}>The ten buddies with the most logged dives at this center.</Text>
      {profile.clientRanking.length ? profile.clientRanking.slice(0, 10).map((client, index) => <View style={styles.rankingRow} key={client.id}>
        <Text style={styles.rank}>{index + 1}</Text><View style={styles.rankAvatar}><Text style={styles.link}>{client.name.slice(0, 1).toUpperCase()}</Text></View>
        <View style={styles.rankCopy}><Text style={styles.rankName}>{client.name}</Text><Text style={styles.hint}>{client.email}</Text>{narrow ? <Text style={styles.rankValue}>{client.dives} dive{client.dives === 1 ? '' : 's'}</Text> : null}</View>
        {!narrow ? <Text style={styles.rankValue}>{client.dives} dive{client.dives === 1 ? '' : 's'}</Text> : null}
      </View>) : <Text style={styles.empty}>No linked diver activity yet.</Text>}
    </View>
    <View style={styles.section} onLayout={sectionLayout('identity')}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>Public identity</Text><Text style={styles.hint}>This information can be shown when divers search for your center. Fields marked * are required.</Text>
      {field('name', 'identity')}{field('description', 'identity', 'Description', true, 'What makes your center special?')}
    </View>
    <View style={styles.section} onLayout={sectionLayout('company')}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>Company and contact</Text>
      <View style={styles.formGrid}>{field('legalName', 'company')}{field('taxId', 'company', 'Tax / registration ID')}{field('contactName', 'company')}{field('email', 'company', 'Contact email')}{field('phone', 'company', 'Phone')}{field('website', 'company', 'Website')}</View>
    </View>
    <View style={styles.section} onLayout={sectionLayout('location')}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>Location and operations</Text>
      <View style={styles.formGrid}>{field('address', 'location', 'Address')}{field('postalCode', 'location')}{field('city', 'location', 'City')}{field('country', 'location', 'Country')}</View>
      {field('timezone', 'location', 'Timezone', false, 'Indian/Maldives')}{field('openingHours', 'location', 'Opening hours and booking notes', true, 'Mon–Sat, 08:00–18:00')}
    </View>
    <View style={styles.section} onLayout={sectionLayout('online')}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>Online presence</Text><View style={styles.formGrid}>{field('instagram', 'online', 'Instagram', false, '@yourcenter')}{field('facebook', 'online', 'Facebook')}</View>
    </View>
    <View accessibilityLiveRegion="polite">{error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}{notice ? <Text style={styles.notice}>{notice}</Text> : null}</View>
    <View style={styles.footer}><View><Text style={styles.hint}>{Number.isNaN(updated.getTime()) ? 'Last updated date unavailable' : `Last updated ${updated.toLocaleDateString()}`}</Text>{dirty ? <Text style={styles.link}>Unsaved changes</Text> : null}</View>
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: saving || loading, busy: saving }} disabled={saving || loading} style={[styles.save, (saving || loading) && styles.disabled]} onPress={save}><Text style={styles.saveText}>{saving ? 'Saving…' : 'Save profile'}</Text></TouchableOpacity>
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f3f6f8' },
  content: { width: '100%', maxWidth: 1050, alignSelf: 'center', padding: 20, paddingBottom: 60 },
  contentNarrow: { padding: 12, paddingBottom: 36 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  hero: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16, backgroundColor: '#e1ebee', borderWidth: 1, borderColor: '#b9cdd3', borderRadius: 22, padding: 24 },
  heroNarrow: { flexDirection: 'column', alignItems: 'stretch', padding: 18 },
  heroCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 400, minWidth: 0 },
  eyebrow: { color: '#0b777b', fontSize: 11, fontWeight: 'bold', letterSpacing: 1 },
  title: { color: '#123b52', fontSize: 28, fontWeight: 'bold', marginTop: 5 },
  subtitle: { color: '#536b7a', lineHeight: 21, marginTop: 7 },
  status: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 9 },
  statusDot: { width: 9, height: 9, borderRadius: 5, marginRight: 7 },
  statusText: { color: '#123b52', fontSize: 12, fontWeight: 'bold', flexShrink: 1 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  stat: { flexGrow: 1, flexBasis: 140, minWidth: 0, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccdbe0', borderRadius: 15, padding: 14 },
  statValue: { color: '#123b52', fontSize: 22, fontWeight: 'bold' },
  hint: { color: '#536b7a', fontSize: 12, lineHeight: 18, marginTop: 4 },
  section: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccdbe0', borderRadius: 17, padding: 18, marginTop: 16 },
  sectionTitle: { color: '#123b52', fontSize: 18, fontWeight: 'bold' },
  insightGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 16, alignItems: 'stretch' },
  insightCard: { flexGrow: 1, flexShrink: 1, flexBasis: 280, minWidth: 0, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccdbe0', borderRadius: 17, padding: 18 },
  operations: { flexGrow: 2, flexBasis: 420 },
  chart: { gap: 14, marginTop: 20 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel: { width: 92, color: '#536b7a', fontSize: 12 },
  barTrack: { flex: 1, minWidth: 0, height: 18, backgroundColor: '#edf3f4', borderRadius: 6, overflow: 'hidden' },
  bar: { height: '100%', backgroundColor: '#123b52', borderRadius: 6 },
  barValue: { color: '#123b52', fontWeight: 'bold', fontSize: 12, minWidth: 30, textAlign: 'right' },
  pieWrap: { height: 160, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  pieCenter: { position: 'absolute', alignItems: 'center' },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  swatch: { width: 12, height: 12, borderRadius: 2 },
  legendLabel: { flex: 1, color: '#536b7a', fontSize: 12 },
  checklist: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 20 },
  checkItem: { flexGrow: 1, flexBasis: '45%', flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: 1, borderBottomColor: '#edf2f3', paddingVertical: 10 },
  checkItemNarrow: { flexBasis: '100%' },
  checkIcon: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#edf3f4', alignItems: 'center', justifyContent: 'center' },
  checkIconDone: { backgroundColor: '#e4f2ee' },
  checkLabel: { color: '#123b52', flex: 1, fontSize: 13 },
  progress: { color: '#0b777b', fontSize: 12, fontWeight: 'bold', marginVertical: 10 },
  secondaryButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 8, marginTop: 6 },
  link: { color: '#0b777b', fontWeight: 'bold' },
  rankingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: '#edf2f3', paddingVertical: 12, marginTop: 4 },
  rank: { width: 20, color: '#536b7a', fontWeight: 'bold', textAlign: 'center' },
  rankAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#dfecef', alignItems: 'center', justifyContent: 'center' },
  rankCopy: { flex: 1, minWidth: 0 },
  rankName: { color: '#123b52', fontWeight: 'bold', lineHeight: 20 },
  rankValue: { color: '#0b777b', fontSize: 12, fontWeight: 'bold', marginTop: 4 },
  empty: { color: '#536b7a', marginTop: 16, marginBottom: 4 },
  formGrid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16 },
  field: { minWidth: 0 },
  label: { color: '#123b52', fontSize: 12, fontWeight: 'bold', marginTop: 14, marginBottom: 6 },
  input: { minHeight: 45, width: '100%', borderWidth: 1, borderColor: '#aabfc7', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: '#263f4d', backgroundColor: '#fff' },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  pickerWrap: { borderWidth: 1, borderColor: '#aabfc7', borderRadius: 10, overflow: 'hidden', backgroundColor: '#fff' },
  picker: { minHeight: 45, width: '100%', color: '#263f4d' },
  invalid: { borderColor: '#b42318' },
  fieldError: { color: '#b42318', fontSize: 12, marginTop: 6 },
  error: { color: '#b42318', backgroundColor: '#fff1f0', borderRadius: 9, padding: 12, marginTop: 12 },
  notice: { color: '#176b5d', backgroundColor: '#e4f2ee', borderRadius: 9, padding: 12, marginTop: 12 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 18 },
  save: { backgroundColor: '#123b52', borderRadius: 22, paddingHorizontal: 21, paddingVertical: 13 },
  saveText: { color: '#fff', fontWeight: 'bold' },
  disabled: { opacity: 0.6 },
});
