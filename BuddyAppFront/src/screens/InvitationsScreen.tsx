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

export default function InvitationsScreen() {
  const [invites, setInvites] = useState<DiveInvite[]>([]);

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

  const renderItem = ({ item }: { item: DiveInvite }) => (
    <View style={styles.card}>
      <Text style={styles.title}>
        {item.dive.location} ·{' '}
        {new Date(item.dive.date).toLocaleDateString()}
      </Text>

      <Text style={styles.subtitle}>
        Invitado por: {item.invitedByUser.name}
      </Text>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, styles.acceptButton]}
          onPress={() => respond(item.id, true)}
        >
          <Text style={styles.buttonText}>Aceptar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.rejectButton]}
          onPress={() => respond(item.id, false)}
        >
          <Text style={styles.buttonText}>Rechazar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={invites}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
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
});