// app/_layout.tsx
import * as Notifications from 'expo-notifications';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

export default function Layout() {
  useEffect(() => {
    // Berechtigung für iOS anfragen
    Notifications.requestPermissionsAsync();

    // Für Android einen Kanal anlegen, damit Benachrichtigungen zuverlässig erscheinen
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('trinkzeiten', {
        name: 'Trinkzeiten',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
  }, []);

  return <Stack screenOptions={{ headerShown: false }} />;
}
