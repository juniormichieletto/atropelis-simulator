import { joinRoom } from 'trystero';

export interface PlayerNetworkData {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  angle: number;
  speed: number;
  steerVisual: number;
  isBraking: boolean;
  score: number;
  timestamp: number;
}

export interface NpcNetworkData {
  id: number;
  type: 'PERSON' | 'BIKE' | 'CAR' | 'MOTORCYCLE';
  x: number;
  y: number;
  z: number;
  angle: number;
  speed: number;
  isHit: boolean;
  color: string;
}

export interface RoomPeerInfo {
  id: string;
  name: string;
  color: string;
  isHost: boolean;
  isReady: boolean;
}

export type MultiplayerEventCallback = {
  onPeersUpdated?: (peers: RoomPeerInfo[]) => void;
  onGameStarted?: () => void;
  onRemotePlayerUpdate?: (data: PlayerNetworkData) => void;
  onNpcUpdate?: (npcs: NpcNetworkData[]) => void;
  onPlayerHit?: (hitterId: string, targetId: string) => void;
};

// Available car palettes for multiplayer
export const MULTIPLAYER_CAR_COLORS = [
  { name: 'Red Fury', main: '#e74c3c', dark: '#962d22', accent: '#f39c12' },
  { name: 'Cyan Ghost', main: '#00e5ff', dark: '#00838f', accent: '#e0f7fa' },
  { name: 'Golden Sun', main: '#ffbe0b', dark: '#b78103', accent: '#fff3b0' },
  { name: 'Neon Violet', main: '#9b5de5', dark: '#5a189a', accent: '#f15bb5' },
  { name: 'Emerald Dart', main: '#00f5d4', dark: '#007f5f', accent: '#70e000' },
  { name: 'Cobalt Beast', main: '#3a86ff', dark: '#023e8a', accent: '#00b4d8' },
];

export class MultiplayerService {
  public roomId: string = '';
  public myId: string = '';
  public myName: string = '';
  public myColor: string = MULTIPLAYER_CAR_COLORS[0].main;
  public isHost: boolean = false;
  public isConnected: boolean = false;
  public spawnSeed: number = 0;
  public peerOrder: string[] = [];

  private room: ReturnType<typeof joinRoom> | null = null;
  private peers: Map<string, RoomPeerInfo> = new Map();
  private callbacks: MultiplayerEventCallback = {};

  // Action senders
  private sendPeerInfoAction: ((data: RoomPeerInfo, recipientPeerId?: string) => void) | null = null;
  private sendPlayerStateAction: ((data: PlayerNetworkData) => void) | null = null;
  private sendNpcStateAction: ((data: NpcNetworkData[]) => void) | null = null;
  private sendStartGameAction: ((data: { timestamp: number; spawnSeed?: number; peerOrder?: string[] }) => void) | null = null;
  private sendHitAction: ((data: { hitterId: string; targetId: string }) => void) | null = null;

  constructor(name: string) {
    this.myName = name || 'Racer';
    this.myId = 'p_' + Math.random().toString(36).substring(2, 9);
  }

  setCallbacks(callbacks: MultiplayerEventCallback) {
    this.callbacks = callbacks;
  }

  join(roomId: string, isHost: boolean = false): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        this.leave();
        this.roomId = roomId.toUpperCase().trim();
        this.isHost = isHost;

        const config = { appId: 'atropelis-simulator-p2p' };
        this.room = joinRoom(config, this.roomId);
        this.isConnected = true;

        // Register action transmitters & receivers
        const peerInfoAction = this.room.makeAction<RoomPeerInfo>('peer_info');
        const playerStateAction = this.room.makeAction<PlayerNetworkData>('player_state');
        const npcStateAction = this.room.makeAction<NpcNetworkData[]>('npc_state');
        const startGameAction = this.room.makeAction<{ timestamp: number; spawnSeed?: number; peerOrder?: string[] }>('start_game');
        const hitAction = this.room.makeAction<{ hitterId: string; targetId: string }>('hit_event');

        this.sendPeerInfoAction = (data, recipientPeerId) => {
          if (recipientPeerId) {
            void peerInfoAction.send(data, { target: recipientPeerId });
          } else {
            void peerInfoAction.send(data);
          }
        };
        this.sendPlayerStateAction = (data) => {
          void playerStateAction.send(data);
        };
        this.sendNpcStateAction = (data) => {
          void npcStateAction.send(data);
        };
        this.sendStartGameAction = (data) => {
          void startGameAction.send(data);
        };
        this.sendHitAction = (data) => {
          void hitAction.send(data);
        };

        // Handle peer joins
        this.room.onPeerJoin(({ peerId }) => {
          this.broadcastMyInfo(peerId);
        });

        // Handle peer leaves
        this.room.onPeerLeave(({ peerId }) => {
          this.peers.delete(peerId);
          this.notifyPeersUpdated();
        });

        // Receive remote peer info
        peerInfoAction.onMessage((info, { peerId }) => {
          this.peers.set(peerId, { ...info, id: peerId });
          this.notifyPeersUpdated();
        });

        // Receive remote player positions
        playerStateAction.onMessage((data) => {
          this.callbacks.onRemotePlayerUpdate?.(data);
        });

        // Receive NPCs state (guests only)
        npcStateAction.onMessage((npcs) => {
          if (!this.isHost) {
            this.callbacks.onNpcUpdate?.(npcs);
          }
        });

        // Receive start game signal
        startGameAction.onMessage((msg) => {
          if (msg.spawnSeed !== undefined) {
            this.spawnSeed = msg.spawnSeed;
          }
          if (msg.peerOrder) {
            this.peerOrder = msg.peerOrder;
          }
          this.callbacks.onGameStarted?.();
        });

        // Receive hit event
        hitAction.onMessage(({ hitterId, targetId }) => {
          this.callbacks.onPlayerHit?.(hitterId, targetId);
        });

        // Broadcast my presence
        setTimeout(() => {
          this.broadcastMyInfo();
          resolve(true);
        }, 300);
      } catch (err) {
        console.error('Failed to join multiplayer room:', err);
        this.isConnected = false;
        resolve(false);
      }
    });
  }

  broadcastMyInfo(targetPeerId?: string) {
    if (!this.sendPeerInfoAction) return;
    const info: RoomPeerInfo = {
      id: this.myId,
      name: this.myName,
      color: this.myColor,
      isHost: this.isHost,
      isReady: true,
    };
    if (targetPeerId) {
      this.sendPeerInfoAction(info, targetPeerId);
    } else {
      this.sendPeerInfoAction(info);
    }
  }

  setCarColor(color: string) {
    this.myColor = color;
    this.broadcastMyInfo();
  }

  startGame() {
    if (!this.isHost || !this.sendStartGameAction) return;
    const allPeers = this.getConnectedPeers().map((p) => p.id).sort();
    const spawnSeed = Math.floor(Math.random() * 1000000) + 1;
    this.spawnSeed = spawnSeed;
    this.peerOrder = allPeers;
    this.sendStartGameAction({ timestamp: Date.now(), spawnSeed, peerOrder: allPeers });
    this.callbacks.onGameStarted?.();
  }

  getMySpawnIndex(): number {
    const list = this.peerOrder.length > 0
      ? this.peerOrder
      : this.getConnectedPeers().map((p) => p.id).sort();
    const idx = list.indexOf(this.myId);
    return idx >= 0 ? idx : 0;
  }

  getSpawnSeed(): number {
    if (this.spawnSeed > 0) return this.spawnSeed;
    let h = 0;
    for (let i = 0; i < this.roomId.length; i++) {
      h = (Math.imul(31, h) + this.roomId.charCodeAt(i)) | 0;
    }
    return Math.abs(h) || 42;
  }

  sendPlayerUpdate(data: Omit<PlayerNetworkData, 'id' | 'name' | 'color' | 'timestamp'>) {
    if (!this.sendPlayerStateAction || !this.isConnected) return;
    this.sendPlayerStateAction({
      ...data,
      id: this.myId,
      name: this.myName,
      color: this.myColor,
      timestamp: Date.now(),
    });
  }

  sendNpcUpdate(npcs: NpcNetworkData[]) {
    if (!this.isHost || !this.sendNpcStateAction || !this.isConnected) return;
    this.sendNpcStateAction(npcs);
  }

  sendHit(targetId: string) {
    if (!this.sendHitAction) return;
    this.sendHitAction({ hitterId: this.myId, targetId });
  }

  getConnectedPeers(): RoomPeerInfo[] {
    const list: RoomPeerInfo[] = [
      {
        id: this.myId,
        name: this.myName,
        color: this.myColor,
        isHost: this.isHost,
        isReady: true,
      },
    ];
    this.peers.forEach((peer) => list.push(peer));
    return list;
  }

  private notifyPeersUpdated() {
    this.callbacks.onPeersUpdated?.(this.getConnectedPeers());
  }

  leave() {
    if (this.room) {
      try {
        this.room.leave();
      } catch {
        // Ignore clean exit
      }
      this.room = null;
    }
    this.peers.clear();
    this.peerOrder = [];
    this.spawnSeed = 0;
    this.isConnected = false;
    this.roomId = '';
  }
}
