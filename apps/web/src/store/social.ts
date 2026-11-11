import type { ChatMessage, EmoteEvent } from '@clave/shared';
import { create } from 'zustand';

/** An emote on screen; `key` tells two identical emotes apart. */
export interface FloatingEmote extends EmoteEvent {
  key: number;
}

interface SocialState {
  messages: ChatMessage[];
  emotes: FloatingEmote[];
  /** Cards highlighted from the clue history (SPEC §9). */
  highlight: string[];
  /** Likes received in the game that just ended, from likes:received (spec cuentas §5). */
  likesReceived: number;
}

export const useSocial = create<SocialState>()(() => ({
  messages: [],
  emotes: [],
  highlight: [],
  likesReceived: 0,
}));

/** Lines kept on the client, same as the server's history. */
const KEEP = 50;
/** How long an emote stays mounted: its animation's length (it rests invisible at the end). */
export const EMOTE_MS = 2_200;

let emoteKey = 0;

export const social = {
  reset() {
    useSocial.setState({ messages: [], emotes: [], highlight: [], likesReceived: 0 });
  },
  history(messages: ChatMessage[]) {
    useSocial.setState({ messages: messages.slice(-KEEP) });
  },
  message(message: ChatMessage) {
    useSocial.setState((s) => ({ messages: [...s.messages, message].slice(-KEEP) }));
  },
  emote(emote: EmoteEvent) {
    emoteKey += 1;
    const key = emoteKey;
    useSocial.setState((s) => ({ emotes: [...s.emotes, { ...emote, key }] }));
    setTimeout(() => {
      useSocial.setState((s) => ({ emotes: s.emotes.filter((e) => e.key !== key) }));
    }, EMOTE_MS);
  },
  /** Toggles the highlight of a clue's cards; the same clue again clears it. */
  toggleHighlight(cardIds: string[]) {
    useSocial.setState((s) => ({
      highlight: s.highlight.join() === cardIds.join() ? [] : cardIds,
    }));
  },
  likes(count: number) {
    useSocial.setState((s) => ({ likesReceived: Math.max(s.likesReceived, count) }));
  },
  clearLikes() {
    useSocial.setState({ likesReceived: 0 });
  },
  clearHighlight() {
    useSocial.setState({ highlight: [] });
  },
};
