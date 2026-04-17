import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, TextInput, Modal, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { getShipments, setTrackingNumber, addOrderNote, updateOrderStatus } from '../api/woocommerce';
import { createShipment, acceptOffer, hasGeliver, trackingUrl } from '../api/geliver';
import { useApp } from '../context/AppContext';

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
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
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
        <Text style={styles.customerName}>{order.billing?.first_name} {order.billing?.last_name}</Text>
      </View>
      <View style={styles.cardRow}>
        <Ionicons name="location-outline" size={14} color="#666" />
        <Text style={styles.address} numberOfLines={1}>{order.shipping?.address_1}, {order.shipping?.city}</Text>
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
        <Text style={styles.orderTotal}>{parseFloat(order.total).toFixed(2)} {order.currency}</Text>
      </View>
    </TouchableOpacity>
  );
};

export default function ShippingScreen({ navigation }) {
  const { credentials } = useApp();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [selected, setSelected] = useState([]);

  // Seçili sipariş (modal için)
  const [activeOrder, setActiveOrder] = useState(null);

  // Manuel kargo state
  const [trackingNum, setTrackingNum] = useState('');
  const [carrier, setCarrier] = useState(CARRIERS[0].name);
  const [saving, setSaving] = useState(false);

  // Geliver state
  const [geliverStep, setGeliverStep] = useState('dims');
  const [dims, setDims] = useState({ length: '20', width: '15', height: '10', weight: '1' });
  const [offers, setOffers] = useState([]);
  const [shipmentId, setShipmentId] = useState(null);
  const [geliverResult, setGeliverResult] = useState(null);
  const [geliverLoading, setGeliverLoading] = useState(false);

  const useGeliver = hasGeliver() && !!credentials?.geliverSenderAddressId;

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

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const onRefresh = () => { setRefreshing(true); fetchOrders(); };

  const toggleSelect = (orderId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected((prev) => prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]);
  };

  const openModal = (order) => {
    setActiveOrder(order);
    setTrackingNum('');
    setCarrier(CARRIERS[0].name);
    setGeliverStep('dims');
    setOffers([]);
    setGeliverResult(null);
  };

  const closeModal = () => setActiveOrder(null);

  // Manuel kargo
  const handleManualShip = async () => {
    if (!trackingNum.trim()) { Alert.alert('Hata', 'Takip numarası giriniz.'); return; }
    setSaving(true);
    try {
      await setTrackingNumber(activeOrder.id, trackingNum.trim(), carrier);
      await addOrderNote(activeOrder.id, `Kargo: ${carrier} — ${trackingNum.trim()}`, true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      closeModal();
      fetchOrders();
    } catch {
      Alert.alert('Hata', 'Kargo işlemi tamamlanamadı.');
    } finally {
      setSaving(false);
    }
  };

  // Geliver: fiyat al
  const handleGetOffers = async () => {
    setGeliverLoading(true);
    try {
      const result = await createShipment({
        senderAddressID: credentials.geliverSenderAddressId,
        order: activeOrder,
        dims,
      });
      setShipmentId(result.id);
      setOffers(result.offers || []);
      setGeliverStep('offers');
    } catch (err) {
      Alert.alert('Geliver Hatası', err?.response?.data?.message || err.message || 'Fiyat alınamadı.');
    } finally {
      setGeliverLoading(false);
    }
  };

  // Geliver: teklif kabul
  const handleAcceptOffer = async (offerId, offerInfo) => {
    setGeliverLoading(true);
    try {
      const result = await acceptOffer(offerId);
      const trkNum = result.trackingNumber || result.barcode || '';
      await setTrackingNumber(activeOrder.id, trkNum, offerInfo.provider);
      await addOrderNote(activeOrder.id, `Geliver kargo: ${offerInfo.provider} — ${trkNum}`, true);
      setGeliverResult({
        trackingNumber: trkNum,
        labelURL: result.labelURL,
        shipmentId: shipmentId,
        provider: offerInfo.provider,
      });
      setGeliverStep('done');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      fetchOrders();
    } catch (err) {
      Alert.alert('Geliver Hatası', err?.response?.data?.message || err.message || 'Etiket oluşturulamadı.');
    } finally {
      setGeliverLoading(false);
    }
  };

  const readyOrders = orders.filter(o => !o.meta_data?.find(m => m.key === '_tracking_number')?.value);
  const shippedOrders = orders.filter(o => o.meta_data?.find(m => m.key === '_tracking_number')?.value);

  return (
    <View style={styles.container}>
      {/* Özet bar */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#F59E0B' }]}>{readyOrders.length}</Text>
          <Text style={styles.statLabel}>Hazırlanacak</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#10B981' }]}>{shippedOrders.length}</Text>
          <Text style={styles.statLabel}>Kargoda</Text>
        </View>
        {useGeliver && (
          <View style={styles.geliverBadge}>
            <Ionicons name="car-outline" size={13} color="#6C63FF" />
            <Text style={styles.geliverBadgeText}>Geliver</Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.bulkBtn, bulkMode && styles.bulkBtnActive]}
          onPress={() => { setBulkMode(!bulkMode); setSelected([]); }}
        >
          <Ionicons name={bulkMode ? 'close-outline' : 'checkbox-outline'} size={16}
            color={bulkMode ? '#EF4444' : '#6C63FF'} />
          <Text style={[styles.bulkBtnText, bulkMode && { color: '#EF4444' }]}>
            {bulkMode ? 'İptal' : 'Toplu Seç'}
          </Text>
        </TouchableOpacity>
      </View>

      {bulkMode && selected.length > 0 && (
        <View style={styles.bulkBar}>
          <Text style={styles.bulkBarText}>{selected.length} sipariş seçildi</Text>
          <TouchableOpacity style={styles.bulkActionBtn}
            onPress={() => Alert.alert('Bilgi', 'Toplu Geliver entegrasyonu yakında.')}>
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
                onPress={() => bulkMode ? toggleSelect(item.id) : openModal(item)}
              />
            </View>
          )}
        />
      )}

      {/* Kargo Modal */}
      <Modal visible={!!activeOrder} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>

            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {!useGeliver ? 'Kargoya Ver' :
                    geliverStep === 'dims' ? 'Paket Boyutları' :
                    geliverStep === 'offers' ? 'Kargo Firmaları' : 'Kargo Oluşturuldu'}
                </Text>
                {activeOrder && (
                  <Text style={styles.modalSubtitle}>
                    #{activeOrder.number} — {activeOrder.billing?.first_name} {activeOrder.billing?.last_name}
                  </Text>
                )}
              </View>
              {geliverStep !== 'done' && (
                <TouchableOpacity onPress={closeModal}>
                  <Ionicons name="close-circle-outline" size={24} color="#555" />
                </TouchableOpacity>
              )}
            </View>

            {/* Manuel akış */}
            {!useGeliver && (
              <>
                <Text style={styles.sectionLabel}>Kargo Firması</Text>
                <FlatList horizontal data={CARRIERS} keyExtractor={c => c.name}
                  showsHorizontalScrollIndicator={false} style={styles.chipList}
                  renderItem={({ item: c }) => (
                    <TouchableOpacity
                      style={[styles.chip, carrier === c.name && styles.chipActive]}
                      onPress={() => setCarrier(c.name)}
                    >
                      <Ionicons name={c.icon} size={15} color={carrier === c.name ? '#fff' : '#888'} />
                      <Text style={[styles.chipText, carrier === c.name && styles.chipTextActive]}>{c.name}</Text>
                    </TouchableOpacity>
                  )}
                />
                <Text style={styles.sectionLabel}>Takip Numarası</Text>
                <TextInput style={styles.modalInput} placeholder="Kargo takip numarası"
                  placeholderTextColor="#555" value={trackingNum} onChangeText={setTrackingNum} />
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                    <Text style={styles.cancelText}>İptal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.confirmBtn} onPress={handleManualShip} disabled={saving}>
                    {saving ? <ActivityIndicator color="#fff" size="small" /> :
                      <Text style={styles.confirmText}>Kargoya Ver</Text>}
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Geliver: Boyutlar */}
            {useGeliver && geliverStep === 'dims' && (
              <>
                <View style={styles.dimsGrid}>
                  {[
                    { key: 'length', label: 'Uzunluk (cm)' },
                    { key: 'width',  label: 'Genişlik (cm)' },
                    { key: 'height', label: 'Yükseklik (cm)' },
                    { key: 'weight', label: 'Ağırlık (kg)' },
                  ].map(({ key, label }) => (
                    <View key={key} style={styles.dimItem}>
                      <Text style={styles.dimLabel}>{label}</Text>
                      <TextInput style={styles.dimInput} value={dims[key]}
                        onChangeText={v => setDims(p => ({ ...p, [key]: v }))}
                        keyboardType="decimal-pad" selectTextOnFocus />
                    </View>
                  ))}
                </View>
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                    <Text style={styles.cancelText}>İptal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.confirmBtn} onPress={handleGetOffers} disabled={geliverLoading}>
                    {geliverLoading ? <ActivityIndicator color="#fff" size="small" /> : (
                      <>
                        <Ionicons name="pricetag-outline" size={16} color="#fff" />
                        <Text style={styles.confirmText}>Fiyat Al</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Geliver: Teklifler */}
            {useGeliver && geliverStep === 'offers' && (
              <>
                {offers.length === 0 ? (
                  <Text style={styles.noOffers}>Teklif bulunamadı.</Text>
                ) : offers.map(offer => (
                  <TouchableOpacity key={offer.id} style={styles.offerRow}
                    onPress={() => handleAcceptOffer(offer.id, offer)} disabled={geliverLoading}>
                    <View style={styles.offerInfo}>
                      <Ionicons name="car-outline" size={20} color="#6C63FF" />
                      <Text style={styles.offerProvider}>{offer.provider}</Text>
                    </View>
                    <View style={styles.offerRight}>
                      <Text style={styles.offerPrice}>{parseFloat(offer.price).toFixed(2)} {offer.currency || 'TRY'}</Text>
                      {geliverLoading ? <ActivityIndicator size="small" color="#6C63FF" /> : (
                        <View style={styles.selectBtn}><Text style={styles.selectBtnText}>Seç</Text></View>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={[styles.cancelBtn, { marginTop: 4 }]} onPress={() => setGeliverStep('dims')}>
                  <Text style={styles.cancelText}>← Geri</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Geliver: Başarı */}
            {useGeliver && geliverStep === 'done' && geliverResult && (
              <>
                <View style={styles.successIcon}>
                  <Ionicons name="checkmark-circle" size={56} color="#10B981" />
                </View>
                <Text style={styles.successTitle}>{geliverResult.provider}</Text>
                <Text style={styles.successTracking}>{geliverResult.trackingNumber}</Text>
                <View style={styles.successBtns}>
                  {geliverResult.labelURL && (
                    <TouchableOpacity style={styles.labelBtn} onPress={() => Linking.openURL(geliverResult.labelURL)}>
                      <Ionicons name="print-outline" size={16} color="#fff" />
                      <Text style={styles.labelBtnText}>Etiketi Yazdır</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.trackBtn}
                    onPress={() => Linking.openURL(trackingUrl(geliverResult.shipmentId))}>
                    <Ionicons name="navigate-outline" size={16} color="#6C63FF" />
                    <Text style={styles.trackBtnText}>Takip Et</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.confirmBtn} onPress={closeModal}>
                  <Text style={styles.confirmText}>Tamam</Text>
                </TouchableOpacity>
              </>
            )}

          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  statsRow: { flexDirection: 'row', backgroundColor: '#1a1a2e', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2a2a3e', alignItems: 'center', gap: 16 },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 11, color: '#666', marginTop: 2 },
  geliverBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#6C63FF20', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: '#6C63FF40' },
  geliverBadgeText: { color: '#6C63FF', fontSize: 11, fontWeight: '700' },
  bulkBtn: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#6C63FF20', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#6C63FF' },
  bulkBtnActive: { borderColor: '#EF4444', backgroundColor: '#EF444420' },
  bulkBtnText: { color: '#6C63FF', fontSize: 12, fontWeight: '700' },
  bulkBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a2e', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#2a2a3e' },
  bulkBarText: { color: '#fff', fontSize: 13, flex: 1 },
  bulkActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#6C63FF', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  bulkActionText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  listContent: { padding: 12, gap: 10 },
  card: { backgroundColor: '#1a1a2e', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#2a2a3e', gap: 8 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  orderNum: { fontSize: 16, fontWeight: '800', color: '#fff' },
  orderDate: { fontSize: 11, color: '#555' },
  shippedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#10B98120', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  shippedText: { color: '#10B981', fontSize: 12, fontWeight: '600' },
  pendingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F59E0B20', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  pendingText: { color: '#F59E0B', fontSize: 12, fontWeight: '600' },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  customerName: { color: '#ddd', fontSize: 13, fontWeight: '500' },
  address: { color: '#888', fontSize: 12, flex: 1 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  cardChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#2a2a3e', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  chipText: { color: '#aaa', fontSize: 11 },
  orderTotal: { marginLeft: 'auto', color: '#6C63FF', fontWeight: '700', fontSize: 13 },
  selectOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1, borderRadius: 14, backgroundColor: 'transparent', padding: 14 },
  selectOverlayActive: { backgroundColor: 'rgba(108,99,255,0.1)', borderWidth: 2, borderColor: '#6C63FF' },
  selectCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#444', backgroundColor: '#0f0f1a', alignItems: 'center', justifyContent: 'center' },
  selectCircleActive: { backgroundColor: '#6C63FF', borderColor: '#6C63FF' },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { color: '#444', fontSize: 16 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#1a1a2e', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderWidth: 1, borderColor: '#2a2a3e', gap: 14 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  modalSubtitle: { fontSize: 12, color: '#666', marginTop: 2 },
  sectionLabel: { fontSize: 11, color: '#888', fontWeight: '700', textTransform: 'uppercase' },
  modalInput: { backgroundColor: '#0f0f1a', borderRadius: 10, padding: 12, color: '#fff', fontSize: 15, borderWidth: 1, borderColor: '#2a2a3e' },
  modalActions: { flexDirection: 'row', gap: 10 },
  chipList: { maxHeight: 48 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#0f0f1a', borderWidth: 1, borderColor: '#2a2a3e', marginRight: 8 },
  chipActive: { backgroundColor: '#6C63FF', borderColor: '#6C63FF' },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  cancelBtn: { flex: 1, backgroundColor: '#2a2a3e', borderRadius: 12, padding: 14, alignItems: 'center' },
  cancelText: { color: '#aaa', fontWeight: '600' },
  confirmBtn: { flex: 2, backgroundColor: '#6C63FF', borderRadius: 12, padding: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  confirmText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  // Geliver
  dimsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  dimItem: { width: '47%' },
  dimLabel: { fontSize: 11, color: '#888', fontWeight: '600', marginBottom: 6 },
  dimInput: { backgroundColor: '#0f0f1a', borderRadius: 10, padding: 12, color: '#fff', fontSize: 16, fontWeight: '700', borderWidth: 1, borderColor: '#2a2a3e', textAlign: 'center' },
  noOffers: { color: '#666', textAlign: 'center', paddingVertical: 20 },
  offerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0f0f1a', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#2a2a3e' },
  offerInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  offerProvider: { color: '#fff', fontWeight: '600', fontSize: 14 },
  offerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  offerPrice: { color: '#10B981', fontWeight: '800', fontSize: 16 },
  selectBtn: { backgroundColor: '#6C63FF', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6 },
  selectBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  successIcon: { alignItems: 'center', paddingVertical: 8 },
  successTitle: { textAlign: 'center', fontSize: 16, fontWeight: '700', color: '#fff' },
  successTracking: { textAlign: 'center', fontSize: 13, color: '#888', letterSpacing: 1 },
  successBtns: { flexDirection: 'row', gap: 10 },
  labelBtn: { flex: 1, backgroundColor: '#2a2a3e', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  labelBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  trackBtn: { flex: 1, backgroundColor: '#6C63FF20', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: '#6C63FF' },
  trackBtnText: { color: '#6C63FF', fontWeight: '600', fontSize: 13 },
});
