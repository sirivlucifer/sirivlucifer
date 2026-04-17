import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { getDashboardStats } from '../api/woocommerce';

export default function LoginScreen() {
  const { login } = useApp();
  const [siteUrl, setSiteUrl] = useState('');
  const [consumerKey, setConsumerKey] = useState('');
  const [consumerSecret, setConsumerSecret] = useState('');
  const [geliverToken, setGeliverToken] = useState('');
  const [geliverSenderAddressId, setGeliverSenderAddressId] = useState('');
  const [showGeliverSection, setShowGeliverSection] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!siteUrl.trim() || !consumerKey.trim() || !consumerSecret.trim()) {
      Alert.alert('Hata', 'Lütfen WooCommerce alanlarını doldurun.');
      return;
    }
    const url = siteUrl.trim().toLowerCase();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      Alert.alert('Hata', 'Site URL\'si http:// veya https:// ile başlamalıdır.');
      return;
    }
    setLoading(true);
    try {
      await login(
        url,
        consumerKey.trim(),
        consumerSecret.trim(),
        geliverToken.trim() || null,
        geliverSenderAddressId.trim() || null,
      );
      await getDashboardStats();
    } catch (err) {
      if (err?.response?.status === 401) {
        Alert.alert('Bağlantı Hatası', 'WooCommerce API anahtarları geçersiz.');
        return;
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Ionicons name="cube" size={64} color="#6C63FF" />
          <Text style={styles.title}>Depo Yönetim</Text>
          <Text style={styles.subtitle}>WooCommerce Depo & Kargo Sistemi</Text>
        </View>

        {/* WooCommerce */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>WooCommerce Bağlantısı</Text>

          <Text style={styles.label}>Site URL</Text>
          <TextInput style={styles.input} placeholder="https://magazaniz.com"
            placeholderTextColor="#888" value={siteUrl} onChangeText={setSiteUrl}
            autoCapitalize="none" keyboardType="url" autoCorrect={false} />

          <Text style={styles.label}>Consumer Key</Text>
          <TextInput style={styles.input} placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxx"
            placeholderTextColor="#888" value={consumerKey} onChangeText={setConsumerKey}
            autoCapitalize="none" autoCorrect={false} />

          <Text style={styles.label}>Consumer Secret</Text>
          <View style={styles.passwordRow}>
            <TextInput style={[styles.input, styles.passwordInput]}
              placeholder="cs_xxxxxxxxxxxxxxxxxxxxxxxx" placeholderTextColor="#888"
              value={consumerSecret} onChangeText={setConsumerSecret}
              secureTextEntry={!showSecret} autoCapitalize="none" autoCorrect={false} />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowSecret(!showSecret)}>
              <Ionicons name={showSecret ? 'eye-off-outline' : 'eye-outline'} size={22} color="#888" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Geliver (opsiyonel) */}
        <TouchableOpacity
          style={styles.geliverToggle}
          onPress={() => setShowGeliverSection(!showGeliverSection)}
        >
          <View style={styles.geliverToggleLeft}>
            <Ionicons name="car-outline" size={20} color="#6C63FF" />
            <Text style={styles.geliverToggleText}>Geliver Kargo Entegrasyonu</Text>
            <View style={styles.optionalBadge}>
              <Text style={styles.optionalText}>opsiyonel</Text>
            </View>
          </View>
          <Ionicons name={showGeliverSection ? 'chevron-up' : 'chevron-down'} size={18} color="#555" />
        </TouchableOpacity>

        {showGeliverSection && (
          <View style={[styles.card, { marginTop: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 }]}>
            <Text style={styles.geliverDesc}>
              Geliver entegrasyonuyla kargo firması fiyatlarını karşılaştırın, tek tıkla etiket oluşturun.
            </Text>

            <Text style={styles.label}>API Token</Text>
            <TextInput style={styles.input} placeholder="Geliver API token"
              placeholderTextColor="#888" value={geliverToken} onChangeText={setGeliverToken}
              autoCapitalize="none" autoCorrect={false} />

            <Text style={styles.label}>Gönderici Adres ID</Text>
            <TextInput style={styles.input} placeholder="app.geliver.io/addresses adresinden alın"
              placeholderTextColor="#888" value={geliverSenderAddressId}
              onChangeText={setGeliverSenderAddressId} autoCapitalize="none" autoCorrect={false} />

            <View style={styles.geliverHint}>
              <Ionicons name="information-circle-outline" size={16} color="#6C63FF" />
              <Text style={styles.geliverHintText}>
                Token için: app.geliver.io/apitokens{'\n'}
                Adres ID için: app.geliver.io'da gönderici adres oluşturun
              </Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
          onPress={handleLogin} disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : (
            <>
              <Ionicons name="log-in-outline" size={20} color="#fff" />
              <Text style={styles.loginBtnText}>Bağlan</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.helpCard}>
          <Ionicons name="information-circle-outline" size={18} color="#6C63FF" />
          <Text style={styles.helpText}>
            WooCommerce {'>'} Ayarlar {'>'} Gelişmiş {'>'} REST API bölümünden{'\n'}
            İzin: <Text style={styles.bold}>Okuma/Yazma</Text> API anahtarı oluşturun.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  scroll: { flexGrow: 1, padding: 24, justifyContent: 'center', gap: 12 },
  header: { alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '800', color: '#fff', marginTop: 12 },
  subtitle: { fontSize: 13, color: '#888', marginTop: 4 },
  card: {
    backgroundColor: '#1a1a2e', borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: '#2a2a3e',
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 16 },
  label: { fontSize: 13, color: '#aaa', marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: '#0f0f1a', borderRadius: 10, padding: 12,
    color: '#fff', fontSize: 14, borderWidth: 1, borderColor: '#2a2a3e',
  },
  passwordRow: { position: 'relative' },
  passwordInput: { paddingRight: 48 },
  eyeBtn: { position: 'absolute', right: 12, top: 12, padding: 2 },
  geliverToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#1a1a2e', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#2a2a3e',
  },
  geliverToggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  geliverToggleText: { color: '#ddd', fontWeight: '600', fontSize: 14 },
  optionalBadge: {
    backgroundColor: '#6C63FF20', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  optionalText: { color: '#6C63FF', fontSize: 10, fontWeight: '700' },
  geliverDesc: { color: '#888', fontSize: 12, lineHeight: 18, marginBottom: 4 },
  geliverHint: {
    flexDirection: 'row', gap: 8, backgroundColor: '#0f0f1a',
    borderRadius: 10, padding: 10, marginTop: 12,
  },
  geliverHintText: { color: '#666', fontSize: 11, flex: 1, lineHeight: 16 },
  loginBtn: {
    backgroundColor: '#6C63FF', borderRadius: 12, padding: 14,
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
  },
  loginBtnDisabled: { opacity: 0.6 },
  loginBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  helpCard: {
    backgroundColor: '#1a1a2e', borderRadius: 12, padding: 14,
    flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderWidth: 1, borderColor: '#2a2a3e',
  },
  helpText: { color: '#aaa', fontSize: 12, flex: 1, lineHeight: 18 },
  bold: { color: '#6C63FF', fontWeight: '700' },
});
