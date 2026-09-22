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
      const buddy = invite.invitedByUser?.name || 'Unnamed buddy';
      if (!groups[buddy]) {
        groups[buddy] = { key: buddy, buddy, invites: [] };
      }
      groups[buddy].invites.push(invite);
    });

    return Object.values(groups);
  };

  const renderInviteCard = (item: DiveInvite) => (
    <View style={styles.card}>
      <Text style={styles.title}>
        {item.dive.location} ·{' '}
        {new Date(item.dive.date).toLocaleDateString()}
      </Text>

      <Text style={styles.subtitle}>
        Invited by: {item.invitedByUser?.name || 'Buddy'}
      </Text>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, styles.acceptButton]}
          onPress={() => respond(item.id, true)}
          accessibilityRole="button"
          accessibilityLabel={`Accept invitation for ${item.dive.location}`}
        >
          <Text style={styles.buttonText}>Accept</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.rejectButton]}
          onPress={() => respond(item.id, false)}
          accessibilityRole="button"
          accessibilityLabel={`Decline invitation for ${item.dive.location}`}
        >
          <Text style={styles.buttonText}>Decline</Text>
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
      <View style={styles.groupSection}>
        <View style={styles.groupHeader}>
          <Text style={styles.groupHeaderLabel}>BUDDY</Text>
          <Text style={styles.groupHeaderName} numberOfLines={1}>
            {group.buddy}
          </Text>
          <Text style={styles.groupHeaderCount}>
            {group.invites.length} invitation{group.invites.length === 1 ? '' : 's'}
          </Text>
        </View>
        <View style={styles.groupCardsContainer}>
          {group.invites.map((invite) => (
            <View key={invite.id} style={styles.groupedInvite}>
              {renderInviteCard(invite)}
            </View>
          ))}
        </View>
      </View>
    );
  };

  const listData: Array<DiveInvite | BuddyInviteGroup> = groupedByBuddy
    ? groupedInvites()
    : invites;

  return (
    <View style={styles.container}>
      <FlatList
        contentContainerStyle={styles.listContent}
        data={listData}
        keyExtractor={(item) =>
          groupedByBuddy
            ? (item as BuddyInviteGroup).key
            : (item as DiveInvite).id.toString()
        }
        renderItem={renderItem}
        ListHeaderComponent={
          <TouchableOpacity
            style={styles.groupToggle}
            onPress={() => setGroupedByBuddy((value) => !value)}
            accessibilityRole="button"
            accessibilityState={{ expanded: groupedByBuddy }}
          >
            <Text style={styles.groupToggleText}>
              {groupedByBuddy ? 'Show all' : 'Group by buddy'}
            </Text>
          </TouchableOpacity>
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            You have no pending invitations 🤿
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f9fc',
  },

  listContent: {
    width: '100%',
    maxWidth: 1050,
    alignSelf: 'center',
    padding: 20,
    paddingBottom: 40,
  },

  card: {
    backgroundColor: 'white',
    padding: 18,
    borderRadius: 16,
    marginBottom: 16,
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

  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 6,
    color: '#1a202c',
  },

  subtitle: {
    fontSize: 14,
    color: '#555',
    marginBottom: 14,
  },

  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },

  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 25,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },

  acceptButton: {
    backgroundColor: '#28A745',
  },

  rejectButton: {
    backgroundColor: '#DC3545',
  },

  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 15,
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
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginBottom: 20,
  },

  groupToggleText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },

  groupSection: {
    marginBottom: 24,
  },

  groupCardsContainer: {
    width: '100%',
  },

  groupHeader: {
    backgroundColor: '#eef6fc',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#d0e3f5',
  },

  groupHeaderLabel: {
    color: '#00A8A8',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
    letterSpacing: 0.5,
  },

  groupHeaderName: {
    color: '#0077CC',
    fontSize: 18,
    fontWeight: 'bold',
  },

  groupHeaderCount: {
    color: '#555',
    fontSize: 13,
    marginTop: 4,
  },

  groupedInvite: {
    width: '100%',
  },
});
