import { View, Text, FlatList } from 'react-native';
import { ShieldAlert } from 'lucide-react-native';

export default function Alerts() {
  const alerts = [
    { id: '1', type: 'Intrusion', camera: 'Main Gate', time: '2 mins ago', severity: 'High' },
    { id: '2', type: 'Unknown Face', camera: 'Entrance', time: '1 hour ago', severity: 'Medium' },
    { id: '3', type: 'Loitering', camera: 'Backyard', time: '3 hours ago', severity: 'Low' },
  ];

  return (
    <View className="flex-1 bg-zinc-950 p-6">
      <View className="mb-8 mt-12">
        <Text className="text-3xl font-bold text-white">Alerts</Text>
        <Text className="text-zinc-500">Critical security events</Text>
      </View>

      <FlatList
        data={alerts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View className="bg-zinc-900 p-4 rounded-3xl border border-zinc-800 mb-4 flex-row items-center gap-4">
            <View className="p-3 bg-red-500/10 rounded-2xl">
                <ShieldAlert color="#ef4444" size={24} />
            </View>
            <View className="flex-1">
                <Text className="text-white font-bold">{item.type}</Text>
                <Text className="text-zinc-500 text-xs">{item.camera} • {item.time}</Text>
            </View>
            <View className="bg-zinc-800 px-3 py-1 rounded-full">
                <Text className="text-zinc-400 text-[10px] font-bold uppercase">{item.severity}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}
