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
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { getProducts, updateStock, getLowStockProducts } from '../api/woocommerce';

const STOCK_TABS = [
  { key: 'all', label: 'Tümü' },
  { key: 'low', label: 'Az Stok' },
  { key: 'out', label: 'Stok Yok' },
];

const StockBar = ({ quantity, max = 50 }) => {
  const pct = Math.min((quantity / max) * 100, 100);
  const color = quantity === 0 ? '#EF4444' : quantity <= 5 ? '#F59E0B' : '#10B981';
  return (
    <View style={styles.barBg}>
      <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
    </View>
  );
};

const ProductStockCard = ({ product, onEdit }) => {
  const stock = product.stock_quantity;
  const statusColor =
    stock === 0 || stock === null
      ? '#EF4444'
      : stock <= 5
      ? '#F59E0B'
      : '#10B981';

  return (
    <View style={styles.stockCard}>
      <View style={styles.stockCardMain}>
        <View style={styles.stockInfo}>
          <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
          {product.sku ? <Text style={styles.sku}>SKU: {product.sku}</Text> : null}
          {product.manage_stock && (
            <StockBar quantity={stock ?? 0} />
          )}
        </View>
        <View style={styles.stockRight}>
          <Text style={[styles.stockQty, { color: statusColor }]}>
            {product.manage_stock ? (stock ?? '—') : '∞'}
          </Text>
          <Text style={styles.stockUnit}>adet</Text>
          {product.manage_stock && (
            <TouchableOpacity style={styles.editBtn} onPress={() => onEdit(product)}>
              <Ionicons name="pencil-outline" size={16} color="#6C63FF" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

export default function StockScreen({ navigation, route }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [editProduct, setEditProduct] = useState(null);
  const [newQty, setNewQty] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchProducts = useCallback(async (tab, searchTerm) => {
    try {
      let data;
      if (tab === 'low') {
        data = await getLowStockProducts(5);
      } else if (tab === 'out') {
        data = await getProducts({ stock_status: 'outofstock', per_page: 100 });
      } else {
        const params = { per_page: 100 };
        if (searchTerm.trim()) params.search = searchTerm.trim();
        data = await getProducts(params);
      }
      setProducts(data);
    } catch (err) {
      console.warn('Ürünler alınamadı:', err?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchProducts(activeTab, search);
  }, [activeTab, fetchProducts]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTab === 'all') {
        setLoading(true);
        fetchProducts('all', search);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const handleEdit = (product) => {
    setEditProduct(product);
    setNewQty(product.stock_quantity?.toString() || '0');
  };

  const handleSaveStock = async () => {
    const qty = parseInt(newQty);
    if (isNaN(qty) || qty < 0) {
      Alert.alert('Hata', 'Geçerli bir miktar girin.');
      return;
    }
    setSaving(true);
    try {
      await updateStock(editProduct.id, qty);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setProducts((prev) =>
        prev.map((p) => p.id === editProduct.id ? { ...p, stock_quantity: qty } : p)
      );
      setEditProduct(null);
    } catch (err) {
      Alert.alert('Hata', 'Stok güncellenemedi.');
    } finally {
      setSaving(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchProducts(activeTab, search);
  };

  const lowStockCount = products.filter(
    (p) => p.manage_stock && p.stock_quantity !== null && p.stock_quantity <= 5
  ).length;

  return (
    <View style={styles.container}>
      {/* Özet */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{products.length}</Text>
          <Text style={styles.summaryLabel}>Toplam Ürün</Text>
        </View>
        <View style={[styles.summaryItem, styles.summaryDivider]}>
          <Text style={[styles.summaryValue, { color: '#F59E0B' }]}>{lowStockCount}</Text>
          <Text style={styles.summaryLabel}>Az Stok</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: '#EF4444' }]}>
            {products.filter(p => p.stock_status === 'outofstock').length}
          </Text>
          <Text style={styles.summaryLabel}>Stok Yok</Text>
        </View>
      </View>

      {/* Sekme */}
      <View style={styles.tabs}>
        {STOCK_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Arama (sadece tümünde) */}
      {activeTab === 'all' && (
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color="#888" />
          <TextInput
            style={styles.searchInput}
            placeholder="Ürün adı, SKU..."
            placeholderTextColor="#555"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color="#555" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Liste */}
      {loading ? (
        <ActivityIndicator color="#6C63FF" style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6C63FF" />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="cube-outline" size={48} color="#333" />
              <Text style={styles.emptyText}>Ürün bulunamadı</Text>
            </View>
          }
          renderItem={({ item }) => (
            <ProductStockCard product={item} onEdit={handleEdit} />
          )}
        />
      )}

      {/* Stok Düzenleme Modal */}
      <Modal visible={!!editProduct} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Stok Güncelle</Text>
            <Text style={styles.modalProductName} numberOfLines={2}>
              {editProduct?.name}
            </Text>
            {editProduct?.sku ? (
              <Text style={styles.modalSKU}>SKU: {editProduct.sku}</Text>
            ) : null}

            <Text style={styles.modalLabel}>Mevcut: {editProduct?.stock_quantity ?? 0} adet</Text>

            <View style={styles.qtyRow}>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => setNewQty((v) => Math.max(0, parseInt(v || 0) - 1).toString())}
              >
                <Ionicons name="remove" size={20} color="#fff" />
              </TouchableOpacity>
              <TextInput
                style={styles.qtyInput}
                value={newQty}
                onChangeText={setNewQty}
                keyboardType="number-pad"
                textAlign="center"
              />
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => setNewQty((v) => (parseInt(v || 0) + 1).toString())}
              >
                <Ionicons name="add" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Hızlı Ekle */}
            <View style={styles.quickAddRow}>
              {[5, 10, 25, 50].map((n) => (
                <TouchableOpacity
                  key={n}
                  style={styles.quickAddBtn}
                  onPress={() => setNewQty((v) => (parseInt(v || 0) + n).toString())}
                >
                  <Text style={styles.quickAddText}>+{n}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setEditProduct(null)}
              >
                <Text style={styles.modalCancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleSaveStock}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>Kaydet</Text>
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
  summaryRow: {
    flexDirection: 'row',
    backgroundColor: '#1a1a2e',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3e',
  },
  summaryItem: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  summaryDivider: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#2a2a3e',
  },
  summaryValue: { fontSize: 22, fontWeight: '800', color: '#fff' },
  summaryLabel: { fontSize: 11, color: '#666', marginTop: 2 },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#1a1a2e',
    padding: 8,
    gap: 6,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#0f0f1a',
  },
  tabActive: { backgroundColor: '#6C63FF' },
  tabText: { fontSize: 13, color: '#666', fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    margin: 12,
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#2a2a3e',
    gap: 8,
  },
  searchInput: { flex: 1, color: '#fff', fontSize: 14, paddingVertical: 10 },
  listContent: { padding: 12, gap: 8 },
  stockCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  stockCardMain: { flexDirection: 'row', gap: 10 },
  stockInfo: { flex: 1, gap: 4 },
  productName: { fontSize: 13, fontWeight: '600', color: '#ddd' },
  sku: { fontSize: 11, color: '#555' },
  barBg: {
    height: 4,
    backgroundColor: '#2a2a3e',
    borderRadius: 2,
    marginTop: 6,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 2 },
  stockRight: { alignItems: 'center', gap: 2 },
  stockQty: { fontSize: 22, fontWeight: '800' },
  stockUnit: { fontSize: 11, color: '#555' },
  editBtn: {
    marginTop: 4,
    backgroundColor: '#6C63FF20',
    borderRadius: 6,
    padding: 6,
  },
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
    gap: 10,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  modalProductName: { fontSize: 14, color: '#ddd', fontWeight: '500' },
  modalSKU: { fontSize: 12, color: '#555' },
  modalLabel: { fontSize: 12, color: '#888' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 8 },
  qtyBtn: {
    backgroundColor: '#6C63FF',
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyInput: {
    flex: 1,
    backgroundColor: '#0f0f1a',
    borderRadius: 10,
    padding: 10,
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  quickAddRow: { flexDirection: 'row', gap: 8 },
  quickAddBtn: {
    flex: 1,
    backgroundColor: '#2a2a3e',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  quickAddText: { color: '#6C63FF', fontWeight: '700', fontSize: 13 },
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
