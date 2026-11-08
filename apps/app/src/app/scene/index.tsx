import { useRouter } from 'expo-router';
import { SceneBody } from '@/components/SceneBody';

export default function SceneScreen() {
  const router = useRouter();
  return <SceneBody onBack={() => router.back()} />;
}
