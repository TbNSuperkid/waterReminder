import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function App() {
  const [wakeUp, setWakeUp] = useState('08:00');
  const [bedTime, setBedTime] = useState('22:00');
  const [dailyLiters, setDailyLiters] = useState('2');
  const [glassSize, setGlassSize] = useState('250');
  const [schedule, setSchedule] = useState<{time: string, done: boolean}[]>([]);

  useEffect(() => { loadSettings(); }, []);

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
    } catch (e) { console.log(e); }
  };

  const saveSettings = async () => {
    try {
      await AsyncStorage.setItem('wakeUp', wakeUp);
      await AsyncStorage.setItem('bedTime', bedTime);
      await AsyncStorage.setItem('dailyLiters', dailyLiters);
      await AsyncStorage.setItem('glassSize', glassSize);
    } catch (e) { console.log(e); }
  };

  const parseTime = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  };

  const createSchedule = () => {
    saveSettings();
    const wake = parseTime(wakeUp);
    const bed = parseTime(bedTime);
    const totalMl = parseFloat(dailyLiters) * 1000;
    const glasses = Math.ceil(totalMl / parseInt(glassSize));
    const interval = (bed.getTime() - wake.getTime()) / glasses;

    const times = Array.from({ length: glasses }, (_, i) => ({
      time: new Date(wake.getTime() + interval * (i + 1)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      done: false
    }));

    setSchedule(times);
  };

  const toggleDone = (index: number) => {
    const newSchedule = [...schedule];
    newSchedule[index].done = !newSchedule[index].done;
    setSchedule(newSchedule);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Wasser-Reminder</Text>

      {/* Erste Zeile: Aufsteh- & Schlafenszeit */}
      <View style={styles.inputRow}>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Aufstehzeit</Text>
          <TextInput style={styles.input} value={wakeUp} onChangeText={setWakeUp} keyboardType="numeric" />
        </View>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Schlafenszeit</Text>
          <TextInput style={styles.input} value={bedTime} onChangeText={setBedTime} keyboardType="numeric" />
        </View>
      </View>

      {/* Zweite Zeile: Tagesziel & Glasgröße */}
      <View style={styles.inputRow}>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Tagesziel (Liter)</Text>
          <TextInput style={styles.input} value={dailyLiters} onChangeText={setDailyLiters} keyboardType="numeric" />
        </View>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Glasgröße (ml)</Text>
          <TextInput style={styles.input} value={glassSize} onChangeText={setGlassSize} keyboardType="numeric" />
        </View>
      </View>

      <TouchableOpacity style={styles.button} onPress={createSchedule}>
        <Text style={styles.buttonText}>Trinkplan erstellen</Text>
      </TouchableOpacity>

      <Text style={styles.subtitle}>Trinkzeiten:</Text>
      <FlatList
        data={schedule}
        keyExtractor={(_, index) => index.toString()}
        renderItem={({ item, index }) => (
          <View style={styles.item}>
            <Text style={styles.itemText}>{item.time}</Text>
            <Switch value={item.done} onValueChange={() => toggleDone(index)} />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 50, backgroundColor: '#f2f2f2' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  inputRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  inputContainer: { flex: 1, marginHorizontal: 5 },
  label: { fontWeight: 'bold', marginBottom: 5, textAlign: 'center' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 50,        // komplett rund
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
  buttonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  subtitle: { fontSize: 20, fontWeight: 'bold', marginVertical: 20, textAlign: 'center' },
  item: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 15, backgroundColor: '#fff', borderRadius: 25, marginBottom: 5 },
  itemText: { fontSize: 16 },
});
