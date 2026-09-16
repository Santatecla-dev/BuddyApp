import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ScrollView,
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
  const [dives, setDives] = useState<Dive[]>([]);
  const [groupedByCountry, setGroupedByCountry] = useState(false);
  const [hasPendingInvites, setHasPendingInvites] = useState(false);
  const [diverId, setDiverId] = useState<number | null>(null);
  const [favoriteBuddy, setFavoriteBuddy] = useState<FavoriteBuddy | null>(null);

  const fetchDives = async () => {
    try {
      const res = await API.get('/dives/my');
      setDives(res.data);
    } catch (err) {
      console.log(err);
    }
  };

  const computeFavoriteBuddy = async (dives: Dive[]) => {
    const buddyCount: Record<number, { name: string; count: number }> = {};

    for (const dive of dives) {
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

    setFavoriteBuddy(topBuddy);
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
          const payload = JSON.parse(atob(token.split('.')[1]));
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

  const groupedDives = () => {
    const groups: { [country: string]: Dive[] } = {};

    dives.forEach(d => {
      if (!groups[d.country]) {
        groups[d.country] = [];
      }

      groups[d.country].push(d);
    });

    return groups;
  };

  useEffect(() => {
    if (diverId && dives.length > 0) {
      computeFavoriteBuddy(dives);
    }
  }, [diverId, dives]);

  const goToProfile = (userId?: number) => {
    if (!userId || userId === diverId) {
      navigation.navigate('Profile');
    } else {
      alert('No se pueden ver los perfiles de otros divers todavía');
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.webContentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topInfo}>
        <View style={styles.topInfoText}>
          <Text style={styles.infoText}>
            DiverID: {diverId ?? '—'}
          </Text>

          <Text style={styles.subInfoText}>
            Inmersiones: {dives.length}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => goToProfile()}
        >
          <Text style={styles.profileIcon}>👤</Text>
        </TouchableOpacity>
      </View>

      {favoriteBuddy && (
        <TouchableOpacity
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

      <TouchableOpacity
        style={styles.mainButton}
        onPress={() => navigation.navigate('CreateDive')}
      >
        <Text style={styles.buttonText}>
          Crear nueva inmersión
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
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

      <TouchableOpacity
        style={styles.groupButton}
        onPress={() => setGroupedByCountry(!groupedByCountry)}
      >
        <Text style={styles.groupButtonText}>
          {groupedByCountry
            ? 'Mostrar sin agrupar'
            : 'Agrupar por país'}
        </Text>
      </TouchableOpacity>

      {groupedByCountry ? (
        Object.entries(groupedDives()).map(
          ([country, divesInCountry]) => (
            <View
              key={country}
              style={styles.countryGroup}
            >
              <View style={styles.groupHeaderRow}>
                <Text style={styles.groupHeader}>
                  {country}
                </Text>

                {CountryISO[country] && (
                  <CountryFlag
                    isoCode={CountryISO[country]}
                    size={18}
                    style={styles.flag}
                  />
                )}
              </View>

              {divesInCountry.map(item => (
                <View
                  key={item.id}
                  style={styles.card}
                >
                  <TouchableOpacity
                    style={styles.diveContent}
                    onPress={() =>
                      navigation.navigate('DiveDetail', {
                        diveId: item.id,
                      })
                    }
                  >
                    <Text style={styles.title}>
                      {item.location} –{' '}
                      {new Date(item.date).toLocaleDateString()}
                    </Text>

                    <Text style={styles.mutedDetails}>
                      Profundidad: {item.maxDepth}m
                    </Text>

                    <Text style={styles.mutedDetails}>
                      Duración: {item.duration} min
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.shareButton}
                    onPress={() =>
                      navigation.navigate('InviteBuddy', {
                        diveId: item.id,
                      })
                    }
                  >
                    <Text style={styles.shareButtonText}>
                      Compartir
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )
        )
      ) : (
        <FlatList
          data={dives}
          keyExtractor={item => item.id.toString()}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.diveContent}
                onPress={() =>
                  navigation.navigate('DiveDetail', {
                    diveId: item.id,
                  })
                }
              >
                <Text style={styles.country}>
                  {item.country}
                </Text>

                <Text style={styles.title}>
                  {item.location} –{' '}
                  {new Date(item.date).toLocaleDateString()}
                </Text>

                <Text style={styles.mutedDetails}>
                  Profundidad: {item.maxDepth}m
                </Text>

                <Text style={styles.mutedDetails}>
                  Duración: {item.duration} min
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.shareButton}
                onPress={() =>
                  navigation.navigate('InviteBuddy', {
                    diveId: item.id,
                  })
                }
              >
                <Text style={styles.shareButtonText}>
                  Compartir
                </Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f7f9fc',
  },

  webContentContainer: {
    width: '100%',
    maxWidth: 1050,
    alignSelf: 'center',
    paddingBottom: 100,
    paddingHorizontal: Platform.OS === 'web' ? 30 : 0,
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
    marginHorizontal: -8,
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
    paddingVertical: 6,
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
    fontSize: 11,
    color: '#ccc',
    marginBottom: 2,
  },

  shareButton: {
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
    minWidth: 40,
    minHeight: 40,
  },

  profileIcon: {
    fontSize: 26,
  },

  groupHeader: {
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

