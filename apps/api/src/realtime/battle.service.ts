import { Injectable } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';

export interface BattleEvent {
  type: 'join' | 'start' | 'score' | 'end';
  data: any;
}

@Injectable()
export class BattleService {
  private events = new Subject<{ enrollmentId: string; event: BattleEvent }>();
  private activeBattles = new Map<string, { players: any[]; state: 'waiting' | 'playing' }>();

  joinLobby(enrollmentId: string, player: { id: string; name: string }) {
    let battle = this.activeBattles.get(enrollmentId);
    if (!battle) {
      battle = { players: [], state: 'waiting' };
      this.activeBattles.set(enrollmentId, battle);
    }
    if (!battle.players.find((p) => p.id === player.id)) {
      battle.players.push({ ...player, score: 0 });
    }

    this.events.next({ enrollmentId, event: { type: 'join', data: { players: battle.players } } });

    // Auto-start if 2 players are present (for MVP/testing)
    if (battle.players.length >= 2 && battle.state === 'waiting') {
      battle.state = 'playing';
      setTimeout(() => {
        this.events.next({ enrollmentId, event: { type: 'start', data: {} } });
      }, 1000);
    }
  }

  submitScore(enrollmentId: string, playerId: string, scoreDelta: number) {
    const battle = this.activeBattles.get(enrollmentId);
    if (!battle) return;
    const p = battle.players.find((p) => p.id === playerId);
    if (p) {
      p.score += scoreDelta;
      this.events.next({
        enrollmentId,
        event: { type: 'score', data: { players: battle.players } },
      });
    }
  }

  stream(enrollmentId: string): Observable<{ data: BattleEvent }> {
    return this.events.asObservable().pipe(
      filter((e) => e.enrollmentId === enrollmentId),
      map((e) => ({ data: e.event })),
    );
  }
}
