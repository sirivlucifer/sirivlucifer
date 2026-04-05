import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { getOrder, updateOrderStatus, addOrderNote, setTrackingNumber } from '../api/woocommerce';

const STATUS_COLORS = {
  pending: '#F59E0B',
  processing: '#6C63FF',
  'on-hold': '#3B82F6',
  completed: '#10B981',
  cancelled: '#EF4444',
};

const STATUS_LABELS = {
  pending: 'Bekleyen',
  processing: 'İşlemde',
  'on-hold': 'Beklemede',
  completed: 'Tamamlandı',
  cancelled: 'İptal',
};

const CARRIERS = [
  'Yurtiçi Kargo',
  'Aras Kargo',
  'MNG Kargo',
  'PTT Kargo',
  'Sürat Kargo',
  'Sendeo',
  'UPS',
  'DHL',
];

export default function OrderDetailScreen({ route, navigation }) {
  const { orderId } = route.params;
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Hazırlama kontrolü (hangi ürünler toplandı)
  const [collected, setCollected] = useState({});

  // Kargo modal
  const [trackingModal, setTrackingModal] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [selectedCarrier, setSelectedCarrier] = useState(CARRIERS[0]);

  const fetchOrder = useCallback(async () => {
    try {
      const data = await getOrder(orderId);
      setOrder(data);
    } catch (err) {
      Alert.alert('Hata', 'Sipariş yüklenemedi.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const toggleCollected = (itemId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCollected((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const allCollected =
    order?.line_items?.length > 0 &&
    order.line_items.every((item) => collected[item.id]);

  const handleStatusChange = async (newStatus) => {
    Alert.alert(
      'Durum Güncelle',
      `Sipariş durumu "${STATUS_LABELS[newStatus]}" olarak güncellensin mi?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Güncelle',
          onPress: async () => {
            setActionLoading(true);
            try {
              const updated = await updateOrderStatus(orderId, newStatus);
              setOrder(updated);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (err) {
              Alert.alert('Hata', 'Durum güncellenemedi.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleShipOrder = async () => {
    if (!trackingNumber.trim()) {
      Alert.alert('Hata', 'Takip numarası giriniz.');
      return;
    }
    setActionLoading(true);
    try {
      const updated = await setTrackingNumber(orderId, trackingNumber.trim(), selectedCarrier);
      setOrder(updated);
      await addOrderNote(
        orderId,
        `Kargo gönderildi. Kargo firması: ${selectedCarrier}, Takip No: ${trackingNumber.trim()}`,
        true
      );
      setTrackingModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Başarılı', 'Sipariş kargoya verildi ve müşteriye bildirim gönderildi.');
    } catch (err) {
      Alert.alert('Hata', 'Kargo işlemi tamamlanamadı.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#6C63FF" size="large" />
      </View>
    );
  }

  if (!order) return null;

  const statusColor = STATUS_COLORS[order.status] || '#888';
  const statusLabel = STATUS_LABELS[order.status] || order.status;
  const collectedCount = Object.values(collected).filter(Boolean).length;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Başlık */}
        <View style={styles.orderHeader}>
          <View>
            <Text style={styles.orderNum}>Sipariş #{order.number}</Text>
            <Text style={styles.orderDate}>
              {new Date(order.date_created).toLocaleString('tr-TR')}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>

        {/* Müşteri Bilgileri */}
        <SectionCard title="Müşteri" icon="person-outline">
          <InfoRow label="Ad Soyad" value={`${order.billing.first_name} ${order.billing.last_name}`} />
          <InfoRow label="Telefon" value={order.billing.phone || '—'} />
          <InfoRow label="E-posta" value={order.billing.email || '—'} />
        </SectionCard>

        {/* Teslimat Adresi */}
        <SectionCard title="Teslimat Adresi" icon="location-outline">
          <InfoRow
            label="Adres"
            value={`${order.shipping.address_1}${order.shipping.address_2 ? '\n' + order.shipping.address_2 : ''}`}
          />
          <InfoRow
            label="İlçe / İl"
            value={`${order.shipping.city} / ${order.shipping.state}`}
          />
          <InfoRow label="Posta Kodu" value={order.shipping.postcode || '—'} />
        </SectionCard>

        {/* Ürün Hazırlama Listesi */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="cube-outline" size={18} color="#6C63FF" />
            <Text style={styles.sectionTitle}>Ürünler</Text>
            <View style={styles.progressBadge}>
              <Text style={styles.progressText}>
                {collectedCount}/{order.line_items.length}
              </Text>
            </View>
          </View>

          {order.line_items.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.productRow, collected[item.id] && styles.productRowChecked]}
              onPress={() => toggleCollected(item.id)}
            >
              <View style={[styles.checkbox, collected[item.id] && styles.checkboxChecked]}>
                {collected[item.id] && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
              <View style={styles.productInfo}>
                <Text style={[styles.productName, collected[item.id] && styles.productNameChecked]}>
                  {item.name}
                </Text>
                {item.sku ? <Text style={styles.sku}>SKU: {item.sku}</Text> : null}
                {item.meta_data?.find(m => m.key === 'pa_color' || m.key === 'pa_size') && (
                  <Text style={styles.variant}>
                    {item.meta_data
                      .filter(m => !m.key.startsWith('_'))
                      .map(m => `${m.display_key}: ${m.display_value}`)
                      .join(' | ')}
                  </Text>
                )}
              </View>
              <View style={styles.productQty}>
                <Text style={styles.productQtyText}>x{item.quantity}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Ödeme Özeti */}
        <SectionCard title="Ödeme" icon="card-outline">
          <InfoRow label="Ödeme Yöntemi" value={order.payment_method_title || '—'} />
          <InfoRow label="Ürünler" value={`${parseFloat(order.subtotal || 0).toFixed(2)} ${order.currency}`} />
          {parseFloat(order.shipping_total) > 0 && (
            <InfoRow label="Kargo" value={`${parseFloat(order.shipping_total).toFixed(2)} ${order.currency}`} />
          )}
          {parseFloat(order.discount_total) > 0 && (
            <InfoRow label="İndirim" value={`-${parseFloat(order.discount_total).toFixed(2)} ${order.currency}`} />
          )}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Toplam</Text>
            <Text style={styles.totalValue}>
              {parseFloat(order.total).toFixed(2)} {order.currency}
            </Text>
          </View>
        </SectionCard>

        {/* Müşteri Notu */}
        {order.customer_note ? (
          <SectionCard title="Müşteri Notu" icon="chatbox-outline">
            <Text style={styles.noteText}>{order.customer_note}</Text>
          </SectionCard>
        ) : null}
      </ScrollView>

      {/* Alt Aksiyonlar */}
      <View style={styles.actions}>
        {order.status === 'processing' && (
          <>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnSecondary]}
              onPress={() => handleStatusChange('on-hold')}
              disabled={actionLoading}
            >
              <Ionicons name="pause-circle-outline" size={18} color="#3B82F6" />
              <Text style={[styles.actionBtnText, { color: '#3B82F6' }]}>Beklet</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnPrimary, !allCollected && styles.actionBtnDisabled]}
              onPress={() => setTrackingModal(true)}
              disabled={!allCollected || actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="car-outline" size={18} color="#fff" />
                  <Text style={styles.actionBtnText}>
                    {allCollected ? 'Kargoya Ver' : `Topla (${collectedCount}/${order.line_items.length})`}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}

        {order.status === 'pending' && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnPrimary]}
            onPress={() => handleStatusChange('processing')}
            disabled={actionLoading}
          >
            <Ionicons name="construct-outline" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>İşleme Al</Text>
          </TouchableOpacity>
        )}

        {order.status === 'on-hold' && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnPrimary]}
            onPress={() => handleStatusChange('processing')}
            disabled={actionLoading}
          >
            <Ionicons name="play-circle-outline" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>İşleme Devam Et</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Kargo Modal */}
      <Modal visible={trackingModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Kargo Bilgileri</Text>

            <Text style={styles.modalLabel}>Kargo Firması</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.carrierList}>
              {CARRIERS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.carrierChip, selectedCarrier === c && styles.carrierChipActive]}
                  onPress={() => setSelectedCarrier(c)}
                >
                  <Text style={[styles.carrierText, selectedCarrier === c && styles.carrierTextActive]}>
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.modalLabel}>Takip Numarası</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="123456789012"
              placeholderTextColor="#555"
              value={trackingNumber}
              onChangeText={setTrackingNumber}
              keyboardType="number-pad"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setTrackingModal(false)}
              >
                <Text style={styles.modalCancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleShipOrder}
                disabled={actionLoading}
              >
                {actionLoading ? (
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

const SectionCard = ({ title, icon, children }) => (
  <View style={styles.sectionCard}>
    <View style={styles.sectionHeader}>
      <Ionicons name={icon} size={18} color="#6C63FF" />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
    {children}
  </View>
);

const InfoRow = ({ label, value }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f0f1a' },
  scroll: { padding: 16, gap: 12, paddingBottom: 100 },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orderNum: { fontSize: 22, fontWeight: '800', color: '#fff' },
  orderDate: { fontSize: 12, color: '#666', marginTop: 4 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  statusText: { fontSize: 13, fontWeight: '700' },
  sectionCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a2a3e',
    gap: 10,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#fff', flex: 1 },
  progressBadge: {
    backgroundColor: '#6C63FF',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  progressText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  infoLabel: { fontSize: 12, color: '#666', flex: 1 },
  infoValue: { fontSize: 13, color: '#ddd', flex: 2, textAlign: 'right' },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#2a2a3e',
  },
  productRowChecked: { opacity: 0.5 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: '#10B981', borderColor: '#10B981' },
  productInfo: { flex: 1 },
  productName: { fontSize: 13, color: '#ddd', fontWeight: '500' },
  productNameChecked: { textDecorationLine: 'line-through', color: '#666' },
  sku: { fontSize: 11, color: '#555', marginTop: 2 },
  variant: { fontSize: 11, color: '#6C63FF', marginTop: 2 },
  productQty: {
    backgroundColor: '#2a2a3e',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  productQtyText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#2a2a3e',
    paddingTop: 10,
    marginTop: 4,
  },
  totalLabel: { fontSize: 14, fontWeight: '700', color: '#fff' },
  totalValue: { fontSize: 16, fontWeight: '800', color: '#6C63FF' },
  noteText: { fontSize: 13, color: '#aaa', lineHeight: 20 },
  actions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1a1a2e',
    padding: 16,
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#2a2a3e',
  },
  actionBtn: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionBtnPrimary: { backgroundColor: '#6C63FF' },
  actionBtnSecondary: {
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  actionBtnDisabled: { backgroundColor: '#333', opacity: 0.6 },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#2a2a3e',
    gap: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 4 },
  modalLabel: { fontSize: 12, color: '#888', fontWeight: '600', textTransform: 'uppercase' },
  carrierList: { maxHeight: 44 },
  carrierChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#0f0f1a',
    borderWidth: 1,
    borderColor: '#2a2a3e',
    marginRight: 8,
  },
  carrierChipActive: { backgroundColor: '#6C63FF', borderColor: '#6C63FF' },
  carrierText: { color: '#888', fontSize: 13 },
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
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
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
