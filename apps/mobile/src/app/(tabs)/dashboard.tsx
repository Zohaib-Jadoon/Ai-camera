import { View, Text, ScrollView } from 'react-native';
import { Camera, ShieldAlert, Users, Eye } from 'lucide-react-native';

export default function Dashboard() {
  return (
    <ScrollView className="flex-1 bg-zinc-950 p-6">
      <View className="mb-8 mt-12">
        <Text className="text-3xl font-bold text-white">Dashboard</Text>
        <Text className="text-zinc-500">System overview</Text>
      </View>

      <View className="flex-row flex-wrap justify-between gap-4">
        <StatCard title="Online" value="12" color="#3b82f6" icon={Camera} />
        <StatCard title="Alerts" value="4" color="#ef4444" icon={ShieldAlert} />
        <StatCard title="Detections" value="1.2k" color="#22c55e" icon={Eye} />
        <StatCard title="Faces" value="86" color="#a855f7" icon={Users} />
      </View>

      <View className="mt-8 p-6 bg-zinc-900 rounded-3xl border border-zinc-800">
        <Text className="text-white font-bold text-lg mb-4">Recent Activity</Text>
        <ActivityItem title="Human Detected" time="2 mins ago" camera="Main Gate" />
        <ActivityItem title="Car Entered" time="15 mins ago" camera="Parking" />
        <ActivityItem title="Unknown Face" time="1 hour ago" camera="Entrance" />
      </View>
    </ScrollView>
  );
}

function StatCard({ title, value, color, icon: Icon }: any) {
  return (
    <View className="w-[47%] p-5 bg-zinc-900 rounded-3xl border border-zinc-800 items-center">
      <View style={{ backgroundColor: `${color}20` }} className="p-3 rounded-2xl mb-3">
        <Icon color={color} size={24} />
      </View>
      <Text className="text-zinc-500 text-xs uppercase font-bold">{title}</Text>
      <Text className="text-2xl font-bold text-white">{value}</Text>
    </View>
  );
}

function ActivityItem({ title, time, camera }: any) {
  return (
    <View className="flex-row items-center justify-between py-3 border-b border-zinc-800">
        <View>
            <Text className="text-white font-medium">{title}</Text>
            <Text className="text-zinc-500 text-xs">{camera}</Text>
        </View>
        <Text className="text-zinc-600 text-xs">{time}</Text>
    </View>
  );
}
