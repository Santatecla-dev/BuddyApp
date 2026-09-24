import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
} from 'react-native';
import API from '../api/api';
import { Achievement } from '../types';

type Profile = {
  id: number;
  name: string;
  email: string;
  agency?: string;
  certifications?: string[];
  totalDives: number;
  dives?: { userId: number }[];
};

export default function ProfileScreen({ route, navigation }: any) {
  const viewedUserId: number | null = route?.params?.userId ?? null;
  const isOwnProfile = viewedUserId === null;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [tempMessage, setTempMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [agency, setAgency] = useState('');
  const [certifications, setCertifications] = useState<string[]>([]);
  const [certificationsText, setCertificationsText] = useState('');

  const [totalDives, setTotalDives] = useState<number | null>(null);
  const [divesWithMe, setDivesWithMe] = useState<number | null>(null);
  const [pinnedAchievements, setPinnedAchievements] = useState<Achievement[]>([]);

  const fetchProfile = async () => {
    try {
      const res = isOwnProfile
        ? await API.get('/users/me')
        : await API.get(`/users/${viewedUserId}`);
      const data: Profile = res.data;

      setProfile(data);
      setAgency(data.agency || '');
      setCertifications(data.certifications || []);
      setCertificationsText((data.certifications || []).join(', '));
      setTotalDives(data.totalDives);

      if (isOwnProfile) {
        try {
          const achievementsRes = await API.get<Achievement[]>('/achievements');
          setPinnedAchievements((achievementsRes.data || []).filter((achievement) => achievement.pinned).slice(0, 3));
        } catch {
          setPinnedAchievements([]);
        }
      } else {
        setPinnedAchievements([]);
        const sharedRes = await API.get(`/users/${viewedUserId}/shared-dives`);
        setDivesWithMe(sharedRes.data.sharedDives);
      }
    } catch (err) {
      console.log('Error loading profile or dives', err);
      setErrorMessage('Could not load profile');
    }
  };

  useEffect(() => {
    setProfile(null);
    setIsEditing(false);
    setErrorMessage('');
    setDivesWithMe(null);
    setPinnedAchievements([]);
    fetchProfile();
  }, [viewedUserId]);

  const saveProfile = async () => {
    try {
      const certsArray = certificationsText
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      await API.patch('/users/me', { agency, certifications: certsArray });

      setIsEditing(false);
      setTempMessage('Profile updated');
      setTimeout(() => setTempMessage(''), 3000);

      fetchProfile();
    } catch (err) {
      console.log(err);
      setErrorMessage('Error updating profile');
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  if (!profile) {
    return (
      <View style={[styles.container, styles.centerContainer]}>
        <Text
          accessibilityRole={errorMessage ? 'alert' : undefined}
          style={styles.loadingText}
        >
          {errorMessage || 'Loading profile…'}
        </Text>
        {errorMessage ? (
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.editButton}
            onPress={fetchProfile}
          >
            <Text style={styles.editButtonText}>Retry</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.mainScroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.content}>
        <Text style={styles.title}>
          {isOwnProfile ? 'My profile' : 'Buddy profile'}
        </Text>

        <View style={styles.card}>
          <View style={styles.topRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Full name</Text>
              <Text style={styles.value}>{profile.name}</Text>

              <Text style={styles.label}>Email</Text>
              <Text style={styles.value}>{profile.email}</Text>

              <Text style={styles.label}>Diver ID</Text>
              <Text style={styles.value}>{profile.id}</Text>

              <Text style={styles.label}>Total dives</Text>
              <Text style={styles.value}>
                {totalDives !== null ? totalDives : 'Loading…'}
              </Text>
            </View>

            {!isOwnProfile && divesWithMe !== null && (
              <View style={styles.divesWithMe}>
                <Text style={styles.divesWithMeLabel}>Dives together</Text>
                <Text style={styles.divesWithMeValue}>{divesWithMe}</Text>
              </View>
            )}
          </View>

          <Text style={styles.label}>Agency</Text>
          {isEditing ? (
            <TextInput
              value={agency}
              onChangeText={setAgency}
              style={[styles.input, styles.inputEditable]}
              placeholder="SSI, PADI, etc."
              accessibilityLabel="Agency"
            />
          ) : (
            <Text style={styles.value}>
              {profile.agency || 'Not specified'}
            </Text>
          )}

          <Text style={styles.label}>Certifications</Text>
          {isEditing ? (
            <TextInput
              value={certificationsText}
              onChangeText={setCertificationsText}
              style={[styles.input, styles.inputEditable]}
              placeholder="Open Water, Advanced, Nitrox..."
              accessibilityLabel="Certifications"
            />
          ) : certifications.length > 0 ? (
            certifications.map((c, i) => (
              <Text key={i} style={styles.value}>
                • {c}
              </Text>
            ))
          ) : (
            <Text style={styles.value}>Not specified</Text>
          )}
        </View>

        {errorMessage ? (
          <Text accessibilityRole="alert" style={styles.errorText}>
            {errorMessage}
          </Text>
        ) : null}
        {tempMessage ? (
          <Text style={styles.successText}>{tempMessage}</Text>
        ) : null}

        {isOwnProfile ? (
          <TouchableOpacity
            style={[
              styles.editButton,
              isEditing && { backgroundColor: '#00A8A8' },
            ]}
            onPress={isEditing ? saveProfile : () => setIsEditing(true)}
            accessibilityRole="button"
          >
            <Text style={styles.editButtonText}>
              {isEditing ? 'Save changes' : 'Edit profile'}
            </Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.readOnlyNote}>This profile is read-only</Text>
        )}

        {isOwnProfile ? (
          <View style={styles.pinnedProfileCard}>
            <View style={styles.pinnedProfileHeader}><Text style={styles.pinnedProfileTitle}>Pinned achievements</Text><TouchableOpacity accessibilityRole="button" onPress={() => navigation.navigate('Achievements')}><Text style={styles.pinnedProfileLink}>See all</Text></TouchableOpacity></View>
            {pinnedAchievements.length ? pinnedAchievements.map((achievement) => <TouchableOpacity key={achievement.id} style={styles.pinnedProfileRow} onPress={() => navigation.navigate('Achievements')}><Text style={styles.pinnedProfileIcon}>{achievement.icon}</Text><View style={styles.pinnedProfileCopy}><Text style={styles.pinnedProfileName}>{achievement.title}</Text><Text style={styles.pinnedProfileProgress}>{achievement.progress} / {achievement.target}</Text></View><Text style={styles.pinnedProfileArrow}>›</Text></TouchableOpacity>) : <Text style={styles.pinnedProfileEmpty}>Pin up to three achievements from your collection.</Text>}
          </View>
        ) : null}

        {isOwnProfile ? (
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.equipmentButton}
            onPress={() => navigation.navigate('Equipment')}
          >
            <Text style={styles.equipmentButtonText}>Manage my equipment</Text>
          </TouchableOpacity>
        ) : null}

        {isOwnProfile ? (
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.achievementsButton}
            onPress={() => navigation.navigate('Achievements')}
          >
            <Text style={styles.achievementsButtonText}>View achievements</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  mainScroll: {
    flex: 1,
    backgroundColor: '#f7f9fc',
  },

  container: {
    padding: 20,
    paddingBottom: 40,
  },

  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  content: {
    width: '100%',
    maxWidth: 700,
    alignSelf: 'center',
  },

  loadingText: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginBottom: 16,
  },

  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#0077CC',
  },

  card: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15,
        shadowRadius: 5,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
      } as any,
    }),
  },

  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },

  divesWithMe: {
    backgroundColor: '#E0F7FA',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    minWidth: 90,
  },

  divesWithMeLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#0077CC',
    textAlign: 'center',
  },

  divesWithMeValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0077CC',
    marginTop: 2,
  },

  label: {
    fontWeight: 'bold',
    marginTop: 12,
    color: '#0077CC',
    fontSize: 13,
  },

  value: {
    fontSize: 16,
    marginTop: 4,
    color: '#1a202c',
  },

  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
    marginTop: 6,
    fontSize: 15,
    color: '#333',
  },

  inputEditable: {
    backgroundColor: 'white',
    borderColor: '#0077CC',
  },

  editButton: {
    backgroundColor: '#0077CC',
    padding: 15,
    borderRadius: 30,
    alignItems: 'center',
  },

  editButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },

  pinnedProfileCard: {
    backgroundColor: '#fffaf0',
    borderWidth: 1,
    borderColor: '#eadba8',
    borderRadius: 16,
    padding: 15,
    marginTop: 14,
  },

  pinnedProfileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },

  pinnedProfileTitle: {
    color: '#164c67',
    fontWeight: 'bold',
    fontSize: 16,
  },

  pinnedProfileLink: {
    color: '#9a741b',
    fontWeight: 'bold',
    fontSize: 12,
  },

  pinnedProfileRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f0e7c9',
    paddingVertical: 7,
  },

  pinnedProfileIcon: {
    fontSize: 24,
    width: 34,
  },

  pinnedProfileCopy: {
    flex: 1,
    minWidth: 0,
  },

  pinnedProfileName: {
    color: '#164c67',
    fontWeight: 'bold',
    fontSize: 13,
  },

  pinnedProfileProgress: {
    color: '#9a741b',
    fontSize: 11,
    marginTop: 2,
  },

  pinnedProfileArrow: {
    color: '#9a741b',
    fontSize: 22,
    marginLeft: 8,
  },

  pinnedProfileEmpty: {
    color: '#7a6a42',
    fontSize: 12,
    lineHeight: 18,
  },

  equipmentButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#00A8A8',
    padding: 14,
    borderRadius: 30,
    alignItems: 'center',
    backgroundColor: '#effafa',
  },

  equipmentButtonText: {
    color: '#008d8d',
    fontWeight: 'bold',
    fontSize: 15,
  },

  achievementsButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#d5aa43',
    padding: 14,
    borderRadius: 30,
    alignItems: 'center',
    backgroundColor: '#fff9e7',
  },

  achievementsButtonText: {
    color: '#9a741b',
    fontWeight: 'bold',
    fontSize: 15,
  },

  readOnlyNote: {
    textAlign: 'center',
    color: '#777',
    fontStyle: 'italic',
    marginTop: 10,
  },

  errorText: {
    color: '#D32F2F',
    marginBottom: 10,
    textAlign: 'center',
    fontWeight: '500',
  },

  successText: {
    color: '#28A745',
    marginBottom: 10,
    textAlign: 'center',
    fontWeight: '500',
  },
});
