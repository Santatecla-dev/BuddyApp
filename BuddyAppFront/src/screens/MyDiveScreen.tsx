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

// Country name -> ISO code map (supports both English and Spanish names)
export const CountryISO: { [nombre: string]: string } = {
  "Afghanistan": "AF", "Albania": "AL", "Algeria": "DZ", "Andorra": "AD", "Angola": "AO",
  "Antigua and Barbuda": "AG", "Argentina": "AR", "Armenia": "AM", "Australia": "AU", "Austria": "AT",
  "Azerbaijan": "AZ", "Bahamas": "BS", "Bahrain": "BH", "Bangladesh": "BD", "Barbados": "BB",
  "Belarus": "BY", "Belgium": "BE", "Belize": "BZ", "Benin": "BJ", "Bhutan": "BT",
  "Bolivia": "BO", "Bosnia and Herzegovina": "BA", "Botswana": "BW", "Brazil": "BR", "Brunei": "BN",
  "Bulgaria": "BG", "Burkina Faso": "BF", "Burundi": "BI", "Cabo Verde": "CV", "Cambodia": "KH",
  "Cameroon": "CM", "Canada": "CA", "Central African Republic": "CF", "Chad": "TD", "Chile": "CL",
  "China": "CN", "Colombia": "CO", "Comoros": "KM", "Congo": "CG", "Costa Rica": "CR",
  "Croatia": "HR", "Cuba": "CU", "Cyprus": "CY", "Czech Republic": "CZ",
  "Denmark": "DK", "Djibouti": "DJ", "Dominica": "DM", "Dominican Republic": "DO", "Ecuador": "EC",
  "Egypt": "EG", "El Salvador": "SV", "Equatorial Guinea": "GQ", "Eritrea": "ER", "Estonia": "EE",
  "Eswatini": "SZ", "Ethiopia": "ET", "Fiji": "FJ", "Finland": "FI", "France": "FR",
  "Gabon": "GA", "Gambia": "GM", "Georgia": "GE", "Germany": "DE", "Ghana": "GH",
  "Greece": "GR", "Grenada": "GD", "Guatemala": "GT", "Guinea": "GN", "Guinea-Bissau": "GW",
  "Guyana": "GY", "Haiti": "HT", "Honduras": "HN", "Hungary": "HU", "Iceland": "IS",
  "India": "IN", "Indonesia": "ID", "Iran": "IR", "Iraq": "IQ", "Ireland": "IE",
  "Israel": "IL", "Italy": "IT", "Jamaica": "JM", "Japan": "JP", "Jordan": "JO",
  "Kazakhstan": "KZ", "Kenya": "KE", "Kiribati": "KI", "Kuwait": "KW", "Kyrgyzstan": "KG",
  "Laos": "LA", "Latvia": "LV", "Lebanon": "LB", "Lesotho": "LS", "Liberia": "LR",
  "Libya": "LY", "Liechtenstein": "LI", "Lithuania": "LT", "Luxembourg": "LU", "Madagascar": "MG",
  "Malawi": "MW", "Malaysia": "MY", "Maldives": "MV", "Mali": "ML", "Malta": "MT",
  "Marshall Islands": "MH", "Mauritania": "MR", "Mauritius": "MU", "Mexico": "MX",
  "Micronesia": "FM", "Moldova": "MD", "Monaco": "MC", "Mongolia": "MN",
  "Montenegro": "ME", "Morocco": "MA", "Mozambique": "MZ", "Myanmar": "MM", "Namibia": "NA",
  "Nauru": "NR", "Nepal": "NP", "Netherlands": "NL", "New Zealand": "NZ", "Nicaragua": "NI",
  "Niger": "NE", "Nigeria": "NG", "North Korea": "KP", "North Macedonia": "MK", "Norway": "NO",
  "Oman": "OM", "Pakistan": "PK", "Palau": "PW", "Panama": "PA", "Papua New Guinea": "PG",
  "Paraguay": "PY", "Peru": "PE", "Philippines": "PH", "Poland": "PL", "Portugal": "PT",
  "Qatar": "QA", "Romania": "RO", "Russia": "RU", "Rwanda": "RW",
  "Saint Kitts and Nevis": "KN", "Saint Lucia": "LC", "Saint Vincent and the Grenadines": "VC",
  "Samoa": "WS", "San Marino": "SM", "Sao Tome and Principe": "ST", "Saudi Arabia": "SA",
  "Senegal": "SN", "Serbia": "RS", "Seychelles": "SC", "Sierra Leone": "SL", "Singapore": "SG",
  "Slovakia": "SK", "Slovenia": "SI", "Solomon Islands": "SB", "Somalia": "SO", "South Africa": "ZA",
  "South Sudan": "SS", "Spain": "ES", "Sri Lanka": "LK", "Sudan": "SD", "Suriname": "SR",
  "Sweden": "SE", "Switzerland": "CH", "Syria": "SY", "Tajikistan": "TJ", "Thailand": "TH",
  "Timor-Leste": "TL", "Togo": "TG", "Tonga": "TO", "Trinidad and Tobago": "TT", "Tunisia": "TN",
  "Turkey": "TR", "Turkmenistan": "TM", "Tuvalu": "TV", "Uganda": "UG", "Ukraine": "UA",
  "United Arab Emirates": "AE", "United Kingdom": "GB", "Tanzania": "TZ",
  "United States": "US", "Uruguay": "UY", "Uzbekistan": "UZ", "Vanuatu": "VU",
  "Venezuela": "VE", "Vietnam": "VN", "Yemen": "YE", "Zambia": "ZM", "Zimbabwe": "ZW", "Taiwan": "TW",

  // Spanish names backwards compatibility
  "Afganistán": "AF", "Argelia": "DZ", "Azerbaiyán": "AZ", "Baréin": "BH", "Bangladés": "BD",
  "Bielorrusia": "BY", "Bélgica": "BE", "Belice": "BZ", "Benín": "BJ", "Bután": "BT",
  "Botsuana": "BW", "Brasil": "BR", "Brunéi": "BN", "Camboya": "KH",
  "Camerún": "CM", "Canadá": "CA", "República Centroafricana": "CF", "Chipre": "CY", "República Checa": "CZ",
  "Dinamarca": "DK", "Yibuti": "DJ", "República Dominicana": "DO", "Egipto": "EG", "Guinea Ecuatorial": "GQ",
  "Etiopía": "ET", "Fiyi": "FJ", "Finlandia": "FI", "Francia": "FR",
  "Gabón": "GA", "Alemania": "DE", "Grecia": "GR", "Guinea-Bisáu": "GW", "Haití": "HT",
  "Hungría": "HU", "Islandia": "IS", "Irán": "IR", "Irak": "IQ", "Irlanda": "IE",
  "Japón": "JP", "Jordania": "JO", "Kazajistán": "KZ", "Kenia": "KE", "Kirguistán": "KG",
  "Letonia": "LV", "Líbano": "LB", "Lituania": "LT",
  "Luxemburgo": "LU", "Malaui": "MW", "Malasia": "MY", "Maldivas": "MV", "Malí": "ML",
  "Islas Marshall": "MH", "Mauricio": "MU", "México": "MX", "Estados Federados de Micronesia": "FM",
  "Moldavia": "MD", "Mónaco": "MC", "Marruecos": "MA", "Birmania": "MM", "Países Bajos": "NL",
  "Nueva Zelanda": "NZ", "Níger": "NE", "Corea del Norte": "KP", "Macedonia del Norte": "MK",
  "Noruega": "NO", "Omán": "OM", "Pakistán": "PK", "Palaos": "PW", "Panamá": "PA",
  "Papúa Nueva Guinea": "PG", "Perú": "PE", "Filipinas": "PH", "Polonia": "PL", "Catar": "QA",
  "Rumanía": "RO", "Federación Rusa": "RU", "Ruanda": "RW", "Santo Tomé y Príncipe": "ST",
  "Arabia Saudita": "SA", "Eslovaquia": "SK", "Eslovenia": "SI", "Islas Salomón": "SB",
  "Sudáfrica": "ZA", "Sudán del Sur": "SS", "España": "ES", "Sudán": "SD", "Surinam": "SR",
  "Suecia": "SE", "Suiza": "CH", "Siria": "SY", "Tayikistán": "TJ", "Tailandia": "TH",
  "Trinidad y Tobago": "TT", "Túnez": "TN", "Turquía": "TR", "Turkmenistán": "TM",
  "Ucrania": "UA", "República Unida de Tanzania": "TZ",
  "Estados Unidos de América": "US", "Uzbekistán": "UZ", "Zimbabue": "ZW", "Taiwán": "TW"
};

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
            Diver ID: {diverId ?? '—'}
          </Text>

          <Text style={styles.subInfoText}>
            Dives logged: {dives.length}
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

      <View style={styles.primaryActions}>
        <TouchableOpacity accessibilityRole="button"
          style={styles.mainButton}
          onPress={() => navigation.navigate('CreateDive')}
        >
          <Text style={styles.buttonText}>Create new dive</Text>
        </TouchableOpacity>

        <TouchableOpacity accessibilityRole="button"
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('Invitations')}
        >
          <Text style={styles.buttonText}>Pending invitations</Text>

          {hasPendingInvites && (
            <View style={styles.pendingIcon}>
              <Text style={styles.pendingText}>!</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.actionGrid}>

      <TouchableOpacity accessibilityRole="button"
        style={[styles.groupButton, styles.actionGridButton]}
        accessibilityState={{ expanded: groupedByCountry }}
        onPress={() => setGroupedByCountry(value => !value)}
      >
        <Text style={styles.groupButtonText}>
          {groupedByCountry
            ? 'Show ungrouped'
            : 'Group by country'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        accessibilityRole="button"
        style={[styles.statsButton, styles.actionGridButton]}
        onPress={() => navigation.navigate('DiveStats')}
      >
        <Text style={styles.statsButtonText}>View dive statistics</Text>
      </TouchableOpacity>

      <TouchableOpacity
        accessibilityRole="button"
        style={[styles.planButton, styles.actionGridButton]}
        onPress={() => navigation.navigate('PlanDive')}
      >
        <Text style={styles.planButtonText}>Plan a new dive</Text>
      </TouchableOpacity>

      <TouchableOpacity
        accessibilityRole="button"
        style={[styles.plannedButton, styles.actionGridButton]}
        onPress={() => navigation.navigate('PlannedDives')}
      >
        <Text style={styles.plannedButtonText}>View planned dives</Text>
      </TouchableOpacity>

      <TouchableOpacity
        accessibilityRole="button"
        style={[styles.tripButton, styles.actionGridButton]}
        onPress={() => navigation.navigate('DiveTrips')}
      >
        <Text style={styles.tripButtonText}>Organize a dive trip</Text>
      </TouchableOpacity>

      <TouchableOpacity
        accessibilityRole="button"
        style={[styles.mapButton, styles.actionGridButton]}
        onPress={() => navigation.navigate('DiveMap')}
      >
        <Text style={styles.mapButtonText}>Explore dive map</Text>
      </TouchableOpacity>

      <TouchableOpacity
        accessibilityRole="button"
        style={[styles.statsButton, styles.actionGridButton]}
        onPress={() => navigation.navigate('DiveActivity')}
      >
        <Text style={styles.statsButtonText}>Open dive activity</Text>
      </TouchableOpacity>

      <TouchableOpacity
        accessibilityRole="button"
        style={[styles.statsButton, styles.actionGridButton]}
        onPress={() => navigation.navigate('Achievements')}
      >
        <Text style={styles.statsButtonText}>View achievements</Text>
      </TouchableOpacity>

      <TouchableOpacity
        accessibilityRole="button"
        style={[styles.statsButton, styles.actionGridButton]}
        onPress={() => navigation.navigate('ActivityFeed')}
      >
        <Text style={styles.statsButtonText}>Open buddy activity</Text>
      </TouchableOpacity>

      <TouchableOpacity
        accessibilityRole="button"
        style={[styles.pokedexButton, styles.actionGridButton]}
        onPress={() => navigation.navigate('Pokedex')}
      >
        <Text style={styles.pokedexButtonText}>Open marine Pokedex</Text>
      </TouchableOpacity>

      </View>


        {loadError ? <View><Text accessibilityRole="alert" style={styles.statusText}>{loadError}</Text><TouchableOpacity accessibilityRole="button" style={styles.groupButton} onPress={fetchDives}><Text style={styles.groupButtonText}>Retry</Text></TouchableOpacity></View> : null}
      </>}
      ListEmptyComponent={loading ? <ActivityIndicator accessibilityLabel="Loading dives" color="#0077CC" /> : !loadError ? <Text style={styles.statusText}>You have no logged dives yet. Create your first dive!</Text> : null}
      renderSectionHeader={({ section }) => section.title ? (
        <View style={styles.groupHeaderRow}>
          <Text accessibilityRole="header" style={styles.groupHeader}>{section.title}</Text>
          {CountryISO[section.title] && <CountryFlag isoCode={CountryISO[section.title]} size={18} style={styles.flag} />}
        </View>
      ) : null}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <TouchableOpacity accessibilityRole="button" style={styles.diveContent} onPress={() => navigation.navigate('DiveDetail', { diveId: item.id })}>
            <Text style={styles.country}>{item.country}</Text>
            <Text style={styles.title}>{item.location} – {new Date(item.date).toLocaleDateString()}</Text>
            <Text style={styles.mutedDetails}>Max depth: {item.maxDepth} m</Text>
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

  primaryActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 14,
  },

  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },

  actionGridButton: {
    flexGrow: 1,
    flexBasis: 260,
    minWidth: 190,
    minHeight: 48,
    justifyContent: 'center',
    alignSelf: 'stretch',
    marginTop: 0,
    marginBottom: 0,
  },

  mainButton: {
    flex: 1,
    minWidth: 220,
    backgroundColor: '#0077CC',
    padding: 15,
    borderRadius: 30,
    alignItems: 'center',
    marginBottom: 0,
    elevation: 5,
  },

  secondaryButton: {
    flex: 1,
    minWidth: 220,
    backgroundColor: '#00A8A8',
    padding: 15,
    borderRadius: 30,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 0,
    elevation: 5,
  },

  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },

  pendingIcon: {
    backgroundColor: '#DC3545',
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
    fontSize: 12,
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
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#0077CC',
    borderRadius: 20,
    marginBottom: 10,
    marginTop: 15,
    elevation: 3,
  },

  groupButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },

  statsButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#00A8A8',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },

  statsButtonText: {
    color: '#00A8A8',
    fontWeight: 'bold',
  },

  planButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#0077CC',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    backgroundColor: '#eaf6fc',
  },

  planButtonText: {
    color: '#0077CC',
    fontWeight: 'bold',
  },

  plannedButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#00A8A8',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    backgroundColor: '#e8faf7',
  },

  plannedButtonText: {
    color: '#008d8d',
    fontWeight: 'bold',
  },

  tripButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#7c6ac7',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    backgroundColor: '#f2efff',
  },

  tripButtonText: {
    color: '#5d4ab0',
    fontWeight: 'bold',
  },

  mapButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#b8d8ee',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    backgroundColor: '#fff',
  },

  mapButtonText: {
    color: '#0077CC',
    fontWeight: 'bold',
  },

  pokedexButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#00A8A8',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    backgroundColor: '#e8faf7',
  },

  pokedexButtonText: {
    color: '#008d8d',
    fontWeight: 'bold',
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
    color: '#00A8A8',
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
