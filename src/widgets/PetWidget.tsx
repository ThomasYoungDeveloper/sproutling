import { Ellipse, HStack, Image, ProgressView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { aspectRatio, containerBackground, font, foregroundStyle, frame, labelsHidden, lineLimit, minimumScaleFactor, monospacedDigit, resizable, shadow, tint } from '@expo/ui/swift-ui/modifiers';
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
  const nowDate = env.date ?? new Date();
  const now = nowDate.getTime();
  const hour = nowDate.getHours();
  const trip = props.trip;
  const home = !!trip && now >= trip.endAt;
  const away = !!trip && !home;
  const stepsText = props.steps.toLocaleString();
  const stepPct = Math.min(1, props.steps / Math.max(1, props.stepGoal));

  // The sky follows the real time of day; on an adventure it takes the place's colors instead.
  // Widgets can't place gradient stops, so colors repeat to hold the sky and fade into grass at the bottom.
  const grass = ['#6CC77E', '#4FB06A'];
  const sky =
    hour >= 5 && hour < 8
      ? { colors: ['#FFB08A', '#FFC9A3', '#FFE2B8', '#CDEBFF'], light: true, orb: '#FFE58A', part: 'GOOD MORNING' }
      : hour >= 8 && hour < 17
        ? { colors: ['#3E9BEF', '#5FB4F7', '#8CCBFF', '#BFE6FF'], light: true, orb: '#FFE58A', part: 'TODAY' }
        : hour >= 17 && hour < 20
          ? { colors: ['#FF8A5C', '#FF7088', '#D46FB8', '#B07AD6'], light: true, orb: '#FFD27A', part: 'THIS EVENING' }
          : { colors: ['#1C1846', '#2E2468', '#4A3590', '#6A4AA8'], light: false, orb: '#F4EFD8', part: 'TONIGHT' };
  const PLACE_SKY: Record<string, string[]> = {
    'Mossy Meadow': ['#5FB4F7', '#8FD39A', '#5DBB6E', '#3F9A5C'],
    'Crystal Caves': ['#231B4F', '#3B2C7A', '#2E6E8A', '#2BA3A0'],
    'Sakura Shrine': ['#FF9EBB', '#FFB8CC', '#F78FB0', '#C86FA0'],
    'Moon Mountain': ['#141235', '#25205C', '#3C2F82', '#5B4596'],
  };
  const bgColors = trip ? PLACE_SKY[trip.place] ?? ['#3B3266', '#5C4C9A'] : [...sky.colors, sky.colors[3], grass[0], grass[1]];
  const bg = containerBackground({ type: 'linearGradient', colors: bgColors, startPoint: { x: 0.5, y: 0 }, endPoint: { x: 0.5, y: 1 } }, 'widget');
  const white = foregroundStyle('#FFFFFF');
  const soft = foregroundStyle('#F2F0FF');
  const lift = shadow({ radius: 2, y: 1, color: '#00000040' });
  const orb = trip ? null : <Ellipse modifiers={[frame({ width: small ? 22 : 28, height: small ? 22 : 28 }), foregroundStyle(sky.orb), shadow({ radius: 8, color: sky.orb })]} />;
  const pet = props.image ? (
    <Image uiImage={props.image} modifiers={[resizable(), aspectRatio({ contentMode: 'fit' }), frame({ width: small ? 78 : 108, height: small ? 78 : 108 }), shadow({ radius: 3, y: 2, color: '#00000030' })]} />
  ) : (
    <Image systemName="pawprint.fill" size={44} color="#FFFFFF" />
  );

  if (small) {
    return (
      <VStack alignment="leading" spacing={0} modifiers={[bg]}>
        <HStack alignment="top">
          <VStack alignment="leading" spacing={0}>
            {away ? (
              <Text timerInterval={{ lower: new Date(now), upper: new Date(trip!.endAt) }} modifiers={[font({ weight: 'black', size: 22 }), monospacedDigit(), white, lift]} />
            ) : (
              <Text modifiers={[font({ weight: 'black', size: 26 }), white, lift, minimumScaleFactor(0.7), lineLimit(1)]}>{trip ? 'Home!' : stepsText}</Text>
            )}
            <Text modifiers={[font({ weight: 'heavy', size: 10 }), soft, lift, lineLimit(1)]}>{away ? `IN ${trip!.place.toUpperCase()}` : trip ? 'TAP FOR THE LOOT' : 'STEPS TODAY'}</Text>
          </VStack>
          <Spacer />
          {orb}
        </HStack>
        <Spacer />
        <HStack alignment="bottom" spacing={0}>
          <VStack alignment="leading" spacing={1}>
            <Text modifiers={[font({ weight: 'heavy', size: 12 }), white, lift, lineLimit(1)]}>{props.name}</Text>
            <Text modifiers={[font({ weight: 'bold', size: 10 }), white, lift, lineLimit(1)]}>{props.waiting ? props.waiting : trip ? `HP ${trip.hp}%` : `${props.streak}-day streak`}</Text>
          </VStack>
          <Spacer />
          {pet}
        </HStack>
      </VStack>
    );
  }

  if (trip) {
    return (
      <HStack spacing={10} modifiers={[bg]}>
        {pet}
        <VStack alignment="leading" spacing={4}>
          <Text modifiers={[font({ weight: 'heavy', size: 10 }), soft, lift]}>{home ? (trip.knockedOut ? 'CAME HOME EARLY' : 'BACK HOME') : 'ON AN ADVENTURE'}</Text>
          <Text modifiers={[font({ weight: 'heavy', size: 17 }), white, lift, lineLimit(2), minimumScaleFactor(0.85)]}>{home ? (trip.knockedOut ? `${props.name} was knocked out` : `${props.name} is back!`) : `${props.name} is in ${trip.place}`}</Text>
          {home ? (
            <Text modifiers={[font({ weight: 'bold', size: 12 }), white, lift]}>Tap to see what it found</Text>
          ) : (
            <HStack spacing={4}>
              <Text modifiers={[font({ weight: 'bold', size: 12 }), white, lift]}>Home in</Text>
              <Text timerInterval={{ lower: new Date(now), upper: new Date(trip.endAt) }} modifiers={[font({ weight: 'heavy', size: 12 }), monospacedDigit(), white, lift]} />
            </HStack>
          )}
          {home ? null : <ProgressView timerInterval={{ lower: new Date(trip.startAt), upper: new Date(trip.endAt) }} countsDown={false} modifiers={[labelsHidden(), tint('#FFFFFF')]} />}
          <Text modifiers={[font({ weight: 'heavy', size: 11 }), white, lift]}>{`HP ${trip.hp}%`}</Text>
        </VStack>
      </HStack>
    );
  }

  return (
    <HStack spacing={8} modifiers={[bg]}>
      <VStack spacing={0}>
        <Spacer />
        {pet}
      </VStack>
      <VStack alignment="leading" spacing={5}>
        <HStack alignment="top">
          <VStack alignment="leading" spacing={0}>
            <Text modifiers={[font({ weight: 'heavy', size: 10 }), soft, lift]}>{sky.part}</Text>
            <Text modifiers={[font({ weight: 'black', size: 26 }), white, lift, lineLimit(1), minimumScaleFactor(0.7)]}>{stepsText}</Text>
          </VStack>
          <Spacer />
          {orb}
        </HStack>
        <VStack alignment="leading" spacing={2}>
          <ProgressView value={stepPct} modifiers={[labelsHidden(), tint('#FFFFFF')]} />
          <Text modifiers={[font({ weight: 'bold', size: 11 }), white, lift]}>{`of ${props.stepGoal.toLocaleString()} steps · ${props.streak}-day streak`}</Text>
        </VStack>
        <HStack spacing={8}>
          <VStack alignment="leading" spacing={1}>
            <Text modifiers={[font({ weight: 'heavy', size: 10 }), white, lift]}>Water</Text>
            <ProgressView value={props.waterPct} modifiers={[labelsHidden(), tint('#BDEBFF')]} />
          </VStack>
          <VStack alignment="leading" spacing={1}>
            <Text modifiers={[font({ weight: 'heavy', size: 10 }), white, lift]}>Sleep</Text>
            <ProgressView value={props.sleepPct} modifiers={[labelsHidden(), tint('#E3D9FF')]} />
          </VStack>
        </HStack>
        <Text modifiers={[font({ weight: 'heavy', size: 11 }), white, lift, lineLimit(1)]}>{props.waiting ?? `${props.name} is ${props.mood.toLowerCase()}`}</Text>
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
