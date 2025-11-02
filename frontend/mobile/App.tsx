// @ts-nocheck
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Button, SafeAreaView, Text, TextInput, View } from 'react-native';

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [wsState, setWsState] = useState('disconnected');

  useEffect(() => {
    // placeholder: would call web/api to fetch JWT and connect signaling
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: '600' }}>VoIP Mobile</Text>
      <Text style={{ marginTop: 8, color: '#666' }}>Status: {wsState}</Text>
      <View style={{ height: 12 }} />
      <TextInput placeholder="Number" style={{ width: '80%', borderColor: '#ccc', borderWidth: 1, borderRadius: 6, padding: 8 }} />
      <View style={{ height: 12 }} />
      <Button title="Call" onPress={() => {}} />
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}


