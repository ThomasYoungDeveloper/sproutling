import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../state/AuthContext';
import { Button } from '../components/ui';
import { PET_IMAGES } from '../components/petImages';
import { colors, space } from '../theme';

type Step = 'welcome' | 'signup' | 'signin' | 'check' | 'forgot' | 'resetSent' | 'newPassword';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NAME_RE = /^[A-Za-z0-9_]{3,20}$/;
const PARADE = ['p82', 'p15', 'p89', 'p24', 'p84'];

/* ---------- small building blocks ---------- */

function Bouncy({ id, delay, size }: { id: string; delay: number; size: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration: 420, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 420, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.delay(1400),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View style={{ transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -14] }) }] }}>
      <Image source={PET_IMAGES[id]} style={{ width: size, height: size }} resizeMode="contain" />
    </Animated.View>
  );
}

function Field({
  label, value, onChangeText, placeholder, help, error, ok, secure, keyboardType, autoComplete, onSubmitEditing, autoFocus, maxLength, inputRef, returnKeyType,
}: {
  label: string; value: string; onChangeText: (t: string) => void; placeholder?: string; help?: string; error?: string | null; ok?: string | null;
  secure?: boolean; keyboardType?: any; autoComplete?: any; onSubmitEditing?: () => void; autoFocus?: boolean; maxLength?: number; inputRef?: React.RefObject<any>; returnKeyType?: any;
}) {
  const [show, setShow] = useState(false);
  return (
    <View style={{ gap: 4 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrap, error ? styles.inputErr : ok ? styles.inputOk : null]}>
        <TextInput
          ref={inputRef as any}
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9AABAE"
          secureTextEntry={secure && !show}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType={keyboardType}
          autoComplete={autoComplete}
          onSubmitEditing={onSubmitEditing}
          autoFocus={autoFocus}
          maxLength={maxLength}
          returnKeyType={returnKeyType}
          accessibilityLabel={label}
        />
        {secure ? (
          <Pressable onPress={() => setShow(!show)} style={styles.eye} accessibilityRole="button" accessibilityLabel={show ? 'Hide password' : 'Show password'}>
            <Text style={styles.eyeText}>{show ? 'Hide' : 'Show'}</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.err}>{error}</Text> : ok ? <Text style={styles.ok}>{ok}</Text> : help ? <Text style={styles.help}>{help}</Text> : null}
    </View>
  );
}

function Check({ checked, onToggle, children }: { checked: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <Pressable onPress={onToggle} style={styles.checkRow} accessibilityRole="checkbox" accessibilityState={{ checked }}>
      <View style={[styles.box, checked && styles.boxOn]}>{checked ? <Text style={styles.tick}>✓</Text> : null}</View>
      <Text style={styles.checkText}>{children}</Text>
    </Pressable>
  );
}

function Link({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ alignSelf: 'center', padding: 8 }} accessibilityRole="button">
      <Text style={styles.link}>{label}</Text>
    </Pressable>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

/* ---------- the flow ---------- */

export default function AuthFlow() {
  const auth = useAuth();
  const [step, setStep] = useState<Step>(auth.recovering ? 'newPassword' : auth.lastEmail ? 'signin' : 'welcome');
  const [email, setEmail] = useState(auth.lastEmail);
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [nameState, setNameState] = useState<'idle' | 'checking' | 'free' | 'taken' | 'bad'>('idle');
  const [age, setAge] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const emailRef = useRef<any>(null);
  const passRef = useRef<any>(null);

  useEffect(() => {
    if (auth.recovering) setStep('newPassword');
  }, [auth.recovering]);
  useEffect(() => {
    if (!email && auth.lastEmail) setEmail(auth.lastEmail);
  }, [auth.lastEmail]);

  // Live trainer-name check.
  useEffect(() => {
    if (step !== 'signup') return;
    const n = name.trim();
    if (!n) return setNameState('idle');
    if (!NAME_RE.test(n)) return setNameState('bad');
    setNameState('checking');
    const t = setTimeout(async () => {
      const free = await auth.checkUsername(n);
      setNameState(free === null ? 'idle' : free ? 'free' : 'taken');
    }, 450);
    return () => clearTimeout(t);
  }, [name, step]);

  const go = (s: Step) => {
    setError(null);
    setNotice(null);
    setTouched(false);
    setStep(s);
  };

  const emailErr = touched && !EMAIL_RE.test(email.trim()) ? 'That doesn’t look like an email address.' : null;
  const passErr = touched && password.length < 6 ? 'At least 6 characters.' : null;

  const doSignUp = async () => {
    setTouched(true);
    if (!NAME_RE.test(name.trim()) || nameState === 'taken' || !EMAIL_RE.test(email.trim()) || password.length < 6 || !age) return;
    setBusy(true);
    setError(null);
    const r = await auth.signUp({ email, password, username: name });
    setBusy(false);
    if (r.error) return setError(r.error);
    if (r.needsConfirm) go('check');
  };
  const doSignIn = async () => {
    setTouched(true);
    if (!EMAIL_RE.test(email.trim()) || password.length < 6) return;
    setBusy(true);
    setError(null);
    const r = await auth.signIn(email, password);
    setBusy(false);
    if (r.error) setError(r.error);
  };


  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {step === 'welcome' && (
          <View style={styles.welcome}>
            <Text style={styles.brand}>Sprout<Text style={{ color: colors.mint }}>ling</Text></Text>
            <View style={styles.parade}>
              {PARADE.map((id, i) => (
                <Bouncy key={id} id={id} delay={i * 160} size={i === 1 ? 84 : 58} />
              ))}
            </View>
            <Text style={styles.tagline}>Hatch adorable pets by building healthy habits.</Text>
            <View style={styles.points}>
              <Text style={styles.point}>Walk to hatch eggs and collect 89 pets</Text>
              <Text style={styles.point}>Water, sleep and veggies help them grow</Text>
              <Text style={styles.point}>Earn chests just for staying active</Text>
            </View>
            <Button primary label="Get started — it’s free" onPress={() => go('signup')} style={styles.big} />
            <Link label="I already have an account" onPress={() => go('signin')} />
          </View>
        )}

        {step === 'signup' && (
          <Card>
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.sub}>Takes about 30 seconds. Then you’ll pick your first egg!</Text>
            <Field
              label="Trainer name"
              value={name}
              onChangeText={setName}
              placeholder="e.g. PixelTom"
              autoFocus
              maxLength={20}
              help="What friends will see. Letters, numbers and _ only."
              error={nameState === 'taken' ? 'That name is taken. Try adding a number.' : (nameState === 'bad' && (name.trim().length >= 3 || touched)) || (touched && !name.trim()) ? 'Pick a name: 3–20 letters, numbers or _.' : null}
              ok={nameState === 'free' ? 'Nice, that name is yours!' : nameState === 'checking' ? 'Checking…' : null}
              onSubmitEditing={() => emailRef.current?.focus()}
              returnKeyType="next"
            />
            <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoComplete="email" error={emailErr} inputRef={emailRef} onSubmitEditing={() => passRef.current?.focus()} returnKeyType="next" />
            <Field label="Password" value={password} onChangeText={setPassword} placeholder="At least 6 characters" secure autoComplete="new-password" error={passErr} inputRef={passRef} onSubmitEditing={doSignUp} returnKeyType="go" />
            <Check checked={age} onToggle={() => setAge(!age)}>I’m 13 or older</Check>
            {touched && !age ? <Text style={styles.err}>Sproutling is for players 13 and up.</Text> : null}
            {error ? <Text style={styles.errBox}>{error}</Text> : null}
            <Button primary label={busy ? 'Creating your account…' : 'Create my account'} disabled={busy} onPress={doSignUp} style={styles.big} />
            <Link label="Already have an account? Sign in" onPress={() => go('signin')} />
          </Card>
        )}

        {step === 'signin' && (
          <Card>
            <Text style={styles.title}>Welcome back!</Text>
            <Text style={styles.sub}>Your pets missed you.</Text>
            <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoComplete="email" error={emailErr} autoFocus={!email} onSubmitEditing={() => passRef.current?.focus()} returnKeyType="next" />
            <Field label="Password" value={password} onChangeText={setPassword} placeholder="Your password" secure autoComplete="current-password" error={passErr} inputRef={passRef} autoFocus={!!email} onSubmitEditing={doSignIn} returnKeyType="go" />
            {error ? <Text style={styles.errBox}>{error}</Text> : null}
            {error && /confirm your email/i.test(error) ? (
              <Button
                label="Resend confirmation email"
                onPress={async () => {
                  const r = await auth.resendConfirmation(email);
                  setError(null);
                  setNotice(r.error ?? 'Sent! Check your inbox (and spam folder).');
                }}
              />
            ) : null}
            {notice ? <Text style={styles.noticeBox}>{notice}</Text> : null}
            <Button primary label={busy ? 'Signing in…' : 'Sign in'} disabled={busy} onPress={doSignIn} style={styles.big} />
            <Link label="Forgot your password?" onPress={() => go('forgot')} />
            <Link label="New here? Create an account" onPress={() => go('signup')} />
          </Card>
        )}

        {step === 'check' && (
          <Card>
            <Text style={styles.emoji}>📬</Text>
            <Text style={[styles.title, { textAlign: 'center' }]}>Check your email</Text>
            <Text style={[styles.sub, { textAlign: 'center' }]}>
              We sent a confirmation link to{'\n'}
              <Text style={{ fontWeight: '900', color: colors.ink }}>{email.trim()}</Text>
            </Text>
            <Text style={[styles.sub, { textAlign: 'center' }]}>Tap the link and you’ll come right back here, signed in and ready to pick your egg.</Text>
            {notice ? <Text style={styles.noticeBox}>{notice}</Text> : null}
            <Button
              label="Resend the email"
              onPress={async () => {
                const r = await auth.resendConfirmation(email);
                setNotice(r.error ?? 'Sent again! It can take a minute. Check spam too.');
              }}
            />
            <Button primary label="I’ve confirmed — sign in" onPress={() => go('signin')} style={styles.big} />
            <Link label="Wrong email? Start over" onPress={() => go('signup')} />
          </Card>
        )}

        {step === 'forgot' && (
          <Card>
            <Text style={styles.title}>Reset your password</Text>
            <Text style={styles.sub}>Enter your email and we’ll send you a link to choose a new one.</Text>
            <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoComplete="email" error={emailErr} autoFocus />
            {error ? <Text style={styles.errBox}>{error}</Text> : null}
            <Button
              primary
              label={busy ? 'Sending…' : 'Send reset link'}
              disabled={busy || !EMAIL_RE.test(email.trim())}
              onPress={async () => {
                setBusy(true);
                const r = await auth.sendReset(email);
                setBusy(false);
                if (r.error) setError(r.error);
                else go('resetSent');
              }}
              style={styles.big}
            />
            <Link label="Back to sign in" onPress={() => go('signin')} />
          </Card>
        )}

        {step === 'resetSent' && (
          <Card>
            <Text style={styles.emoji}>🔑</Text>
            <Text style={[styles.title, { textAlign: 'center' }]}>Link sent!</Text>
            <Text style={[styles.sub, { textAlign: 'center' }]}>If {email.trim()} has an account, a reset link is on its way. Open it on this device to choose a new password.</Text>
            <Link label="Back to sign in" onPress={() => go('signin')} />
          </Card>
        )}

        {step === 'newPassword' && (
          <Card>
            <Text style={styles.title}>Choose a new password</Text>
            <Field label="New password" value={password} onChangeText={setPassword} placeholder="At least 6 characters" secure autoComplete="new-password" error={passErr} autoFocus />
            {error ? <Text style={styles.errBox}>{error}</Text> : null}
            <Button
              primary
              label={busy ? 'Saving…' : 'Save and continue'}
              disabled={busy || password.length < 6}
              onPress={async () => {
                setTouched(true);
                setBusy(true);
                const r = await auth.setNewPassword(password);
                setBusy(false);
                if (r.error) setError(r.error);
              }}
              style={styles.big}
            />
          </Card>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center', padding: space.lg, maxWidth: 460, width: '100%', alignSelf: 'center' },
  welcome: { alignItems: 'center', gap: space.md },
  brand: { fontSize: 40, fontWeight: '900', color: colors.ink },
  parade: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', flexWrap: 'nowrap', height: 120 },
  tagline: { fontSize: 20, fontWeight: '800', color: colors.ink, textAlign: 'center', maxWidth: 320 },
  points: { gap: 8, alignSelf: 'stretch', backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: colors.line, padding: space.md },
  point: { fontSize: 15, fontWeight: '700', color: colors.ink },
  big: { alignSelf: 'stretch', paddingVertical: 14 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 1, borderColor: colors.line, padding: space.lg, gap: space.md },
  title: { fontSize: 24, fontWeight: '900', color: colors.ink },
  sub: { fontSize: 15, color: colors.muted, fontWeight: '600' },
  label: { fontSize: 14, fontWeight: '800', color: colors.ink },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: colors.line, borderRadius: 14, backgroundColor: '#FAFCFB' },
  inputErr: { borderColor: '#E8735A' },
  inputOk: { borderColor: colors.mint },
  input: { flex: 1, paddingVertical: 12, paddingHorizontal: 14, fontSize: 16, color: colors.ink },
  eye: { paddingHorizontal: 14, paddingVertical: 10 },
  eyeText: { fontWeight: '800', color: colors.mintDark, fontSize: 13 },
  help: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  err: { fontSize: 12, color: '#C4562F', fontWeight: '700' },
  ok: { fontSize: 12, color: colors.mintDark, fontWeight: '700' },
  errBox: { fontSize: 14, color: '#A8452A', fontWeight: '700', backgroundColor: '#FFE7DD', borderRadius: 12, padding: 10 },
  noticeBox: { fontSize: 14, color: colors.mintDark, fontWeight: '700', backgroundColor: colors.mintSoft, borderRadius: 12, padding: 10 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: '#BFD3CB', alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.mint, borderColor: colors.mint },
  tick: { color: '#fff', fontWeight: '900' },
  checkText: { fontSize: 15, fontWeight: '700', color: colors.ink },
  link: { fontSize: 14, fontWeight: '800', color: colors.mintDark },
  emoji: { fontSize: 48, textAlign: 'center' },
});
