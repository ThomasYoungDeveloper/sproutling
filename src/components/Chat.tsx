import React, { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Text } from './ScaledText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useChat, QUICK_PHRASES, type ChatMessage, type ChatRoom } from '../state/ChatContext';
import { useFriends } from '../state/FriendsContext';
import { useTeam } from '../state/TeamContext';
import { useAuth } from '../state/AuthContext';
import { useGame } from '../state/GameContext';
import { useOverlay } from './Overlay';
import PetSprite from './PetSprite';
import { FitSheet, Button, useSidePad } from './ui';
import { buzz } from './fx';
import { colors, font, space } from '../theme';
import { SPECIES_BY_ID } from '../game/species';
import * as A from '../game/actions';
import { stageFor } from '../game/scoring';
import { supabase } from '../lib/supabase';
import { appBuild } from '../lib/appBuild';
import { SKIN_INFO } from '../game/skins';
import type { Skin } from '../game/types';
import { momentText, REACTIONS, useRoomReactions, type Reaction } from '../lib/moments';
import RankTag from './RankTag';
import GuildTag from './GuildTag';
import { usePlaza } from '../lib/plaza';
import { YourGroups } from './Groups';
import { useSpotlight } from './Spotlight';
import { markSeenNew, useIsNew } from '../lib/newDots';

const ago = (iso: string | null) => {
  if (!iso) return '';
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return h < 48 ? 'Yesterday' : `${Math.floor(h / 24)}d`;
};

/** Opens a chat room full screen. */
export function useOpenChat() {
  const { open, close } = useOverlay();
  const { rulesOk, acceptRules } = useChat();
  return (room: string, title: string, otherId?: string) => {
    const room$ = <ChatRoomScreen room={room} title={title} otherId={otherId} onClose={close} />;
    if (rulesOk) return open(room$);
    open(
      <ChatRules
        onAgree={async () => {
          await acceptRules();
          open(room$);
        }}
        onClose={close}
      />,
    );
  };
}

const RULES = [
  { t: 'Be kind', s: 'No bullying, mean names or hateful words.' },
  { t: 'Keep your info private', s: 'Don’t share your address, school, phone number or other apps.' },
  { t: 'Report anything that feels wrong', s: 'Press and hold a message to report or block. We review every report.' },
  { t: 'Breaking the rules', s: 'Can turn chat off for your account.' },
];

/** The chat rules: shown once before the first chat (with I agree), and from the account page to read again. */
export function ChatRules({ onAgree, onClose }: { onAgree?: () => void; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const pet = A.activePet(useGame().state);
  return (
    <View style={[styles.full, styles.rulesBack, { paddingBottom: insets.bottom + 14, paddingLeft: 14, paddingRight: 14 }]}>
      <FitSheet onClose={onClose}>
      <View style={styles.rulesCard}>
        {pet && SPECIES_BY_ID[pet.speciesId] ? <View style={{ alignSelf: 'center' }}><PetSprite species={SPECIES_BY_ID[pet.speciesId]} stage={stageFor(pet.xp)} size={84} shiny={pet.shiny} skin={pet.skin} /></View> : null}
        <Text style={styles.rulesTitle}>{onAgree ? 'Before you chat' : 'Community rules'}</Text>
        <Text style={styles.rulesSub}>Chat is for friends and your guild. Keep it kind and safe.</Text>
        {RULES.map((r, i) => (
          <View key={r.t} style={styles.ruleRow}>
            <View style={styles.ruleNum}><Text style={styles.ruleNumText}>{i + 1}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.ruleT}>{r.t}</Text>
              <Text style={styles.ruleS}>{r.s}</Text>
            </View>
          </View>
        ))}
        {onAgree ? (
          <>
            <Text style={styles.rulesFine}>
              By chatting you agree to follow these rules and our{' '}
              <Text style={{ color: '#1E8A68', textDecorationLine: 'underline' }} onPress={() => Linking.openURL('https://sproutling.vercel.app/terms')}>Terms</Text>.
            </Text>
            <Button primary label="I agree, start chatting" onPress={onAgree} />
            <Pressable onPress={onClose} style={{ paddingVertical: 10 }} accessibilityRole="button">
              <Text style={styles.notNow}>Not now</Text>
            </Pressable>
          </>
        ) : (
          <View style={{ marginTop: 10 }}><Button label="Close" onPress={onClose} /></View>
        )}
      </View>
      </FitSheet>
    </View>
  );
}

/** Social › Chat: your guild chat and friend chats, newest first. */
type ChatTab = 'chats' | 'groups' | 'plaza';

export function ChatList() {
  const { rooms, mode, refresh, rulesOk, acceptRules } = useChat();
  const [tab, setTab] = useState<ChatTab>('chats');
  const spot = useSpotlight();
  useEffect(() => {
    if (spot?.id === 'groups' || spot?.id === 'plaza') {
      setTab(spot.id);
      markSeenNew(spot.id);
    }
  }, [spot?.id]);
  const overlay = useOverlay();
  const { friends } = useFriends();
  const { team } = useTeam();
  const { user } = useAuth();
  const openChat = useOpenChat();
  useEffect(() => {
    refresh();
  }, []);
  const me = user?.id ?? '';
  const otherOf = (room: string) => room.split(':').slice(1).find((x) => x !== me) ?? '';
  const shown = rooms.filter((r) => r.room.startsWith('team:') || friends.some((f) => f.id === otherOf(r.room)));

  if (mode !== 'off' && !rulesOk) {
    return (
      <View style={[styles.card, { gap: 10 }]}>
        <Text style={font.h2}>Chat with friends and your guild</Text>
        <Text style={font.small}>Send messages, pet stickers and quick phrases. First, a few quick rules.</Text>
        <Button primary label="See the chat rules" onPress={() => overlay.open(<ChatRules onAgree={async () => { await acceptRules(); overlay.close(); }} onClose={overlay.close} />)} />
      </View>
    );
  }
  if (mode === 'off') {
    return (
      <View style={styles.card}>
        <Text style={font.h2}>Chat is off</Text>
        <Text style={font.small}>Turn it on in your account settings (tap your picture at the top).</Text>
      </View>
    );
  }
  const groupRooms = rooms.filter((r) => r.room.startsWith('group:'));
  const groupUnread = groupRooms.reduce((n, r) => n + (r.unread || 0), 0);
  const chatUnread = shown.reduce((n, r) => n + (r.unread || 0), 0);
  return (
    <View style={{ gap: space.md }}>
      <ChatSegs tab={tab} onTab={(t) => { setTab(t); markSeenNew(t); }} counts={{ chats: chatUnread, groups: groupUnread, plaza: 0 }} />
      {tab === 'groups' ? <YourGroups unread={Object.fromEntries(groupRooms.map((r) => [r.room.slice(6), r.unread || 0]))} /> : null}
      {tab === 'plaza' ? <PlazaRows /> : null}
      {tab === 'chats' ? (
      <View style={styles.card}>
        {shown.length === 0 ? <Text style={font.small}>No chats yet. Open a friend and tap Chat, or join a guild to chat with your guild.</Text> : null}
        {shown.map((r, i) => {
          const isTeam = r.room.startsWith('team:');
          const f = isTeam ? undefined : friends.find((x) => x.id === otherOf(r.room));
          const sp = f?.card?.active ? SPECIES_BY_ID[f.card.active.speciesId] : undefined;
          const title = isTeam ? team?.name ?? 'Guild chat' : f?.username ?? 'Friend';
          return (
            <Pressable key={r.room} onPress={() => openChat(r.room, title, f?.id)} style={[styles.row, i === 0 && { borderTopWidth: 0 }]} accessibilityRole="button" accessibilityLabel={`${title}${r.unread ? `, ${r.unread} unread` : ''}`}>
              <View style={[styles.av, { backgroundColor: isTeam ? '#2A3366' : '#E3F1FF' }]}>
                {isTeam ? <Text style={styles.avText}>GUILD</Text> : sp ? <PetSprite species={sp} stage="adult" size={44} skin={f?.card?.active?.skin} /> : null}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.name} numberOfLines={1}>{title}</Text>
                <Text style={[styles.preview, r.unread ? { color: colors.ink, fontWeight: '900' } : null]} numberOfLines={1}>
                  {r.last ? `${r.lastFrom === 'me' ? 'You: ' : isTeam && r.lastFrom ? `${r.lastFrom}: ` : ''}${previewText(r.last)}` : isTeam ? 'Say hi to your guild!' : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={styles.time}>{ago(r.at)}</Text>
                {r.unread ? <View style={styles.dot}><Text style={styles.dotText}>{r.unread}</Text></View> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
      ) : null}
    </View>
  );
}

/** Chats · Groups · Plaza, with unread counts and a dot on the ones you haven't opened yet. */
function ChatSegs({ tab, onTab, counts }: { tab: ChatTab; onTab: (t: ChatTab) => void; counts: Record<ChatTab, number> }) {
  const newGroups = useIsNew('groups');
  const newPlaza = useIsNew('plaza');
  const items: { id: ChatTab; label: string; dot: boolean }[] = [
    { id: 'chats', label: 'Chats', dot: false },
    { id: 'groups', label: 'Groups', dot: newGroups },
    { id: 'plaza', label: 'Plaza', dot: newPlaza },
  ];
  return (
    <View style={styles.csegs} accessibilityRole="tablist">
      {items.map((it) => (
        <Pressable key={it.id} onPress={() => onTab(it.id)} style={[styles.cseg, tab === it.id && styles.csegOn]} accessibilityRole="tab" accessibilityState={{ selected: tab === it.id }} accessibilityLabel={`${it.label}${counts[it.id] ? `, ${counts[it.id]} unread` : ''}`}>
          <Text style={[styles.csegText, tab === it.id && styles.csegTextOn]}>{it.label}</Text>
          {counts[it.id] ? (
            <View style={styles.segCount}><Text style={styles.segCountText}>{counts[it.id] > 99 ? '99+' : counts[it.id]}</Text></View>
          ) : it.dot ? (
            <View style={styles.newDot} />
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

function ChatRoomScreen({ room, title, otherId, onClose }: { room: string; title: string; otherId?: string; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const chat = useChat();
  const { state } = useGame();
  const { user } = useAuth();
  const me = user?.id ?? '';
  const isTeam = room.startsWith('team:');
  const isPlaza = room.startsWith('plaza:');
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [menu, setMenu] = useState<ChatMessage | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [stickers, setStickers] = useState(false);
  const scroll = useRef<any>(null);
  const msgs = chat.messages(room);
  const { byMsg, toggle } = useRoomReactions(room, msgs.length);

  useEffect(() => {
    chat.open(room);
    return () => chat.close();
  }, [room]);
  useEffect(() => {
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
  }, [msgs.length]);

  const send = async (kind: 'text' | 'phrase' | 'sticker', body: string, sticker?: ChatMessage['sticker']) => {
    if (!body.trim()) return;
    setErr(null);
    buzz('light', 'pop');
    const e = await chat.send(room, kind, body.trim(), sticker);
    if (e) setErr(e);
    else if (kind === 'text') setText('');
    if (kind !== 'sticker') setStickers(false);
  };
  const pet = A.activePet(state);
  // Stickers: every pet you've collected, in every skin you've collected it in.
  const collected = useMemo(() => {
    const out: { speciesId: string; skin?: Skin; key: string }[] = [];
    const seen = new Set<string>();
    const add = (speciesId: string, skin?: Skin) => {
      const key = `${speciesId}:${skin ?? ''}`;
      if (seen.has(key) || !SPECIES_BY_ID[speciesId]) return;
      seen.add(key);
      out.push({ speciesId, skin, key });
    };
    if (pet) add(pet.speciesId, pet.skin);
    Object.keys(state.skinDex ?? {}).forEach((k) => { const [sp, sk] = k.split(':'); add(sp, sk as Skin); });
    Object.keys(state.dex ?? {}).forEach((sp) => add(sp));
    return out;
  }, [state.dex, state.skinDex, pet?.id]);
  const [pick, setPick] = useState<string | null>(null);
  const chosen = collected.find((c) => c.key === pick) ?? collected[0];
  const stickerName = (c: { speciesId: string; skin?: Skin }) => `${c.skin ? SKIN_INFO[c.skin].label + ' ' : ''}${SPECIES_BY_ID[c.speciesId].name}`;
  const sendSticker = (line?: string, c = chosen) => c && send('sticker', line ?? stickerName(c), { speciesId: c.speciesId, skin: c.skin, name: stickerName(c) });
  // Wide screens: keep the chat to a readable column.
  const side = useSidePad(680, 0);
  /** With the sticker tray open, typed text goes out as the sticker's caption. */
  const submit = () => {
    if (stickers && chosen) {
      const caption = text.trim();
      sendSticker(caption || undefined);
      setText('');
      return;
    }
    send('text', text);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.full, { backgroundColor: isTeam ? '#E9EEFA' : '#EAF6F0', paddingHorizontal: side }]}>
      <View style={[styles.head, { paddingTop: insets.top + 8, paddingLeft: 14, paddingRight: 14, backgroundColor: isTeam ? '#2A3366' : '#FFFBF2' }]}>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Back" style={{ paddingVertical: 6, paddingRight: 8 }}>
          <Text style={[styles.back, isTeam && { color: '#BFD0FF' }]}>‹ Back</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headTitle, isTeam && { color: '#fff' }]} numberOfLines={1}>{title}</Text>
          <Text style={[font.tiny, isTeam && { color: '#C9D3FF' }]}>{isTeam ? 'Guild chat' : isPlaza ? 'Be kind · hold a message to report' : 'Friend chat'}</Text>
        </View>
      </View>

      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ padding: space.md, paddingLeft: space.md, paddingRight: space.md, gap: 8 }}>
        {msgs.length === 0 ? <Text style={[font.small, { textAlign: 'center', marginTop: 20 }]}>No messages yet. Say hi!</Text> : null}
        {msgs.map((m) => {
          if (m.kind === 'moment' && m.sticker) {
            const sp = SPECIES_BY_ID[m.sticker.speciesId];
            const rare = ['rare', 'epic', 'legendary'].includes(m.sticker.rarity ?? '') || !!m.sticker.skin || !!m.sticker.shiny;
            const who = m.sender === me ? 'You' : chat.nameOf(m.sender);
            return (
              <Pressable key={m.id} onLongPress={() => setMenu(m)} delayLongPress={350} style={[styles.moment, rare && styles.momentRare]} accessibilityLabel={`${who} ${momentText(m.sticker.type, m.sticker.speciesId, m.sticker.skin, m.sticker.shiny)}`}>
                {sp ? <View style={styles.momentArt}><PetSprite species={sp} stage="baby" size={84} skin={m.sticker.skin as any} shiny={m.sticker.shiny} mood="joy" /></View> : null}
                <View style={{ flex: 1, gap: 5 }}>
                  <Text style={styles.momentText}>
                    <Text style={{ fontWeight: '900' }}>{who}</Text> {momentText(m.sticker.type, m.sticker.speciesId, m.sticker.skin, m.sticker.shiny)}
                    {rare ? <Text style={{ color: '#C77D00' }}> ✦</Text> : null}
                  </Text>
                  <Pills list={byMsg[m.id]} onToggle={(e) => toggle(m.id, e)} quick={m.sticker.type === 'catch' ? ['🎉', '👏'] : ['🎉', '❤️']} />
                </View>
              </Pressable>
            );
          }
          if (m.kind === 'system') {
            return (
              <View key={m.id} style={styles.sys}>
                <Text style={styles.sysText}>{m.body}</Text>
              </View>
            );
          }
          const mine = m.sender === me;
          const sp = m.sticker ? SPECIES_BY_ID[m.sticker.speciesId] : undefined;
          return (
            <Pressable key={m.id} onLongPress={() => setMenu(m)} delayLongPress={350} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '80%' }} accessibilityHint={mine ? 'Press and hold to react' : 'Press and hold to react, report or block'}>
              {(isTeam || isPlaza || room.startsWith('group:')) && !mine ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Text style={styles.who}>{chat.nameOf(m.sender)}</Text>
                  {!isTeam ? <GuildTag userId={m.sender} small /> : null}
                  <RankTag userId={m.sender} small />
                </View>
              ) : null}
              {m.kind === 'sticker' && sp ? (
                <View style={{ alignItems: 'center' }}>
                  <PetSprite species={sp} stage="adult" size={90} skin={m.sticker?.skin as any} mood="joy" />
                  <Text style={styles.stickerLine}>{m.sticker?.name && m.sticker.name !== m.body ? `${m.sticker.name}: ${m.body}` : m.body}</Text>
                </View>
              ) : (
                <View style={[styles.bubble, mine ? [styles.mine, isTeam && { backgroundColor: '#4A8FE0' }] : styles.theirs]}>
                  <Text style={[styles.bubbleText, mine && { color: '#fff' }]}>{m.body}</Text>
                </View>
              )}
              {byMsg[m.id]?.length ? (
                <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', marginTop: 3 }}>
                  <Pills list={byMsg[m.id]} onToggle={(e) => toggle(m.id, e)} />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>

      {err ? <Text style={styles.err}>{err}</Text> : null}
      {note ? <Text style={[styles.err, { color: colors.mintDark }]}>{note}</Text> : null}

      {chat.mode === 'off' ? (
        <Text style={[styles.err, { paddingBottom: insets.bottom + 12 }]}>Your chat is off. Turn it on in your account settings.</Text>
      ) : (
        <>
          {stickers ? (
            <View style={styles.tray}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 }}>
                <Text style={styles.trayTitle}>Your stickers · {collected.length}</Text>
                <Text style={styles.trayHint}>Pick one, type a message, and send</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 12, paddingVertical: 6 }}>
                {collected.map((c) => {
                  const on = chosen?.key === c.key;
                  return (
                    <Pressable
                      key={c.key}
                      onPress={() => (on ? sendSticker() : setPick(c.key))}
                      onLongPress={() => { setPick(c.key); sendSticker(undefined, c); }}
                      style={[styles.sticker, on && styles.stickerOn]}
                      accessibilityRole="button"
                      accessibilityLabel={on ? `Send the ${stickerName(c)} sticker` : `Choose the ${stickerName(c)} sticker`}
                    >
                      <PetSprite species={SPECIES_BY_ID[c.speciesId]} stage="adult" size={54} skin={c.skin} />
                      {on ? <Text style={styles.stickerSend}>Send</Text> : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={[styles.phrases, { paddingLeft: 12, paddingRight: 12 }]}>
            {QUICK_PHRASES.map((p) => (
              <Pressable key={p} onPress={() => (stickers ? sendSticker(p) : send('phrase', p))} style={[styles.chip, stickers && { borderColor: '#B497EA' }]} accessibilityRole="button" accessibilityLabel={stickers ? `Send a sticker: ${p}` : `Send: ${p}`}>
                <Text style={styles.chipText}>{p}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={[styles.inputRow, { paddingBottom: insets.bottom + 10, paddingLeft: 12, paddingRight: 12 }]}>
            <Pressable onPress={() => setStickers((v) => !v)} disabled={!collected.length} style={[styles.petBtn, stickers && { backgroundColor: '#B497EA' }]} accessibilityRole="button" accessibilityLabel={stickers ? 'Back to phrases' : 'Send a pet sticker'}>
              {chosen ? <PetSprite species={SPECIES_BY_ID[chosen.speciesId]} stage="adult" size={30} skin={chosen.skin} /> : <Text style={styles.petBtnText}>PET</Text>}
            </Pressable>
            {chat.mode === 'phrases' ? (
              <Text style={[font.small, { flex: 1 }]}>{stickers ? 'Tap a phrase to send it as a pet sticker.' : 'Quick phrases and stickers only (Account › Chat).'}</Text>
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  value={text}
                  onChangeText={setText}
                  placeholder={stickers ? 'Add a message to your sticker (optional)' : isTeam ? 'Message your guild' : `Message ${title}`}
                  maxLength={300}
                  returnKeyType="send"
                  onSubmitEditing={submit}
                  accessibilityLabel="Message"
                />
                <Pressable onPress={submit} style={[styles.sendBtn, isTeam && { backgroundColor: '#4A8FE0' }]} accessibilityRole="button" accessibilityLabel="Send">
                  <Text style={styles.sendText}>›</Text>
                </Pressable>
              </>
            )}
          </View>
        </>
      )}

      {menu ? (
        <View style={styles.menuBack}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenu(null)} accessibilityLabel="Close" />
          <View style={[styles.menu, { paddingBottom: insets.bottom + 16, paddingLeft: 16, paddingRight: 16 }]}>
            <View style={styles.reactRow}>
              {REACTIONS.map((e) => (
                <Pressable
                  key={e}
                  onPress={() => {
                    toggle(menu.id, e);
                    buzz('light');
                    setMenu(null);
                  }}
                  style={styles.reactBtn}
                  accessibilityRole="button"
                  accessibilityLabel={`React with ${e}`}
                >
                  <Text style={{ fontSize: 24 }} maxFontSizeMultiplier={1.1}>{e}</Text>
                </Pressable>
              ))}
            </View>
            {menu.kind !== 'moment' ? <Text style={styles.menuQuote} numberOfLines={3}>“{menu.body}”</Text> : null}
            {menu.sender !== me ? (
            <>
            <Button
              label="Report message"
              onPress={async () => {
                const ok = await chat.report(menu.id, 'reported from chat');
                setMenu(null);
                setNote(ok ? 'Thanks. We’ll take a look.' : 'Couldn’t send the report. Try again.');
              }}
            />
            {menu.sender ? (
              <Button
                label={`Block ${chat.nameOf(menu.sender)}`}
                onPress={async () => {
                  const ok = await chat.block(menu.sender!);
                  setMenu(null);
                  if (ok && !isTeam && menu.sender === otherId) onClose();
                  else setNote(ok ? 'Blocked. You won’t see their messages.' : 'Couldn’t block. Try again.');
                }}
              />
            ) : null}
            <Text style={font.tiny}>Blocking removes them as a friend and hides you from each other in chat.</Text>
            </>
            ) : null}
            <Button primary label="Cancel" onPress={() => setMenu(null)} />
          </View>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

/** A slim row on the Guild tab: the latest guild message and unread count. Tap to open guild chat. */
export function GuildChatRow() {
  const { rooms, mode } = useChat();
  const { team } = useTeam();
  const openChat = useOpenChat();
  if (!team || mode === 'off') return null;
  const r = rooms.find((x) => x.room === `team:${team.id}`);
  return (
    <Pressable onPress={() => openChat(`team:${team.id}`, team.name)} style={styles.guildRow} accessibilityRole="button" accessibilityLabel={`Guild chat${r?.unread ? `, ${r.unread} unread` : ''}`}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.guildRowTitle}>Guild chat</Text>
        <Text style={styles.guildRowPrev} numberOfLines={1}>
          {r?.last ? `${r.lastFrom === 'me' ? 'You' : r.lastFrom || 'Guild'}: ${previewText(r.last)}` : 'Say hi to your guild!'}
        </Text>
      </View>
      {r?.unread ? <View style={styles.dot}><Text style={styles.dotText}>{r.unread}</Text></View> : null}
      <Text style={styles.guildRowGo}>›</Text>
    </Pressable>
  );
}

/** Unread messages from one friend (for the dot on the friends list). */
export function useFriendUnread() {
  const { rooms, dmRoom } = useChat();
  return (friendId: string) => rooms.find((r) => r.room === dmRoom(friendId))?.unread ?? 0;
}

/** Help and support: a short message to Tom (no email address needed on either side). */
export function SupportSheet({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | string>('idle');
  const send = async () => {
    setState('sending');
    const { data, error } = await supabase.rpc('support_send', { p_body: text, p_build: String(appBuild() ?? Platform.OS) });
    if (error) return setState('Couldn’t send. Check your connection and try again.');
    if (data === 'slow_down') return setState('You’ve sent a few already. Please wait a bit and try again.');
    if (data !== 'ok') return setState('Couldn’t send that. Try a shorter message.');
    setState('sent');
  };
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.full, styles.rulesBack, { paddingBottom: insets.bottom + 14, paddingLeft: 14, paddingRight: 14 }]}>
      <FitSheet onClose={onClose}>
      <View style={[styles.rulesCard, { gap: 10 }]}>
        <Text style={styles.rulesTitle}>Help and support</Text>
        {state === 'sent' ? (
          <>
            <Text style={styles.rulesSub}>Thanks! Your message was sent. We read every one and will reply as soon as we can.</Text>
            <Button primary label="Done" onPress={onClose} />
          </>
        ) : (
          <>
            <Text style={styles.rulesSub}>Found a bug, stuck on something, or need to report a player? Tell us here.</Text>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="What's going on?"
              multiline
              maxLength={2000}
              style={styles.supportInput}
              accessibilityLabel="Your message"
            />
            {state !== 'idle' && state !== 'sending' ? <Text style={styles.err}>{state}</Text> : null}
            <Button primary label={state === 'sending' ? 'Sending…' : 'Send'} disabled={state === 'sending' || !text.trim()} onPress={send} />
            <Pressable onPress={onClose} style={{ paddingVertical: 6 }} accessibilityRole="button"><Text style={styles.notNow}>Cancel</Text></Pressable>
          </>
        )}
      </View>
      </FitSheet>
    </KeyboardAvoidingView>
  );
}

/** Help and support + Community rules, for the account page. */
export function HelpRows() {
  const overlay = useOverlay();
  return (
    <View style={{ gap: 2 }}>
      <Pressable onPress={() => overlay.open(<SupportSheet onClose={overlay.close} />)} style={styles.toggleRow} accessibilityRole="button">
        <Text style={font.body}>Help and support</Text>
        <Text style={font.small}>›</Text>
      </Pressable>
      <Pressable onPress={() => overlay.open(<ChatRules onClose={overlay.close} />)} style={styles.toggleRow} accessibilityRole="button">
        <Text style={font.body}>Community rules</Text>
        <Text style={font.small}>›</Text>
      </Pressable>
    </View>
  );
}

/** Chat settings for the account page. */
export function ChatSettings() {
  const chat = useChat();
  const [list, setList] = useState<{ id: string; name: string }[] | null>(null);
  const modes: { id: 'on' | 'phrases' | 'off'; label: string }[] = [
    { id: 'on', label: 'On' },
    { id: 'phrases', label: 'Phrases & stickers' },
    { id: 'off', label: 'Off' },
  ];
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.setHead}>Chat</Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {modes.map((m) => (
          <Pressable key={m.id} onPress={() => chat.setSettings({ mode: m.id })} style={[styles.seg, chat.mode === m.id && styles.segOn]} accessibilityRole="radio" accessibilityState={{ checked: chat.mode === m.id }}>
            <Text style={[styles.segText, chat.mode === m.id && { color: '#fff' }]}>{m.label}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable onPress={() => chat.setSettings({ push: !chat.push })} style={styles.toggleRow} accessibilityRole="switch" accessibilityState={{ checked: chat.push }}>
        <Text style={font.body}>Message notifications</Text>
        <View style={[styles.tog, !chat.push && styles.togOff]}><View style={[styles.knob, !chat.push && { left: 3, right: undefined }]} /></View>
      </Pressable>
      <Pressable onPress={async () => setList(await chat.blocked())} style={styles.toggleRow} accessibilityRole="button">
        <Text style={font.body}>Blocked trainers</Text>
        <Text style={font.small}>{list ? `${list.length}` : 'Show ›'}</Text>
      </Pressable>
      {list?.map((b) => (
        <View key={b.id} style={styles.toggleRow}>
          <Text style={font.small}>{b.name}</Text>
          <Button small label="Unblock" onPress={async () => { await chat.unblock(b.id); setList(await chat.blocked()); }} />
        </View>
      ))}
    </View>
  );
}

/** The Plaza: city and Everywhere rooms, 18+ or Teen. */
function PlazaRows() {
  const { rooms } = usePlaza();
  const openChat = useOpenChat();
  if (!rooms.length) return null;
  return (
    <View style={[styles.card, { gap: 6 }]}>
      <Text style={font.h2}>Plaza</Text>
      <Text style={font.tiny}>Open chat with every player in your city, or everyone in Global Chat. Like a town square. Be kind: messages are checked and you can report anyone.</Text>
      {rooms.map((r) => (
        <Pressable key={r.room} onPress={() => openChat(r.room, r.title)} style={styles.row} accessibilityRole="button" accessibilityLabel={`Open ${r.title}`}>
          <View style={[styles.av, { backgroundColor: '#2FB58A' }]}>
            <Text style={styles.avText}>{r.room.endsWith(':everywhere') ? 'ALL' : 'CITY'}</Text>
          </View>
          <Text style={[styles.name, { flex: 1 }]} numberOfLines={1}>{r.title}</Text>
          <Text style={{ fontSize: 22, color: '#9AA7A2' }}>›</Text>
        </Pressable>
      ))}
    </View>
  );
}

const previewText = (t: string) => (t === 'hatch' ? 'hatched a new sprite!' : t === 'catch' ? 'caught a wild sprite!' : t);

/** Emoji reaction pills. Tap one to add or take back your reaction. */
function Pills({ list, onToggle, quick }: { list?: Reaction[]; onToggle: (emoji: string) => void; quick?: string[] }) {
  const shown = [...(list ?? [])];
  (quick ?? []).forEach((e) => {
    if (!shown.some((x) => x.emoji === e)) shown.push({ emoji: e, n: 0, mine: false });
  });
  if (!shown.length) return null;
  return (
    <View style={styles.pills}>
      {shown.map((r) => (
        <Pressable key={r.emoji} onPress={() => { buzz('light'); onToggle(r.emoji); }} style={[styles.pill, r.mine && styles.pillMine]} accessibilityRole="button" accessibilityLabel={`${r.emoji} ${r.n}${r.mine ? ', you reacted' : ''}`}>
          <Text style={styles.pillText}>{r.emoji}{r.n ? ` ${r.n}` : ''}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  csegs: { flexDirection: 'row', backgroundColor: '#E4EEEA', borderRadius: 14, padding: 3, gap: 3 },
  cseg: { flex: 1, minHeight: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  csegOn: { backgroundColor: '#FFFFFF' },
  csegText: { fontSize: 14, fontWeight: '900', color: '#6A7A75' },
  csegTextOn: { color: colors.ink },
  segCount: { backgroundColor: '#E0567A', borderRadius: 9, minWidth: 18, paddingHorizontal: 5, alignItems: 'center' },
  segCountText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  newDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF8A5C' },
  moment: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: '#FFF4E4', borderWidth: 2, borderColor: '#FFE0A8', borderRadius: 16, padding: 9, alignSelf: 'stretch' },
  momentArt: { width: 88, height: 88, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  momentRare: { backgroundColor: '#FFF0F6', borderColor: '#FFC9DF' },
  momentText: { fontSize: 14, fontWeight: '700', color: colors.ink },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  pill: { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#DDE6E2', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2, minHeight: 28, justifyContent: 'center' },
  pillMine: { backgroundColor: '#DDF4EA', borderColor: '#2FB58A' },
  pillText: { fontSize: 13, fontWeight: '900', color: colors.ink },
  reactRow: { flexDirection: 'row', justifyContent: 'space-between' },
  reactBtn: { width: 38, height: 44, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  tray: { backgroundColor: '#F3ECFF', borderTopWidth: 1, borderTopColor: '#E0D2FA', paddingTop: 8 },
  trayTitle: { fontSize: 13, fontWeight: '900', color: '#4E3A80' },
  trayHint: { fontSize: 12, fontWeight: '800', color: '#7A6AA0' },
  sticker: { width: 70, height: 74, borderRadius: 16, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  stickerOn: { borderColor: '#B497EA' },
  stickerSend: { position: 'absolute', bottom: -2, backgroundColor: '#8A6BD8', color: '#FFFFFF', fontSize: 12, fontWeight: '900', borderRadius: 8, paddingHorizontal: 6, overflow: 'hidden' },
  card: { backgroundColor: '#FFFBF2', borderRadius: 22, padding: space.md, gap: 4 },
  rulesBack: { backgroundColor: 'rgba(20,30,28,0.55)', paddingHorizontal: 14 },
  rulesCard: { backgroundColor: '#FFFBF2', borderRadius: 28, padding: 20, gap: 2 },
  rulesTitle: { fontSize: 24, fontWeight: '900', color: colors.ink, textAlign: 'center', marginTop: 4 },
  rulesSub: { fontSize: 14, fontWeight: '700', color: colors.muted, textAlign: 'center', marginBottom: 8 },
  ruleRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#E3ECE7' },
  ruleNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#DDF3EA', alignItems: 'center', justifyContent: 'center' },
  ruleNumText: { color: '#1E8A68', fontWeight: '900', fontSize: 14 },
  ruleT: { fontSize: 15, fontWeight: '900', color: colors.ink },
  ruleS: { fontSize: 13, fontWeight: '700', color: colors.muted, lineHeight: 18, marginTop: 2 },
  supportInput: { minHeight: 110, borderRadius: 16, borderWidth: 2, borderColor: '#DCE7E2', backgroundColor: '#fff', padding: 12, fontSize: 15, fontWeight: '700', color: colors.ink, textAlignVertical: 'top' },
  rulesFine: { fontSize: 12, fontWeight: '700', color: colors.muted, marginVertical: 10 },
  notNow: { textAlign: 'center', color: colors.muted, fontWeight: '800', fontSize: 14 },
  guildRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#2A3366', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  guildRowTitle: { color: '#fff', fontWeight: '900', fontSize: 15 },
  guildRowPrev: { color: '#C9D3FF', fontWeight: '700', fontSize: 13 },
  guildRowGo: { color: '#C9D3FF', fontWeight: '900', fontSize: 22 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.line },
  av: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  name: { fontWeight: '900', fontSize: 16, color: colors.ink },
  preview: { fontWeight: '700', fontSize: 13, color: colors.muted },
  time: { fontWeight: '800', fontSize: 12, color: colors.muted },
  dot: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#E0567A', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  dotText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  full: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 85 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' },
  back: { fontSize: 15, fontWeight: '900', color: colors.mintDark },
  headTitle: { fontSize: 17, fontWeight: '900', color: colors.ink },
  sys: { alignSelf: 'stretch', backgroundColor: '#2A3366', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  sysText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  who: { fontSize: 12, fontWeight: '900', color: '#4A8FE0', marginLeft: 6, marginBottom: 2 },
  bubble: { borderRadius: 18, paddingHorizontal: 13, paddingVertical: 9 },
  mine: { backgroundColor: '#2EB88A', borderBottomRightRadius: 4 },
  theirs: { backgroundColor: '#FFFFFF', borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, fontWeight: '700', color: colors.ink },
  stickerLine: { fontSize: 12, fontWeight: '900', color: colors.muted },
  err: { textAlign: 'center', color: '#C4562F', fontWeight: '800', fontSize: 13, paddingHorizontal: 16, paddingTop: 4 },
  phrases: { gap: 6, paddingHorizontal: 12, paddingVertical: 8 },
  chip: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#CFE6DA', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 },
  chipText: { fontWeight: '800', fontSize: 13, color: colors.ink },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 8, backgroundColor: '#FFFBF2' },
  petBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#F2E3FF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  petBtnText: { fontSize: 12, fontWeight: '900', color: '#6A3FB5' },
  input: { flex: 1, height: 42, borderRadius: 21, backgroundColor: '#fff', borderWidth: 2, borderColor: '#CFE6DA', paddingHorizontal: 14, fontSize: 15, fontWeight: '700', color: colors.ink },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#2EB88A', alignItems: 'center', justifyContent: 'center' },
  sendText: { color: '#fff', fontSize: 24, fontWeight: '900', marginTop: -2 },
  menuBack: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,30,28,0.5)', justifyContent: 'flex-end' },
  menu: { backgroundColor: '#FFFBF2', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: space.lg, gap: 10 },
  menuQuote: { fontSize: 15, fontWeight: '700', color: colors.muted },
  setHead: { fontSize: 16, fontWeight: '900', color: colors.ink },
  seg: { flex: 1, borderRadius: 12, paddingVertical: 8, alignItems: 'center', backgroundColor: '#EEF3F0' },
  segOn: { backgroundColor: colors.ink },
  segText: { fontWeight: '900', fontSize: 12, color: colors.ink },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  tog: { width: 46, height: 28, borderRadius: 14, backgroundColor: '#2EB88A' },
  togOff: { backgroundColor: '#C9D3CF' },
  knob: { position: 'absolute', right: 3, top: 3, width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },
});

export type { ChatRoom };
