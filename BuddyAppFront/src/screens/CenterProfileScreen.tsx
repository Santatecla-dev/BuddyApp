import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Svg, { Circle } from 'react-native-svg';
import { useFocusEffect } from '@react-navigation/native';
import API from '../api/api';
import { CenterProfile } from '../types';
import { COUNTRIES } from './CreateDiveScreen';

type Form = {
  name: string;
  legalName: string;
  taxId: string;
  contactName: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  postalCode: string;
  city: string;
  country: string;
  timezone: string;
  description: string;
  openingHours: string;
  instagram: string;
  facebook: string;
};

const emptyForm: Form = {
  name: '',
  legalName: '',
  taxId: '',
  contactName: '',
  email: '',
  phone: '',
  website: '',
  address: '',
  postalCode: '',
  city: '',
  country: '',
  timezone: '',
  description: '',
  openingHours: '',
  instagram: '',
  facebook: '',
};

const toForm = (center: CenterProfile['center']): Form => ({
  name: center.name || '',
  legalName: center.legalName || '',
  taxId: center.taxId || '',
  contactName: center.contactName || '',
  email: center.email || '',
  phone: center.phone || '',
  website: center.website || '',
  address: center.address || '',
  postalCode: center.postalCode || '',
  city: center.city || '',
  country: center.country || '',
  timezone: center.timezone || '',
  description: center.description || '',
  openingHours: center.openingHours || '',
  instagram: center.instagram || '',
  facebook: center.facebook || '',
});

export default function CenterProfileScreen() {
  const { width } = useWindowDimensions();
  const [profile, setProfile] = useState<CenterProfile | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const isNarrow = width < 768;
  const isMobile = width < 480;

  const set = (key: keyof Form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await API.get<CenterProfile>('/center/profile');
      setProfile(response.data);
      setForm(toForm(response.data.center));
    } catch (err: any) {
      const rawMsg = err?.response?.data?.message || err?.message;
      setError(
        typeof rawMsg === 'string'
          ? rawMsg
          : Array.isArray(rawMsg)
          ? rawMsg.join(', ')
          : 'Could not load the center profile. Please check your connection and try again.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const save = async () => {
    setSaving(true);
    setError('');
    setNotice('');

    const trimmedName = form.name.trim();
    if (!trimmedName) {
      setError('Please enter a center name.');
      setSaving(false);
      return;
    }
    if (trimmedName.length < 2) {
      setError('Center name must be at least 2 characters.');
      setSaving(false);
      return;
    }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError('Please provide a valid email address.');
      setSaving(false);
      return;
    }

    try {
      const payload = {
        name: trimmedName,
        legalName: form.legalName.trim() || undefined,
        taxId: form.taxId.trim() || undefined,
        contactName: form.contactName.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        website: form.website.trim() || undefined,
        address: form.address.trim() || undefined,
        postalCode: form.postalCode.trim() || undefined,
        city: form.city.trim() || undefined,
        country: form.country.trim() || undefined,
        timezone: form.timezone.trim() || undefined,
        description: form.description.trim() || undefined,
        openingHours: form.openingHours.trim() || undefined,
        instagram: form.instagram.trim() || undefined,
        facebook: form.facebook.trim() || undefined,
      };

      const response = await API.patch('/center/profile', payload);
      setForm(toForm(response.data));
      setProfile((current) =>
        current ? { ...current, center: response.data, updatedAt: response.data.updatedAt } : current
      );
      setNotice('Profile saved successfully.');
    } catch (err: any) {
      const respData = err?.response?.data;
      let userMsg = 'Could not save profile. Please check your inputs and try again.';
      if (respData) {
        if (typeof respData.message === 'string') {
          userMsg = respData.message;
        } else if (Array.isArray(respData.message)) {
          userMsg = respData.message.join(', ');
        } else if (typeof respData.error === 'string') {
          userMsg = respData.error;
        }
      } else if (err?.message) {
        userMsg = err.message;
      }
      setError(userMsg);
    } finally {
      setSaving(false);
    }
  };

  const statCards: [string, number, string][] = useMemo(() => {
    if (!profile) return [];
    return [
      ['loggedDives', profile.stats.loggedDives, 'Logged dives'],
      ['plannedDives', profile.stats.plannedDives, 'Upcoming dives'],
      ['clients', profile.stats.clients, 'Diver clients'],
      ['inventoryUnits', profile.stats.inventoryUnits, 'Inventory units'],
      ['availableUnits', profile.stats.availableUnits, 'Available units'],
      ['assetTypes', profile.stats.assetTypes, 'Asset types'],
    ];
  }, [profile]);

  const chartMax = useMemo(() => {
    if (!statCards.length) return 1;
    const values = statCards.map(([, val]) => Number(val));
    return Math.max(1, ...values);
  }, [statCards]);

  const pieData = useMemo(() => {
    if (!profile) return [];
    const available = profile.stats.availableUnits;
    const inUse = Math.max(0, profile.stats.inventoryUnits - profile.stats.availableUnits);
    return [
      { label: 'Available', value: available, color: '#0b777b' },
      { label: 'In use', value: inUse, color: '#123b52' },
    ];
  }, [profile]);

  const pieTotal = useMemo(() => {
    if (!profile) return 0;
    return profile.stats.inventoryUnits;
  }, [profile]);

  const pieRadius = 42;
  const pieCircumference = 2 * Math.PI * pieRadius;

  const checklist = useMemo(() => {
    if (!profile) return [];
    return [
      { label: 'Center name', complete: !!form.name.trim() },
      { label: 'Public description', complete: !!form.description.trim() },
      { label: 'Legal company name', complete: !!form.legalName.trim() },
      { label: 'Tax or registration ID', complete: !!form.taxId.trim() },
      { label: 'Primary contact', complete: !!form.contactName.trim() },
      { label: 'Email address', complete: !!form.email.trim() },
      { label: 'Phone number', complete: !!form.phone.trim() },
      { label: 'Street address', complete: !!form.address.trim() },
      { label: 'City and country', complete: !!form.city.trim() && !!form.country },
      { label: 'Postal code', complete: !!form.postalCode.trim() },
      { label: 'Timezone', complete: !!form.timezone.trim() },
      { label: 'Opening hours', complete: !!form.openingHours.trim() },
      { label: 'Website', complete: !!form.website.trim() },
      { label: 'Social channels', complete: !!form.instagram.trim() || !!form.facebook.trim() },
      { label: 'Inventory started', complete: profile.stats.assetTypes > 0 },
      { label: 'First dive planned', complete: profile.stats.plannedDives > 0 },
      { label: 'First dive logged', complete: profile.stats.loggedDives > 0 },
      { label: 'First diver client', complete: profile.stats.clients > 0 },
    ];
  }, [form, profile]);

  if (loading && !profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#123b52" />
        <Text style={styles.loading}>Loading center profile…</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.center}>
        <Text accessibilityRole="alert" style={styles.errorText}>
          {error || 'Could not load center profile.'}
        </Text>
        <TouchableOpacity accessibilityRole="button" style={styles.retry} onPress={load}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  let accumulatedPercent = 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Hero Header */}
      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>CENTER ADMINISTRATION</Text>
          <Text style={styles.title}>{form.name || 'Dive center profile'}</Text>
          <Text style={styles.subtitle}>
            Keep the public identity, legal details and operating information your divers need in one place.
          </Text>
        </View>
        <View style={styles.status}>
          <View
            style={[styles.statusDot, profile.center.verified ? styles.statusDotVerified : styles.statusDotPending]}
          />
          <Text style={styles.statusText}>{profile.center.verified ? 'Verified center' : 'Verification pending'}</Text>
        </View>
      </View>

      {/* Top Stat Cards */}
      <View style={styles.stats}>
        {statCards.map(([key, value, label]) => (
          <View style={[styles.stat, isNarrow && styles.statNarrow, isMobile && styles.statMobile]} key={String(key)}>
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Insight Section: Operations Chart, Inventory Mix, Profile Readiness */}
      <View style={styles.insightGrid}>
        {/* Operations at a glance */}
        <View style={styles.chartSection}>
          <View style={styles.sectionHeading}>
            <View style={styles.sectionHeadingCopy}>
              <Text style={styles.sectionTitle}>Operations at a glance</Text>
              <Text style={styles.sectionHint}>Current center activity and capacity.</Text>
            </View>
            <Text style={styles.chartLegend}>LIVE</Text>
          </View>
          <View style={styles.chart}>
            {statCards.map(([key, value, label]) => {
              const numVal = Number(value);
              const heightPercent = chartMax > 0 && numVal > 0 ? Math.min(100, Math.max(6, (numVal / chartMax) * 100)) : 0;
              return (
                <View style={styles.barItem} key={`bar-${String(key)}`}>
                  <View style={styles.barTrack}>
                    <View style={[styles.bar, { height: `${heightPercent}%` }]} />
                  </View>
                  <Text style={styles.barValue}>{value}</Text>
                  <Text numberOfLines={2} style={styles.barLabel}>
                    {label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Inventory Mix */}
        <View style={styles.pieSection}>
          <View style={styles.sectionHeading}>
            <View style={styles.sectionHeadingCopy}>
              <Text style={styles.sectionTitle}>Inventory mix</Text>
              <Text style={styles.sectionHint}>Capacity split by current state.</Text>
            </View>
            <Text style={styles.chartLegend}>PIE</Text>
          </View>
          <View style={styles.pieWrap}>
            <Svg width="132" height="132" viewBox="0 0 100 100">
              <Circle cx="50" cy="50" r={pieRadius} fill="none" stroke="#edf3f4" strokeWidth="16" />
              {pieTotal > 0 &&
                pieData.map((slice) => {
                  if (slice.value <= 0) return null;
                  const strokeLength = (slice.value / pieTotal) * pieCircumference;
                  const dashOffset = -accumulatedPercent * pieCircumference;
                  accumulatedPercent += slice.value / pieTotal;

                  return (
                    <Circle
                      key={slice.label}
                      cx="50"
                      cy="50"
                      r={pieRadius}
                      fill="none"
                      stroke={slice.color}
                      strokeWidth="16"
                      strokeDasharray={`${strokeLength} ${pieCircumference}`}
                      strokeDashoffset={dashOffset}
                      rotation="-90"
                      origin="50, 50"
                    />
                  );
                })}
            </Svg>
            <View style={styles.pieCenter}>
              <Text style={styles.pieCenterValue}>{profile.stats.inventoryUnits}</Text>
              <Text style={styles.pieCenterLabel}>units</Text>
            </View>
          </View>
          <View style={styles.pieLegend}>
            {pieData.map((slice) => (
              <View style={styles.pieLegendRow} key={`legend-${slice.label}`}>
                <View style={[styles.pieSwatch, { backgroundColor: slice.color }]} />
                <Text style={styles.pieLegendText}>{slice.label}</Text>
                <Text style={styles.pieLegendValue}>{slice.value}</Text>
              </View>
            ))}
            <View style={styles.pieLegendRow} key="legend-asset-types">
              <View style={[styles.pieSwatch, { backgroundColor: '#b98222' }]} />
              <Text style={styles.pieLegendText}>Asset types</Text>
              <Text style={styles.pieLegendValue}>{profile.stats.assetTypes}</Text>
            </View>
          </View>
        </View>

        {/* Profile Readiness Checklist */}
        <View style={styles.checklistSection}>
          <View style={styles.sectionHeading}>
            <View style={styles.sectionHeadingCopy}>
              <Text style={styles.sectionTitle}>Profile readiness</Text>
              <Text style={styles.sectionHint}>Complete the essentials before publishing your center widely.</Text>
            </View>
          </View>
          <View style={styles.checklistScroll}>
            {checklist.map((item) => (
              <View style={styles.checkItem} key={item.label}>
                <View style={[styles.checkIcon, item.complete && styles.checkIconDone]}>
                  <Text style={[styles.checkIconText, item.complete && styles.checkIconTextDone]}>
                    {item.complete ? '✓' : '•'}
                  </Text>
                </View>
                <Text style={[styles.checkLabel, item.complete && styles.checkLabelDone]}>{item.label}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.checkProgress}>
            {checklist.filter((item) => item.complete).length}/{checklist.length} essentials complete
          </Text>
        </View>
      </View>

      {/* Top Diver Clients */}
      <View style={styles.section}>
        <View style={styles.sectionHeading}>
          <View style={styles.sectionHeadingCopy}>
            <Text style={styles.sectionTitle}>Top diver clients</Text>
            <Text style={styles.sectionHint}>The ten buddies with the most logged dives at this center.</Text>
          </View>
          <Text style={styles.chartLegend}>TOP 10</Text>
        </View>
        {profile.clientRanking.length ? (
          profile.clientRanking.map((client, index) => (
            <View style={styles.rankingRow} key={client.id}>
              <Text style={styles.rank}>{index + 1}</Text>
              <View style={styles.rankAvatar}>
                <Text style={styles.rankAvatarText}>{client.name.slice(0, 1).toUpperCase()}</Text>
              </View>
              <View style={styles.rankCopy}>
                <Text style={styles.rankName} numberOfLines={1}>
                  {client.name}
                </Text>
                <Text style={styles.rankEmail} numberOfLines={1}>
                  {client.email}
                </Text>
              </View>
              <Text style={styles.rankValue}>
                {client.dives} dive{client.dives === 1 ? '' : 's'}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyRanking}>No linked diver activity yet.</Text>
        )}
      </View>

      {/* Feedback Messages */}
      {error ? (
        <View style={styles.errorAlert} accessibilityRole="alert">
          <Text style={styles.errorAlertText}>{error}</Text>
        </View>
      ) : null}
      {notice ? (
        <View style={styles.noticeAlert} accessibilityRole="alert" accessibilityLiveRegion="polite">
          <Text style={styles.noticeAlertText}>{notice}</Text>
        </View>
      ) : null}

      {/* Form Section: Public Identity */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Public identity</Text>
        <Text style={styles.sectionHint}>This information can be shown when divers search for your center.</Text>

        <Text style={styles.label}>Center name *</Text>
        <TextInput
          accessibilityLabel="Center name"
          value={form.name}
          onChangeText={(value) => set('name', value)}
          style={styles.input}
          placeholder="e.g. North Reef Dive Center"
          placeholderTextColor="#8fa4b0"
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          accessibilityLabel="Center description"
          multiline
          value={form.description}
          onChangeText={(value) => set('description', value)}
          style={[styles.input, styles.multiline]}
          placeholder="What makes your center special?"
          placeholderTextColor="#8fa4b0"
        />
      </View>

      {/* Form Section: Company and Contact */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Company and contact</Text>
        <Text style={styles.sectionHint}>Official center registration and direct customer contacts.</Text>

        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={styles.label}>Legal company name</Text>
            <TextInput
              accessibilityLabel="Legal company name"
              value={form.legalName}
              onChangeText={(value) => set('legalName', value)}
              style={styles.input}
              placeholder="e.g. North Reef Marine Operations LLC"
              placeholderTextColor="#8fa4b0"
            />
          </View>
          <View style={styles.half}>
            <Text style={styles.label}>Tax / registration ID</Text>
            <TextInput
              accessibilityLabel="Tax registration ID"
              value={form.taxId}
              onChangeText={(value) => set('taxId', value)}
              style={styles.input}
              placeholder="e.g. B-12345678"
              placeholderTextColor="#8fa4b0"
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={styles.label}>Primary contact</Text>
            <TextInput
              accessibilityLabel="Primary contact"
              value={form.contactName}
              onChangeText={(value) => set('contactName', value)}
              style={styles.input}
              placeholder="e.g. Alex Ocean"
              placeholderTextColor="#8fa4b0"
            />
          </View>
          <View style={styles.half}>
            <Text style={styles.label}>Account email</Text>
            <TextInput
              accessibilityLabel="Center email"
              keyboardType="email-address"
              autoCapitalize="none"
              value={form.email}
              onChangeText={(value) => set('email', value)}
              style={styles.input}
              placeholder="operations@divecenter.test"
              placeholderTextColor="#8fa4b0"
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={styles.label}>Phone</Text>
            <TextInput
              accessibilityLabel="Center phone"
              keyboardType="phone-pad"
              value={form.phone}
              onChangeText={(value) => set('phone', value)}
              style={styles.input}
              placeholder="+34 600 123 456"
              placeholderTextColor="#8fa4b0"
            />
          </View>
          <View style={styles.half}>
            <Text style={styles.label}>Website</Text>
            <TextInput
              accessibilityLabel="Center website"
              autoCapitalize="none"
              value={form.website}
              onChangeText={(value) => set('website', value)}
              style={styles.input}
              placeholder="https://www.yourcenter.com"
              placeholderTextColor="#8fa4b0"
            />
          </View>
        </View>
      </View>

      {/* Form Section: Location and Operations */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Location and operations</Text>
        <Text style={styles.sectionHint}>Physical center premises and standard operating schedule.</Text>

        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={styles.label}>Address</Text>
            <TextInput
              accessibilityLabel="Center address"
              value={form.address}
              onChangeText={(value) => set('address', value)}
              style={styles.input}
              placeholder="Harbour Road, Pier 4"
              placeholderTextColor="#8fa4b0"
            />
          </View>
          <View style={styles.half}>
            <Text style={styles.label}>Postal code</Text>
            <TextInput
              accessibilityLabel="Postal code"
              value={form.postalCode}
              onChangeText={(value) => set('postalCode', value)}
              style={styles.input}
              placeholder="08039"
              placeholderTextColor="#8fa4b0"
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={styles.label}>City</Text>
            <TextInput
              accessibilityLabel="Center city"
              value={form.city}
              onChangeText={(value) => set('city', value)}
              style={styles.input}
              placeholder="Barcelona"
              placeholderTextColor="#8fa4b0"
            />
          </View>
          <View style={styles.half}>
            <Text style={styles.label}>Country</Text>
            <View style={styles.pickerWrap}>
              <Picker
                accessibilityLabel="Center country"
                selectedValue={form.country}
                onValueChange={(value) => set('country', String(value))}
                style={styles.picker}
              >
                <Picker.Item label="Select country" value="" />
                {COUNTRIES.map((country) => (
                  <Picker.Item key={country} label={country} value={country} />
                ))}
              </Picker>
            </View>
          </View>
        </View>

        <Text style={styles.label}>Timezone</Text>
        <TextInput
          accessibilityLabel="Center timezone"
          value={form.timezone}
          onChangeText={(value) => set('timezone', value)}
          style={styles.input}
          placeholder="Europe/Madrid"
          placeholderTextColor="#8fa4b0"
        />

        <Text style={styles.label}>Opening hours and booking notes</Text>
        <TextInput
          accessibilityLabel="Opening hours"
          multiline
          value={form.openingHours}
          onChangeText={(value) => set('openingHours', value)}
          style={[styles.input, styles.multiline]}
          placeholder="Mon–Sat, 08:00–18:00…"
          placeholderTextColor="#8fa4b0"
        />
      </View>

      {/* Form Section: Online Presence */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Online presence</Text>
        <Text style={styles.sectionHint}>Social profiles to help divers connect with your staff and events.</Text>

        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={styles.label}>Instagram</Text>
            <TextInput
              accessibilityLabel="Instagram profile"
              autoCapitalize="none"
              value={form.instagram}
              onChangeText={(value) => set('instagram', value)}
              style={styles.input}
              placeholder="@yourcenter"
              placeholderTextColor="#8fa4b0"
            />
          </View>
          <View style={styles.half}>
            <Text style={styles.label}>Facebook</Text>
            <TextInput
              accessibilityLabel="Facebook profile"
              autoCapitalize="none"
              value={form.facebook}
              onChangeText={(value) => set('facebook', value)}
              style={styles.input}
              placeholder="facebook.com/yourcenter"
              placeholderTextColor="#8fa4b0"
            />
          </View>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.updated}>
          Last updated {profile.updatedAt ? new Date(profile.updatedAt).toLocaleDateString() : 'recently'}
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          disabled={saving}
          style={[styles.save, saving && styles.disabled]}
          onPress={save}
        >
          {saving ? <ActivityIndicator size="small" color="#fff" style={styles.saveSpinner} /> : null}
          <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save profile'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f3f6f8',
  },
  content: {
    width: '100%',
    maxWidth: 1050,
    alignSelf: 'center',
    padding: 20,
    paddingBottom: 60,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loading: {
    color: '#536b7a',
    marginTop: 12,
    fontSize: 14,
  },
  errorText: {
    color: '#b42318',
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
  retry: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#123b52',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  retryText: {
    color: '#123b52',
    fontWeight: 'bold',
  },

  /* Hero */
  hero: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    backgroundColor: '#e1ebee',
    borderWidth: 1,
    borderColor: '#b9cdd3',
    borderRadius: 22,
    padding: 24,
  },
  heroCopy: {
    flex: 1,
    minWidth: 250,
  },
  eyebrow: {
    color: '#0b777b',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1.2,
  },
  title: {
    color: '#123b52',
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 5,
  },
  subtitle: {
    color: '#536b7a',
    lineHeight: 21,
    marginTop: 7,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginRight: 7,
  },
  statusDotVerified: {
    backgroundColor: '#176b5d',
  },
  statusDotPending: {
    backgroundColor: '#b98222',
  },
  statusText: {
    color: '#123b52',
    fontSize: 12,
    fontWeight: 'bold',
  },

  /* Stats row */
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  stat: {
    flex: 1,
    minWidth: 145,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccdbe0',
    borderRadius: 15,
    padding: 14,
  },
  statNarrow: {
    flexBasis: '47%',
    minWidth: 140,
  },
  statMobile: {
    flexBasis: '100%',
    minWidth: 0,
  },
  statValue: {
    color: '#123b52',
    fontSize: 22,
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#718394',
    fontSize: 11,
    marginTop: 4,
  },

  /* Sections general */
  section: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccdbe0',
    borderRadius: 17,
    padding: 18,
    marginTop: 16,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },
  sectionHeadingCopy: {
    flex: 1,
  },
  sectionTitle: {
    color: '#123b52',
    fontSize: 18,
    fontWeight: 'bold',
  },
  sectionHint: {
    color: '#718394',
    fontSize: 12,
    marginTop: 4,
  },
  chartLegend: {
    color: '#0b777b',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },

  /* Insight Grid */
  insightGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 16,
  },
  chartSection: {
    flex: 2,
    minWidth: 300,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccdbe0',
    borderRadius: 17,
    padding: 18,
  },
  pieSection: {
    flex: 1,
    minWidth: 260,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccdbe0',
    borderRadius: 17,
    padding: 18,
  },
  checklistSection: {
    flex: 1,
    minWidth: 280,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccdbe0',
    borderRadius: 17,
    padding: 18,
  },

  /* Operations Bar Chart */
  chart: {
    height: 180,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 6,
    marginTop: 12,
    paddingTop: 8,
  },
  barItem: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    minWidth: 32,
  },
  barTrack: {
    height: '74%',
    width: '100%',
    maxWidth: 42,
    justifyContent: 'flex-end',
    backgroundColor: '#edf3f4',
    borderRadius: 8,
    overflow: 'hidden',
  },
  bar: {
    width: '100%',
    backgroundColor: '#123b52',
    borderRadius: 8,
  },
  barValue: {
    color: '#123b52',
    fontWeight: 'bold',
    fontSize: 12,
    marginTop: 5,
  },
  barLabel: {
    color: '#718394',
    fontSize: 9,
    textAlign: 'center',
    marginTop: 3,
  },

  /* Inventory Pie Chart */
  pieWrap: {
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginTop: 4,
  },
  pieCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pieCenterValue: {
    color: '#123b52',
    fontSize: 24,
    fontWeight: 'bold',
  },
  pieCenterLabel: {
    color: '#718394',
    fontSize: 10,
    fontWeight: '600',
  },
  pieLegend: {
    gap: 6,
    marginTop: 12,
  },
  pieLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 22,
  },
  pieSwatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  pieLegendText: {
    color: '#536b7a',
    flex: 1,
    fontSize: 12,
  },
  pieLegendValue: {
    color: '#123b52',
    fontWeight: 'bold',
    fontSize: 12,
  },

  /* Profile Readiness Checklist */
  checklistScroll: {
    maxHeight: 220,
    marginTop: 4,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#edf2f3',
    paddingVertical: 9,
  },
  checkIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#edf3f4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIconDone: {
    backgroundColor: '#e4f2ee',
  },
  checkIconText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: 'bold',
  },
  checkIconTextDone: {
    color: '#0b777b',
    fontSize: 12,
    fontWeight: 'bold',
  },
  checkLabel: {
    color: '#536b7a',
    flex: 1,
    fontSize: 12,
  },
  checkLabelDone: {
    color: '#123b52',
    fontWeight: '600',
  },
  checkProgress: {
    color: '#0b777b',
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 12,
  },

  /* Top Diver Clients */
  rankingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#edf2f3',
    paddingVertical: 12,
  },
  rank: {
    width: 24,
    color: '#718394',
    fontWeight: 'bold',
    fontSize: 13,
    textAlign: 'center',
  },
  rankAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#dfecef',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankAvatarText: {
    color: '#123b52',
    fontWeight: 'bold',
    fontSize: 14,
  },
  rankCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 10,
  },
  rankName: {
    color: '#123b52',
    fontWeight: 'bold',
    fontSize: 13,
  },
  rankEmail: {
    color: '#718394',
    fontSize: 11,
    marginTop: 2,
  },
  rankValue: {
    color: '#0b777b',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  emptyRanking: {
    color: '#718394',
    marginTop: 12,
    fontSize: 13,
  },

  /* Alerts */
  errorAlert: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
  },
  errorAlertText: {
    color: '#b42318',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  noticeAlert: {
    backgroundColor: '#e4f2ee',
    borderWidth: 1,
    borderColor: '#b2ddd4',
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
  },
  noticeAlertText: {
    color: '#176b5d',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },

  /* Form controls */
  label: {
    color: '#123b52',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 14,
    marginBottom: 6,
  },
  input: {
    minHeight: 45,
    borderWidth: 1,
    borderColor: '#aabfc7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#263f4d',
    backgroundColor: '#fff',
    fontSize: 13,
  },
  multiline: {
    minHeight: 84,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  half: {
    flex: 1,
    minWidth: 0,
    flexBasis: 220,
  },
  pickerWrap: {
    borderWidth: 1,
    borderColor: '#aabfc7',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  picker: {
    height: 45,
    color: '#263f4d',
  },

  /* Footer */
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 20,
  },
  updated: {
    color: '#718394',
    fontSize: 12,
  },
  save: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#123b52',
    borderRadius: 22,
    paddingHorizontal: 24,
    paddingVertical: 13,
    minWidth: 140,
  },
  saveSpinner: {
    marginRight: 8,
  },
  saveText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  disabled: {
    opacity: 0.6,
  },
});
