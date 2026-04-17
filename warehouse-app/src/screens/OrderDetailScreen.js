import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Modal, TextInput, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { getOrder, updateOrderStatus, addOrderNote, setTrackingNumber } from '../api/woocommerce';
import { createShipment, acceptOffer, hasGeliver, trackingUrl } from '../api/geliver';
import { useApp } from '../context/AppContext';

const STATUS_COLORS = {
  pending: '#F59E0B', processing: '#6C63FF',
  'on-hold': '#3B82F6', completed: '#10B981', cancelled: '#EF4444',
};
const STATUS_LABELS = {
  pending: 'Bekleyen', processing: 'İşlemde',
  'on-hold': 'Beklemede', completed: 'Tamamlandı', cancelled: 'İptal',
};
const CARRIERS = ['Yurtiçi Kargo','Aras Kargo','MNG Kargo','PTT Kargo','Sürat Kargo','Sendeo','UPS','DHL'];

export default function OrderDetailScreen({ route, navigation }) {
  const { orderId } = route.params;
  const { credentials } = useApp();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [collected, setCollected] = useState({});

  // Manuel kargo modal
  const [trackingModal, setTrackingModal] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [selectedCarrier, setSelectedCarrier] = useState(CARRIERS[0]);

  // Geliver modal
  const [geliverModal, setGeliverModal] = useState(false);
  const [geliverStep, setGeliverStep] = useState('dims'); // 'dims' | 'offers' | 'done'
  const [dims, setDims] = useState({ length: '20', width: '15', height: '10', weight: '1' });
  const [offers, setOffers] = useState([]);
  const [shipmentId, setShipmentId] = useState(null);
  const [geliverResult, setGeliverResult] = useState(null);
  const [geliverLoading, setGeliverLoading] = useState(false);

  const fetchOrder = useCallback(async () => {
    try {
      const data = await getOrder(orderId);
      setOrder(data);
    } catch {
      Alert.alert('Hata', 'Sipariş yüklenemedi.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  const toggleCollected = (itemId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCollected((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const allCollected = order?.line_items?.length > 0 && order.line_items.every((i) => collected[i.id]);

  const handleStatusChange = async (newStatus) => {
    Alert.alert('Durum Güncelle', `"${STATUS_LABELS[newStatus]}" olarak güncellensin mi?`, [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Güncelle', onPress: async () => {
          setActionLoading(true);
          try {
            const updated = await updateOrderStatus(orderId, newStatus);
            setOrder(updated);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch {
            Alert.alert('Hata', 'Durum güncellenemedi.');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const openShipModal = () => {
    if (hasGeliver() && credentials?.geliverSenderAddressId) {
      setGeliverStep('dims');
      setOffers([]);
      setGeliverResult(null);
      setGeliverModal(true);
    } else {
      setTrackingModal(true);
    }
  };

  // Manuel kargo
  const handleManualShip = async () => {
    if (!trackingNumber.trim()) { Alert.alert('Hata', 'Takip numarası giriniz.'); return; }
    setActionLoading(true);
    try {
      const updated = await setTrackingNumber(orderId, trackingNumber.trim(), selectedCarrier);
      setOrder(updated);
      await addOrderNote(orderId, `Kargo: ${selectedCarrier} — ${trackingNumber.trim()}`, true);
      setTrackingModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Başarılı', 'Kargo bilgisi kaydedildi.');
    } catch {
      Alert.alert('Hata', 'Kargo işlemi tamamlanamadı.');
    } finally {
      setActionLoading(false);
    }
  };

  // Geliver: fiyat al
  const handleGetOffers = async () => {
    setGeliverLoading(true);
    try {
      const result = await createShipment({
        senderAddressID: credentials.geliverSenderAddressId,
        order,
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

  // Geliver: teklif kabul et
  const handleAcceptOffer = async (offerId, offerInfo) => {
    setGeliverLoading(true);
    try {
      const result = await acceptOffer(offerId);
      const trkNum = result.trackingNumber || result.barcode || '';
      await setTrackingNumber(orderId, trkNum, offerInfo.provider);
      await addOrderNote(orderId, `Geliver kargo: ${offerInfo.provider} — ${trkNum}`, true);
      const updated = await updateOrderStatus(orderId, 'completed');
      setOrder(updated);
      setGeliverResult({
        trackingNumber: trkNum,
        labelURL: result.labelURL,
        shipmentId: shipmentId,
        provider: offerInfo.provider,
      });
      setGeliverStep('done');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Alert.alert('Geliver Hatası', err?.response?.data?.message || err.message || 'Etiket oluşturulamadı.');
    } finally {
      setGeliverLoading(false);
    }
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator color="#6C63FF" size="large" /></View>;
  if (!order) return null;

  const statusColor = STATUS_COLORS[order.status] || '#888';
  const statusLabel = STATUS_LABELS[order.status] || order.status;
  const collectedCount = Object.values(collected).filter(Boolean).length;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.orderHeader}>
          <View>
            <Text style={styles.orderNum}>Sipariş #{order.number}</Text>
            <Text style={styles.orderDate}>{new Date(order.date_created).toLocaleString('tr-TR')}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>

        <SectionCard title="Müşteri" icon="person-outline">
          <InfoRow label="Ad Soyad" value={`${order.billing.first_name} ${order.billing.last_name}`} />
          <InfoRow label="Telefon" value={order.billing.phone || '—'} />
          <InfoRow label="E-posta" value={order.billing.email || '—'} />
        </SectionCard>

        <SectionCard title="Teslimat Adresi" icon="location-outline">
          <InfoRow label="Adres" value={`${order.shipping.address_1}${order.shipping.address_2 ? '\n' + order.shipping.address_2 : ''}`} />
          <InfoRow label="İlçe / İl" value={`${order.shipping.city} / ${order.shipping.state}`} />
          <InfoRow label="Posta Kodu" value={order.shipping.postcode || '—'} />
        </SectionCard>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="cube-outline" size={18} color="#6C63FF" />
            <Text style={styles.sectionTitle}>Ürünler</Text>
            <View style={styles.progressBadge}>
              <Text style={styles.progressText}>{collectedCount}/{order.line_items.length}</Text>
            </View>
          </View>
          {order.line_items.map((item) => (
            <TouchableOpacity key={item.id}
              style={[styles.productRow, collected[item.id] && styles.productRowChecked]}
              onPress={() => toggleCollected(item.id)}
            >
              <View style={[styles.checkbox, collected[item.id] && styles.checkboxChecked]}>
                {collected[item.id] && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
              <View style={styles.productInfo}>
                <Text style={[styles.productName, collected[item.id] && styles.productNameChecked]}>{item.name}</Text>
                {item.sku ? <Text style={styles.sku}>SKU: {item.sku}</Text> : null}
                {item.meta_data?.filter(m => !m.key.startsWith('_')).length > 0 && (
                  <Text style={styles.variant}>
                    {item.meta_data.filter(m => !m.key.startsWith('_')).map(m => `${m.display_key}: ${m.display_value}`).join(' | ')}
                  </Text>
                )}
              </View>
              <View style={styles.productQty}>
                <Text style={styles.productQtyText}>x{item.quantity}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

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
            <Text style={styles.totalValue}>{parseFloat(order.total).toFixed(2)} {order.currency}</Text>
          </View>
        </SectionCard>

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
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnSecondary]}
              onPress={() => handleStatusChange('on-hold')} disabled={actionLoading}>
              <Ionicons name="pause-circle-outline" size={18} color="#3B82F6" />
              <Text style={[styles.actionBtnText, { color: '#3B82F6' }]}>Beklet</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnPrimary, !allCollected && styles.actionBtnDisabled]}
              onPress={openShipModal} disabled={!allCollected || actionLoading}
            >
              {actionLoading ? <ActivityIndicator color="#fff" size="small" /> : (
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
          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnPrimary]}
            onPress={() => handleStatusChange('processing')} disabled={actionLoading}>
            <Ionicons name="construct-outline" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>İşleme Al</Text>
          </TouchableOpacity>
        )}
        {order.status === 'on-hold' && (
          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnPrimary]}
            onPress={() => handleStatusChange('processing')} disabled={actionLoading}>
            <Ionicons name="play-circle-outline" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>İşleme Devam Et</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Manuel Kargo Modal */}
      <Modal visible={trackingModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Kargo Bilgileri</Text>
            <Text style={styles.modalLabel}>Kargo Firması</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipList}>
              {CARRIERS.map((c) => (
                <TouchableOpacity key={c}
                  style={[styles.chip, selectedCarrier === c && styles.chipActive]}
                  onPress={() => setSelectedCarrier(c)}>
                  <Text style={[styles.chipText, selectedCarrier === c && styles.chipTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.modalLabel}>Takip Numarası</Text>
            <TextInput style={styles.modalInput} placeholder="123456789012" placeholderTextColor="#555"
              value={trackingNumber} onChangeText={setTrackingNumber} keyboardType="number-pad" />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setTrackingModal(false)}>
                <Text style={styles.cancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleManualShip} disabled={actionLoading}>
                {actionLoading ? <ActivityIndicator color="#fff" size="small" /> : (
                  <Text style={styles.confirmText}>Kargoya Ver</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Geliver Modal */}
      <Modal visible={geliverModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>

            {/* Başlık */}
            <View style={styles.geliverHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {geliverStep === 'dims' && 'Paket Boyutları'}
                  {geliverStep === 'offers' && 'Kargo Firmaları'}
                  {geliverStep === 'done' && 'Kargo Oluşturuldu'}
                </Text>
                <Text style={styles.modalSubtitle}>Sipariş #{order?.number}</Text>
              </View>
              {geliverStep !== 'done' && (
                <TouchableOpacity onPress={() => setGeliverModal(false)}>
                  <Ionicons name="close-circle-outline" size={24} color="#555" />
                </TouchableOpacity>
              )}
            </View>

            {/* ADIM 1: Boyutlar */}
            {geliverStep === 'dims' && (
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
                      <TextInput
                        style={styles.dimInput}
                        value={dims[key]}
                        onChangeText={(v) => setDims((p) => ({ ...p, [key]: v }))}
                        keyboardType="decimal-pad"
                        selectTextOnFocus
                      />
                    </View>
                  ))}
                </View>
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setGeliverModal(false)}>
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

            {/* ADIM 2: Teklifler */}
            {geliverStep === 'offers' && (
              <>
                {offers.length === 0 ? (
                  <Text style={styles.noOffers}>Teklif bulunamadı.</Text>
                ) : (
                  offers.map((offer) => (
                    <TouchableOpacity
                      key={offer.id}
                      style={styles.offerRow}
                      onPress={() => handleAcceptOffer(offer.id, offer)}
                      disabled={geliverLoading}
                    >
                      <View style={styles.offerInfo}>
                        <Ionicons name="car-outline" size={20} color="#6C63FF" />
                        <Text style={styles.offerProvider}>{offer.provider}</Text>
                      </View>
                      <View style={styles.offerRight}>
                        <Text style={styles.offerPrice}>
                          {parseFloat(offer.price).toFixed(2)} {offer.currency || 'TRY'}
                        </Text>
                        {geliverLoading ? (
                          <ActivityIndicator size="small" color="#6C63FF" />
                        ) : (
                          <View style={styles.selectBtn}>
                            <Text style={styles.selectBtnText}>Seç</Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))
                )}
                <TouchableOpacity style={[styles.cancelBtn, { marginTop: 8 }]} onPress={() => setGeliverStep('dims')}>
                  <Text style={styles.cancelText}>← Geri</Text>
                </TouchableOpacity>
              </>
            )}

            {/* ADIM 3: Başarı */}
            {geliverStep === 'done' && geliverResult && (
              <>
                <View style={styles.successIcon}>
                  <Ionicons name="checkmark-circle" size={56} color="#10B981" />
                </View>
                <Text style={styles.successTitle}>{geliverResult.provider}</Text>
                <Text style={styles.successTracking}>{geliverResult.trackingNumber}</Text>

                <View style={styles.successBtns}>
                  {geliverResult.labelURL && (
                    <TouchableOpacity style={styles.labelBtn}
                      onPress={() => Linking.openURL(geliverResult.labelURL)}>
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

                <TouchableOpacity style={styles.confirmBtn} onPress={() => setGeliverModal(false)}>
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
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  orderNum: { fontSize: 22, fontWeight: '800', color: '#fff' },
  orderDate: { fontSize: 12, color: '#666', marginTop: 4 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  statusText: { fontSize: 13, fontWeight: '700' },
  sectionCard: { backgroundColor: '#1a1a2e', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#2a2a3e', gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#fff', flex: 1 },
  progressBadge: { backgroundColor: '#6C63FF', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  progressText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  infoLabel: { fontSize: 12, color: '#666', flex: 1 },
  infoValue: { fontSize: 13, color: '#ddd', flex: 2, textAlign: 'right' },
  productRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#2a2a3e' },
  productRowChecked: { opacity: 0.5 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#444', alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: '#10B981', borderColor: '#10B981' },
  productInfo: { flex: 1 },
  productName: { fontSize: 13, color: '#ddd', fontWeight: '500' },
  productNameChecked: { textDecorationLine: 'line-through', color: '#666' },
  sku: { fontSize: 11, color: '#555', marginTop: 2 },
  variant: { fontSize: 11, color: '#6C63FF', marginTop: 2 },
  productQty: { backgroundColor: '#2a2a3e', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  productQtyText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#2a2a3e', paddingTop: 10, marginTop: 4 },
  totalLabel: { fontSize: 14, fontWeight: '700', color: '#fff' },
  totalValue: { fontSize: 16, fontWeight: '800', color: '#6C63FF' },
  noteText: { fontSize: 13, color: '#aaa', lineHeight: 20 },
  actions: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#1a1a2e', padding: 16, flexDirection: 'row', gap: 10, borderTopWidth: 1, borderTopColor: '#2a2a3e' },
  actionBtn: { flex: 1, borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  actionBtnPrimary: { backgroundColor: '#6C63FF' },
  actionBtnSecondary: { backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: '#3B82F6' },
  actionBtnDisabled: { backgroundColor: '#333', opacity: 0.6 },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  // Modal ortak
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#1a1a2e', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderWidth: 1, borderColor: '#2a2a3e', gap: 14 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  modalSubtitle: { fontSize: 12, color: '#666', marginTop: 2 },
  modalLabel: { fontSize: 11, color: '#888', fontWeight: '700', textTransform: 'uppercase' },
  modalInput: { backgroundColor: '#0f0f1a', borderRadius: 10, padding: 12, color: '#fff', fontSize: 15, borderWidth: 1, borderColor: '#2a2a3e' },
  modalActions: { flexDirection: 'row', gap: 10 },
  chipList: { maxHeight: 44 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#0f0f1a', borderWidth: 1, borderColor: '#2a2a3e', marginRight: 8 },
  chipActive: { backgroundColor: '#6C63FF', borderColor: '#6C63FF' },
  chipText: { color: '#888', fontSize: 13 },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  cancelBtn: { flex: 1, backgroundColor: '#2a2a3e', borderRadius: 12, padding: 14, alignItems: 'center' },
  cancelText: { color: '#aaa', fontWeight: '600' },
  confirmBtn: { flex: 2, backgroundColor: '#6C63FF', borderRadius: 12, padding: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  confirmText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  // Geliver
  geliverHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
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
