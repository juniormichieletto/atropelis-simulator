import React, { useState, useEffect, useRef } from 'react';
import './MultiplayerLobbyView.css';
import backgroundImage from '../../../initial_screen.png';
import {
  MultiplayerService,
  MULTIPLAYER_CAR_COLORS,
} from '../../services/MultiplayerService';
import type { RoomPeerInfo } from '../../services/MultiplayerService';
import { soundService } from '../../services/SoundService';

interface MultiplayerLobbyViewProps {
  userName: string;
  initialRoomCode?: string;
  onStartMultiplayerGame: (service: MultiplayerService) => void;
  onBackToMenu: () => void;
}

export const MultiplayerLobbyView: React.FC<MultiplayerLobbyViewProps> = ({
  userName,
  initialRoomCode = '',
  onStartMultiplayerGame,
  onBackToMenu,
}) => {
  const [roomCodeInput, setRoomCodeInput] = useState(initialRoomCode.toUpperCase());
  const [selectedColor, setSelectedColor] = useState(MULTIPLAYER_CAR_COLORS[0].main);
  const [isInRoom, setIsInRoom] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [peers, setPeers] = useState<RoomPeerInfo[]>([]);
  const [copyFeedback, setCopyFeedback] = useState('');

  const serviceRef = useRef<MultiplayerService | null>(null);
  const hasStartedGameRef = useRef(false);
  const onStartRef = useRef(onStartMultiplayerGame);
  useEffect(() => {
    onStartRef.current = onStartMultiplayerGame;
  }, [onStartMultiplayerGame]);

  const joinRoomInternal = async (code: string) => {
    if (!code || !serviceRef.current) return;
    setIsConnecting(true);

    const service = serviceRef.current;
    const ok = await service.join(code, false);
    setIsConnecting(false);
    if (ok) {
      setIsInRoom(true);
      setSelectedColor(service.myColor);
      setPeers(service.getConnectedPeers());
    }
  };

  useEffect(() => {
    hasStartedGameRef.current = false;
    const service = new MultiplayerService(userName);
    service.setCarColor(selectedColor);
    serviceRef.current = service;

    service.setCallbacks({
      onPeersUpdated: (updatedPeers) => {
        setPeers([...updatedPeers]);
        if (serviceRef.current) {
          setSelectedColor(serviceRef.current.myColor);
        }
      },
      onGameStarted: () => {
        hasStartedGameRef.current = true;
        soundService.playUiSound();
        onStartRef.current(service);
      },
    });

    if (initialRoomCode) {
      void joinRoomInternal(initialRoomCode.toUpperCase());
    }

    return () => {
      if (!hasStartedGameRef.current) {
        service.leave();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userName, initialRoomCode]);

  const handleCreateRoom = async () => {
    soundService.playUiSound();
    if (!serviceRef.current) return;
    setIsConnecting(true);

    // Generate random 5-char code
    const generated = 'ATRO' + Math.floor(10 + Math.random() * 90);
    const service = serviceRef.current;

    const ok = await service.join(generated, true);
    setIsConnecting(false);
    if (ok) {
      setIsInRoom(true);
      setSelectedColor(service.myColor);
      setPeers(service.getConnectedPeers());
    }
  };

  const handleJoinRoom = async (codeToJoin?: string) => {
    soundService.playUiSound();
    const code = (codeToJoin || roomCodeInput).trim().toUpperCase();
    await joinRoomInternal(code);
  };

  const handleLeaveRoom = () => {
    soundService.playUiSound();
    serviceRef.current?.leave();
    setIsInRoom(false);
    setPeers([]);
    setCopyFeedback('');
  };

  const handleColorChange = (color: string) => {
    soundService.playUiSound();
    setSelectedColor(color);
    serviceRef.current?.setCarColor(color, true);
  };

  const handleCopyLink = () => {
    soundService.playUiSound();
    const service = serviceRef.current;
    if (!service) return;

    const shareUrl = `${window.location.origin}${window.location.pathname}?sala=${service.roomId}`;
    navigator.clipboard.writeText(shareUrl).then(
      () => {
        setCopyFeedback('LINK COPIADO! ENVIE PARA SEUS AMIGOS.');
        setTimeout(() => setCopyFeedback(''), 3500);
      },
      () => {
        setCopyFeedback(`Código da sala: ${service.roomId}`);
      }
    );
  };

  const handleStartGame = () => {
    hasStartedGameRef.current = true;
    soundService.playUiSound();
    serviceRef.current?.startGame();
  };

  const isHost = serviceRef.current?.isHost ?? false;

  return (
    <div className="mp-lobby-container" style={{ backgroundImage: `url(${backgroundImage})` }}>
      <div className="mp-lobby-card">
        <h1 className="mp-title">MULTIPLAYER ONLINE</h1>
        <p className="mp-subtitle">MODO P2P (LONDRES • IRLANDA • BRASIL)</p>

        {!isInRoom ? (
          <div className="mp-setup-section">
            <div className="mp-color-picker-box">
              <label className="mp-label">ESCOLHA SEU CARRO:</label>
              <div className="mp-color-options">
                {MULTIPLAYER_CAR_COLORS.map((c) => (
                  <button
                    key={c.name}
                    className={`mp-color-btn ${selectedColor === c.main ? 'active' : ''}`}
                    style={{ backgroundColor: c.main }}
                    onClick={() => handleColorChange(c.main)}
                    title={c.name}
                  />
                ))}
              </div>
            </div>

            <div className="mp-actions-grid">
              <div className="mp-action-card">
                <h3>CRIAR UMA SALA</h3>
                <p className="mp-desc">Seja o Host e convide amigos para correr na sua cidade.</p>
                <button
                  className="mp-btn primary-btn"
                  onClick={handleCreateRoom}
                  disabled={isConnecting}
                >
                  {isConnecting ? 'CONECTANDO...' : 'CRIAR SALA'}
                </button>
              </div>

              <div className="mp-action-card">
                <h3>ENTRAR EM UMA SALA</h3>
                <p className="mp-desc">Digite o código da sala enviado pelo seu amigo.</p>
                <input
                  type="text"
                  className="mp-input"
                  placeholder="EX: ATRO42"
                  value={roomCodeInput}
                  maxLength={10}
                  onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                />
                <button
                  className="mp-btn secondary-btn"
                  onClick={() => handleJoinRoom()}
                  disabled={isConnecting || !roomCodeInput.trim()}
                >
                  {isConnecting ? 'CONECTANDO...' : 'ENTRAR NA SALA'}
                </button>
              </div>
            </div>

            <button
              className="mp-btn back-btn"
              onClick={() => {
                soundService.playUiSound();
                serviceRef.current?.leave();
                onBackToMenu();
              }}
            >
              VOLTAR AO MENU PRINCIPAL
            </button>
          </div>
        ) : (
          <div className="mp-room-section">
            <div className="mp-room-header">
              <div className="mp-room-badge">
                SALA: <span className="mp-room-code">{serviceRef.current?.roomId}</span>
                {isHost && <span className="mp-host-badge">HOST 👑</span>}
              </div>
              <button className="mp-copy-btn" onClick={handleCopyLink}>
                🔗 COPIAR LINK DE CONVITE
              </button>
            </div>

            {copyFeedback && <div className="mp-toast">{copyFeedback}</div>}

            <div className="mp-color-picker-box">
              <label className="mp-label">COR DO SEU CARRO:</label>
              <div className="mp-color-options">
                {MULTIPLAYER_CAR_COLORS.map((c) => (
                  <button
                    key={c.name}
                    className={`mp-color-btn ${selectedColor === c.main ? 'active' : ''}`}
                    style={{ backgroundColor: c.main }}
                    onClick={() => handleColorChange(c.main)}
                    title={c.name}
                  />
                ))}
              </div>
            </div>

            <div className="mp-players-list-box">
              <h3>PILOTOS CONECTADOS ({peers.length}):</h3>
              <div className="mp-peers-grid">
                {peers.map((p) => (
                  <div key={p.id} className="mp-peer-card">
                    <span className="mp-car-dot" style={{ backgroundColor: p.color }} />
                    <span className="mp-peer-name">{p.name}</span>
                    {p.isHost ? (
                      <span className="mp-peer-tag host">HOST 👑</span>
                    ) : (
                      <span className="mp-peer-tag">PRONTO ✔</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="mp-lobby-footer">
              {isHost ? (
                <button className="mp-btn start-race-btn" onClick={handleStartGame}>
                  INICIAR CORRIDA 🏁
                </button>
              ) : (
                <div className="mp-waiting-text">
                  ⏳ AGUARDANDO O HOST INICIAR A CORRIDA...
                </div>
              )}

              <button className="mp-btn leave-btn" onClick={handleLeaveRoom}>
                SAIR DA SALA
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
