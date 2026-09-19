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

// Mapa de país -> código ISO
export const CountryISO: { [nombre: string]: string } = {
  "Afganistán": "AF", "Albania": "AL", "Argelia": "DZ", "Andorra": "AD", "Angola": "AO",
  "Antigua y Barbuda": "AG", "Argentina": "AR", "Armenia": "AM", "Australia": "AU", "Austria": "AT",
  "Azerbaiyán": "AZ", "Bahamas": "BS", "Baréin": "BH", "Bangladés": "BD", "Barbados": "BB",
  "Bielorrusia": "BY", "Bélgica": "BE", "Belice": "BZ", "Benín": "BJ", "Bután": "BT",
  "Bolivia": "BO", "Bosnia y Herzegovina": "BA", "Botsuana": "BW", "Brasil": "BR", "Brunéi": "BN",
  "Bulgaria": "BG", "Burkina Faso": "BF", "Burundi": "BI", "Cabo Verde": "CV", "Camboya": "KH",
  "Camerún": "CM", "Canadá": "CA", "República Centroafricana": "CF", "Chad": "TD", "Chile": "CL",
  "China": "CN", "Colombia": "CO", "Comoras": "KM", "Congo": "CG", "Costa de Marfil": "CI",
  "Costa Rica": "CR", "Croacia": "HR", "Cuba": "CU", "Chipre": "CY", "República Checa": "CZ",
  "Dinamarca": "DK", "Yibuti": "DJ", "Dominica": "DM", "República Dominicana": "DO", "Ecuador": "EC",
  "Egipto": "EG", "El Salvador": "SV", "Guinea Ecuatorial": "GQ", "Eritrea": "ER", "Estonia": "EE",
  "Esuatini": "SZ", "Etiopía": "ET", "Fiyi": "FJ", "Finlandia": "FI", "Francia": "FR",
  "Gabón": "GA", "Gambia": "GM", "Georgia": "GE", "Alemania": "DE", "Ghana": "GH",
  "Grecia": "GR", "Granada": "GD", "Guatemala": "GT", "Guinea": "GN", "Guinea-Bisáu": "GW",
  "Guyana": "GY", "Haití": "HT", "Honduras": "HN", "Hungría": "HU", "Islandia": "IS",
  "India": "IN", "Indonesia": "ID", "Irán": "IR", "Irak": "IQ", "Irlanda": "IE",
  "Israel": "IL", "Italia": "IT", "Jamaica": "JM", "Japón": "JP", "Jordania": "JO",
  "Kazajistán": "KZ", "Kenia": "KE", "Kiribati": "KI", "Kuwait": "KW", "Kirguistán": "KG",
  "Laos": "LA", "Letonia": "LV", "Líbano": "LB", "Lesoto": "LS", "Liberia": "LR",
  "Libia": "LY", "Liechtenstein": "LI", "Lituania": "LT", "Luxemburgo": "LU", "Madagascar": "MG",
  "Malaui": "MW", "Malasia": "MY", "Maldivas": "MV", "Malí": "ML", "Malta": "MT",
  "Islas Marshall": "MH", "Mauritania": "MR", "Mauricio": "MU", "México": "MX",
  "Estados Federados de Micronesia": "FM", "Moldavia": "MD", "Mónaco": "MC", "Mongolia": "MN",
  "Montenegro": "ME", "Marruecos": "MA", "Mozambique": "MZ", "Birmania": "MM", "Namibia": "NA",
  "Nauru": "NR", "Nepal": "NP", "Países Bajos": "NL", "Nueva Zelanda": "NZ", "Nicaragua": "NI",
  "Níger": "NE", "Nigeria": "NG", "Corea del Norte": "KP", "Macedonia del Norte": "MK", "Noruega": "NO",
  "Omán": "OM", "Pakistán": "PK", "Palaos": "PW", "Panamá": "PA", "Papúa Nueva Guinea": "PG",
  "Paraguay": "PY", "Perú": "PE", "Filipinas": "PH", "Polonia": "PL", "Portugal": "PT",
  "Catar": "QA", "Rumanía": "RO", "Federación Rusa": "RU", "Ruanda": "RW",
  "San Cristóbal y Nieves": "KN", "Santa Lucía": "LC", "San Vicente y las Granadinas": "VC",
  "Samoa": "WS", "San Marino": "SM", "Santo Tomé y Príncipe": "ST", "Arabia Saudita": "SA",
  "Senegal": "SN", "Serbia": "RS", "Seychelles": "SC", "Sierra Leona": "SL", "Singapur": "SG",
  "Eslovaquia": "SK", "Eslovenia": "SI", "Islas Salomón": "SB", "Somalia": "SO", "Sudáfrica": "ZA",
  "Sudán del Sur": "SS", "España": "ES", "Sri Lanka": "LK", "Sudán": "SD", "Surinam": "SR",
  "Suecia": "SE", "Suiza": "CH", "Siria": "SY", "Tayikistán": "TJ", "Tailandia": "TH",
  "Timor-Leste": "TL", "Togo": "TG", "Tonga": "TO", "Trinidad y Tobago": "TT", "Túnez": "TN",
  "Turquía": "TR", "Turkmenistán": "TM", "Tuvalu": "TV", "Uganda": "UG", "Ucrania": "UA",
  "Emiratos Árabes Unidos": "AE", "Reino Unido": "GB", "República Unida de Tanzania": "TZ",
  "Estados Unidos de América": "US", "Uruguay": "UY", "Uzbekistán": "UZ", "Vanuatu": "VU",
  "Venezuela": "VE", "Vietnam": "VN", "Yemen": "YE", "Zambia": "ZM", "Zimbabue": "ZW", "Taiwán": "TW"
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
      setLoadError('No se pudieron cargar las inmersiones.');
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
            Inmersiones: {dives.length}
          </Text>
        </View>

        <TouchableOpacity accessibilityRole="button"
          style={styles.profileButton}
          accessibilityLabel="Mi perfil"
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
            🤿 Buddy favorito
          </Text>

          <Text style={styles.favoriteName}>
            {favoriteBuddy.name}
          </Text>

          <Text style={styles.favoriteCount}>
            {favoriteBuddy.dives} inmersiones juntos
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity accessibilityRole="button"
        style={styles.mainButton}
        onPress={() => navigation.navigate('CreateDive')}
      >
        <Text style={styles.buttonText}>
          Crear nueva inmersión
        </Text>
      </TouchableOpacity>

      <TouchableOpacity accessibilityRole="button"
        style={styles.secondaryButton}
        onPress={() => navigation.navigate('Invitations')}
      >
        <Text style={styles.buttonText}>
          Invitaciones pendientes
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
            ? 'Mostrar sin agrupar'
            : 'Agrupar por país'}
        </Text>
      </TouchableOpacity>


        {loadError ? <View><Text accessibilityRole="alert" style={styles.statusText}>{loadError}</Text><TouchableOpacity accessibilityRole="button" style={styles.groupButton} onPress={fetchDives}><Text style={styles.groupButtonText}>Reintentar</Text></TouchableOpacity></View> : null}
      </>}
      ListEmptyComponent={loading ? <ActivityIndicator accessibilityLabel="Cargando inmersiones" color="#0077CC" /> : !loadError ? <Text style={styles.statusText}>Todavía no tienes inmersiones. Crea tu primera inmersión.</Text> : null}
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
            <Text style={styles.mutedDetails}>Profundidad: {item.maxDepth} m</Text>
            <Text style={styles.mutedDetails}>Duración: {item.duration} min</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Compartir inmersión en ${item.location}`} style={styles.shareButton} onPress={() => navigation.navigate('InviteBuddy', { diveId: item.id })}>
            <Text style={styles.shareButtonText}>Compartir</Text>
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
    backgroundColor: '#00A8A8',
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
