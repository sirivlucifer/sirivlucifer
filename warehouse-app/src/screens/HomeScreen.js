import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { getDashboardStats } from '../api/woocommerce';

const StatCard = ({ icon, label, value, color, onPress }) => (
  <TouchableOpacity style={[styles.statCard, { borderLeftColor: color }]} onPress={onPress}>
    <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
      <Ionicons name={icon} size={24} color={color} />
    </View>
    <View style={styles.statInfo}>
      <Text style={styles.statValue}>{value ?? '—'}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
    <Ionicons name="chevron-forward" size={18} color="#444" />
  </TouchableOpacity>
);

export default function HomeScreen({ navigation }) {
  const { credentials, logout } = useApp();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const data = await getDashboardStats();
      setStats(data);
    } catch (err) {
      console.warn('İstatistik alınamadı:', err?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchStats();
  };

  const handleLogout = () => {
    Alert.alert('Çıkış Yap', 'Oturumu kapatmak istediğinize emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Çıkış', style: 'destructive', onPress: logout },
    ]);
  };

  const siteDomain = credentials?.siteUrl?.replace(/https?:\/\//, '').replace(/\/$/, '') || '';

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6C63FF" />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hoş geldiniz</Text>
          <Text style={styles.domain} numberOfLines={1}>{siteDomain}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color="#FF6B6B" />
        </TouchableOpacity>
      </View>

      {/* İstatistikler */}
      <Text style={styles.sectionTitle}>Sipariş Durumu</Text>
      {loading ? (
        <ActivityIndicator color="#6C63FF" style={{ marginVertical: 32 }} />
      ) : (
        <View style={styles.statsGrid}>
          <StatCard
            icon="time-outline"
            label="Bekleyen"
            value={stats?.pending}
            color="#F59E0B"
            onPress={() => navigation.navigate('Orders', { status: 'pending' })}
          />
          <StatCard
            icon="construct-outline"
            label="İşlemde"
            value={stats?.processing}
            color="#6C63FF"
            onPress={() => navigation.navigate('Orders', { status: 'processing' })}
          />
          <StatCard
            icon="pause-circle-outline"
            label="Beklemede"
            value={stats?.onHold}
            color="#3B82F6"
            onPress={() => navigation.navigate('Orders', { status: 'on-hold' })}
          />
          <StatCard
            icon="checkmark-circle-outline"
            label="Tamamlanan"
            value={stats?.completed}
            color="#10B981"
            onPress={() => navigation.navigate('Orders', { status: 'completed' })}
          />
        </View>
      )}

      {/* Hızlı Erişim */}
      <Text style={styles.sectionTitle}>Hızlı Erişim</Text>
      <View style={styles.quickGrid}>
        <QuickBtn
          icon="barcode-outline"
          label="Barkod Tara"
          color="#6C63FF"
          onPress={() => navigation.navigate('Barcode')}
        />
        <QuickBtn
          icon="list-outline"
          label="Siparişler"
          color="#F59E0B"
          onPress={() => navigation.navigate('Orders', {})}
        />
        <QuickBtn
          icon="cube-outline"
          label="Stok"
          color="#10B981"
          onPress={() => navigation.navigate('Stock')}
        />
        <QuickBtn
          icon="car-outline"
          label="Kargo"
          color="#3B82F6"
          onPress={() => navigation.navigate('Shipping')}
        />
      </View>
    </ScrollView>
  );
}

const QuickBtn = ({ icon, label, color, onPress }) => (
  <TouchableOpacity style={styles.quickBtn} onPress={onPress}>
    <View style={[styles.quickIcon, { backgroundColor: color + '20' }]}>
      <Ionicons name={icon} size={28} color={color} />
    </View>
    <Text style={styles.quickLabel}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 12,
    backgroundColor: '#1a1a2e',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3e',
  },
  greeting: { fontSize: 12, color: '#888' },
  domain: { fontSize: 16, fontWeight: '700', color: '#fff', maxWidth: 220 },
  logoutBtn: { padding: 8 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 12,
  },
  statsGrid: { paddingHorizontal: 16, gap: 10 },
  statCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    gap: 14,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  statIcon: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statInfo: { flex: 1 },
  statValue: { fontSize: 24, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 12, color: '#888', marginTop: 2 },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
    paddingBottom: 32,
  },
  quickBtn: {
    width: '47%',
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  quickIcon: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: 13, fontWeight: '600', color: '#fff' },
});
