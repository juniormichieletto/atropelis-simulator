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
  onNpcHit?: (npcId: number, hitterId: string, hitParams?: { x: number; y: number; angle: number; speed: number }) => void;
  onPeerLeave?: (peerId: string) => void;
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
  public isColorManuallySelected: boolean = false;
  public spawnSeed: number = 0;
  public raceStartTime: number = 0;
  public peerOrder: string[] = [];
  public colorAssignments: Record<string, string> = {};

  private room: ReturnType<typeof joinRoom> | null = null;
  private peers: Map<string, RoomPeerInfo> = new Map();
  private callbacks: MultiplayerEventCallback = {};

  // Action senders
  private sendPeerInfoAction: ((data: RoomPeerInfo, recipientPeerId?: string) => void) | null = null;
  private sendPlayerStateAction: ((data: PlayerNetworkData) => void) | null = null;
  private sendNpcStateAction: ((data: NpcNetworkData[]) => void) | null = null;
  private sendStartGameAction: ((data: { timestamp: number; spawnSeed?: number; peerOrder?: string[]; colorAssignments?: Record<string, string> }) => void) | null = null;
  private sendHitAction: ((data: { hitterId: string; targetId: string }) => void) | null = null;
  private sendNpcHitAction: ((data: { npcId: number; hitterId: string; x: number; y: number; angle: number; speed: number }) => void) | null = null;

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
        const startGameAction = this.room.makeAction<{ timestamp: number; spawnSeed?: number; peerOrder?: string[]; colorAssignments?: Record<string, string> }>('start_game');
        const hitAction = this.room.makeAction<{ hitterId: string; targetId: string }>('hit_event');
        const npcHitAction = this.room.makeAction<{ npcId: number; hitterId: string; x: number; y: number; angle: number; speed: number }>('npc_hit');

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
        this.sendNpcHitAction = (data) => {
          void npcHitAction.send(data);
        };

        // Handle peer joins
        this.room.onPeerJoin(({ peerId }) => {
          this.broadcastMyInfo(peerId);
        });

        // Handle peer leaves
        this.room.onPeerLeave(({ peerId }) => {
          this.peers.delete(peerId);
          this.notifyPeersUpdated();
          this.callbacks.onPeerLeave?.(peerId);
        });

        // Receive remote peer info
        peerInfoAction.onMessage((info, { peerId }) => {
          this.peers.set(peerId, { ...info, id: peerId });

          // If the player has not explicitly picked a color manually and there's a collision with another peer,
          // or on initial peer sync, ensure a unique color is chosen.
          if (!this.isColorManuallySelected) {
            const hasConflict = Array.from(this.peers.values()).some(
              (p) => p.id !== this.myId && p.color.toLowerCase() === this.myColor.toLowerCase()
            );
            if (hasConflict) {
              this.pickUniqueColor();
              this.broadcastMyInfo();
            }
          }

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
          this.raceStartTime = Date.now();
          if (msg.spawnSeed !== undefined) {
            this.spawnSeed = msg.spawnSeed;
          }
          if (msg.peerOrder) {
            this.peerOrder = msg.peerOrder;
          }
          if (msg.colorAssignments) {
            this.colorAssignments = msg.colorAssignments;
            if (msg.colorAssignments[this.myId]) {
              this.myColor = msg.colorAssignments[this.myId];
            }
          }
          this.callbacks.onGameStarted?.();
        });

        // Receive hit event
        hitAction.onMessage(({ hitterId, targetId }) => {
          this.callbacks.onPlayerHit?.(hitterId, targetId);
        });

        // Receive NPC hit event
        npcHitAction.onMessage((data) => {
          this.callbacks.onNpcHit?.(data.npcId, data.hitterId, data);
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

  setCarColor(color: string, isManual: boolean = false) {
    this.myColor = color;
    if (isManual) {
      this.isColorManuallySelected = true;
    }
    this.broadcastMyInfo();
  }

  /**
   * Automatically picks the first available unique car color not currently taken by peers.
   */
  pickUniqueColor(): string {
    const takenColors = new Set<string>();
    this.peers.forEach((peer) => {
      if (peer.color) {
        takenColors.add(peer.color.toLowerCase());
      }
    });

    const available = MULTIPLAYER_CAR_COLORS.find(
      (c) => !takenColors.has(c.main.toLowerCase())
    );

    const chosenColor = available ? available.main : MULTIPLAYER_CAR_COLORS[0].main;
    this.myColor = chosenColor;
    return chosenColor;
  }

  startGame() {
    if (!this.isHost || !this.sendStartGameAction) return;
    const connectedPeers = this.getConnectedPeers();
    const peerById = new Map(connectedPeers.map((p) => [p.id, p]));
    const allPeers = connectedPeers.map((p) => p.id).sort();
    const spawnSeed = Math.floor(Math.random() * 1000000) + 1;
    this.spawnSeed = spawnSeed;
    this.peerOrder = allPeers;
    this.raceStartTime = Date.now();

    // Preserve each racer's chosen lobby color if unclaimed; resolve collisions with first unused color
    const colorAssignments: Record<string, string> = {};
    const usedColors = new Set<string>();
    allPeers.forEach((peerId, index) => {
      const preferred = peerById.get(peerId)?.color;
      let assigned: string;
      if (preferred && !usedColors.has(preferred.toLowerCase())) {
        assigned = preferred;
      } else {
        const unused = MULTIPLAYER_CAR_COLORS.find((c) => !usedColors.has(c.main.toLowerCase()));
        assigned = unused ? unused.main : MULTIPLAYER_CAR_COLORS[index % MULTIPLAYER_CAR_COLORS.length].main;
      }
      usedColors.add(assigned.toLowerCase());
      colorAssignments[peerId] = assigned;
    });

    if (colorAssignments[this.myId]) {
      this.myColor = colorAssignments[this.myId];
    }
    this.colorAssignments = colorAssignments;

    this.sendStartGameAction({
      timestamp: Date.now(),
      spawnSeed,
      peerOrder: allPeers,
      colorAssignments,
    });
    this.callbacks.onGameStarted?.();
  }

  getMySpawnIndex(): number {
    const list = this.peerOrder.length > 0
      ? this.peerOrder
      : this.getConnectedPeers().map((p) => p.id).sort();
    const idx = list.indexOf(this.myId);
    return idx >= 0 ? idx : 0;
  }

  getMyColor(): string {
    if (this.colorAssignments[this.myId]) {
      return this.colorAssignments[this.myId];
    }
    if (this.myColor) {
      return this.myColor;
    }
    const idx = this.getMySpawnIndex();
    return MULTIPLAYER_CAR_COLORS[idx % MULTIPLAYER_CAR_COLORS.length].main;
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

  sendNpcHit(npcId: number, x: number, y: number, angle: number, speed: number) {
    if (!this.sendNpcHitAction || !this.isConnected) return;
    this.sendNpcHitAction({ npcId, hitterId: this.myId, x, y, angle, speed });
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

  async getPing(targetPeerId?: string): Promise<number | null> {
    if (!this.room || !this.isConnected) return null;
    try {
      if (targetPeerId) {
        const ms = await this.room.ping(targetPeerId);
        return typeof ms === 'number' && !isNaN(ms) ? Math.round(ms) : null;
      }

      // If no specific peer provided, ping remote peers and return average
      const remotePeerIds = Array.from(this.peers.keys());
      if (remotePeerIds.length === 0) return null;

      const pings = await Promise.all(
        remotePeerIds.map(async (id) => {
          try {
            const ms = await this.room!.ping(id);
            return typeof ms === 'number' && !isNaN(ms) ? ms : null;
          } catch {
            return null;
          }
        })
      );

      const valid = pings.filter((p): p is number => p !== null);
      if (valid.length === 0) return null;
      const sum = valid.reduce((a, b) => a + b, 0);
      return Math.round(sum / valid.length);
    } catch {
      return null;
    }
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
    this.colorAssignments = {};
    this.spawnSeed = 0;
    this.raceStartTime = 0;
    this.isConnected = false;
    this.roomId = '';
  }
}
