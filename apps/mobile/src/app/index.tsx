import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { useRouter } from 'expo-router';

export default function Login() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-zinc-950 items-center justify-center p-6">
      <View className="w-full max-w-sm space-y-6">
        <Text className="text-4xl font-bold text-white text-center">Madad AI</Text>
        <Text className="text-zinc-400 text-center mb-8">Enter your credentials to continue</Text>

        <View className="space-y-4">
            <TextInput
                placeholder="Email"
                placeholderTextColor="#71717a"
                className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-2xl text-white"
            />
            <TextInput
                placeholder="Password"
                secureTextEntry
                placeholderTextColor="#71717a"
                className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-2xl text-white"
            />
            <TouchableOpacity
                onPress={() => router.replace('/(tabs)/dashboard')}
                className="w-full bg-blue-600 p-4 rounded-2xl items-center"
            >
                <Text className="text-white font-bold text-lg">Sign In</Text>
            </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
