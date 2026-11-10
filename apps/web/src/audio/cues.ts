import type { RoomEvent, RoomView } from '@clave/shared';
import type { SoundId } from './engine';

/**
 * Which sounds a patch should play for this viewer (SPEC §6.2). Pure, so it is unit-tested;
 * the hook in useSoundCues plays them.
 */
export function soundsFor(events: readonly RoomEvent[], view: RoomView): SoundId[] {
  const me = view.players.find((p) => p.id === view.youId);
  const sounds: SoundId[] = [];
  for (const e of events) {
    switch (e.type) {
      case 'PLAYER_JOINED':
        if (e.playerId !== view.youId) sounds.push('join');
        break;
      case 'CARD_POINTED':
        if (e.cardId !== null) sounds.push('point');
        break;
      case 'CARD_REVEALED':
        sounds.push('flip');
        if (e.cardType === 'traitor') sounds.push('reveal_traitor');
        else if (e.cardType === 'civilian') sounds.push('reveal_civil');
        else sounds.push(e.cardType === e.team ? 'reveal_own' : 'reveal_enemy');
        break;
      case 'CLUE_GIVEN':
        sounds.push('clue');
        if (me?.team === e.team && me.role === 'agent') sounds.push('your_turn');
        break;
      case 'TURN_CHANGED':
        sounds.push('turn_change');
        if (me?.team === e.team && me.role === 'spymaster') sounds.push('your_turn');
        break;
      case 'GAME_OVER':
        sounds.push(me?.team === 'spectator' || me?.team === e.winner ? 'win' : 'lose');
        break;
      default:
        break;
    }
  }
  return sounds;
}

/** It's this player's move: spymaster in their team's clue phase, or agent while guessing. */
export function isMyTurn(view: RoomView): boolean {
  const phase = view.game?.phase;
  const me = view.players.find((p) => p.id === view.youId);
  if (!phase || phase.name === 'over' || view.game?.paused || me?.team !== phase.team) return false;
  return phase.name === 'clue'
    ? me.role === 'spymaster'
    : phase.name === 'guess' && me.role === 'agent';
}
