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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { getOrders } from '../api/woocommerce';

// Tüm siparişlerin ürünlerini birleştirip ürün bazlı tek liste oluşturur
const buildPickList = (orders) => {
  const map = {};

  orders.forEach((order) => {
    order.line_items?.forEach((item) => {
      const key = item.product_id + (item.variation_id ? `_${item.variation_id}` : '');
      if (!map[key]) {
        map[key] = {
          key,
          productId: item.product_id,
          variationId: item.variation_id,
          name: item.name,
          sku: item.sku || '',
          totalQty: 0,
          orders: [],
          // Varyasyon meta (renk, beden vb.)
          meta: item.meta_data
            ?.filter((m) => !m.key.startsWith('_') && m.display_value)
            .map((m) => `${m.display_key}: ${m.display_value}`)
            .join(' | ') || '',
        };
      }
      map[key].totalQty += item.quantity;
      map[key].orders.push({
        orderId: order.id,
        orderNumber: order.number,
        qty: item.quantity,
        customer: `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim(),
      });
    });
  });

  return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
};

const PickItem = ({ item, collectedQty, onIncrement, onDecrement, onComplete }) => {
  const done = collectedQty >= item.totalQty;

  return (
    <View style={[styles.pickCard, done && styles.pickCardDone]}>
      <View style={styles.pickCardTop}>
        {/* Sol: ürün bilgisi */}
        <View style={styles.pickInfo}>
          <View style={styles.pickNameRow}>
            {done && <Ionicons name="checkmark-circle" size={16} color="#10B981" style={{ marginRight: 4 }} />}
            <Text style={[styles.pickName, done && styles.pickNameDone]} numberOfLines={2}>
              {item.name}
            </Text>
          </View>
          {item.sku ? <Text style={styles.pickSKU}>SKU: {item.sku}</Text> : null}
          {item.meta ? <Text style={styles.pickMeta}>{item.meta}</Text> : null}

          {/* Sipariş dağılımı */}
          <View style={styles.orderChips}>
            {item.orders.map((o, i) => (
              <View key={i} style={styles.orderChip}>
                <Text style={styles.orderChipText}>#{o.orderNumber} × {o.qty}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Sağ: sayaç */}
        <View style={styles.counter}>
          <Text style={styles.counterFraction}>
            <Text style={[styles.counterCollected, { color: done ? '#10B981' : '#6C63FF' }]}>
              {collectedQty}
            </Text>
            <Text style={styles.counterTotal}>/{item.totalQty}</Text>
          </Text>
          <Text style={styles.counterLabel}>toplandı</Text>

          <View style={styles.counterBtns}>
            <TouchableOpacity
              style={[styles.counterBtn, styles.counterBtnMinus]}
              onPress={() => onDecrement(item.key)}
              disabled={collectedQty === 0}
            >
              <Ionicons name="remove" size={16} color={collectedQty === 0 ? '#333' : '#fff'} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.counterBtn, styles.counterBtnPlus]}
              onPress={() => onIncrement(item.key, item.totalQty)}
            >
              <Ionicons name="add" size={16} color="#fff" />
            </TouchableOpacity>
          </View>

          {!done && (
            <TouchableOpacity style={styles.allBtn} onPress={() => onComplete(item.key, item.totalQty)}>
              <Text style={styles.allBtnText}>Tümü</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

export default function PickingScreen({ navigation }) {
  const [orders, setOrders] = useState([]);
  const [pickList, setPickList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // { [itemKey]: collectedQty }
  const [collected, setCollected] = useState({});

  const fetchOrders = useCallback(async () => {
    try {
      const data = await getOrders({ status: 'processing', per_page: 100 });
      setOrders(data);
      setPickList(buildPickList(data));
    } catch (err) {
      console.warn('Siparişler alınamadı:', err?.message);
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
    setCollected({});
    fetchOrders();
  };

  const increment = (key, max) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCollected((prev) => {
      const cur = prev[key] || 0;
      if (cur >= max) return prev;
      return { ...prev, [key]: cur + 1 };
    });
  };

  const decrement = (key) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCollected((prev) => {
      const cur = prev[key] || 0;
      if (cur === 0) return prev;
      return { ...prev, [key]: cur - 1 };
    });
  };

  const completeItem = (key, max) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCollected((prev) => ({ ...prev, [key]: max }));
  };

  const resetAll = () => {
    Alert.alert('Sıfırla', 'Tüm toplama ilerlemesi sıfırlansın mı?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sıfırla',
        style: 'destructive',
        onPress: () => setCollected({}),
      },
    ]);
  };

  // İlerleme
  const totalItems = pickList.length;
  const doneItems = pickList.filter((item) => (collected[item.key] || 0) >= item.totalQty).length;
  const allDone = totalItems > 0 && doneItems === totalItems;
  const progressPct = totalItems === 0 ? 0 : Math.round((doneItems / totalItems) * 100);

  // Toplam adet
  const totalUnits = pickList.reduce((s, i) => s + i.totalQty, 0);
  const collectedUnits = pickList.reduce((s, i) => s + Math.min(collected[i.key] || 0, i.totalQty), 0);

  return (
    <View style={styles.container}>
      {/* Özet Başlık */}
      <View style={styles.header}>
        <View style={styles.headerStats}>
          <View style={styles.headerStat}>
            <Text style={styles.headerStatVal}>{orders.length}</Text>
            <Text style={styles.headerStatLabel}>Sipariş</Text>
          </View>
          <View style={[styles.headerStat, styles.headerStatDivider]}>
            <Text style={styles.headerStatVal}>{totalItems}</Text>
            <Text style={styles.headerStatLabel}>Farklı Ürün</Text>
          </View>
          <View style={styles.headerStat}>
            <Text style={styles.headerStatVal}>{totalUnits}</Text>
            <Text style={styles.headerStatLabel}>Toplam Adet</Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.progressRow}>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>
          <Text style={styles.progressLabel}>{collectedUnits}/{totalUnits} adet</Text>
        </View>

        <View style={styles.headerActions}>
          <Text style={styles.progressStatus}>
            {allDone
              ? '✓ Tüm ürünler toplandı!'
              : `${doneItems}/${totalItems} ürün tamamlandı`}
          </Text>
          <TouchableOpacity onPress={resetAll}>
            <Ionicons name="refresh-outline" size={20} color="#555" />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color="#6C63FF" style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={pickList}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6C63FF" />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="checkmark-done-circle-outline" size={56} color="#333" />
              <Text style={styles.emptyText}>İşlemde sipariş yok</Text>
            </View>
          }
          renderItem={({ item }) => (
            <PickItem
              item={item}
              collectedQty={collected[item.key] || 0}
              onIncrement={increment}
              onDecrement={decrement}
              onComplete={completeItem}
            />
          )}
        />
      )}

      {/* Alt buton: tümü toplandıysa siparişlere git */}
      {allDone && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.footerBtn}
            onPress={() => navigation.navigate('Orders', { status: 'processing' })}
          >
            <Ionicons name="car-outline" size={20} color="#fff" />
            <Text style={styles.footerBtnText}>Siparişlere Geç → Kargoya Ver</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },

  header: {
    backgroundColor: '#1a1a2e',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3e',
    gap: 10,
  },
  headerStats: { flexDirection: 'row' },
  headerStat: { flex: 1, alignItems: 'center' },
  headerStatDivider: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#2a2a3e',
  },
  headerStatVal: { fontSize: 22, fontWeight: '800', color: '#fff' },
  headerStatLabel: { fontSize: 11, color: '#666', marginTop: 2 },

  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressBg: {
    flex: 1,
    height: 8,
    backgroundColor: '#2a2a3e',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#6C63FF', borderRadius: 4 },
  progressLabel: { fontSize: 12, color: '#888', width: 80, textAlign: 'right' },

  headerActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressStatus: { fontSize: 13, color: '#aaa', fontWeight: '500' },

  listContent: { padding: 12, gap: 10, paddingBottom: 100 },

  pickCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  pickCardDone: {
    borderColor: '#10B98140',
    backgroundColor: '#10B98108',
  },
  pickCardTop: { flexDirection: 'row', gap: 12 },

  pickInfo: { flex: 1, gap: 4 },
  pickNameRow: { flexDirection: 'row', alignItems: 'flex-start' },
  pickName: { fontSize: 14, fontWeight: '700', color: '#ddd', flex: 1 },
  pickNameDone: { color: '#555', textDecorationLine: 'line-through' },
  pickSKU: { fontSize: 11, color: '#555' },
  pickMeta: { fontSize: 11, color: '#6C63FF' },

  orderChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  orderChip: {
    backgroundColor: '#2a2a3e',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  orderChipText: { fontSize: 10, color: '#888' },

  counter: { alignItems: 'center', gap: 4, minWidth: 72 },
  counterFraction: { fontSize: 14 },
  counterCollected: { fontSize: 26, fontWeight: '900' },
  counterTotal: { fontSize: 14, color: '#555', fontWeight: '600' },
  counterLabel: { fontSize: 10, color: '#555' },

  counterBtns: { flexDirection: 'row', gap: 6, marginTop: 4 },
  counterBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterBtnMinus: { backgroundColor: '#2a2a3e' },
  counterBtnPlus: { backgroundColor: '#6C63FF' },

  allBtn: {
    marginTop: 4,
    backgroundColor: '#10B98120',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  allBtnText: { color: '#10B981', fontSize: 11, fontWeight: '700' },

  empty: { alignItems: 'center', paddingVertical: 80, gap: 12 },
  emptyText: { color: '#444', fontSize: 16 },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: '#1a1a2e',
    borderTopWidth: 1,
    borderTopColor: '#2a2a3e',
  },
  footerBtn: {
    backgroundColor: '#10B981',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  footerBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
