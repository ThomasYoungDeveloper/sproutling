import { HStack, Image, ProgressView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { aspectRatio, font, foregroundStyle, frame, labelsHidden, lineLimit, monospacedDigit, padding, resizable, tint } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';

/**
 * Live Activity while a pet is on an adventure: a live countdown on the Lock Screen and in the
 * Dynamic Island, with stops along the way (fights, food, the treasure at the end).
 * A stop shows "?" until the pet gets there, so the result stays a surprise.
 */
export type TripStop = { at: number; kind: 'fight' | 'food' | 'end'; label: string; won?: boolean };

export type TripActivityProps = {
  name: string;
  place: string;
  image: string | null;
  startAt: number;
  endAt: number;
  hp: number;
  /** Stops in order. `at` is the time (ms) the pet reaches it. */
  stops: TripStop[];
  knockedOut: boolean;
};

const TripActivity = (props: TripActivityProps, env: LiveActivityEnvironment) => {
  'widget';
  void env;
  const now = Date.now();
  const home = now >= props.endAt;
  // Pet pictures are large PNGs: resizable + fit so they shrink into the frame instead of being cropped.
  const petAt = (size: number) =>
    props.image ? (
      <Image uiImage={props.image} modifiers={[resizable(), aspectRatio({ contentMode: 'fit' }), frame({ width: size, height: size })]} />
    ) : (
      <Image systemName="pawprint.fill" size={Math.round(size * 0.6)} color="#7CF0B5" />
    );
  const pet = petAt(52);
  // One small icon per stop (no text, so the row stays tidy); stops ahead stay a muted '?'.
  const stopRow = (
    <HStack spacing={5}>
      {props.stops.map((s, i) => {
        const reached = now >= s.at;
        const color = !reached ? '#6F679C' : s.kind === 'fight' ? (s.won ? '#7CF0B5' : '#FF9A8A') : s.kind === 'food' ? '#FFD98A' : '#FFC08A';
        return (
          <Image
            key={i}
            systemName={!reached ? 'questionmark.circle.fill' : s.kind === 'fight' ? (s.won ? 'checkmark.circle.fill' : 'xmark.circle.fill') : s.kind === 'food' ? 'leaf.circle.fill' : 'gift.circle.fill'}
            size={15}
            color={color}
          />
        );
      })}
    </HStack>
  );
  const lastReached = [...props.stops].reverse().find((s) => now >= s.at);
  const latest = lastReached
    ? lastReached.kind === 'fight'
      ? lastReached.won
        ? 'Won a fight'
        : 'Knocked out in a fight'
      : lastReached.kind === 'food'
        ? `Found ${lastReached.label}`
        : `Found a ${lastReached.label}`
    : 'On the way…';
  const bar = (
    <ProgressView timerInterval={{ lower: new Date(props.startAt), upper: new Date(props.endAt) }} countsDown={false} modifiers={[labelsHidden(), tint('#7CF0B5')]} />
  );
  const title = home ? (props.knockedOut ? `${props.name} was knocked out` : `${props.name} is home!`) : `${props.name} · ${props.place}`;
  const timer = <Text timerInterval={{ lower: new Date(now), upper: new Date(props.endAt) }} modifiers={[font({ weight: 'heavy', size: 14 }), monospacedDigit(), foregroundStyle('#7CF0B5')]} />;
  // The Dynamic Island's small side has little room: a fixed width keeps the countdown from being cut off.
  const smallTimer = (
    <Text timerInterval={{ lower: new Date(now), upper: new Date(props.endAt) }} modifiers={[font({ weight: 'heavy', size: 13 }), monospacedDigit(), foregroundStyle('#7CF0B5'), frame({ width: 56 })]} />
  );

  return {
    banner: (
      <VStack alignment="leading" spacing={8} modifiers={[padding({ all: 14 })]}>
        <HStack spacing={10}>
          {pet}
          <VStack alignment="leading" spacing={2}>
            <Text modifiers={[font({ weight: 'heavy', size: 16 }), foregroundStyle('#FFFFFF'), lineLimit(1)]}>{title}</Text>
            {home ? (
              <Text modifiers={[font({ weight: 'bold', size: 12 }), foregroundStyle('#E6E0FF')]}>{props.knockedOut ? 'Came home early with what it found' : 'Tap to open the loot'}</Text>
            ) : (
              <HStack spacing={4}>
                <Text modifiers={[font({ weight: 'bold', size: 12 }), foregroundStyle('#E6E0FF')]}>Home in</Text>
                {timer}
              </HStack>
            )}
          </VStack>
          <Spacer />
          <VStack spacing={0}>
            <Text modifiers={[font({ weight: 'heavy', size: 10 }), foregroundStyle('#C9C0F0')]}>HP</Text>
            <Text modifiers={[font({ weight: 'heavy', size: 16 }), foregroundStyle(props.hp < 50 ? '#F0B429' : '#7CF0B5')]}>{`${props.hp}%`}</Text>
          </VStack>
        </HStack>
        {home ? null : bar}
        <HStack spacing={8}>
          {stopRow}
          <Spacer />
          <Text modifiers={[font({ weight: 'bold', size: 12 }), foregroundStyle('#E6E0FF'), lineLimit(1)]}>{latest}</Text>
        </HStack>
      </VStack>
    ),
    compactLeading: petAt(24),
    compactTrailing: home ? <Text modifiers={[font({ weight: 'heavy', size: 13 }), foregroundStyle('#7CF0B5')]}>Home</Text> : smallTimer,
    minimal: <Image systemName="pawprint.fill" size={14} color="#7CF0B5" />,
    expandedLeading: petAt(44),
    expandedTrailing: home ? null : timer,
    expandedCenter: <Text modifiers={[font({ weight: 'heavy', size: 15 }), foregroundStyle('#FFFFFF')]}>{title}</Text>,
    expandedBottom: (
      <VStack alignment="leading" spacing={6}>
        {home ? null : bar}
        <HStack spacing={8}>
          {stopRow}
          <Spacer />
          <Text modifiers={[font({ weight: 'bold', size: 12 }), foregroundStyle('#E6E0FF'), lineLimit(1)]}>{latest}</Text>
        </HStack>
      </VStack>
    ),
  };
};

/** Made on first use, for the same reason as makePetWidget. */
export function makeTripActivity() {
  return createLiveActivity<TripActivityProps>('TripActivity', TripActivity);
}
