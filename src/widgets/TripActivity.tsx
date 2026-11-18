import { HStack, Image, ProgressView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, frame, padding } from '@expo/ui/swift-ui/modifiers';
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
  const pet = props.image ? <Image uiImage={props.image} modifiers={[frame({ width: 48, height: 48 })]} /> : <Image systemName="pawprint.fill" size={28} color="#7CF0B5" />;
  const stopRow = (
    <HStack spacing={6}>
      {props.stops.map((s, i) => {
        const reached = now >= s.at;
        const color = !reached ? '#8C84B8' : s.kind === 'fight' ? (s.won ? '#7CF0B5' : '#FF9A8A') : s.kind === 'food' ? '#FFD98A' : '#FFC08A';
        const text = !reached ? '?' : s.label;
        return (
          <HStack key={i} spacing={3}>
            <Image systemName={!reached ? 'questionmark.circle.fill' : s.kind === 'fight' ? (s.won ? 'checkmark.circle.fill' : 'xmark.circle.fill') : s.kind === 'food' ? 'leaf.circle.fill' : 'gift.circle.fill'} size={14} color={color} />
            <Text modifiers={[font({ weight: 'heavy', size: 11 }), foregroundStyle(color)]}>{text}</Text>
          </HStack>
        );
      })}
    </HStack>
  );
  const title = home ? (props.knockedOut ? `${props.name} was knocked out` : `${props.name} is home!`) : `${props.name} · ${props.place}`;
  const timer = <Text timerInterval={{ lower: new Date(now), upper: new Date(props.endAt) }} modifiers={[font({ weight: 'heavy', size: 14 }), foregroundStyle('#7CF0B5')]} />;

  return {
    banner: (
      <VStack alignment="leading" spacing={8} modifiers={[padding({ all: 14 })]}>
        <HStack spacing={10}>
          {pet}
          <VStack alignment="leading" spacing={2}>
            <Text modifiers={[font({ weight: 'heavy', size: 16 }), foregroundStyle('#FFFFFF')]}>{title}</Text>
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
        {home ? null : <ProgressView timerInterval={{ lower: new Date(props.startAt), upper: new Date(props.endAt) }} countsDown={false} />}
        {stopRow}
      </VStack>
    ),
    compactLeading: pet,
    compactTrailing: home ? <Text modifiers={[font({ weight: 'heavy', size: 13 }), foregroundStyle('#7CF0B5')]}>Home</Text> : timer,
    minimal: <Image systemName="pawprint.fill" size={14} color="#7CF0B5" />,
    expandedLeading: pet,
    expandedTrailing: home ? null : timer,
    expandedCenter: <Text modifiers={[font({ weight: 'heavy', size: 15 }), foregroundStyle('#FFFFFF')]}>{title}</Text>,
    expandedBottom: (
      <VStack alignment="leading" spacing={6}>
        {home ? null : <ProgressView timerInterval={{ lower: new Date(props.startAt), upper: new Date(props.endAt) }} countsDown={false} />}
        {stopRow}
      </VStack>
    ),
  };
};

/** Made on first use, for the same reason as makePetWidget. */
export function makeTripActivity() {
  return createLiveActivity<TripActivityProps>('TripActivity', TripActivity);
}
