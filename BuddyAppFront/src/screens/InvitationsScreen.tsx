import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import API from '../api/api';
import { DiveInvite } from '../types';

type BuddyInviteGroup = {
  key: string;
  buddy: string;
  invites: DiveInvite[];
};

export default function InvitationsScreen() {
  const [invites, setInvites] = useState<DiveInvite[]>([]);
  const [groupedByBuddy, setGroupedByBuddy] = useState(false);

  const fetchInvites = async () => {
    try {
      const res = await API.get('/dives/invites/pending');
      setInvites(res.data);
    } catch (err) {
      console.log(err);
    }
  };

  const respond = async (inviteId: number, accept: boolean) => {
    try {
      await API.post(`/dives/invite/${accept ? 'accept' : 'reject'}`, {
        inviteId,
      });
      fetchInvites();
    } catch (err) {
      console.log(err);
    }
  };

  useEffect(() => {
    fetchInvites();
  }, []);

  const groupedInvites = (): BuddyInviteGroup[] => {
    const groups: Record<string, BuddyInviteGroup> = {};

    invites.forEach((invite) => {
      const buddy = invite.invitedByUser?.name || 'Buddy sin nombre';
      if (!groups[buddy]) {
        groups[buddy] = { key: buddy, buddy, invites: [] };
      }
      groups[buddy].invites.push(invite);
    });

    return Object.values(groups);
  };

  const renderInviteCard = (item: DiveInvite, grouped = false) => (
    <View style={[styles.card, Platform.OS === 'web' && styles.webCard]}>
      <Text style={styles.title}>
        {item.dive.location} ·{' '}
        {new Date(item.dive.date).toLocaleDateString()}
      </Text>

      <Text style={styles.subtitle}>
        Invitado por: {item.invitedByUser.name}
      </Text>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, styles.acceptButton, Platform.OS === 'web' && styles.webAcceptButton]}
          onPress={() => respond(item.id, true)}
        >
          <Text style={styles.buttonText}>Aceptar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.rejectButton, Platform.OS === 'web' && styles.webRejectButton]}
          onPress={() => respond(item.id, false)}
        >
          <Text style={styles.buttonText}>Rechazar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderItem = ({ item }: { item: DiveInvite | BuddyInviteGroup }) => {
    if (!groupedByBuddy) {
      return renderInviteCard(item as DiveInvite);
    }

    const group = item as BuddyInviteGroup;
    return (
      <View style={[styles.groupSection, Platform.OS === 'web' && styles.webGroupSection]}>
        <View style={[styles.groupHeader, Platform.OS === 'web' && styles.webGroupHeader]}>
          <Text style={styles.groupHeaderLabel}>Buddy</Text>
          <Text style={styles.groupHeaderName} numberOfLines={1}>{group.buddy}</Text>
          <Text style={styles.groupHeaderCount}>{group.invites.length} invitación{group.invites.length === 1 ? '' : 'es'}</Text>
        </View>
        {group.invites.map((invite) => (
          <View key={invite.id} style={styles.groupedInvite}>
            {renderInviteCard(invite, true)}
          </View>
        ))}
      </View>
    );
  };

  const listData: Array<DiveInvite | BuddyInviteGroup> = groupedByBuddy
    ? groupedInvites()
    : invites;

  return (
    <View style={styles.container}>
      <FlatList
        data={listData}
        keyExtractor={(item) => groupedByBuddy ? (item as BuddyInviteGroup).key : (item as DiveInvite).id.toString()}
        renderItem={renderItem}
        scrollEnabled={Platform.OS !== 'web'}
        ListHeaderComponent={
          <TouchableOpacity
            style={styles.groupToggle}
            onPress={() => setGroupedByBuddy((value) => !value)}
          >
            <Text style={styles.groupToggleText}>
              {groupedByBuddy ? 'Mostrar todas' : 'Agrupar por buddy'}
            </Text>
          </TouchableOpacity>
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No tienes invitaciones pendientes 🤿
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },

  card: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 16,
    marginBottom: 15,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },

  webCard: {
    width: 'calc(100% + 96px)',
    marginLeft: -48,
    overflow: 'hidden',
    boxShadow: '0 10px 22px rgba(0, 0, 0, 0.32)',
  } as any,

  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },

  subtitle: {
    fontSize: 14,
    color: '#555',
    marginBottom: 12,
  },

  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 25,
    alignItems: 'center',
  },

  acceptButton: {
    backgroundColor: '#2ECC71',
    marginRight: 10,
  },

  rejectButton: {
    backgroundColor: '#E74C3C',
  },

  webAcceptButton: { backgroundColor: '#E74C3C' },
  webRejectButton: { backgroundColor: '#2ECC71' },

  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },

  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    color: '#777',
    fontSize: 16,
  },

  groupToggle: {
    alignSelf: 'flex-start',
    backgroundColor: '#0077CC',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 11,
    marginBottom: 16,
  },

  groupToggleText: {
    color: 'white',
    fontWeight: 'bold',
  },

  groupSection: {
    marginBottom: 18,
  },

  webGroupSection: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'stretch',
    marginHorizontal: -12,
  } as any,

  groupHeader: {
    backgroundColor: '#f2f8ff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },

  webGroupHeader: {
    width: 150,
    marginRight: 8,
    marginBottom: 0,
  },

  groupHeaderLabel: {
    color: '#00A8A8',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
  },

  groupHeaderName: {
    color: '#0077CC',
    fontSize: 17,
    fontWeight: 'bold',
  },

  groupHeaderCount: {
    color: '#555',
    fontSize: 12,
    marginTop: 5,
  },

  groupedInvite: {
    flex: 1,
    minWidth: 280,
  },
});
