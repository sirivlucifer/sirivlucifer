import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { getDashboardStats } from '../api/woocommerce';

export default function LoginScreen() {
  const { login } = useApp();
  const [siteUrl, setSiteUrl] = useState('');
  const [consumerKey, setConsumerKey] = useState('');
  const [consumerSecret, setConsumerSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const handleLogin = async () => {
    if (!siteUrl.trim() || !consumerKey.trim() || !consumerSecret.trim()) {
      Alert.alert('Hata', 'Lütfen tüm alanları doldurun.');
      return;
    }

    const url = siteUrl.trim().toLowerCase();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      Alert.alert('Hata', 'Site URL\'si http:// veya https:// ile başlamalıdır.');
      return;
    }

    setLoading(true);
    try {
      await login(url, consumerKey.trim(), consumerSecret.trim());
      // Bağlantı testi
      await getDashboardStats();
    } catch (err) {
      await login(url, consumerKey.trim(), consumerSecret.trim()); // credentials zaten set edildi
      if (err?.response?.status === 401) {
        Alert.alert('Bağlantı Hatası', 'API anahtarları geçersiz. Lütfen kontrol edin.');
        return;
      }
      // Diğer hatalar (ağ hatası vb.) - yine de giriş yap
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Ionicons name="cube" size={64} color="#6C63FF" />
          <Text style={styles.title}>Depo Yönetim</Text>
          <Text style={styles.subtitle}>WooCommerce Depo & Kargo Sistemi</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Bağlantı Ayarları</Text>

          <Text style={styles.label}>Site URL</Text>
          <TextInput
            style={styles.input}
            placeholder="https://magazaniz.com"
            placeholderTextColor="#888"
            value={siteUrl}
            onChangeText={setSiteUrl}
            autoCapitalize="none"
            keyboardType="url"
            autoCorrect={false}
          />

          <Text style={styles.label}>Consumer Key</Text>
          <TextInput
            style={styles.input}
            placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxx"
            placeholderTextColor="#888"
            value={consumerKey}
            onChangeText={setConsumerKey}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Consumer Secret</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              placeholder="cs_xxxxxxxxxxxxxxxxxxxxxxxx"
              placeholderTextColor="#888"
              value={consumerSecret}
              onChangeText={setConsumerSecret}
              secureTextEntry={!showSecret}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowSecret(!showSecret)}
            >
              <Ionicons
                name={showSecret ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color="#888"
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="log-in-outline" size={20} color="#fff" />
                <Text style={styles.loginBtnText}>Bağlan</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.helpCard}>
          <Ionicons name="information-circle-outline" size={18} color="#6C63FF" />
          <Text style={styles.helpText}>
            WooCommerce {'>'} Ayarlar {'>'} Gelişmiş {'>'} REST API{'  '}
            bölümünden API anahtarı oluşturun.{'\n'}
            İzin: <Text style={styles.bold}>Okuma/Yazma</Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  scroll: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 32 },
  title: { fontSize: 28, fontWeight: '800', color: '#fff', marginTop: 12 },
  subtitle: { fontSize: 13, color: '#888', marginTop: 4 },
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 16 },
  label: { fontSize: 13, color: '#aaa', marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: '#0f0f1a',
    borderRadius: 10,
    padding: 12,
    color: '#fff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  passwordRow: { position: 'relative' },
  passwordInput: { paddingRight: 48 },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    top: 12,
    padding: 2,
  },
  loginBtn: {
    backgroundColor: '#6C63FF',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 24,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  loginBtnDisabled: { opacity: 0.6 },
  loginBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  helpCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  helpText: { color: '#aaa', fontSize: 12, flex: 1, lineHeight: 18 },
  bold: { color: '#6C63FF', fontWeight: '700' },
});
