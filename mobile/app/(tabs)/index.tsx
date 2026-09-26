import { useState } from 'react';
import { Button } from 'react-native';

import { Placeholder } from '@/components/Placeholder';
import { Text } from '@/components/Themed';
import { API_URL, analyze } from '@/src/api';

// TODO(ui-owner): camera / photo picker -> analyze -> info panel + 3D scene.
// TODO(3d-owner): 3D plant via expo-gl + @react-three/fiber/native.
export default function PlantScreen() {
  const [status, setStatus] = useState('');

  // Smoke check against the API (mock mode ignores the image). Remove once the real flow exists.
  async function ping() {
    setStatus('Calling ' + API_URL + ' ...');
    try {
      const scan = await analyze({ imageBase64: 'mock', mediaType: 'image/jpeg' });
      setStatus(`OK: ${scan.identity.commonName}`);
    } catch (e) {
      setStatus(`Error: ${(e as Error).message}`);
    }
  }

  return (
    <Placeholder title="Plant" note="Take a photo of your plant and see its future.">
      <Button title="Test API" onPress={ping} />
      {status ? <Text>{status}</Text> : null}
    </Placeholder>
  );
}
