import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import PetSprite from '../components/PetSprite';
import { SPECIES } from '../game/species';
import { COSMETICS } from '../game/cosmetics';

/** Hidden preview page (?lab=hats) for checking how every hat sits on every pet. */
export default function LabScreen() {
  const hats = COSMETICS.filter((c) => c.slot === 'hat');
  return (
    <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', padding: 8, backgroundColor: '#fff' }}>
      {SPECIES.map((sp, i) => (
        <View key={sp.id} style={{ width: 96, height: 120, alignItems: 'center', marginBottom: 6 }}>
          <PetSprite species={sp} stage="adult" size={86} hat={hats[i % hats.length].id} />
          <Text style={{ fontSize: 12 }}>{sp.id} {hats[i % hats.length].id}</Text>
        </View>
      ))}
    </ScrollView>
  );
}
