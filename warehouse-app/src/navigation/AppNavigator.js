import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, View } from 'react-native';

import { useApp } from '../context/AppContext';

import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import OrdersScreen from '../screens/OrdersScreen';
import OrderDetailScreen from '../screens/OrderDetailScreen';
import BarcodeScreen from '../screens/BarcodeScreen';
import StockScreen from '../screens/StockScreen';
import ShippingScreen from '../screens/ShippingScreen';
import PickingScreen from '../screens/PickingScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  Home: ['home', 'home-outline'],
  Picking: ['list-circle', 'list-circle-outline'],
  Barcode: ['barcode', 'barcode-outline'],
  Orders: ['receipt', 'receipt-outline'],
  Shipping: ['car', 'car-outline'],
};

const TAB_LABELS = {
  Home: 'Ana Sayfa',
  Picking: 'Toplama',
  Barcode: 'Barkod',
  Orders: 'Siparişler',
  Shipping: 'Kargo',
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const [active, inactive] = TAB_ICONS[route.name];
          return <Ionicons name={focused ? active : inactive} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#6C63FF',
        tabBarInactiveTintColor: '#555',
        tabBarStyle: {
          backgroundColor: '#1a1a2e',
          borderTopColor: '#2a2a3e',
          borderTopWidth: 1,
          paddingBottom: 4,
          height: 60,
        },
        tabBarLabelStyle: { fontSize: 10, marginBottom: 2 },
        headerStyle: { backgroundColor: '#1a1a2e' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Ana Sayfa', tabBarLabel: TAB_LABELS.Home }} />
      <Tab.Screen
        name="Picking"
        component={PickingScreen}
        options={{
          title: 'Toplama Listesi',
          tabBarLabel: TAB_LABELS.Picking,
          tabBarIcon: ({ focused }) => (
            <View style={{
              backgroundColor: focused ? '#F59E0B' : '#2a2a3e',
              borderRadius: 12,
              padding: 8,
              marginBottom: 4,
            }}>
              <Ionicons name="list-circle-outline" size={22} color={focused ? '#fff' : '#888'} />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Barcode"
        component={BarcodeScreen}
        options={{
          title: 'Barkod Tara',
          tabBarLabel: TAB_LABELS.Barcode,
          tabBarIcon: ({ focused }) => (
            <View style={{
              backgroundColor: focused ? '#6C63FF' : '#2a2a3e',
              borderRadius: 12,
              padding: 8,
              marginBottom: 4,
            }}>
              <Ionicons name="barcode-outline" size={22} color={focused ? '#fff' : '#888'} />
            </View>
          ),
        }}
      />
      <Tab.Screen name="Orders" component={OrdersScreen} options={{ title: 'Siparişler', tabBarLabel: TAB_LABELS.Orders }} />
      <Tab.Screen name="Shipping" component={ShippingScreen} options={{ title: 'Kargo İşlemleri', tabBarLabel: TAB_LABELS.Shipping }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { isLoggedIn, isLoading } = useApp();

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f0f1a', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#6C63FF" size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#1a1a2e' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: '#0f0f1a' },
        }}
      >
        {isLoggedIn ? (
          <>
            <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen
              name="OrderDetail"
              component={OrderDetailScreen}
              options={{ title: 'Sipariş Detayı' }}
            />
            <Stack.Screen
              name="Stock"
              component={StockScreen}
              options={{ title: 'Stok Takip' }}
            />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
