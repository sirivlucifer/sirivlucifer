import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { getShipments, setTrackingNumber, addOrderNote, updateOrderStatus } from '../api/woocommerce';

const CARRIERS = [
  { name: 'Yurtiçi Kargo', icon: 'car-outline' },
  { name: 'Aras Kargo', icon: 'car-sport-outline' },
  { name: 'MNG Kargo', icon: 'bicycle-outline' },
  { name: 'PTT Kargo', icon: 'mail-outline' },
  { name: 'Sürat Kargo', icon: 'flash-outline' },
  { name: 'Sendeo', icon: 'rocket-outline' },
  { name: 'UPS', icon: 'cube-outline' },
  { name: 'DHL', icon: 'airplane-outline' },
];

const ShipmentCard = ({ order, onPress }) => {
  const totalItems = order.line_items?.reduce((sum, i) => sum + i.quantity, 0) || 0;
  const date = new Date(order.date_created).toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const trackingNum = order.meta_data?.find(m => m.key === '_tracking_number')?.value;
  const carrier = order.meta_data?.find(m => m.key === '_tracking_carrier')?.value;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.orderNum}>#{order.number}</Text>
          <Text style={styles.orderDate}>{date}</Text>
        </View>
        {trackingNum ? (
          <View style={styles.shippedBadge}>
            <Ionicons name="checkmark-circle" size={14} color="#10B981" />
            <Text style={styles.shippedText}>Kargoda</Text>
          </View>
        ) : (
          <View style={styles.pendingBadge}>
            <Ionicons name="time-outline" size={14} color="#F59E0B" />
            <Text style={styles.pendingText}>Hazırlanıyor</Text>
          </View>
        )}
      </View>

      <View style={styles.cardRow}>
        <Ionicons name="person-outline" size={14} color="#666" />
        <Text style={styles.customerName}>
          {order.billing?.first_name} {order.billing?.last_name}
        </Text>
      </View>

      <View style={styles.cardRow}>
        <Ionicons name="location-outline" size={14} color="#666" />
        <Text style={styles.address} numberOfLines={1}>
          {order.shipping?.address_1}, {order.shipping?.city}
        </Text>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.cardChip}>
          <Ionicons name="cube-outline" size={13} color="#6C63FF" />
          <Text style={styles.chipText}>{totalItems} ürün</Text>
        </View>
        {carrier && (
          <View style={styles.cardChip}>
            <Ionicons name="car-outline" size={13} color="#3B82F6" />
            <Text style={styles.chipText}>{carrier}</Text>
          </View>
        )}
        {trackingNum && (
          <View style={styles.cardChip}>
            <Ionicons name="barcode-outline" size={13} color="#888" />
            <Text style={styles.chipText}>{trackingNum}</Text>
          </View>
        )}
        <Text style={styles.orderTotal}>
          {parseFloat(order.total).toFixed(2)} {order.currency}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

export default function ShippingScreen({ navigation }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [selected, setSelected] = useState([]);
  const [bulkCarrier, setBulkCarrier] = useState(CARRIERS[0].name);
  const [bulkModal, setBulkModal] = useState(false);

  // Tekli kargo
  const [singleOrder, setSingleOrder] = useState(null);
  const [trackingNum, setTrackingNum] = useState('');
  const [carrier, setCarrier] = useState(CARRIERS[0].name);
  const [saving, setSaving] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      const data = await getShipments();
      setOrders(data);
    } catch (err) {
      console.warn('Kargo siparişleri alınamadı:', err?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const toggleSelect = (orderId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  const handleSingleShip = async () => {
    if (!trackingNum.trim()) {
      Alert.alert('Hata', 'Takip numarası giriniz.');
      return;
    }
    setSaving(true);
    try {
      await setTrackingNumber(singleOrder.id, trackingNum.trim(), carrier);
      await addOrderNote(
        singleOrder.id,
        `Kargo bilgisi: ${carrier} - ${trackingNum.trim()}`,
        true
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSingleOrder(null);
      setTrackingNum('');
      fetchOrders();
    } catch (err) {
      Alert.alert('Hata', 'Kargo işlemi tamamlanamadı.');
    } finally {
      setSaving(false);
    }
  };

  const readyOrders = orders.filter(
    (o) => !o.meta_data?.find(m => m.key === '_tracking_number')?.value
  );
  const shippedOrders = orders.filter(
    (o) => o.meta_data?.find(m => m.key === '_tracking_number')?.value
  );

  const stats = [
    { label: 'Hazırlanacak', value: readyOrders.length, color: '#F59E0B' },
    { label: 'Kargoda', value: shippedOrders.length, color: '#10B981' },
  ];

  return (
    <View style={styles.container}>
      {/* Özet */}
      <View style={styles.statsRow}>
        {stats.map((s) => (
          <View key={s.label} style={styles.statItem}>
            <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
        <TouchableOpacity
          style={[styles.bulkBtn, bulkMode && styles.bulkBtnActive]}
          onPress={() => {
            setBulkMode(!bulkMode);
            setSelected([]);
          }}
        >
          <Ionicons
            name={bulkMode ? 'close-outline' : 'checkbox-outline'}
            size={16}
            color={bulkMode ? '#EF4444' : '#6C63FF'}
          />
          <Text style={[styles.bulkBtnText, bulkMode && { color: '#EF4444' }]}>
            {bulkMode ? 'İptal' : 'Toplu Seç'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Toplu İşlem Bar */}
      {bulkMode && selected.length > 0 && (
        <View style={styles.bulkBar}>
          <Text style={styles.bulkBarText}>{selected.length} sipariş seçildi</Text>
          <TouchableOpacity style={styles.bulkActionBtn} onPress={() => setBulkModal(true)}>
            <Ionicons name="car-outline" size={16} color="#fff" />
            <Text style={styles.bulkActionText}>Kargoya Ver</Text>
          </TouchableOpacity>
        </View>
      )}

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
              <Ionicons name="car-outline" size={48} color="#333" />
              <Text style={styles.emptyText}>İşlemde sipariş yok</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={{ position: 'relative' }}>
              {bulkMode && (
                <TouchableOpacity
                  style={[styles.selectOverlay, selected.includes(item.id) && styles.selectOverlayActive]}
                  onPress={() => toggleSelect(item.id)}
                >
                  <View style={[styles.selectCircle, selected.includes(item.id) && styles.selectCircleActive]}>
                    {selected.includes(item.id) && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                </TouchableOpacity>
              )}
              <ShipmentCard
                order={item}
                onPress={() => {
                  if (bulkMode) {
                    toggleSelect(item.id);
                  } else {
                    setSingleOrder(item);
                    setTrackingNum('');
                    setCarrier(CARRIERS[0].name);
                  }
                }}
              />
            </View>
          )}
        />
      )}

      {/* Tekli Kargo Modal */}
      <Modal visible={!!singleOrder} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Kargoya Ver</Text>
            {singleOrder && (
              <Text style={styles.modalSubtitle}>
                #{singleOrder.number} — {singleOrder.billing?.first_name} {singleOrder.billing?.last_name}
              </Text>
            )}

            <Text style={styles.modalLabel}>Kargo Firması</Text>
            <FlatList
              horizontal
              data={CARRIERS}
              keyExtractor={(c) => c.name}
              showsHorizontalScrollIndicator={false}
              style={styles.carrierList}
              renderItem={({ item: c }) => (
                <TouchableOpacity
                  style={[styles.carrierChip, carrier === c.name && styles.carrierChipActive]}
                  onPress={() => setCarrier(c.name)}
                >
                  <Ionicons name={c.icon} size={16} color={carrier === c.name ? '#fff' : '#888'} />
                  <Text style={[styles.carrierText, carrier === c.name && styles.carrierTextActive]}>
                    {c.name}
                  </Text>
                </TouchableOpacity>
              )}
            />

            <Text style={styles.modalLabel}>Takip Numarası</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Kargo takip numarası"
              placeholderTextColor="#555"
              value={trackingNum}
              onChangeText={setTrackingNum}
              keyboardType="default"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setSingleOrder(null)}
              >
                <Text style={styles.modalCancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleSingleShip}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>Kargoya Ver</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3e',
    alignItems: 'center',
    gap: 16,
  },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 11, color: '#666', marginTop: 2 },
  bulkBtn: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#6C63FF20',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#6C63FF',
  },
  bulkBtnActive: { borderColor: '#EF4444', backgroundColor: '#EF444420' },
  bulkBtnText: { color: '#6C63FF', fontSize: 12, fontWeight: '700' },
  bulkBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3e',
  },
  bulkBarText: { color: '#fff', fontSize: 13, flex: 1 },
  bulkActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#6C63FF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bulkActionText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  listContent: { padding: 12, gap: 10 },
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2a2a3e',
    gap: 8,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  orderNum: { fontSize: 16, fontWeight: '800', color: '#fff' },
  orderDate: { fontSize: 11, color: '#555' },
  shippedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#10B98120',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  shippedText: { color: '#10B981', fontSize: 12, fontWeight: '600' },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F59E0B20',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pendingText: { color: '#F59E0B', fontSize: 12, fontWeight: '600' },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  customerName: { color: '#ddd', fontSize: 13, fontWeight: '500' },
  address: { color: '#888', fontSize: 12, flex: 1 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  cardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2a2a3e',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  chipText: { color: '#aaa', fontSize: 11 },
  orderTotal: { marginLeft: 'auto', color: '#6C63FF', fontWeight: '700', fontSize: 13 },
  selectOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
    borderRadius: 14,
    backgroundColor: 'transparent',
    padding: 14,
  },
  selectOverlayActive: { backgroundColor: 'rgba(108,99,255,0.1)', borderWidth: 2, borderColor: '#6C63FF' },
  selectCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#444',
    backgroundColor: '#0f0f1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectCircleActive: { backgroundColor: '#6C63FF', borderColor: '#6C63FF' },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { color: '#444', fontSize: 16 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#2a2a3e',
    gap: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  modalSubtitle: { fontSize: 13, color: '#888' },
  modalLabel: { fontSize: 11, color: '#888', fontWeight: '700', textTransform: 'uppercase' },
  carrierList: { maxHeight: 48 },
  carrierChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#0f0f1a',
    borderWidth: 1,
    borderColor: '#2a2a3e',
    marginRight: 8,
  },
  carrierChipActive: { backgroundColor: '#6C63FF', borderColor: '#6C63FF' },
  carrierText: { color: '#888', fontSize: 12 },
  carrierTextActive: { color: '#fff', fontWeight: '700' },
  modalInput: {
    backgroundColor: '#0f0f1a',
    borderRadius: 10,
    padding: 12,
    color: '#fff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: '#2a2a3e',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  modalCancelText: { color: '#aaa', fontWeight: '600' },
  modalConfirmBtn: {
    flex: 2,
    backgroundColor: '#6C63FF',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  modalConfirmText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
