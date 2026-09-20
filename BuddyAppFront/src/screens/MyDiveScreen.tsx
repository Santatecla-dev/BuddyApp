import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  SectionList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import API from '../api/api';
import { Dive } from '../types';
import CountryFlag from 'react-native-country-flag';

import { CountryISO, countryLabel } from '../utils/countries';

type FavoriteBuddy = {
  userId: number;
  name: string;
  dives: number;
};

export default function MyDivesScreen({ navigation, route }: any) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [dives, setDives] = useState<Dive[]>([]);
  const [groupedByCountry, setGroupedByCountry] = useState(false);
  const [hasPendingInvites, setHasPendingInvites] = useState(false);
  const [diverId, setDiverId] = useState<number | null>(null);
  const [favoriteBuddy, setFavoriteBuddy] = useState<FavoriteBuddy | null>(null);

  const fetchDives = async () => {
    try {
      const res = await API.get('/dives/my');
      setDives(res.data);
      setLoadError('');
    } catch (err) {
      setLoadError('Could not load dives.');
    } finally {
      setLoading(false);
    }
  };

  const computeFavoriteBuddy = async (dives: Dive[], isActive: () => boolean) => {
    const buddyCount: Record<number, { name: string; count: number }> = {};

    let next = 0;
    const worker = async () => {
    while (next < dives.length && isActive()) {
      const dive = dives[next++];
      try {
        const res = await API.get(`/dives/${dive.id}/buddies`);
        const buddies = res.data;

        buddies.forEach((b: any) => {
          if (b.userId === diverId) return;

          if (!buddyCount[b.userId]) {
            buddyCount[b.userId] = {
              name: b.name,
              count: 1,
            };
          } else {
            buddyCount[b.userId].count += 1;
          }
        });
      } catch {}
    }
    };
    await Promise.all(Array.from({ length: Math.min(4, dives.length) }, worker));

    let topBuddy: FavoriteBuddy | null = null;

    Object.entries(buddyCount).forEach(([userId, data]) => {
      if (!topBuddy || data.count > topBuddy.dives) {
        topBuddy = {
          userId: Number(userId),
          name: data.name,
          dives: data.count,
        };
      }
    });

    if (isActive()) setFavoriteBuddy(topBuddy);
  };

  const fetchPendingInvites = async () => {
    try {
      const res = await API.get('/dives/invites/pending');
      setHasPendingInvites(res.data.length > 0);
    } catch (err) {
      setHasPendingInvites(false);
    }
  };

  useEffect(() => {
    fetchDives();
    fetchPendingInvites();

    try {
      const authHeader = API.defaults.headers.common['Authorization'];

      if (typeof authHeader === 'string') {
        const token = authHeader.split(' ')[1];

        if (token) {
          const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
          setDiverId(payload.userId);
        }
      }
    } catch (err) {}

    const unsubscribe = navigation.addListener('focus', () => {
      fetchDives();
      fetchPendingInvites();
    });

    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    if (route.params?.removeDiveId) {
      setDives(prev =>
        prev.filter(d => d.id !== route.params.removeDiveId)
      );

      navigation.setParams({
        removeDiveId: undefined,
      });
    }
  }, [route.params?.removeDiveId]);

  const sections = useMemo(() => {
    if (!groupedByCountry) return dives.length ? [{ title: '', data: dives }] : [];
    const groups: { [country: string]: Dive[] } = {};

    dives.forEach(d => {
      if (!groups[d.country]) {
        groups[d.country] = [];
      }

      groups[d.country].push(d);
    });

    return Object.entries(groups).map(([title, data]) => ({ title, data }));
  }, [dives, groupedByCountry]);

  useEffect(() => {
    let active = true;
    setFavoriteBuddy(null);
    if (diverId && dives.length > 0) {
      computeFavoriteBuddy(dives, () => active);
    }
    return () => { active = false; };
  }, [diverId, dives]);

  return (
    <SectionList
      style={styles.container}
      contentContainerStyle={styles.webContentContainer}
      sections={sections}
      keyExtractor={item => item.id.toString()}
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={<>
      <View style={styles.topInfo}>
        <View style={styles.topInfoText}>
          <Text style={styles.infoText}>
            DiverID: {diverId ?? '—'}
          </Text>

          <Text style={styles.subInfoText}>
            Dives: {dives.length}
          </Text>
        </View>

        <TouchableOpacity accessibilityRole="button"
          style={styles.profileButton}
          accessibilityLabel="My profile"
          onPress={() => navigation.navigate('Profile', { userId: undefined })}
        >
          <Text style={styles.profileIcon}>👤</Text>
        </TouchableOpacity>
      </View>

      {favoriteBuddy && (
        <TouchableOpacity accessibilityRole="button"
          style={styles.favoriteBuddyCard}
          activeOpacity={0.8}
          onPress={() =>
            navigation.navigate('Profile', {
              userId: favoriteBuddy.userId,
            })
          }
        >
          <Text style={styles.favoriteTitle}>
            🤿 Favorite buddy
          </Text>

          <Text style={styles.favoriteName}>
            {favoriteBuddy.name}
          </Text>

          <Text style={styles.favoriteCount}>
            {favoriteBuddy.dives} dives together
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity accessibilityRole="button"
        style={styles.mainButton}
        onPress={() => navigation.navigate('CreateDive')}
      >
        <Text style={styles.buttonText}>
          Log a new dive
        </Text>
      </TouchableOpacity>

      <TouchableOpacity accessibilityRole="button"
        style={styles.secondaryButton}
        onPress={() => navigation.navigate('Invitations')}
      >
        <Text style={styles.buttonText}>
          Pending invitations
        </Text>

        {hasPendingInvites && (
          <View style={styles.pendingIcon}>
            <Text style={styles.pendingText}>!</Text>
          </View>
        )}
      </TouchableOpacity>

      <TouchableOpacity accessibilityRole="button"
        style={styles.groupButton}
        accessibilityState={{ expanded: groupedByCountry }}
        onPress={() => setGroupedByCountry(value => !value)}
      >
        <Text style={styles.groupButtonText}>
          {groupedByCountry
            ? 'Show all dives'
            : 'Group by country'}
        </Text>
      </TouchableOpacity>


        {loadError ? <View><Text accessibilityRole="alert" style={styles.statusText}>{loadError}</Text><TouchableOpacity accessibilityRole="button" style={styles.groupButton} onPress={fetchDives}><Text style={styles.groupButtonText}>Retry</Text></TouchableOpacity></View> : null}
      </>}
      ListEmptyComponent={loading ? <ActivityIndicator accessibilityLabel="Loading dives" color="#0077CC" /> : !loadError ? <Text style={styles.statusText}>No dives yet. Log your first dive.</Text> : null}
      renderSectionHeader={({ section }) => section.title ? (
        <View style={styles.groupHeaderRow}>
          <Text accessibilityRole="header" style={styles.groupHeader}>{countryLabel(section.title)}</Text>
          {CountryISO[section.title] && <CountryFlag isoCode={CountryISO[section.title]} size={18} style={styles.flag} />}
        </View>
      ) : null}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <TouchableOpacity accessibilityRole="button" style={styles.diveContent} onPress={() => navigation.navigate('DiveDetail', { diveId: item.id })}>
            <Text style={styles.country}>{countryLabel(item.country)}</Text>
            <Text style={styles.title}>{item.location} – {new Date(item.date).toLocaleDateString('en-GB')}</Text>
            <Text style={styles.mutedDetails}>Depth: {item.maxDepth} m</Text>
            <Text style={styles.mutedDetails}>Duration: {item.duration} min</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Share dive at ${item.location}`} style={styles.shareButton} onPress={() => navigation.navigate('InviteBuddy', { diveId: item.id })}>
            <Text style={styles.shareButtonText}>Share</Text>
          </TouchableOpacity>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f9fc',
  },

  webContentContainer: {
    width: '100%',
    maxWidth: 1050,
    alignSelf: 'center',
    padding: 20,
    paddingBottom: 40,
  },

  topInfo: {
    backgroundColor: '#f2f8ff',
    padding: 15,
    borderRadius: 15,
    marginBottom: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 72,
  },

  topInfoText: {
    flex: 1,
  },

  subInfoText: {
    fontSize: 14,
    color: '#0077CC',
    marginTop: 4,
  },

  infoText: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#0077CC',
  },

  mainButton: {
    backgroundColor: '#0077CC',
    padding: 15,
    borderRadius: 30,
    alignItems: 'center',
    marginBottom: 15,
    elevation: 5,
    // @ts-ignore
    cursor: 'pointer',
  },

  secondaryButton: {
    backgroundColor: '#007F83',
    padding: 15,
    borderRadius: 30,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    elevation: 5,
  },

  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },

  pendingIcon: {
    backgroundColor: 'red',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },

  pendingText: {
    color: 'white',
    fontWeight: 'bold',
  },

  card: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
    // @ts-ignore
    userSelect: 'none',
  },

  diveContent: {
    flex: 1,
  },

  country: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0077CC',
    marginBottom: 4,
  },

  groupButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#0077CC',
    borderRadius: 20,
    marginBottom: 10,
    marginTop: 15,
    elevation: 3,
    // @ts-ignore
    cursor: 'pointer',
  },

  groupButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },

  title: {
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 5,
  },

  mutedDetails: {
    fontSize: 14,
    color: '#555',
    marginBottom: 2,
  },

  statusText: { color: '#555', fontSize: 16, paddingVertical: 16 },

  shareButton: {
    minHeight: 48,
    justifyContent: 'center',
    marginTop: 10,
    backgroundColor: '#eee',
    padding: 10,
    borderRadius: 20,
    alignItems: 'center',
  },

  shareButtonText: {
    fontWeight: 'bold',
    color: '#0077CC',
  },

  profileButton: {
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 48,
    minHeight: 48,
  },

  profileIcon: {
    fontSize: 26,
  },

  groupHeader: {
    flexShrink: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0077CC',
  },

  groupHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 4,
  },

  flag: {
    marginLeft: 8,
  },

  countryGroup: {
    marginBottom: 20,
  },

  favoriteBuddyCard: {
    backgroundColor: 'white',
    padding: 18,
    borderRadius: 18,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },

  favoriteTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#007F83',
    marginBottom: 6,
  },

  favoriteName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0077CC',
  },

  favoriteCount: {
    fontSize: 14,
    color: '#555',
    marginTop: 2,
  },
});
