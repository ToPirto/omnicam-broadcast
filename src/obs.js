import OBSWebSocket from 'obs-websocket-js';
import { createEnvelope } from './protocol.js';

export class ObsBridge {
  constructor(config, signaling) {
    this.config = config;
    this.signaling = signaling;
    this.obs = new OBSWebSocket();
    this.connected = false;
    this.tallyState = new Map();
    this.inputToCamId = new Map();
    this.reconnectAttempt = 0;
  }

  updateConfig(config) {
    this.config = config;
    this.reconnect();
  }

  async addBrowserSource(name, url) {
    if (!this.connected) throw new Error('Not connected to OBS');
    const programResp = await this.obs.call('GetCurrentProgramScene');
    const sceneName = programResp.currentProgramSceneName;
    
    let exists = false;
    try {
      const inputsResp = await this.obs.call('GetInputList', { inputKind: 'browser_source' });
      if (inputsResp.inputs.some(i => i.inputName === name)) {
        exists = true;
      }
    } catch(e) {}

    if (exists) {
      await this.obs.call('SetInputSettings', {
        inputName: name,
        inputSettings: { url: url }
      });
    } else {
      await this.obs.call('CreateInput', {
        sceneName,
        inputName: name,
        inputKind: 'browser_source',
        inputSettings: {
          url: url,
          width: 1920,
          height: 1080,
          reroute_audio: true
        },
        sceneItemEnabled: true
      });
    }
    
    await this.refreshInputs();
    return exists;
  }

  reconnectWithDelay(delay) {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(() => {});
    }, delay);
  }

  reconnect() {
    this.reconnectAttempt = 0;
    this.reconnectWithDelay(2000);
  }

  // Broadcast obs_status only when the value actually changes
  _setConnected(value) {
    if (this.connected === value) return;
    this.connected = value;
    this.signaling.broadcastToDashboards(
      createEnvelope('obs_status', 'server', 'dashboard', { connected: value })
    );
  }

  async connect() {
    await this.disconnect();

    if (!this.obs) {
      this.obs = new OBSWebSocket();
    }

    this.obs.on('Identified', () => {
      if (!this.connected) {
        console.log('🔗 Connected and Identified to OBS WebSocket');
      }
      this._setConnected(true);
    });
    
    this.obs.on('ConnectionClosed', () => {
      if (this.connected) {
        console.log('🔌 Disconnected from OBS WebSocket');
      }
      this._setConnected(false);
      this.reconnectWithDelay(Math.min(30000, 2000 * Math.pow(2, this.reconnectAttempt)));
      this.reconnectAttempt++;
    });

    const triggerUpdate = () => {
      if (this.updateTimeout) clearTimeout(this.updateTimeout);
      this.updateTimeout = setTimeout(() => this.updateTally(), 100);
    };

    this.obs.on('CurrentProgramSceneChanged', triggerUpdate);
    this.obs.on('CurrentPreviewSceneChanged', triggerUpdate);
    this.obs.on('SceneItemEnableStateChanged', triggerUpdate);
    this.obs.on('SceneItemCreated', triggerUpdate);
    this.obs.on('SceneItemRemoved', triggerUpdate);
    this.obs.on('InputCreated', triggerUpdate);
    this.obs.on('InputNameChanged', triggerUpdate);

    this.pollInterval = setInterval(() => {
      if (this.connected) this.updateTally();
    }, 5000);

    try {
      await this.obs.connect(this.config.obsWsUrl, this.config.obsWsPassword);
      this.reconnectAttempt = 0;
      await this.updateTally();
    } catch (err) {
      if (this.reconnectAttempt === 0) {
        console.error(`Failed to connect to OBS WebSocket: ${err.message}. Retrying...`);
      }
      this.reconnectWithDelay(Math.min(30000, 2000 * Math.pow(2, this.reconnectAttempt)));
      this.reconnectAttempt++;
    }
  }

  async refreshInputs() {
    if (!this.connected) return;
    try {
      const response = await this.obs.call('GetInputList', { inputKind: 'browser_source' });
      const inputs = response.inputs;
      
      this.inputToCamId.clear();
      
      for (const input of inputs) {
        const settings = await this.obs.call('GetInputSettings', { inputName: input.inputName });
        const urlStr = settings.inputSettings.url || '';
        let camId = null;
        try {
          const parsed = new URL(urlStr, 'http://localhost');
          if (parsed.pathname.startsWith('/view/')) {
             camId = parsed.searchParams.get('camId');
             if (!camId) {
               const match = parsed.pathname.match(/\/view\/([^/]+)/);
               if (match && match[1] !== 'index.html') {
                 camId = match[1];
               }
             }
          }
        } catch (e) { }

        if (camId) {
          this.inputToCamId.set(input.inputName, camId);
        }
      }
    } catch (err) {
      console.error('Error refreshing OBS inputs:', err.message);
    }
  }

  async updateTally() {
    if (!this.connected) return;
    try {
      await this.refreshInputs();

      const newTallyState = new Map();
      
      let programScene = '';
      try {
        const programResp = await this.obs.call('GetCurrentProgramScene');
        programScene = programResp.currentProgramSceneName;
      } catch (e) { }

      let previewScene = '';
      try {
        const previewResp = await this.obs.call('GetCurrentPreviewScene');
        previewScene = previewResp.currentPreviewSceneName;
      } catch (e) { }

      const checkScene = async (sceneName, tallyLevel) => {
        if (!sceneName) return;
        try {
          const itemsResp = await this.obs.call('GetSceneItemList', { sceneName });
          for (const item of itemsResp.sceneItems) {
            if (!item.sceneItemEnabled) continue;
            
            if (item.sourceType === 'OBS_SOURCE_TYPE_INPUT') {
              const camId = this.inputToCamId.get(item.sourceName);
              if (camId) {
                const currentLevel = newTallyState.get(camId) || 0;
                if (tallyLevel > currentLevel) {
                  newTallyState.set(camId, tallyLevel);
                }
              }
            } else if (item.sourceType === 'OBS_SOURCE_TYPE_SCENE') {
               await checkScene(item.sourceName, tallyLevel);
            }
          }
        } catch (e) { }
      };

      await checkScene(previewScene, 1);
      await checkScene(programScene, 2);

      const allCameras = this.signaling.registry.listCameras();
      
      for (const cam of allCameras) {
        const camId = cam.id;
        const newState = newTallyState.get(camId) || 0;
        const oldState = this.tallyState.get(camId) || 0;
        
        if (newState !== oldState || !this.tallyState.has(camId)) {
          this.tallyState.set(camId, newState);
          
          if (newState !== oldState) {
            const msg = createEnvelope('tally', 'server', camId, { state: newState });
            this.signaling.relayTo(msg);
            
            this.signaling.registry.updateTally(camId, newState);
            this.signaling.broadcastToDashboards(createEnvelope('tally', 'server', 'dashboard', { camId, state: newState }));
          }
        }
      }
    } catch (err) {
      console.error('Error updating tally:', err.message);
    }
  }

  async disconnect() {
    if (this.updateTimeout) clearTimeout(this.updateTimeout);
    if (this.pollInterval) clearInterval(this.pollInterval);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    
    if (this.obs) {
      this.obs.removeAllListeners();
      if (this.connected) {
        try { await this.obs.disconnect(); } catch(e) {}
      }
      this.obs = null;
    }
    if (this.connected) {
      console.log('🔌 Disconnected from OBS WebSocket');
    }
    this._setConnected(false);
  }

  close() {
    this.disconnect();
  }
}
