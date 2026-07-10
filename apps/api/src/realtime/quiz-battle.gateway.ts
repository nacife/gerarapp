/**
 * Batalha de Quiz em tempo real (RF-06.4) — WebSocket Gateway.
 * Salas, matchmaking, perguntas sincronizadas, ranking ao vivo.
 */
import { Inject } from '@nestjs/common';
import {
  ConnectedSocket, MessageBody, SubscribeMessage,
  WebSocketGateway, WebSocketServer,
} from '@nestjs/websockets';
import type { Redis } from 'ioredis';
import { Server, Socket } from 'socket.io';
import { SHARED_REDIS } from '../common/redis.module';

interface Player { id: string; name: string; score: number; answers: number; socketId: string }
interface Room { code: string; players: Player[]; status: 'waiting' | 'playing' | 'finished'; currentQuestion: number; totalQuestions: number }

@WebSocketGateway({ namespace: 'battle', cors: { origin: '*' } })
export class QuizBattleGateway {
  @WebSocketServer() server!: Server;
  private rooms = new Map<string, Room>();

  constructor(@Inject(SHARED_REDIS) private readonly redis: Redis) {}

  @SubscribeMessage('join')
  async handleJoin(@ConnectedSocket() client: Socket, @MessageBody() data: { code: string; playerName: string; playerId: string }) {
    const room = this.rooms.get(data.code) ?? { code: data.code, players: [], status: 'waiting', currentQuestion: 0, totalQuestions: 10 };
    if (room.players.find(p => p.id === data.playerId)) return { error: 'Já está na sala' };
    if (room.status !== 'waiting') return { error: 'Partida em andamento' };
    if (room.players.length >= 30) return { error: 'Sala cheia (máx. 30)' };

    room.players.push({ id: data.playerId, name: data.playerName, score: 0, answers: 0, socketId: client.id });
    this.rooms.set(data.code, room);
    await client.join(data.code);

    this.server.to(data.code).emit('players_update', { players: room.players.map(p => ({ name: p.name, score: p.score })) });
    return { joined: true, playerCount: room.players.length };
  }

  @SubscribeMessage('start')
  async handleStart(@ConnectedSocket() client: Socket, @MessageBody() data: { code: string; quizData: any[] }) {
    const room = this.rooms.get(data.code);
    if (!room) return { error: 'Sala não encontrada' };
    room.status = 'playing';
    room.currentQuestion = 0;
    room.totalQuestions = data.quizData.length;
    await this.redis.set(`battle:${data.code}:quiz`, JSON.stringify(data.quizData), 'EX', 3600);
    this.server.to(data.code).emit('game_started', { totalQuestions: data.quizData.length });
    this.sendQuestion(data.code, 0);
    return { started: true };
  }

  private async sendQuestion(code: string, index: number) {
    const raw = await this.redis.get(`battle:${code}:quiz`);
    if (!raw) return;
    const quiz = JSON.parse(raw);
    const q = quiz[index];
    if (!q) return;
    this.server.to(code).emit('question', { index, total: quiz.length, question: q.question_md ?? q.question, options: q.options?.map((o: any) => o.text_md ?? o.label) ?? [], timeLimit: 15 });
    setTimeout(() => this.endQuestion(code, index), 15000);
  }

  private async endQuestion(code: string, index: number) {
    const room = this.rooms.get(code);
    if (!room) return;
    const raw = await this.redis.get(`battle:${code}:quiz`);
    if (!raw) return;
    const quiz = JSON.parse(raw);
    const correct = quiz[index]?.options?.findIndex((o: any) => o.correct) ?? 0;
    this.server.to(code).emit('question_result', { index, correctIndex: correct });
    room.currentQuestion = index + 1;
    if (room.currentQuestion >= room.totalQuestions) {
      room.status = 'finished';
      this.server.to(code).emit('game_over', { players: room.players.sort((a, b) => b.score - a.score) });
    } else {
      setTimeout(() => this.sendQuestion(code, room.currentQuestion), 3000);
    }
  }

  @SubscribeMessage('answer')
  handleAnswer(@ConnectedSocket() client: Socket, @MessageBody() data: { code: string; playerId: string; questionIndex: number; answerIndex: number }) {
    const room = this.rooms.get(data.code);
    if (!room || room.status !== 'playing') return;
    const player = room.players.find(p => p.id === data.playerId);
    if (!player) return;
    player.answers++;
    this.redis.get(`battle:${data.code}:quiz`).then(raw => {
      if (!raw) return;
      const quiz = JSON.parse(raw);
      const correct = quiz[data.questionIndex]?.options?.findIndex((o: any) => o.correct) ?? 0;
      if (data.answerIndex === correct) {
        const timeBonus = Math.max(0, 10 - Math.floor((Date.now() - (quiz[data.questionIndex]?._sentAt ?? Date.now())) / 1000));
        player.score += 100 + timeBonus * 10;
      }
      this.server.to(data.code).emit('players_update', { players: room.players.map(p => ({ name: p.name, score: p.score })) });
    });
  }

  @SubscribeMessage('leave')
  handleLeave(@ConnectedSocket() client: Socket, @MessageBody() data: { code: string; playerId: string }) {
    const room = this.rooms.get(data.code);
    if (!room) return;
    room.players = room.players.filter(p => p.id !== data.playerId);
    if (room.players.length === 0) this.rooms.delete(data.code);
    else this.server.to(data.code).emit('players_update', { players: room.players.map(p => ({ name: p.name, score: p.score })) });
    client.leave(data.code);
  }
}
