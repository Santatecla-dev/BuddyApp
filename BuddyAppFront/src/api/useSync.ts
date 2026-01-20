import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import API from '../api/api';
import { useEffect } from 'react';
let isSyncing = false; // Variable fuera del hook para que sea global

export const useSync = (onSyncComplete?: () => void) => {
  useEffect(() => {
    // 1. Escuchar cambios en la conexión
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected) {
        syncOfflineDives(); // Si vuelve el internet, intentamos enviar
      }
    });

    return () => unsubscribe(); // Limpiamos al cerrar
  }, []);

const syncOfflineDives = async () => {
    if (isSyncing) return;
    try {
      const stored = await AsyncStorage.getItem('@offline_dives');
      if (!stored) return;

      const offlineDives = JSON.parse(stored);
      if (offlineDives.length === 0) return;

      isSyncing = true;
      for (const dive of offlineDives) {
        await API.post('/dives', dive);
      }

      await AsyncStorage.removeItem('@offline_dives');
      
      // ¡ESTO ES NUEVO! Avisamos a la pantalla de que ya puede recargar
      if (onSyncComplete) onSyncComplete(); 
      
    } catch (error) {
      console.log('Error sincronizando', error);
    } finally {
      isSyncing = false;
    }
  };
};