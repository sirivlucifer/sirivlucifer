import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Vibration,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { searchProductByBarcode } from '../api/woocommerce';

export default function BarcodeScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [product, setProduct] = useState(null);
  const [manualCode, setManualCode] = useState('');
  const [flashOn, setFlashOn] = useState(false);
  const lastScan = useRef(null);

  const handleBarCodeScanned = async ({ data }) => {
    if (!scanning || processing) return;
    // Aynı barkodu 2 saniye içinde tekrar okuma
    if (lastScan.current === data) return;
    lastScan.current = data;

    setScanning(false);
    setProcessing(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Vibration.vibrate(100);

    await lookupProduct(data);

    // 2 saniye sonra tekrar taramaya izin ver
    setTimeout(() => {
      lastScan.current = null;
      setScanning(true);
    }, 2000);
  };

  const lookupProduct = async (barcode) => {
    try {
      const found = await searchProductByBarcode(barcode);
      if (found) {
        setProduct({ ...found, scannedBarcode: barcode });
      } else {
        setProduct(null);
        Alert.alert('Ürün Bulunamadı', `"${barcode}" barkoduna ait ürün mağazanızda yok.`);
      }
    } catch (err) {
      Alert.alert('Hata', 'Ürün aranırken bir hata oluştu.');
    } finally {
      setProcessing(false);
    }
  };

  const handleManualSearch = () => {
    if (!manualCode.trim()) return;
    setProcessing(true);
    setProduct(null);
    lookupProduct(manualCode.trim());
  };

  const resetScan = () => {
    setProduct(null);
    setManualCode('');
    setScanning(true);
    lastScan.current = null;
  };

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#6C63FF" size="large" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Ionicons name="camera-off-outline" size={64} color="#444" />
        <Text style={styles.permissionText}>Kamera izni gereklidir</Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionBtnText}>İzin Ver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Kamera */}
      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          facing="back"
          enableTorch={flashOn}
          onBarcodeScanned={scanning && !processing ? handleBarCodeScanned : undefined}
          barcodeScannerSettings={{
            barcodeTypes: [
              'ean13', 'ean8', 'upc_a', 'upc_e',
              'code128', 'code39', 'qr', 'itf14',
            ],
          }}
        >
          {/* Tarama çerçevesi */}
          <View style={styles.overlay}>
            <View style={styles.scanFrame}>
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
              {processing && (
                <ActivityIndicator color="#6C63FF" size="large" style={styles.scanSpinner} />
              )}
            </View>
            <Text style={styles.scanHint}>
              {processing ? 'Ürün aranıyor...' : 'Barkodu çerçeve içine hizalayın'}
            </Text>
          </View>

          {/* Flash Toggle */}
          <TouchableOpacity
            style={styles.flashBtn}
            onPress={() => setFlashOn(!flashOn)}
          >
            <Ionicons
              name={flashOn ? 'flash' : 'flash-outline'}
              size={24}
              color={flashOn ? '#F59E0B' : '#fff'}
            />
          </TouchableOpacity>
        </CameraView>
      </View>

      {/* Manuel Giriş */}
      <View style={styles.manualSection}>
        <View style={styles.manualRow}>
          <TextInput
            style={styles.manualInput}
            placeholder="Manuel barkod gir..."
            placeholderTextColor="#555"
            value={manualCode}
            onChangeText={setManualCode}
            keyboardType="default"
            returnKeyType="search"
            onSubmitEditing={handleManualSearch}
          />
          <TouchableOpacity style={styles.manualSearchBtn} onPress={handleManualSearch}>
            <Ionicons name="search-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Ürün Sonucu */}
      {product && (
        <ScrollView style={styles.resultPanel}>
          <View style={styles.resultHeader}>
            <Text style={styles.resultTitle}>Ürün Bulundu</Text>
            <TouchableOpacity onPress={resetScan}>
              <Ionicons name="close-circle-outline" size={24} color="#888" />
            </TouchableOpacity>
          </View>

          <Text style={styles.productName}>{product.name}</Text>
          {product.sku ? (
            <Text style={styles.productSKU}>SKU: {product.sku}</Text>
          ) : null}

          <View style={styles.productMeta}>
            <MetaItem
              icon="pricetag-outline"
              label="Fiyat"
              value={`${parseFloat(product.price || 0).toFixed(2)} ${product.currency || 'TRY'}`}
              color="#6C63FF"
            />
            <MetaItem
              icon="cube-outline"
              label="Stok"
              value={
                product.manage_stock
                  ? `${product.stock_quantity ?? '—'} adet`
                  : product.stock_status === 'instock' ? 'Stokta' : 'Stok Yok'
              }
              color={
                product.stock_quantity > 5 ? '#10B981'
                  : product.stock_quantity > 0 ? '#F59E0B'
                  : '#EF4444'
              }
            />
          </View>

          {product.categories?.length > 0 && (
            <Text style={styles.categories}>
              {product.categories.map((c) => c.name).join(', ')}
            </Text>
          )}

          <View style={styles.resultActions}>
            <TouchableOpacity
              style={styles.resultBtn}
              onPress={() => navigation.navigate('Stock', { productId: product.id })}
            >
              <Ionicons name="create-outline" size={18} color="#10B981" />
              <Text style={[styles.resultBtnText, { color: '#10B981' }]}>Stok Güncelle</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.resultBtnSecondary} onPress={resetScan}>
              <Ionicons name="barcode-outline" size={18} color="#6C63FF" />
              <Text style={[styles.resultBtnText, { color: '#6C63FF' }]}>Yeni Tara</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const MetaItem = ({ icon, label, value, color }) => (
  <View style={styles.metaItem}>
    <Ionicons name={icon} size={16} color={color} />
    <View>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={[styles.metaValue, { color }]}>{value}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f0f1a', gap: 16 },
  permissionText: { color: '#888', fontSize: 16 },
  permissionBtn: { backgroundColor: '#6C63FF', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  permissionBtnText: { color: '#fff', fontWeight: '700' },
  cameraContainer: { height: 300 },
  camera: { flex: 1 },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  scanFrame: {
    width: 220,
    height: 160,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#6C63FF',
    borderWidth: 3,
  },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  scanSpinner: { position: 'absolute' },
  scanHint: { color: 'rgba(255,255,255,0.8)', fontSize: 13, textAlign: 'center' },
  flashBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
  },
  manualSection: { padding: 12, paddingTop: 8 },
  manualRow: { flexDirection: 'row', gap: 8 },
  manualInput: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    paddingHorizontal: 14,
    color: '#fff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  manualSearchBtn: {
    backgroundColor: '#6C63FF',
    borderRadius: 10,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultPanel: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  resultTitle: { fontSize: 13, color: '#10B981', fontWeight: '700', textTransform: 'uppercase' },
  productName: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 4 },
  productSKU: { fontSize: 12, color: '#666', marginBottom: 12 },
  productMeta: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0f0f1a',
    borderRadius: 10,
    padding: 10,
    flex: 1,
  },
  metaLabel: { fontSize: 10, color: '#666' },
  metaValue: { fontSize: 14, fontWeight: '700' },
  categories: { fontSize: 12, color: '#555', marginBottom: 12 },
  resultActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  resultBtn: {
    flex: 1,
    backgroundColor: '#10B98120',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  resultBtnSecondary: {
    flex: 1,
    backgroundColor: '#6C63FF20',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#6C63FF',
  },
  resultBtnText: { fontSize: 13, fontWeight: '700' },
});
