/**
 * Short, well-supported health facts: one daily tip on the Today card, and a "why it matters"
 * line in each habit's log sheet. Kept general (not medical advice) and each one names its source.
 */

export interface Tip {
  id: string;
  habit: 'steps' | 'water' | 'sleep' | 'calm';
  text: string;
  source: string;
}

export const TIPS: Tip[] = [
  { id: 's1', habit: 'steps', text: 'About 7,000 steps a day is linked to big health benefits, so you don’t need 10,000 to make a difference.', source: 'JAMA Network Open' },
  { id: 's2', habit: 'steps', text: 'Adults should aim for at least 150 minutes of moderate activity a week, like brisk walking. That’s about 20 minutes a day.', source: 'CDC' },
  { id: 's3', habit: 'steps', text: 'A short walk after a meal can help keep your blood sugar steadier.', source: 'Sports Medicine' },
  { id: 's4', habit: 'steps', text: 'Every bit of movement counts. Taking the stairs or a lap around the block adds up over the day.', source: 'CDC' },
  { id: 'w1', habit: 'water', text: 'Water helps your body keep a steady temperature, cushion your joints and clear out waste.', source: 'CDC' },
  { id: 'w2', habit: 'water', text: 'Tea, milk and water-rich foods like fruit and soup count toward your water, too.', source: 'Mayo Clinic' },
  { id: 'w3', habit: 'water', text: 'You need more water on hot days and when you exercise, so drink a little extra then.', source: 'CDC' },
  { id: 'w4', habit: 'water', text: 'Feeling thirsty, or darker yellow pee, can be a sign your body wants more water.', source: 'Mayo Clinic' },
  { id: 'z1', habit: 'sleep', text: 'Adults need 7 or more hours of sleep a night. Teens need 8 to 10.', source: 'CDC' },
  { id: 'z2', habit: 'sleep', text: 'Going to bed and waking up at the same time each day, even on weekends, helps you sleep better.', source: 'CDC' },
  { id: 'z3', habit: 'sleep', text: 'Screens in the hour before bed can make it harder to fall asleep. Try a book or music instead.', source: 'Sleep Foundation' },
  { id: 'z4', habit: 'sleep', text: 'Caffeine can stay in your system for hours. Having it earlier in the day helps your sleep.', source: 'Sleep Foundation' },
  { id: 'z5', habit: 'sleep', text: 'While you sleep, your body repairs itself and your brain sorts and stores memories.', source: 'NIH' },
  { id: 'c1', habit: 'calm', text: 'Morning daylight helps set your body clock, which makes it easier to fall asleep at night.', source: 'Sleep Foundation' },
  { id: 'c2', habit: 'calm', text: 'A few minutes of slow, deep breathing can help you feel calmer.', source: 'NIH' },
];

/** Today's tip: the same all day, a different one each day. */
export function tipFor(dayKey: string): Tip {
  let h = 0;
  for (const ch of dayKey) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TIPS[h % TIPS.length];
}

/** Why each habit matters, for the habit's log sheet. {pet} is replaced with the pet's name. */
export const WHY: Record<'steps' | 'water' | 'sleep', { text: string; pet: string; source: string }> = {
  steps: {
    text: 'Walking regularly strengthens your heart and lungs, lifts your mood and helps you sleep better.',
    pet: '{pet} feels it too: reach your step goal and {pet} starts battles Energized, with extra energy.',
    source: 'CDC',
  },
  water: {
    text: 'Water helps your body keep a steady temperature, cushion your joints and clear out waste. Tea, milk and water-rich foods count too.',
    pet: '{pet} feels it as well: reach your water goal and {pet} is Hydrated, with better defense.',
    source: 'CDC, Mayo Clinic',
  },
  sleep: {
    text: 'Good sleep helps your body recover and your brain focus. Most adults need 7 or more hours a night.',
    pet: '{pet} feels it too: sleep 7+ hours and {pet} is Well Rested, and faster in battle.',
    source: 'CDC',
  },
};
