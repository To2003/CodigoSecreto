import type { RoomView } from '@clave/shared';
import { useEffect, useRef } from 'react';
import { t } from '../i18n/es-AR';
import { usePrefs } from '../store/prefs';
import { useRoom } from '../store/room';
import { useSocial } from '../store/social';
import { isMyTurn, soundsFor } from './cues';
import { audio } from './engine';

const BLINK_MS = 1000;

/** True when a chat log is visible: the desktop column, or the open sheet on a phone. */
function chatOnScreen(): boolean {
  if (document.hidden) return false;
  return [...document.querySelectorAll<HTMLElement>('[data-chat-log]')].some(
    (el) => el.offsetParent !== null,
  );
}

/**
 * Plays the sounds of each patch, runs the music for the screen, and nags when it's your turn
 * with the tab in the background: blinking title and a vibration on phones (SPEC §6.2–6.4).
 */
export function useSoundCues(view: RoomView) {
  const seq = useRoom((s) => s.seq);
  const events = useRoom((s) => s.lastEvents);
  const vibration = usePrefs((p) => p.vibration);
  const playedRef = useRef(-1);
  const myTurn = isMyTurn(view);

  // Sounds: once per patch.
  useEffect(() => {
    if (playedRef.current === seq) return;
    playedRef.current = seq;
    const sounds = soundsFor(events, view);
    for (const id of sounds) audio.play(id);
    if (sounds.includes('reveal_traitor')) audio.silenceMusic(3);
    if (sounds.includes('your_turn') && vibration && 'vibrate' in navigator) navigator.vibrate(200);
  }, [seq, events, view, vibration]);

  // Chat: a sound only when no chat is on screen (SPEC §6.2), and never for your own lines.
  const messages = useSocial((s) => s.messages);
  const heardRef = useRef(messages.at(-1)?.id ?? 0);
  useEffect(() => {
    const last = messages.at(-1);
    if (!last || last.id <= heardRef.current) return;
    heardRef.current = last.id;
    if (last.playerId !== view.youId && !chatOnScreen()) audio.play('chat');
  }, [messages, view.youId]);

  // Music: lobby loop or game loop; the tension layer when a team is about to win.
  const inGame = view.game !== null && view.game.phase.name !== 'over';
  const close = view.game
    ? Math.min(view.game.remaining.red, view.game.remaining.blue) <= 2
    : false;
  useEffect(() => {
    audio.setMusic(inGame ? 'game' : 'lobby');
    audio.setIntensity(inGame && close);
  }, [inGame, close]);
  useEffect(
    () => () => {
      audio.setMusic(null);
    },
    [],
  );

  // "Te toca" with the tab hidden: the title blinks until the tab comes back (SPEC §6.4).
  useEffect(() => {
    if (!myTurn) return;
    const original = document.title;
    let on = false;
    const timer = setInterval(() => {
      if (!document.hidden) {
        document.title = original;
        return;
      }
      on = !on;
      document.title = on ? t.prefs.yourTurnTitle : original;
    }, BLINK_MS);
    return () => {
      clearInterval(timer);
      document.title = original;
    };
  }, [myTurn]);
}
