import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getOrders } from '../api/woocommerce';

const STATUS_FILTERS = [
  { key: 'any', label: 'Tümü' },
  { key: 'pending', label: 'Bekleyen' },
  { key: 'processing', label: 'İşlemde' },
  { key: 'on-hold', label: 'Beklemede' },
  { key: 'completed', label: 'Tamamlandı' },
  { key: 'cancelled', label: 'İptal' },
];

const STATUS_COLORS = {
  pending: '#F59E0B',
  processing: '#6C63FF',
  'on-hold': '#3B82F6',
  completed: '#10B981',
  cancelled: '#EF4444',
  refunded: '#EC4899',
  failed: '#EF4444',
};

const STATUS_LABELS = {
  pending: 'Bekleyen',
  processing: 'İşlemde',
  'on-hold': 'Beklemede',
  completed: 'Tamamlandı',
  cancelled: 'İptal',
  refunded: 'İade',
  failed: 'Başarısız',
};

const OrderCard = ({ order, onPress }) => {
  const statusColor = STATUS_COLORS[order.status] || '#888';
  const statusLabel = STATUS_LABELS[order.status] || order.status;
  const date = new Date(order.date_created).toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <TouchableOpacity style={styles.orderCard} onPress={onPress}>
      <View style={styles.orderHeader}>
        <Text style={styles.orderNum}>#{order.number}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>

      <Text style={styles.customerName}>
        {order.billing?.first_name} {order.billing?.last_name}
      </Text>
      <Text style={styles.customerDetail} numberOfLines={1}>
        {order.billing?.city}, {order.billing?.state}
      </Text>

      <View style={styles.orderFooter}>
        <View style={styles.itemCount}>
          <Ionicons name="cube-outline" size={14} color="#888" />
          <Text style={styles.itemCountText}>{order.line_items?.length || 0} ürün</Text>
        </View>
        <Text style={styles.orderTotal}>
          {parseFloat(order.total).toFixed(2)} {order.currency}
        </Text>
        <Text style={styles.orderDate}>{date}</Text>
      </View>
    </TouchableOpacity>
  );
};

export default function OrdersScreen({ navigation, route }) {
  const initialStatus = route?.params?.status || 'any';
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState(initialStatus);
  const [search, setSearch] = useState('');

  const fetchOrders = useCallback(async (status, searchTerm) => {
    try {
      const params = {};
      if (status !== 'any') params.status = status;
      if (searchTerm.trim()) params.search = searchTerm.trim();
      const data = await getOrders(params);
      setOrders(data);
    } catch (err) {
      console.warn('Siparişler alınamadı:', err?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchOrders(activeFilter, search);
  }, [activeFilter, fetchOrders]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      fetchOrders(activeFilter, search);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders(activeFilter, search);
  };

  return (
    <View style={styles.container}>
      {/* Arama */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color="#888" />
        <TextInput
          style={styles.searchInput}
          placeholder="Sipariş no, müşteri adı..."
          placeholderTextColor="#555"
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color="#555" />
          </TouchableOpacity>
        )}
      </View>

      {/* Durum Filtresi */}
      <FlatList
        horizontal
        data={STATUS_FILTERS}
        keyExtractor={(item) => item.key}
        showsHorizontalScrollIndicator={false}
        style={styles.filterList}
        contentContainerStyle={styles.filterContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.filterChip, activeFilter === item.key && styles.filterChipActive]}
            onPress={() => setActiveFilter(item.key)}
          >
            <Text
              style={[styles.filterChipText, activeFilter === item.key && styles.filterChipTextActive]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Liste */}
      {loading ? (
        <ActivityIndicator color="#6C63FF" style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6C63FF" />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={48} color="#333" />
              <Text style={styles.emptyText}>Sipariş bulunamadı</Text>
            </View>
          }
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              onPress={() => navigation.navigate('OrderDetail', { orderId: item.id })}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    margin: 16,
    marginBottom: 8,
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#2a2a3e',
    gap: 8,
  },
  searchInput: { flex: 1, color: '#fff', fontSize: 14, paddingVertical: 10 },
  filterList: { maxHeight: 44 },
  filterContent: { paddingHorizontal: 16, gap: 8 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  filterChipActive: { backgroundColor: '#6C63FF', borderColor: '#6C63FF' },
  filterChipText: { color: '#888', fontSize: 13, fontWeight: '500' },
  filterChipTextActive: { color: '#fff', fontWeight: '700' },
  listContent: { padding: 16, gap: 10 },
  orderCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  orderNum: { fontSize: 16, fontWeight: '800', color: '#fff' },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 12, fontWeight: '600' },
  customerName: { fontSize: 14, fontWeight: '600', color: '#ddd' },
  customerDetail: { fontSize: 12, color: '#666', marginTop: 2 },
  orderFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  itemCount: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  itemCountText: { color: '#888', fontSize: 12 },
  orderTotal: { flex: 1, color: '#6C63FF', fontWeight: '700', textAlign: 'right' },
  orderDate: { color: '#555', fontSize: 11 },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { color: '#444', fontSize: 16 },
});
