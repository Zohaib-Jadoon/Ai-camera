import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { Camera, Circle } from 'lucide-react-native';

export default function Cameras() {
  const cameras = [
    { id: '1', name: 'Main Gate', status: 'ONLINE' },
    { id: '2', name: 'Backyard', status: 'ONLINE' },
    { id: '3', name: 'Warehouse', status: 'OFFLINE' },
    { id: '4', name: 'Parking Lot', status: 'ONLINE' },
  ];

  return (
    <View className="flex-1 bg-zinc-950 p-6">
      <View className="mb-8 mt-12">
        <Text className="text-3xl font-bold text-white">Cameras</Text>
        <Text className="text-zinc-500">Live camera management</Text>
      </View>

      <FlatList
        data={cameras}
        numColumns={2}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity className="w-[47%] bg-zinc-900 aspect-square rounded-3xl border border-zinc-800 m-1.5 p-5 justify-between">
            <View className="flex-row justify-between">
                <View className="p-2 bg-zinc-800 rounded-xl">
                    <Camera color="#71717a" size={20} />
                </View>
                <Circle color={item.status === 'ONLINE' ? '#22c55e' : '#ef4444'} size={12} fill={item.status === 'ONLINE' ? '#22c55e' : '#ef4444'} />
            </View>
            <View>
                <Text className="text-white font-bold">{item.name}</Text>
                <Text className="text-zinc-500 text-xs">{item.status}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
