import WheelPicker, {
  type PickerItem,
  useOnPickerValueChangedEffect,
  usePickerControl,
  withPickerControl,
} from '@quidone/react-native-wheel-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import React, { useEffect, useState } from 'react';
import {
  FlatList,
  Modal,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
//import * as Permissions from 'expo-permissions';

useEffect(() => {
  registerForPushNotificationsAsync();
}, []);

const registerForPushNotificationsAsync = async () => {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    alert('Push-Benachrichtigungen wurden nicht erlaubt!');
    return;
  }
};

const scheduleNotification = async (timeString: string) => {
  const [hour, minute] = timeString.split(':').map(Number);
  const now = new Date();
  let triggerDate = new Date();
  triggerDate.setHours(hour, minute, 0, 0);

  // Wenn die Zeit schon vorbei ist, auf morgen verschieben
  if (triggerDate <= now) triggerDate.setDate(triggerDate.getDate() + 1);

  const seconds = Math.ceil((triggerDate.getTime() - now.getTime()) / 1000);

  const trigger: Notifications.TimeIntervalTriggerInput = {
    type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, // ✅ Enum verwenden
    seconds: seconds > 0 ? seconds : 1, // mindestens 1 Sekunde
    repeats: false,
  };

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '💧 Trink-Erinnerung',
      body: `Zeit für ein Glas Wasser! (${timeString})`,
      sound: true,
    },
    trigger,
  });
};





const cancelNotification = async () => {
  await Notifications.cancelAllScheduledNotificationsAsync();
};

const ControlPicker = withPickerControl(WheelPicker);
type ControlPickersMap = {
  hour: { item: PickerItem<number> };
  minute: { item: PickerItem<number> };
};

const hoursArray = Array.from({ length: 24 }, (_, i) => ({ value: i }));
const minutesArray = Array.from({ length: 60 }, (_, i) => ({ value: i }));

type DrinkTime = { time: string; done: boolean };

export default function App() {
  const [wakeUp, setWakeUp] = useState('');
  const [bedTime, setBedTime] = useState('');
  const [dailyLiters, setDailyLiters] = useState('');
  const [glassSize, setGlassSize] = useState('');
  const [schedule, setSchedule] = useState<DrinkTime[]>([]);

  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<'wake' | 'bed'>('wake');
  const [selectedHour, setSelectedHour] = useState(8);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [allActive, setAllActive] = useState(false);

  const pickerControl = usePickerControl<ControlPickersMap>();

  useOnPickerValueChangedEffect(pickerControl, (event) => {
    setSelectedHour(event.pickers.hour.item.value);
    setSelectedMinute(event.pickers.minute.item.value);
  });

  // ----------  Laden  ----------
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const wake = await AsyncStorage.getItem('wakeUp');
      const bed = await AsyncStorage.getItem('bedTime');
      const liters = await AsyncStorage.getItem('dailyLiters');
      const glass = await AsyncStorage.getItem('glassSize');

      if (wake) setWakeUp(wake);
      if (bed) setBedTime(bed);
      if (liters) setDailyLiters(liters);
      if (glass) setGlassSize(glass);

      // 🆕 Trinkzeiten + Status laden
      const storedSchedule = await AsyncStorage.getItem('drinkSchedule');
      if (storedSchedule) {
        const parsed: DrinkTime[] = JSON.parse(storedSchedule);
        setSchedule(parsed);
        // Prüfen ob aktuell alle aktiv
        setAllActive(parsed.every((t) => t.done));
      }
    } catch (e) {
      console.log(e);
    }
  };

  // ----------  Speichern  ----------
  const saveSettings = async (newSchedule?: DrinkTime[]) => {
    try {
      await AsyncStorage.setItem('wakeUp', wakeUp);
      await AsyncStorage.setItem('bedTime', bedTime);
      await AsyncStorage.setItem('dailyLiters', dailyLiters);
      await AsyncStorage.setItem('glassSize', glassSize);
      if (newSchedule) {
        // 🆕 Plan mitspeichern
        await AsyncStorage.setItem('drinkSchedule', JSON.stringify(newSchedule));
      }
    } catch (e) {
      console.log(e);
    }
  };

  const parseTime = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  };

  const createSchedule = () => {
    // alle Settings speichern
    saveSettings();
    const wake = parseTime(wakeUp);
    const bed = parseTime(bedTime);

    const normalized = dailyLiters.replace(',', '.');
    const totalMl = parseFloat(normalized) * 1000;
    const glasses = Math.ceil(totalMl / parseInt(glassSize));

    // letzte Zeit 1 Stunde vor Schlafen
    const adjustedBed = new Date(bed.getTime() - 60 * 60 * 1000);
    const interval = (adjustedBed.getTime() - wake.getTime()) / glasses;

    const times: DrinkTime[] = Array.from({ length: glasses }, (_, i) => ({
      time: new Date(wake.getTime() + interval * (i + 1)).toLocaleTimeString(
        [],
        { hour: '2-digit', minute: '2-digit' }
      ),
      done: false,
    }));

    setSchedule(times);
    setAllActive(false);
    // 🆕 Plan direkt speichern
    saveSettings(times);
  };

  // ----------  Status toggeln  ----------
  const toggleAlarm = async (index: number) => {
      const updated = schedule.map((item, i) =>
      i === index ? { ...item, done: !item.done } : item
    );
    setSchedule(updated);
    setAllActive(updated.every((t) => t.done));
    await AsyncStorage.setItem('drinkSchedule', JSON.stringify(updated));

    // 🔔 Notification planen oder löschen
    if (updated[index].done) {
      scheduleNotification(updated[index].time);
    } else {
      // Optional: alle Notifications abbrechen und die aktiven neu planen
      await cancelNotification();
      updated.forEach((item) => {
        if (item.done) scheduleNotification(item.time);
      });
    };
  };

  const toggleAllAlarms = async () => {
    const newValue = !allActive;
    const newSchedule = schedule.map((item) => ({ ...item, done: newValue }));
    setSchedule(newSchedule);
    setAllActive(newValue);
    await AsyncStorage.setItem('drinkSchedule', JSON.stringify(newSchedule));

    // 🔔 Notifications planen / abbrechen
    if (newValue) {
      newSchedule.forEach((item) => scheduleNotification(item.time));
    } else {
      await cancelNotification();
    }
  };

  const openPicker = (target: 'wake' | 'bed') => {
    setPickerTarget(target);
    const time = target === 'wake' ? wakeUp : bedTime;
    if (time) {
      const [h, m] = time.split(':').map(Number);
      setSelectedHour(h);
      setSelectedMinute(m);
    } else {
      setSelectedHour(8);
      setSelectedMinute(0);
    }
    setPickerVisible(true);
  };

  const confirmPicker = () => {
    const timeString = `${selectedHour
      .toString()
      .padStart(2, '0')}:${selectedMinute.toString().padStart(2, '0')}`;
    if (pickerTarget === 'wake') setWakeUp(timeString);
    else setBedTime(timeString);
    setPickerVisible(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Wasser-Reminder</Text>

      {/* Eingabe-Felder */}
      <View style={styles.inputRow}>
        <View style={styles.inputContainerLeft}>
          <Text style={styles.label}>Aufstehzeit</Text>
          <TouchableOpacity onPress={() => openPicker('wake')}>
            <TextInput
              style={styles.input}
              value={wakeUp}
              editable={false}
              pointerEvents="none"
              placeholder="08:00"
            />
          </TouchableOpacity>
        </View>
        <View style={styles.inputContainerRight}>
          <Text style={styles.label}>Schlafenszeit</Text>
          <TouchableOpacity onPress={() => openPicker('bed')}>
            <TextInput
              style={styles.input}
              value={bedTime}
              editable={false}
              pointerEvents="none"
              placeholder="22:00"
            />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.inputRow}>
        <View style={styles.inputContainerLeft}>
          <Text style={styles.label}>Tagesziel (Liter)</Text>
          <TextInput
            style={styles.input}
            value={dailyLiters}
            onChangeText={setDailyLiters}
            keyboardType="numeric"
            placeholder="2"
          />
        </View>
        <View style={styles.inputContainerRight}>
          <Text style={styles.label}>Glasgröße (ml)</Text>
          <TextInput
            style={styles.input}
            value={glassSize}
            onChangeText={setGlassSize}
            keyboardType="numeric"
            placeholder="200"
          />
        </View>
      </View>

      <TouchableOpacity style={styles.button} onPress={createSchedule}>
        <Text style={styles.buttonText}>Trinkplan erstellen</Text>
      </TouchableOpacity>

      {/* Trinkzeiten + Toggle-Button */}
      <View style={styles.headerRow}>
        <Text style={styles.subtitle}>Trinkzeiten:</Text>
        <TouchableOpacity
          style={[styles.activateButton, allActive && styles.buttonRed]}
          onPress={toggleAllAlarms}
        >
          <Text style={styles.buttonTextSmall}>
            {allActive ? 'Alle deaktivieren' : 'Alle aktivieren'}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={schedule}
        keyExtractor={(_, index) => index.toString()}
        renderItem={({ item, index }) => (
          <View style={styles.item}>
            <Text style={styles.itemText}>{item.time}</Text>
            <Switch value={item.done} onValueChange={() => toggleAlarm(index)} />
          </View>
        )}
      />

      {/* Modal für Wheel Picker */}
      <Modal visible={pickerVisible} transparent animationType="none">
        <View style={styles.modalContainer}>
          <View style={styles.pickerBox}>
            <Text style={styles.label}>Wähle Zeit</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
              <ControlPicker
                control={pickerControl}
                pickerName="hour"
                data={hoursArray}
                value={selectedHour}
                width={100}
                enableScrollByTapOnItem
              />
              <ControlPicker
                control={pickerControl}
                pickerName="minute"
                data={minutesArray}
                value={selectedMinute}
                width={100}
                enableScrollByTapOnItem
              />
            </View>
            <TouchableOpacity style={[styles.button, styles.wideButton]} onPress={confirmPicker}>
              <Text style={styles.buttonText}>Bestätigen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 50, backgroundColor: '#f2f2f2' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  inputRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  inputContainerRight: { flex: 1, marginLeft: 10 },
  inputContainerLeft: { flex: 1, marginRight: 10 },
  label: { fontWeight: 'bold', marginBottom: 5, textAlign: 'center' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 50,
    paddingVertical: 12,
    paddingHorizontal: 20,
    textAlign: 'center',
    backgroundColor: 'white',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#4CAF50',
    paddingVertical: 15,
    marginVertical: 10,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 10 },
  activateButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 25,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  buttonRed: { backgroundColor: 'red' },
  buttonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  wideButton: { width: 200, alignSelf: 'center' },
  subtitle: { fontSize: 20, fontWeight: 'bold', marginVertical: 20, textAlign: 'center' },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    backgroundColor: '#fff',
    borderRadius: 25,
    marginBottom: 5,
  },
  itemText: { fontSize: 16 },
  buttonTextSmall: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  pickerBox: {
    width: 300,
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    alignItems: 'center',
  },
});
