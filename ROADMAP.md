# Sproutling roadmap (future features)

Ideas Tom wants later. Most need the native app with real health data and location first.

## 1. Walking finds (needs native app + health data)
While you walk, you randomly find an egg or a chest, with a push notification ("Your pet found something on your walk!").
- Base it on real step data only (HealthKit / Health Connect), never on manual entry, so it can't be cheated.
- Roll a find every ~1,000 verified steps (e.g. 8% egg, 12% chest), capped per day so it stays special.
- Background step updates + `expo-notifications` for the push. Store the last processed step count so a find is only rolled once.
- Effort: small once health data and push notifications are in place.

## 2. Gyms (needs location + a server)
Pokémon GO style: place your pet in a gym to claim an area. The longer you hold it, the more you earn.
- Gyms = real places (parks, trails) from a map data source. Only claimable when you're physically near (GPS check).
- Server owns the state: gym owner, pet card, claimed since. Challengers battle the defending pet (our battle engine already runs offline, so the server re-runs the battle to verify).
- Rewards: coins per hour held, paid when your pet is knocked out or recalled (capped per day).
- Hard parts: location spoofing/cheating, picking safe locations (no private homes or schools, which matters with players aged 13+), moderation, and enough players nearby for it to feel alive. Start with a small number of hand-picked gyms per city.
- Effort: large. Plan it after launch, once there are enough active players.

## 3. Raid battles (location-based)
A big boss appears at a gym for a limited time; nearby players team up to beat it for rare pets and high-grade rewards.
- Builds on gyms + the guild boss raid we already have (shared HP pool on the server).
- Real-time co-op battle needs a live connection (Supabase Realtime); a simpler first version is "everyone attacks within 45 minutes, damage adds up".
- Raid pets hatch with a high grade floor (e.g. every stat at least 10, like Pokémon GO).
- Effort: medium once gyms exist.

## Other
- Native push notifications (expo-notifications) for reminders, trades, gifts, raids.
- In-app purchases for Premium (RevenueCat).
- New battle-style monster art (same art style).
- More seasonal events: spring, summer, Halloween (each needs a hat, aura, scene and toy).
