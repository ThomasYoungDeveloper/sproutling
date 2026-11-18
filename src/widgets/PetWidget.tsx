import { HStack, Image, ProgressView, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import { aspectRatio, containerBackground, font, foregroundStyle, frame, labelsHidden, lineLimit, minimumScaleFactor, padding, resizable, tint } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

/**
 * Home screen widget. Small: your active pet, mood, steps and streak.
 * Medium: your pet plus its adventure (live countdown) or today's habits.
 * Everything comes in through props (widgets can't read app state).
 */
export type PetWidgetProps = {
  name: string;
  level: number;
  mood: string;
  image?: string | null;
  steps: number;
  stepGoal: number;
  waterPct: number;
  sleepPct: number;
  streak: number;
  waiting?: string | null;
  trip?: null | { place: string; startAt: number; endAt: number; hp: number; knockedOut: boolean };
};

export const PetWidget = (props: PetWidgetProps, env: WidgetEnvironment) => {
  'widget';
  const small = env.widgetFamily === 'systemSmall';
  const now = env.date ? env.date.getTime() : Date.now();
  const trip = props.trip;
  const home = !!trip && now >= trip.endAt;
  const stepsK = props.steps >= 1000 ? `${(props.steps / 1000).toFixed(1)}k` : `${props.steps}`;
  const stepPct = Math.min(1, props.steps / Math.max(1, props.stepGoal));
  const pet = props.image ? <Image uiImage={props.image} modifiers={[resizable(), aspectRatio({ contentMode: 'fit' }), frame({ width: small ? 76 : 96, height: small ? 76 : 96 })]} /> : <Image systemName="pawprint.fill" size={44} color="#2EB88A" />;

  if (small) {
    return (
      <VStack alignment="leading" spacing={2} modifiers={[containerBackground('#DFF3EA', 'widget')]}>
        <HStack>
          <VStack alignment="leading" spacing={0}>
            <Text modifiers={[font({ weight: 'heavy', size: 13 }), foregroundStyle('#1F3A33')]}>{`${props.name} · Lv ${props.level}`}</Text>
            <Text modifiers={[font({ weight: 'bold', size: 11 }), foregroundStyle('#1E8A68')]}>{trip ? (home ? 'Home from a trip!' : `In ${trip.place}`) : props.mood}</Text>
          </VStack>
          <Spacer />
        </HStack>
        <HStack>
          <Spacer />
          {pet}
          <Spacer />
        </HStack>
        {trip && !home ? (
          <ProgressView timerInterval={{ lower: new Date(trip.startAt), upper: new Date(trip.endAt) }} countsDown={false} modifiers={[labelsHidden(), tint('#7CF0B5')]} />
        ) : (
          <ProgressView value={stepPct} modifiers={[labelsHidden(), tint('#2EB88A')]} />
        )}
        <HStack>
          <Text modifiers={[font({ weight: 'heavy', size: 11 }), foregroundStyle('#1F3A33')]}>{`${props.streak}-day streak`}</Text>
          <Spacer />
          {trip && !home ? (
            <Text timerInterval={{ lower: new Date(now), upper: new Date(trip.endAt) }} modifiers={[font({ weight: 'heavy', size: 11 }), foregroundStyle('#1F3A33')]} />
          ) : (
            <Text modifiers={[font({ weight: 'heavy', size: 11 }), foregroundStyle('#1F3A33')]}>{`${stepsK} steps`}</Text>
          )}
        </HStack>
      </VStack>
    );
  }

  if (trip) {
    return (
      <HStack spacing={10} modifiers={[containerBackground('#3B3266', 'widget')]}>
        {pet}
        <VStack alignment="leading" spacing={4}>
          <Text modifiers={[font({ weight: 'heavy', size: 10 }), foregroundStyle('#C9C0F0')]}>{home ? (trip.knockedOut ? 'CAME HOME EARLY' : 'BACK HOME') : 'ON AN ADVENTURE'}</Text>
          <Text modifiers={[font({ weight: 'heavy', size: 16 }), foregroundStyle('#FFFFFF'), lineLimit(2), minimumScaleFactor(0.85)]}>{home ? (trip.knockedOut ? `${props.name} was knocked out` : `${props.name} is back!`) : `${props.name} is in ${trip.place}`}</Text>
          {home ? (
            <Text modifiers={[font({ weight: 'bold', size: 12 }), foregroundStyle('#E6E0FF')]}>Tap to see what it found</Text>
          ) : (
            <HStack spacing={4}>
              <Text modifiers={[font({ weight: 'bold', size: 12 }), foregroundStyle('#E6E0FF')]}>Home in</Text>
              <Text timerInterval={{ lower: new Date(now), upper: new Date(trip.endAt) }} modifiers={[font({ weight: 'heavy', size: 12 }), foregroundStyle('#FFFFFF')]} />
            </HStack>
          )}
          {home ? null : <ProgressView timerInterval={{ lower: new Date(trip.startAt), upper: new Date(trip.endAt) }} countsDown={false} modifiers={[labelsHidden(), tint('#7CF0B5')]} />}
          <Text modifiers={[font({ weight: 'heavy', size: 11 }), foregroundStyle('#E6E0FF')]}>{`HP ${trip.hp}%`}</Text>
        </VStack>
      </HStack>
    );
  }

  return (
    <HStack spacing={10} modifiers={[containerBackground('#FFFBF2', 'widget')]}>
      <VStack spacing={2}>
        {pet}
        <Text modifiers={[font({ weight: 'heavy', size: 12 }), foregroundStyle('#24323A')]}>{`${props.name} · ${props.mood}`}</Text>
      </VStack>
      <VStack alignment="leading" spacing={6}>
        <ZStack>
          <VStack alignment="leading" spacing={2}>
            <Text modifiers={[font({ weight: 'heavy', size: 12 }), foregroundStyle('#24323A')]}>{`Steps ${stepsK}`}</Text>
            <ProgressView value={stepPct} modifiers={[labelsHidden(), tint('#2EB88A')]} />
          </VStack>
        </ZStack>
        <VStack alignment="leading" spacing={2}>
          <Text modifiers={[font({ weight: 'heavy', size: 12 }), foregroundStyle('#24323A')]}>Water</Text>
          <ProgressView value={props.waterPct} modifiers={[labelsHidden(), tint('#2EB88A')]} />
        </VStack>
        <VStack alignment="leading" spacing={2}>
          <Text modifiers={[font({ weight: 'heavy', size: 12 }), foregroundStyle('#24323A')]}>Sleep</Text>
          <ProgressView value={props.sleepPct} modifiers={[labelsHidden(), tint('#2EB88A')]} />
        </VStack>
        <Text modifiers={[font({ weight: 'heavy', size: 11 }), foregroundStyle(props.waiting ? '#C2365C' : '#5C6F69'), padding({ top: 2 })]}>{props.waiting ?? `${props.streak}-day streak`}</Text>
      </VStack>
    </HStack>
  );
};

/** Starting values before the first update. No null values: iOS can't store them in the shared widget storage. */
export const PET_WIDGET_INITIAL: PetWidgetProps = {
  name: 'Your pet',
  level: 1,
  mood: 'Happy',
  steps: 0,
  stepGoal: 8000,
  waterPct: 0,
  sleepPct: 0,
  streak: 0,
};

/**
 * For the app: made on first use (not when this file loads), so an iOS error here is an ordinary
 * catchable error. An error while a file loads counts as fatal in React Native and closes the app.
 * (PetWidget.layout.tsx registers the same widget at load time, but only the iPhone build step reads that file.)
 */
export function makePetWidget() {
  return createWidget<PetWidgetProps>('PetWidget', PetWidget, PET_WIDGET_INITIAL);
}
