import OBSWebSocket from 'obs-websocket-js';
import { createEnvelope } from './protocol.js';

export class ObsBridge {
  constructor(config, signaling) {
    this.config = config;
    this.signaling = signaling;
    this.obs = new OBSWebSocket();
    this.connected = false;

    
    // map of camId -> tally state (0: off, 1: preview, 2: program)
    this.tallyState = new Map();
    this.inputToCamId = new Map();

    this.obs.on('Identified', () => {
      console.log('🔗 Connected and Identified to OBS WebSocket');
      this.connected = true;
      this.signaling.broadcastToDashboards(createEnvelope('obs_status', 'server', 'dashboard', { connected: true }));
    });
    
    this.obs.on('ConnectionClosed', () => {
      console.log('🔌 Disconnected from OBS WebSocket');
      this.connected = false;
      this.signaling.broadcastToDashboards(createEnvelope('obs_status', 'server', 'dashboard', { connected: false }));
      this.reconnect();
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
    
    // Poll every 5 seconds just in case of missed events or new URLs
    this.pollInterval = setInterval(() => {
      if (this.connected) this.updateTally();
    }, 5000);
  }

  updateConfig(config) {
    this.config = config;
    this.reconnect();
  }

  async addBrowserSource(name, url) {
    if (!this.connected) throw new Error('Not connected to OBS');
    // Get current program scene to add to
    const programResp = await this.obs.call('GetCurrentProgramScene');
    const sceneName = programResp.currentProgramSceneName;
    
    // Create the input
    await this.obs.call('CreateInput', {
      sceneName,
      inputName: name,
      inputKind: 'browser_source',
      inputSettings: {
        url: url,
        width: 1920,
        height: 1080,
        reroute_audio: true // "Control audio via OBS"
      },
      sceneItemEnabled: true
    });
    
    await this.refreshInputs();
  }

  reconnectWithDelay(delay) {
    this.disconnect();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  reconnect() {
    this.reconnectAttempt = 0;
    this.reconnectWithDelay(2000);
  }

  async connect() {
    try {
      await this.obs.connect(this.config.obsWsUrl, this.config.obsWsPassword);
      this.reconnectAttempt = 0;
      await this.updateTally();
    } catch (err) {
      const delay = Math.min(30000, 2000 * Math.pow(2, this.reconnectAttempt || 0));
      this.reconnectAttempt = (this.reconnectAttempt || 0) + 1;
      
      if (this.reconnectAttempt === 1) {
        console.error(`Failed to connect to OBS WebSocket: ${err.message}. Retrying...`);
      }
      
      this.reconnectWithDelay(delay);
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
          // It could be a relative or absolute URL
          const parsed = new URL(urlStr, 'http://localhost');
          if (parsed.pathname.startsWith('/view/')) {
             camId = parsed.searchParams.get('camId');
             if (!camId) {
               // Fallback to old format /view/cam-123
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
        } catch (e) {
          // Scene might not exist or other error
        }
      };

      await checkScene(previewScene, 1);
      await checkScene(programScene, 2);

      // Check all registered cameras, not just those currently in OBS
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

  disconnect() {
    if (this.updateTimeout) clearTimeout(this.updateTimeout);
    if (this.connected) {
      this.obs.disconnect();
      this.connected = false;
      this.signaling.broadcastToDashboards(createEnvelope('obs_status', 'server', 'dashboard', { connected: false }));
    }
  }

  close() {
    clearInterval(this.pollInterval);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.disconnect();
  }
}
