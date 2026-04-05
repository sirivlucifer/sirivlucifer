import { StatusBar } from 'expo-status-bar';
import { AppProvider } from './src/context/AppContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <AppProvider>
      <StatusBar style="light" backgroundColor="#1a1a2e" />
      <AppNavigator />
    </AppProvider>
  );
}
